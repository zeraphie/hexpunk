// menu.ts — Pixel-art menu / cross / dropdown morph.
//
// Three-state morph of nine pixels: at rest they form a 3×3 grid (the
// classic "menu" / "more" mark); on hover they fan out into a plus
// cross; the pressed state collapses them into a tight diagonal cluster.
//
// Pulled directly from the CodePen reference Izzy supplied — each state
// has the same nine logical pixels, repositioned so the browser can
// smoothly interpolate every pixel's path via `transition: box-shadow`.
// See DESIGN.md § Icons › Pixel-icon authoring convention for the
// alignment + comment style.

import type { HpPixelPosition } from "../elements/images/hp-pixel.js";

// oxfmt-ignore
export const idle: HpPixelPosition[] = [
 [-2, -2], // top-left
 [ 0, -2], // top
 [ 2, -2], // top-right
 [-2, 0], // left
 [ 0, 0], // centre
 [ 2, 0], // right
 [-2, 2], // bottom-left
 [ 0, 2], // bottom
 [ 2, 2], // bottom-right
];

// oxfmt-ignore
export const hover: HpPixelPosition[] = [
 [ 0, -3 ], // top-left → top
 [ 0, -1.5], // top → top-near
 [ 3, 0 ], // top-right → right-far
 [-1.5, 0 ], // left → left-near
 [ 0, 0 ], // centre → centre
 [ 1.5, 0 ], // right → right-near
 [-3, 0 ], // bottom-left → left-far
 [ 0, 1.5], // bottom → bottom-near
 [ 0, 3 ], // bottom-right→ bottom
];

// oxfmt-ignore
export const active: HpPixelPosition[] = [
 [-2, -2], // top-left
 [ 1, -1], // top → upper-right-inner
 [ 2, -2], // top-right
 [-1, -1], // left → upper-left-inner
 [ 0, 0], // centre
 [ 1, 1], // right → lower-right-inner
 [-2, 2], // bottom-left
 [-1, 1], // bottom → lower-left-inner
 [ 2, 2], // bottom-right
];

export const menu = { idle, hover, active };
export default menu;
