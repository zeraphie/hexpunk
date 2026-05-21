// hp-scroll-area.ts — Custom scrollbar wrapper.
//
// Hides the platform-native scrollbar inside the viewport and paints
// a thinner, theme-aware one on top.
// (auto / always / hover visibility modes). The native scroll event
// model is preserved — wheel, keyboard (arrow keys / Page Up/Down /
// Home / End), and touch all work. The custom scrollbar thumb is
// also draggable.
//
// Authoring:
//
// <hp-scroll-area style="height: 240px">
// <p>Long content...</p>
// </hp-scroll-area>

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

export type HpScrollVisibility = "auto" | "always" | "hover";

/**
 * Custom-scrollbar wrapper. Hides the native scrollbar inside and
 * paints a themed one on top. Native scroll model preserved.
 *
 * @slot - Scrollable content
 *
 * @csspart viewport - The scroll viewport (the element that actually scrolls)
 * @csspart scrollbar - The vertical scrollbar track
 * @csspart thumb - The scrollbar thumb
 */
@customElement("hp-scroll-area")
export class HpScrollArea extends LitElement {
  /** Scrollbar visibility:
   * - `auto` (default): visible whenever the content overflows
   * - `always`: persistently visible
   * - `hover`: only visible while the area is hovered */
  @property({ reflect: true })
  visibility: HpScrollVisibility = "auto";

  @state() private thumbHeight = 0;
  @state() private thumbTop = 0;
  @state() private hasOverflow = false;

  private viewportEl: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private dragOffset = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    queueMicrotask(() => this.attachViewport());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.viewportEl) {
      this.viewportEl.removeEventListener("scroll", this.handleScroll);
    }
  }

  private attachViewport(): void {
    const el = this.renderRoot.querySelector<HTMLElement>(".viewport");
    if (!el || el === this.viewportEl) {
      return;
    }
    this.viewportEl = el;
    el.addEventListener("scroll", this.handleScroll, { passive: true });
    this.resizeObserver = new ResizeObserver(() => this.recompute());
    this.resizeObserver.observe(el);
    this.recompute();
  }

  private recompute(): void {
    const el = this.viewportEl;
    if (!el) {
      return;
    }
    const trackHeight = el.clientHeight;
    const contentHeight = el.scrollHeight;
    this.hasOverflow = contentHeight > trackHeight + 1;
    if (!this.hasOverflow) {
      this.thumbHeight = 0;
      this.thumbTop = 0;
      return;
    }
    const ratio = trackHeight / contentHeight;
    this.thumbHeight = Math.max(24, trackHeight * ratio);
    this.thumbTop =
      (el.scrollTop / (contentHeight - trackHeight)) * (trackHeight - this.thumbHeight);
  }

  private handleScroll = (): void => {
    this.recompute();
  };

  private handleThumbPointerDown = (event: PointerEvent): void => {
    if (!this.viewportEl) {
      return;
    }
    const thumb = event.currentTarget as HTMLElement;
    thumb.setPointerCapture(event.pointerId);
    const thumbRect = thumb.getBoundingClientRect();
    this.dragOffset = event.clientY - thumbRect.top;
    thumb.addEventListener("pointermove", this.handleThumbPointerMove);
    thumb.addEventListener("pointerup", this.handleThumbPointerUp);
    thumb.addEventListener("pointercancel", this.handleThumbPointerUp);
  };

  private handleThumbPointerMove = (event: PointerEvent): void => {
    if (!this.viewportEl) {
      return;
    }
    const track = this.renderRoot.querySelector<HTMLElement>(".scrollbar");
    if (!track) {
      return;
    }
    const trackRect = track.getBoundingClientRect();
    const newTop = event.clientY - trackRect.top - this.dragOffset;
    const maxTop = trackRect.height - this.thumbHeight;
    const clamped = Math.max(0, Math.min(maxTop, newTop));
    const contentRange = this.viewportEl.scrollHeight - this.viewportEl.clientHeight;
    this.viewportEl.scrollTop = (clamped / maxTop) * contentRange;
  };

  private handleThumbPointerUp = (event: PointerEvent): void => {
    const thumb = event.currentTarget as HTMLElement;
    thumb.releasePointerCapture(event.pointerId);
    thumb.removeEventListener("pointermove", this.handleThumbPointerMove);
    thumb.removeEventListener("pointerup", this.handleThumbPointerUp);
    thumb.removeEventListener("pointercancel", this.handleThumbPointerUp);
  };

  static override styles = [
    hpBase,
    css`
      :host {
        position: relative;
        display: block;
        overflow: hidden;
        line-height: var(--hp-typo-body-md-line-height);
      }

      .viewport {
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: none;
      }

      .viewport::-webkit-scrollbar {
        display: none;
      }

      .scrollbar {
        position: absolute;
        top: 0;
        right: 2px;
        width: 6px;
        height: 100%;
        background: transparent;
        opacity: 0;
        transition: opacity var(--hp-duration-medium) var(--hp-ease-default);
        pointer-events: none;
      }

      :host([visibility="always"]) .scrollbar {
        opacity: 1;
        pointer-events: auto;
      }

      :host([visibility="auto"]) .scrollbar.has-overflow {
        opacity: 1;
        pointer-events: auto;
      }

      :host([visibility="hover"]:hover) .scrollbar.has-overflow,
      :host([visibility="hover"]:focus-within) .scrollbar.has-overflow {
        opacity: 1;
        pointer-events: auto;
      }

      .thumb {
        position: absolute;
        left: 0;
        width: 100%;
        background: var(--hp-outline-variant);
        cursor: grab;
        transition: background var(--hp-duration-fast) var(--hp-ease-default);
        touch-action: none;
      }

      .thumb:hover,
      .thumb:active {
        background: var(--hp-secondary);
        cursor: grabbing;
      }
    `,
  ];

  override render() {
    return html`
      <div class="viewport" part="viewport">
        <slot></slot>
      </div>
      <div
        class=${`scrollbar ${this.hasOverflow ? "has-overflow" : ""}`}
        part="scrollbar"
        aria-hidden="true"
      >
        <div
          class="thumb"
          part="thumb"
          style=${`top: ${this.thumbTop}px; height: ${this.thumbHeight}px`}
          @pointerdown=${this.handleThumbPointerDown}
        ></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-scroll-area": HpScrollArea;
  }
}
