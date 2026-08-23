// hp-dialog.ts — Modal dialog.
//
// Wraps a native <dialog> with showModal() so the browser handles
// focus trapping, Escape-dismisses, and aria-modal automatically.
//
// (`.open` / `.close()`), `open` boolean attribute reflection,
// `hp-dialog-open` / `hp-dialog-close` events. Backdrop click
// closes by default — set `no-backdrop-close` to disable, or set
// `alert` for the confirm/destructive variant: role="alertdialog"
// and no backdrop dismiss, so only an explicit action (or Escape)
// closes it. The `actions` slot renders a right-aligned button row.
//
// For higher-level overlays with hex-clipped visuals + animation,
// see hp-unfold-overlay. This element is the plain modal layer.

import { LitElement, css, html } from "lit";
import { customElement, property, query } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Modal dialog backed by the native <dialog> + showModal(). Browser
 * focus trap + Escape dismiss + aria-modal. Backdrop click closes
 * by default — `no-backdrop-close` opts out, and `alert` makes it
 * an alertdialog that never backdrop-dismisses (destructive
 * confirmations, blocking errors).
 *
 * @fires hp-dialog-open - When the dialog opens (open transitions to true)
 * @fires hp-dialog-close - When the dialog closes (backdrop click, Escape, or .close())
 *
 * @slot - Dialog body content
 * @slot actions - Action buttons, right-aligned (typically cancel + confirm)
 *
 * @csspart dialog - The native <dialog> element
 * @status wip
 */
@customElement("hp-dialog")
export class HpDialog extends LitElement {
  /** Reflect open state. Setting `open` programmatically calls
   * showModal(); clearing it calls close(). */
  @property({ reflect: true, type: Boolean })
  open = false;

  /** When set, clicking the backdrop doesn't close. Use for
   * destructive / blocking dialogs that require an explicit
   * action. */
  @property({ reflect: true, type: Boolean, attribute: "no-backdrop-close" })
  noBackdropClose = false;

  /** Alert variant — role="alertdialog", and the backdrop never
   * dismisses; an explicit action (or Escape) closes. */
  @property({ reflect: true, type: Boolean })
  alert = false;

  @query("dialog") private dialogEl!: HTMLDialogElement;

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("open")) {
      if (this.open) {
        if (!this.dialogEl.open) {
          this.dialogEl.showModal();
        }
      } else if (this.dialogEl.open) {
        this.dialogEl.close();
      }
    }
  }

  /** Show as a modal (focus-trapped, on top of inert siblings). */
  public show(): void {
    this.open = true;
  }

  /** Close the dialog and dispatch hp-dialog-close. */
  public close(): void {
    this.open = false;
  }

  private handleNativeClose = (): void => {
    this.open = false;
    this.dispatchEvent(new CustomEvent("hp-dialog-close", { bubbles: true, composed: true }));
  };

  private handleNativeOpen = (): void => {
    this.dispatchEvent(new CustomEvent("hp-dialog-open", { bubbles: true, composed: true }));
  };

  private handleBackdropClick = (event: MouseEvent): void => {
    if (this.noBackdropClose || this.alert) {
      return;
    }
    // Backdrop click hits the dialog element directly; clicks on
    // children land on the descendant. Distinguish via target.
    if (event.target === this.dialogEl) {
      this.close();
    }
  };

  static override styles = [
    hpBase,
    css`
      :host {
        display: contents;
        line-height: var(--hp-typo-body-md-line-height);
      }

      dialog {
        background: var(--hp-surface-container);
        color: var(--hp-on-surface);
        border: 1px solid var(--hp-outline-variant);
        padding: var(--hp-lg);
        max-width: min(90vw, 480px);
        font-family: var(--hp-typo-body-md-font-family);
        font-size: var(--hp-typo-body-md-font-size);
        line-height: var(--hp-typo-body-md-line-height);
        color: var(--hp-on-surface);
      }

      dialog::backdrop {
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(2px);
      }

      dialog[open] {
        animation: hp-dialog-in var(--hp-duration-medium) var(--hp-ease-default);
      }

      @keyframes hp-dialog-in {
        from {
          opacity: 0;
          transform: scale(0.96);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        dialog[open] {
          animation: none;
        }
      }

      /* The slot itself is the action row; an empty slot renders
       * nothing, and the top gap rides the slotted children. */
      slot[name="actions"] {
        display: flex;
        justify-content: flex-end;
        gap: var(--hp-md);
      }

      slot[name="actions"]::slotted(*) {
        margin-top: var(--hp-lg);
      }
    `,
  ];

  override render() {
    return html`
      <dialog
        part="dialog"
        role=${this.alert ? "alertdialog" : "dialog"}
        @close=${this.handleNativeClose}
        @cancel=${this.handleNativeClose}
        @click=${this.handleBackdropClick}
      >
        <slot></slot>
        <slot name="actions"></slot>
      </dialog>
    `;
  }

  override firstUpdated(): void {
    if (this.open) {
      this.dialogEl.showModal();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-dialog": HpDialog;
  }
}
