// hp-cell.ts — Universal hex element.
//
// The single element that subsumes the old hp-cell (interactive
// anchor/action/secondary/utility) + hp-deco (decorative
// content/support/slot) + hp-status (toned positive/warn/alert/error
// with active fill) + hp-trace (focus-state edge trace). Distinguished
// by attributes:
//
// - `variant` picks the role: interactive
// (`anchor|action|secondary|utility`) or decorative
// (`content|support|slot`). Interactive variants get cursor-pointer,
// hue-swap on hover/focus/aria-pressed, and the rotating-trace focus
// indicator. Decorative variants suppress all of that; `support` and
// `slot` are auto-`aria-hidden` and unlabelled.
// - `tone` overlays semantic colour (positive/warn/alert/error) on top
// of any variant. `neutral` (default) keeps the variant's resting
// tokens. Pairs with `active`: tone-stroked at rest, tone-container
// filled when active.
// - `filled` is the action CTA paint — primary fill, on-primary label.
// - `size` is `sm` (default), `md` (flat-top rotation), `lg`.
//
// Hit area is hex-shaped: the host has `pointer-events: none` and
// hp-hex's painted polygons catch pointer events, so the bbox corners
// outside the hex never receive hover / click. The focus trace
// extends beyond the hex shape into the band just outside, which is
// why the host has no `clip-path` (would cut the trapezoids).
//
// hp-trace is folded in: every interactive cell renders the three
// trapezoidal edges, scaled to 0 by default. `:focus-visible` triggers
// the staggered grow-in; blur reverses it. The trace doesn't render
// for decorative variants (they're not focusable) or for `md` size
// (flat-top hex; trace geometry is pointy-top-only for now).

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "./hp-hex.js";
import { hpBase } from "../../styles/hp-base.js";

export type HpCellVariant =
  | "anchor"
  | "action"
  | "secondary"
  | "utility"
  | "content"
  | "support"
  | "slot";

export type HpCellTone = "neutral" | "positive" | "warn" | "alert" | "error";

const INTERACTIVE_VARIANTS = new Set<HpCellVariant>(["anchor", "action", "secondary", "utility"]);

const UNLABELLED_VARIANTS = new Set<HpCellVariant>(["support", "slot"]);

/**
 * Universal labelled hex. Subsumes anchor / action / secondary /
 * utility (interactive), content / support / slot (decorative), and
 * positive / warn / alert / error (tone overlay) into one element.
 *
 * @slot - Label content of the cell (text or inline icon)
 *
 * @cssproperty --hp-stroke-color - Outline colour of the hex polygon
 * @cssproperty --hp-cell-label-color - Label text colour
 * @cssproperty --hp-hex-fill - Inner fill (defaults to canvas, set for swatches)
 * @cssproperty --hp-cursor - Cursor override (e.g., grab inside hp-grid drags)
 * @cssproperty --hp-hex-pointer-events - Pointer-events on the inner polygons
 *
 * @csspart cell - The wrapping cell element (positioned ancestor for label / trace)
 * @csspart label - The label container (when the variant has a label)
 */
@customElement("hp-cell")
export class HpCell extends LitElement {
  /** Role + visual preset. Interactive variants
   * (`anchor|action|secondary|utility`) lift on hover, show the focus
   * trace, and accept keyboard input via the host's `tabindex`.
   * Decorative variants (`content|support|slot`) are static. */
  @property({ reflect: true })
  variant: HpCellVariant = "anchor";

  /** Cell size.
   *
   * - `xxs` (20px) — dense inline form-control hex
   * - `xs` (32px) — comfortable inline form-control hex
   * - `sm` (100px, default) — content-hex / general UI tile
   * - `md` (180px, flat-top) — large content tile
   * - `lg` (320px) — feature tile
   *
   * Variant-aware auto-defaults apply when `size` isn't set:
   * `content` → `md`, `support` → `lg`. Form-input components
   * (hp-checkbox, hp-radio) own their own xs/xxs defaults via
   * their own `size` attribute. */
  @property({ reflect: true })
  size: "xxs" | "xs" | "sm" | "md" | "lg" = "sm";

  /** Semantic tone overlay. `neutral` (default) leaves variant tokens
   * untouched; the others swap stroke / label to the matching
   * semantic colour pair. */
  @property({ reflect: true })
  tone: HpCellTone = "neutral";

