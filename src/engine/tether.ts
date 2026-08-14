/*
  ─ Tethers ─

  Curved arcs between two occupants. Each end anchors to one of
  six hex vertices, chosen by scoring all 36 pairs on obstacle
  crossings then length, with hysteresis and a short morph so a
  re-pick eases across instead of teleporting. Geometry only —
  the renderer turns the emitted control points into strokes.
*/
import { hexHeight, hexWidth } from "./lattice.js";
import type { OccupancyMap } from "./occupancy.js";
import type { AxialCoord } from "./types.js";

/** Vertex-swap morph duration. Snappier than the drag snap so a
 * re-anchor reads as a correction, not a movement. */
const RELINK_TRANSITION_MS = 60;

/** A candidate pair must beat the locked pair by this margin before
 * the morph triggers — stops flapping between near-tied pairs.
 * World units on the distance side; one crossing is worth 1000, so
 * any change in crossings always trips it. */
const RELINK_HYSTERESIS = 24;

/** Control-point pull as a fraction of chord length, and its cap —
 * keeps long arcs from looping while short ones still bow. */
const PULL_FRACTION = 0.25;
const PULL_MAX = 40;

/** Draw-in duration: an arc sweeps from source to target when it
 * appears, rather than popping in whole. */
const DRAW_IN_MS = 30;

/** Unit outward vectors per vertex, radial from the hex centre.
 * Bezier control points ride these so the curve leaves and enters
 * each hex face-on. Index order: 0=top, 1=top-right, 2=bottom-right,
 * 3=bottom, 4=bottom-left, 5=top-left. */
const OUTWARD_DIRS: readonly { x: number; y: number }[] = [
  { x: 0, y: -1 },
  { x: 0.8660254, y: -0.5 },
  { x: 0.8660254, y: 0.5 },
  { x: 0, y: 1 },
  { x: -0.8660254, y: 0.5 },
  { x: -0.8660254, y: -0.5 },
];

/** Axial neighbour directions, keyed into `ADJACENCY_EXCLUSIONS`. */
const NEIGHBOUR_DELTAS: readonly (readonly [number, number])[] = [
  [1, -1],
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
];

/** For each axial neighbour direction, the vertices on each hex that
 * sit on the shared edge. Anchoring there would draw the arc through
 * the adjacent hex, or visually conflate the arc with a bond, so
 * those vertices are excluded whenever a neighbour is occupied.
 * Same index order as `OUTWARD_DIRS`. */
const ADJACENCY_EXCLUSIONS: Record<
  string,
  { from: readonly [number, number]; to: readonly [number, number] }
> = {
  "1,-1": { from: [0, 1], to: [3, 4] }, // NE
  "1,0": { from: [1, 2], to: [4, 5] }, // E
  "0,1": { from: [2, 3], to: [5, 0] }, // SE
  "-1,1": { from: [3, 4], to: [0, 1] }, // SW
  "-1,0": { from: [4, 5], to: [1, 2] }, // W
  "0,-1": { from: [5, 0], to: [2, 3] }, // NW
};

export interface TetherDef {
  id: string;
  from: string;
  to: string;
  /** `idle` drops to the muted shade; `active` is full strength. */
  state?: "idle" | "active";
  /** Draw an arrowhead at the target end. */
  directed?: boolean;
}

/** A resolved arc, ready to stroke: cubic bezier in world units. */
export interface TetherPath {
  id: string;
  state: "idle" | "active";
  directed: boolean;
  fromX: number;
  fromY: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  toX: number;
  toY: number;
}

interface Anchoring {
  fromIdx: number;
  toIdx: number;
  prevFromIdx: number;
  prevToIdx: number;
  transitionStart: number;
  /** Draw-in requested but not yet stamped — the first resolve after
   * this claims the start time, so callers needn't know the clock. */
  pendingDraw: boolean;
  /** Draw-in start, or null once the arc is fully drawn. */
  drawStart: number | null;
}

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * The six vertices of a pointy-top hex centred on `(cx, cy)`,
 * ordered 0=top clockwise. Deliberately not `hexCorners` from the
 * lattice — that starts at top-right, and this order is the one the
 * adjacency-exclusion table is written against.
 */
