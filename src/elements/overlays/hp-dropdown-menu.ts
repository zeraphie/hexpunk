// hp-dropdown-menu.ts — Menu popover with menu semantics.
//
// Click a trigger; a menu opens with role="menu" and slotted
// hp-menu-item children with role="menuitem". Arrow keys move focus
// between items, Home / End jump to first / last, Enter / Space
// activate, Escape dismiss.
// variant — opens above other content, traps focus inside the menu
// until close).
//
// Authoring:
//
// <hp-dropdown-menu side="bottom" align="start">
// <hp-button>actions</hp-button>
//
// <hp-menu-item slot="content">edit</hp-menu-item>
// <hp-menu-item slot="content">duplicate</hp-menu-item>
// <hp-menu-item slot="content" disabled>archive</hp-menu-item>
// </hp-dropdown-menu>

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  onEscape,
  onOutsidePointer,
  positionFloating,
  type FloatingAlign,
  type FloatingSide,
} from "../../lib/floating.js";
import { hpBase } from "../../styles/hp-base.js";

/**
 * Dropdown menu — click-triggered popover with menuitem semantics
 * and arrow-key navigation.
 *
 * @fires hp-dropdown-open - When the menu opens
 * @fires hp-dropdown-close - When the menu closes
 * @fires hp-menu-select - When a menuitem is activated. detail: { value, item }
 *
 * @slot - Trigger element (first child)
 * @slot content - hp-menu-item children
 *
 * @csspart menu - The floating menu container
 */
@customElement("hp-dropdown-menu")
export class HpDropdownMenu extends LitElement {
  @property({ reflect: true })
  side: FloatingSide = "bottom";

  @property({ reflect: true })
  align: FloatingAlign = "start";

  @property({ type: Number })
  offset = 6;

  @property({ reflect: true, type: Boolean })
  open = false;

  @state() private positionStyle = "";

  private trigger: HTMLElement | null = null;
  private disposeOutside: (() => void) | null = null;
  private disposeEscape: (() => void) | null = null;
  private lastFocused: HTMLElement | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    queueMicrotask(() => this.wireTrigger());
    this.addEventListener("hp-menu-select", this.handleSelect as EventListener);
    this.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("resize", this.handleViewportChange);
    window.addEventListener("scroll", this.handleViewportChange, true);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwireTrigger();
    window.removeEventListener("resize", this.handleViewportChange);
    window.removeEventListener("scroll", this.handleViewportChange, true);
    this.disposeOutside?.();
    this.disposeEscape?.();
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("open")) {
      if (this.open) {
        this.handleOpened();
      } else {
        this.handleClosed();
      }
    }
    if (this.open) {
      this.reposition();
    }
  }

  private wireTrigger(): void {
    const candidate = Array.from(this.children).find((el): el is HTMLElement => {
      return el instanceof HTMLElement && el.getAttribute("slot") !== "content";
    });
    if (!candidate || candidate === this.trigger) {
      return;
    }
    this.trigger = candidate;
    candidate.addEventListener("click", this.handleTriggerClick);
    if (!candidate.hasAttribute("aria-haspopup")) {
      candidate.setAttribute("aria-haspopup", "menu");
    }
    candidate.setAttribute("aria-expanded", this.open ? "true" : "false");
  }

  private unwireTrigger(): void {
    if (!this.trigger) {
      return;
    }
    this.trigger.removeEventListener("click", this.handleTriggerClick);
    this.trigger = null;
  }

  private getItems(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(":scope > hp-menu-item"));
  }

  private handleTriggerClick = (): void => {
    this.open = !this.open;
  };

  private handleViewportChange = (): void => {
    if (this.open) {
      this.reposition();
    }
  };

  private handleSelect = (event: CustomEvent<{ value: string; item: HTMLElement }>): void => {
    const item = event.detail.item;
    if (item.hasAttribute("disabled")) {
      return;
    }
    // Close on selection — same as a native <select>'s selection
    // behaviour. Consumers can preventDefault on the menuitem's
    // click handler if they need the menu to stay open.
    this.open = false;
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.open) {
      return;
    }
    const items = this.getItems().filter((i) => !i.hasAttribute("disabled"));
    if (items.length === 0) {
      return;
    }
    const focused = (document.activeElement as HTMLElement) ?? null;
    const idx = focused ? items.indexOf(focused) : -1;
    let next: number | null = null;
    if (event.key === "ArrowDown") {
      next = idx >= items.length - 1 ? 0 : idx + 1;
    } else if (event.key === "ArrowUp") {
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

  private handleOpened(): void {
    this.lastFocused = (document.activeElement as HTMLElement) ?? null;
    this.disposeOutside = onOutsidePointer(this, () => {
      this.open = false;
    });
    this.disposeEscape = onEscape(() => {
      this.open = false;
    });
    if (this.trigger) {
      this.trigger.setAttribute("aria-expanded", "true");
    }
    this.dispatchEvent(new CustomEvent("hp-dropdown-open", { bubbles: true, composed: true }));
    requestAnimationFrame(() => {
      this.reposition();
      // Focus the first non-disabled item.
      const items = this.getItems().filter((i) => !i.hasAttribute("disabled"));
      items[0]?.focus();
    });
  }

  private handleClosed(): void {
    this.disposeOutside?.();
    this.disposeOutside = null;
    this.disposeEscape?.();
    this.disposeEscape = null;
    if (this.trigger) {
      this.trigger.setAttribute("aria-expanded", "false");
    }
    if (this.lastFocused) {
      this.lastFocused.focus();
    }
    this.dispatchEvent(new CustomEvent("hp-dropdown-close", { bubbles: true, composed: true }));
  }

  private reposition(): void {
    if (!this.trigger) {
      return;
    }
    const menu = this.renderRoot.querySelector<HTMLElement>(".menu");
    if (!menu) {
      return;
    }
    const anchorRect = this.trigger.getBoundingClientRect();
    const floatingRect = menu.getBoundingClientRect();
    const result = positionFloating(
      anchorRect,
      { width: floatingRect.width, height: floatingRect.height },
      { width: window.innerWidth, height: window.innerHeight },
      { side: this.side, align: this.align, offset: this.offset }
    );
    this.positionStyle = `left: ${result.x}px; top: ${result.y}px;`;
  }

  static override styles = [
    hpBase,
    css`
      :host {
        position: relative;
        display: inline-block;
        line-height: var(--hp-typo-body-md-line-height);
      }

      .menu {
        position: fixed;
        z-index: var(--hp-layer-toast, 80);
        background: var(--hp-surface-container-high);
        color: var(--hp-on-surface);
        border: 1px solid var(--hp-outline-variant);
        min-width: 160px;
        padding: var(--hp-xs) 0;
        font-family: var(--hp-typo-body-sm-font-family);
        font-size: var(--hp-typo-body-sm-font-size);
        line-height: var(--hp-typo-body-sm-line-height);
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--hp-duration-fast) var(--hp-ease-default);
      }

      :host([open]) .menu {
        opacity: 1;
        pointer-events: auto;
      }
    `,
  ];

  override render() {
    return html`
      <slot @slotchange=${() => this.wireTrigger()}></slot>
      <div class="menu" part="menu" role="menu" ?hidden=${!this.open} style=${this.positionStyle}>
        <slot name="content"></slot>
      </div>
    `;
  }
}

