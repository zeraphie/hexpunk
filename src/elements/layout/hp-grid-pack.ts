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
 * Convention: a child's *extent* is the axial bounding box of its
 * visually-filled hexes (`hp-cluster` reports this on `data-axial-*`
 * attributes after slotchange). Composite elements like a honeycomb
 * cluster have non-symmetric extents; a single hex is `{0,0,0,0}`.
 *
 * Spacing: every pair of placed children is guaranteed ≥1 empty axial
 * cell of separation along every direction. We implement this by
 * padding the *candidate's* extent by one cell on each side when
 * testing collision against already-claimed cells (the already-placed
 * children claim only their actual extent, no padding — padding on
 * the new arrival is sufficient because both sides of every pair
 * eventually get tested as the candidate). */

/** Axial-coord bounding box of a packable item. */
export interface AxialExtent {
  qMin: number;
  qMax: number;
  rMin: number;
  rMax: number;
}

/** Result of placing an item. */
export interface AxialPos {
  q: number;
  r: number;
}

/** Outer scan bound — algorithm walks `r` from `-PACK_RANGE` to
 * `+PACK_RANGE`, inner `q` constrained by viewport. 40 is enough for
 * any reasonable cluster count on hexpunk's targeted viewport sizes.
 * Bumping this is cheap (O(n) per row) if a layout ever needs it. */
export const PACK_RANGE = 40;

/** Returns true when the candidate's 1-cell-padded extent at `(q, r)`
 * doesn't intersect any already-claimed cell. */
export function isPositionClear(
  q: number,
  r: number,
  extent: AxialExtent,
  claimed: ReadonlySet<string>
): boolean {
  for (let dr = extent.rMin - 1; dr <= extent.rMax + 1; dr++) {
    for (let dq = extent.qMin - 1; dq <= extent.qMax + 1; dq++) {
      if (claimed.has(`${q + dq},${r + dr}`)) {
        return false;
      }
    }
  }
  return true;
}

/** Adds the candidate's *unpadded* extent at `(q, r)` to the claimed
 * set. Padding lives on `isPositionClear` so two adjacent extents
 * still leave one empty cell between them in the next placement. */
export function markClaimed(
  q: number,
  r: number,
  extent: AxialExtent,
  claimed: Set<string>
): void {
  for (let dr = extent.rMin; dr <= extent.rMax; dr++) {
    for (let dq = extent.qMin; dq <= extent.qMax; dq++) {
      claimed.add(`${q + dq},${r + dr}`);
    }
  }
}

/** Row-major scan (lowest r first, then lowest q) for the first
 * position whose 1-cell-padded extent doesn't collide. Pass the
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
  extent: AxialExtent,
  claimed: ReadonlySet<string>,
  halfColsAvailable: number
): AxialPos {
  for (let r = -PACK_RANGE; r <= PACK_RANGE; r++) {
    const xShift = r / 2;
    const qLo = Math.ceil(-halfColsAvailable - xShift - extent.qMin);
    const qHi = Math.floor(halfColsAvailable - xShift - extent.qMax);
    for (let q = qLo; q <= qHi; q++) {
      if (isPositionClear(q, r, extent, claimed)) {
        return { q, r };
      }
    }
  }
  return { q: 0, r: 0 };
}
