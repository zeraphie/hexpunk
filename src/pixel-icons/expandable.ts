// expandable.ts — Pixel-art plus / cross morph.
//
// Two-glyph morph of nine pixels for expand/collapse triggers: a
// plus at rest (something can open); pressed / expanded the arms
// rotate 45° into a cross (activating closes it). `hover` repeats
// the plus so the standard state chain stays intact — the glyph
// only ever shows + or ×. Registered as
// `<hp-pixel type="expandable">`.
//
// Same nine logical pixels in every state so the browser smoothly
// interpolates each pixel's path via `transition: box-shadow`. See
// DESIGN.md § Icons › Pixel-icon authoring convention for the
// alignment + comment style.

import type { HpPixelPosition } from "../elements/images/hp-pixel.js";

// oxfmt-ignore
export const idle: HpPixelPosition[] = [
 [ 0, -2], // arm top-far
 [ 0, -1], // arm top-near
 [ 2,  0], // arm right-far
 [ 1,  0], // arm right-near
 [ 0,  0], // centre
 [-1,  0], // arm left-near
 [-2,  0], // arm left-far
 [ 0,  1], // arm bottom-near
 [ 0,  2], // arm bottom-far
];

// oxfmt-ignore
export const hover: HpPixelPosition[] = [
 [ 0, -2], // arm top-far (unchanged — hover keeps the plus)
 [ 0, -1], // arm top-near
 [ 2,  0], // arm right-far
 [ 1,  0], // arm right-near
 [ 0,  0], // centre
 [-1,  0], // arm left-near
 [-2,  0], // arm left-far
 [ 0,  1], // arm bottom-near
 [ 0,  2], // arm bottom-far
];

// oxfmt-ignore
export const active: HpPixelPosition[] = [
 [-2, -2], // top-far → diag ↖ far
 [-1, -1], // top-near → diag ↖ near
 [ 2, -2], // right-far → diag ↗ far
 [ 1, -1], // right-near → diag ↗ near
 [ 0,  0], // centre
 [-1,  1], // left-near → diag ↙ near
 [-2,  2], // left-far → diag ↙ far
 [ 1,  1], // bottom-near → diag ↘ near
 [ 2,  2], // bottom-far → diag ↘ far
];

export const expandable = { idle, hover, active };
export default expandable;
