// hp-sidebar-group.ts — Collapsible section inside hp-sidebar.
//
// Wraps a native <details>/<summary> with sidebar-themed chrome:
// SVG-mask chevron that rotates around its true centre on open,
// hover background, indented child slot. Set `label` for the
// summary text and `open` to start expanded; the attribute reflects
// the user's toggle interaction.
//
// Nested groups (groups inside another hp-sidebar-group) switch to
// an uppercase label-sm summary via `:host-context()` so a long nav
// tree doesn't read as a wall of equally-weighted branches.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Collapsible nav section inside `<hp-sidebar>`. Children (typically
 * `<hp-sidebar-item>` and other `<hp-sidebar-group>`) are slotted
 * into the expanded panel.
 *
 * @slot - Group contents (items + nested groups)
 * @csspart summary - The summary row (label + chevron)
 */
@customElement("hp-sidebar-group")
export class HpSidebarGroup extends LitElement {
  /** Summary label text. */
  @property({ type: String }) label = "";

  /** Whether the section is expanded. Reflects user toggles. */
  @property({ type: Boolean, reflect: true }) open = false;

  static override styles = [
    hpBase,
    css`
      :host {
        display: block;
        font-size: var(--hp-typo-body-sm-font-size);
        font-family: var(--hp-typo-body-sm-font-family);
        line-height: var(--hp-typo-body-sm-line-height);
      }

      details {
        margin: 0;
      }

      summary {
        list-style: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: var(--hp-xs);
        padding: var(--hp-sm);
        color: var(--hp-on-surface);
        user-select: none;
        transition: background var(--hp-duration-fast) var(--hp-ease-default);
      }

      summary::-webkit-details-marker {
        display: none;
      }

      /* SVG-mask chevron — rotates cleanly around its geometric
 * centre. A text "›" pivots around its typographic centroid
 * which leaves the rotated glyph visibly off-centre. */
      summary::before {
        content: "";
        flex-shrink: 0;
        display: inline-block;
        width: 10px;
        height: 10px;
        background-color: var(--hp-on-surface-variant);
        mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path d='M3.5 2L7 5L3.5 8z'/></svg>")
          center / 10px 10px no-repeat;
        -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path d='M3.5 2L7 5L3.5 8z'/></svg>")
          center / 10px 10px no-repeat;
        transition: transform var(--hp-duration-fast) var(--hp-ease-default);
      }

      details[open] > summary::before {
        transform: rotate(90deg);
      }

      summary:hover {
        background: var(--hp-surface-container-low);
      }

      summary:hover::before {
        background-color: var(--hp-on-surface);
      }

      .items {
        padding-left: var(--hp-md);
      }

      /* Nested groups: uppercase label-sm summary so the sidebar
 * doesn't read as a wall of competing top-level branches.
 * :host-context matches if the host has any ancestor matching
 * the selector — i.e. this group sits inside another group. */
      :host-context(hp-sidebar-group) summary {
        font-family: var(--hp-typo-label-sm-font-family);
        font-size: var(--hp-typo-label-sm-font-size);
        font-weight: var(--hp-typo-label-sm-font-weight);
        letter-spacing: var(--hp-typo-label-sm-letter-spacing);
        color: var(--hp-on-surface-variant);
        text-transform: uppercase;
      }
    `,
  ];

  private onToggle(ev: Event) {
    this.open = (ev.currentTarget as HTMLDetailsElement).open;
  }

  override render() {
    return html`<details ?open=${this.open} @toggle=${this.onToggle}>
      <summary part="summary">${this.label}</summary>
      <div class="items"><slot></slot></div>
    </details>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-sidebar-group": HpSidebarGroup;
  }
}
