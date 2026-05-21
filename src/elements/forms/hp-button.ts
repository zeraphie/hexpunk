// hp-button.ts — Button primitive.
//
// Thin shell over `hp-cell variant="action"` that wires up the
// behaviour a consumer expects from a button: implicit role="button",
// tabindex=0 when enabled, Enter / Space activate, `disabled`
// short-circuits clicks. The visual is whatever hp-cell action gives
// you — hollow primary at rest, secondary hue swap on hover,
// primary-bright on focus-visible, optional `filled` for high-
// emphasis CTAs.
//
// For non-action button styles (anchor / secondary / utility), reach
// for `<hp-cell>` directly with the matching variant — hp-button is
// the opinionated default, not a styled wrapper.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../primitives/hp-cell.js";
import { hpBase } from "../../styles/hp-base.js";

/**
 * Button primitive — composes hp-cell variant="action" with the
 * semantics consumers expect from a button: role="button",
 * auto-tabindex, Enter / Space activate, disabled blocks clicks,
 * type="submit" drives form.requestSubmit() inside a form.
 *
 * @slot - Button label content
 */
@customElement("hp-button")
export class HpButton extends LitElement {
  /** Native button type. Determines submit / reset behaviour inside a
   * `<form>`. Default `button` (inert in forms). */
  @property({ reflect: true })
  type: "button" | "submit" | "reset" = "button";

  /** When set, the button doesn't activate on click / Enter / Space
   * and is removed from the tab order. Visual state inherits hp-
   * cell's stroke at the disabled opacity. */
  @property({ reflect: true, type: Boolean })
  disabled = false;

  /** High-emphasis filled CTA — forwards `filled` to the composed
   * hp-cell. */
  @property({ reflect: true, type: Boolean })
  filled = false;

  /** Cell size.
   *
   * - `xxs` (20px) — dense / tabular controls (e.g. inline icon
   * buttons in a table row)
   * - `xs` (32px) — comfortable form-control sized buttons (e.g.
   * hp-toggle-group, segmented controls)
   * - `sm` (100px, default) — full content / CTA size
   * - `md` (180px) — feature-tile button
   * - `lg` (320px) — hero / landing tile */
  @property({ reflect: true })
  size: "xxs" | "xs" | "sm" | "md" | "lg" = "sm";

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "button");
    }
    this.syncTabindex();
    this.addEventListener("keydown", this.handleKeyDown);
    this.addEventListener("click", this.handleClick);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("keydown", this.handleKeyDown);
    this.removeEventListener("click", this.handleClick);
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("disabled")) {
      this.syncTabindex();
    }
  }

  private syncTabindex(): void {
    if (this.disabled) {
      this.setAttribute("tabindex", "-1");
      this.setAttribute("aria-disabled", "true");
    } else {
      if (!this.hasAttribute("tabindex") || this.getAttribute("tabindex") === "-1") {
        this.setAttribute("tabindex", "0");
      }
      this.removeAttribute("aria-disabled");
    }
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.click();
    }
  };

  private handleClick = (event: MouseEvent): void => {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (this.type === "submit" || this.type === "reset") {
      const form = this.closest("form");
      if (form) {
        if (this.type === "submit") {
          form.requestSubmit();
        } else {
          form.reset();
        }
      }
    }
  };

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
      }

      :host([disabled]) {
        opacity: 0.5;
        cursor: not-allowed;
      }

      :host([disabled]) hp-cell {
        pointer-events: none;
      }

      /* When the button is part of a toggle group, the group stamps
 * aria-pressed="true" on the host. Style the inner hp-cell as
 * filled (primary stroke + primary fill + on-primary label) by
 * pushing the same custom properties hp-cell's [filled] rule
 * uses — driven from CSS so there's no JS observer to keep
 * in sync and no race with the first render. */
      :host([aria-pressed="true"]) hp-cell {
        --hp-stroke-color: var(--hp-primary);
        --hp-hex-fill: var(--hp-primary);
        --hp-cell-label-color: var(--hp-on-primary);
      }
    `,
  ];

  override render() {
    return html`
      <hp-cell variant="action" ?filled=${this.filled} size=${this.size}>
        <slot></slot>
      </hp-cell>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-button": HpButton;
  }
}