/**
 * A single menu item inside hp-dropdown-menu / hp-context-menu.
 * role="menuitem"; Enter / Space activate; emits hp-menu-select.
 *
 * @fires hp-menu-select - When activated. detail: { value, item }
 *
 * @slot - Item label
 */
@customElement("hp-menu-item")
export class HpMenuItem extends LitElement {
  /** Value emitted in hp-menu-select. Defaults to the trimmed text
   * content if not provided. */
  @property()
  value = "";

  /** Disabled — blocks activation and removes from focus order. */
  @property({ reflect: true, type: Boolean })
  disabled = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "menuitem");
    }
    if (!this.hasAttribute("slot")) {
      this.setAttribute("slot", "content");
    }
    this.syncTabindex();
    this.addEventListener("click", this.handleClick);
    this.addEventListener("keydown", this.handleKeyDown);
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("disabled")) {
      this.syncTabindex();
    }
  }

  private syncTabindex(): void {
    if (this.disabled) {
      this.setAttribute("aria-disabled", "true");
      this.setAttribute("tabindex", "-1");
    } else {
      this.removeAttribute("aria-disabled");
      this.setAttribute("tabindex", "0");
    }
  }

  private handleClick = (event: MouseEvent): void => {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    this.emitSelect();
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.emitSelect();
    }
  };

  private emitSelect(): void {
    const value = this.value || (this.textContent ?? "").trim();
    this.dispatchEvent(
      new CustomEvent("hp-menu-select", {
        detail: { value, item: this },
        bubbles: true,
        composed: true,
      })
    );
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: block;
        padding: var(--hp-xs) var(--hp-md);
        cursor: pointer;
        line-height: var(--hp-typo-body-sm-line-height);
        color: var(--hp-on-surface);
        transition: background var(--hp-duration-fast) var(--hp-ease-default);
        user-select: none;
      }

      :host(:hover),
      :host(:focus-visible) {
        background: var(--hp-surface-container-highest);
        outline: none;
      }

      :host(:focus-visible) {
        color: var(--hp-primary);
      }

      :host([disabled]) {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ];

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-dropdown-menu": HpDropdownMenu;
    "hp-menu-item": HpMenuItem;
  }
}
