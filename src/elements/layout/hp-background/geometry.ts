/*
  ─ Canvas geometry contract ─

  The reliability core. Three invariants, each earned from a
  real bug: the canvas never exceeds the viewport, is never
  JS-repositioned on scroll, and self-corrects its size on
  every draw. Break any one and software compositors (HW
  accel off) show blank bands or leading-edge flashes.
*/

/** Result of a geometry reconciliation pass. `offLeft` / `offBottom`
 * are the canvas's bottom-left page-coordinate origin in device px —
 * the runtime shader's `uOffset`, which keeps every instance sampling
 * the tiled texture in shared page space (one continuous global
 * grid, across instances and across scroll positions). */
export interface CanvasGeometry {
  /** False when the host has no painted area (zero-sized or
   * detached) — the caller skips the GL pass entirely. */
  visible: boolean;
  /** Page-coord X of the canvas's left edge, in device px. */
  offLeft: number;
  /** Page-coord Y of the canvas's *bottom* edge, in device px.
   * Bottom because the shader flips gl_FragCoord.y — WebGL is y-up,
   * page coordinates are y-down. */
  offBottom: number;
}

const HIDDEN: CanvasGeometry = { visible: false, offLeft: 0, offBottom: 0 };

/**
 * Reconcile the canvas backing store against the host's current
 * layout box and compute the page-coordinate offset for this frame.
 *
 * **Two modes, both viewport-bounded.**
 *
 * - `page` mode: the host is `position: fixed` filling the viewport.
 *   The *browser* keeps a fixed element pinned with zero JS, so the
 *   software compositor has nothing to chase; the pattern scrolls
 *   purely through the offset (which includes scroll). Backing store
 *   = viewport × dpr.
 * - contained mode (default): the host is `position: absolute;
 *   inset: 0` inside a bounded parent. Backing store = host × dpr.
 *
 * Why this shape: a canvas larger than the viewport has its
 * off-screen region dropped by the software compositor (HW accel
 * off — VMs, RDP, locked-down browsers), leaving blank bands; and
 * JS-repositioning a canvas to chase native scroll lags a frame on
 * that same software path, flashing a blank strip at the leading
 * edge. Both bugs are structurally impossible when the canvas never
 * exceeds the viewport and never moves from JS.
 *
 * Called at the top of every draw — `getBoundingClientRect` costs
 * ~0.01 ms, cheap enough that self-correction needs no caching even
 * at pointer-move rates.
 *
 * @param host - The hp-background element (its bbox is the canvas
 *   box — the canvas fills the host via CSS).
 * @param canvas - The shadow-root canvas whose backing store is
 *   reconciled in place.
 * @param gl - Live context, if any; its viewport is updated when the
 *   backing store changes.
 * @returns The geometry for this frame, or `visible: false` when
 *   there is nothing to paint.
 */
export function reconcileCanvasGeometry(
  host: HTMLElement,
  canvas: HTMLCanvasElement | null,
  gl: WebGL2RenderingContext | null
): CanvasGeometry {
  if (!canvas) {
    return HIDDEN;
  }
  const rect = host.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cssW = rect.width;
  const cssH = rect.height;
  if (cssW <= 0 || cssH <= 0) {
    return HIDDEN;
  }
  const bw = Math.max(1, Math.round(cssW * dpr));
  const bh = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
    gl?.viewport(0, 0, bw, bh);
  }
  return {
    visible: true,
    offLeft: (rect.left + window.scrollX) * dpr,
    offBottom: (rect.bottom + window.scrollY) * dpr,
  };
}
