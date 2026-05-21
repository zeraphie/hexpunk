// hp-badge.ts — Small toned status / count badge.
//
// Thin shell over `hp-cell variant="content"` at `size="sm"` with an
// optional `tone` overlay. Reads as a status / count pill — paired
// with text in a sentence ("3 active alerts"), as a notification
// counter on a navigation hex, or as a quick state marker next to
// content. For larger / more prominent indicators, use hp-cell with
// the tone directly.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../primitives/hp-cell.js";
import { hpBase } from "../../styles/hp-base.js";

export type HpBadgeTone = "neutral" | "positive" | "warn" | "alert" | "error";

/**
 * Small toned status / count badge. Thin shell over hp-cell content
 * variant at sm size with an optional tone overlay.
 *
 * @slot - Badge label or count
 */
@customElement("hp-badge")
export class HpBadge extends LitElement {
  /** Semantic tone. Defaults to `neutral` (no tone overlay — uses the
   * hp-cell content variant tokens). */
  @property({ reflect: true })
  tone: HpBadgeTone = "neutral";

  /** Fills the badge with the tone-container colour when set.
   * Reads as "this state is in effect" — see hp-cell's `active`. */
  @property({ reflect: true, type: Boolean })
  active = false;

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
      }
    `,
  ];

  override render() {
    return html`
      <hp-cell variant="content" size="sm" tone=${this.tone} ?active=${this.active}>
        <slot></slot>
      </hp-cell>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-badge": HpBadge;
  }
}
