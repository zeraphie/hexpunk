/** Masonry bin-pack helpers for hp-grid `layout="masonry"`.
 *
 * Extracted as pure functions so the algorithm is testable in isolation
 * from the Lit element / DOM. hp-grid composes these with its own
 * child-walking and attribute-writing.
 *
 * **Strategy: largest-first + spiral from origin.** Children are
 * sorted by mask size (descending — done by the caller in hp-grid.ts)
 * before packing. Each cluster is then placed at the first free
 * position picked from a scan ordered by axial distance from
 * `(0, 0)`: ring 0 (the origin itself), then the 6 ring-1 positions,
 * then ring 2's 12 positions, and so on outward. The result: the
 * largest cluster anchors the centre, smaller ones nest around it
 * in a tight, roughly-square honeycomb.
 *
 * **Per-cell occupancy (not bbox).** Each cluster reports its actual
 * filled hexes as a `FillMask` (list of `(q, r)` offsets from origin).
 * The algorithm claims only the cells the cluster occupies — empty
 * corners of a non-symmetric cluster remain available drop space for
 * neighbour clusters.
 *
 * **Hex-adjacency for the gap check.** A "1-cell gap" between two
 * clusters means no two filled hexes can be hex-neighbours. The 6
 * axial-distance-1 neighbours of `(q, r)` are `(q±1, r)`, `(q, r±1)`,
 * `(q+1, r-1)`, `(q-1, r+1)` — not the rectangular 8-neighbour box.
 * Hex-neighbours allow tight interlocking; rectangular padding would
 * re-introduce loose triangular gaps. */

/** A cluster's filled hexes, expressed as offsets from its placement
 * origin. Single-hex children are `[{q: 0, r: 0}]`; a honeycomb cluster
 * with N children is the first N entries of the cluster's fill-order
 * table. */
export type FillMask = ReadonlyArray<{ q: number; r: number }>;

/** Result of placing an item. */
export interface AxialPos {
  q: number;
  r: number;
}

/** Outer scan bound — algorithm walks `r` from `-PACK_RANGE` to
 * `+PACK_RANGE`, inner `q` constrained by viewport. 40 is enough for
 * any reasonable cluster count on hexpunk's targeted viewport sizes;
 * bumping it is cheap (O(n) per row) if a layout ever needs it. */
export const PACK_RANGE = 40;

/** The 6 axial-distance-1 hex neighbours of `(0, 0)`. Pre-computed so
 * the inner-loop hot path doesn't allocate. */
const HEX_NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];

/** Returns true when placing a cluster with the given fill mask at
 * `(q, r)` leaves a ≥1-hex gap from every already-claimed cell. The
 * candidate's own cells must be unclaimed, AND every hex-neighbour of
 * each candidate cell must also be unclaimed. This guarantees no two
 * filled hexes from different clusters share an edge. */
export function isPositionClear(
  q: number,
  r: number,
  mask: FillMask,
  claimed: ReadonlySet<string>
): boolean {
  for (const cell of mask) {
    const cq = q + cell.q;
    const cr = r + cell.r;
    if (claimed.has(`${cq},${cr}`)) {
      return false;
    }
    for (const [dq, dr] of HEX_NEIGHBOURS) {
      if (claimed.has(`${cq + dq},${cr + dr}`)) {
        return false;
      }
    }
  }
  return true;
}

/** Marks the cluster's *unpadded* cells as claimed. Padding lives on
 * `isPositionClear` so two clusters can still share a 1-cell gap
 * without the claim set growing by 6× per cell. */
export function markClaimed(
  q: number,
  r: number,
  mask: FillMask,
  claimed: Set<string>
): void {
  for (const cell of mask) {
    claimed.add(`${q + cell.q},${r + cell.r}`);
  }
}

/** Hex axial distance from `(0, 0)` — `(|q| + |q+r| + |r|) / 2`.
 * Used to scan positions outward from the origin in honeycomb rings. */
function hexDistanceFromOrigin(q: number, r: number): number {
  return (Math.abs(q) + Math.abs(q + r) + Math.abs(r)) / 2;
}

/** Memoised spiral-from-origin scan order. The first call materialises
 * every `(q, r)` in `[-PACK_RANGE, PACK_RANGE]²` sorted by axial
 * distance from the origin (ring 0, then ring 1's 6 positions, then
 * ring 2's 12, …); ties broken deterministically by `(r, q)`. The
 * result is reused on every subsequent pack — cheap O(n) lookup
 * regardless of cluster count. */
