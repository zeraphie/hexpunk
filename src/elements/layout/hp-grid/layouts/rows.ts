/**
 * Row-major + width-cap pack strategy — `<hp-grid layout="rows">`.
 *
 * Walks `r` from `-PACK_RANGE` upward; within each row, q
 * left-to-right inside a viewport-pixel-mapped window. The window is
 * shifted left by `r/2` per row to compensate the axial-to-pixel
 * x-projection (each r-step nudges the row right by half a column),
 * keeping the layout visually centred under the viewport regardless
 * of which r row a cluster lands on.
 *
 * Paired with FFD largest-first sort, this produces a
 * roughly-rectangular wide layout — ideal for full-page-width
 * surfaces where the `spiral` strategy's square shape would leave
 * too much horizontal space unused.
 */

import {
  type AxialPos,
  type FillMask,
  PACK_RANGE,
  isPositionClear,
  maskBounds,
} from "./index.js";

/**
 * Find the first position whose 1-hex-padded mask doesn't collide,
 * scanning row-major (lowest r first, then lowest q) inside the
 * viewport-aware q-window.
 *
 * Returns `{q: 0, r: 0}` as a defensive fallback when nothing fits;
 * real packs never hit it.
 *
 * @param mask - Cluster's filled-cell offsets.
 * @param claimed - Cells already taken by previously placed clusters.
 * @param halfColsAvailable - Half-width of the viewport in axial
 *   cells (post-`r/2` shift compensation). Pinned by
 *   `HpGrid.WIDE_HALF_COLS` in the `rows` layout flow.
 * @returns Origin coordinate for the cluster.
 */
export function findRowsPosition(
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
