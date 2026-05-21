// hp-demo.ts — Documentation demo wrapper.
//
// The standard envelope for a single demo on a component doc page:
// a preview area (slot for the rendered element on a solid recessed
// canvas) + an action bar + a code area (slot for the source
// snippet).
// code" pair, hex-flavoured but with an opaque surface — the
// document-level hp-background is the page chrome, not a per-demo
// effect, so the preview area stays a clean canvas distinct from
// the surrounding page.
//
// Authoring:
//
// <hp-demo>
// <hp-button>Click me</hp-button>
//
// <pre slot="code"><code>&lt;hp-button&gt;Click me&lt;/hp-button&gt;</code></pre>
// </hp-demo>
//
// Multiple foreground elements can sit in the default slot — they
// flow horizontally inside the preview. The code slot is a separate
// area below; clicking "Copy code" reads its textContent and pushes
// to the clipboard.
//
// The preview backdrop is an hp-background (faint hex grid that
// brightens around the pointer). Default `pointer-radius` is small
// so the brightening reads as ambient texture rather than dominant.

import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";
// Inline-imported token stylesheets so they can be adopted into
// hp-demo's shadow root. Without this, the document-level
// `[data-theme="light"]` / `[data-theme="dark"]` rules in
// tokens.{light,dark}.css can't reach the `.preview` div inside the
// shadow tree — toggling the local theme would have no visible
// effect. Adopting them in shadow scopes the override to the preview
// subtree only, leaving the chrome (caption / actions / code) on the
// page theme.
import lightTokens from "../../tokens/tokens.light.css?inline";
import darkTokens from "../../tokens/tokens.dark.css?inline";

const previewThemeSheet = new CSSStyleSheet();
previewThemeSheet.replaceSync(`${lightTokens}\n${darkTokens}`);

/**
 * Documentation example envelope. Hex-pattern preview area + code
 * area + Copy code button. Wraps each example on a component doc
 * page.
 *
 * @slot - Rendered demo element(s) (the foreground)
 * @slot code - <pre><code> block showing the source
 *
 * @csspart caption - The caption strip (when set)
 * @csspart preview - The preview area with backdrop
 * @csspart actions - The footer toolbar with the Copy button
 * @csspart code - The code area
 */
@customElement("hp-demo")
export class HpDemo extends LitElement {
  /** Optional caption shown above the demo (e.g., "Default", "Sizes",
   * "Active state"). Leave empty for a bare envelope. */
  @property()
  caption?: string;

  /** Suppress the Copy code button. */
  @property({ reflect: true, type: Boolean, attribute: "no-copy" })
  noCopy = false;

  /** Suppress the per-demo theme toggle. */
  @property({ reflect: true, type: Boolean, attribute: "no-theme-toggle" })
  noThemeToggle = false;

  @state() private copiedToast = false;

  /** Explicit theme override applied to the preview area only.
   * `null` = inherit from the page-level <html data-theme=…>. */
  @state() private previewTheme: "light" | "dark" | null = null;

  private get effectivePreviewTheme(): "light" | "dark" {
    if (this.previewTheme) {
      return this.previewTheme;
    }
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }

  private handleThemeClick = (): void => {
    this.previewTheme = this.effectivePreviewTheme === "light" ? "dark" : "light";
  };

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("previewTheme")) {
      // Re-tokenise any hp-code descendants so their Shiki output
      // picks the matching theme variant for the new local override.
      // Slotted hp-code instances are still children of `this` in
      // light DOM, so querySelectorAll reaches them. The highlighter
      // reads the element's computed style to determine theme, which
      // now reflects the just-updated preview attribute.
      this.querySelectorAll<HTMLElement & { tokenize?: () => unknown }>("hp-code").forEach(
        (code) => {
          code.tokenize?.();
        }
      );
    }
  }

  private siteThemeObserver: MutationObserver | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    // Reset the local preview override whenever the site theme
    // changes — clicking the page-level light/dark toggle should
    // "reset" each demo back to inheriting, so it follows the new
    // site theme until the user explicitly clicks the demo toggle
    // again.
    this.siteThemeObserver = new MutationObserver(() => {
      this.previewTheme = null;
    });
    this.siteThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.siteThemeObserver?.disconnect();
    this.siteThemeObserver = null;
  }

  private handleCopyClick = async (): Promise<void> => {
    const codeSlot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="code"]');
    if (!codeSlot) {
      return;
    }
    const nodes = codeSlot.assignedNodes({ flatten: true });
    const text = nodes
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      this.copiedToast = true;
      window.setTimeout(() => {
        this.copiedToast = false;
      }, 1600);
    } catch {
      // Clipboard API may be unavailable (non-secure context, blocked
      // permissions) — silently skip; consumers can still copy
      // manually from the visible code area.
    }
  };

  static override styles = [
    hpBase,
    previewThemeSheet,
    css`
      :host {
        display: block;
        border: 1px solid var(--hp-outline-faint);
        background: var(--hp-surface);
        font-family: var(--hp-typo-body-md-font-family);
        line-height: var(--hp-typo-body-md-line-height);
        margin: var(--hp-md) 0;
        /* Communicate the preview surface tone to slotted descendants
 * via --hp-canvas. hp-hex's inner polygon defaults to this
 * so unfilled hexes (e.g. inactive toggle buttons) match the
 * preview background instead of the page background. Set on
 * :host so slotted content inherits via the LIGHT-DOM parent
 * chain — setting it on the shadow-DOM .preview wouldn't
 * reach the slotted children. */
        --hp-canvas: var(--hp-surface-container-lowest);
      }

      .caption {
        font-family: var(--hp-typo-label-sm-font-family);
        font-size: var(--hp-typo-label-sm-font-size);
        font-weight: var(--hp-typo-label-sm-font-weight);
        letter-spacing: var(--hp-typo-label-sm-letter-spacing);
        color: var(--hp-on-surface-variant);
        text-transform: uppercase;
        padding: var(--hp-sm) var(--hp-md);
        background: var(--hp-surface-container-high);
        border-bottom: 1px solid var(--hp-outline-faint);
      }

      .preview {
        position: relative;
        min-height: 96px;
        padding: var(--hp-lg);
        display: flex;
        flex-wrap: wrap;
        gap: var(--hp-md);
        align-items: center;
        background: var(--hp-surface-container-lowest);
      }

      .actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--hp-sm);
        padding: var(--hp-xs) var(--hp-md);
        border-top: 1px solid var(--hp-outline-faint);
        background: var(--hp-surface-container);
        font-family: var(--hp-typo-label-sm-font-family);
        font-size: var(--hp-typo-label-sm-font-size);
        letter-spacing: var(--hp-typo-label-sm-letter-spacing);
        text-transform: uppercase;
        color: var(--hp-on-surface-variant);
      }

      .copy,
      .theme {
        background: transparent;
        border: 1px solid transparent;
        color: var(--hp-on-surface-variant);
        cursor: pointer;
        padding: var(--hp-xs) var(--hp-sm);
        display: inline-flex;
        align-items: center;
        gap: var(--hp-xs);
        font: inherit;
        letter-spacing: inherit;
        text-transform: inherit;
        transition: color var(--hp-duration-fast) var(--hp-ease-default);
      }

      /* Theme toggle sits left; copy + its toast cluster right. The
 * auto margin pushes everything after the toggle to the
 * far edge — keeps the "copied" flash from drifting around. */
      .theme {
        margin-right: auto;
      }

      .copy:hover,
      .copy:focus-visible,
      .theme:hover,
      .theme:focus-visible {
        color: var(--hp-primary);
      }

      .copy:focus-visible,
      .theme:focus-visible {
        outline: 2px solid var(--hp-focus-ring);
        outline-offset: 2px;
      }

      .copy svg,
      .theme svg {
        width: 12px;
        height: 12px;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: square;
        stroke-linejoin: miter;
        fill: none;
      }

      .toast {
        color: var(--hp-secondary);
        opacity: 0;
        transition: opacity var(--hp-duration-medium) var(--hp-ease-default);
      }

      .toast.show {
        opacity: 1;
      }

      .code {
        border-top: 1px solid var(--hp-outline-faint);
        background: var(--hp-surface-container-lowest);
      }

      /* Legacy chrome for raw <pre slot="code"><code>…</code></pre>.
 * hp-code provides its own chrome internally so it's exempted
 * via the more-specific rule below. */
      ::slotted([slot="code"]) {
        display: block;
        margin: 0;
        padding: var(--hp-md);
        font-family: var(--hp-typo-mono-sm-font-family);
        font-size: var(--hp-typo-mono-sm-font-size);
        line-height: var(--hp-typo-mono-sm-line-height);
        color: var(--hp-on-surface);
        overflow-x: auto;
        white-space: pre;
      }

      ::slotted(hp-code[slot="code"]) {
        padding: 0;
        overflow-x: visible;
      }
    `,
  ];

  override render() {
    const effective = this.effectivePreviewTheme;
    return html`
      ${this.caption ? html`<div class="caption" part="caption">${this.caption}</div>` : ""}
      <div class="preview" part="preview" data-theme=${this.previewTheme ?? nothing}>
        <slot></slot>
      </div>
      <div class="actions" part="actions">
        ${this.noThemeToggle
          ? ""
          : html`
              <button
                class="theme"
                type="button"
                aria-label=${`Switch preview to ${effective === "light" ? "dark" : "light"} theme`}
                @click=${this.handleThemeClick}
              >
                ${effective === "light"
                  ? html`<svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="4"></circle>
                      <path d="M12 2v2"></path>
                      <path d="M12 20v2"></path>
                      <path d="m4.93 4.93 1.41 1.41"></path>
                      <path d="m17.66 17.66 1.41 1.41"></path>
                      <path d="M2 12h2"></path>
                      <path d="M20 12h2"></path>
                      <path d="m6.34 17.66-1.41 1.41"></path>
                      <path d="m19.07 4.93-1.41 1.41"></path>
                    </svg>`
                  : html`<svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>`}
                ${effective}
              </button>
            `}
        <span class=${`toast ${this.copiedToast ? "show" : ""}`} aria-live="polite"> copied </span>
        ${this.noCopy
          ? ""
          : html`
              <button
                class="copy"
                type="button"
                aria-label="Copy code"
                @click=${this.handleCopyClick}
              >
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <rect x="3.5" y="3.5" width="6" height="6"></rect>
                  <path d="M2.5 8.5 V2.5 H8.5"></path>
                </svg>
                copy code
              </button>
            `}
      </div>
      <div class="code" part="code">
        <slot name="code"></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-demo": HpDemo;
  }
}