  /** When set with a non-neutral tone, fills the hex with the
   * tone-container colour and flips the label to the on-container
   * contrast pair. The cell reads as "this state is in effect". */
  @property({ reflect: true, type: Boolean })
  active = false;

  /** High-emphasis filled CTA. Meaningful when `variant="action"` —
   * paints both polygons with `--hp-primary`, label flips to
   * `--hp-on-primary`. */
  @property({ reflect: true, type: Boolean })
  filled = false;

  override connectedCallback(): void {
    super.connectedCallback();

    // A tone implies "this is a status indicator", which is decorative
    // by default. Consumers wanting an interactive toned cell set
    // variant explicitly (e.g. `<hp-cell variant="action" tone="positive">`
    // for a "confirm" CTA).
    if (this.tone !== "neutral" && !this.hasAttribute("variant")) {
      this.variant = "content";
    }

    // Auto-size defaults for decorative variants if no size was given.
    if (!this.hasAttribute("size")) {
      if (this.variant === "content") {
        this.size = "md";
      } else if (this.variant === "support") {
        this.size = "lg";
      }
    }

    // support / slot are presentational framing — no a11y meaning.
    if (UNLABELLED_VARIANTS.has(this.variant) && !this.hasAttribute("aria-hidden")) {
      this.setAttribute("aria-hidden", "true");
    }
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
        /* Bbox doesn't intercept events — hp-hex's painted polygons
 * (pointer-events: auto via the .outer / .inner classes) catch
 * pointer events only on the hex shape. Without this, hovering
 * the bbox corners outside the hex would still fire :hover. */
        pointer-events: none;
        cursor: var(--hp-cursor, pointer);
        --hp-stroke-color: var(--hp-outline);
        --hp-cell-label-color: var(--hp-on-surface);
      }

      :host([size="md"]) {
        --hp-cell: var(--hp-hex-cell-md);
      }

      :host([size="lg"]) {
        --hp-cell: var(--hp-hex-cell-lg);
      }

      /* ── Interactive variants — resting tokens ────────────────── */

      :host([variant="anchor"]) {
        --hp-stroke-color: var(--hp-outline);
        --hp-cell-label-color: var(--hp-on-surface);
      }

      :host([variant="action"]) {
        --hp-stroke-color: var(--hp-primary);
        --hp-cell-label-color: var(--hp-primary);
      }

      :host([variant="secondary"]) {
        --hp-stroke-color: var(--hp-tertiary);
        --hp-cell-label-color: var(--hp-tertiary);
      }

      :host([variant="utility"]) {
        --hp-stroke-color: var(--hp-on-surface-variant);
        --hp-cell-label-color: var(--hp-on-surface-variant);
      }

      /* ── Decorative variants ─────────────────────────────────── */

      :host([variant="content"]) {
        --hp-stroke-color: var(--hp-outline);
        --hp-cell-label-color: var(--hp-on-surface);
        --hp-cell: var(--hp-hex-cell-md);
      }

      :host([variant="support"]) {
        --hp-stroke-color: var(--hp-outline-faint);
        --hp-cell: var(--hp-hex-cell-lg);
        opacity: 0.6;
      }

      :host([variant="slot"]) {
        --hp-stroke-color: var(--hp-outline-variant);
        --hp-canvas: transparent;
        opacity: 0.5;
      }

      /* Decorative variants override the cursor — they're not
 * interactive, so no pointer hint. The hp-hex polygons also
 * become non-catching so decorative cells don't intercept
 * drags / hovers / clicks meant for the grid behind them.
 * Per-cell draggable (any value other than "false") restores
 * polygon pointer-events so the cell can still receive
 * pointerdown for hp-grid's drag handler — useful for
 * moveable decorative tokens. */
      :host([variant="content"]),
      :host([variant="support"]),
      :host([variant="slot"]) {
        cursor: default;
        --hp-hex-pointer-events: none;
      }

      :host([variant="content"][draggable]:not([draggable="false"])),
      :host([variant="support"][draggable]:not([draggable="false"])),
      :host([variant="slot"][draggable]:not([draggable="false"])) {
        cursor: var(--hp-cursor, pointer);
        --hp-hex-pointer-events: auto;
      }

      /* Interactive variants forced static via draggable="false"
 * still get hover/focus behaviour — they just don't drag. The
 * cursor stays pointer because they're activatable. */

