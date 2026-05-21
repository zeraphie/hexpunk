// hp-menubar.ts — Horizontal / vertical menu bar.
//
// Slotted children are a series of <hp-dropdown-menu> instances (or
// custom equivalents with role="menuitem" / aria-haspopup="menu").
// The bar manages a roving tabindex so only one trigger is in the
// tab order at a time; arrow keys move between adjacent triggers;
// Home / End jump to first / last.
//
// Authoring:
//
// <hp-menubar>
// <hp-dropdown-menu>
// <hp-button>File</hp-button>
// <hp-menu-item slot="content">New</hp-menu-item>
// <hp-menu-item slot="content">Open</hp-menu-item>
// </hp-dropdown-menu>
// <hp-dropdown-menu>
// <hp-button>Edit</hp-button>
// <hp-menu-item slot="content">Undo</hp-menu-item>
// </hp-dropdown-menu>
// </hp-menubar>

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

const TRIGGER_SELECTOR = "hp-dropdown-menu, [role='menuitem']";

/**
 * Menu bar — managed keyboard navigation across a row of dropdown
 * triggers. role="menubar"; arrow keys move focus between triggers;
 * Home / End jump.
 *
 * @slot - hp-dropdown-menu children (or any [role="menuitem"] triggers)
 */
@customElement("hp-menubar")
export class HpMenubar extends LitElement {
  /** Layout direction — controls arrow-key axis. */
  @property({ reflect: true })
  orientation: "horizontal" | "vertical" = "horizontal";

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "menubar");
    }
    if (!this.hasAttribute("aria-orientation")) {
      this.setAttribute("aria-orientation", this.orientation);
    }
    this.addEventListener("keydown", this.handleKeyDown);
    queueMicrotask(() => this.syncRovingTabindex());
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("orientation")) {
      this.setAttribute("aria-orientation", this.orientation);
    }
  }

  private getTriggers(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(TRIGGER_SELECTOR)).filter(
      (el) => !el.hasAttribute("disabled")
    );
  }

  private syncRovingTabindex(): void {
    const triggers = this.getTriggers();
    if (triggers.length === 0) {
      return;
    }
    // For hp-dropdown-menu, the focusable target is its inner trigger
    // (the first non-content child). We stamp tabindex on the
    // dropdown itself; the dropdown's button child stays naturally
    // focusable. To keep the menubar's roving model coherent, point
    // tabindex at the dropdown trigger directly.
    triggers.forEach((el, idx) => {
      const triggerChild =
        el.tagName.toLowerCase() === "hp-dropdown-menu"
          ? (Array.from(el.children).find(
              (child) => child instanceof HTMLElement && child.getAttribute("slot") !== "content"
            ) as HTMLElement | undefined)
          : el;
      if (!triggerChild) {
        return;
      }
      triggerChild.setAttribute("tabindex", idx === 0 ? "0" : "-1");
    });
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    const triggers = this.getTriggers();
    if (triggers.length === 0) {
      return;
    }
    const focused = document.activeElement as HTMLElement | null;
    // Locate which dropdown owns the focused element.
    const idx = triggers.findIndex((t) => t === focused || t.contains(focused));
    if (idx === -1) {
      return;
    }

    const horizontal = this.orientation === "horizontal";
    const forward = horizontal ? "ArrowRight" : "ArrowDown";
    const backward = horizontal ? "ArrowLeft" : "ArrowUp";

    let next: number | null = null;
    if (event.key === forward) {
      next = idx >= triggers.length - 1 ? 0 : idx + 1;
    } else if (event.key === backward) {
      next = idx <= 0 ? triggers.length - 1 : idx - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = triggers.length - 1;
    }
    if (next === null) {
      return;
    }
    event.preventDefault();
    const target = triggers[next];
    if (!target) {
      return;
    }
    const focusEl =
      target.tagName.toLowerCase() === "hp-dropdown-menu"
        ? (Array.from(target.children).find(
            (child) => child instanceof HTMLElement && child.getAttribute("slot") !== "content"
          ) as HTMLElement | undefined)
        : target;
    focusEl?.focus();
  };

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: var(--hp-xs);
        padding: var(--hp-xs);
        background: var(--hp-surface-container);
        border-radius: 4px;
        border: 1px solid var(--hp-outline-faint);
        line-height: var(--hp-typo-body-md-line-height);
      }

      :host([orientation="vertical"]) {
        flex-direction: column;
        align-items: stretch;
      }
    `,
  ];

  override render() {
    return html`<slot @slotchange=${() => this.syncRovingTabindex()}></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-menubar": HpMenubar;
  }
}
