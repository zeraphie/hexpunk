// hp-sidebar.ts — Navigation sidebar chrome.
//
// Wraps a composed tree of `<hp-sidebar-item>` and `<hp-sidebar-group>`
// children with the sticky padding, border, scroll behaviour, and
// inherited typography. Each child element owns its own visual
// identity inside its shadow root — this component is pure chrome.
//
// Auto-stamps `role="navigation"` for landmark semantics; consumers
// should pass `aria-label` explicitly (e.g. "Site map") so screen
// readers announce a labelled landmark.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

export type HpSidebarVariant = "primary" | "secondary";

/**
 * Navigation sidebar chrome. Compose with `<hp-sidebar-item>` leaves
 * and `<hp-sidebar-group>` collapsible sections.
 *
 * @slot - Nav tree (hp-sidebar-item + hp-sidebar-group children)
 */
@customElement("hp-sidebar")
export class HpSidebar extends LitElement {
  /** Visual variant.
   *
   * - `"primary"` (default): full chrome with a right border.
   * Intended as the page's main nav rail on the left.
   * - `"secondary"`: lighter chrome, no right border. Intended for
   * a right-rail table-of-contents or similar companion list. */
  @property({ reflect: true })
  variant: HpSidebarVariant = "primary";

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "navigation");
    }
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: block;
        padding: var(--hp-md) var(--hp-sm) var(--hp-md) var(--hp-md);
        border-right: 1px solid var(--hp-outline-faint);
        font-size: var(--hp-typo-body-sm-font-size);
        font-family: var(--hp-typo-body-sm-font-family);
        /* Override hpBase's line-height: 0 (used to kill the baseline
 * descender on hex atoms). The sidebar contains real text so
 * its children need a sensible default; descendants inherit. */
        line-height: var(--hp-typo-body-sm-line-height);
        /* Stick to the top of the viewport (or beneath a fixed
 * navbar via --hp-navbar-height) so the rail stays put while
 * main scrolls. Long sidebars get their own internal scroll
 * via max-height + overflow. */
        position: sticky;
        top: var(--hp-navbar-height, 0px);
        align-self: start;
        max-height: calc(100vh - var(--hp-navbar-height, 0px));
        overflow-y: auto;
      }

      /* Secondary rail: companion list (TOC, etc.) on the opposite
 * side. No right border (sits at the viewport's reading edge),
 * uniform padding. */
      :host([variant="secondary"]) {
        border-right: none;
        padding: var(--hp-md);
      }

      @media (max-width: 640px) {
        :host {
          border-right: none;
          border-bottom: 1px solid var(--hp-outline-faint);
          padding: var(--hp-md) var(--hp-xl);
          /* No sticky on small viewports — the stacked layout means
 * each rail is just a horizontal strip; sticky there would
 * lock a band onto the viewport unhelpfully. */
          position: static;
          max-height: none;
        }
      }
    `,
  ];

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-sidebar": HpSidebar;
  }
}
