// hp-cluster.ts — Multi-hex group layout.
//
// Two layout modes, switched via the `layout` attribute:
//
//   `rosette` (default — back-compat) — the canonical 5-hex
//   navigation rosette: a centre cell with four named-slot
//   neighbours (top / middle-left / middle-right / bottom).
//   Children project via `slot="..."`. Existing showcase usages
//   continue to work unchanged.
//
//   `honeycomb` — accepts N default-slot children. First child is
//   the centre (0, 0); remaining children fill outward by ring,
//   clockwise from north. Ring 1 holds 6 positions; ring 2 holds
//   12. v1 caps at 2 rings (19 hexes total — every existing
//   showcase category fits comfortably).
//
// Drag handling stays in hp-grid via its `drag-handle="..."`
// selector on the cluster element — hp-cluster is purely layout.
// For honeycomb mode the canonical handle is `:first-child`
// (selects the centre); for rosette mode `[slot='centre']`.
//
// Internally reuses the same effective-cell math as `<hp-grid>` so
// a cluster's hexes share edges cleanly with each other (overlap
// by `hex-stroke` to avoid double-thick shared edges).

import { LitElement, css, html, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

const ROW_STEP_FACTOR = 0.8660254;

/**
 * Multi-hex group layout. `layout="rosette"` (default) preserves
 * the canonical 5-hex navigation rosette via named slots;
 * `layout="honeycomb"` accepts N default-slot children and packs
 * them in honeycomb rings outward from the first child (the
 * centre).
 *
 * @slot - Default slot — N children for honeycomb layout. First child is the centre.
 * @slot centre - Rosette centre hex
 * @slot top - Rosette top hex (north neighbour)
 * @slot middle-left - Rosette west-of-centre
 * @slot middle-right - Rosette east-of-centre
 * @slot bottom - Rosette bottom hex (south neighbour)
 */
@customElement("hp-cluster")
export class HpCluster extends LitElement {
  /** Cell size for the cluster — `sm` (default), `md`, or `lg`. */
  @property({ reflect: true })
  size: "sm" | "md" | "lg" = "sm";

  /** Layout mode. `rosette` is the canonical 5-hex navigation
   * rosette (named slots, current behaviour). `honeycomb` accepts
   * N default-slot children packed into rings outward from the
   * first child. */
  @property({ reflect: true })
  layout: "rosette" | "honeycomb" = "rosette";

  static override styles = [
    hpBase,
    css`
      :host {
        position: relative;
        display: inline-block;

        --hp-cell: var(--hp-hex-cell-sm);
        --hp-effective-cell: calc(var(--hp-cell) - var(--hp-hex-stroke));
        --hp-col-step: var(--hp-effective-cell);
        --hp-row-step: calc(var(--hp-effective-cell) * ${ROW_STEP_FACTOR});

        /* Default footprint sized for the rosette (1 ring on every
         * side): 2 col-steps wide + the cell width itself; 2
         * row-steps tall + the cell height. */
        width: calc(var(--hp-col-step) * 2 + var(--hp-cell));
        height: calc(var(--hp-row-step) * 2 + var(--hp-cell) * 1.1547);
      }

      /* Honeycomb mode grows to accommodate ring 2 — outermost q,r
       * extent is ±2, giving 4 col-steps wide + 4 row-steps tall
       * plus the cell itself. */
      :host([layout="honeycomb"]) {
        width: calc(var(--hp-col-step) * 4 + var(--hp-cell));
        height: calc(var(--hp-row-step) * 4 + var(--hp-cell) * 1.1547);
      }

      :host([size="md"]) {
        --hp-cell: var(--hp-hex-cell-md);
      }

      :host([size="lg"]) {
        --hp-cell: var(--hp-hex-cell-lg);
      }

      ::slotted(*) {
        position: absolute;
        left: 50%;
        top: 50%;
      }

      /* ── Rosette layout (5 named slots) ─────────────────────── */

      /* Centre lifted above outer slots so the focal child of the
       * rosette (typically a label or trigger) is never occluded
       * by surrounding hexes' overlap area. */
      :host([layout="rosette"]) ::slotted([slot="centre"]) {
        translate: -50% -50%;
        z-index: 1;
      }

      /* Axial (0, -1) — top */
      :host([layout="rosette"]) ::slotted([slot="top"]) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -0.5), calc(var(--hp-row-step) * -1));
      }

      /* Axial (-1, 0) — middle-left */
      :host([layout="rosette"]) ::slotted([slot="middle-left"]) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -1), 0);
      }

      /* Axial (1, 0) — middle-right */
      :host([layout="rosette"]) ::slotted([slot="middle-right"]) {
        translate: -50% -50%;
        transform: translate(var(--hp-col-step), 0);
      }

      /* Axial (0, 1) — bottom */
      :host([layout="rosette"]) ::slotted([slot="bottom"]) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * 0.5), var(--hp-row-step));
      }

      /* ── Honeycomb layout (N default-slot children) ─────────── */
      /* Axial pixel formula: x = col_step * (q + r/2), y = row_step * r.
       * Children fill clockwise from north, centre first, then ring 1
       * (6 positions), then ring 2 (12 positions). v1 caps at ring 2;
       * children beyond index 19 stack at the centre. */

      /* Centre — (0, 0). Lifted above outer rings same as rosette. */
      :host([layout="honeycomb"]) ::slotted(:nth-child(1)) {
        translate: -50% -50%;
        z-index: 1;
      }

      /* Ring 1 — 6 positions, clockwise from north. */

      /* (0, -1) — N */
      :host([layout="honeycomb"]) ::slotted(:nth-child(2)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -0.5), calc(var(--hp-row-step) * -1));
      }
      /* (1, -1) — NE */
      :host([layout="honeycomb"]) ::slotted(:nth-child(3)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * 0.5), calc(var(--hp-row-step) * -1));
      }
      /* (1, 0) — SE */
      :host([layout="honeycomb"]) ::slotted(:nth-child(4)) {
        translate: -50% -50%;
        transform: translate(var(--hp-col-step), 0);
      }
      /* (0, 1) — S */
      :host([layout="honeycomb"]) ::slotted(:nth-child(5)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * 0.5), var(--hp-row-step));
      }
      /* (-1, 1) — SW */
      :host([layout="honeycomb"]) ::slotted(:nth-child(6)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -0.5), var(--hp-row-step));
      }
      /* (-1, 0) — NW */
      :host([layout="honeycomb"]) ::slotted(:nth-child(7)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -1), 0);
      }

      /* Ring 2 — 12 positions, clockwise from north. */

      /* (0, -2) — N */
      :host([layout="honeycomb"]) ::slotted(:nth-child(8)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -1), calc(var(--hp-row-step) * -2));
      }
      /* (1, -2) — N+NE */
      :host([layout="honeycomb"]) ::slotted(:nth-child(9)) {
        translate: -50% -50%;
        transform: translate(0, calc(var(--hp-row-step) * -2));
      }
      /* (2, -2) — NE */
      :host([layout="honeycomb"]) ::slotted(:nth-child(10)) {
        translate: -50% -50%;
        transform: translate(var(--hp-col-step), calc(var(--hp-row-step) * -2));
      }
      /* (2, -1) — NE+SE */
      :host([layout="honeycomb"]) ::slotted(:nth-child(11)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * 1.5), calc(var(--hp-row-step) * -1));
      }
      /* (2, 0) — E */
      :host([layout="honeycomb"]) ::slotted(:nth-child(12)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * 2), 0);
      }
      /* (1, 1) — SE+S */
      :host([layout="honeycomb"]) ::slotted(:nth-child(13)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * 1.5), var(--hp-row-step));
      }
      /* (0, 2) — S */
      :host([layout="honeycomb"]) ::slotted(:nth-child(14)) {
        translate: -50% -50%;
        transform: translate(var(--hp-col-step), calc(var(--hp-row-step) * 2));
      }
      /* (-1, 2) — S+SW */
      :host([layout="honeycomb"]) ::slotted(:nth-child(15)) {
        translate: -50% -50%;
        transform: translate(0, calc(var(--hp-row-step) * 2));
      }
      /* (-2, 2) — SW */
      :host([layout="honeycomb"]) ::slotted(:nth-child(16)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -1), calc(var(--hp-row-step) * 2));
      }
      /* (-2, 1) — SW+NW */
      :host([layout="honeycomb"]) ::slotted(:nth-child(17)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -1.5), var(--hp-row-step));
      }
      /* (-2, 0) — W */
      :host([layout="honeycomb"]) ::slotted(:nth-child(18)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -2), 0);
      }
      /* (-1, -1) — NW+N */
      :host([layout="honeycomb"]) ::slotted(:nth-child(19)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -1.5), calc(var(--hp-row-step) * -1));
      }
    `,
  ];

  override render(): TemplateResult {
    if (this.layout === "honeycomb") {
      return html`<slot></slot>`;
    }
    return html`
      <slot name="top"></slot>
      <slot name="middle-left"></slot>
      <slot name="centre"></slot>
      <slot name="middle-right"></slot>
      <slot name="bottom"></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-cluster": HpCluster;
  }
}
