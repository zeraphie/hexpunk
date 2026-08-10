/*
  ─ hp-background ─

  Pointer-aware hex backdrop rendered by WebGL2: a baked tile
  sampled in shared page coordinates (one global grid, revealed
  wherever an instance sits), brightened by an energy field the
  pointer stirs — a wake that drifts and fades. This file is
  only lifecycle + wiring; each concern lives in its sibling
  module.
  (PLAN.hp-grid-smoothness.md § Steps › Steps 3-4)
*/

import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { hpBase } from "../../../styles/hp-base.js";
import { TilePipeline } from "./bake.js";
import { applyFallbackTile } from "./fallback.js";
import { EnergyField, FIELD_EPSILON, FIELD_MAX, FIELD_SCALE, type RunnerSplat } from "./field.js";
import { reconcileCanvasGeometry } from "./geometry.js";
import { acquireContext, describeRenderer, isSoftwareRenderer } from "./gl.js";
import { PointerTracker } from "./input.js";
import { type HeadGlow, RenderPass } from "./render.js";
import { LatticeRunners } from "./runners.js";
import { backgroundStyles } from "./styles.js";

/** Reference frame duration the `decay` knob is expressed against —
 * actual per-step decay is dt-normalized so 120 Hz displays and
 * dropped frames fade at the same wall-clock rate. */
const REFERENCE_FRAME_MS = 1000 / 60;

/** Pointer speed (device px per frame) that maps to a full-strength
 * splat. Slow hovers land well under it (gentle glow); brisk sweeps
 * saturate it (bright wake). */
const SPLAT_SPEED_NORM = 40;

/** Adaptive backstop: frame intervals sampled over one contiguous
 * wake, and the median (ms) above which the instance demotes to the
 * CSS tile. The samples measure rAF cadence, not sim cost, so the
 * threshold sits well above every legitimate presentation rate —
 * 30 Hz displays and battery-saver caps present at ~33 ms and must
 * NOT demote; a renderer genuinely dying on the sim runs slower
 * than 60 ms (< 17 fps). Samples above the outlier bound (tab
 * switches, one-off stalls) are discarded rather than counted. */
const ADAPTIVE_SAMPLE_FRAMES = 32;
const ADAPTIVE_DEMOTE_MS = 60;
const ADAPTIVE_OUTLIER_MS = 200;

/** Ignition-runner splat tuning. The TRAIL deposited into the field
 * stays at bright level (≤ 1.0) — only the draw-time head highlight
 * reaches the hot tier, so the leading pixel visibly outshines the
 * path behind it. Head radius is device-independent CSS px. */
const RUNNER_RADIUS = 6;
const TRAIL_STRENGTH = 0.9;
const HEAD_RADIUS = 7;
const HEAD_BOOST = 0.8;

/** New runner waves launch this often while the press is held —
 * ignition continues until release, then winds down naturally. */
const WAVE_MS = 200;

/** Proximity gate: pointer activity farther than this from the host
 * rect (beyond splat radius) cannot affect the field, so it never
 * wakes the loop — N distant instances stay asleep during normal
 * mouse use. Margin covers diffusion spread. */
const PROXIMITY_MARGIN = 120;

/**
 * Pointer-aware hex grid backdrop. A faint hex pattern fills the
 * host; pointer movement stirs a soft energy wake that brightens
 * the strokes it passes through, then drifts and fades. Pressing on
 * empty (non-interactive) space ignites a few glowing runners that
 * crawl outward along the lattice edges, branching at random. Two
 * layout modes: contained
 * (default — absolute, fills a positioned parent) and `page` (fixed
 * full-viewport backdrop behind page content).
 *
 * @cssproperty --hp-bg-stroke - Base stroke colour
 * @cssproperty --hp-bg-stroke-bright - Energy-wake stroke colour
 * @cssproperty --hp-bg-stroke-hot - Ignition-wavefront colour (defaults to the bright colour)
 * @cssproperty --hp-bg-faint-opacity - Base layer opacity (default 0.25)
 * @cssproperty --hp-bg-bright-opacity - Wake layer opacity (default 0.3)
 * @cssproperty --hp-bg-hot-opacity - Ignition-wavefront opacity (default 2× bright, capped at 1)
 * @cssproperty --hp-bg-pointer-radius - Reveal radius on the CSS fallback path (set from pointer-radius)
 * @cssproperty --hp-bg-decay - Overrides the decay attribute
 * @cssproperty --hp-bg-splat-strength - Overrides the splat-strength attribute
 * @cssproperty --hp-bg-splat-radius - Overrides the splat-radius attribute
 * @cssproperty --hp-bg-z - Stacking position in page mode (default -1)
 */
