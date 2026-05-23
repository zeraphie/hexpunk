// hp-copy.ts — Copy-to-clipboard button primitive.
//
// Single-purpose button that writes a configured string to the system
// clipboard. Used by hp-demo (copying code-slot text) and hp-latex
// (copying LaTeX source) — anywhere the design system needs a small
// "grab this text" affordance.
//
// Default appearance: small text-labelled button reading "COPY".
// Clicking flips the label to "COPIED" for ~1.5s as feedback, calls
// the async Clipboard API, and dispatches a bubbling
// `hp-copy-success` event so consumers can layer their own UI
// (toasts, telemetry) on top if needed. The `icon` attribute
// switches to an icon-only variant for tight chrome.
//
// Built on Lit + shadow DOM. The button is fully self-contained;
// the `value` text isn't visibly rendered (it's only flushed to the
// clipboard) so shadow-DOM encapsulation is the right call.

import { LitElement, css, html, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Copy-to-clipboard button.
 *
 * @property value - Text to write to the clipboard on click
 * @property label - Idle button label (default: "Copy")
 * @property copiedLabel - Label after a successful copy (default: "Copied")
 * @property icon - Switch to icon-only variant
 * @fires hp-copy-success - Bubbling CustomEvent on successful clipboard write; detail = { value }
 * @fires hp-copy-error - Bubbling CustomEvent on failed clipboard write; detail = { error, value }
 * @csspart button - The internal <button> element
 */
@customElement("hp-copy")
export class HpCopy extends LitElement {
  /** Text to write to the clipboard. */
  @property({ type: String }) value = "";

  /** Idle button label. */
  @property({ type: String }) label = "Copy";

  /** Label shown briefly after a successful copy. */
  @property({ type: String, attribute: "copied-label" }) copiedLabel = "Copied";

  /** Icon-only variant — hides the text label, shows just the clipboard
   * icon. Default is text-only. */
  @property({ type: Boolean, reflect: true }) icon = false;

  @state() private _copied = false;

  private async _handleClick(): Promise<void> {
    // Async Clipboard API requires a secure context (https or localhost).
    // No legacy execCommand fallback — that path is sync-only, requires
    // a transient user-activation focus dance, and silently fails just
    // as often. If the modern API isn't available, the click is a no-op
    // rather than half-working.
    if (!navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(this.value);
      this._copied = true;
      this.dispatchEvent(
        new CustomEvent("hp-copy-success", {
          detail: { value: this.value },
          bubbles: true,
          composed: true,
        })
      );
      setTimeout(() => {
        this._copied = false;
      }, 1500);
    } catch (err) {
      this.dispatchEvent(
        new CustomEvent("hp-copy-error", {
          detail: { error: err, value: this.value },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-flex;
      }

      button {
        font-family: var(--hp-typo-label-sm-font-family);
        font-size: var(--hp-typo-label-sm-font-size);
        font-weight: var(--hp-typo-label-sm-font-weight);
        letter-spacing: var(--hp-typo-label-sm-letter-spacing);
        text-transform: uppercase;
        color: var(--hp-on-surface-variant);
        background: var(--hp-surface);
        border: 1px solid var(--hp-outline-faint);
        padding: var(--hp-xs) var(--hp-sm);
        border-radius: var(--hp-rounded-sm);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: var(--hp-xs);
        transition:
          color var(--hp-duration-fast) var(--hp-ease-default),
          border-color var(--hp-duration-fast) var(--hp-ease-default);
      }

      button:hover,
      button:focus-visible {
        color: var(--hp-secondary);
        border-color: var(--hp-secondary);
      }

      button[data-copied] {
        color: var(--hp-secondary);
        border-color: var(--hp-secondary);
      }

      /* Icon variant — collapse padding so the icon doesn't drift far
       * from the button border. */
      :host([icon]) button {
        padding: var(--hp-xs);
      }

      .icon {
        width: 12px;
        height: 12px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linejoin: round;
      }
    `,
  ];

  override render(): TemplateResult {
    const label = this._copied ? this.copiedLabel : this.label;
    const iconSvg = html`<svg class="icon" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="3.5" y="3.5" width="6" height="6"></rect>
      <path d="M2.5 8.5 V2.5 H8.5"></path>
    </svg>`;

    return html`<button
      type="button"
      part="button"
      aria-label=${label}
      ?data-copied=${this._copied}
      @click=${this._handleClick}
    >
      ${this.icon ? iconSvg : label}
    </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-copy": HpCopy;
  }
}
