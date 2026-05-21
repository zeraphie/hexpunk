// hp-checkbox.ts — Hex checkbox.
//
// Hollow hex at rest; filled with --hp-primary and stamped with a
// check glyph when `checked`. Indeterminate state available via the
// `indeterminate` property (stamped with a horizontal bar instead of
// a check).
// activated by Space, exposes role="checkbox" + aria-checked.
//
// State management is uncontrolled by default — clicking toggles
// `checked` and fires a `change` event. Consumers can drive it
// controlled by listening to the event and resetting `checked` to
// the desired value.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../primitives/hp-hex.js";
import { hpBase } from "../../styles/hp-base.js";

/**
 * Hex checkbox. role="checkbox", aria-checked reflects state
 * (true / false / mixed). Space toggles; disabled blocks.
 *
 * @fires change - When checked changes via user input. detail: { checked }
 *
 * @csspart box - The hex container wrapping hp-hex + the glyph
 * @csspart glyph - The check / dash glyph overlay
 */
@customElement("hp-checkbox")
export class HpCheckbox extends LitElement {
  /** Current checked state. Toggled on click / Space. */
  @property({ reflect: true, type: Boolean })
  checked = false;

  /** Indeterminate (mixed) state — visual is a horizontal bar
   * instead of a check. Sets aria-checked="mixed" for assistive
   * tech. Cleared on next user toggle. */
  @property({ reflect: true, type: Boolean })
  indeterminate = false;

  /** Disabled — blocks toggle and removes from tab order. */
  @property({ reflect: true, type: Boolean })
  disabled = false;

  /** Optional name for form integration (not yet wired to the form
   * submission API; placeholder for forthcoming hp-form integration). */
  @property()
  name?: string;

  /** Optional value (paired with name) for form integration. */
  @property()
  value = "on";

  /** Cell size. `xs` (default, 32px) is the comfortable form-input
   * size; `xxs` (20px) is dense / tabular; `sm` (100px) is the
   * content-hex size — rarely useful here but available. */
  @property({ reflect: true })
  size: "xxs" | "xs" | "sm" = "xs";

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "checkbox");
    }
    this.syncAria();
    this.addEventListener("click", this.handleClick);
    this.addEventListener("keydown", this.handleKeyDown);
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("checked") || changed.has("indeterminate") || changed.has("disabled")) {
      this.syncAria();
    }
  }

  private syncAria(): void {
    this.setAttribute(
      "aria-checked",
      this.indeterminate ? "mixed" : this.checked ? "true" : "false"
    );
    if (this.disabled) {
      this.setAttribute("aria-disabled", "true");
      this.setAttribute("tabindex", "-1");
    } else {
      this.removeAttribute("aria-disabled");
      if (!this.hasAttribute("tabindex") || this.getAttribute("tabindex") === "-1") {
        this.setAttribute("tabindex", "0");
      }
    }
  }

  private handleClick = (event: MouseEvent): void => {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    this.toggle();
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled) {
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      this.toggle();
    }
  };

  private toggle(): void {
    this.indeterminate = false;
    this.checked = !this.checked;
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { checked: this.checked },
        bubbles: true,
        composed: true,
      })
    );
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
        pointer-events: none;
        cursor: var(--hp-cursor, pointer);
        --hp-stroke-color: var(--hp-outline);
      }

      :host(:hover),
      :host(:focus-visible) {
        --hp-stroke-color: var(--hp-secondary);
      }

      :host([checked]),
      :host([indeterminate]) {
        --hp-stroke-color: var(--hp-primary);
        --hp-hex-fill: var(--hp-primary);
      }

      :host([disabled]) {
        opacity: 0.5;
        cursor: not-allowed;
      }

      :host([disabled]) hp-hex {
        pointer-events: none;
      }

      .box {
        position: relative;
        display: inline-block;
        line-height: 0;
      }

      .glyph {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: var(--hp-on-primary);
        pointer-events: none;
        opacity: 0;
        transition: opacity var(--hp-duration-medium) var(--hp-ease-default);
      }

      :host([checked]) .glyph,
      :host([indeterminate]) .glyph {
        opacity: 1;
      }

      .glyph svg {
        width: 60%;
        height: 60%;
        stroke: currentColor;
        stroke-width: 3;
        /* Square caps + miter joins so the check / dash end on flat
 * angular ends instead of rounded ones — keeps the glyph in
 * the same hex aesthetic as the surrounding chrome. */
        stroke-linecap: square;
        stroke-linejoin: miter;
        fill: none;
      }
    `,
  ];

  override render() {
    return html`
      <div class="box" part="box">
        <hp-hex size=${this.size}></hp-hex>
        <div class="glyph" part="glyph" aria-hidden="true">
          ${this.indeterminate
            ? html`
                <svg viewBox="0 0 24 24">
                  <line x1="6" y1="12" x2="18" y2="12"></line>
                </svg>
              `
            : html`
                <svg viewBox="0 0 24 24">
                  <polyline points="5,12 10,17 19,7"></polyline>
                </svg>
              `}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-checkbox": HpCheckbox;
  }
}
