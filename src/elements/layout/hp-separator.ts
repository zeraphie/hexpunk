// hp-separator.ts — Visual + semantic divider.
//
// Horizontal (default) or vertical rule.
// primitive: `decorative` flips between role="separator" (default,
// announced as a divider) and role="presentation" (hidden from
// assistive tech — for purely visual breaks where the structural
// hierarchy already conveys grouping).
//
// Visual: a 1px line in --hp-outline-faint. A small hex glyph sits
// at the centre by default (mark="hex"); set `mark="none"` for a
// plain line or `mark="dot"` for a small filled dot when the hex
// glyph competes with adjacent hex content.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

export type HpSeparatorOrientation = "horizontal" | "vertical";
export type HpSeparatorMark = "hex" | "dot" | "none";

/**
 * Visual + semantic divider. Horizontal (default) or vertical;
 * optional centre glyph (hex / dot / none). `decorative` switches
 * between role=separator and role=presentation.
 *
 * @csspart line - The line segments either side of the centre glyph
 * @csspart mark - The centre glyph element
 */
@customElement("hp-separator")
export class HpSeparator extends LitElement {
  /** Layout direction. Horizontal is a row divider; vertical is a
   * column divider. */
  @property({ reflect: true })
  orientation: HpSeparatorOrientation = "horizontal";

  /** When set, the separator is purely visual (role=presentation,
   * invisible to assistive tech). Default unset = role=separator. */
  @property({ reflect: true, type: Boolean })
  decorative = false;

  /** Centre glyph. `hex` (default) reads as a small node on the
   * divider; `dot` is a tighter filled dot; `none` is a clean line. */
  @property({ reflect: true })
  mark: HpSeparatorMark = "hex";

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", this.decorative ? "presentation" : "separator");
    }
    if (this.orientation === "vertical" && !this.hasAttribute("aria-orientation")) {
      this.setAttribute("aria-orientation", "vertical");
    }
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("decorative")) {
      this.setAttribute("role", this.decorative ? "presentation" : "separator");
    }
    if (changed.has("orientation")) {
      if (this.orientation === "vertical") {
        this.setAttribute("aria-orientation", "vertical");
      } else {
        this.removeAttribute("aria-orientation");
      }
    }
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--hp-outline-faint);
        gap: var(--hp-sm);
      }

      :host([orientation="horizontal"]) {
        flex-direction: row;
        width: 100%;
        height: 12px;
      }

      :host([orientation="vertical"]) {
        flex-direction: column;
        height: 100%;
        width: 12px;
      }

      .line {
        background: currentColor;
        flex: 1 1 auto;
      }

      :host([orientation="horizontal"]) .line {
        height: 1px;
        width: 100%;
      }

      :host([orientation="vertical"]) .line {
        width: 1px;
        height: 100%;
      }

      .mark {
        flex: 0 0 auto;
        display: inline-block;
      }

      .mark-hex {
        width: 8px;
        height: 9.24px;
        background: currentColor;
        clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
      }

      .mark-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: currentColor;
      }
    `,
  ];

  override render() {
    // mark="none" means a single continuous line. Rendering two
    // flex children separated by the host's `gap` produces a
    // dashed pattern when separators are stacked end-to-end (e.g.
    // a line-gutter divider in hp-code). With no mark, emit one
    // segment that fills the full extent.
    if (this.mark === "none") {
      return html`<span class="line" part="line"></span>`;
    }
    return html`
      <span class="line" part="line"></span>
      ${this.mark === "hex"
        ? html`<span class="mark mark-hex" part="mark" aria-hidden="true"></span>`
        : html`<span class="mark mark-dot" part="mark" aria-hidden="true"></span>`}
      <span class="line" part="line"></span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-separator": HpSeparator;
  }
}