function tetherVertices(cx: number, cy: number, side: number): Point[] {
  const halfW = hexWidth(side) / 2;
  const halfH = side;
  const quarterH = side / 2;
  return [
    { x: cx, y: cy - halfH },
    { x: cx + halfW, y: cy - quarterH },
    { x: cx + halfW, y: cy + quarterH },
    { x: cx, y: cy + halfH },
    { x: cx - halfW, y: cy + quarterH },
    { x: cx - halfW, y: cy - quarterH },
  ];
}

/** Do segments AB and CD cross? Standard parametric intersection. */
function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
): boolean {
  const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(denom) < 1e-9) {
    return false;
  }
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** Does the segment cross the axis-aligned rect? */
function lineCrossesRect(x1: number, y1: number, x2: number, y2: number, rect: Rect): boolean {
  if (Math.max(x1, x2) < rect.left || Math.min(x1, x2) > rect.right) {
    return false;
  }
  if (Math.max(y1, y2) < rect.top || Math.min(y1, y2) > rect.bottom) {
    return false;
  }
  const { left: l, right: r, top: t, bottom: b } = rect;
  return (
    segmentsIntersect(x1, y1, x2, y2, l, t, r, t) ||
    segmentsIntersect(x1, y1, x2, y2, r, t, r, b) ||
    segmentsIntersect(x1, y1, x2, y2, r, b, l, b) ||
    segmentsIntersect(x1, y1, x2, y2, l, b, l, t)
  );
}

/** Score a vertex pair: `crossings × 1000 + length`. The heavy
 * per-crossing penalty keeps clear chords ahead of short ones; among
 * equally clear candidates the shortest wins. */
