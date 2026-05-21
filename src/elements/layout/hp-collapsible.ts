// hp-collapsible.ts — Trigger + collapsible content pair.
//
//
// content region that expands / collapses on activation. The
// trigger toggles the `open` attribute on the host; the content
// shows / hides accordingly. Smooth height transition via
// auto-measured grid template.
//
// Authoring shape — trigger goes in the `trigger` slot, content
// in the default slot:
//
// <hp-collapsible>
// <hp-button slot="trigger">show details</hp-button>
// <p>... revealed content ...</p>
// </hp-collapsible>

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Disclosure: trigger + collapsible content. Trigger toggles
 * `open`; content expands via a smooth grid-template-rows
 * transition. aria-expanded + aria-controls wire automatically.
 *
 * @fires hp-collapsible-open - When the panel opens
 * @fires hp-collapsible-close - When the panel closes
 *
 * @slot trigger - The element that toggles open / close
 * @slot - Revealed content (default slot)
 *
 * @csspart trigger - The trigger container
 * @csspart content - The collapsible content region
 */
@customElement("hp-collapsible")
export class HpCollapsible extends LitElement {
  /** Open / closed state. Reflects to the host. */
  @property({ reflect: true, type: Boolean })
  open = false;

  /** Disabled — blocks the trigger and removes it from the tab
   * order. */
  @property({ reflect: true, type: Boolean })
  disabled = false;

  private triggerId = `hp-collapsible-trigger-${++HpCollapsible.instanceCounter}`;
  private contentId = `hp-collapsible-content-${HpCollapsible.instanceCounter}`;
  private static instanceCounter = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("click", this.handleClick);
    queueMicrotask(() => this.wireTrigger());
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("open")) {
      this.wireTrigger();
      this.dispatchEvent(
        new CustomEvent(this.open ? "hp-collapsible-open" : "hp-collapsible-close", {
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private wireTrigger(): void {
    const trigger = this.querySelector<HTMLElement>('[slot="trigger"]');
    if (!trigger) {
      return;
    }
    trigger.id = trigger.id || this.triggerId;
    trigger.setAttribute("aria-expanded", this.open ? "true" : "false");
    trigger.setAttribute("aria-controls", this.contentId);
    if (this.disabled) {
      trigger.setAttribute("aria-disabled", "true");
    } else {
      trigger.removeAttribute("aria-disabled");
    }
  }

  private handleClick = (event: MouseEvent): void => {
    const trigger = this.querySelector<HTMLElement>('[slot="trigger"]');
    if (!trigger) {
      return;
    }
    if (!event.composedPath().includes(trigger)) {
      return;
    }
    if (this.disabled) {
      event.preventDefault();
      return;
    }
    this.open = !this.open;
  };

  /** Toggle programmatically. */
  public toggle(): void {
    if (!this.disabled) {
      this.open = !this.open;
    }
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: block;
        /* Override hpBase line-height: 0 — slotted content contains
 * real text that needs a sensible default. */
        line-height: var(--hp-typo-body-md-line-height);
      }

      .content {
        overflow: hidden;
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows var(--hp-duration-medium) var(--hp-ease-default);
      }

      :host([open]) .content {
        grid-template-rows: 1fr;
      }

      .inner {
        min-height: 0;
      }

      @media (prefers-reduced-motion: reduce) {
        .content {
          transition: none;
        }
      }
    `,
  ];

  override render() {
    return html`
      <div class="trigger" part="trigger">
        <slot name="trigger"></slot>
      </div>
      <div
        class="content"
        part="content"
        id=${this.contentId}
        role="region"
        aria-labelledby=${this.triggerId}
        ?aria-hidden=${!this.open}
      >
        <div class="inner">
          <slot></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-collapsible": HpCollapsible;
  }
}
