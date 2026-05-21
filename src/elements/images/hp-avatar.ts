// hp-avatar.ts — Hex-shaped user avatar.
//
// Image + fallback display, hex-clipped.
// primitive: shows the image when it loads successfully, falls back
// to the slotted content (typically initials) when no src or on
// load error. Composes hp-hex underneath for the outline, with the
// image clip-pathed into the hex shape.
//
// Pure display element — no focus, no click semantics. Wrap in
// hp-button / hp-link for interactive avatars.

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import "../primitives/hp-hex.js";
import { hpBase } from "../../styles/hp-base.js";

/**
 * Hex-shaped avatar. Image clips into the hex; falls back to the
 * slotted content (typically initials) on load error or before src
 * resolves.
 *
 * @slot - Fallback content shown when no src or on image load error
 *
 * @csspart avatar - The avatar wrapper
 * @csspart fallback - The fallback container holding the slotted initials
 */
@customElement("hp-avatar")
export class HpAvatar extends LitElement {
  /** Image URL. When set, the image renders inside the hex. On load
   * error or while pending, the slotted fallback shows instead. */
  @property()
  src = "";

  /** Alt text for the image. Required for non-decorative avatars. */
  @property()
  alt = "";

  /** Avatar size — matches hp-hex sizes. */
  @property({ reflect: true })
  size: "sm" | "md" | "lg" = "md";

  /** Internal: tracks image load lifecycle. `loaded` shows the image;
   * `error` falls through to the slot fallback. */
  @state() private status: "idle" | "loaded" | "error" = "idle";

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("src")) {
      this.status = this.src ? "idle" : "error";
    }
  }

  private handleImageLoad = (): void => {
    this.status = "loaded";
  };

  private handleImageError = (): void => {
    this.status = "error";
  };

  static override styles = [
    hpBase,
    css`
      :host {
        position: relative;
        display: inline-block;
      }

      .avatar {
        position: relative;
        display: inline-block;
        line-height: 0;
      }

      img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        clip-path: var(--hp-hex-clip);
        opacity: 0;
        transition: opacity var(--hp-duration-medium) var(--hp-ease-default);
      }

      img.loaded {
        opacity: 1;
      }

      .fallback {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        font-family: var(--hp-typo-label-md-font-family);
        font-size: var(--hp-typo-label-md-font-size);
        font-weight: 700;
        color: var(--hp-on-surface);
        text-transform: uppercase;
        pointer-events: none;
      }

      .fallback.hidden {
        visibility: hidden;
      }
    `,
  ];

  override render() {
    const loaded = this.status === "loaded";
    return html`
      <div class="avatar" part="avatar">
        <hp-hex size=${this.size}></hp-hex>
        ${this.src
          ? html`
              <img
                class=${loaded ? "loaded" : ""}
                src=${this.src}
                alt=${this.alt}
                @load=${this.handleImageLoad}
                @error=${this.handleImageError}
              />
            `
          : ""}
        <div class=${`fallback ${loaded ? "hidden" : ""}`} part="fallback">
          <slot></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-avatar": HpAvatar;
  }
}
