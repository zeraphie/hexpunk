// hp-code.ts — Code-block primitive.
//
// Displays a snippet of code in monospace with optional line numbers
// and per-line hover highlighting. Tokenisation (syntax highlighting)
// is a consumer concern: hp-code ships no bundled tokeniser. A
// consumer that wants colours installs a library of their choice
// (highlight.js, Shiki, Prism, …) and registers an adapter once at
// startup via `HpCode.setHighlighter(...)`.
//
// The shipped default theme maps highlight.js's standard `.hljs-*`
// class names to hexpunk tokens so consumers picking highlight.js
// get a themed result with zero CSS work. Consumers using other
// tokenisers can override these rules or write their own.

import { LitElement, css, html, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { hpBase } from "../../styles/hp-base.js";
// Side-effect import — guarantees hp-separator is registered
// whenever hp-code is loaded, since the gutter divider uses it.
import "../layout/hp-separator.js";

/** Signature for a consumer-registered tokeniser. Return an HTML
 * string (with token-class spans), null to skip highlighting for
 * this snippet, or a Promise resolving to either.
 *
 * The `element` argument is the hp-code instance that requested the
 * tokenisation — handy for reading the effective theme at its
 * position in the tree (e.g. `getComputedStyle(el).getPropertyValue(
 * "--hp-theme-name")`), which may differ from the site-level theme
 * when an ancestor (like hp-demo) sets a local override. */
export type HpCodeHighlighter = (
  code: string,
  language: string,
  element?: HTMLElement
) => string | null | Promise<string | null>;

function escapeHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Strip leading blank lines + trailing whitespace, then remove the
 * minimum common indentation so authors can indent their snippets
 * naturally inside their markup without it showing as extra padding
 * in the rendered block. */
function dedent(code: string): string {
  const trimmed = code.replace(/^[\n\r]+/, "").replace(/\s+$/, "");
  if (!trimmed) {
    return "";
  }
  const lines = trimmed.split("\n");
  const indents = lines
    .filter((l) => l.trim().length > 0)
    .map((l) => /^(\s*)/.exec(l)?.[1].length ?? 0);
  const min = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min)).join("\n");
}

/**
 * Monospaced code block with optional line numbers and per-line
 * hover highlighting. Syntax highlighting is opt-in via
 * `HpCode.setHighlighter(...)`.
 *
 * @slot - Raw code text (whitespace preserved after a dedent pass)
 * @cssproperty --hp-code-background - Override the block background
 * @csspart pre - The internal <pre> element
 * @csspart code - The internal <code> element
 */
@customElement("hp-code")
export class HpCode extends LitElement {
  /** Currently-registered tokeniser, or null for plain monospace. */
  static highlighter: HpCodeHighlighter | null = null;

  /** Register a tokeniser globally. Pass null to clear. Connected
   * hp-code instances re-tokenise automatically when this changes. */
  static setHighlighter(fn: HpCodeHighlighter | null): void {
    HpCode.highlighter = fn;
    document.querySelectorAll<HpCode>("hp-code").forEach((el) => el.tokenize());
  }

  /** Language hint passed to the tokeniser (e.g. "typescript"). */
  @property({ type: String }) language = "";

  /** Hide the line-number gutter. */
  @property({ type: Boolean, attribute: "no-line-numbers", reflect: true })
  noLineNumbers = false;

  @state() private _source = "";
  @state() private _highlighted: string | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this._source = dedent(this.textContent ?? "");
    void this.tokenize();
  }

  async tokenize(): Promise<void> {
    if (!HpCode.highlighter || !this.language) {
      this._highlighted = null;
      return;
    }
    try {
      const result = HpCode.highlighter(this._source, this.language, this);
      const resolved = result instanceof Promise ? await result : result;
      this._highlighted = resolved ?? null;
    } catch (err) {
      console.warn("hp-code: highlighter threw, falling back to plain", err);
      this._highlighted = null;
    }
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: block;
        width: 100%;
        box-sizing: border-box;
        /* When used as a flex item (e.g. inside hp-demo's preview
 * area which uses flex + wrap), claim a full row so siblings
 * wrap onto adjacent rows rather than fighting for space. */
        flex: 1 0 100%;
        line-height: var(--hp-typo-mono-sm-line-height);
        font-family: var(--hp-typo-mono-sm-font-family);
        font-size: var(--hp-typo-mono-sm-font-size);
        font-weight: var(--hp-typo-mono-sm-font-weight);
        /* Force whitespace preservation through the entire subtree.
 * The per-line .content span sets pre too, but setting it
 * here guarantees the cascade reaches every leaf text node
 * regardless of any intermediate-wrapper resets. */
        white-space: pre;
        tab-size: 2;
        -moz-tab-size: 2;
      }

      pre {
        margin: 0;
        padding: var(--hp-sm) 0;
        background: var(--hp-code-background, var(--hp-surface-container-lowest));
        border: 1px solid var(--hp-outline-faint);
        overflow-x: auto;
        color: var(--hp-on-surface);
      }

      code {
        display: block;
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
      }

      .row {
        display: grid;
        grid-template-columns: 3ch auto 1fr;
        gap: var(--hp-xs);
        padding: 0 var(--hp-md);
        transition: background var(--hp-duration-fast) var(--hp-ease-default);
      }

      .row:hover {
        background: var(--hp-surface-container);
      }

      :host([no-line-numbers]) .row {
        grid-template-columns: 1fr;
      }

      :host([no-line-numbers]) .ln,
      :host([no-line-numbers]) hp-separator {
        display: none;
      }

      .ln {
        color: var(--hp-on-surface-variant);
        text-align: right;
        user-select: none;
      }

      /* Alternating dim on even rows gives a subtle reading-stripe
 * for line-tracking without competing with the code itself. */
      .row:nth-child(even) .ln {
        opacity: 0.55;
      }

      .content {
        white-space: pre;
      }

      /* highlight.js default token mapping — consumers using
 * highlight.js get a hexpunk-themed result with zero extra
 * CSS. Other tokenisers (Shiki, Prism) emit different class
 * names; consumers can override these rules or write their
 * own theme. */
      .hljs-keyword,
      .hljs-tag,
      .hljs-name,
      .hljs-selector-tag,
      .hljs-link {
        color: var(--hp-primary);
      }

      .hljs-built_in,
      .hljs-type,
      .hljs-attr,
      .hljs-attribute,
      .hljs-property,
      .hljs-title.class_,
      .hljs-title.function_ {
        color: var(--hp-tertiary);
      }

      .hljs-string,
      .hljs-regexp,
      .hljs-addition {
        color: var(--hp-secondary);
      }

      .hljs-number,
      .hljs-literal,
      .hljs-symbol,
      .hljs-bullet {
        color: var(--hp-warn);
      }

      .hljs-comment,
      .hljs-quote,
      .hljs-meta {
        color: var(--hp-on-surface-variant);
        font-style: italic;
      }

      .hljs-deletion {
        color: var(--hp-error);
      }
    `,
  ];

  override render(): TemplateResult {
    const source = this._highlighted ?? escapeHtml(this._source);
    const lines = source.split("\n");
    return html`<pre part="pre"><code part="code">${lines.map(
      (line, i) =>
        html`<span class="row"
          ><span class="ln" aria-hidden="true">${i + 1}</span
          ><hp-separator orientation="vertical" mark="none" decorative></hp-separator
          ><span class="content">${unsafeHTML(line || "&nbsp;")}</span></span
        >`
    )}</code></pre>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-code": HpCode;
  }
}
