// hp-visually-hidden.ts — Screen-reader-only content.
//
// Content rendered inside
// this element is invisible on screen but readable by assistive tech
// — useful for icon-only buttons that need an accessible name, for
// supplementary labels announcing state changes, or for skip-to-main
// links that only appear on focus.
//
// Standard clip-path technique. Inline style is unaffected by parent
// `overflow` because the host uses `position: absolute` with a
// negative margin to keep it out of the layout flow entirely.

import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";

/**
 * Visually hidden but accessible — content is read by assistive tech
 * but doesn't render on screen.
 *
 * @slot - Content for screen readers only
 */
@customElement("hp-visually-hidden")
export class HpVisuallyHidden extends LitElement {
  static override styles = css`
    :host {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }
  `;

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-visually-hidden": HpVisuallyHidden;
  }
}
