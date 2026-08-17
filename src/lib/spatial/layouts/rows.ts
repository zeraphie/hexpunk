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

import { SQRT3 } from "../lattice.js";
import { type AxialPos, type FillMask, PACK_RANGE, isPositionClear, maskBounds } from "./index.js";

/**
 * Row cap for a pixel budget, as the half-window `findRowsPosition`
 * expects. Reserves the odd-row stagger (half a column) up front so
 * a wrapped layout's shifted rows stay inside the budget too, then
 * converts "N columns fit" into the centred half-window whose wider
 * parity admits exactly N: `(N − 1) / 2`. Never narrower than the
 * single-column window, however small the box.
 */
export function halfColsForWidth(availablePx: number, hexSide: number): number {
  const colStep = SQRT3 * hexSide;
  if (!(colStep > 0) || !(availablePx > 0)) {
    return 0.5;
  }
  const columns = Math.max(1, Math.floor(availablePx / colStep - 0.5));
  return Math.max(0.5, (columns - 1) / 2);
}

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
 * @param halfColsAvailable - Half-width of the scan window in axial
 *   cells (post-`r/2` shift compensation). hp-layout derives it from
 *   its own width via `halfColsForWidth`; the canvas grid pins a
 *   world-shape constant.
 * @returns Origin coordinate for the cluster.
 */
export function findRowsPosition(
  mask: FillMask,
  claimed: ReadonlySet<string>,
  halfColsAvailable: number,
  gap = true
): AxialPos {
  const { qMin, qMax } = maskBounds(mask);
  for (let r = -PACK_RANGE; r <= PACK_RANGE; r++) {
    const xShift = r / 2;
    const qLo = Math.ceil(-halfColsAvailable - xShift - qMin);
    const qHi = Math.floor(halfColsAvailable - xShift - qMax);
    for (let q = qLo; q <= qHi; q++) {
      if (isPositionClear(q, r, mask, claimed, gap)) {
        return { q, r };
      }
    }
  }
  return { q: 0, r: 0 };
}
