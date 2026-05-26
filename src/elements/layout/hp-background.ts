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

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/** Build a CSS data-URL repeating-hex-tile background, used as the
 * Option-C fallback when WebGL2 init fails or the context is lost.
 * Embeds a 5-hex tile (1 centered + 4 corner-quartered) sized to
 * `hexSize` so neighbouring tiles assemble into a continuous
 * tessellation when CSS `background-repeat: repeat` tiles them. The
 * stroke uses `currentColor` so the host's `color` (set to
 * `--hp-bg-stroke` via the fallback `:host` rules) drives the tint. */
function buildFallbackTileDataUrl(hexSize: number): string {
  const s = hexSize;
  const cw = s * Math.sqrt(3);
  const ch = s * 1.5;
  const tileW = cw;
  const tileH = 2 * ch;
  const hex = (cx: number, cy: number): string => {
    const pts: Array<[number, number]> = [
      [cx, cy - s],
      [cx + cw / 2, cy - s / 2],
      [cx + cw / 2, cy + s / 2],
      [cx, cy + s],
      [cx - cw / 2, cy + s / 2],
      [cx - cw / 2, cy - s / 2],
    ];
    return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  };
  const centres: Array<[number, number]> = [
    [cw / 2, ch],
    [0, 0],
    [tileW, 0],
    [0, tileH],
    [tileW, tileH],
  ];
  const polygons = centres.map(([cx, cy]) => `<polygon points="${hex(cx, cy)}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileW.toFixed(2)}" height="${tileH.toFixed(2)}" viewBox="0 0 ${tileW.toFixed(2)} ${tileH.toFixed(2)}"><g fill="none" stroke="currentColor" stroke-width="0.75">${polygons}</g></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

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

  /** Cached grid dimensions; recomputed by the ResizeObserver.
   *
   * @deprecated Unused in the WebGL2 path — kept in Step 1 to keep the
   *   diff focused; removed in Step 3 along with the rest of the SVG
   *   rendering machinery. */
  @state() private cols = 0;
  /** @deprecated See {@link cols}. */
  @state() private rows = 0;

  /** True when WebGL2 init failed or the context was lost — the host
   * renders the static SVG-data-URL fallback (Option C) in this state.
   * Reflected to a `data-hp-fallback` attribute on the host so CSS
   * targets the alternate visual. */
  @state() private fallback = false;

  private resizeObserver?: ResizeObserver;
  /** Cached canvas element handle, grabbed in `firstUpdated`. */
  private canvas: HTMLCanvasElement | null = null;
  /** Active WebGL2 context, null while in the fallback state. */
  private gl: WebGL2RenderingContext | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("aria-hidden", "true");
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this);
    // Window-level pointer listener — the host has pointer-events: none
    // so it can't catch its own events, but window always sees them.
    // Pointermove is high-frequency; passive flag avoids forcing the
    // browser to wait on the listener before scrolling.
    window.addEventListener("pointermove", this.handleWindowPointerMove, {
      passive: true,
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    window.removeEventListener("pointermove", this.handleWindowPointerMove);
    if (this.canvas) {
      this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
      this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    }
    this.gl = null;
    this.canvas = null;
  }

  override firstUpdated(): void {
    this.canvas = this.shadowRoot?.querySelector("canvas") ?? null;
    this.initGL();
  }

  override updated(changed: Map<string, unknown>): void {
    // `hex-size` drives the fallback tile geometry; refresh the
    // data-URL background when the attribute changes while we're in
    // the fallback state. (The GL path will react to this via a
    // re-bake in Step 2; no shader yet in Step 1, so nothing to do
    // there for now.)
    if (changed.has("hexSize") && this.fallback) {
      this.updateFallbackTile();
    }
  }

  private initGL(): void {
    const canvas = this.canvas;
    if (!canvas) {
      return;
    }
    // `antialias: false` because the shader will do AA via `fwidth`
    // (Step 2) and browser MSAA would be redundant. `low-power` flags
    // the decorative use case so battery-conscious systems can route
    // to the integrated GPU.
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) {
      this.enterFallback();
      return;
    }
    this.gl = gl;
    canvas.addEventListener("webglcontextlost", this.handleContextLost);
    canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
    this.handleResize();
    this.draw();
  }

  private readonly handleContextLost = (event: Event): void => {
    // Default behaviour is to permanently lose the context. preventDefault
    // tells the browser we want it restored when possible. Swap to the
    // fallback bg in the meantime so the host doesn't go visually blank.
    event.preventDefault();
    this.gl = null;
    this.enterFallback();
  };

  private readonly handleContextRestored = (): void => {
    // The original context object is gone; re-acquire and re-init.
    // initGL will set fallback back to false on success.
    this.fallback = false;
    this.removeAttribute("data-hp-fallback");
    this.initGL();
  };

  private enterFallback(): void {
    this.fallback = true;
    this.setAttribute("data-hp-fallback", "");
    this.updateFallbackTile();
  }

  private updateFallbackTile(): void {
    this.style.setProperty("--hp-bg-fallback-image", buildFallbackTileDataUrl(this.hexSize));
    const tileW = this.hexSize * Math.sqrt(3);
    const tileH = this.hexSize * 3;
    this.style.setProperty("--hp-bg-tile-width", `${tileW.toFixed(2)}px`);
    this.style.setProperty("--hp-bg-tile-height", `${tileH.toFixed(2)}px`);
  }

  private handleResize(): void {
    const canvas = this.canvas;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      if (this.gl) {
        this.gl.viewport(0, 0, w, h);
      }
    }
    this.draw();
  }

  /** Step 1: clear to fully transparent. Step 2 replaces this with the
   * bake + runtime sample-and-blend pipeline. */
  private draw(): void {
    const gl = this.gl;
    if (!gl) {
      return;
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
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

      canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
      }

      /* Option-C fallback: WebGL2 unavailable or context lost. The
       * canvas hides; the host paints a repeating SVG-data-URL hex
       * tile that gives a "degraded but present" hex pattern with no
       * cursor reactivity. Tile dimensions + image are written as
       * inline custom properties by updateFallbackTile() so hex-size
       * changes propagate. */
      :host([data-hp-fallback]) canvas {
        display: none;
      }

      :host([data-hp-fallback]) {
        color: var(--hp-bg-stroke);
        opacity: var(--hp-bg-faint-opacity);
        background-image: var(--hp-bg-fallback-image);
        background-repeat: repeat;
        background-size: var(--hp-bg-tile-width) var(--hp-bg-tile-height);
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
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-background": HpBackground;
  }
}
