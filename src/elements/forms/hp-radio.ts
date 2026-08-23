// hp-radio.ts — Hex radio: a thin light-DOM alias over the native
// input.
//
// Renders the hex-controls.css radio pattern (label +
// visually-hidden radio + masked hex ring with a concentric filled
// hex when selected). The browser owns the group: radios sharing a
// `name` are single-select with arrow-key movement and roving focus
// — no group element required.
//
//   <hp-radio name="tier" value="xs" checked>Comfortable</hp-radio>
//   <hp-radio name="tier" value="xxs">Dense</hp-radio>

import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";

/**
 * Hex radio — light-DOM alias over `<input type="radio">`. Group
 * behaviour (single-select, arrow keys) comes from the shared
 * `name`, natively. `change` bubbles from the inner input; the host
 * keeps `checked` in sync even when a sibling steals the selection,
 * and stamps `data-dirty` / `data-touched` on interaction.
 *
 * @fires change - Native change, bubbled from the inner input
 *
 * @slot - Label text, rendered inside the wrapping label
 * @status experimental
 */
@customElement("hp-radio")
export class HpRadio extends LitElement {
  /** Current checked state; mirrors the inner input. */
  @property({ type: Boolean })
  checked = false;

  /** Disabled — out of tab order and submission. */
  @property({ type: Boolean, reflect: true })
  disabled = false;

  /** Required — the group must have a selection to submit. */
  @property({ type: Boolean })
  required = false;

  /** Group name; radios sharing it are one single-select group. */
  @property()
  name?: string;

  /** Submitted value when this radio is the group's selection. */
  @property()
  value = "on";

  /** Form tier: `xs` (default, 50px cell) or `xxs` (20px, dense). */
  @property({ reflect: true })
  size: "xxs" | "xs" = "xs";

  private labelNodes: Node[] = [];

  /** Light DOM on purpose — hex-controls.css styles the pattern and
   * the input participates in the form and its radio group. */
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    if (this.labelNodes.length === 0 && !this.querySelector(":scope > label")) {
      this.labelNodes = [...this.childNodes];
      this.replaceChildren();
    }
    super.connectedCallback();
    // A sibling radio taking the selection unchecks this input with
    // no event here — sync from the group's change at the root.
    (this.getRootNode() as Document | ShadowRoot).addEventListener(
      "change",
      this.syncFromGroup,
      true
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    (this.getRootNode() as Document | ShadowRoot).removeEventListener(
      "change",
      this.syncFromGroup,
      true
    );
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

  private syncFromGroup = (event: Event): void => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement &&
      target.type === "radio" &&
      target.name === this.name &&
      this.input &&
      this.checked !== this.input.checked
    ) {
      this.checked = this.input.checked;
    }
  };

  private handleChange = (event: Event): void => {
    this.checked = (event.target as HTMLInputElement).checked;
    this.toggleAttribute("data-dirty", true);
  };

  private handleFocusout = (): void => {
    this.toggleAttribute("data-touched", true);
  };

  override render() {
    return html`
      <label class="hp-radio" data-size=${this.size === "xxs" ? "xxs" : nothing}>
        <input
          type="radio"
          .checked=${this.checked}
          ?disabled=${this.disabled}
          ?required=${this.required}
          name=${ifDefined(this.name)}
          .value=${this.value}
          @change=${this.handleChange}
          @focusout=${this.handleFocusout}
        />
        <span class="hp-radio-hex" aria-hidden="true"></span>
        ${this.labelNodes}
      </label>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-radio": HpRadio;
  }
}