function scorePair(from: Point, to: Point, obstacles: Rect[]): number {
  let crossings = 0;
  for (const obstacle of obstacles) {
    if (lineCrossesRect(from.x, from.y, to.x, to.y, obstacle)) {
      crossings++;
    }
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return crossings * 1000 + Math.hypot(dx, dy);
}

export interface TetherOptions {
  occupancy: OccupancyMap;
  hexSide: number;
  /** Live world position of an occupant's centre — the engine hands
   * back the drag position mid-drag, so arcs follow for free. */
  positionOf: (id: string) => [number, number] | null;
  instant?: boolean;
  onSettle?: (detail: { id: string; fromVertex: number; toVertex: number }) => void;
}

export class TetherController {
  private readonly options: TetherOptions;
  private readonly tethers = new Map<string, TetherDef>();
  private readonly anchoring = new Map<string, Anchoring>();

  constructor(options: TetherOptions) {
    this.options = options;
  }

  get size(): number {
    return this.tethers.size;
  }

  list(): TetherDef[] {
    return [...this.tethers.values()];
  }

  /** Existing tether between two occupants, either direction. */
  find(a: string, b: string): TetherDef | null {
    for (const tether of this.tethers.values()) {
      if ((tether.from === a && tether.to === b) || (tether.from === b && tether.to === a)) {
        return tether;
      }
    }
    return null;
  }

  add(tether: TetherDef): void {
    this.tethers.set(tether.id, tether);
    this.anchoring.set(tether.id, {
      fromIdx: -1,
      toIdx: -1,
      prevFromIdx: -1,
      prevToIdx: -1,
      transitionStart: 0,
      pendingDraw: !this.options.instant,
      drawStart: null,
    });
  }

  /** Replay the draw-in sweep on every arc — used when the graph
   * layer becomes visible, so the arcs draw themselves in. */
  drawInAll(): void {
    if (this.options.instant) {
      return;
    }
    for (const state of this.anchoring.values()) {
      state.pendingDraw = true;
      state.drawStart = null;
    }
  }

  remove(id: string): void {
    this.tethers.delete(id);
    this.anchoring.delete(id);
  }

  /** Remove every tether touching an occupant (it left the world). */
  removeFor(occupantId: string): void {
    for (const [id, tether] of this.tethers) {
      if (tether.from === occupantId || tether.to === occupantId) {
        this.remove(id);
      }
    }
  }

  clear(): void {
    this.tethers.clear();
    this.anchoring.clear();
  }

  /** True while any arc is mid-morph or mid-draw-in — keeps the loop
   * scheduling frames until every arc has settled. */
  get animating(): boolean {
    for (const state of this.anchoring.values()) {
      if (state.transitionStart > 0 || state.pendingDraw || state.drawStart !== null) {
        return true;
      }
    }
    return false;
  }

  /** Bounding rects of every occupied cell that isn't an endpoint —
   * the hexes an arc should try not to cross. */
  private obstacles(fromId: string, toId: string): Rect[] {
    const { occupancy, hexSide, positionOf } = this.options;
    const halfW = hexWidth(hexSide) / 2;
    const halfH = hexHeight(hexSide) / 2;
    const rects: Rect[] = [];
    for (const id of occupancy.ids()) {
      if (id === fromId || id === toId) {
        continue;
      }
      const position = positionOf(id);
      if (!position) {
        continue;
      }
      rects.push({
        left: position[0] - halfW,
        right: position[0] + halfW,
        top: position[1] - halfH,
        bottom: position[1] + halfH,
      });
    }
    return rects;
  }

  /** Vertices made ambiguous by an occupied axial neighbour. */
  private excludedVertices(id: string, side: "from" | "to"): Set<number> {
    const excluded = new Set<number>();
    const cell = this.options.occupancy.cellOf(id);
    if (!cell) {
      return excluded;
    }
    for (const neighbour of NEIGHBOUR_DELTAS) {
      const at: AxialCoord = { q: cell.q + neighbour[0], r: cell.r + neighbour[1] };
      if (!this.options.occupancy.occupantAt(at)) {
        continue;
      }
      const entry = ADJACENCY_EXCLUSIONS[`${neighbour[0]},${neighbour[1]}`];
      if (entry) {
        for (const vertex of entry[side]) {
          excluded.add(vertex);
        }
      }
    }
    return excluded;
  }

  private pickPair(
    fromVerts: Point[],
    toVerts: Point[],
    fromExcluded: Set<number>,
    toExcluded: Set<number>,
    obstacles: Rect[]
  ): { fromIdx: number; toIdx: number; score: number } {
    let best = { fromIdx: 0, toIdx: 0, score: Number.POSITIVE_INFINITY };
    for (let i = 0; i < 6; i++) {
      if (fromExcluded.has(i)) {
        continue;
      }
      for (let j = 0; j < 6; j++) {
        if (toExcluded.has(j)) {
          continue;
        }
        const score = scorePair(fromVerts[i]!, toVerts[j]!, obstacles);
        if (score < best.score) {
          best = { fromIdx: i, toIdx: j, score };
        }
      }
    }
    return best;
  }

  /**
   * Resolve every tether to a drawable bezier for the current
   * geometry, advancing any in-flight morph to `now`.
   */
  paths(now: number): TetherPath[] {
    const { hexSide, positionOf, instant, onSettle } = this.options;
    const out: TetherPath[] = [];
    for (const tether of this.tethers.values()) {
      const fromPos = positionOf(tether.from);
      const toPos = positionOf(tether.to);
      const state = this.anchoring.get(tether.id);
      if (!fromPos || !toPos || !state) {
        continue;
      }
      const fromVerts = tetherVertices(fromPos[0], fromPos[1], hexSide);
      const toVerts = tetherVertices(toPos[0], toPos[1], hexSide);
      const obstacles = this.obstacles(tether.from, tether.to);
      const fromExcluded = this.excludedVertices(tether.from, "from");
      const toExcluded = this.excludedVertices(tether.to, "to");

      if (state.fromIdx < 0 || state.toIdx < 0) {
        const pick = this.pickPair(fromVerts, toVerts, fromExcluded, toExcluded, obstacles);
        state.fromIdx = pick.fromIdx;
        state.toIdx = pick.toIdx;
        onSettle?.({ id: tether.id, fromVertex: pick.fromIdx, toVertex: pick.toIdx });
      } else if (state.transitionStart === 0) {
        // Continuous re-pick. A locked vertex that just became
        // excluded scores Infinity, so any candidate beats it.
        const pick = this.pickPair(fromVerts, toVerts, fromExcluded, toExcluded, obstacles);
        if (pick.fromIdx !== state.fromIdx || pick.toIdx !== state.toIdx) {
          const lockedValid = !fromExcluded.has(state.fromIdx) && !toExcluded.has(state.toIdx);
          const lockedScore = lockedValid
            ? scorePair(fromVerts[state.fromIdx]!, toVerts[state.toIdx]!, obstacles)
            : Number.POSITIVE_INFINITY;
          if (pick.score < lockedScore - RELINK_HYSTERESIS) {
            if (instant) {
              state.fromIdx = pick.fromIdx;
              state.toIdx = pick.toIdx;
              onSettle?.({ id: tether.id, fromVertex: pick.fromIdx, toVertex: pick.toIdx });
            } else {
              state.prevFromIdx = state.fromIdx;
              state.prevToIdx = state.toIdx;
              state.fromIdx = pick.fromIdx;
              state.toIdx = pick.toIdx;
              state.transitionStart = now;
            }
          }
        }
      }

      let from = fromVerts[state.fromIdx]!;
      let to = toVerts[state.toIdx]!;
      let outFrom = OUTWARD_DIRS[state.fromIdx]!;
      let outTo = OUTWARD_DIRS[state.toIdx]!;

      // Morph: lerp both position and outward direction so the arc
      // eases across rather than snapping to the new vertices.
      if (state.transitionStart > 0 && state.prevFromIdx >= 0 && state.prevToIdx >= 0) {
        const progress = Math.min((now - state.transitionStart) / RELINK_TRANSITION_MS, 1);
        if (progress >= 1) {
          state.transitionStart = 0;
          state.prevFromIdx = -1;
          state.prevToIdx = -1;
          onSettle?.({ id: tether.id, fromVertex: state.fromIdx, toVertex: state.toIdx });
        } else {
          const ease = progress * progress * (3 - 2 * progress);
          from = lerpPoint(fromVerts[state.prevFromIdx]!, from, ease);
          to = lerpPoint(toVerts[state.prevToIdx]!, to, ease);
          outFrom = lerpPoint(OUTWARD_DIRS[state.prevFromIdx]!, outFrom, ease);
          outTo = lerpPoint(OUTWARD_DIRS[state.prevToIdx]!, outTo, ease);
        }
      }

      const length = Math.hypot(to.x - from.x, to.y - from.y);
      if (length < 1) {
        continue;
      }
      const pull = Math.min(length * PULL_FRACTION, PULL_MAX);
      let c1: Point = { x: from.x + outFrom.x * pull, y: from.y + outFrom.y * pull };
      let c2: Point = { x: to.x + outTo.x * pull, y: to.y + outTo.y * pull };
      let end: Point = to;

      // Draw-in sweep: show only the leading fraction of the curve.
      if (state.pendingDraw) {
        state.drawStart = now;
        state.pendingDraw = false;
      }
      if (state.drawStart !== null) {
        const progress = Math.min((now - state.drawStart) / DRAW_IN_MS, 1);
        if (progress >= 1) {
          state.drawStart = null;
        } else {
          const trimmed = truncateCubic(from, c1, c2, to, Math.max(progress, 0.001));
          c1 = trimmed.c1;
          c2 = trimmed.c2;
          end = trimmed.end;
        }
      }

      out.push({
        id: tether.id,
        state: tether.state ?? "active",
        directed: tether.directed ?? false,
        fromX: from.x,
        fromY: from.y,
        c1x: c1.x,
        c1y: c1.y,
        c2x: c2.x,
        c2y: c2.y,
        toX: end.x,
        toY: end.y,
      });
    }
    return out;
  }
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * The leading `t` fraction of a cubic bezier, as its own cubic —
 * de Casteljau subdivision. Exact, so a partially-drawn arc traces
 * the identical path the finished one will, and its endpoint and
 * final control point stay valid (a directed head rides the tip).
 */
function truncateCubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): { c1: Point; c2: Point; end: Point } {
  const q0 = lerpPoint(p0, p1, t);
  const q1 = lerpPoint(p1, p2, t);
  const q2 = lerpPoint(p2, p3, t);
  const r0 = lerpPoint(q0, q1, t);
  const r1 = lerpPoint(q1, q2, t);
  return { c1: q0, c2: r0, end: lerpPoint(r0, r1, t) };
}
