// hp-checkbox.ts — Hex checkbox: a thin light-DOM alias over the
// native input.
//
// Renders the hex-controls.css pattern (label + visually-hidden
// checkbox + masked hex span) into light DOM, so the browser owns
// everything that matters: form participation (FormData, `name`
// grouping), label association, constraint validation, keyboard,
// and focus. The element exists for ergonomics and as the home for
// field state — it forwards the native property surface and stamps
// `data-dirty` / `data-touched` as the user interacts.
//
// Slotted children become the label text:
//
//   <hp-checkbox name="terms" required>Accept the terms</hp-checkbox>

import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";

/**
 * Hex checkbox — light-DOM alias over `<input type="checkbox">`.
 * The inner input is the real control: it submits with the form,
 * associates with wrapping or `for=` labels, validates (`required`),
 * and toggles with Space natively. `change` events bubble through
 * with the input as target. The host stamps `data-dirty` after the
 * first user toggle and `data-touched` after the first blur.
 *
 * @fires change - Native change, bubbled from the inner input
 *
 * @slot - Label text, rendered inside the wrapping label
 * @status experimental
 */
@customElement("hp-checkbox")
export class HpCheckbox extends LitElement {
  /** Current checked state; mirrors the inner input. */
  @property({ type: Boolean })
  checked = false;

  /** Indeterminate (mixed) visual state; cleared by user toggle. */
  @property({ type: Boolean })
  indeterminate = false;

  /** Disabled — the native input drops out of tab order and
   * submission. */
  @property({ type: Boolean, reflect: true })
  disabled = false;

  /** Required — unchecked blocks form submission via constraint
   * validation. */
  @property({ type: Boolean })
  required = false;

  /** Form field name; present in FormData when checked. */
  @property()
  name?: string;

  /** Submitted value (with `name`) when checked. */
  @property()
  value = "on";

  /** Form tier: `xs` (default, 50px cell) or `xxs` (20px, dense). */
  @property({ reflect: true })
  size: "xxs" | "xs" = "xs";

  /** Author children captured before first render; re-rendered as
   * the label text. */
  private labelNodes: Node[] = [];

  /** Light DOM on purpose — the pattern must be styleable by
   * hex-controls.css and the input must participate in the form. */
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
    const input = event.target as HTMLInputElement;
    this.checked = input.checked;
    this.indeterminate = input.indeterminate;
    this.toggleAttribute("data-dirty", true);
  };

  private handleFocusout = (): void => {
    this.toggleAttribute("data-touched", true);
  };

  override render() {
    return html`
      <label class="hp-checkbox" data-size=${this.size === "xxs" ? "xxs" : nothing}>
        <input
          type="checkbox"
          .checked=${this.checked}
          .indeterminate=${this.indeterminate}
          ?disabled=${this.disabled}
          ?required=${this.required}
          name=${ifDefined(this.name)}
          .value=${this.value}
          @change=${this.handleChange}
          @focusout=${this.handleFocusout}
        />
        <span class="hp-checkbox-hex" aria-hidden="true"></span>
        ${this.labelNodes}
      </label>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-checkbox": HpCheckbox;
  }
}
