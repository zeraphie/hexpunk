// Generate src/styles/hex-controls.css — the native hex form-control
// pattern (label + visually-hidden input + presentational hex span).
//
// The ring / fill masks are baked from the same polygon tables
// hp-hex renders (src/lib/hex-geometry.ts), so the CSS pattern and
// the SVG element cannot drift apart. hp-checkbox and friends are
// thin light-DOM aliases that emit exactly this markup; the pattern
// is also usable raw, with no JS at all:
//
//   <label class="hp-checkbox">
//     <input type="checkbox" name="…" />
//     <span class="hp-checkbox-hex" aria-hidden="true"></span>
//     Label text
//   </label>

import { $ } from "bun";

import { INNER_POINTS, OUTER_POINTS, type HexSize } from "../src/lib/hex-geometry.js";

const OUT_PATH = "src/styles/hex-controls.css";

/** "50,0 100,28.87 …" → "M50 0L100 28.87…Z" */
const toPath = (points: string): string =>
  `M${points
    .split(" ")
    .map((p) => p.replace(",", " "))
    .join("L")}Z`;

const svgMask = (body: string, viewBox: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}'>${body}</svg>`
  ).replaceAll("'", "%27")}")`;

const pointy = OUTER_POINTS.pointy;

/** Ring mask: outer hex minus the size's inner hex (evenodd). */
const ringMask = (size: HexSize): string =>
  svgMask(
    `<path fill-rule='evenodd' d='${toPath(pointy.points)} ${toPath(INNER_POINTS[size])}'/>`,
    pointy.viewBox
  );

/** Full-hex mask for the checked fill. */
const fullMask = svgMask(`<path d='${toPath(pointy.points)}'/>`, pointy.viewBox);

/** Check / dash glyphs — hp-checkbox's exact strokes (square caps,
 * miter joins, width 3 in a 24-unit box). */
const checkMask = svgMask(
  `<polyline points='5,12 10,17 19,7' fill='none' stroke='black' stroke-width='3' stroke-linecap='square' stroke-linejoin='miter'/>`,
  "0 0 24 24"
);
const dashMask = svgMask(
  `<line x1='6' y1='12' x2='18' y2='12' stroke='black' stroke-width='3' stroke-linecap='square'/>`,
  "0 0 24 24"
);

const css = `/* hex-controls.css — Generated from src/lib/hex-geometry.ts by
 * tools/build-hex-controls.ts. Do not edit.
 *
 * The native hex form-control pattern. Works with no JS:
 *
 *   <label class="hp-checkbox">
 *     <input type="checkbox" name="…" />
 *     <span class="hp-checkbox-hex" aria-hidden="true"></span>
 *     Label text
 *   </label>
 *
 * <hp-checkbox> renders this exact markup for you (and forwards the
 * native property surface). The hex outline is the same polygon set
 * hp-hex draws — the masks below are baked from those tables.
 * Requires the token stylesheets (tokens.*.css) for the variables. */

/* The alias host — inline like the native control it wraps. */
hp-checkbox {
  display: inline-block;
}

.hp-checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--hp-sm);
  cursor: pointer;
  position: relative;
}

/* The real control: visually hidden, still focusable + labelable. */
.hp-checkbox input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.hp-checkbox-hex {
  display: inline-block;
  width: var(--hp-hex-cell-xs);
  aspect-ratio: 100 / 115.47;
  position: relative;
  flex: none;
}

.hp-checkbox[data-size="xxs"] .hp-checkbox-hex {
  width: var(--hp-hex-cell-xxs);
}

/* Ring at rest; hover / keyboard focus swap to secondary — the same
 * state ladder as hp-hex's --hp-stroke-color. */
.hp-checkbox-hex::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--hp-outline);
  mask: ${ringMask("xs")} center / contain no-repeat;
  transition: background-color var(--hp-duration-fast) var(--hp-ease-default);
}

.hp-checkbox[data-size="xxs"] .hp-checkbox-hex::before {
  mask: ${ringMask("xxs")} center / contain no-repeat;
}

.hp-checkbox:hover input:not(:disabled) + .hp-checkbox-hex::before,
.hp-checkbox input:focus-visible + .hp-checkbox-hex::before {
  background: var(--hp-secondary);
}

.hp-checkbox input:checked + .hp-checkbox-hex::before,
.hp-checkbox input:indeterminate + .hp-checkbox-hex::before {
  background: var(--hp-primary);
  mask: ${fullMask} center / contain no-repeat;
}

/* Glyph: check when checked, dash when indeterminate. */
.hp-checkbox-hex::after {
  content: "";
  position: absolute;
  inset: 22%;
  background: var(--hp-on-primary);
  mask: ${checkMask} center / contain no-repeat;
  opacity: 0;
  transition: opacity var(--hp-duration-medium) var(--hp-ease-default);
}

.hp-checkbox input:checked + .hp-checkbox-hex::after {
  opacity: 1;
}

.hp-checkbox input:indeterminate + .hp-checkbox-hex::after {
  opacity: 1;
  mask: ${dashMask} center / contain no-repeat;
}

.hp-checkbox input:focus-visible + .hp-checkbox-hex {
  outline: 2px solid var(--hp-focus-ring);
  outline-offset: 2px;
}

.hp-checkbox:has(input:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Constraint validation: after the user has interacted, an invalid
 * control's ring reads as the error tone. */
.hp-checkbox input:user-invalid + .hp-checkbox-hex::before {
  background: var(--hp-error);
}

@media (prefers-reduced-motion: reduce) {
  .hp-checkbox-hex::before,
  .hp-checkbox-hex::after {
    transition: none;
  }
}

@media (forced-colors: active) {
  .hp-checkbox-hex::before {
    background: CanvasText;
  }

  .hp-checkbox input:checked + .hp-checkbox-hex::before,
  .hp-checkbox input:indeterminate + .hp-checkbox-hex::before {
    background: Highlight;
  }

  .hp-checkbox-hex::after {
    background: HighlightText;
  }
}
`;

await Bun.write(OUT_PATH, css);

// Normalise through the repo formatter so format:check stays green.
const fmt = await $`oxfmt ${OUT_PATH}`.quiet().nothrow();
if (fmt.exitCode !== 0) {
  console.error(`build-hex-controls: oxfmt failed on ${OUT_PATH}`);
  process.exit(1);
}

console.log(`build-hex-controls: wrote ${OUT_PATH}`);
