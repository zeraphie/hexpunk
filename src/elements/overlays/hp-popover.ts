// hp-popover.ts — Anchored floating panel.
//
// Click a trigger to open a floating panel positioned against it —
// or set trigger="hover" for the hover-card behaviour: open on
// hover / focus after a delay, close after the pointer leaves both
// the trigger and the panel (interactive content stays reachable).
//
// click-outside / Escape dismiss, focus restoration to the trigger
// on close. Unlike hp-tooltip (lightweight, hover-only, non-
// interactive), the popover body can contain focusable controls.
//
// Authoring:
//
// <hp-popover side="bottom" align="start">
// <hp-button>open</hp-button>
// <div slot="content">
// <h3>Profile</h3>
// <p>...</p>
// </div>
// </hp-popover>
//
// The first non-slotted child is treated as the trigger. Slotted
// content with `slot="content"` is the panel body.

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  onEscape,
  onOutsidePointer,
  positionFloating,
  type FloatingAlign,
  type FloatingSide,
} from "../../lib/floating.js";
import { hpBase } from "../../styles/hp-base.js";

/**
 * Anchored floating panel. trigger="click" (default): click to
 * open, click-outside / Escape dismiss, focus restoration on close.
 * trigger="hover": opens on hover / focus after `open-delay`,
 * closes `close-delay` after the pointer leaves both trigger and
 * panel — the hover-card behaviour, with the panel's interactive
 * content reachable.
 *
 * @fires hp-popover-open - When the panel opens
 * @fires hp-popover-close - When the panel closes
 *
 * @slot - Trigger element (first child)
 * @slot content - Panel body
 *
 * @csspart panel - The floating panel element
 * @status wip
 */
@customElement("hp-popover")
export class HpPopover extends LitElement {
  /** How the panel opens: on the trigger's click, or on hover /
   * focus with delays (the hover-card behaviour). */
  @property({ reflect: true })
  trigger: "click" | "hover" = "click";

  /** Preferred side relative to the trigger. */
  @property({ reflect: true })
  side: FloatingSide = "bottom";

  /** Alignment along the chosen side. */
  @property({ reflect: true })
  align: FloatingAlign = "center";

  /** Pixel gap between trigger and panel. Default 8. */
  @property({ type: Number })
  offset = 8;

  /** Reflect open state. Setting `open` programmatically opens / closes. */
  @property({ reflect: true, type: Boolean })
  open = false;

  /** Open delay (ms) in hover mode — long enough to avoid flashes
   * while skimming, short enough to feel responsive on intent. */
  @property({ type: Number, attribute: "open-delay" })
  openDelay = 400;

  /** Close delay (ms) in hover mode after the pointer leaves both
   * the trigger and the panel — time to travel between them. */
  @property({ type: Number, attribute: "close-delay" })
  closeDelay = 300;

  @state() private positionStyle = "";

