// hp-alert-dialog.ts — Confirm / destructive dialog.
//
// Variant of hp-dialog with role="alertdialog" for messages the user
// must acknowledge or act on (delete confirmations, error blockers,
// migration warnings). Cannot be dismissed by clicking the backdrop
// — only an explicit action button or Escape closes it.
//
// Authoring:
//
// <hp-alert-dialog id="confirm-delete">
// <h3>Delete project?</h3>
// <p>This can't be undone. 47 files will be removed.</p>
// <div slot="actions">
// <hp-button>cancel</hp-button>
// <hp-button filled>delete</hp-button>
// </div>
// </hp-alert-dialog>

import { LitElement, css, html } from "lit";
import { customElement, property, query } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Alert dialog — role="alertdialog" variant of hp-dialog. Requires
 * an explicit action; backdrop clicks don't dismiss. Use for
 * destructive confirmations and blocking errors.
 *
 * @fires hp-alert-dialog-open - When the dialog opens
 * @fires hp-alert-dialog-close - When the dialog closes
 *
 * @slot - Dialog message body
 * @slot actions - Action buttons (typically cancel + confirm)
 *
 * @csspart dialog - The native <dialog> element
 * @csspart actions - The action button container
 */
@customElement("hp-alert-dialog")
export class HpAlertDialog extends LitElement {
  /** Reflect open state. Setting `open` programmatically opens / closes. */
  @property({ reflect: true, type: Boolean })
  open = false;

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

  /** Show as a modal alert dialog. */
  public show(): void {
    this.open = true;
  }

  /** Close the alert dialog. */
  public close(): void {
    this.open = false;
  }

  private handleNativeClose = (): void => {
    this.open = false;
    this.dispatchEvent(new CustomEvent("hp-alert-dialog-close", { bubbles: true, composed: true }));
  };

  /** Block backdrop-click dismissal — only explicit action buttons
   * or Escape should close an alert dialog. */
  private handleBackdropClick = (event: MouseEvent): void => {
    if (event.target === this.dialogEl) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  override firstUpdated(): void {
    if (this.open) {
      this.dialogEl.showModal();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("hp-alert-dialog-open", () => {
      // For consumers that dispatch the open event themselves.
    });
  }

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
        border: 1px solid var(--hp-error);
        padding: var(--hp-lg);
        max-width: min(90vw, 440px);
        font-family: var(--hp-typo-body-md-font-family);
        font-size: var(--hp-typo-body-md-font-size);
        line-height: var(--hp-typo-body-md-line-height);
      }

      dialog::backdrop {
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(2px);
      }

      dialog[open] {
        animation: hp-alert-in var(--hp-duration-medium) var(--hp-ease-default);
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--hp-md);
        margin-top: var(--hp-lg);
      }

      @keyframes hp-alert-in {
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
    `,
  ];

  override render() {
    return html`
      <dialog
        part="dialog"
        role="alertdialog"
        @close=${this.handleNativeClose}
        @cancel=${this.handleNativeClose}
        @click=${this.handleBackdropClick}
      >
        <slot></slot>
        <div class="actions" part="actions">
          <slot name="actions"></slot>
        </div>
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-alert-dialog": HpAlertDialog;
  }
}
