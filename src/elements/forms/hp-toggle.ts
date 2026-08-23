// hp-toggle.ts — Hex switch: a thin light-DOM alias over the native
// checkbox with `role="switch"`.
//
// Renders the hex-controls.css switch pattern: a stretched-octagon
// track whose corner cuts match the sliding hex thumb's angles, so
// the thumb sits flush at either end. The inner input carries the
// semantics, keyboard, labels, and form participation.
//
//   <hp-toggle name="motion" checked>Reduce motion</hp-toggle>

import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";

/**
 * Hex switch — light-DOM alias over `<input type="checkbox"
 * role="switch">`. Discrete on/off with a sliding hex thumb; use
 * hp-slider for continuous values. `change` bubbles from the inner
 * input; the host stamps `data-dirty` / `data-touched`.
 *
 * @fires change - Native change, bubbled from the inner input
 *
 * @slot - Label text, rendered inside the wrapping label
 * @status experimental
 */
@customElement("hp-toggle")
export class HpToggle extends LitElement {
  /** Current on/off state; mirrors the inner input. */
  @property({ type: Boolean })
  checked = false;

  /** Disabled — out of tab order and submission. */
  @property({ type: Boolean, reflect: true })
  disabled = false;

  /** Required — off blocks submission via constraint validation. */
  @property({ type: Boolean })
  required = false;

  /** Form field name; present in FormData when on. */
  @property()
  name?: string;

  /** Submitted value (with `name`) when on. */
  @property()
  value = "on";

  private labelNodes: Node[] = [];

  /** Light DOM on purpose — hex-controls.css styles the pattern and
   * the input participates in the form. */
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    if (this.labelNodes.length === 0 && !this.querySelector(":scope > label")) {
      this.labelNodes = [...this.childNodes];
      this.replaceChildren();
    }
    super.connectedCallback();
  }

  private get input(): HTMLInputElement | null {
    return this.querySelector(":scope > label > input");
  }

  /** Native constraint-validation surface, forwarded. */
  get validity(): ValidityState | undefined {
    return this.input?.validity;
  }

  get validationMessage(): string {
    return this.input?.validationMessage ?? "";
  }

  checkValidity(): boolean {
    return this.input?.checkValidity() ?? true;
  }

  reportValidity(): boolean {
    return this.input?.reportValidity() ?? true;
  }

  private handleChange = (event: Event): void => {
    this.checked = (event.target as HTMLInputElement).checked;
    this.toggleAttribute("data-dirty", true);
  };

  private handleFocusout = (): void => {
    this.toggleAttribute("data-touched", true);
  };

  override render() {
    return html`
      <label class="hp-toggle">
        <input
          type="checkbox"
          role="switch"
          .checked=${this.checked}
          ?disabled=${this.disabled}
          ?required=${this.required}
          name=${ifDefined(this.name)}
          .value=${this.value}
          @change=${this.handleChange}
          @focusout=${this.handleFocusout}
        />
        <span class="hp-toggle-track" aria-hidden="true"></span>
        ${this.labelNodes}
      </label>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-toggle": HpToggle;
  }
}
