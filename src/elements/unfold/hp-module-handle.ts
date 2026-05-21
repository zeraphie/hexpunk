// hp-module-handle.ts — Molecule centroid grip.
//
// Pointy-top hex grip rendered at the centroid of a bonded molecule.
// Grabbing it drags the whole molecule as a rigid body. 36px bounding
// box (`spacing.module-handle-size`), `surface-container-high`
// background with a `primary`-coloured grip mark at rest, `primary`
// background + `on-primary` grip when `active` (being grabbed).
//
// Focusable by default — drag handles are keyboard-grabbable (`space`
// per the system keyboard shortcuts). Consumer slots a grip icon if
// they want to override the default 6-dot indicator.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Drag handle — a small filled hex used as the grip for moving an
 * hp-cluster or hp-unfold-list. Pure visual indicator; the parent
 * drives the actual drag interaction via drag-handle attribute.
 */
@customElement("hp-module-handle")
export class HpModuleHandle extends LitElement {
  /** When set, the handle is currently grabbed — fills with `primary`. */
  @property({ reflect: true, type: Boolean })
  active = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("tabindex")) {
      this.tabIndex = 0;
    }
    if (!this.hasAttribute("role")) {
      this.role = "button";
    }
    if (!this.hasAttribute("aria-label")) {
      this.setAttribute("aria-label", "Drag handle");
    }
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
        width: var(--hp-module-handle-size);
        aspect-ratio: 1 / 1.1547;
        cursor: grab;
        clip-path: var(--hp-hex-clip);
      }

      :host([active]) {
        cursor: grabbing;
      }

      .handle {
        position: relative;
        width: 100%;
        height: 100%;
        clip-path: var(--hp-hex-clip);
        background: var(--hp-surface-container-high);
        color: var(--hp-primary);
        display: grid;
        place-items: center;
        transition:
          background var(--hp-duration-medium) var(--hp-ease-default),
          color var(--hp-duration-medium) var(--hp-ease-default);
      }

      :host([active]) .handle {
        background: var(--hp-primary);
        color: var(--hp-on-primary);
      }

      /* Default six-dot grip mark — 3 rows × 2 columns of identical circles.
 * SVG-rendered so dot size and spacing are exact, with currentColor
 * fill so the mark inherits the handle's foreground. */
      .grip {
        width: 8px;
        height: 14px;
        fill: currentColor;
      }
    `,
  ];

  override render() {
    return html`
      <div class="handle" part="handle">
        <slot>
          <svg
            class="grip"
            viewBox="0 0 8 14"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="1.5" cy="1.5" r="1.5" />
            <circle cx="6.5" cy="1.5" r="1.5" />
            <circle cx="1.5" cy="7" r="1.5" />
            <circle cx="6.5" cy="7" r="1.5" />
            <circle cx="1.5" cy="12.5" r="1.5" />
            <circle cx="6.5" cy="12.5" r="1.5" />
          </svg>
        </slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-module-handle": HpModuleHandle;
  }
}
