// hp-copy.ts — Copy-to-clipboard button primitive.
//
// Single-purpose affordance that writes a configured string to the
// system clipboard. Used by hp-demo (copying code-slot text) and
// hp-latex (copying LaTeX source) — anywhere the design system
// needs a small "grab this text" affordance.
//
// Appearance: borderless button with Lucide's `copy` icon next to a
// "Copy" text label, plus a sibling "copied" toast that fades in to
// its left for ~1.5s after a successful write. Mirrors hp-demo's
// original copy affordance — transparent chrome, colour shifts to
// --hp-primary on hover/focus, no surface fill or border. Failure
// dispatches a bubbling `hp-copy-error` event; success dispatches
// `hp-copy-success`. The `icon-only` attribute drops the text label
// for tight chrome where only the glyph fits.
//
// Built on Lit + shadow DOM. The button is fully self-contained;
// the `value` text isn't visibly rendered (it's only flushed to the
// clipboard) so shadow-DOM encapsulation is the right call.

import { LitElement, css, html, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";

import { copy as copyIcon } from "../../icons/copy.js";
import { hpBase } from "../../styles/hp-base.js";

/**
 * Copy-to-clipboard button.
 *
 * @property value - Text to write to the clipboard on click
 * @property label - Idle button label (default: "Copy")
 * @property copiedLabel - Label after a successful copy (default: "Copied")
 * @property iconOnly - Drop the text label and show only the icon
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

  /** Icon-only variant — drops the text label so only the Lucide
   * `copy` glyph shows. Default keeps both the icon and the label.
   * Useful for tight chrome where the text doesn't fit. */
  @property({ type: Boolean, reflect: true, attribute: "icon-only" })
  iconOnly = false;

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
        align-items: center;
        gap: var(--hp-xs);
      }

      /* Apply the typography to both the toast span and the button
       * directly rather than relying on host inheritance. When
       * hp-copy sits inside a parent that sets its own font (e.g.
       * hp-demo's .actions row at label-sm), declaring on each
       * element guarantees the toast and the button render at the
       * same size. label-md (12px) is the design target — bare
       * text without an accompanying icon reads cramped at the
       * label-sm 10px. */
      .toast,
      button {
        font-family: var(--hp-typo-label-md-font-family);
        font-size: var(--hp-typo-label-md-font-size);
        font-weight: var(--hp-typo-label-md-font-weight);
        line-height: var(--hp-typo-label-md-line-height);
        letter-spacing: var(--hp-typo-label-md-letter-spacing);
        text-transform: uppercase;
      }

      /* Sibling toast — fades in to the left of the button for ~1.5s
       * after a successful copy, then fades back out. Inert when
       * .show isn't applied (opacity 0). */
      .toast {
        color: var(--hp-secondary);
        opacity: 0;
        transition: opacity var(--hp-duration-medium) var(--hp-ease-default);
      }

      .toast.show {
        opacity: 1;
      }

      button {
        background: transparent;
        border: 1px solid transparent;
        color: var(--hp-on-surface-variant);
        cursor: pointer;
        padding: var(--hp-xs) var(--hp-sm);
        display: inline-flex;
        align-items: center;
        gap: var(--hp-xs);
        transition: color var(--hp-duration-fast) var(--hp-ease-default);
      }

      button:hover,
      button:focus-visible {
        color: var(--hp-primary);
      }

      button:focus-visible {
        outline: 2px solid var(--hp-focus-ring);
        outline-offset: 2px;
      }

      /* Icon-only variant — collapse padding around the icon. */
      :host([icon-only]) button {
        padding: var(--hp-xs);
      }

      /* Lucide's copy is designed at 24×24 with stroke-width 2. At
       * 14px display the stroke scales to ~1.17px — render slightly
       * larger to keep the glyph legible next to label-md text. */
      .icon {
        width: 14px;
        height: 14px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
        flex-shrink: 0;
      }
    `,
  ];

  override render(): TemplateResult {
    const iconSvg = html`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      ${unsafeSVG(copyIcon)}
    </svg>`;

    return html`
      <span class=${`toast ${this._copied ? "show" : ""}`} aria-live="polite">
        ${this.copiedLabel}
      </span>
      <button type="button" part="button" aria-label=${this.label} @click=${this._handleClick}>
        ${iconSvg}${this.iconOnly ? "" : this.label}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-copy": HpCopy;
  }
}