let SPIRAL_POSITIONS: ReadonlyArray<AxialPos> | null = null;
function getSpiralPositions(): ReadonlyArray<AxialPos> {
  if (SPIRAL_POSITIONS) {
    return SPIRAL_POSITIONS;
  }
  const positions: Array<AxialPos & { dist: number }> = [];
  for (let r = -PACK_RANGE; r <= PACK_RANGE; r++) {
    for (let q = -PACK_RANGE; q <= PACK_RANGE; q++) {
      positions.push({ q, r, dist: hexDistanceFromOrigin(q, r) });
    }
  }
  positions.sort((a, b) => a.dist - b.dist || a.r - b.r || a.q - b.q);
  SPIRAL_POSITIONS = positions.map(({ q, r }) => ({ q, r }));
  return SPIRAL_POSITIONS;
}

/** Spiral-from-origin scan: the first position whose 1-hex-padded
 * mask doesn't collide, picked from positions sorted by axial
 * distance from `(0, 0)`. Each cluster lands as close to the centre
 * as possible — paired with a largest-first sort, the layout grows
 * outward like a honeycomb settling around the biggest cluster.
 *
 * Returns `{q: 0, r: 0}` as a defensive fallback when nothing fits
 * in `±PACK_RANGE`; real packs never hit it. */
export function findFirstFreePosition(
  mask: FillMask,
  claimed: ReadonlySet<string>
): AxialPos {
  const positions = getSpiralPositions();
  for (const { q, r } of positions) {
    if (isPositionClear(q, r, mask, claimed)) {
      return { q, r };
    }
  }
  return { q: 0, r: 0 };
}

/** Axial-coord bounding box of a fill mask. Used by the row-major
 * scan to bound the q-window so the layout wraps to a new r row
 * when the current row fills. */
function maskBounds(mask: FillMask): { qMin: number; qMax: number } {
  let qMin = Number.POSITIVE_INFINITY;
  let qMax = Number.NEGATIVE_INFINITY;
  for (const c of mask) {
    if (c.q < qMin) qMin = c.q;
    if (c.q > qMax) qMax = c.q;
  }
  if (!Number.isFinite(qMin)) {
    qMin = 0;
    qMax = 0;
  }
  return { qMin, qMax };
}

/** Row-major scan for the first free position, bounded by
 * `halfColsAvailable` (in axial cells, post-`r/2` shift compensation).
 * Walks r from `-PACK_RANGE` upward and q left-to-right within each
 * row's window — the layout grows as left-to-right rows that wrap
 * downward. Paired with FFD largest-first sort, this produces a
 * roughly-rectangular wide layout instead of the spiral's square
 * blob. Used by `<hp-grid layout="masonry-wide">`.
 *
 * The r/2 horizontal shift in the axial-to-pixel projection means
 * each r-step also nudges the row right by half a column. We shift
 * the q-scan window left by r/2 to keep placed items centred under
 * the viewport regardless of which r row they land on.
 *
 * Returns `{q: 0, r: 0}` as a defensive fallback when nothing fits;
 * real packs never hit it. */
export function findFirstFreePositionRowMajor(
  mask: FillMask,
  claimed: ReadonlySet<string>,
  halfColsAvailable: number
): AxialPos {
  const { qMin, qMax } = maskBounds(mask);
  for (let r = -PACK_RANGE; r <= PACK_RANGE; r++) {
    const xShift = r / 2;
    const qLo = Math.ceil(-halfColsAvailable - xShift - qMin);
    const qHi = Math.floor(halfColsAvailable - xShift - qMax);
    for (let q = qLo; q <= qHi; q++) {
      if (isPositionClear(q, r, mask, claimed)) {
        return { q, r };
      }
    }
  }
  return { q: 0, r: 0 };
}

/** Parses an `hp-cluster`-style `data-fill-cells` attribute (space-
 * separated `"q,r q,r ..."` pairs) into a `FillMask`. Returns a
 * single-hex mask `[{q: 0, r: 0}]` for missing / empty input. */
export function parseFillCells(value: string | null | undefined): FillMask {
  if (!value) {
    return [{ q: 0, r: 0 }];
  }
  const cells: Array<{ q: number; r: number }> = [];
  for (const token of value.split(/\s+/)) {
    if (token.length === 0) continue;
    const [qStr, rStr] = token.split(",");
    const q = Number.parseFloat(qStr ?? "");
    const r = Number.parseFloat(rStr ?? "");
    if (!Number.isFinite(q) || !Number.isFinite(r)) continue;
    cells.push({ q, r });
  }
  return cells.length === 0 ? [{ q: 0, r: 0 }] : cells;
}
