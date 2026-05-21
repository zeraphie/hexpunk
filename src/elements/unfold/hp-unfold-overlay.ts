// hp-unfold-overlay.ts — Lightbox-style hex overlay.
//
// Second of three sibling unfold primitives. Companion to:
// - hp-unfold-list (ring expansion in place)
// - hp-unfold-page (cross-document camera-zoom via View Transitions)
//
// Click / Enter / Space on the source slot opens a hex-clipped native
// <dialog> at the viewport centre containing the slotted detail
// content. Esc closes natively (modal dialog contract); a backdrop-
// click handler closes via the same path (native <dialog> doesn't
// ship light dismiss, so we add it). showModal() gives us Top Layer,
// the ::backdrop pseudo-element, and a focus trap for free — no
// z-index management.
//
// **Authoring:**
//
// <hp-unfold-overlay>
// <hp-cell variant="anchor" slot="source">PLAYER</hp-cell>
// <h2>kira_chen</h2>
// <p>Level 42 hexcrafter — Western Loop division</p>
// <p>Recent: completed "Stardust Refactor"</p>
// <hp-cell variant="action" filled tabindex="0">profile</hp-cell>
// </hp-unfold-overlay>
//
// The source slot stays in the page flow (clickable trigger). The
// default slot is the detail content rendered inside the centred
// hex dialog. Content should fit roughly within the hex shape —
// the clip-path cuts at the corners, so wide rectangular layouts
// will lose their edges.
//
// **Animation.** Opens with a scale + opacity tween from
// `hp-unfold-trigger` duration; closes with a reverse tween. The
// "fly from source to centre" morph (View Transitions API) is
// deferred to a later iteration — the current Docking-style scale
// matches the rest of the system's overlay vocabulary
// (hp-dialog / hp-popover when those land).

import { LitElement, css, html } from "lit";
import { customElement, property, query } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Hex-clipped lightbox / modal. Native <dialog> + showModal() under
 * the hood; the slotted body is clipped to a hex shape with an
 * animated open / close.
 *
 * @fires hp-unfold-open - When the overlay opens
 * @fires hp-unfold-close - When the overlay closes (backdrop or .close())
 *
 * @slot source - The trigger element (always visible)
 * @slot - The overlay body content
 */
@customElement("hp-unfold-overlay")
export class HpUnfoldOverlay extends LitElement {
  /** Reflected open / closed state. Setting it imperatively calls
   * showModal / close on the inner <dialog>. */
  @property({ reflect: true, type: Boolean })
  open = false;

  @query("dialog")
  private dialogEl!: HTMLDialogElement;

