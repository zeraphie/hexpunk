// hp-toggle.ts — Switch / toggle.
//
// Two-state on/off switch. Visual is a hex track with a smaller hex
// thumb that slides between two positions.
// primitive — role="switch", aria-checked, Space activates,
// disabled blocks. The hex chrome reads as a discrete on/off rather
// than a continuous slider (use hp-slider for the continuous case).

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../primitives/hp-hex.js";
import { hpBase } from "../../styles/hp-base.js";

/**
 * Two-state on/off switch. role="switch", aria-checked reflects
 * state; Space / Enter activate; disabled blocks.
 *
 * @fires change - When the switch flips via user input. detail: { checked }
 *
 * @csspart track - The pill-shaped track element
 * @csspart thumb - The sliding hex thumb
 */
@customElement("hp-toggle")
export class HpToggle extends LitElement {
  /** On (checked) state. */
  @property({ reflect: true, type: Boolean })
  checked = false;

  /** Disabled — no activation, removed from tab order. */
  @property({ reflect: true, type: Boolean })
  disabled = false;

  /** Optional form name (placeholder for forthcoming hp-form wiring). */
  @property()
  name?: string;

  /** Submitted value when checked. */
  @property()
  value = "on";

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "switch");
    }
    this.syncAria();
    this.addEventListener("click", this.handleClick);
    this.addEventListener("keydown", this.handleKeyDown);
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("checked") || changed.has("disabled")) {
      this.syncAria();
    }
  }

  private syncAria(): void {
    this.setAttribute("aria-checked", this.checked ? "true" : "false");
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
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      this.toggle();
    }
  };

  private toggle(): void {
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
        cursor: var(--hp-cursor, pointer);
        --hp-stroke-color: var(--hp-outline);
      }

      :host(:hover),
      :host(:focus-visible) {
        --hp-stroke-color: var(--hp-secondary);
      }

      :host([checked]) {
        --hp-stroke-color: var(--hp-primary);
      }

      :host([checked]:hover),
      :host([checked]:focus-visible) {
        --hp-stroke-color: var(--hp-primary-bright);
      }

      :host([disabled]) {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Track is a stretched octagon whose four corner cuts match
 * the thumb's hex angles exactly. When the thumb sits at
 * either end, its angled edges COINCIDE with the track's
 * corner cuts — flush, no gap, no overhang. Mid-slide, the
 * thumb's top + bottom points sit on the track's flat top +
 * bottom edges, so flush holds throughout.
 *
 * Geometry derived from --hp-hex-cell-xxs:
 * thumb_w = xxs
 * thumb_h = xxs * 1.1547 (pointy-top hex aspect)
 * track_w = xxs * 2.5 (5 × corner_w)
 * track_h = thumb_h
 * corner_w = xxs / 2 (= 20% of track_w)
 * corner_h = thumb_h / 4 (= 25% of track_h) */
      .track {
        position: relative;
        display: inline-block;
        width: calc(var(--hp-hex-cell-xxs) * 2.5);
        height: calc(var(--hp-hex-cell-xxs) * 1.1547);
        line-height: 0;
        background: var(--hp-surface-container);
        clip-path: polygon(20% 0%, 80% 0%, 100% 25%, 100% 75%, 80% 100%, 20% 100%, 0 75%, 0 25%);
        transition: background var(--hp-duration-medium) var(--hp-ease-default);
      }

      :host([checked]) .track {
        background: var(--hp-primary-container);
      }

      .thumb {
        position: absolute;
        top: 50%;
        left: 0;
        transform: translate(0, -50%);
        width: var(--hp-hex-cell-xxs);
        height: calc(var(--hp-hex-cell-xxs) * 1.1547);
        clip-path: var(--hp-hex-clip);
        background: var(--hp-stroke-color);
        transition:
          transform var(--hp-duration-medium) var(--hp-ease-default),
          background var(--hp-duration-medium) var(--hp-ease-default);
      }

      :host([checked]) .thumb {
        /* slide = track_w − thumb_w = 2.5xxs − xxs = 1.5 × xxs */
        transform: translate(calc(var(--hp-hex-cell-xxs) * 1.5), -50%);
      }
    `,
  ];

  override render() {
    return html`
      <div class="track" part="track">
        <div class="thumb" part="thumb" aria-hidden="true"></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-toggle": HpToggle;
  }
}
