/*
  ─ DOM-overlay sync ─

  Rich-content cells live in an absolutely-positioned DOM layer
  above the canvas; the whole layer rides the camera through one
  transform write per frame, applied in the same rAF as the
  canvas render so the two surfaces can never swim apart.
*/
import type { CameraState, WorldRect } from "./types.js";

/**
 * Project the camera onto the overlay layer. Translation stays
 * unrounded — rounding shimmers 1px against the canvas during
 * slow pans; sub-pixel transforms composite cleanly.
 */
export function syncOverlay(layer: HTMLElement, camera: CameraState): void {
  layer.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})`;
}

/**
 * Position a cell element at its world rect. Cells lay out in
 * world units at scale 1; the layer transform does the rest.
 * Geometry data, not visual state — themes never touch it.
 */
export function placeCell(cell: HTMLElement, rect: WorldRect): void {
  cell.style.left = `${rect.cx - rect.w / 2}px`;
  cell.style.top = `${rect.cy - rect.h / 2}px`;
  cell.style.width = `${rect.w}px`;
  cell.style.height = `${rect.h}px`;
}

/** Overlay layers must declare their transform origin as the
 * world origin or the scale term walks the content. Called once
 * at engine init; kept separate so consumers building their own
 * layers can reuse it. */
export function prepareOverlayLayer(layer: HTMLElement): void {
  layer.style.transformOrigin = "0 0";
}
