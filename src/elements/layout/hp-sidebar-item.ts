// hp-sidebar-item.ts — Leaf nav entry inside an hp-sidebar.
//
// Renders a single anchor with the sidebar's link styling. Set
// `href` to the destination URL and `active` (boolean attribute) to
// mark it as the current page. The label is the slotted text
// content. Pair with hp-sidebar-group for collapsible sections.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Leaf navigation entry inside `<hp-sidebar>`. The slotted text
 * content is the visible label.
 *
 * @slot - Label text
 * @csspart link - The internal anchor element
 */
@customElement("hp-sidebar-item")
export class HpSidebarItem extends LitElement {
  /** Destination URL. */
  @property({ type: String }) href = "";

  /** Currently-active page; applies the active highlight. */
  @property({ type: Boolean, reflect: true }) active = false;

  static override styles = [
    hpBase,
    css`
      :host {
        display: block;
        font-size: var(--hp-typo-body-sm-font-size);
        font-family: var(--hp-typo-body-sm-font-family);
        line-height: var(--hp-typo-body-sm-line-height);
      }

      a {
        display: block;
        padding: var(--hp-xs) var(--hp-sm);
        color: var(--hp-on-surface-variant);
        text-decoration: none;
        border-left: 2px solid transparent;
        transition:
          color var(--hp-duration-fast) var(--hp-ease-default),
          background var(--hp-duration-fast) var(--hp-ease-default);
      }

      a:hover,
      :host([active]) a {
        color: var(--hp-primary);
        background: var(--hp-surface-container);
        border-left-color: var(--hp-primary);
      }
    `,
  ];

  override render() {
    return html`<a href=${this.href} part="link"><slot></slot></a>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-sidebar-item": HpSidebarItem;
  }
}