  private sourceEl: HTMLElement | null = null;
  private sourceListeners: AbortController | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    // While the overlay is open, the dialog is in Top Layer and the
    // backdrop catches viewport clicks — but those events still
    // bubble up through this host into a containing <hp-grid>, which
    // sees a pointerdown on its [q][r] child, initiates drag, and
    // preventDefaults — swallowing the click that should close us.
    // Stopping pointer events at the host (only while open) keeps
    // the grid out of the way without crippling grid interaction
    // when the overlay is closed.
    this.addEventListener("pointerdown", this.onHostPointerEvent);
    this.addEventListener("wheel", this.onHostPointerEvent, { passive: true });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("pointerdown", this.onHostPointerEvent);
    this.removeEventListener("wheel", this.onHostPointerEvent);
    this.sourceListeners?.abort();
    this.sourceListeners = null;
  }

  private readonly onHostPointerEvent = (ev: Event): void => {
    if (this.open) {
      ev.stopPropagation();
    }
  };

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("open")) {
      if (this.sourceEl) {
        if (this.open) {
          this.sourceEl.setAttribute("aria-pressed", "true");
        } else {
          this.sourceEl.removeAttribute("aria-pressed");
        }
      }
      if (this.dialogEl) {
        if (this.open && !this.dialogEl.open) {
          this.dialogEl.showModal();
        } else if (!this.open && this.dialogEl.open) {
          this.dialogEl.close();
        }
      }
      this.dispatchEvent(
        new CustomEvent(this.open ? "hp-unfold-open" : "hp-unfold-close", {
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  /** Toggle handler; exposed publicly for consumers who want their
   * own trigger surface. */
  toggle(): void {
    this.open = !this.open;
  }

  /** Imperative close. Native Esc handling closes the dialog too —
   * this method exists for programmatic close (e.g., from a "back"
   * button inside the overlay). */
  close(): void {
    if (this.open) {
      this.open = false;
    }
  }

  private readonly onSourceSlotChange = (ev: Event): void => {
    const slot = ev.target as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true });
    const nextSource = (assigned[0] as HTMLElement | undefined) ?? null;

    this.sourceListeners?.abort();
    this.sourceEl = nextSource;
    if (!nextSource) {
      return;
    }

    if (!nextSource.hasAttribute("tabindex")) {
      nextSource.setAttribute("tabindex", "0");
    }
    if (this.open) {
      nextSource.setAttribute("aria-pressed", "true");
    }

    const ctl = new AbortController();
    nextSource.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        this.toggle();
      },
      { signal: ctl.signal }
    );
    // Stop pan-passthrough when inside a hp-grid — same fix as
    // hp-unfold-list. Clicks on the source's hex polygon claim the
    // event so the grid's pan listener never fires.
    nextSource.addEventListener(
      "pointerdown",
      (e) => {
        if ((e as PointerEvent).button !== 0) {
          return;
        }
        e.stopPropagation();
      },
      { signal: ctl.signal }
    );
    nextSource.addEventListener(
      "keydown",
      (e) => {
        const key = (e as KeyboardEvent).key;
        if (key === "Enter" || key === " ") {
          e.preventDefault();
          this.toggle();
        }
      },
      { signal: ctl.signal }
    );
    this.sourceListeners = ctl;
  };

  /** Backdrop-click dismissal. Native <dialog> doesn't ship light
   * dismiss; clicking the dialog element itself (rather than its
   * content) indicates the user clicked the backdrop area (the
   * dialog's bbox is the full clipped area; the content sits inside
   * child elements that catch their own clicks). For the hex-
   * clipped dialog, clicks outside the clip pass through to the
   * backdrop and re-target to the dialog. */
  private readonly onDialogClick = (ev: MouseEvent): void => {
    if (ev.target === this.dialogEl) {
      this.close();
    }
  };

  /** Sync state if the dialog is closed by some other path (native
   * Esc, dialog.close() from outside, etc.) — keeps the `open`
   * property and aria-pressed in lockstep with the dialog. */
  private readonly onDialogClose = (): void => {
    if (this.open) {
      this.open = false;
    }
  };

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
        line-height: var(--hp-typo-body-md-line-height);
      }

      ::slotted([slot="source"]) {
        cursor: var(--hp-cursor, pointer);
      }

      dialog {
        position: fixed;
        inset: 0;
        margin: auto;
        width: 70vmin;
        height: calc(70vmin * 1.1547);
        max-width: 90vw;
        max-height: 90vh;
        padding: 0;
        border: 0;
        background: var(--hp-surface-container);
        color: var(--hp-on-surface);
        clip-path: var(--hp-hex-clip);
        animation: hp-overlay-close var(--hp-unfold-trigger) var(--hp-ease-default) forwards;
        pointer-events: auto;
      }

      dialog[open] {
        animation: hp-overlay-open var(--hp-unfold-bloom) var(--hp-ease-default) forwards;
      }

      dialog::backdrop {
        background: color-mix(in oklab, var(--hp-surface-container-lowest) 60%, transparent);
        animation: hp-overlay-backdrop-in var(--hp-unfold-overlay-fade) var(--hp-ease-default)
          forwards;
      }

      @keyframes hp-overlay-open {
        from {
          transform: scale(0.2);
          opacity: 0;
        }
        to {
          transform: scale(1);
          opacity: 1;
        }
      }

      @keyframes hp-overlay-close {
        from {
          transform: scale(1);
          opacity: 1;
        }
        to {
          transform: scale(0.2);
          opacity: 0;
        }
      }

      @keyframes hp-overlay-backdrop-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .content {
        display: grid;
        place-items: center;
        gap: var(--hp-md);
        padding: var(--hp-xl);
        text-align: center;
        width: 100%;
        height: 100%;
        /* Inner padding so content stays clear of the hex's slanted
 * corners — the clip-path otherwise eats wide rectangular
 * content at the top / bottom. */
        box-sizing: border-box;
      }

      ::slotted(:not([slot="source"])) {
        max-width: 100%;
      }

      /* Close button sits in the top-right region of the hex's inner
 * rect (the largest axis-aligned rect inside the polygon).
 * For a pointy-top hex, the slanted top-right edge runs from
 * (50%, 0%) to (100%, 25%) — anything above that line gets
 * clipped. With the button at right: 16% / top: 20%, the
 * polygon at the button's right-edge x has its boundary
 * already passed (at ~17%), so the whole button fits inside
 * the clip. 32px keeps a margin even on narrow viewports. */
      .close-btn {
        position: absolute;
        top: 20%;
        right: 16%;
        width: 32px;
        height: 32px;
        padding: 0;
        border: 1px solid var(--hp-outline-variant);
        border-radius: var(--hp-rounded-sm);
        background: transparent;
        color: var(--hp-on-surface-variant);
        font: inherit;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        transition:
          color var(--hp-duration-fast) var(--hp-ease-default),
          border-color var(--hp-duration-fast) var(--hp-ease-default);
      }

      .close-btn:hover,
      .close-btn:focus-visible {
        color: var(--hp-secondary);
        border-color: var(--hp-secondary);
      }

      @media (prefers-reduced-motion: reduce) {
        dialog,
        dialog[open],
        dialog::backdrop {
          animation: none !important;
        }
      }
    `,
  ];

  override render() {
    return html`
      <slot name="source" @slotchange=${this.onSourceSlotChange}></slot>
      <dialog part="overlay" @click=${this.onDialogClick} @close=${this.onDialogClose}>
        <button
          type="button"
          class="close-btn"
          part="close"
          aria-label="Close"
          @click=${this.close}
        >
          ×
        </button>
        <div class="content" part="content">
          <slot></slot>
        </div>
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-unfold-overlay": HpUnfoldOverlay;
  }
}