      /* Allow size attribute to override the variant default. */
      :host([variant="content"][size="sm"]) {
        --hp-cell: var(--hp-hex-cell-sm);
      }
      :host([variant="content"][size="lg"]) {
        --hp-cell: var(--hp-hex-cell-lg);
      }
      :host([variant="support"][size="sm"]) {
        --hp-cell: var(--hp-hex-cell-sm);
      }
      :host([variant="support"][size="md"]) {
        --hp-cell: var(--hp-hex-cell-md);
      }
      :host([variant="slot"][size="md"]) {
        --hp-cell: var(--hp-hex-cell-md);
      }
      :host([variant="slot"][size="lg"]) {
        --hp-cell: var(--hp-hex-cell-lg);
      }

      /* ── Engaged states (interactive variants only) ──────────── */

      :host([variant="anchor"]:hover),
      :host([variant="action"]:hover),
      :host([variant="secondary"]:hover),
      :host([variant="utility"]:hover),
      :host([variant="anchor"]:focus-visible),
      :host([variant="action"]:focus-visible),
      :host([variant="secondary"]:focus-visible),
      :host([variant="utility"]:focus-visible),
      :host([variant="anchor"][aria-pressed="true"]),
      :host([variant="action"][aria-pressed="true"]),
      :host([variant="secondary"][aria-pressed="true"]),
      :host([variant="utility"][aria-pressed="true"]) {
        --hp-stroke-color: var(--hp-secondary);
        --hp-cell-label-color: var(--hp-secondary);
      }

      /* Action diverges on focus-visible only — primary-bright so
 * keyboard focus reads distinctly from pointer hover. */
      :host([variant="action"]:focus-visible) {
        --hp-stroke-color: var(--hp-primary-bright);
        --hp-cell-label-color: var(--hp-primary-bright);
      }

      /* ── Filled action CTA ───────────────────────────────────── */

      :host([variant="action"][filled]) {
        --hp-stroke-color: var(--hp-primary);
        --hp-hex-fill: var(--hp-primary);
        --hp-cell-label-color: var(--hp-on-primary);
      }

      :host([variant="action"][filled]:hover) {
        --hp-stroke-color: var(--hp-primary-container);
        --hp-hex-fill: var(--hp-primary-container);
        --hp-cell-label-color: var(--hp-on-primary-container);
      }

      /* ── Tone overlay (any variant) ──────────────────────────── */

      :host([tone="positive"]) {
        --hp-tone-stroke: var(--hp-secondary);
        --hp-tone-fill: var(--hp-secondary-container);
        --hp-tone-on-fill: var(--hp-on-secondary-container);
      }
      :host([tone="warn"]) {
        --hp-tone-stroke: var(--hp-warn);
        --hp-tone-fill: var(--hp-warn-container);
        --hp-tone-on-fill: var(--hp-on-warn-container);
      }
      :host([tone="alert"]) {
        --hp-tone-stroke: var(--hp-alert);
        --hp-tone-fill: var(--hp-alert-container);
        --hp-tone-on-fill: var(--hp-on-alert-container);
      }
      :host([tone="error"]) {
        --hp-tone-stroke: var(--hp-error);
        --hp-tone-fill: var(--hp-error-container);
        --hp-tone-on-fill: var(--hp-on-error-container);
      }

      /* Non-neutral tone overrides stroke + label at rest. */
      :host([tone="positive"]),
      :host([tone="warn"]),
      :host([tone="alert"]),
      :host([tone="error"]) {
        --hp-stroke-color: var(--hp-tone-stroke);
        --hp-cell-label-color: var(--hp-tone-stroke);
      }

      /* tone + active = filled with tone-container; label flips to
 * the on-container pair for contrast. */
      :host([tone="positive"][active]),
      :host([tone="warn"][active]),
      :host([tone="alert"][active]),
      :host([tone="error"][active]) {
        --hp-stroke-color: var(--hp-tone-fill);
        --hp-hex-fill: var(--hp-tone-fill);
        --hp-cell-label-color: var(--hp-tone-on-fill);
      }

      /* ── Layout ──────────────────────────────────────────────── */

      .cell {
        position: relative;
        display: inline-block;
        line-height: 0;
      }