@customElement("hp-background")
export class HpBackground extends LitElement {
  /** Hex side length in pixels (centre-to-vertex). Smaller = denser
   * pattern. Default 14 — reads as ambient texture, not a focal
   * element. */
  @property({ type: Number, attribute: "hex-size" })
  hexSize = 14;

  /** Radius in pixels of the pointer reveal on the CSS fallback
   * path (tiers 2/3). The GL path's wake size is governed by
   * splat-radius + diffusion instead. Default 200. */
  @property({ type: Number, attribute: "pointer-radius" })
  pointerRadius = 200;

  /** Energy retention per 60 Hz frame in the GL wake sim — higher
   * values leave longer trails. Clamped to [0.5, 0.995]; wall-clock
   * fade time is roughly proportional to 1/(1 − decay). Default
   * 0.964 ≈ a 1.2–1.6 s visible fade (feel-tuned 2026-08-09 from
   * 0.97 — "1.2× faster"). */
  @property({ type: Number })
  decay = 0.964;

  /** Multiplier on the energy injected per pointer move. Default 1. */
  @property({ type: Number, attribute: "splat-strength" })
  splatStrength = 1;

  /** Gaussian radius of the pointer splat in CSS pixels — the width
   * of the freshly-painted wake before diffusion spreads it.
   * Default 80. */
  @property({ type: Number, attribute: "splat-radius" })
  splatRadius = 80;

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
  private readonly field = new EnergyField();
  private readonly pointer = new PointerTracker(
    () => this.handlePointerActivity(),
    (x, y) => this.handleIgnite(x, y),
    () => this.handleIgniteEnd()
  );

  /** Ignition runners — path logic lives in runners.ts; the element
   * converts their page-space head segments to field space per
   * frame, which keeps trails glued to the pattern across scroll. */
  private readonly runners = new LatticeRunners();

  /** True while the pointer is held down on empty space — new
   * runner waves keep launching every WAVE_MS from the pointer's
   * LIVE position (the ignite centre follows a held drag) until
   * release. */
  private igniteHeld = false;
  private lastWaveAt = 0;

  private resizeObserver?: ResizeObserver;