  private triggerEl: HTMLElement | null = null;
  private disposeOutside: (() => void) | null = null;
  private disposeEscape: (() => void) | null = null;
  private lastFocused: HTMLElement | null = null;
  private openTimer: number | null = null;
  private closeTimer: number | null = null;

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
    this.disposeOutside?.();
    this.disposeEscape?.();
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("open")) {
      if (this.open) {
        this.handleOpened();
      } else {
        this.handleClosed();
      }
    }
    if (this.open) {
      this.reposition();
    }
  }

  private wireTrigger(): void {
    // First non-"content"-slotted child is the trigger.
    const candidate = Array.from(this.children).find((el): el is HTMLElement => {
      return el instanceof HTMLElement && el.getAttribute("slot") !== "content";
    });
    if (!candidate || candidate === this.triggerEl) {
      return;
    }
    this.triggerEl = candidate;
    if (this.trigger === "hover") {
      candidate.addEventListener("mouseenter", this.handleEnter);
      candidate.addEventListener("mouseleave", this.handleLeave);
      candidate.addEventListener("focusin", this.handleEnter);
      candidate.addEventListener("focusout", this.handleLeave);
      this.addEventListener("mouseenter", this.handleHostEnter);
      this.addEventListener("mouseleave", this.handleLeave);
      return;
    }
    candidate.addEventListener("click", this.handleTriggerClick);
    if (!candidate.hasAttribute("aria-haspopup")) {
      candidate.setAttribute("aria-haspopup", "dialog");
    }
    candidate.setAttribute("aria-expanded", this.open ? "true" : "false");
  }
  private unwireTrigger(): void {
    if (!this.triggerEl) {
      return;
    }
    this.triggerEl.removeEventListener("click", this.handleTriggerClick);
    this.triggerEl.removeEventListener("mouseenter", this.handleEnter);
    this.triggerEl.removeEventListener("mouseleave", this.handleLeave);
    this.triggerEl.removeEventListener("focusin", this.handleEnter);
    this.triggerEl.removeEventListener("focusout", this.handleLeave);
    this.removeEventListener("mouseenter", this.handleHostEnter);
    this.removeEventListener("mouseleave", this.handleLeave);
    this.triggerEl = null;
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
    if (this.open || this.openTimer !== null) {
      return;
    }
    this.openTimer = window.setTimeout(() => {
      this.openTimer = null;
      this.open = true;
    }, this.openDelay);
  };
  /** Pointer entering the open panel cancels the pending close. */
  private handleHostEnter = (): void => {
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  };
  private handleLeave = (): void => {
    if (this.openTimer !== null) {
      window.clearTimeout(this.openTimer);
      this.openTimer = null;
    }
    if (!this.open || this.closeTimer !== null) {
      return;
    }
    this.closeTimer = window.setTimeout(() => {
      this.closeTimer = null;
      this.open = false;
    }, this.closeDelay);
  };

  private handleTriggerClick = (): void => {
    this.open = !this.open;
  };

  private handleViewportChange = (): void => {
    if (this.open) {
      this.reposition();
    }
  };

  private handleOpened(): void {
    this.lastFocused = (document.activeElement as HTMLElement) ?? null;
    // Hover mode closes on leave; outside-click dismissal is the
    // click mode's concern.
    if (this.trigger !== "hover") {
      this.disposeOutside = onOutsidePointer(this, () => {
        this.open = false;
      });
    }
    this.disposeEscape = onEscape(() => {
      this.open = false;
    });
    if (this.triggerEl && this.trigger !== "hover") {
      this.triggerEl.setAttribute("aria-expanded", "true");
    }
    this.dispatchEvent(new CustomEvent("hp-popover-open", { bubbles: true, composed: true }));
    requestAnimationFrame(() => this.reposition());
  }

  private handleClosed(): void {
    this.disposeOutside?.();
    this.disposeOutside = null;
    this.disposeEscape?.();
    this.disposeEscape = null;
    if (this.triggerEl && this.trigger !== "hover") {
      this.triggerEl.setAttribute("aria-expanded", "false");
    }
    // Restore focus only if focus is currently inside the panel.
    if (this.lastFocused && this.contains(document.activeElement)) {
      this.lastFocused.focus();
    }
    this.dispatchEvent(new CustomEvent("hp-popover-close", { bubbles: true, composed: true }));
  }

  private reposition(): void {
    if (!this.triggerEl) {
      return;
    }
    const panel = this.renderRoot.querySelector<HTMLElement>(".panel");
    if (!panel) {
      return;
    }
    const anchorRect = this.triggerEl.getBoundingClientRect();
    const floatingRect = panel.getBoundingClientRect();
    const result = positionFloating(
      anchorRect,
      { width: floatingRect.width, height: floatingRect.height },
      { width: window.innerWidth, height: window.innerHeight },
      { side: this.side, align: this.align, offset: this.offset }
    );
    this.positionStyle = `left: ${result.x}px; top: ${result.y}px;`;
  }

  /** Toggle open / closed programmatically. */
  public toggle(): void {
    this.open = !this.open;
  }

  /** Open the popover. */
  public show(): void {
    this.open = true;
  }

  /** Close the popover. */
  public close(): void {
    this.open = false;
  }

  static override styles = [
    hpBase,
    css`
      :host {
        position: relative;
        display: inline-block;
        line-height: var(--hp-typo-body-md-line-height);
      }

      .panel {
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

      :host([open]) .panel {
        opacity: 1;
        pointer-events: auto;
      }
    `,
  ];

  override render() {
    return html`
      <slot @slotchange=${() => this.wireTrigger()}></slot>
      <div
        class="panel"
        part="panel"
        role="dialog"
        ?hidden=${!this.open}
        style=${this.positionStyle}
      >
        <slot name="content"></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-popover": HpPopover;
  }
}
