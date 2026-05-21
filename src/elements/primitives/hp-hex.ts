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

/**
 * SVG hex primitive. Every other hex-shaped atom composes this for
 * its stencil; size is the only public knob.
 *
 * @cssproperty --hp-stroke-color - Outer polygon fill (the "stroke")
 * @cssproperty --hp-hex-fill - Inner polygon fill (defaults to canvas)
 * @cssproperty --hp-cell - Cell width; usually set per size attribute
 * @cssproperty --hp-hex-pointer-events - pointer-events on the painted polygons
 */
@customElement("hp-hex")
export class HpHex extends LitElement {
  /** Cell size.
   *
   * - `xxs` (20px) — dense inline form controls
   * - `xs` (32px) — comfortable inline form controls
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

  /** Inner-polygon points per size — uniform scale of the outer hex
   * around its centre. Pre-computed because CSS transform: scale()
   * on SVG polygons doesn't apply reliably across engines, and
   * display:none on per-size variants didn't hide them as expected
   * either. Rendering exactly one polygon avoids both pitfalls.
   *
   * Stroke widths are 2 / 4 / 6 px for sm / md / lg so the visual
   * weight scales with the cell instead of staying a flat 6 px.
   * Scale factors land on sm 0.95, md 0.923, lg 0.925.
   *
   * sm and lg use the pointy-top geometry (viewBox 100 × 115.47;
   * apothem 50 in viewBox units). md is the flat-top variant
   * (viewBox 100 × 86.6; apothem 43.3) — its scale factor differs
   * from the pointy-top sizes because the same 4 px stroke is a
   * larger fraction of the smaller flat-top apothem. */
  /** Inner-polygon points per size — uniform scale of the outer hex
   * around its centre (pointy-top: centre 50,57.735; flat-top: 50,43.3).
   * Each entry was computed as `outer * scale + (1 - scale) * centre`
   * to keep the stroke ring proportional to the cell. Scale factors:
   *
   * xxs (cell 20px, stroke 1px display ≈ 5 viewBox units) → 0.90
   * xs (cell 32px, stroke 1.5px ≈ 4.6875 viewBox units) → 0.906
   * sm (cell 100px, stroke 2px) → 0.95
   * md (cell 180px flat-top, stroke 4px scaled) → 0.923
   * lg (cell 320px, stroke 6px scaled) → 0.925
   *
   * Without per-size points the polygon renders empty (no points
   * attribute), the outer paints the entire hex, and the cell reads
   * as fully filled — which is exactly the bug that surfaced for
   * xs / xxs after the inline-form-input tier was added. */
  private static readonly INNER_POINTS: Record<"xxs" | "xs" | "sm" | "md" | "lg", string> = {
    xxs: "50,5.77 95,31.76 95,83.71 50,109.7 5,83.71 5,31.76",
    xs: "50,5.43 95.3,31.58 95.3,83.89 50,110.04 4.7,83.89 4.7,31.58",
    sm: "50,2.89 97.5,30.31 97.5,85.16 50,112.58 2.5,85.16 2.5,30.31",
    md: "96.15,43.3 73.08,83.27 26.92,83.27 3.85,43.3 26.92,3.33 73.08,3.33",
    lg: "50,4.33 96.25,31.04 96.25,84.43 50,111.14 3.75,84.43 3.75,31.04",
  };

  /** Outer-polygon points + viewBox per orientation. Keyed by
   * whether the hex renders pointy-top (sm / lg) or flat-top (md). */
  private static readonly OUTER_POINTS = {
    pointy: {
      viewBox: "0 0 100 115.47",
      points: "50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87",
    },
    flat: {
      viewBox: "0 0 100 86.6",
      points: "100,43.3 75,86.6 25,86.6 0,43.3 25,0 75,0",
    },
  } as const;

  override render() {
    const outer = this.size === "md" ? HpHex.OUTER_POINTS.flat : HpHex.OUTER_POINTS.pointy;
    return html`
      <svg viewBox=${outer.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <polygon class="outer" points=${outer.points}></polygon>
        <polygon class="inner" points=${HpHex.INNER_POINTS[this.size]}></polygon>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-hex": HpHex;
  }
}
