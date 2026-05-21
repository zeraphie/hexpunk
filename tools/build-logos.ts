// build-logos.ts — Generate the brand SVGs in assets/.
//
// Produces logo-mark.svg (the bare triple-hex), logo-lockup.svg
// (mark + HEXPUNK wordmark on one row), and logo-stacked.svg (mark
// above wordmark). The wordmark is rendered as <path> glyphs traced
// from `assets/fonts/iceland-400.woff2` via fontkit — that way the
// SVGs render pixel-identical everywhere (GitHub <img> sandboxes,
// browsers without Iceland installed, design tools) without needing
// to embed the font file. Re-run after editing the font or the
// triple-hex geometry.
//
// Run: `bun run logos`.

import { mkdir, readFile, writeFile } from "node:fs/promises";

import * as fontkit from "fontkit";

await mkdir("assets", { recursive: true });

const fontBytes = await readFile("assets/fonts/iceland-400.woff2");
const font = fontkit.create(fontBytes);

/** Render `text` through the font, position the glyph run so that
 * (originX, originY) is the visual baseline-start at the requested
 * visual size, and return the concatenated SVG path d-attribute.
 * `letterSpacingPx` is added between each consecutive pair of glyphs
 * in SVG user units (i.e., the same scale as fontSize). */
function textToPath(
  text: string,
  fontSize: number,
  originX: number,
  originY: number,
  letterSpacingPx = 0
): string {
  const run = font.layout(text);
  const scale = fontSize / font.unitsPerEm;
  const spacingFontUnits = letterSpacingPx / scale;
  let cursor = 0;
  const subpaths: string[] = [];
  run.glyphs.forEach((glyph, i) => {
    const advance = run.positions[i]?.xAdvance ?? glyph.advanceWidth;
    // Affine: (x, y) -> (scale*x + tx, -scale*y + ty). The y flip
    // matches SVG's y-down convention against font-space y-up.
    const tx = originX + cursor * scale;
    const ty = originY;
    const baked = glyph.path.transform(scale, 0, 0, -scale, tx, ty);
    subpaths.push(baked.toSVG());
    cursor += advance + spacingFontUnits;
  });
  return subpaths.join(" ");
}

function measureRun(text: string, fontSize: number, letterSpacingPx: number): number {
  const run = font.layout(text);
  const scale = fontSize / font.unitsPerEm;
  const spacingFontUnits = letterSpacingPx / scale;
  let cursor = 0;
  run.glyphs.forEach((glyph, i) => {
    const advance = run.positions[i]?.xAdvance ?? glyph.advanceWidth;
    cursor += advance + (i === run.glyphs.length - 1 ? 0 : spacingFontUnits);
  });
  return cursor * scale;
}

const markPaths8 = `  <g fill="none" stroke="#0088CC" stroke-width="8" stroke-linejoin="round">
    <path d="M 64 4.36 L 94 21.68 L 94 56.32 L 64 73.64 L 34 56.32 L 34 21.68 Z" />
    <path d="M 34 56.32 L 64 73.64 L 64 108.28 L 34 125.6 L 4 108.28 L 4 73.64 Z" />
    <path d="M 94 56.32 L 124 73.64 L 124 108.28 L 94 125.6 L 64 108.28 L 64 73.64 Z" />
  </g>
`;

const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Hexpunk">
  <title>Hexpunk</title>
${markPaths8}</svg>
`;

// Lockup: triple-hex mark at the left, HEXPUNK wordmark to its right.
// Wordmark baseline sits at y=80 (≈62% down a 128-unit canvas — places
// uppercase Iceland visually centred against the mark). 4px letter-
// spacing matches the previous <text>-mode SVG.
const lockupWordmarkD = textToPath("HEXPUNK", 72, 160, 80, 4);
const lockup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 128" role="img" aria-label="Hexpunk">
  <title>Hexpunk</title>
${markPaths8}  <path fill="#0088CC" d="${lockupWordmarkD}" />
</svg>
`;

// Stacked: triple-hex at top, wordmark centred underneath. Wordmark
// baseline at y=196 (in a 220-unit canvas). 7 font-space units between
// letters for the tighter, more compact stacked layout.
const stackedMark = `  <g transform="translate(86, 8)" fill="none" stroke="#0088CC" stroke-width="6" stroke-linejoin="round">
    <path d="M 64 4.36 L 94 21.68 L 94 56.32 L 64 73.64 L 34 56.32 L 34 21.68 Z" />
    <path d="M 34 56.32 L 64 73.64 L 64 108.28 L 34 125.6 L 4 108.28 L 4 73.64 Z" />
    <path d="M 94 56.32 L 124 73.64 L 124 108.28 L 94 125.6 L 64 108.28 L 64 73.64 Z" />
  </g>
`;
// Pre-measure with the chosen spacing so the rendered run can be
// horizontally centred against the 300-unit canvas. Baseline at y=196.
const stackedFontSize = 48;
const stackedSpacingPx = 7;
const stackedWidth = measureRun("HEXPUNK", stackedFontSize, stackedSpacingPx);
const stackedX = 150 - stackedWidth / 2;
const stackedWordmarkD = textToPath("HEXPUNK", stackedFontSize, stackedX, 196, stackedSpacingPx);
const stacked = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 220" role="img" aria-label="Hexpunk">
  <title>Hexpunk</title>
${stackedMark}  <path fill="#0088CC" d="${stackedWordmarkD}" />
</svg>
`;

await writeFile("assets/logo-mark.svg", mark);
await writeFile("assets/logo-lockup.svg", lockup);
await writeFile("assets/logo-stacked.svg", stacked);

console.log(`mark: ${mark.length} lockup: ${lockup.length} stacked: ${stacked.length}`);
