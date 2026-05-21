// hp-background.ts — Pointer-aware hex grid backdrop.
//
// A faint SVG hex tile pattern that fills its host area. Lines brighten
// in a soft circle around the pointer, giving any surface (hp-grid
// demo canvas, document body, full-screen showcase chrome) a subtle
// sense of presence without competing with the foreground.
//
// **Two-layer SVG** — both layers draw the same hex grid:
//
// - Bottom layer (always visible) strokes at --hp-outline-faint.
// - Top layer strokes at --hp-outline (brighter) but is masked by a
// radial gradient centered at the cursor. Within the radius the
// mask is opaque so the brighter strokes show through; outside
// it's transparent so only the faint layer reads.
//
// The cursor position is captured via a window-level pointermove
// listener and written to --hp-bg-x / --hp-bg-y as pixel offsets
// relative to the host bbox. The radial-gradient mask consumes those
// custom properties directly — no per-frame DOM updates beyond a
// single style set, no rAF loop. Performance is fine even with the
// backdrop applied to large surfaces.
//
// **Layout** — position: absolute, inset: 0, pointer-events: none.
// Drop one in as a child of any positioned container (hp-grid, a
// demo wrapper, the document body) and it stretches to fill while
// staying out of the hit-test path. Stroke colour reads from
// currentColor, so consumers can tint via the standard `color`
// property or the --hp-outline-faint / --hp-outline tokens.

import { LitElement, css, html, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Pointer-aware hex grid backdrop. Faint SVG hex tiles that brighten
 * softly around the cursor. Positioned absolutely; drop inside any
 * positioned container.
 *
 * @cssproperty --hp-bg-stroke - Base stroke colour
 * @cssproperty --hp-bg-stroke-bright - Cursor-halo stroke colour
 * @cssproperty --hp-bg-faint-opacity - Base layer opacity (default 0.25)
 * @cssproperty --hp-bg-bright-opacity - Halo layer opacity (default 0.3)
 * @cssproperty --hp-bg-pointer-radius - Pixel radius of the cursor halo
 */
@customElement("hp-background")
export class HpBackground extends LitElement {
  /** Hex side length in pixels (centre-to-vertex). Smaller = denser
   * pattern. Default 14 — reads as ambient texture, not a focal
   * element. */
  @property({ type: Number, attribute: "hex-size" })
  hexSize = 14;

  /** Radius in pixels where the brighter strokes are fully visible
   * around the cursor. Falls to transparent at the edge. Default 200. */
  @property({ type: Number, attribute: "pointer-radius" })
  pointerRadius = 200;

  /** Cached grid dimensions; recomputed by the ResizeObserver. */
  @state() private cols = 0;
  @state() private rows = 0;

  private resizeObserver?: ResizeObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("aria-hidden", "true");
    this.resizeObserver = new ResizeObserver(() => this.computeGridSize());
    this.resizeObserver.observe(this);
    // Window-level pointer listener — the host has pointer-events: none
    // so it can't catch its own events, but window always sees them.
    // Pointermove is high-frequency; passive flag avoids forcing the
    // browser to wait on the listener before scrolling.
    window.addEventListener("pointermove", this.handleWindowPointerMove, {
      passive: true,
    });
    // First compute happens after the next layout pass so getBoundingClientRect
    // sees real dimensions.
    queueMicrotask(() => this.computeGridSize());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    window.removeEventListener("pointermove", this.handleWindowPointerMove);
  }

  private handleWindowPointerMove = (event: PointerEvent): void => {
    const rect = this.getBoundingClientRect();
    this.style.setProperty("--hp-bg-x", `${event.clientX - rect.left}px`);
    this.style.setProperty("--hp-bg-y", `${event.clientY - rect.top}px`);
  };

  private computeGridSize(): void {
    const rect = this.getBoundingClientRect();
    const s = this.hexSize;
    // Pointy-top tessellation step: cw = s·√3 horizontally, ch = 1.5·s
    // vertically (with every other row offset by cw/2). Add 1-2 extra
    // rows / cols so the grid bleeds past the host edges and the
    // pattern doesn't visibly clip.
    const cw = s * Math.sqrt(3);
    const ch = s * 1.5;
    this.cols = Math.max(1, Math.ceil(rect.width / cw) + 2);
    this.rows = Math.max(1, Math.ceil(rect.height / ch) + 2);
  }

  static override styles = [
    hpBase,
    css`
      :host {
        position: absolute;
        inset: 0;
        display: block;
        pointer-events: none;
        overflow: hidden;
        contain: strict;
        /* Both layers use full outline tokens, dialed by independent
 * opacities. The opacity dial lets us land between the system
 * outline rungs (--hp-outline-faint reads as nothing on common
 * backdrops; --hp-outline-variant reads as too present at
 * 1.0). Default 0.25 for the base sits the grid at "barely
 * there, but there"; 0.3 for the cursor halo keeps the
 * brightening a soft trail rather than a search-light. */
        --hp-bg-stroke: var(--hp-outline-variant);
        --hp-bg-stroke-bright: var(--hp-outline);
        --hp-bg-faint-opacity: 0.25;
        --hp-bg-bright-opacity: 0.3;
      }

      svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
      }

      g {
        fill: none;
        stroke-width: 0.75;
      }

      .faint {
        stroke: var(--hp-bg-stroke);
        opacity: var(--hp-bg-faint-opacity);
      }

      .bright {
        stroke: var(--hp-bg-stroke-bright);
        opacity: var(--hp-bg-bright-opacity);
        /* Mask reveals the brighter strokes only within pointerRadius
 * of the cursor. CSS var fallbacks land the focus offscreen
 * before the first pointermove so the brighter layer is
 * effectively hidden on initial paint. */
        mask: radial-gradient(
          circle var(--hp-bg-pointer-radius, 200px) at var(--hp-bg-x, -9999px)
            var(--hp-bg-y, -9999px),
          black 0%,
          transparent 100%
        );
      }

      @media (prefers-reduced-motion: reduce) {
        /* Pointer-following brightness is a subtle motion cue; suppress
 * for users who've opted out. The faint layer still renders. */
        .bright {
          display: none;
        }
      }
    `,
  ];

  override render() {
    const s = this.hexSize;
    const cw = s * Math.sqrt(3);
    const ch = s * 1.5;
    const polygons = [];
    for (let row = 0; row < this.rows; row++) {
      const offsetX = row % 2 === 0 ? 0 : cw / 2;
      for (let col = 0; col < this.cols; col++) {
        const cx = col * cw + offsetX;
        const cy = row * ch;
        // Pointy-top hex vertices around (cx, cy): top, top-right,
        // bottom-right, bottom, bottom-left, top-left.
        const points = [
          [cx, cy - s],
          [cx + cw / 2, cy - s / 2],
          [cx + cw / 2, cy + s / 2],
          [cx, cy + s],
          [cx - cw / 2, cy + s / 2],
          [cx - cw / 2, cy - s / 2],
        ]
          .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
          .join(" ");
        polygons.push(svg`<polygon points=${points}></polygon>`);
      }
    }
    return html`
      <svg
        style="--hp-bg-pointer-radius: ${this.pointerRadius}px"
        preserveAspectRatio="xMidYMid slice"
      >
        <g class="faint">${polygons}</g>
        <g class="bright">${polygons}</g>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-background": HpBackground;
  }
}
