// hp-banner.ts — Inline informational callout.
//
// A non-dismissable inline message used to mark notes, tips,
// warnings, and errors within page content. Visually a tone-coloured
// left accent + tinted background + icon + optional label + slotted
// body. Sibling of hp-toast (which is the transient floating
// notification); hp-banner sits inline with the surrounding flow.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

export type HpBannerTone = "neutral" | "positive" | "warn" | "alert" | "error" | "do" | "dont";

/**
 * Inline callout for notes, tips, warnings, and errors. The `tone`
 * attribute drives both the accent colour and the leading icon;
 * `label` adds an uppercase header above the slotted body.
 *
 * @slot - Banner body content
 *
 * @csspart banner - The wrapping container
 * @csspart icon - The leading icon
 * @csspart label - The uppercase label header (when set)
 */
@customElement("hp-banner")
export class HpBanner extends LitElement {
  /** Semantic tone. `alert` / `error` upgrade role to "alert" for
   * assertive screen-reader announcement. */
  @property({ reflect: true })
  tone: HpBannerTone = "neutral";

  /** Optional uppercase header label (e.g. "Note", "Warning"). */
  @property()
  label?: string;

  override connectedCallback(): void {
    super.connectedCallback();
    const assertive = this.tone === "alert" || this.tone === "error";
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", assertive ? "alert" : "note");
    }
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: block;
        margin: var(--hp-md) 0;
        font-family: var(--hp-typo-body-md-font-family);
        line-height: var(--hp-typo-body-md-line-height);
        color: var(--hp-on-surface);

        /* Default = neutral (tertiary / blue). Per-tone hosts below
 * just rewrite these two custom properties. */
        --hp-banner-accent: var(--hp-tertiary);
        --hp-banner-bg: color-mix(in oklab, var(--hp-tertiary) 12%, var(--hp-surface));
      }

      :host([tone="positive"]) {
        --hp-banner-accent: var(--hp-secondary);
        --hp-banner-bg: color-mix(in oklab, var(--hp-secondary) 12%, var(--hp-surface));
      }

      :host([tone="warn"]) {
        --hp-banner-accent: var(--hp-warn);
        --hp-banner-bg: color-mix(in oklab, var(--hp-warn) 12%, var(--hp-surface));
      }

      :host([tone="alert"]) {
        --hp-banner-accent: var(--hp-alert);
        --hp-banner-bg: color-mix(in oklab, var(--hp-alert) 12%, var(--hp-surface));
      }

      :host([tone="error"]) {
        --hp-banner-accent: var(--hp-error);
        --hp-banner-bg: color-mix(in oklab, var(--hp-error) 12%, var(--hp-surface));
      }

      /* "do" / "dont" — Design-system guidance banners used in
 * Intent docs. Same colour ramp as positive / error so the
 * tone reads at a glance; the icons (circle-check-big and
 * lucide cross, both in the wireframe-stroke aesthetic) make
 * the do/don't pairing visually unambiguous without a text
 * label. */
      :host([tone="do"]) {
        --hp-banner-accent: var(--hp-secondary);
        --hp-banner-bg: color-mix(in oklab, var(--hp-secondary) 12%, var(--hp-surface));
      }

      :host([tone="dont"]) {
        --hp-banner-accent: var(--hp-error);
        --hp-banner-bg: color-mix(in oklab, var(--hp-error) 12%, var(--hp-surface));
      }

      .banner {
        display: flex;
        align-items: center;
        gap: var(--hp-md);
        padding: var(--hp-md);
        border-left: 3px solid var(--hp-banner-accent);
        background: var(--hp-banner-bg);
      }

      .icon {
        flex: 0 0 auto;
        width: 18px;
        height: 18px;
        color: var(--hp-banner-accent);
      }

      .body {
        flex: 1 1 auto;
        min-width: 0;
      }

      .label {
        font-family: var(--hp-typo-label-sm-font-family);
        font-size: var(--hp-typo-label-sm-font-size);
        font-weight: var(--hp-typo-label-sm-font-weight);
        letter-spacing: var(--hp-typo-label-sm-letter-spacing);
        text-transform: uppercase;
        color: var(--hp-banner-accent);
        margin-bottom: var(--hp-xs);
      }

      .prefix {
        font-weight: 700;
        color: var(--hp-banner-accent);
      }

      ::slotted(:first-child) {
        margin-top: 0;
      }

      ::slotted(:last-child) {
        margin-bottom: 0;
      }
    `,
  ];

  private renderIcon() {
    switch (this.tone) {
      case "positive":
        return html`<svg
          class="icon"
          part="icon"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="square"
          aria-hidden="true"
        >
          <polyline points="3 8 7 12 13 4"></polyline>
        </svg>`;
      case "warn":
        return html`<svg
          class="icon"
          part="icon"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="miter"
          aria-hidden="true"
        >
          <polygon points="8 2 14 13 2 13"></polygon>
          <line x1="8" y1="6.5" x2="8" y2="10"></line>
          <circle cx="8" cy="11.5" r="0.6" fill="currentColor" stroke="none"></circle>
        </svg>`;
      case "alert":
        return html`<svg
          class="icon"
          part="icon"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <polygon points="8 1.5 14.5 8 8 14.5 1.5 8"></polygon>
          <line x1="8" y1="5" x2="8" y2="9"></line>
          <circle cx="8" cy="11" r="0.6" fill="currentColor" stroke="none"></circle>
        </svg>`;
      case "error":
        return html`<svg
          class="icon"
          part="icon"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6.5"></circle>
          <line x1="5" y1="5" x2="11" y2="11"></line>
          <line x1="11" y1="5" x2="5" y2="11"></line>
        </svg>`;
      case "do":
        // lucide circle-check-big adapted to hexpunk wireframe:
        // stroke-only, square caps + miter joins so the check
        // terminates on flat angles like hp-checkbox's tick.
        return html`<svg
          class="icon"
          part="icon"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="square"
          stroke-linejoin="miter"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6.5"></circle>
          <polyline points="5,8 7,10 11,6"></polyline>
        </svg>`;
      case "dont":
        // lucide cross (X) adapted with the same wireframe
        // aesthetic. No circle — paired with circle-check-big the
        // visual asymmetry leans into the don't-do-this read.
        return html`<svg
          class="icon"
          part="icon"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="square"
          stroke-linejoin="miter"
          aria-hidden="true"
        >
          <line x1="5" y1="5" x2="11" y2="11"></line>
          <line x1="11" y1="5" x2="5" y2="11"></line>
        </svg>`;
      default:
        return html`<svg
          class="icon"
          part="icon"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6.5"></circle>
          <line x1="8" y1="7" x2="8" y2="11.5"></line>
          <circle cx="8" cy="4.8" r="0.6" fill="currentColor" stroke="none"></circle>
        </svg>`;
    }
  }

  private renderPrefix() {
    // do / dont tones inline a "Do — " / "Don't — " lede so consumers
    // don't have to repeat it in every banner body. Rendered as real
    // text in shadow DOM (not a ::before pseudo) so browser
    // translators and screen readers pick it up alongside the body.
    if (this.tone === "do") {
      return html`<strong class="prefix" part="prefix">Do — </strong>`;
    }
    if (this.tone === "dont") {
      return html`<strong class="prefix" part="prefix">Don't — </strong>`;
    }
    return "";
  }

  override render() {
    return html`
      <div class="banner" part="banner">
        ${this.renderIcon()}
        <div class="body">
          ${this.label ? html`<div class="label" part="label">${this.label}</div>` : ""}
          ${this.renderPrefix()}<slot></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-banner": HpBanner;
  }
}
