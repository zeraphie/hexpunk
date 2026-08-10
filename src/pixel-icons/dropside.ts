// dropside.ts — Pixel-art square / right-chevron / left-chevron morph.
//
// The dotted-dropside icon from the CodePen reference — the
// horizontal sibling of `expandable`: at rest the nine pixels form
// the 3×3 dotted square; on hover five arrange into a chevron
// pointing right (a side panel will open) while the corners fly
// outward and fade; toggled they flip to point left (it will
// close). Registered as `<hp-pixel type="dropside">`; drive the
// toggled state via `aria-pressed` (interactive mode) or an
// enclosing control.
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
 [-1, -2, 0], // top edge → chevron wing top
 [ 3, -3, 1], // top-right → parked ↗ (fades out)
 [-1,  2, 0], // left edge → chevron wing bottom
 [ 0, -1, 0], // right edge → chevron inner top
 [-3,  3, 1], // bottom-left → parked ↙ (fades out)
 [ 0,  1, 0], // bottom edge → chevron inner bottom
 [ 3,  3, 1], // bottom-right→ parked ↘ (fades out)
 [ 1,  0, 0], // centre → chevron tip (right)
];

// oxfmt-ignore
export const active: HpPixelPosition[] = [
 [-3, -3, 1], // top-left → parked ↖ (fades out)
 [ 1, -2, 0], // top edge → chevron wing top
 [ 3, -3, 1], // top-right → parked ↗ (fades out)
 [ 1,  2, 0], // left edge → chevron wing bottom
 [ 0, -1, 0], // right edge → chevron inner top
 [-3,  3, 1], // bottom-left → parked ↙ (fades out)
 [ 0,  1, 0], // bottom edge → chevron inner bottom
 [ 3,  3, 1], // bottom-right→ parked ↘ (fades out)
 [-1,  0, 0], // centre → chevron tip (left)
];

export const dropside = { idle, hover, active };
export default dropside;
