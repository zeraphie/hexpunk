// hp-tooltip.ts — Lightweight tooltip.
//
// Wraps a trigger element and shows the slotted `content` on hover /
// focus.
// aria-describedby on the trigger when the tooltip is visible,
// Escape dismisses, hidden on blur / mouseleave. Positioning is the
// minimal "below the trigger by default" — for full anchor / flip /
// collision handling, use the (forthcoming) hp-popover.

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

export type HpTooltipSide = "top" | "right" | "bottom" | "left";

/**
 * Lightweight tooltip — wraps a trigger element and shows the
 * slotted `content` on hover / focus. role="tooltip", auto
 * aria-describedby on the trigger while visible, Escape dismisses.
 *
 * @slot - Trigger element (first child)
 * @slot content - Tooltip body
 *
 * @csspart tooltip - The tooltip body element
 */
@customElement("hp-tooltip")
export class HpTooltip extends LitElement {
  /** Tooltip side relative to the trigger. */
  @property({ reflect: true })
  side: HpTooltipSide = "top";

  /** Delay before showing on hover (ms). Default 300. Reduces
   * flickering when the cursor passes over a trigger. */
  @property({ type: Number, attribute: "open-delay" })
  openDelay = 300;

  /** Delay before hiding on mouseleave (ms). Default 100. */
  @property({ type: Number, attribute: "close-delay" })
  closeDelay = 100;

  @state() private isOpen = false;

  private tooltipId = `hp-tooltip-${++HpTooltip.instanceCounter}`;
  private static instanceCounter = 0;

  private openTimer: number | null = null;
  private closeTimer: number | null = null;
  private trigger: HTMLElement | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    queueMicrotask(() => this.wireTrigger());
    document.addEventListener("keydown", this.handleKeyDown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeyDown);
    this.clearTimers();
    this.unwireTrigger();
  }

  private wireTrigger(): void {
    const trigger = this.querySelector<HTMLElement>(":not([slot='content']):first-child");
    if (!trigger || trigger === this.trigger) {
      return;
    }
    this.trigger = trigger;
    trigger.addEventListener("mouseenter", this.handleEnter);
    trigger.addEventListener("mouseleave", this.handleLeave);
    trigger.addEventListener("focusin", this.handleEnter);
    trigger.addEventListener("focusout", this.handleLeave);
  }

  private unwireTrigger(): void {
    if (!this.trigger) {
      return;
    }
    this.trigger.removeEventListener("mouseenter", this.handleEnter);
    this.trigger.removeEventListener("mouseleave", this.handleLeave);
    this.trigger.removeEventListener("focusin", this.handleEnter);
    this.trigger.removeEventListener("focusout", this.handleLeave);
    this.trigger.removeAttribute("aria-describedby");
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

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.isOpen) {
      this.hide();
    }
  };

  private show(): void {
    this.isOpen = true;
    if (this.trigger) {
      this.trigger.setAttribute("aria-describedby", this.tooltipId);
    }
  }

  private hide(): void {
    this.isOpen = false;
    if (this.trigger) {
      this.trigger.removeAttribute("aria-describedby");
    }
  }

  static override styles = [
    hpBase,
    css`
      :host {
        position: relative;
        display: inline-block;
        line-height: var(--hp-typo-body-md-line-height);
      }

      .tooltip {
        position: absolute;
        z-index: var(--hp-layer-toast, 80);
        background: var(--hp-surface-container-high);
        color: var(--hp-on-surface);
        padding: var(--hp-xs) var(--hp-sm);
        border: 1px solid var(--hp-outline-variant);
        font-family: var(--hp-typo-label-sm-font-family);
        font-size: var(--hp-typo-label-sm-font-size);
        line-height: var(--hp-typo-label-sm-line-height);
        letter-spacing: var(--hp-typo-label-sm-letter-spacing);
        text-transform: uppercase;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity var(--hp-duration-medium) var(--hp-ease-default);
      }

      .tooltip.open {
        opacity: 1;
      }

      .tooltip.top {
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
      }

      .tooltip.bottom {
        top: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
      }

      .tooltip.left {
        right: calc(100% + 8px);
        top: 50%;
        transform: translateY(-50%);
      }

      .tooltip.right {
        left: calc(100% + 8px);
        top: 50%;
        transform: translateY(-50%);
      }
    `,
  ];

  override render() {
    return html`
      <slot @slotchange=${() => this.wireTrigger()}></slot>
      <div
        class=${`tooltip ${this.side} ${this.isOpen ? "open" : ""}`}
        id=${this.tooltipId}
        role="tooltip"
        part="tooltip"
      >
        <slot name="content"></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-tooltip": HpTooltip;
  }
}
