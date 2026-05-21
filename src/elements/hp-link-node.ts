// hp-link-node.ts — Arc-link endpoint dot.
//
// The small filled circle at a hex's edge or anchor point where
// arc-links (`<hp-link>`) originate and terminate. 4px (`spacing.xs`)
// at default density, filled `primary` (blue) at rest, promotes to
// filled `secondary` (green) when an arc connects to it.
//
// Presentational atom — placed by `<hp-link>` / `<hp-graph>` rather
// than authored directly by consumers in most cases.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../styles/hp-base.js";

/**
 * Endpoint dot for hp-tether arcs. Tiny filled marker.
 *
 * @deprecated Will be folded into hp-tether's internal rendering.
 */
@customElement("hp-link-node")
export class HpLinkNode extends LitElement {
  /** When set, the node is bonded to at least one arc-link and fills with `secondary`. */
  @property({ reflect: true, type: Boolean })
  bonded = false;

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
        width: var(--hp-xs);
        height: var(--hp-xs);
        pointer-events: none;
      }

      .node {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: var(--hp-primary);
        transition: background var(--hp-duration-medium) var(--hp-ease-default);
      }

      :host([bonded]) .node {
        background: var(--hp-secondary);
      }
    `,
  ];

  override render() {
    return html`<div class="node" part="node" aria-hidden="true"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-link-node": HpLinkNode;
  }
}
