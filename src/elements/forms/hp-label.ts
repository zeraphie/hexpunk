// hp-label.ts — Form label primitive.
//
// Wraps a native `<label>` so screen readers and click-to-focus
// behaviour both work for free. The host accepts a `for` attribute
// (HTML's standard label-target id reference) and forwards it to
// the inner `<label>`. Optional `required` and `optional` props
// stamp the matching visual + a11y indicator.
//
// Pairs with hp-checkbox / hp-toggle / hp-radio / hp-slider / any
// hp-cell input that exposes a focus target via an `id`.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Form label primitive — wraps a native <label> with consistent
 * styling and the `for` forwarding, plus optional required / optional
 * markers.
 *
 * @slot - Label text
 */
@customElement("hp-label")
export class HpLabel extends LitElement {
  /** ID of the input this label targets. Forwarded to the inner
   * `<label>`'s `for` attribute — clicking the label focuses /
   * toggles the linked input. Maps to the `for` HTML attribute. */
  @property({ attribute: "for" })
  htmlFor = "";

  /** Append a "*" required marker after the label text. Stamps
   * aria-required on the linked input is the consumer's job — this
   * is the visual cue only. */
  @property({ reflect: true, type: Boolean })
  required = false;

  /** Append a muted "(optional)" hint after the label text. */
  @property({ reflect: true, type: Boolean })
  optional = false;

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
        cursor: default;
        line-height: var(--hp-typo-label-md-line-height);
      }

      label {
        display: inline-flex;
        align-items: baseline;
        gap: var(--hp-xs);
        font-family: var(--hp-typo-label-md-font-family);
        font-size: var(--hp-typo-label-md-font-size);
        font-weight: var(--hp-typo-label-md-font-weight);
        line-height: var(--hp-typo-label-md-line-height);
        letter-spacing: var(--hp-typo-label-md-letter-spacing);
        text-transform: uppercase;
        color: var(--hp-on-surface);
      }

      .required {
        color: var(--hp-error);
        font-weight: 700;
      }

      .optional {
        color: var(--hp-on-surface-variant);
        font-weight: 400;
        text-transform: none;
        letter-spacing: normal;
      }
    `,
  ];

  override render() {
    return html`
      <label for=${this.htmlFor}>
        <slot></slot>
        ${this.required
          ? html`<span class="required" aria-hidden="true">*</span>`
          : this.optional
            ? html`<span class="optional">(optional)</span>`
            : ""}
      </label>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-label": HpLabel;
  }
}
