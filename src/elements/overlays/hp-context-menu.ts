// hp-context-menu.ts — Right-click triggered menu.
//
// Wraps a target region; right-click (or long-press on touch) inside
// opens a menu positioned at the cursor. Otherwise identical to
// hp-dropdown-menu — same hp-menu-item children, same keyboard
// model, same focus restoration.
//
// Authoring:
//
// <hp-context-menu>
// <div class="target">Right-click me</div>
//
// <hp-menu-item slot="content">cut</hp-menu-item>
// <hp-menu-item slot="content">copy</hp-menu-item>
// <hp-menu-item slot="content">paste</hp-menu-item>
// </hp-context-menu>

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { onEscape, onOutsidePointer, positionFloating } from "../../lib/floating.js";
import { hpBase } from "../../styles/hp-base.js";

/**
 * Context menu — right-click on the target region opens the menu at
 * the cursor.
 *
 * @fires hp-context-menu-open - When the menu opens
 * @fires hp-context-menu-close - When the menu closes
 * @fires hp-menu-select - When a menuitem is activated (bubbles from hp-menu-item)
 *
 * @slot - Target region (everything not slotted into "content")
 * @slot content - hp-menu-item children
 *
 * @csspart menu - The floating menu container
 */
@customElement("hp-context-menu")
export class HpContextMenu extends LitElement {
  @property({ reflect: true, type: Boolean })
  open = false;

  @state() private positionStyle = "";

  private disposeOutside: (() => void) | null = null;
  private disposeEscape: (() => void) | null = null;
  private lastFocused: HTMLElement | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("contextmenu", this.handleContextMenu);
    this.addEventListener("hp-menu-select", this.handleSelect as EventListener);
    this.addEventListener("keydown", this.handleKeyDown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
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
  }

  private getItems(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(":scope > hp-menu-item"));
  }

  private handleContextMenu = (event: MouseEvent): void => {
    // Allow shift+right-click to fall through to the native browser
    // menu so power users can still inspect.
    if (event.shiftKey) {
      return;
    }
    // Don't fire on menu items themselves (when re-opening from
    // inside an open menu).
    const path = event.composedPath();
    if (path.some((n) => n instanceof HTMLElement && n.tagName.toLowerCase() === "hp-menu-item")) {
      return;
    }
    event.preventDefault();
    this.openAt(event.clientX, event.clientY);
  };

  private openAt(clientX: number, clientY: number): void {
    this.open = true;
    // After Lit applies the open attribute and the menu becomes
    // measurable, position at the cursor with flip if it would
    // overflow the viewport edges.
    requestAnimationFrame(() => {
      const menu = this.renderRoot.querySelector<HTMLElement>(".menu");
      if (!menu) {
        return;
      }
      const floatingRect = menu.getBoundingClientRect();
      // Use a zero-sized anchor at the click point so position math
      // treats it as a single point.
      const anchor = {
        left: clientX,
        top: clientY,
        right: clientX,
        bottom: clientY,
        width: 0,
        height: 0,
      };
      const result = positionFloating(
        anchor,
        { width: floatingRect.width, height: floatingRect.height },
        { width: window.innerWidth, height: window.innerHeight },
        { side: "bottom", align: "start", offset: 2 }
      );
      this.positionStyle = `left: ${result.x}px; top: ${result.y}px;`;
    });
  }

  private handleSelect = (event: CustomEvent<{ value: string; item: HTMLElement }>): void => {
    if (event.detail.item.hasAttribute("disabled")) {
      return;
    }
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
    this.dispatchEvent(new CustomEvent("hp-context-menu-open", { bubbles: true, composed: true }));
    requestAnimationFrame(() => {
      const items = this.getItems().filter((i) => !i.hasAttribute("disabled"));
      items[0]?.focus();
    });
  }

  private handleClosed(): void {
    this.disposeOutside?.();
    this.disposeOutside = null;
    this.disposeEscape?.();
    this.disposeEscape = null;
    if (this.lastFocused) {
      this.lastFocused.focus();
    }
    this.dispatchEvent(new CustomEvent("hp-context-menu-close", { bubbles: true, composed: true }));
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: block;
        position: relative;
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
      <slot></slot>
      <div class="menu" part="menu" role="menu" ?hidden=${!this.open} style=${this.positionStyle}>
        <slot name="content"></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-context-menu": HpContextMenu;
  }
}
