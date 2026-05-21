// hp-radio.ts — Single radio option.
//
// Pairs with hp-radio-group as a parent — group manages selection,
// arrow-key navigation, and dispatches the change event. Individual
// hp-radio renders the hex chrome and emits hp-radio-select on
// click / Space when the value should change.
//
// Visual: hollow hex at rest; concentric small filled hex inside
// when checked. role="radio", aria-checked, focusable.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../primitives/hp-hex.js";
import { hpBase } from "../../styles/hp-base.js";

/**
 * Single radio option. Pairs with hp-radio-group as a parent.
 * role="radio", aria-checked reflects state; emits hp-radio-select
 * on click / Space / Enter for the group to track.
 *
 * @fires hp-radio-select - When this radio is activated. detail: { value }
 *
 * @csspart radio - The radio container wrapping hp-hex + inner dot
 * @csspart dot - The inner filled hex shown when checked
 */
@customElement("hp-radio")
export class HpRadio extends LitElement {
  /** Value emitted when this radio is selected. Required for the
   * parent hp-radio-group to track selection. */
  @property()
  value = "";

  /** Selected state. Set by the parent hp-radio-group; consumers
   * shouldn't write directly — use the group's `value` instead. */
  @property({ reflect: true, type: Boolean })
  checked = false;

  /** Disabled — blocks selection, removes from tab order. */
  @property({ reflect: true, type: Boolean })
  disabled = false;

  /** Cell size. `xs` (default, 32px) is the comfortable form-input
   * size; `xxs` (20px) is dense / tabular; `sm` (100px) is the
   * content-hex size — rarely useful here but available. */
  @property({ reflect: true })
  size: "xxs" | "xs" | "sm" = "xs";

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "radio");
    }
    this.syncAria();
    this.addEventListener("click", this.handleClick);
    this.addEventListener("keydown", this.handleKeyDown);
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("checked") || changed.has("disabled")) {
      this.syncAria();
    }
  }

  private syncAria(): void {
    this.setAttribute("aria-checked", this.checked ? "true" : "false");
    if (this.disabled) {
      this.setAttribute("aria-disabled", "true");
      this.setAttribute("tabindex", "-1");
    } else {
      this.removeAttribute("aria-disabled");
      if (!this.hasAttribute("tabindex") || this.getAttribute("tabindex") === "-1") {
        // Only one radio in a group should be focusable via Tab; the
        // group's keyboard handler shifts focus between them via
        // arrow keys. Default: focusable unless explicitly opted out.
        this.setAttribute("tabindex", this.checked ? "0" : "-1");
      }
    }
  }

  private handleClick = (event: MouseEvent): void => {
    if (this.disabled || this.checked) {
      return;
    }
    event.preventDefault();
    this.emitSelect();
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled) {
      return;
    }
    if ((event.key === " " || event.key === "Enter") && !this.checked) {
      event.preventDefault();
      this.emitSelect();
    }
  };

  private emitSelect(): void {
    this.dispatchEvent(
      new CustomEvent("hp-radio-select", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      })
    );
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
        cursor: var(--hp-cursor, pointer);
        --hp-stroke-color: var(--hp-outline);
      }

      :host(:hover),
      :host(:focus-visible) {
        --hp-stroke-color: var(--hp-secondary);
      }

      :host([checked]) {
        --hp-stroke-color: var(--hp-primary);
      }

      :host([disabled]) {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .radio {
        position: relative;
        display: inline-block;
        line-height: 0;
      }

      .dot {
        position: absolute;
        inset: 25%;
        clip-path: var(--hp-hex-clip);
        background: var(--hp-stroke-color);
        opacity: 0;
        transition: opacity var(--hp-duration-medium) var(--hp-ease-default);
        pointer-events: none;
      }

      :host([checked]) .dot {
        opacity: 1;
      }
    `,
  ];

  override render() {
    return html`
      <div class="radio" part="radio">
        <hp-hex size=${this.size}></hp-hex>
        <div class="dot" part="dot" aria-hidden="true"></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-radio": HpRadio;
  }
}
