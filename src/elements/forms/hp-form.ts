// hp-form.ts — Form container.
//
// Thin wrapper around the native <form> with consistent default
// gap + label / input alignment. Forwards `method`, `action`,
// `name`, and `novalidate` to the inner form. Submit events
// bubble naturally; the wrapper doesn't intercept.
//
// Stub — forthcoming work will wire validation states (error /
// success styles) and integrate with hp-checkbox / hp-toggle /
// hp-radio / hp-slider for FormData participation.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Form container — thin wrapper around the native <form> with
 * consistent gap + label / input alignment. Stub.
 *
 * @slot - Form controls (hp-checkbox, hp-toggle, hp-button, etc.)
 */
@customElement("hp-form")
export class HpForm extends LitElement {
  /** HTTP method for native submission. Default `post`. */
  @property()
  method: "get" | "post" | "dialog" = "post";

  /** Submission endpoint. */
  @property()
  action = "";

  /** Optional form name. */
  @property()
  name?: string;

  /** Skip browser native validation when set — let custom JS handle it. */
  @property({ type: Boolean, reflect: true, attribute: "no-validate" })
  noValidate = false;

  static override styles = [
    hpBase,
    css`
      :host {
        display: block;
        line-height: var(--hp-typo-body-md-line-height);
      }

      form {
        display: flex;
        flex-direction: column;
        gap: var(--hp-md);
      }
    `,
  ];

  override render() {
    return html`
      <form
        method=${this.method}
        action=${this.action}
        ?novalidate=${this.noValidate}
        name=${this.name ?? ""}
      >
        <slot></slot>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-form": HpForm;
  }
}
