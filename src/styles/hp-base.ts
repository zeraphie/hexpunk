// hp-base.ts — Lit-friendly wrapper around hp-base.css.
//
// Exports the shared adopted stylesheet as a Lit `css` literal so every
// <hp-*> element can include it via `static styles`. The CSS file at
// hp-base.css remains the source of truth for non-Lit consumers and is
// mirrored verbatim here. Keep them in sync — a build-time generator
// will likely replace this duplication once Bun's CSS-import story is
// settled across consumer environments.

import { css } from "lit";

export const hpBase = css`
  :host {
    display: block;
    box-sizing: border-box;
    /* Kill inline-block baseline descender. Atoms that use
 * display: inline-block on :host (most of them) would otherwise
 * pick up ~5px of descender space below the hex content, so
 * their host bbox is taller than the visible hex. That's
 * invisible in clusters where every child is the same atom
 * type (they're all offset by the same amount), but the
 * moment two different atoms share a cluster — e.g., hp-cell
 * anchor centre + hp-hex swatch in palette — their visible hexes sit
 * a couple px apart. Forcing line-height: 0 makes host bbox
 * equal hex bbox everywhere. */
    line-height: 0;

    --hp-hex-clip: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
    --hp-cell: var(--hp-hex-cell-sm);
    /* Stroke width scales with hex size — a 6px stroke that looks
 * right on lg (160px) reads as a chunky 7.5% of the cell on sm
 * (80px). 2 / 4 / 6 px keeps the visual weight roughly
 * proportional. hp-cluster reads --hp-hex-stroke to compute
 * col_step so adjacent atoms share strokes cleanly — moving
 * the value with size keeps that math right across sizes. */
    --hp-hex-stroke: 2px;
    --hp-stroke-color: var(--hp-outline);
    --hp-stroke-hover: var(--hp-secondary);
    /* --hp-canvas is intentionally NOT set here so a containing
 * surface (e.g. hp-demo preview, hp-grid, an alt-toned panel)
 * can communicate its surface tone down through the cascade.
 * Each consumer uses var(--hp-canvas, var(--hp-background)) to
 * fall back to the page background when no ancestor set it. */
  }

  /* xxs / xs are the inline-form-input tiers — keep hp-checkbox /
 * hp-radio / hp-toggle at standard form-control proportions
 * instead of the 100px sm default that's right for content hexes
 * but huge for inline controls.
 *
 * xs (32px) is the comfortable / touch-friendly form size.
 * xxs (20px) is the dense / tabular form size, closer to a
 * browser-default checkbox. Stroke widths step down so the
 * wireframe stays balanced against the cell. */
  :host([size="xxs"]) {
    --hp-hex-stroke: 1px;
    --hp-cell: var(--hp-hex-cell-xxs);
  }

  :host([size="xs"]) {
    --hp-hex-stroke: 1.5px;
    --hp-cell: var(--hp-hex-cell-xs);
  }

  :host([size="md"]) {
    --hp-hex-stroke: 4px;
    /* Flat-top clip-path for md, paired with hp-hex's aspect-ratio
 * flip. Composing atoms (hp-cell / hp-deco / hp-status) read
 * --hp-hex-clip for their host's clip-path, so this single line
 * keeps every md atom rotated consistently without each one
 * needing per-size overrides. */
    --hp-hex-clip: polygon(100% 50%, 75% 100%, 25% 100%, 0% 50%, 25% 0%, 75% 0%);
  }

  :host([size="lg"]) {
    --hp-hex-stroke: 6px;
  }

  :host([hidden]) {
    display: none;
  }

  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }

  /* Engaged-state lift on :host so the whole atom rises above siblings
 * without raising the inner stencil above the label inside the same
 * stacking context. */
  :host(:hover),
  :host(:focus-visible),
  :host([aria-pressed="true"]) {
    z-index: var(--hp-layer-hover);
  }

  /* Drag-to-tether drop target highlight. hp-grid in tetherable mode
 * stamps data-hp-tether-target on the [q][r] sibling the dragged
 * hex is currently overlapping, so the user can see which hex
 * the tether will connect to on release. Stroke flips to secondary
 * (the system's engaged hue) and the atom lifts above its
 * neighbours. The attribute is cleared the moment the cursor
 * leaves that hex or the drag ends. */
  :host([data-hp-tether-target]) {
    --hp-stroke-color: var(--hp-secondary);
    z-index: var(--hp-layer-hover);
  }

  :host(:focus-visible),
  :focus-visible {
    outline: 2px solid var(--hp-focus-ring);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 1ms !important;
      transition-duration: 1ms !important;
      animation-iteration-count: 1 !important;
    }
  }

  @media (forced-colors: active) {
    :host(:focus-visible),
    :focus-visible {
      outline-color: CanvasText;
    }
  }
`;
