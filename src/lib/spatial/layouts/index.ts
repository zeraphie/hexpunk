/**
 * Shared pack primitives for `<hp-grid>`'s packed layouts.
 *
 * The geometry of "where does a cluster fit" is split into two parts:
 *
 *   1. **This file** — pure helpers that don't care which scan
 *      strategy the caller is using: the `FillMask` type, the
 *      hex-neighbour gap check, the claim-set mutation, the
 *      `data-fill-cells` parser, and the mask-bbox helper.
 *
 *   2. **Strategy siblings** — `./spiral.ts` (spiral from origin)
 *      and `./rows.ts` (row-major with width cap). Each exports a
 *      single `find*Position(mask, claimed, …)` function that calls
 *      into the primitives below.
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
 * re-introduce loose triangular gaps.
 */

/**
 * A cluster's filled hexes, expressed as offsets from its placement
 * origin. Single-hex children are `[{q: 0, r: 0}]`; a honeycomb
 * cluster with N children is the first N entries of the cluster's
 * fill-order table.
 */
export type FillMask = ReadonlyArray<{ q: number; r: number }>;

/**
 * Result of placing an item.
 *
 * @property q - Axial column.
 * @property r - Axial row.
 */
export interface AxialPos {
  q: number;
  r: number;
}

/**
 * Outer scan bound — strategies walk `r` from `-PACK_RANGE` to
 * `+PACK_RANGE`, inner `q` constrained by strategy. 40 is enough for
 * any reasonable cluster count on hexpunk's targeted viewport sizes;
 * bumping it is cheap (O(n) per row) if a layout ever needs it.
 */
export const PACK_RANGE = 40;

/**
 * The 6 axial-distance-1 hex neighbours of `(0, 0)`. Pre-computed so
 * `isPositionClear`'s inner-loop hot path doesn't allocate.
 */
export const HEX_NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];

/**
 * Check if placing a cluster with the given mask at `(q, r)` leaves a
 * ≥1-hex gap from every already-claimed cell. The candidate's own
 * cells must be unclaimed, *and* every hex-neighbour of each candidate
 * cell must also be unclaimed — guarantees no two filled hexes from
 * different clusters share an edge.
 *
 * @param q - Candidate axial column.
 * @param r - Candidate axial row.
 * @param mask - The cluster's filled-cell offsets from `(q, r)`.
 * @param claimed - Set of `"q,r"` strings already occupied by placed
 *   clusters.
 * @returns `true` if the candidate position is legal.
 */
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

/**
 * Mark the cluster's *unpadded* cells as claimed. Padding lives in
 * `isPositionClear`, so two clusters can still share a 1-cell gap
 * without the claim set growing by 6× per cell.
 *
 * @param q - Cluster origin axial column.
 * @param r - Cluster origin axial row.
 * @param mask - The cluster's filled-cell offsets from `(q, r)`.
 * @param claimed - Set to mutate.
 */
export function markClaimed(q: number, r: number, mask: FillMask, claimed: Set<string>): void {
  for (const cell of mask) {
    claimed.add(`${q + cell.q},${r + cell.r}`);
  }
}

/**
 * Axial-coord bounding box of a fill mask. Used by the row-major
 * strategy to bound the q-window so the layout wraps to a new r row
 * when the current row fills.
 *
 * @param mask - Cell offsets.
 * @returns `{ qMin, qMax }` — the inclusive q range. Returns
 *   `{ qMin: 0, qMax: 0 }` for an empty mask.
 */
export function maskBounds(mask: FillMask): { qMin: number; qMax: number } {
  let qMin = Number.POSITIVE_INFINITY;
  let qMax = Number.NEGATIVE_INFINITY;
  for (const c of mask) {
    if (c.q < qMin) {
      qMin = c.q;
    }
    if (c.q > qMax) {
      qMax = c.q;
    }
  }
  if (!Number.isFinite(qMin)) {
    qMin = 0;
    qMax = 0;
  }
  return { qMin, qMax };
}

/**
 * Parse an `hp-cluster`-style `data-fill-cells` attribute (space-
 * separated `"q,r q,r ..."` pairs) into a `FillMask`. Returns a
 * single-hex mask `[{q: 0, r: 0}]` for missing / empty / unparseable
 * input.
 *
 * @param value - Raw attribute string, or `null` / `undefined`.
 * @returns Parsed mask, never empty.
 */
export function parseFillCells(value: string | null | undefined): FillMask {
  if (!value) {
    return [{ q: 0, r: 0 }];
  }
  const cells: Array<{ q: number; r: number }> = [];
  for (const token of value.split(/\s+/)) {
    if (token.length === 0) {
      continue;
    }
    const [qStr, rStr] = token.split(",");
    const q = Number.parseFloat(qStr ?? "");
    const r = Number.parseFloat(rStr ?? "");
    if (!Number.isFinite(q) || !Number.isFinite(r)) {
      continue;
    }
    cells.push({ q, r });
  }
  return cells.length === 0 ? [{ q: 0, r: 0 }] : cells;
}
