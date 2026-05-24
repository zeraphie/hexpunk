/** Masonry bin-pack helpers for hp-grid `layout="masonry"`.
 *
 * Extracted as pure functions so the algorithm is testable in isolation
 * from the Lit element / DOM. hp-grid composes these with its own
 * child-walking and attribute-writing.
 *
 * Coordinate system mirrors hp-grid: axial `(q, r)`. Pixel projection
 * is `x = col_step * (q + r/2)`, `y = row_step * r` — the `r/2`
 * horizontal shift on each row is what makes `findFirstFreePosition`
 * compensate the q-scan window when bounding by viewport width.
 *
 * **Per-cell occupancy (not bbox).** Each cluster reports its actual
 * filled hexes as a `FillMask` (list of `(q, r)` offsets from origin).
 * The algorithm claims only the cells the cluster occupies — empty
 * corners of a non-square cluster (e.g. a honeycomb cluster with
 * ring-2 hexes only filled on one side) remain available drop space
 * for neighbour clusters. This is the difference between bbox-based
 * masonry (loose, lots of triangular gaps) and per-cell masonry
 * (tight, clusters interpenetrate each other's holes).
 *
 * **Hex-adjacency for the gap check.** A "1-cell gap" between two
 * clusters means no two filled hexes can be hex-neighbours. The 6
 * axial-distance-1 neighbours of `(q, r)` are `(q±1, r)`, `(q, r±1)`,
 * `(q+1, r-1)`, `(q-1, r+1)` — NOT the rectangular 8-neighbour box.
 * Using hex-neighbours is what allows the tight interlocking the
 * design demands; rectangular padding would re-introduce the loose
 * triangular gaps. */

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

/** Axial-coord bounding box of a fill mask. Used by the scan to bound
 * the q-window so masonry wraps to a new row when the current row
 * fills. */
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

/** Row-major scan (lowest r first, then lowest q) for the first
 * position whose 1-hex-padded mask doesn't collide. Pass the
 * viewport's available *half*-column count — the inner q scan is
 * bounded so the layout wraps to a new r row when this row fills.
 *
 * The r/2 horizontal shift in the axial-to-pixel projection means
 * each r-step also nudges the row right by half a column. We shift
 * the q-scan window left by r/2 to keep placed items centred under
 * the viewport regardless of which r row they land on.
 *
 * Returns `{q: 0, r: 0}` as a defensive fallback when nothing fits
 * in `±PACK_RANGE`; real packs never hit it. */
export function findFirstFreePosition(
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
