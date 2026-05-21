// hp-hover-card.ts — Hover-triggered floating card.
//
// Like hp-tooltip but the card can contain interactive content
// (links, buttons, embedded media).
// on hover / focus of the trigger, close after a delay when the
// pointer leaves both the trigger and the card. Keyboard users open
// with focus; click activation is not required.
//
// Use for inline rich-content previews — user-card on hover over a
// handle, version-info on a hover over a build hash, etc. For a
// click-triggered floating panel, use hp-popover. For a simple
// label-only tip, use hp-tooltip.

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  onEscape,
  positionFloating,
  type FloatingAlign,
  type FloatingSide,
} from "../../lib/floating.js";
import { hpBase } from "../../styles/hp-base.js";

/**
 * Hover- / focus-triggered floating card. Larger and interactive
 * than hp-tooltip; lighter than hp-popover (no outside-click).
 *
 * @fires hp-hover-card-open - When the card opens
 * @fires hp-hover-card-close - When the card closes
 *
 * @slot - Trigger element (first child)
 * @slot content - Card body
 *
 * @csspart card - The floating card element
 */
@customElement("hp-hover-card")
export class HpHoverCard extends LitElement {
  /** Preferred side relative to the trigger. */
  @property({ reflect: true })
  side: FloatingSide = "bottom";

  /** Alignment along the chosen side. */
  @property({ reflect: true })
  align: FloatingAlign = "center";

  /** Pixel gap between trigger and card. */
  @property({ type: Number })
  offset = 8;

  /** Open delay (ms) before showing. Default 400 — long enough to
   * avoid flashes while skimming, short enough to feel responsive
   * on intent. */
  @property({ type: Number, attribute: "open-delay" })
  openDelay = 400;

  /** Close delay (ms) before hiding after pointer leaves both the
   * trigger and the card. Default 300 — gives users time to move
   * the pointer from trigger to card. */
  @property({ type: Number, attribute: "close-delay" })
  closeDelay = 300;

  @state() private isOpen = false;
  @state() private positionStyle = "";

  private trigger: HTMLElement | null = null;
  private openTimer: number | null = null;
  private closeTimer: number | null = null;
  private disposeEscape: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    queueMicrotask(() => this.wireTrigger());
    window.addEventListener("resize", this.handleViewportChange);
    window.addEventListener("scroll", this.handleViewportChange, true);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwireTrigger();
    window.removeEventListener("resize", this.handleViewportChange);
    window.removeEventListener("scroll", this.handleViewportChange, true);
    this.clearTimers();
    this.disposeEscape?.();
  }

  private wireTrigger(): void {
    const candidate = Array.from(this.children).find((el): el is HTMLElement => {
      return el instanceof HTMLElement && el.getAttribute("slot") !== "content";
    });
    if (!candidate || candidate === this.trigger) {
      return;
    }
    this.trigger = candidate;
    candidate.addEventListener("mouseenter", this.handleEnter);
    candidate.addEventListener("mouseleave", this.handleLeave);
    candidate.addEventListener("focusin", this.handleEnter);
    candidate.addEventListener("focusout", this.handleLeave);
    this.addEventListener("mouseenter", this.handleCardEnter);
    this.addEventListener("mouseleave", this.handleLeave);
  }

  private unwireTrigger(): void {
    if (!this.trigger) {
      return;
    }
    this.trigger.removeEventListener("mouseenter", this.handleEnter);
    this.trigger.removeEventListener("mouseleave", this.handleLeave);
    this.trigger.removeEventListener("focusin", this.handleEnter);
    this.trigger.removeEventListener("focusout", this.handleLeave);
    this.removeEventListener("mouseenter", this.handleCardEnter);
    this.removeEventListener("mouseleave", this.handleLeave);
    this.trigger = null;
  }

  private clearTimers(): void {
    if (this.openTimer !== null) {
      window.clearTimeout(this.openTimer);
      this.openTimer = null;
    }
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  private handleEnter = (): void => {
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    if (this.isOpen) {
      return;
    }
    this.openTimer = window.setTimeout(() => {
      this.openTimer = null;
      this.show();
    }, this.openDelay);
  };

  private handleLeave = (): void => {
    if (this.openTimer !== null) {
      window.clearTimeout(this.openTimer);
      this.openTimer = null;
    }
    if (!this.isOpen) {
      return;
    }
    this.closeTimer = window.setTimeout(() => {
      this.closeTimer = null;
      this.hide();
    }, this.closeDelay);
  };

  private handleCardEnter = (): void => {
    // Cursor moved from trigger onto the card — cancel any pending
    // close.
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  };

  private handleViewportChange = (): void => {
    if (this.isOpen) {
      this.reposition();
    }
  };

  private show(): void {
    this.isOpen = true;
    this.disposeEscape = onEscape(() => this.hide());
    this.dispatchEvent(new CustomEvent("hp-hover-card-open", { bubbles: true, composed: true }));
    requestAnimationFrame(() => this.reposition());
  }

  private hide(): void {
    this.isOpen = false;
    this.disposeEscape?.();
    this.disposeEscape = null;
    this.dispatchEvent(new CustomEvent("hp-hover-card-close", { bubbles: true, composed: true }));
  }

  private reposition(): void {
    if (!this.trigger) {
      return;
    }
    const card = this.renderRoot.querySelector<HTMLElement>(".card");
    if (!card) {
      return;
    }
    const anchorRect = this.trigger.getBoundingClientRect();
    const floatingRect = card.getBoundingClientRect();
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

      .card {
        position: fixed;
        z-index: var(--hp-layer-toast, 80);
        background: var(--hp-surface-container-high);
        color: var(--hp-on-surface);
        border: 1px solid var(--hp-outline-variant);
        padding: var(--hp-md);
        max-width: 320px;
        font-family: var(--hp-typo-body-sm-font-family);
        font-size: var(--hp-typo-body-sm-font-size);
        line-height: var(--hp-typo-body-sm-line-height);
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--hp-duration-medium) var(--hp-ease-default);
      }

      .card.open {
        opacity: 1;
        pointer-events: auto;
      }
    `,
  ];

  override render() {
    return html`
      <slot @slotchange=${() => this.wireTrigger()}></slot>
      <div
        class=${`card ${this.isOpen ? "open" : ""}`}
        part="card"
        role="dialog"
        ?hidden=${!this.isOpen}
        style=${this.positionStyle}
      >
        <slot name="content"></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-hover-card": HpHoverCard;
  }
}
