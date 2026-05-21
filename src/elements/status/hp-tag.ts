// hp-tag.ts — Dismissable tag / chip.
//
// Pill-shaped (hex-shaped) label with an optional close button. The
// `removable` boolean adds an inline × button that fires
// `hp-tag-remove` on activation; consumers typically remove the
// element from the DOM in response. Pairs with hp-badge for
// non-dismissable status indicators.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../primitives/hp-cell.js";
import { hpBase } from "../../styles/hp-base.js";

import type { HpCellTone } from "../primitives/hp-cell.js";

export type HpTagTone = HpCellTone;

/**
 * Dismissable tag / chip. hp-cell content variant + optional × close
 * button.
 *
 * @fires hp-tag-remove - When the dismiss × is activated (click / Enter / Space)
 *
 * @slot - Tag label
 *
 * @csspart remove - The dismiss button (when removable)
 */
@customElement("hp-tag")
export class HpTag extends LitElement {
  /** Semantic tone — same set as hp-cell. */
  @property({ reflect: true })
  tone: HpTagTone = "neutral";

  /** Show the dismiss button. Fires `hp-tag-remove` on click /
   * Enter / Space. */
  @property({ reflect: true, type: Boolean })
  removable = false;

  /** Disabled — blocks dismiss action and dims the visual. */
  @property({ reflect: true, type: Boolean })
  disabled = false;

  private handleRemove = (event: Event): void => {
    if (this.disabled) {
      return;
    }
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("hp-tag-remove", {
        bubbles: true,
        composed: true,
      })
    );
  };

  private handleRemoveKey = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.handleRemove(event);
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

      .remove {
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

      .remove:hover,
      .remove:focus-visible {
        color: var(--hp-error);
      }

      .remove:focus-visible {
        outline: 2px solid var(--hp-focus-ring);
        outline-offset: 1px;
      }

      .remove svg {
        width: 10px;
        height: 10px;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        fill: none;
      }

      :host([disabled]) .remove {
        cursor: not-allowed;
      }
    `,
  ];

  override render() {
    return html`
      <hp-cell variant="content" size="sm" tone=${this.tone}>
        <slot></slot>
      </hp-cell>
      ${this.removable
        ? html`
            <button
              class="remove"
              type="button"
              part="remove"
              aria-label="Remove"
              ?disabled=${this.disabled}
              @click=${this.handleRemove}
              @keydown=${this.handleRemoveKey}
            >
              <svg viewBox="0 0 10 10" aria-hidden="true">
                <line x1="2" y1="2" x2="8" y2="8"></line>
                <line x1="8" y1="2" x2="2" y2="8"></line>
              </svg>
            </button>
          `
        : ""}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-tag": HpTag;
  }
}
