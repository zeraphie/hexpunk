// hp-badge.ts — Small toned status / count badge.
//
// Thin shell over `hp-cell variant="content"` at `size="sm"` with an
// optional `tone` overlay. Reads as a status / count pill — paired
// with text in a sentence ("3 active alerts"), as a notification
// counter on a navigation hex, or as a quick state marker next to
// content. `dismissible` adds an inline × that fires
// `hp-badge-dismiss` — the chip / tag use; consumers typically
// remove the element from the DOM in response. For larger / more
// prominent indicators, use hp-cell with the tone directly.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../primitives/hp-cell.js";
import { hpBase } from "../../styles/hp-base.js";

export type HpBadgeTone = "neutral" | "positive" | "warn" | "alert" | "error";

/**
 * Small toned status / count badge. Thin shell over hp-cell content
 * variant at sm size with an optional tone overlay. `dismissible`
 * turns it into a removable chip.
 *
 * @fires hp-badge-dismiss - When the dismiss × is activated (click / Enter / Space)
 *
 * @slot - Badge label or count
 *
 * @csspart dismiss - The dismiss button (when dismissible)
 * @status wip
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

  /** Show the dismiss ×. Fires `hp-badge-dismiss` on activation. */
  @property({ reflect: true, type: Boolean })
  dismissible = false;

  /** Disabled — blocks dismiss and dims the visual. */
  @property({ reflect: true, type: Boolean })
  disabled = false;

  private handleDismiss = (event: Event): void => {
    if (this.disabled) {
      return;
    }
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("hp-badge-dismiss", {
        bubbles: true,
        composed: true,
      })
    );
  };

  private handleDismissKey = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.handleDismiss(event);
    }
  };

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: var(--hp-xs);
      }

      :host([disabled]) {
        opacity: 0.5;
      }

      .dismiss {
        display: inline-grid;
        place-items: center;
        width: 16px;
        height: 16px;
        cursor: pointer;
        color: var(--hp-on-surface-variant);
        border: none;
        background: transparent;
        padding: 0;
        border-radius: 2px;
        transition: color var(--hp-duration-medium) var(--hp-ease-default);
      }

      .dismiss:hover,
      .dismiss:focus-visible {
        color: var(--hp-on-surface);
      }

      .dismiss:focus-visible {
        outline: 2px solid var(--hp-focus-ring);
        outline-offset: 1px;
      }

      .dismiss svg {
        width: 10px;
        height: 10px;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: square;
        fill: none;
      }

      :host([disabled]) .dismiss {
        cursor: not-allowed;
      }
    `,
  ];

  override render() {
    return html`
      <hp-cell variant="content" size="sm" tone=${this.tone} ?active=${this.active}>
        <slot></slot>
      </hp-cell>
      ${
        this.dismissible
          ? html`
              <button
                class="dismiss"
                type="button"
                part="dismiss"
                aria-label="Dismiss"
                ?disabled=${this.disabled}
                @click=${this.handleDismiss}
                @keydown=${this.handleDismissKey}
              >
                <svg viewBox="0 0 10 10" aria-hidden="true">
                  <line x1="2" y1="2" x2="8" y2="8"></line>
                  <line x1="8" y1="2" x2="2" y2="8"></line>
                </svg>
              </button>
            `
          : ""
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-badge": HpBadge;
  }
}
