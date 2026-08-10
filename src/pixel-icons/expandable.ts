// expandable.ts — Pixel-art square / down-chevron / up-chevron morph.
//
// The dotted-dropdown icon from the CodePen reference: at rest the
// nine pixels form the 3×3 dotted square; on hover five of them
// arrange into a chevron pointing down (this will expand) while the
// corners fly outward and fade to transparent; toggled they flip
// into a chevron pointing up (this will collapse). Registered as
// `<hp-pixel type="expandable">`; drive the toggled state via
// `aria-pressed` (interactive mode) or an enclosing control.
//
// Same nine logical pixels in every state so the browser smoothly
// interpolates each pixel's path via `transition: box-shadow`.
// Palette index 1 marks the parked corners — the bundled palette
// fades them out. See DESIGN.md § Icons › Pixel-icon authoring
// convention for the alignment + comment style.

import type { HpPixelPosition } from "../elements/images/hp-pixel.js";

/** Bundled palette: index 1 = parked/faded pixels. */
export const palette = ["currentColor", "transparent"];

// oxfmt-ignore
export const idle: HpPixelPosition[] = [
 [-2, -2, 0], // top-left corner
 [ 0, -2, 0], // top edge
 [ 2, -2, 0], // top-right corner
 [-2,  0, 0], // left edge
 [ 2,  0, 0], // right edge
 [-2,  2, 0], // bottom-left corner
 [ 0,  2, 0], // bottom edge
 [ 2,  2, 0], // bottom-right corner
 [ 0,  0, 0], // centre
];

// oxfmt-ignore
export const hover: HpPixelPosition[] = [
 [-3, -3, 1], // top-left → parked ↖ (fades out)
 [-2, -1, 0], // top edge → chevron wing left
 [ 3, -3, 1], // top-right → parked ↗ (fades out)
 [-1,  0, 0], // left edge → chevron inner left
 [ 1,  0, 0], // right edge → chevron inner right
 [-3,  3, 1], // bottom-left → parked ↙ (fades out)
 [ 0,  1, 0], // bottom edge → chevron tip (down)
 [ 3,  3, 1], // bottom-right→ parked ↘ (fades out)
 [ 2, -1, 0], // centre → chevron wing right
];

// oxfmt-ignore
export const active: HpPixelPosition[] = [
 [-3, -3, 1], // top-left → parked ↖ (fades out)
 [-2,  1, 0], // top edge → chevron wing left
 [ 3, -3, 1], // top-right → parked ↗ (fades out)
 [-1,  0, 0], // left edge → chevron inner left
 [ 1,  0, 0], // right edge → chevron inner right
 [-3,  3, 1], // bottom-left → parked ↙ (fades out)
 [ 0, -1, 0], // bottom edge → chevron tip (up)
 [ 3,  3, 1], // bottom-right→ parked ↘ (fades out)
 [ 2,  1, 0], // centre → chevron wing right
];

export const expandable = { idle, hover, active };
export default expandable;
