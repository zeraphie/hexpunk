/*
  ─ Ignition runners ─

  The ignite effect: a few glowing heads that crawl along the
  hex lattice edges from the press point, turning randomly and
  occasionally branching — individual lit lines rather than a
  page-wide wave. Heads emit segment splats into the energy
  field; the trails fade with the field's own physics.
  (PLAN.hp-grid-smoothness.md § Decisions › click-ignition)
*/

/** Milliseconds for a head to traverse one lattice edge. */
const EDGE_MS = 60;

/** Edges a runner lives for (inclusive random range). Keeps the
 * effect localised — a handful of hexes around the press point. */
const EDGES_MIN = 4;
const EDGES_MAX = 7;

/** Chance to branch at a vertex (spawning a sibling down the road
 * not taken), while under the concurrency cap. */
const BRANCH_CHANCE = 0.3;

/** Heads spawned per ignition press. */
const SPAWN_COUNT = 3;

/** Concurrency cap across all presses — matches the field shader's
 * splat array. */
const MAX_ACTIVE = 8;

/** One crawling head. Positions are page CSS px so paths stay glued
 * to the page-attached pattern. `typeY` tracks which of the two
 * honeycomb vertex families the CURRENT TARGET vertex belongs to
 * (edge directions alternate between families every step). */
interface Runner {
  x: number;
  y: number;
  tx: number;
  ty: number;
  progress: number;
  typeY: boolean;
  lastDirX: number;
  lastDirY: number;
  edgesLeft: number;
  headX: number;
  headY: number;
}

/** A head's movement this frame, in page CSS px. */
export interface RunnerSegment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/** Edge directions available at a vertex, per family, for pointy-top
 * side length s (page coords, y-down):
 * - Y family (top / bottom-left / bottom-right hex vertices): one
 *   edge straight up, two down-diagonals.
 * - λ family: one edge straight down, two up-diagonals. */
function directionsFor(typeY: boolean, s: number): Array<[number, number]> {
  const w = (s * Math.sqrt(3)) / 2;
  const h = s / 2;
  return typeY
    ? [
        [0, -s],
        [-w, h],
        [w, h],
      ]
    : [
        [0, s],
        [-w, -h],
        [w, -h],
      ];
}

/** Snap a page point to the nearest lattice vertex. The pattern's
 * hex centres sit at page coords (i·s√3 + rowOffset, n·1.5s) —
 * the same phase the bake shader tiles from page origin — so the
 * runners trace the actually-rendered edges. */
function snapToVertex(px: number, py: number, s: number): { x: number; y: number; typeY: boolean } {
  const tileW = s * Math.sqrt(3);
  const rowH = 1.5 * s;
  let best = { x: 0, y: 0, typeY: true };
  let bestSq = Infinity;
  const nMid = Math.round(py / rowH);
  for (let n = nMid - 1; n <= nMid + 1; n++) {
    const off = n % 2 === 0 ? 0 : tileW / 2;
    const cy = n * rowH;
    const ci = Math.round((px - off) / tileW);
    for (let i = ci - 1; i <= ci + 1; i++) {
      const cx = i * tileW + off;
      // Six vertices per centre; top + bottom-left + bottom-right
      // are the Y family, the other three are λ.
      const candidates: Array<[number, number, boolean]> = [
        [cx, cy - s, true],
        [cx - tileW / 2, cy + s / 2, true],
        [cx + tileW / 2, cy + s / 2, true],
        [cx, cy + s, false],
        [cx - tileW / 2, cy - s / 2, false],
        [cx + tileW / 2, cy - s / 2, false],
      ];
      for (const [vx, vy, typeY] of candidates) {
        const dsq = (vx - px) ** 2 + (vy - py) ** 2;
        if (dsq < bestSq) {
          bestSq = dsq;
          best = { x: vx, y: vy, typeY };
        }
      }
    }
  }
  return best;
}

/**
 * Owns every active runner across presses. Pure CPU-side path
 * logic — the element converts the emitted page-space segments to
 * field space and feeds them to the sim.
 */
