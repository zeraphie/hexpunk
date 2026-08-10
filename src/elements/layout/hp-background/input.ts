/*
  ─ Pointer + motion-preference tracking ─

  Window-level capture (the host is pointer-events: none, so
  it never sees its own events) storing raw viewport coords;
  conversion to canvas space happens at draw time where the
  geometry is known. Reduced-motion suppresses the halo live.
  (PLAN.hp-grid-smoothness.md § Steps › Step 3)
*/

import { OFFSCREEN_MOUSE } from "./render.js";

/**
 * Tracks the pointer position and the `prefers-reduced-motion`
 * preference for one element. The owner supplies a redraw scheduler;
 * the tracker never draws.
 *
 * Step 5 extends this module with touch + scroll energy splats — the
 * capture surface is deliberately isolated here so the element wiring
 * doesn't change when it does.
 */
export class PointerTracker {
  /** Last pointer position in viewport CSS coords, or the off-screen
   * sentinel before the first move / under reduced motion. */
  mouseClientX = OFFSCREEN_MOUSE;
  mouseClientY = OFFSCREEN_MOUSE;

  /** True while the user prefers reduced motion — the halo is
   * suppressed (mouse reads as off-screen) but the faint base
   * pattern still renders. */
  reducedMotion = false;

  private reducedMotionQuery: MediaQueryList | null = null;

  /**
   * @param onActivity - Called on every tracked change (pointer move
   *   or preference flip). The owner decides what a repaint means —
   *   scheduling a GL redraw on the canvas path, or repositioning
   *   the CSS reveal mask on the fallback path.
   */
  constructor(private readonly onActivity: () => void) {}

  /** Attach window/media listeners. Call from connectedCallback. */
  connect(): void {
    // Pointermove is high-frequency; passive keeps it off the scroll
    // critical path.
    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    if (typeof window.matchMedia === "function") {
      this.reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.reducedMotion = this.reducedMotionQuery.matches;
      this.reducedMotionQuery.addEventListener("change", this.handleReducedMotionChange);
    }
  }

  /** Detach everything attached by {@link connect}. */
  disconnect(): void {
    window.removeEventListener("pointermove", this.handlePointerMove);
    if (this.reducedMotionQuery) {
      this.reducedMotionQuery.removeEventListener("change", this.handleReducedMotionChange);
      this.reducedMotionQuery = null;
    }
  }

  /** The X to hand the render pass — off-screen under reduced motion
   * so the halo collapses without branching in the shader. */
  get effectiveClientX(): number {
    return this.reducedMotion ? OFFSCREEN_MOUSE : this.mouseClientX;
  }

  /** See {@link effectiveClientX}. */
  get effectiveClientY(): number {
    return this.reducedMotion ? OFFSCREEN_MOUSE : this.mouseClientY;
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.mouseClientX = event.clientX;
    this.mouseClientY = event.clientY;
    this.onActivity();
  };

  private readonly handleReducedMotionChange = (e: MediaQueryListEvent): void => {
    this.reducedMotion = e.matches;
    this.onActivity();
  };
}
