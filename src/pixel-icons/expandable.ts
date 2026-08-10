// expandable.ts — Pixel-art square / plus / cross morph.
//
// Three-state morph of nine pixels for expand/collapse triggers: at
// rest they pack into a solid 3×3 square block; on hover they fan
// out into a plus (something can open); pressed / expanded they
// rotate into a cross (activating closes it). Registered as
// `<hp-pixel type="expandable">`.
//
// Same nine logical pixels in every state so the browser smoothly
// interpolates each pixel's path via `transition: box-shadow`. See
// DESIGN.md § Icons › Pixel-icon authoring convention for the
// alignment + comment style.

import type { HpPixelPosition } from "../elements/images/hp-pixel.js";

// oxfmt-ignore
export const idle: HpPixelPosition[] = [
 [-1, -1], // top-left
 [ 0, -1], // top
 [ 1, -1], // top-right
 [-1,  0], // left
 [ 0,  0], // centre
 [ 1,  0], // right
 [-1,  1], // bottom-left
 [ 0,  1], // bottom
 [ 1,  1], // bottom-right
];

// oxfmt-ignore
export const hover: HpPixelPosition[] = [
 [ 0, -2], // top-left → arm top-far
 [ 0, -1], // top → arm top-near
 [ 2,  0], // top-right → arm right-far
 [-1,  0], // left → arm left-near
 [ 0,  0], // centre
 [ 1,  0], // right → arm right-near
 [-2,  0], // bottom-left → arm left-far
 [ 0,  1], // bottom → arm bottom-near
 [ 0,  2], // bottom-right→ arm bottom-far
];

// oxfmt-ignore
export const active: HpPixelPosition[] = [
 [-2, -2], // top-left → diag ↖ far
 [-1, -1], // top → diag ↖ near
 [ 2, -2], // top-right → diag ↗ far
 [ 1, -1], // left → diag ↗ near
 [ 0,  0], // centre
 [ 1,  1], // right → diag ↘ near
 [-2,  2], // bottom-left → diag ↙ far
 [-1,  1], // bottom → diag ↙ near
 [ 2,  2], // bottom-right→ diag ↘ far
];

export const expandable = { idle, hover, active };
export default expandable;
