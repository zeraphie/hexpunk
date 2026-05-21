// hp-navigation-menu.ts — Top-nav with hover-revealed submenus.
//
// Horizontal navigation pattern with triggers that reveal richer
// content panels on hover / focus — the marketing-site nav style.
//
// at a time" mode. Composition:
//
// <hp-navigation-menu>
// <hp-nav-item href="/about">About</hp-nav-item>
// <hp-nav-item>
// Components
// <div slot="content">
// <a href="/buttons">Buttons</a>
// <a href="/inputs">Inputs</a>
// </div>
// </hp-nav-item>
// </hp-navigation-menu>
//
// Items with no `content` slot are plain links. Items with content
// show the slotted panel on hover / focus; click on the trigger
// also toggles. role="menubar" / role="menuitem" provide the
// semantics; arrow keys move between top-level triggers.

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Top-nav menu with optional hover-revealed submenus.
 *
 * @slot - hp-nav-item children
 */
@customElement("hp-navigation-menu")
export class HpNavigationMenu extends LitElement {
  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "menubar");
    }
    this.addEventListener("keydown", this.handleKeyDown);
  }

  private getItems(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(":scope > hp-nav-item"));
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    const items = this.getItems();
    if (items.length === 0) {
      return;
    }
    const focused = document.activeElement as HTMLElement | null;
    const idx = items.findIndex((i) => i === focused || i.contains(focused));
    if (idx === -1) {
      return;
    }
    let next: number | null = null;
    if (event.key === "ArrowRight") {
      next = idx >= items.length - 1 ? 0 : idx + 1;
    } else if (event.key === "ArrowLeft") {
      next = idx <= 0 ? items.length - 1 : idx - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = items.length - 1;
    }
    if (next === null) {
      return;
    }
    event.preventDefault();
    items[next]?.focus();
  };

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-flex;
        align-items: stretch;
        gap: 0;
        line-height: var(--hp-typo-body-md-line-height);
      }
    `,
  ];

  override render() {
    return html`<slot></slot>`;
  }
}

/**
 * Single item inside hp-navigation-menu. Plain link when no `content`
 * slot, dropdown trigger when there is one.
 *
 * @slot - The trigger label / link text
 * @slot content - Optional submenu body (revealed on hover / focus)
 *
 * @csspart trigger - The trigger element
 * @csspart panel - The submenu panel (when content is provided)
 */
@customElement("hp-nav-item")
export class HpNavItem extends LitElement {
  /** Destination URL when no submenu is provided — turns the
   * trigger into a plain link. */
  @property()
  href?: string;

  @state() private hasContent = false;
  @state() private isOpen = false;

  private openTimer: number | null = null;
  private closeTimer: number | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "menuitem");
    }
    if (!this.hasAttribute("tabindex")) {
      this.setAttribute("tabindex", "0");
    }
    this.addEventListener("mouseenter", this.handleEnter);
    this.addEventListener("mouseleave", this.handleLeave);
    this.addEventListener("focusin", this.handleEnter);
    this.addEventListener("focusout", this.handleLeave);
    this.addEventListener("click", this.handleClick);
    this.addEventListener("keydown", this.handleKeyDown);
  }

  private clearTimers(): void {
    if (this.openTimer !== null) {
      window.clearTimeout(this.openTimer);
      this.openTimer = null;
    }
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  private handleSlotChange = (): void => {
    const hasContent = this.querySelector(':scope > [slot="content"]') !== null;
    if (hasContent !== this.hasContent) {
      this.hasContent = hasContent;
    }
  };

  private handleEnter = (): void => {
    if (!this.hasContent) {
      return;
    }
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    if (this.isOpen) {
      return;
    }
    this.openTimer = window.setTimeout(() => {
      this.openTimer = null;
      this.isOpen = true;
    }, 120);
  };

  private handleLeave = (): void => {
    if (!this.hasContent) {
      return;
    }
    if (this.openTimer !== null) {
      window.clearTimeout(this.openTimer);
      this.openTimer = null;
    }
    if (!this.isOpen) {
      return;
    }
    this.closeTimer = window.setTimeout(() => {
      this.closeTimer = null;
      this.isOpen = false;
    }, 200);
  };

  private handleClick = (event: MouseEvent): void => {
    if (this.hasContent) {
      // Don't follow a link when there's a submenu — clicking
      // toggles the panel.
      event.preventDefault();
      this.isOpen = !this.isOpen;
      return;
    }
    if (this.href) {
      window.location.href = this.href;
    }
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.isOpen) {
      this.isOpen = false;
      this.focus();
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && !this.hasContent) {
      if (this.href) {
        event.preventDefault();
        window.location.href = this.href;
      }
    }
  };

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.clearTimers();
  }

  static override styles = [
    hpBase,
    css`
      :host {
        position: relative;
        display: inline-block;
        padding: var(--hp-sm) var(--hp-md);
        cursor: pointer;
        color: var(--hp-on-surface-variant);
        font-family: var(--hp-typo-label-md-font-family);
        font-size: var(--hp-typo-label-md-font-size);
        letter-spacing: var(--hp-typo-label-md-letter-spacing);
        line-height: var(--hp-typo-label-md-line-height);
        text-transform: uppercase;
        transition: color var(--hp-duration-fast) var(--hp-ease-default);
        user-select: none;
      }

      :host(:hover),
      :host(:focus-visible) {
        color: var(--hp-primary);
        outline: none;
      }

      :host(:focus-visible) {
        outline: 2px solid var(--hp-focus-ring);
        outline-offset: 2px;
      }

      .panel {
        position: absolute;
        top: 100%;
        left: 0;
        min-width: 240px;
        margin-top: 4px;
        background: var(--hp-surface-container-high);
        border: 1px solid var(--hp-outline-variant);
        padding: var(--hp-md);
        color: var(--hp-on-surface);
        font-family: var(--hp-typo-body-sm-font-family);
        font-size: var(--hp-typo-body-sm-font-size);
        letter-spacing: normal;
        text-transform: none;
        line-height: var(--hp-typo-body-sm-line-height);
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--hp-duration-fast) var(--hp-ease-default);
      }

      .panel.open {
        opacity: 1;
        pointer-events: auto;
      }
    `,
  ];

  override render() {
    return html`
      <span part="trigger">
        <slot @slotchange=${this.handleSlotChange}></slot>
      </span>
      <div class=${`panel ${this.isOpen ? "open" : ""}`} part="panel" ?hidden=${!this.hasContent}>
        <slot name="content" @slotchange=${this.handleSlotChange}></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-navigation-menu": HpNavigationMenu;
    "hp-nav-item": HpNavItem;
  }
}
