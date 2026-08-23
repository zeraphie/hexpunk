// hp-hex.ts — Base hex atom (SVG primitive).
//
// The canonical hex element. Every other hex-shaped atom in the
// system (hp-cell, hp-deco, hp-status) composes `<hp-hex>` inside its
// shadow template — so the hex rendering lives in exactly one place
// and changing it here updates every atom. hp-module-handle is the
// only atom that paints its own hex (filled clip-path with a fixed
// 36px bbox, no stencil).
//
// Renders an SVG with two concentric polygons. Both polygons are the
// same hex shape (`viewBox 0 0 100 115.47`); the inner one is scaled
// down via CSS `transform: scale(...)` driven by
// `--hp-hex-stroke / --hp-cell`. Because it's a uniform scale, the
// resulting stroke ring is exactly `hex-stroke` wide around the
// entire perimeter — no aspect-ratio drift, no flat-`inset` artefacts.
//
// **Customisation hooks** (all CSS custom properties, cascade
// through the shadow boundary):
//
// - `--hp-stroke-color` — outer hex fill. Default: `--hp-outline`.
// Set to `transparent` for a pure colour-fill swatch (palette).
// - `--hp-hex-fill` — inner hex fill. Default: `--hp-canvas`. Set
// to a token to flip the stencil into a solid swatch.
// - `--hp-cell` / `[size="sm|md|lg"]` — cell size. Forwards via the
// `size` attribute when composed inside another atom.
//
// **Hit area** is hex-shaped automatically — SVG `<polygon>` only
// catches pointer events on painted regions, and `pointer-events:
// none` on the host stops the rectangular bbox from intercepting
// clicks. Composite atoms inherit this for free.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";
import { INNER_POINTS, OUTER_POINTS, RING_INSET } from "../../lib/hex-geometry.js";

/**
 * SVG hex primitive. Every other hex-shaped atom composes this for
 * its stencil; size is the only public knob.
 *
 * @cssproperty --hp-stroke-color - Outer polygon fill (the "stroke")
 * @cssproperty --hp-hex-fill - Inner polygon fill (defaults to canvas)
 * @cssproperty --hp-cell - Cell width; usually set per size attribute
 * @cssproperty --hp-hex-pointer-events - pointer-events on the painted polygons
 * @status done
 */
@customElement("hp-hex")
export class HpHex extends LitElement {
  /** Cell size.
   *
   * - `xxs` (20px) — dense inline form controls
   * - `xs` (50px) — comfortable inline form controls
   * - `sm` (100px) — content-hex default
   * - `md` (180px) — flat-top content hex
   * - `lg` (320px) — large content hex
   */
  @property({ reflect: true })
  size: "xxs" | "xs" | "sm" | "md" | "lg" = "sm";

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
        width: var(--hp-cell);
        aspect-ratio: 1 / 1.1547;
        line-height: 0;
        /* Rectangular bbox doesn't intercept clicks — only the
 * painted SVG polygons (below) do, which gives free hex-
 * shaped hit area. Composite atoms inherit this behaviour. */
        pointer-events: none;
      }

      /* md is a flat-top hex (rotated 30° from sm / lg's pointy-top
 * orientation). Its width is the long axis (point-to-point);
 * bbox aspect flips to 1.1547:1 (wider than tall) compared
 * to the pointy-top 1:1.1547. Still placed at single axial
 * slots on hp-grid; the rotation gives md a distinct visual
 * identity against pointy-top siblings without making it
 * disproportionately large. */
      :host([size="md"]) {
        --hp-cell: var(--hp-hex-cell-md);
        aspect-ratio: 1.1547 / 1;
      }

      :host([size="lg"]) {
        --hp-cell: var(--hp-hex-cell-lg);
      }

      svg {
        display: block;
        width: 100%;
        height: 100%;
        overflow: visible;
      }

      .outer {
        fill: var(--hp-stroke-color);
        transition: fill var(--hp-duration-medium) var(--hp-ease-default);
        /* Propagated via custom property so composing elements
 * (hp-cell, hp-deco, hp-unfold-list children, etc.) can flip
 * the polygon hit-area off without touching internal CSS.
 * CSS pointer-events doesn't cascade, but custom properties
 * do — so override --hp-hex-pointer-events on the host and
 * every composed hp-hex follows. */
        pointer-events: var(--hp-hex-pointer-events, auto);
      }

      .inner {
        fill: var(--hp-hex-fill, var(--hp-canvas, var(--hp-background)));
        transition: fill var(--hp-duration-medium) var(--hp-ease-default);
        pointer-events: var(--hp-hex-pointer-events, auto);
      }

      @media (forced-colors: active) {
        .outer {
          fill: CanvasText;
        }
        .inner {
          fill: Canvas;
        }
      }
    `,
  ];

  /**
   * Half-width of the visible ring as a fraction of the cell —
   * re-exposed from the shared geometry tables (src/lib/
   * hex-geometry.ts, which also documents the per-size scale
   * factors). Published as `--hp-hex-inset` so a layout can overlap
   * neighbours by exactly the ring and merge two outlines into one
   * shared edge. Deliberately *not* `--hp-hex-stroke`: the ring
   * comes from a uniform polygon scale, and for sm that is 2.5px
   * where the stroke token says 2px — a half-pixel of daylight,
   * which reads as a doubled line.
   */
  static readonly RING_INSET = RING_INSET;

  override render() {
    const outer = this.size === "md" ? OUTER_POINTS.flat : OUTER_POINTS.pointy;
    return html`
      <svg viewBox=${outer.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <polygon class="outer" points=${outer.points}></polygon>
        <polygon class="inner" points=${INNER_POINTS[this.size]}></polygon>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-hex": HpHex;
  }
}
