// hp-toast.ts — Transient notification toast.
//
// Self-dismissing notification that slides into the corner of the
// viewport.
// auto-dismiss after `duration` ms (set 0 to make it sticky), tone
// for semantic colour (info / positive / warn / alert / error),
// role="status" by default (or role="alert" for urgent variants
// via `tone="alert" | "error"`).
//
// Position is configurable per-toast via the `position` attribute;
// for a stacking manager that handles multiple toasts in one
// corner, layer toasts inside a fixed-position container at the
// desired corner — the toasts themselves are position: relative
// inside such a container.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

export type HpToastTone = "neutral" | "positive" | "warn" | "alert" | "error";

/**
 * Transient notification toast. Slides in, auto-dismisses after
 * `duration` ms (0 = sticky). `alert` / `error` tones upgrade
 * aria-live to assertive.
 *
 * @fires hp-toast-open - When the toast becomes visible
 * @fires hp-toast-close - When the toast closes (auto or via .close())
 *
 * @slot - Toast message body
 *
 * @csspart toast - The wrapping toast element
 * @csspart content - The content container
 */
@customElement("hp-toast")
export class HpToast extends LitElement {
  /** Open state — drives the slide-in animation. */
  @property({ reflect: true, type: Boolean })
  open = false;

  /** Semantic tone. `alert` / `error` upgrade role to "alert" for
   * assertive screen-reader announcement. */
  @property({ reflect: true })
  tone: HpToastTone = "neutral";

  /** Auto-dismiss after this many ms. 0 = sticky (manual close
   * only). Default 4000. */
  @property({ type: Number })
  duration = 4000;

  private dismissTimer: number | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncRole();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.dismissTimer !== null) {
      window.clearTimeout(this.dismissTimer);
    }
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("tone")) {
      this.syncRole();
    }
    if (changed.has("open")) {
      if (this.open) {
        this.scheduleDismiss();
        this.dispatchEvent(new CustomEvent("hp-toast-open", { bubbles: true, composed: true }));
      } else {
        this.dispatchEvent(new CustomEvent("hp-toast-close", { bubbles: true, composed: true }));
      }
    }
  }

  private syncRole(): void {
    const assertive = this.tone === "alert" || this.tone === "error";
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", assertive ? "alert" : "status");
    }
    if (!this.hasAttribute("aria-live")) {
      this.setAttribute("aria-live", assertive ? "assertive" : "polite");
    }
  }

  private scheduleDismiss(): void {
    if (this.dismissTimer !== null) {
      window.clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    if (this.duration > 0) {
      this.dismissTimer = window.setTimeout(() => {
        this.dismissTimer = null;
        this.close();
      }, this.duration);
    }
  }

  /** Show the toast (slides in, starts the auto-dismiss timer). */
  public show(): void {
    this.open = true;
  }

  /** Close the toast (slides out). */
  public close(): void {
    this.open = false;
  }

  private handleClose = (): void => {
    this.close();
  };

  static override styles = [
    hpBase,
    css`
      :host {
        display: block;
        max-width: 360px;
        line-height: var(--hp-typo-body-md-line-height);
        --hp-toast-stroke: var(--hp-outline-variant);
        --hp-toast-label: var(--hp-on-surface);
      }

      :host([tone="positive"]) {
        --hp-toast-stroke: var(--hp-secondary);
        --hp-toast-label: var(--hp-secondary);
      }
      :host([tone="warn"]) {
        --hp-toast-stroke: var(--hp-warn);
        --hp-toast-label: var(--hp-warn);
      }
      :host([tone="alert"]) {
        --hp-toast-stroke: var(--hp-alert);
        --hp-toast-label: var(--hp-alert);
      }
      :host([tone="error"]) {
        --hp-toast-stroke: var(--hp-error);
        --hp-toast-label: var(--hp-error);
      }

      .toast {
        display: flex;
        align-items: flex-start;
        gap: var(--hp-sm);
        background: var(--hp-surface-container-high);
        border: 1px solid var(--hp-toast-stroke);
        padding: var(--hp-md);
        opacity: 0;
        transform: translateY(8px);
        transition:
          opacity var(--hp-duration-medium) var(--hp-ease-default),
          transform var(--hp-duration-medium) var(--hp-ease-default);
        pointer-events: none;
      }

      :host([open]) .toast {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      .content {
        flex: 1 1 auto;
        font-family: var(--hp-typo-body-sm-font-family);
        font-size: var(--hp-typo-body-sm-font-size);
        line-height: var(--hp-typo-body-sm-line-height);
        color: var(--hp-toast-label);
      }

      .close {
        flex: 0 0 auto;
        background: transparent;
        border: none;
        padding: 4px;
        cursor: pointer;
        color: var(--hp-on-surface-variant);
        line-height: 0;
        border-radius: 2px;
      }

      .close:hover,
      .close:focus-visible {
        color: var(--hp-on-surface);
      }

      .close:focus-visible {
        outline: 2px solid var(--hp-focus-ring);
        outline-offset: 1px;
      }

      .close svg {
        width: 12px;
        height: 12px;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: square;
      }
    `,
  ];

  override render() {
    return html`
      <div class="toast" part="toast">
        <div class="content" part="content">
          <slot></slot>
        </div>
        <button class="close" type="button" aria-label="Close" @click=${this.handleClose}>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <line x1="2" y1="2" x2="10" y2="10"></line>
            <line x1="10" y1="2" x2="2" y2="10"></line>
          </svg>
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-toast": HpToast;
  }
}
