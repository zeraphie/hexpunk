// hp-radio-group.ts — Radio group container.
//
// Manages selection across slotted hp-radio children. Arrow keys move
// focus + selection between siblings, Home / End jump to first / last,
// only one child `checked` at a time. The group exposes its current
// value via the `value` property; consumers listen for `change` to react.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Radio group container. Manages selection across slotted hp-radio
 * children — arrow keys move focus + selection between siblings,
 * Home / End jump to first / last, only one child checked at a
 * time. role="radiogroup".
 *
 * @fires change - When selection changes via click or arrow keys. detail: { value }
 *
 * @slot - One or more <hp-radio> children
 */
@customElement("hp-radio-group")
export class HpRadioGroup extends LitElement {
  /** Currently selected radio value. Setting this checks the matching
   * child; clearing it unchecks all. */
  @property({ reflect: true })
  value = "";

  /** Disable the entire group — every child reads as disabled. */
  @property({ reflect: true, type: Boolean })
  disabled = false;

  /** Orientation — controls arrow-key direction. `horizontal` moves
   * with ArrowLeft/Right; `vertical` (default) with ArrowUp/Down. */
  @property({ reflect: true })
  orientation: "horizontal" | "vertical" = "vertical";

  /** Optional form name (placeholder for forthcoming hp-form wiring). */
  @property()
  name?: string;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "radiogroup");
    }
    this.addEventListener("keydown", this.handleKeyDown);
    this.addEventListener("hp-radio-select", this.handleRadioSelect as EventListener);
    // First paint may run before children attach; resync on next tick.
    queueMicrotask(() => this.syncChildren());
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("value") || changed.has("disabled")) {
      this.syncChildren();
    }
  }

  private getRadios(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>("hp-radio"));
  }

  private syncChildren(): void {
    const radios = this.getRadios();
    radios.forEach((radio) => {
      const radioValue = radio.getAttribute("value") ?? "";
      const isChecked = radioValue === this.value;
      if (isChecked) {
        radio.setAttribute("checked", "");
      } else {
        radio.removeAttribute("checked");
      }
      if (this.disabled) {
        radio.setAttribute("disabled", "");
      } else {
        // Don't unconditionally remove — individual radios may have
        // been disabled independently. Only clear when the group's
        // disabled state was the source.
      }
    });
  }

  private handleRadioSelect = (event: CustomEvent<{ value: string }>): void => {
    if (this.disabled) {
      return;
    }
    this.value = event.detail.value;
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      })
    );
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled) {
      return;
    }
    const radios = this.getRadios().filter((r) => !r.hasAttribute("disabled"));
    if (radios.length === 0) {
      return;
    }

    const horizontal = this.orientation === "horizontal";
    const forward = horizontal ? "ArrowRight" : "ArrowDown";
    const backward = horizontal ? "ArrowLeft" : "ArrowUp";

    const focused = document.activeElement as HTMLElement | null;
    const currentIdx = focused ? radios.indexOf(focused) : -1;

    let nextIdx: number | null = null;
    if (event.key === forward) {
      nextIdx = currentIdx >= radios.length - 1 ? 0 : currentIdx + 1;
    } else if (event.key === backward) {
      nextIdx = currentIdx <= 0 ? radios.length - 1 : currentIdx - 1;
    } else if (event.key === "Home") {
      nextIdx = 0;
    } else if (event.key === "End") {
      nextIdx = radios.length - 1;
    }

    if (nextIdx === null) {
      return;
    }
    event.preventDefault();
    const target = radios[nextIdx];
    if (!target) {
      return;
    }
    target.focus();
    const value = target.getAttribute("value") ?? "";
    this.value = value;
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value },
        bubbles: true,
        composed: true,
      })
    );
  };

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-flex;
        gap: var(--hp-md);
        line-height: var(--hp-typo-body-md-line-height);
      }

      :host([orientation="vertical"]) {
        flex-direction: column;
      }

      :host([orientation="horizontal"]) {
        flex-direction: row;
      }
    `,
  ];

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-radio-group": HpRadioGroup;
  }
}
