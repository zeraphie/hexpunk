// hp-popover.ts — Anchored floating panel.
//
// Click a trigger to open a floating panel positioned against it.
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
 * Anchored floating panel. Click-triggered; click-outside / Escape
 * dismiss; focus restoration to the trigger on close.
 *
 * @fires hp-popover-open - When the panel opens
 * @fires hp-popover-close - When the panel closes
 *
 * @slot - Trigger element (first child)
 * @slot content - Panel body
 *
 * @csspart panel - The floating panel element
 */
@customElement("hp-popover")
export class HpPopover extends LitElement {
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

  @state() private positionStyle = "";

  private trigger: HTMLElement | null = null;
  private disposeOutside: (() => void) | null = null;
  private disposeEscape: (() => void) | null = null;
  private lastFocused: HTMLElement | null = null;

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
    if (!candidate || candidate === this.trigger) {
      return;
    }
    this.trigger = candidate;
    candidate.addEventListener("click", this.handleTriggerClick);
    if (!candidate.hasAttribute("aria-haspopup")) {
      candidate.setAttribute("aria-haspopup", "dialog");
    }
    candidate.setAttribute("aria-expanded", this.open ? "true" : "false");
  }

  private unwireTrigger(): void {
    if (!this.trigger) {
      return;
    }
    this.trigger.removeEventListener("click", this.handleTriggerClick);
    this.trigger = null;
  }

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
    this.disposeOutside = onOutsidePointer(this, () => {
      this.open = false;
    });
    this.disposeEscape = onEscape(() => {
      this.open = false;
    });
    if (this.trigger) {
      this.trigger.setAttribute("aria-expanded", "true");
    }
    this.dispatchEvent(new CustomEvent("hp-popover-open", { bubbles: true, composed: true }));
    requestAnimationFrame(() => this.reposition());
  }

  private handleClosed(): void {
    this.disposeOutside?.();
    this.disposeOutside = null;
    this.disposeEscape?.();
    this.disposeEscape = null;
    if (this.trigger) {
      this.trigger.setAttribute("aria-expanded", "false");
    }
    // Restore focus only if focus is currently inside the panel.
    if (this.lastFocused && this.contains(document.activeElement)) {
      this.lastFocused.focus();
    }
    this.dispatchEvent(new CustomEvent("hp-popover-close", { bubbles: true, composed: true }));
  }

  private reposition(): void {
    if (!this.trigger) {
      return;
    }
    const panel = this.renderRoot.querySelector<HTMLElement>(".panel");
    if (!panel) {
      return;
    }
    const anchorRect = this.trigger.getBoundingClientRect();
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
