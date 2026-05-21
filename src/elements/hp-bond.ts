// hp-bond.ts — Edge-bond indicator.
//
// Small `secondary` (green) hex dot that appears at the midpoint of the
// shared edge between two bonded atoms while the bond is forming, then
// fades to a hairline on the shared edge once the molecule settles.
// 12px (`spacing.bond-indicator-size`) at default density.
//
// State attribute: `forming` (visible, animated in) → `settled` (hairline,
// barely visible). Presentational — placed by `<hp-module>` / `<hp-grid>`
// when a bond forms.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../styles/hp-base.js";

export type HpBondState = "forming" | "settled";

/**
 * Shared-edge bond indicator between two axially-adjacent hexes.
 * Small filled hex dot at the shared edge midpoint; fades to a
 * hairline once the bond settles.
 *
 * @deprecated Slated for consolidation into hp-cell. Stays for now
 * so hp-grid can paint shared-edge markers.
 */
@customElement("hp-bond")
export class HpBond extends LitElement {
  /** `forming` (default, full visibility) or `settled` (hairline). */
  @property({ reflect: true })
  state: HpBondState = "forming";

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
        width: var(--hp-bond-indicator-size);
        height: calc(var(--hp-bond-indicator-size) * 1.1547);
        pointer-events: none;
      }

      .bond {
        width: 100%;
        height: 100%;
        background: var(--hp-secondary);
        clip-path: var(--hp-hex-clip);
        opacity: 1;
        transition:
          opacity var(--hp-duration-medium) var(--hp-ease-default),
          transform var(--hp-duration-medium) var(--hp-ease-default);
      }

      :host([state="settled"]) .bond {
        /* Fade to a hairline on the shared edge once the molecule settles. */
        opacity: 0.4;
        transform: scaleY(0.25);
      }
    `,
  ];

  override render() {
    return html`<div class="bond" part="bond" aria-hidden="true"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-bond": HpBond;
  }
}
