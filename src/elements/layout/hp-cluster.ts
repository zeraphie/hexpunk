// hp-cluster.ts — Five-hex navigation rosette.
//
// Preset layout: a centre cell surrounded by four positioned cells —
// top / middle-left / middle-right / bottom — the canonical "navigation
// rosette" from the Hexpunk reference pen. Children project via named
// slots (`slot="top"`, etc.) and the cluster handles axial positioning
// in CSS without composing `<hp-grid>` — clusters are static layouts
// that don't need drag, snap, or occupancy.
//
// Internally reuses the same effective-cell math as `<hp-grid>` so a
// cluster's hexes share edges cleanly with each other (overlap by
// `hex-stroke` to avoid double-thick shared edges).

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

const ROW_STEP_FACTOR = 0.8660254;

/**
 * 5-hex rosette layout — centre + 4 axial neighbours. Slotted
 * children with slot names (`centre`, `top`, `middle-left`,
 * `middle-right`, `bottom`) get positioned by axial offsets.
 *
 * @slot centre - Centre hex
 * @slot top - Top hex (north neighbour)
 * @slot middle-left - West-of-centre
 * @slot middle-right - East-of-centre
 * @slot bottom - Bottom hex (south neighbour)
 */
@customElement("hp-cluster")
export class HpCluster extends LitElement {
  /** Cell size for the cluster — `sm` (default), `md`, or `lg`. */
  @property({ reflect: true })
  size: "sm" | "md" | "lg" = "sm";

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

        /* Span: 2 col-steps wide + the cell width itself; 2 row-steps
 * tall + the cell height. Sized so all five children fit
 * comfortably with no overflow. */
        width: calc(var(--hp-col-step) * 2 + var(--hp-cell));
        height: calc(var(--hp-row-step) * 2 + var(--hp-cell) * 1.1547);
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

      /* Axial (0, -1) — top: x = -col/2, y = -row */
      ::slotted([slot="top"]) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -0.5), calc(var(--hp-row-step) * -1));
      }

      /* Axial (-1, 0) — middle-left: x = -col, y = 0 */
      ::slotted([slot="middle-left"]) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -1), 0);
      }

      /* Axial (0, 0) — centre. Lifted above the outer slots so the
 * focal child of the rosette (typically a label or trigger) is
 * never occluded by surrounding hexes' overlap area. */
      ::slotted([slot="centre"]) {
        translate: -50% -50%;
        z-index: 1;
      }

      /* Axial (1, 0) — middle-right: x = +col, y = 0 */
      ::slotted([slot="middle-right"]) {
        translate: -50% -50%;
        transform: translate(var(--hp-col-step), 0);
      }

      /* Axial (0, 1) — bottom: x = +col/2, y = +row */
      ::slotted([slot="bottom"]) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * 0.5), var(--hp-row-step));
      }
    `,
  ];

  override render() {
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