export class LatticeRunners {
  private runners: Runner[] = [];

  /** True while any head is still crawling. */
  get active(): boolean {
    return this.runners.length > 0;
  }

  /**
   * Launch runners from a press point.
   *
   * @param pageX - Press X in page CSS px.
   * @param pageY - Press Y in page CSS px.
   * @param hexSize - Lattice side length in CSS px.
   */
  spawn(pageX: number, pageY: number, hexSize: number): void {
    const v = snapToVertex(pageX, pageY, hexSize);
    const dirs = directionsFor(v.typeY, hexSize);
    // Start each head down a distinct edge; SPAWN_COUNT ≤ 3 = the
    // vertex degree, so no duplicates.
    const order = [...dirs].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(SPAWN_COUNT, order.length); i++) {
      if (this.runners.length >= MAX_ACTIVE) {
        this.runners.shift();
      }
      const [dx, dy] = order[i]!;
      this.runners.push({
        x: v.x,
        y: v.y,
        tx: v.x + dx,
        ty: v.y + dy,
        progress: 0,
        // Crossing one edge lands on the other family.
        typeY: !v.typeY,
        lastDirX: dx,
        lastDirY: dy,
        edgesLeft: EDGES_MIN + Math.floor(Math.random() * (EDGES_MAX - EDGES_MIN + 1)),
        headX: v.x,
        headY: v.y,
      });
    }
  }

  /**
   * Advance every head and report their movement segments.
   *
   * @param dt - Frame delta in ms.
   * @param hexSize - Lattice side length in CSS px.
   * @returns One segment per live head, page CSS px.
   */
  update(dt: number, hexSize: number): RunnerSegment[] {
    const segments: RunnerSegment[] = [];
    const next: Runner[] = [];
    const spawned: Runner[] = [];
    for (const r of this.runners) {
      const prevX = r.headX;
      const prevY = r.headY;
      r.progress += dt / EDGE_MS;
      while (r.progress >= 1) {
        r.progress -= 1;
        r.x = r.tx;
        r.y = r.ty;
        r.edgesLeft--;
        if (r.edgesLeft <= 0) {
          break;
        }
        // Choose the next edge: never straight back, otherwise
        // random between the two remaining directions.
        const options = directionsFor(r.typeY, hexSize).filter(
          ([dx, dy]) => Math.hypot(dx + r.lastDirX, dy + r.lastDirY) > hexSize * 0.1
        );
        const pick = options[Math.floor(Math.random() * options.length)] ?? options[0];
        if (!pick) {
          r.edgesLeft = 0;
          break;
        }
        // Occasionally branch down the road not taken.
        if (
          options.length > 1 &&
          Math.random() < BRANCH_CHANCE &&
          this.runners.length + spawned.length + next.length < MAX_ACTIVE
        ) {
          const other = options.find((o) => o !== pick);
          if (other) {
            spawned.push({
              x: r.x,
              y: r.y,
              tx: r.x + other[0],
              ty: r.y + other[1],
              progress: 0,
              typeY: !r.typeY,
              lastDirX: other[0],
              lastDirY: other[1],
              edgesLeft: Math.max(1, r.edgesLeft - 1),
              headX: r.x,
              headY: r.y,
            });
          }
        }
        r.tx = r.x + pick[0];
        r.ty = r.y + pick[1];
        r.lastDirX = pick[0];
        r.lastDirY = pick[1];
        r.typeY = !r.typeY;
      }
      const alive = r.edgesLeft > 0;
      const p = alive ? r.progress : 1;
      r.headX = r.x + (r.tx - r.x) * Math.min(1, p);
      r.headY = r.y + (r.ty - r.y) * Math.min(1, p);
      segments.push({ ax: prevX, ay: prevY, bx: r.headX, by: r.headY });
      if (alive) {
        next.push(r);
      }
    }
    this.runners = [...next, ...spawned];
    return segments;
  }

  /** Drop every head (loop teardown). */
  clear(): void {
    this.runners = [];
  }
}
