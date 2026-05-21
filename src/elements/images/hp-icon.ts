// hp-icon.ts — Stroke icon container.
//
// Sized container that renders an SVG icon via the default slot. The
// SVG should follow Lucide conventions: 24×24 viewBox, 1.5px stroke,
// `currentColor` for both stroke and fill so the icon inherits its
// parent's text colour. Three size presets (`icon-sm` / `-md` / `-lg`)
// from the tokens.
//
// Consumers can also drop in any SVG that uses `currentColor` — Lucide,
// Tabler, Phosphor, or hand-drawn marks all work. Hexpunk's bundled
// stroke icons (Lucide-mirrored + custom hex-themed) ship via the
// `@hexpunk/icons` subpath.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * SVG icon wrapper — sized via `size` (sm / md / lg), strokes inherit
 * `currentColor`.
 *
 * @slot - SVG content (stroke-based icon)
 */
@customElement("hp-icon")
export class HpIcon extends LitElement {
  /** Icon size — `sm` (16px), `md` (default, 20px), or `lg` (24px). */
  @property({ reflect: true })
  size: "sm" | "md" | "lg" = "md";

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
        width: var(--hp-icon-md);
        height: var(--hp-icon-md);
        color: currentColor;
        line-height: 0;
      }

      :host([size="sm"]) {
        width: var(--hp-icon-sm);
        height: var(--hp-icon-sm);
      }

      :host([size="lg"]) {
        width: var(--hp-icon-lg);
        height: var(--hp-icon-lg);
      }

      ::slotted(svg) {
        width: 100%;
        height: 100%;
        display: block;
        color: inherit;
      }
    `,
  ];

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-icon": HpIcon;
  }
}
