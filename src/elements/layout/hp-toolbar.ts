// hp-toolbar.ts — Toolbar container.
//
//
// / toggles / separators with managed keyboard navigation. Arrow
// keys move focus between focusable children (skipping disabled
// ones), Home / End jump to first / last. Slotted hp-separator
// children act as visual + a11y dividers between groups of controls.
//
// Children that should participate in the toolbar's roving tabindex
// expose either tabindex (any value) or a focusable role. The
// toolbar manages tabindex itself: only one child has tabindex=0 at
// any time, the rest are tabindex=-1. Tab moves OUT of the toolbar;
// arrow keys navigate within it.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

const FOCUSABLE_SELECTOR =
  'hp-button, hp-toggle, hp-checkbox, hp-radio, hp-link, [tabindex]:not([tabindex="-2"]), button, a[href]';

/**
 * Toolbar container with managed keyboard navigation. Roving
 * tabindex over slotted focusable children; arrow keys move between
 * them; Home / End jump to first / last; Tab leaves the toolbar.
 *
 * @slot - Toolbar controls (hp-button, hp-toggle, hp-checkbox,
 * hp-separator, etc.)
 */
@customElement("hp-toolbar")
export class HpToolbar extends LitElement {
  /** Layout direction — controls which arrow keys move focus. */
  @property({ reflect: true })
  orientation: "horizontal" | "vertical" = "horizontal";

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "toolbar");
    }
    if (!this.hasAttribute("aria-orientation")) {
      this.setAttribute("aria-orientation", this.orientation);
    }
    this.addEventListener("keydown", this.handleKeyDown);
    this.addEventListener("focusin", this.handleFocusIn);
    queueMicrotask(() => this.syncRovingTabindex());
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("orientation")) {
      this.setAttribute("aria-orientation", this.orientation);
    }
  }

  private getFocusable(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
      if (el.hasAttribute("disabled")) {
        return false;
      }
      const tab = el.getAttribute("tabindex");
      if (tab === "-2") {
        return false;
      }
      // Skip hidden / display:none children — they can't receive focus.
      if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") {
        return false;
      }
      return true;
    });
  }

  /** Sync the roving-tabindex model: one focusable child at tabindex
   * 0, the rest at -1, so Tab enters the toolbar at one element and
   * arrow keys navigate from there. */
  private syncRovingTabindex(): void {
    const focusable = this.getFocusable();
    if (focusable.length === 0) {
      return;
    }
    const currentActive = focusable.find((el) => el.getAttribute("tabindex") === "0");
    const target = currentActive ?? focusable[0];
    focusable.forEach((el) => {
      el.setAttribute("tabindex", el === target ? "0" : "-1");
    });
  }

  private handleFocusIn = (event: FocusEvent): void => {
    // When a child receives focus, make it the new active in the
    // roving tabindex set.
    const focusable = this.getFocusable();
    const target = event.target as HTMLElement;
    if (focusable.includes(target)) {
      focusable.forEach((el) => {
        el.setAttribute("tabindex", el === target ? "0" : "-1");
      });
    }
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    const horizontal = this.orientation === "horizontal";
    const forward = horizontal ? "ArrowRight" : "ArrowDown";
    const backward = horizontal ? "ArrowLeft" : "ArrowUp";

    const focusable = this.getFocusable();
    if (focusable.length === 0) {
      return;
    }
    const focused = document.activeElement as HTMLElement | null;
    const idx = focused ? focusable.indexOf(focused) : -1;

    let nextIdx: number | null = null;
    if (event.key === forward) {
      nextIdx = idx >= focusable.length - 1 ? 0 : idx + 1;
    } else if (event.key === backward) {
      nextIdx = idx <= 0 ? focusable.length - 1 : idx - 1;
    } else if (event.key === "Home") {
      nextIdx = 0;
    } else if (event.key === "End") {
      nextIdx = focusable.length - 1;
    }

    if (nextIdx === null) {
      return;
    }
    event.preventDefault();
    focusable[nextIdx]?.focus();
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
    "hp-toolbar": HpToolbar;
  }
}
