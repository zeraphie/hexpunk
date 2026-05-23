// hp-latex.ts — LaTeX math primitive.
//
// Renders LaTeX math expressions via a consumer-registered engine.
// Hexpunk ships no math engine — the consumer installs KaTeX (or
// MathJax / Temml / custom) and registers an adapter once at startup
// via `HpLatex.setRenderer(...)`. Without a registered renderer, the
// element renders the raw LaTeX source in mono-spaced text as a
// deliberate fallback (mirrors hp-code's "no tokeniser → plain mono
// text" behaviour).
//
// LIGHT-DOM element. `createRenderRoot()` returns `this`, so rendered
// math sits in the document's light DOM where the consumer's global
// `katex.min.css` cascades into it naturally. KaTeX outputs HTML
// scoped by .katex / .katex-mathml / .katex-html classes and depends
// on ~2000 lines of CSS + @font-face rules to render correctly;
// shadow-DOM encapsulation would block that. This is the only
// light-DOM hp-* element in the system — the deviation is
// intentional. As a consequence: not SSR-friendly via @lit-labs/ssr
// (which only serializes shadow DOM). Consumers wanting build-time
// pre-rendered math in MDX use Astro's remark-math + rehype-katex
// independently of hp-latex.
//
// Consumer imports:
//
//   import "@hexpunk/core/hp-latex.css";  // element chrome
//   import "katex/dist/katex.min.css";    // engine CSS
//   import katex from "katex";
//   import { HpLatex } from "@hexpunk/core";
//   HpLatex.setRenderer((latex, mode) =>
//     katex.renderToString(latex, {
//       displayMode: mode === "block",
//       throwOnError: false,
//     })
//   );

import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

// Side-effect import — hp-background may be rendered as a backdrop
// when both `block` and `background` attributes are set.
import "../layout/hp-background.js";

/** Signature for a consumer-registered renderer. Return an HTML
 * string (the renderer's output), or `null` to fall back to the
 * mono-spaced source rendering for this snippet.
 *
 * Constrained to `string | null` (not `HTMLElement`) so the
 * signature suits any engine that produces HTML text. KaTeX's
 * `renderToString` is the natural fit. */
export type HpLatexRenderer = (latex: string, displayMode: "inline" | "block") => string | null;

/**
 * LaTeX math primitive. Render-only.
 *
 * The LaTeX source comes from the `value` attribute or the element's
 * text content (attribute wins when both are present). Consumers
 * register a renderer once at startup via `HpLatex.setRenderer(...)`.
 *
 * @property value - LaTeX source string
 * @property block - Switch to block (display) mode (default: inline)
 * @property background - Mount an hp-background backdrop (block-mode only)
 * @fires render-error - Bubbling CustomEvent when the renderer throws; detail = { error, latex }
 */
@customElement("hp-latex")
export class HpLatex extends LitElement {
  /** Currently-registered renderer, or null for source fallback. */
  static renderer: HpLatexRenderer | null = null;

  /** Register the renderer globally. Pass null to clear. Connected
   * hp-latex instances re-render automatically when this changes. */
  static setRenderer(fn: HpLatexRenderer | null): void {
    HpLatex.renderer = fn;
    if (typeof document !== "undefined") {
      document.querySelectorAll<HpLatex>("hp-latex").forEach((el) => el.requestUpdate());
    }
  }

  /** LaTeX source. Wins over text content when both are set. */
  @property({ type: String }) value = "";

  /** Block (display) mode. Default off → inline. */
  @property({ type: Boolean, reflect: true }) block = false;

  /** Mount an hp-background backdrop. Only effective in block mode. */
  @property({ type: Boolean, reflect: true }) background = false;

  /** Light-DOM render root — see file header for rationale. */
  override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Capture text-content source once on connect, before Lit's
    // light-DOM render() destroys it. After this, this.value is
    // the canonical source for re-renders.
    if (!this.value) {
      const text = this.textContent?.trim();
      if (text) {
        this.value = text;
      }
    }
  }

  override render(): TemplateResult | typeof nothing {
    const source = this.value;
    if (!source) {
      return nothing;
    }

    const renderer = HpLatex.renderer;
    const wantsBackdrop = this.block && this.background;
    const backdrop = wantsBackdrop
      ? html`<hp-background class="hp-latex-backdrop"></hp-background>`
      : nothing;

    if (renderer) {
      try {
        const result = renderer(source, this.block ? "block" : "inline");
        if (typeof result === "string") {
          return html`${backdrop}${unsafeHTML(result)}`;
        }
        // null → fall through to source fallback
      } catch (err) {
        this.dispatchEvent(
          new CustomEvent("render-error", {
            detail: { error: err, latex: source },
            bubbles: true,
            composed: true,
          })
        );
        // Fall through to source fallback
      }
    }

    return html`${backdrop}<span class="hp-latex-source">${source}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-latex": HpLatex;
  }
}
