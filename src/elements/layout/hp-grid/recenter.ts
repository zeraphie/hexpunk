/**
 * Fit-to-content `recenter()` algorithm for `<hp-grid>`.
 *
 * Walks every `[q][r]` child's per-cell fill mask (`data-fill-cells`,
 * published by composite elements like `<hp-cluster>`), accumulates
 * the actual filled-hex pixel bbox, picks the zoom level that frames
 * the layout with at most one cell of padding around its outermost
 * hex, and pans so the bbox midpoint lands at the viewport centre.
 *
 * Per-cell measurement (vs the host bbox the old algorithm used) is
 * what allows the chosen zoom to stay close to native 1× — a
 * non-symmetric cluster's empty bbox corners no longer count as
 * occupied space.
 *
 * Triggered automatically after every FFD pack, and bound to the
 * `Recenter` control button so the user can snap back to "show
 * everything" after any pan/zoom interaction.
 */

import { HEX_HALF_HEIGHT_FACTOR, SINGLE_CELL_MASK, parseFillCellsForBbox } from "./axial.js";
import type { HpGridPanEventDetail } from "./types.js";
import { ZOOM_MIN } from "./zoom.js";

/**
 * Subset of `HpGrid` the recenter pass mutates. `zoom` is writable;
 * the layout-step resolver is read.
 */
export interface RecenterHost extends HTMLElement {
  zoom: number;
  computeStyleSteps(): { col: number; row: number };
}

/**
 * Fit every positioned child inside the host's viewport and centre
 * the content. Pure function (takes the host explicitly) so the
 * orchestration stays out of the index.
 *
 * @param host - The grid element to recenter.
 */
export function recenter(host: RecenterHost): void {
  const gridRect = host.getBoundingClientRect();
  const vw = gridRect.width;
  const vh = gridRect.height;
  if (vw === 0 || vh === 0) {
    return;
  }
  const steps = host.computeStyleSteps();
  // Walk each filled hex's centre across every child. minCx / maxCx /
  // minCy / maxCy track the cell-centre bbox; we add the cell extent
  // + padding afterwards so the maths stays in centre-space.
  let minCx = Number.POSITIVE_INFINITY;
  let maxCx = Number.NEGATIVE_INFINITY;
  let minCy = Number.POSITIVE_INFINITY;
  let maxCy = Number.NEGATIVE_INFINITY;
  let foundAny = false;
  for (const child of host.querySelectorAll<HTMLElement>("[q][r]")) {
    // Skip hidden children — they don't contribute to the visible
    // bbox, and including them would let stale positions of
    // filtered-out clusters drag the centre off the visible content.
    if (child.hasAttribute("hidden")) {
      continue;
    }
    const q = Number.parseFloat(child.getAttribute("q") ?? "");
    const r = Number.parseFloat(child.getAttribute("r") ?? "");
    if (Number.isNaN(q) || Number.isNaN(r)) {
      continue;
    }
    const fillCellsAttr = child.getAttribute("data-fill-cells");
    const cells = fillCellsAttr ? parseFillCellsForBbox(fillCellsAttr) : SINGLE_CELL_MASK;
    for (const cell of cells) {
      const cx = steps.col * (q + cell.q + (r + cell.r) / 2);
      const cy = steps.row * (r + cell.r);
      if (cx < minCx) {
        minCx = cx;
      }
      if (cx > maxCx) {
        maxCx = cx;
      }
      if (cy < minCy) {
        minCy = cy;
      }
      if (cy > maxCy) {
        maxCy = cy;
      }
      foundAny = true;
    }
  }
  if (!foundAny) {
    host.zoom = 1;
    host.style.removeProperty("--hp-zoom");
    host.style.removeProperty("--hp-pan-x");
    host.style.removeProperty("--hp-pan-y");
    host.removeAttribute("data-hp-panned");
    return;
  }
  // Pad by 1 col-step horizontally + 1 row-step vertically — at most
  // 1 cell of gap between the layout's outermost hex and the viewport
  // edge. The cell itself extends col_step/2 from its centre, so
  // total side-extent = centre-bbox/2 + col_step/2 (cell half) +
  // col_step (padding) = centre-bbox/2 + 1.5 col_step. Doubled for
  // both sides → centre-bbox + 3 col_step total. Same idea vertically
  // with row_step.
  const halfCellW = steps.col / 2;
  const halfCellH = steps.col * HEX_HALF_HEIGHT_FACTOR;
  const padX = steps.col;
  const padY = steps.row;
  const paddedW = Math.max(1, maxCx - minCx + 2 * halfCellW + 2 * padX);
  const paddedH = Math.max(1, maxCy - minCy + 2 * halfCellH + 2 * padY);
  const zoomFit = Math.min(vw / paddedW, vh / paddedH);
  // Never zoom IN past native — FFD packing's natural scale is
  // already correct, we only zoom OUT when content overflows.
  const z = Math.max(ZOOM_MIN, Math.min(1, zoomFit));
  host.zoom = z;
  if (z === 1) {
    host.style.removeProperty("--hp-zoom");
  } else {
    host.style.setProperty("--hp-zoom", String(z));
  }
  const contentCx = (minCx + maxCx) / 2;
  const contentCy = (minCy + maxCy) / 2;
  // Pan so the content's midpoint lands at viewport centre. The
  // transform applies zoom to (q, r) positions, then adds pan; to
  // move the content's pixel-centre `contentCx` (at the chosen zoom)
  // onto the viewport's 0, pan must be `-contentCx * z`.
  const panX = -contentCx * z;
  const panY = -contentCy * z;
  if (panX === 0 && panY === 0 && z === 1) {
    host.style.removeProperty("--hp-pan-x");
    host.style.removeProperty("--hp-pan-y");
    host.removeAttribute("data-hp-panned");
  } else {
    host.style.setProperty("--hp-pan-x", `${panX}px`);
    host.style.setProperty("--hp-pan-y", `${panY}px`);
    host.setAttribute("data-hp-panned", "");
  }
  host.dispatchEvent(
    new CustomEvent<HpGridPanEventDetail>("hp-grid-pan", {
      detail: { panX, panY },
      bubbles: true,
      composed: true,
    })
  );
}
