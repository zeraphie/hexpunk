/*
  ─ hp-background ─

  Pointer-aware hex backdrop rendered by WebGL2: a baked tile
  sampled in shared page coordinates (one global grid, revealed
  wherever an instance sits) with a cursor halo blended per
  draw. This file is only lifecycle + wiring; each concern
  lives in its sibling module.
  (PLAN.hp-grid-smoothness.md § Steps › Step 3)
*/

import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { hpBase } from "../../../styles/hp-base.js";
import { TilePipeline } from "./bake.js";
import { applyFallbackTile } from "./fallback.js";
import { reconcileCanvasGeometry } from "./geometry.js";
import { acquireContext, describeRenderer, isSoftwareRenderer } from "./gl.js";
import { PointerTracker } from "./input.js";
import { RenderPass } from "./render.js";
import { backgroundStyles } from "./styles.js";

/**
 * Pointer-aware hex grid backdrop. A faint hex pattern fills the
 * host; strokes brighten softly around the cursor. Two layout modes:
 * contained (default — absolute, fills a positioned parent) and
 * `page` (fixed full-viewport backdrop behind page content).
 *
 * @cssproperty --hp-bg-stroke - Base stroke colour
 * @cssproperty --hp-bg-stroke-bright - Cursor-halo stroke colour
 * @cssproperty --hp-bg-faint-opacity - Base layer opacity (default 0.25)
 * @cssproperty --hp-bg-bright-opacity - Halo layer opacity (default 0.3)
 * @cssproperty --hp-bg-pointer-radius - Halo radius on the CSS fallback path (set from pointer-radius)
 * @cssproperty --hp-bg-z - Stacking position in page mode (default -1)
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

  // Page-backdrop mode is a pure CSS-driven attribute (`page`), handled
  // entirely by the `:host([page])` style rule — NOT a reactive
  // property. Deliberately not a `@property`:
  //  1. The JS render path doesn't need it — reconcileCanvasGeometry
  //     reads getBoundingClientRect(), which already reflects whatever
  //     position the CSS applies, so the geometry math is identical in
  //     both modes without branching on a flag.
  //  2. A reflecting boolean property defaulting to `false` is a known
  //     Lit + esbuild footgun: with `useDefineForClassFields: true`
  //     (esbuild's default, independent of our tsconfig) the `= false`
  //     field initializer shadows the decorator accessor and discards
  //     an author-set `page` attribute on upgrade, then reflect
  //     *removes* the attribute. A plain attribute sidesteps the whole
  //     class, and aligns with the state-driven-styling convention.

  /** True when WebGL2 init failed or the context was lost — the host
   * renders the static SVG-data-URL fallback (Option C), reflected as
   * a `data-hp-fallback` attribute for the CSS. */
  @state() private fallback = false;

  /** Cached canvas element handle, grabbed in `firstUpdated`. */
  private canvas: HTMLCanvasElement | null = null;

  /** Active WebGL2 context, null while in the fallback state. */
  private gl: WebGL2RenderingContext | null = null;

  /** Tier-2 flag: WebGL alive but software-rasterized (HW accel
   * off). Routed to the static CSS tile in initGL — the software
   * compositor displays WebGL canvases unreliably even when the
   * buffer is fully drawn. See the three-tier decision in the ADR. */
  private softwareRenderer = false;

  private readonly tile = new TilePipeline();
  private readonly renderPass = new RenderPass();
  private readonly pointer = new PointerTracker(() => this.handlePointerActivity());

  private resizeObserver?: ResizeObserver;

  /** Active matchMedia query watching for DPR changes. Re-created on
   * each change (the query string embeds the current value, so any
   * different DPR stops it matching). */
  private dprMediaQuery: MediaQueryList | null = null;

  /** Pending rAF handle for a coalesced redraw; null when none. */
  private pendingFrame: number | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("aria-hidden", "true");
    this.resizeObserver = new ResizeObserver(() => this.scheduleRedraw());
    // Observe `this` (intrinsic size changes) plus the parent
    // (ancestor-driven inset:0 growth doesn't always trip the
    // observer on `this` alone).
    this.resizeObserver.observe(this);
    if (this.parentElement) {
      this.resizeObserver.observe(this.parentElement);
    }
    this.pointer.connect();
    // The pattern is page-attached (uOffset includes scroll), so
    // scrolling changes what this viewport-bounded canvas should
    // show. Passive + rAF-coalesced keeps it off the scroll critical
    // path.
    window.addEventListener("scroll", this.handleScroll, { passive: true });
    // Final-settling triggers for late layout: 'load' fires once all
    // resources are in; fonts.ready resolves after webfont swapping.
    // Both can shift layout in ways ResizeObserver misses when the
    // host's own bbox doesn't change immediately.
    if (document.readyState !== "complete") {
      window.addEventListener("load", this.handleSettled, { once: true });
    }
    document.fonts?.ready.then(this.handleSettled);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.pendingFrame !== null) {
      cancelAnimationFrame(this.pendingFrame);
      this.pendingFrame = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.pointer.disconnect();
    window.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("load", this.handleSettled);
    if (this.canvas) {
      this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
      this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    }
    if (this.dprMediaQuery) {
      this.dprMediaQuery.removeEventListener("change", this.handleDprChange);
      this.dprMediaQuery = null;
    }
    this.releaseGL();
    this.canvas = null;
  }

  override firstUpdated(): void {
    this.canvas = this.shadowRoot?.querySelector("canvas") ?? null;
    this.initGL();
    // Belt-and-braces: re-check on the next frame so post-firstUpdated
    // layout settling (Astro hydration, shiki highlighting, fonts) is
    // picked up even if no observer fires.
    this.scheduleRedraw();
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("hexSize") || changed.has("pointerRadius")) {
      if (this.fallback) {
        applyFallbackTile(this, this.hexSize, this.pointerRadius);
      } else if (this.gl && changed.has("hexSize")) {
        this.rebake();
      }
    }
  }

  // ── GL lifecycle ────────────────────────────────────────────────────

  /** Dev-facing render-path log: which of the three tiers this
   * instance is actually using, and why. console.debug so it only
   * shows when the DevTools console level includes Verbose — silent
   * for consumers at default settings. */
  private logRenderPath(path: string): void {
    // eslint-disable-next-line no-console
    console.debug(`hp-background: rendering via ${path}`);
  }

  private initGL(): void {
    if (!this.canvas) {
      return;
    }
    const gl = acquireContext(this.canvas);
    if (!gl) {
      this.logRenderPath("CSS tile (WebGL2 unavailable)");
      this.enterFallback();
      return;
    }
    // Tier 2: WebGL alive but software-rasterized (HW accel off).
    // Field finding (2026-08-09): even a fully-drawn buffer displays
    // partially under Chrome's software compositor — the canvas
    // itself is unreliable, so route to the CSS tile, which
    // composites as ordinary paint. Free the context; WARP/
    // SwiftShader resources aren't cheap to keep idle.
    this.softwareRenderer = isSoftwareRenderer(gl);
    if (this.softwareRenderer) {
      this.logRenderPath(`CSS tile (software renderer: ${describeRenderer(gl)})`);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      this.enterFallback();
      return;
    }
    this.gl = gl;
    // Remove + re-add so context-restore cycles don't accumulate
    // duplicate listeners (the handlers are stable arrow refs).
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
    try {
      this.tile.init(gl);
      this.renderPass.init(gl);
    } catch {
      // Compile/link/allocation failure — rare on a healthy WebGL2
      // context; degrade to the static tile.
      this.logRenderPath("CSS tile (GL pipeline init failed)");
      this.releaseGL();
      this.enterFallback();
      return;
    }
    this.logRenderPath(`WebGL2 (${describeRenderer(gl)})`);
    this.watchDpr();
    this.rebake();
    this.draw();
  }

  /** Bake (or re-bake) the tile; routes to the fallback if the FBO
   * turns out incomplete (misbehaving driver). */
  private rebake(): void {
    if (!this.gl) {
      return;
    }
    if (!this.tile.bake(this.gl, this.hexSize)) {
      this.logRenderPath("CSS tile (bake framebuffer incomplete)");
      this.releaseGL();
      this.enterFallback();
      return;
    }
    this.scheduleRedraw();
  }

  /** Delete GL resources across both pipelines and drop the context
   * ref. Safe after context loss (pipelines skip deletes when passed
   * null). */
  private releaseGL(): void {
    this.tile.release(this.gl);
    this.renderPass.release(this.gl);
    this.gl = null;
  }

  private enterFallback(): void {
    this.fallback = true;
    this.setAttribute("data-hp-fallback", "");
    applyFallbackTile(this, this.hexSize, this.pointerRadius);
  }

  private readonly handleContextLost = (event: Event): void => {
    // Default behaviour is a permanent loss; preventDefault asks for
    // restoration. Show the fallback meanwhile so the host doesn't go
    // blank. Pre-null `gl` so release skips (illegal) deletes against
    // the lost context.
    event.preventDefault();
    this.logRenderPath("CSS tile (context lost — awaiting restore)");
    this.gl = null;
    this.releaseGL();
    this.enterFallback();
  };

  private readonly handleContextRestored = (): void => {
    // The original context object is gone; re-acquire and re-init.
    this.fallback = false;
    this.removeAttribute("data-hp-fallback");
    this.initGL();
  };

  // ── Re-draw triggers ────────────────────────────────────────────────

  private readonly handleScroll = (): void => {
    this.scheduleRedraw();
  };

  private readonly handleSettled = (): void => {
    this.scheduleRedraw();
  };

  private watchDpr(): void {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    if (this.dprMediaQuery) {
      this.dprMediaQuery.removeEventListener("change", this.handleDprChange);
    }
    const dpr = window.devicePixelRatio || 1;
    this.dprMediaQuery = window.matchMedia(`(resolution: ${dpr}dppx)`);
    this.dprMediaQuery.addEventListener("change", this.handleDprChange);
  }

  private readonly handleDprChange = (): void => {
    if (this.gl && !this.fallback) {
      // Backing store and tile both scale with DPR; the deferred draw
      // reconciles the former, rebake refreshes the latter.
      this.rebake();
    }
    // In fallback the SVG tile is DPR-independent; just re-arm.
    this.watchDpr();
  };

  /** Pointer/preference activity routes by mode: the GL path
   * schedules a redraw; the fallback path repositions the CSS reveal
   * mask by writing the pointer coordinates as custom properties —
   * input data, not visual state, matching the original SVG
   * implementation's contract. No rAF needed there: the engine
   * repaints the moved mask on its own schedule. */
  private handlePointerActivity(): void {
    if (!this.fallback) {
      this.scheduleRedraw();
      return;
    }
    if (this.pointer.reducedMotion) {
      return;
    }
    const rect = this.getBoundingClientRect();
    this.style.setProperty("--hp-bg-x", `${this.pointer.mouseClientX - rect.left}px`);
    this.style.setProperty("--hp-bg-y", `${this.pointer.mouseClientY - rect.top}px`);
  }

  /** Coalesce redraws onto the next animation frame. Multiple
   * triggers in one frame (resize + scroll + settle, say) collapse to
   * a single draw that runs *after* layout settles — never
   * synchronously inside an observer callback. */
  private scheduleRedraw(): void {
    if (this.pendingFrame !== null) {
      return;
    }
    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = null;
      this.draw();
    });
  }

  private draw(): void {
    const gl = this.gl;
    if (!gl) {
      return;
    }
    const geometry = reconcileCanvasGeometry(this, this.canvas, gl);
    if (!geometry.visible) {
      return;
    }
    this.renderPass.draw(gl, this, {
      geometry,
      tile: this.tile,
      mouseClientX: this.pointer.effectiveClientX,
      mouseClientY: this.pointer.effectiveClientY,
      pointerRadius: this.pointerRadius,
    });
  }

  static override styles = [hpBase, backgroundStyles];

  override render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-background": HpBackground;
  }
}
