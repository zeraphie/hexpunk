// hp-link.ts — Inline text link.
//
// Styled anchor with the system's hue-swap. Reads as a regular text
// link (underline at rest, hover swaps to secondary) — distinct from
// hp-tether (arc between hexes) and from hp-cell variant="action" /
// hp-button (block-level interactive hex).
//
// Wraps a native `<a>` so consumers get accessibility, middle-click,
// keyboard activation, and prefetch behaviour for free. The slot
// receives the link label.

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Inline text link. Styled anchor with the hexpunk hue-swap.
 *
 * @slot - Link label
 */
@customElement("hp-link")
export class HpLink extends LitElement {
  /** Destination URL. */
  @property()
  href = "";

  /** Optional anchor target — `_blank`, `_self`, etc. When `_blank`,
   * `rel="noopener"` is appended automatically. */
  @property()
  target?: string;

  /** Optional `rel` override. With `target="_blank"` the component
   * defaults to `noopener` — set this prop to extend / override. */
  @property()
  rel?: string;

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline;
        line-height: inherit;
      }

      a {
        color: var(--hp-primary);
        text-decoration: none;
        border-bottom: 1px solid currentColor;
        transition: color var(--hp-duration-medium) var(--hp-ease-default);
      }

      a:hover,
      a:focus-visible {
        color: var(--hp-secondary);
      }

      a:focus-visible {
        outline: 2px solid var(--hp-focus-ring);
        outline-offset: 2px;
        border-radius: 1px;
      }

      @media (forced-colors: active) {
        a {
          color: LinkText;
        }
      }
    `,
  ];

  override render() {
    const rel = this.target === "_blank" ? (this.rel ?? "noopener") : this.rel;
    return html`
      <a href=${this.href} target=${this.target ?? nothing} rel=${rel ?? nothing}>
        <slot></slot>
      </a>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-link": HpLink;
  }
}