      .label {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        padding: var(--hp-sm);
        text-align: center;
        font-family: var(--hp-typo-label-md-font-family);
        font-size: var(--hp-typo-label-md-font-size);
        font-weight: var(--hp-typo-label-md-font-weight);
        line-height: var(--hp-typo-label-md-line-height);
        letter-spacing: var(--hp-typo-label-md-letter-spacing);
        color: var(--hp-cell-label-color);
        text-transform: uppercase;
        pointer-events: none;
        transition: color var(--hp-duration-medium) var(--hp-ease-default);
      }

      /* utility + toned cells use the smaller label scale (short
 * labels, icon labels, status pills). */
      :host([variant="utility"]) .label,
      :host([tone="positive"]) .label,
      :host([tone="warn"]) .label,
      :host([tone="alert"]) .label,
      :host([tone="error"]) .label {
        font-family: var(--hp-typo-label-sm-font-family);
        font-size: var(--hp-typo-label-sm-font-size);
        font-weight: var(--hp-typo-label-sm-font-weight);
        line-height: var(--hp-typo-label-sm-line-height);
        letter-spacing: var(--hp-typo-label-sm-letter-spacing);
      }

      /* content variant uses body-sm typography (longer prose; was
 * hp-deco's content style). Reads as text not a label. */
      :host([variant="content"]) .label {
        font-family: var(--hp-typo-body-sm-font-family);
        font-size: var(--hp-typo-body-sm-font-size);
        font-weight: var(--hp-typo-body-sm-font-weight);
        line-height: var(--hp-typo-body-sm-line-height);
        letter-spacing: normal;
        text-transform: none;
      }

      /* ── Focus trace ─────────────────────────────────────────── */

      .trace {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
        color: var(--hp-stroke-color);
      }

      .trace .edge {
        fill: currentColor;
        transform-box: fill-box;
        transform: scale(0);
        transition: transform var(--hp-unfold-trigger) var(--hp-ease-default);
      }

      .trace .edge-1 {
        transform-origin: 0% 0%;
      }
      .trace .edge-3 {
        transform-origin: 100% 3.4%;
      }
      .trace .edge-5 {
        transform-origin: 0% 100%;
      }

      :host(:focus-visible) .trace .edge {
        transform: scale(1);
      }

      :host(:focus-visible) .trace .edge-1 {
        transition-delay: 0ms;
      }
      :host(:focus-visible) .trace .edge-3 {
        transition-delay: var(--hp-unfold-stagger);
      }
      :host(:focus-visible) .trace .edge-5 {
        transition-delay: calc(var(--hp-unfold-stagger) * 2);
      }

      /* Reverse stagger on blur. */
      :host(:not(:focus-visible)) .trace .edge-5 {
        transition-delay: 0ms;
      }
      :host(:not(:focus-visible)) .trace .edge-3 {
        transition-delay: var(--hp-unfold-stagger);
      }
      :host(:not(:focus-visible)) .trace .edge-1 {
        transition-delay: calc(var(--hp-unfold-stagger) * 2);
      }

      @media (prefers-reduced-motion: reduce) {
        .trace .edge {
          transition: none;
        }
        :host(:focus-visible) .trace .edge {
          transform: scale(1);
        }
      }
    `,
  ];

  override render() {
    const showLabel = !UNLABELLED_VARIANTS.has(this.variant);
    const showTrace = INTERACTIVE_VARIANTS.has(this.variant) && this.size !== "md";
    return html`
      <div class="cell" part="cell">
        <hp-hex size=${this.size}></hp-hex>
        ${showTrace ? this.renderTrace() : ""}
        ${showLabel ? html`<div class="label" part="label"><slot></slot></div>` : ""}
      </div>
    `;
  }

  /** The three trapezoidal trace edges. Coordinates match the
   * pre-fold hp-trace geometry — pointy-top hex viewBox 100 × 115.47
   * with edges sitting in the band 4–6 viewBox units outside the
   * inner hex. */
  private renderTrace() {
    return html`
      <svg class="trace" viewBox="0 0 100 115.47" aria-hidden="true">
        <polygon class="edge edge-1" points="50,-6.928 106,25.403 104,26.558 50,-4.619"></polygon>
        <polygon class="edge edge-3" points="106,90.067 50,122.398 50,120.089 104,88.912"></polygon>
        <polygon class="edge edge-5" points="-6,90.067 -6,25.403 -4,26.558 -4,88.912"></polygon>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-cell": HpCell;
  }
}