  // ── Sim-loop state ──────────────────────────────────────────────────
  /** rAF handle of the running sim loop; null while asleep. */
  private loopHandle: number | null = null;
  /** Accumulated *sim* time (sum of clamped dt) since the field
   * last received energy. Drives the sleep check — sim time, not
   * wall clock, so a tab-hide mid-wake can't strand a bright field
   * (rAF pauses freeze both the field AND this accumulator). */
  private simTimeSinceSplat = 0;
  /** performance.now() of the previous loop frame, for dt. */
  private lastFrameAt = 0;
  /** Canvas-local device-px position of the last splatted point;
   * NaN when the loop was asleep (prevents a stale segment). */
  private prevSplatX = Number.NaN;
  private prevSplatY = Number.NaN;
  /** Geometry snapshot from the previous loop frame — a change means
   * splat coordinates jumped spaces, so prevSplat must resync
   * (otherwise a resize / monitor-DPR move paints a phantom
   * full-strength streak between unrelated points). */
  private lastLoopCanvasW = 0;
  private lastLoopCanvasH = 0;
  private lastLoopDpr = 0;
  /** Frame intervals collected over one contiguous wake for the
   * adaptive demotion backstop; null once evaluated. Reset on every
   * wake so cross-wake stalls can't poison the median. */
  private adaptiveSamples: number[] | null = [];
  /** True after adaptive demotion — a context restore must not
   * resurrect the GL path just to demote again. */
  private demoted = false;

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
    // Reconnect after a DOM move: firstUpdated never re-fires for
    // the same instance, so without this the disconnect teardown
    // would leave a frozen canvas forever. Mirror the context-
    // restore path (initGL re-routes to fallback on its own when
    // demoted / software / GL-unavailable).
    if (this.hasUpdated && !this.canvas) {
      this.fallback = false;
      this.removeAttribute("data-hp-fallback");
      this.canvas = this.shadowRoot?.querySelector("canvas") ?? null;
      this.initGL();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopLoop();
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
    if (this.demoted) {
      // Adaptive demotion is sticky — a context restore lands
      // straight back on the tile instead of re-running the sim
      // only to demote again.
      this.enterFallback();
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
      this.field.init(gl);
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

  /** Delete GL resources across all pipelines and drop the context
   * ref. Safe after context loss (pipelines skip deletes when passed
   * null). */
  private releaseGL(): void {
    this.tile.release(this.gl);
    this.renderPass.release(this.gl);
    this.field.release(this.gl);
    this.gl = null;
  }

  private enterFallback(): void {
    this.stopLoop();
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

  /** Pointer/preference activity routes by mode. GL path: each move
   * marks the field alive and (re)wakes the sim loop; under reduced
   * motion the field is cleared instead so the wake vanishes.
   * Fallback path: reposition the CSS reveal mask by writing the
   * pointer coordinates as custom properties — input data, not
   * visual state, matching the original SVG implementation's
   * contract; no rAF needed, the engine repaints the moved mask on
   * its own schedule. */
  private handlePointerActivity(): void {
    if (!this.fallback) {
      if (this.pointer.reducedMotion) {
        this.stopLoop();
        if (this.gl) {
          this.field.clear(this.gl);
        }
        this.scheduleRedraw();
        return;
      }
      // Proximity gate: a pointer that can't reach this instance's
      // field must not wake its loop (page-wide pointermove would
      // otherwise run sim+draw on every instance). A running loop is
      // left to its own sim-time sleep.
      if (this.loopHandle === null && !this.pointerWithinReach()) {
        return;
      }
      this.wakeLoop();
      return;
    }
    if (this.pointer.reducedMotion) {
      return;
    }
    const rect = this.getBoundingClientRect();
    this.style.setProperty("--hp-bg-x", `${this.pointer.mouseClientX - rect.left}px`);
    this.style.setProperty("--hp-bg-y", `${this.pointer.mouseClientY - rect.top}px`);
  }

  /** True when the given (or current) pointer position is close
   * enough to the host rect to affect its field. */
  private pointerWithinReach(clientX?: number, clientY?: number): boolean {
    const px = clientX ?? this.pointer.mouseClientX;
    const py = clientY ?? this.pointer.mouseClientY;
    const rect = this.getBoundingClientRect();
    const reach = this.splatRadius + PROXIMITY_MARGIN;
    return (
      px >= rect.left - reach &&
      px <= rect.right + reach &&
      py >= rect.top - reach &&
      py <= rect.bottom + reach
    );
  }

  /** Ignition: a press on a non-interactive target launches lattice
   * runners from the press point, and keeps launching waves while
   * the press is held (see the loop). GL tier only — the CSS
   * fallback has no sim to carry it — and suppressed under reduced
   * motion (it is pure motion flourish). */
  private handleIgnite(clientX: number, clientY: number): void {
    if (this.fallback || !this.gl || this.pointer.reducedMotion) {
      return;
    }
    if (!this.pointerWithinReach(clientX, clientY)) {
      return;
    }
    this.igniteHeld = true;
    this.lastWaveAt = performance.now();
    this.runners.spawn(clientX + window.scrollX, clientY + window.scrollY, this.hexSize);
    this.wakeLoop();
  }

  /** Release ends the hold; live runners finish their own lives, so
   * the effect winds down rather than cutting off. */
  private handleIgniteEnd(): void {
    this.igniteHeld = false;
  }

  // ── Sim loop ────────────────────────────────────────────────────────

  /** Start the sim loop if asleep. The loop supersedes single-frame
   * scheduling while it runs. */
  private wakeLoop(): void {
    if (this.loopHandle !== null || !this.gl) {
      return;
    }
    if (this.pendingFrame !== null) {
      cancelAnimationFrame(this.pendingFrame);
      this.pendingFrame = null;
    }
    this.lastFrameAt = performance.now();
    this.simTimeSinceSplat = 0;
    this.prevSplatX = Number.NaN;
    this.prevSplatY = Number.NaN;
    // Adaptive sampling must come from one contiguous wake — a
    // stall between wakes is not evidence about the renderer.
    if (this.adaptiveSamples) {
      this.adaptiveSamples = [];
    }
    this.loopHandle = requestAnimationFrame(this.runLoopFrame);
  }

  private stopLoop(): void {
    if (this.loopHandle !== null) {
      cancelAnimationFrame(this.loopHandle);
      this.loopHandle = null;
    }
    this.prevSplatX = Number.NaN;
    this.prevSplatY = Number.NaN;
    this.runners.clear();
    this.igniteHeld = false;
  }

  /** Read a tuning knob: the CSS custom property wins when set and
   * numeric; the attribute/property value is the default. */
  private knob(cs: CSSStyleDeclaration, name: string, fallback: number): number {
    const v = Number.parseFloat(cs.getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  }

  /** One sim-loop frame: advance the field (decay + diffusion +
   * this frame's pointer splat), draw, then either continue or —
   * once the field must have decayed below the visible epsilon —
   * sleep. Kept as an arrow field so tests can drive frames
   * manually with an explicit timestamp. */
  private readonly runLoopFrame = (now: number): void => {
    this.loopHandle = null;
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !canvas || this.fallback) {
      return;
    }
    const geometry = reconcileCanvasGeometry(this, canvas, gl);
    if (!geometry.visible) {
      // Zero-sized host: nothing to paint and nothing visibly
      // decaying — stop outright rather than spin rAF; activity
      // re-wakes the loop the moment the host has area again.
      this.stopLoop();
      return;
    }
    const rawDt = Math.max(1, now - this.lastFrameAt);
    // Clamp the sim step so a stall doesn't decay the field to
    // nothing in one giant leap.
    const dt = Math.min(50, rawDt);
    this.lastFrameAt = now;

    const cs = getComputedStyle(this);
    const decayPerFrame = Math.min(
      0.995,
      Math.max(0.5, this.knob(cs, "--hp-bg-decay", this.decay))
    );
    const effDecay = Math.pow(decayPerFrame, dt / REFERENCE_FRAME_MS);

    // Pointer position in canvas-local device px, y-up — the same
    // space as gl_FragCoord in the field pass (divided down to field
    // px). The viewport origin comes from the page-coord offset.
    const dpr = window.devicePixelRatio || 1;
    const visLeft = geometry.offLeft / dpr - window.scrollX;
    const visBottom = geometry.offBottom / dpr - window.scrollY;
    const curX = (this.pointer.mouseClientX - visLeft) * dpr;
    const curY = (visBottom - this.pointer.mouseClientY) * dpr;

    // A geometry or DPR change moves the coordinate space under the
    // stored prevSplat — resync instead of painting a phantom
    // full-strength streak between unrelated points.
    if (
      canvas.width !== this.lastLoopCanvasW ||
      canvas.height !== this.lastLoopCanvasH ||
      dpr !== this.lastLoopDpr
    ) {
      this.lastLoopCanvasW = canvas.width;
      this.lastLoopCanvasH = canvas.height;
      this.lastLoopDpr = dpr;
      this.prevSplatX = Number.NaN;
      this.prevSplatY = Number.NaN;
    }

    let splat = null;
    if (Number.isNaN(this.prevSplatX)) {
      this.prevSplatX = curX;
      this.prevSplatY = curY;
    }
    const moved = Math.hypot(curX - this.prevSplatX, curY - this.prevSplatY);
    if (moved > 0.5) {
      const strength =
        this.knob(cs, "--hp-bg-splat-strength", this.splatStrength) *
        Math.min(1, moved / (SPLAT_SPEED_NORM * dpr));
      const radius = (this.knob(cs, "--hp-bg-splat-radius", this.splatRadius) * dpr) / FIELD_SCALE;
      splat = {
        ax: this.prevSplatX / FIELD_SCALE,
        ay: this.prevSplatY / FIELD_SCALE,
        bx: curX / FIELD_SCALE,
        by: curY / FIELD_SCALE,
        radius,
        strength,
      };
      this.prevSplatX = curX;
      this.prevSplatY = curY;
      this.simTimeSinceSplat = 0;
    }

    // Held ignition: keep launching waves until release, from the
    // pointer's LIVE position — the ignite centre follows a held
    // drag. Skip waves while the pointer is out of this instance's
    // reach (their splats couldn't land in the field anyway).
    if (this.igniteHeld && now - this.lastWaveAt >= WAVE_MS && this.pointerWithinReach()) {
      this.lastWaveAt = now;
      this.runners.spawn(
        this.pointer.mouseClientX + window.scrollX,
        this.pointer.mouseClientY + window.scrollY,
        this.hexSize
      );
    }

    // Ignition runners: advance heads along the lattice and convert
    // their page-space movement segments into field space. Active
    // runners keep the sleep accumulator pinned at zero.
    let runnerSplats: RunnerSplat[] = [];
    if (this.runners.active) {
      const radius = Math.max(1.25, (RUNNER_RADIUS * dpr) / FIELD_SCALE);
      runnerSplats = this.runners.update(dt, this.hexSize).map((seg) => ({
        ax: ((seg.ax - window.scrollX - visLeft) * dpr) / FIELD_SCALE,
        ay: ((visBottom - (seg.ay - window.scrollY)) * dpr) / FIELD_SCALE,
        bx: ((seg.bx - window.scrollX - visLeft) * dpr) / FIELD_SCALE,
        by: ((visBottom - (seg.by - window.scrollY)) * dpr) / FIELD_SCALE,
        radius,
        strength: TRAIL_STRENGTH,
      }));
      this.simTimeSinceSplat = 0;
    }

    this.field.ensureSize(gl, canvas.width, canvas.height);
    this.field.step(gl, effDecay, splat, runnerSplats);
    this.draw();

    // Adaptive backstop: a "hardware" renderer that can't sustain
    // even this low-res sim gets treated as tier 2. Median over one
    // contiguous wake, warm-up frames skipped, outlier stalls
    // discarded. Raw (unclamped) intervals — the clamp is a sim
    // concern, not a measurement.
    if (this.adaptiveSamples && rawDt <= ADAPTIVE_OUTLIER_MS) {
      this.adaptiveSamples.push(rawDt);
      if (this.adaptiveSamples.length >= ADAPTIVE_SAMPLE_FRAMES) {
        const sorted = this.adaptiveSamples.slice(2).sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
        this.adaptiveSamples = null;
        if (median > ADAPTIVE_DEMOTE_MS) {
          this.demote(median);
          return;
        }
      }
    }

    // Sleep once every texel must be below the visible epsilon —
    // analytic from the decay rate starting at the sim's energy cap,
    // measured in ACCUMULATED SIM TIME rather than wall clock so an
    // rAF pause that freezes the field also freezes the countdown
    // (a tab-hide can't strand a bright wake on screen).
    this.simTimeSinceSplat += dt;
    const aliveMs =
      (Math.log(FIELD_EPSILON / FIELD_MAX) / Math.log(decayPerFrame)) * REFERENCE_FRAME_MS;
    if (this.simTimeSinceSplat < aliveMs) {
      this.loopHandle = requestAnimationFrame(this.runLoopFrame);
    } else {
      this.stopLoop();
    }
  };

  /** Tier-2 demotion decided by measurement rather than the renderer
   * string (see the three-tier decision). Sticky via `demoted`. */
  private demote(medianMs: number): void {
    this.demoted = true;
    this.logRenderPath(
      `CSS tile (adaptive demotion: ${medianMs.toFixed(1)}ms median frame interval)`
    );
    if (this.canvas) {
      this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
      this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    }
    this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
    this.releaseGL();
    this.enterFallback();
  }

  /** Coalesce redraws onto the next animation frame. Multiple
   * triggers in one frame (resize + scroll + settle, say) collapse to
   * a single draw that runs *after* layout settles — never
   * synchronously inside an observer callback. */
  private scheduleRedraw(): void {
    if (this.pendingFrame !== null || this.loopHandle !== null) {
      // A running sim loop already repaints every frame.
      return;
    }
    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = null;
      this.draw();
    });
  }

  private draw(): void {
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !canvas) {
      return;
    }
    const geometry = reconcileCanvasGeometry(this, canvas, gl);
    if (!geometry.visible) {
      return;
    }
    // Single-frame draws (scroll, resize, settle) sample whatever
    // state the field holds — usually zeros while the loop sleeps.
    this.field.ensureSize(gl, canvas.width, canvas.height);
    // Leading-pixel highlights for live runner heads (page → canvas
    // device px, y-up). Empty while no ignition is playing.
    let heads: HeadGlow[] = [];
    if (this.runners.active) {
      const dpr = window.devicePixelRatio || 1;
      const visLeft = geometry.offLeft / dpr - window.scrollX;
      const visBottom = geometry.offBottom / dpr - window.scrollY;
      heads = this.runners.heads().map((h) => ({
        x: (h.x - window.scrollX - visLeft) * dpr,
        y: (visBottom - (h.y - window.scrollY)) * dpr,
        radius: HEAD_RADIUS * dpr,
        strength: HEAD_BOOST,
      }));
    }
    this.renderPass.draw(gl, this, {
      geometry,
      tile: this.tile,
      field: this.field,
      heads,
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
