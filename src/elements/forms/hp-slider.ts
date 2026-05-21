// hp-slider.ts — Range slider.
//
// Single-thumb continuous-value slider.
// (single-value variant): role="slider", aria-valuemin / max / now,
// keyboard support (Arrow keys step by `step`, PageUp/Down by 10x,
// Home/End to min/max), pointerdown to grab + drag.
//
// Visual: horizontal track with a hex thumb. Filled portion of the
// track uses --hp-primary; the rest stays --hp-outline-variant.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Single-thumb continuous-value slider. role="slider";
 * aria-valuemin / max / now reflect state. Arrow keys step by `step`,
 * PageUp/PageDown by 10×, Home/End jump to min/max. Pointer drag
 * with capture.
 *
 * @fires change - When the value changes (keyboard or pointer). detail: { value }
 *
 * @csspart slider - The slider container
 * @csspart track - The track that the fill sits on
 * @csspart fill - The progress fill (left edge → thumb)
 * @csspart thumb - The hex thumb
 */
@customElement("hp-slider")
export class HpSlider extends LitElement {
  /** Lower bound (default 0). */
  @property({ type: Number })
  min = 0;

  /** Upper bound (default 100). */
  @property({ type: Number })
  max = 100;

  /** Step size for arrow keys / pointer drag (default 1). */
  @property({ type: Number })
  step = 1;

  /** Current value. Clamped to [min, max] on set. */
  @property({ type: Number, reflect: true })
  value = 0;

  /** Disabled — no input, removed from tab order. */
  @property({ reflect: true, type: Boolean })
  disabled = false;

  /** Optional form name (placeholder for hp-form). */
  @property()
  name?: string;

  private pointerActive = false;
  private trackRect: DOMRect | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "slider");
    }
    this.syncAria();
    this.addEventListener("keydown", this.handleKeyDown);
    this.addEventListener("pointerdown", this.handlePointerDown);
  }

  override updated(changed: Map<string, unknown>): void {
    if (
      changed.has("value") ||
      changed.has("min") ||
      changed.has("max") ||
      changed.has("disabled")
    ) {
      this.syncAria();
    }
  }

  private syncAria(): void {
    this.setAttribute("aria-valuemin", String(this.min));
    this.setAttribute("aria-valuemax", String(this.max));
    this.setAttribute("aria-valuenow", String(this.value));
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

  private clamp(v: number): number {
    return Math.max(this.min, Math.min(this.max, v));
  }

  private setValue(next: number): void {
    const stepped = Math.round((next - this.min) / this.step) * this.step + this.min;
    const clamped = this.clamp(stepped);
    if (clamped === this.value) {
      return;
    }
    this.value = clamped;
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled) {
      return;
    }
    const big = this.step * 10;
    let next = this.value;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = this.value + this.step;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = this.value - this.step;
        break;
      case "PageUp":
        next = this.value + big;
        break;
      case "PageDown":
        next = this.value - big;
        break;
      case "Home":
        next = this.min;
        break;
      case "End":
        next = this.max;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.setValue(next);
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.disabled || event.button !== 0) {
      return;
    }
    const track = this.renderRoot.querySelector(".track") as HTMLElement | null;
    if (!track) {
      return;
    }
    this.trackRect = track.getBoundingClientRect();
    this.pointerActive = true;
    this.setPointerCapture(event.pointerId);
    this.updateFromPointer(event.clientX);
    this.addEventListener("pointermove", this.handlePointerMove);
    this.addEventListener("pointerup", this.handlePointerUp);
    this.addEventListener("pointercancel", this.handlePointerUp);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.pointerActive) {
      return;
    }
    this.updateFromPointer(event.clientX);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    this.pointerActive = false;
    this.trackRect = null;
    try {
      this.releasePointerCapture(event.pointerId);
    } catch {
      // ignore — pointer might have already been released
    }
    this.removeEventListener("pointermove", this.handlePointerMove);
    this.removeEventListener("pointerup", this.handlePointerUp);
    this.removeEventListener("pointercancel", this.handlePointerUp);
  };

  private updateFromPointer(clientX: number): void {
    if (!this.trackRect) {
      return;
    }
    const ratio = (clientX - this.trackRect.left) / this.trackRect.width;
    const next = this.min + ratio * (this.max - this.min);
    this.setValue(next);
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
        width: 200px;
        cursor: var(--hp-cursor, pointer);
        touch-action: none;
      }

      :host([disabled]) {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .slider {
        position: relative;
        width: 100%;
        height: 24px;
        display: flex;
        align-items: center;
      }

      .track {
        position: relative;
        width: 100%;
        height: 4px;
        background: var(--hp-outline-variant);
        border-radius: 2px;
      }

      .fill {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: var(--hp-primary);
        border-radius: 2px;
      }

      .thumb {
        position: absolute;
        top: 50%;
        width: 16px;
        height: 18.5px;
        background: var(--hp-primary);
        clip-path: var(--hp-hex-clip);
        transform: translate(-50%, -50%);
        transition: background var(--hp-duration-medium) var(--hp-ease-default);
        pointer-events: none;
      }

      :host(:hover) .thumb,
      :host(:focus-visible) .thumb {
        background: var(--hp-primary-bright);
      }
    `,
  ];

  override render() {
    const range = this.max - this.min;
    const ratio = range === 0 ? 0 : (this.value - this.min) / range;
    const pct = `${(ratio * 100).toFixed(2)}%`;
    return html`
      <div class="slider" part="slider">
        <div class="track" part="track">
          <div class="fill" part="fill" style=${`width: ${pct}`}></div>
          <div class="thumb" part="thumb" style=${`left: ${pct}`} aria-hidden="true"></div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-slider": HpSlider;
  }
}
