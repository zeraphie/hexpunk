/**
 * Zoom controller for `<hp-grid>`.
 *
 * Owns the wheel-zoom + button-zoom behaviour, plus the shared
 * `ZOOM_MIN` / `ZOOM_MAX` / `ZOOM_BUTTON_STEP` constants. The zoom
 * factor itself lives on the host (`HpGrid.zoom`) because it's
 * shared with pan-bounds maths and the fit-to-content algorithm —
 * this controller is the only thing that mutates it during
 * interactive zoom, but other concerns read it freely.
 *
 * Zoom-to-cursor: we keep the world point under the pointer
 * stationary across a zoom change by computing the pan offset such
 * that `(focusViewport − viewportCentre − pan) / zoom` is invariant.
 * The new pan is then clamped via the pan controller so the layout
 * can't be pushed fully offscreen.
 */

import type { PanController } from "./pan.js";
import type { HpGridPanEventDetail } from "./types.js";

/**
 * Minimum zoom factor. Going below this makes content unreadable at
 * typical viewport sizes; the recenter pass also clamps to this.
 */
export const ZOOM_MIN = 0.25;

/**
 * Maximum zoom factor. Above this the pointy-top hex grid starts
 * looking like wallpaper and useful detail is lost in a single cell.
 */
export const ZOOM_MAX = 4;

/**
 * Multiplicative step per +/- button click. Wheel zoom uses a
 * smoother per-event factor derived from `deltaY` so trackpad pinch
 * and mousewheel both feel right.
 */
export const ZOOM_BUTTON_STEP = 1.25;

/**
 * Subset of `HpGrid` the zoom controller mutates / reads. `zoom` is
 * writable here because the controller owns interactive zoom changes;
 * the pan controller's `clamp` is reused for zoom-to-cursor.
 */
export interface ZoomHost extends HTMLElement {
  /** Current zoom factor. Read at the start of each apply call;
   * written when the new zoom is committed. */
  zoom: number;
  /** Pan controller exposed for zoom-to-cursor's clamp pass. */
  readonly panController: PanController;
}

/**
 * Owns wheel-zoom + button-zoom for the grid. One instance per grid;
 * lives for the element's lifetime. The host wires the wheel handler
 * up via `addEventListener` and the buttons via Lit `@click`
 * bindings.
 */
export class ZoomController {
  /**
   * @param host - The grid element. Zoom mutations write
   *   `--hp-zoom`, `--hp-pan-x` / `--hp-pan-y`, and
   *   `data-hp-panned` directly on the host's inline style + attrs.
   */
  constructor(private readonly host: ZoomHost) {}

  /**
   * Apply a new zoom factor, optionally centred on a viewport point
   * so that point stays under the cursor after zooming (Miro/Figma
   * feel). Without a focus point, zooms around the grid centre. Pan
   * is clamped after the change so the new content extent still fits
   * in the viewport.
   *
   * @param target - Requested raw zoom (will be clamped to
   *   `[ZOOM_MIN, ZOOM_MAX]`).
   * @param focusClientX - Optional viewport-X to zoom about (px).
   *   Defaults to viewport centre.
   * @param focusClientY - Optional viewport-Y to zoom about (px).
   *   Defaults to viewport centre.
   */
  apply(target: number, focusClientX?: number, focusClientY?: number): void {
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, target));
    if (newZoom === this.host.zoom) {
      return;
    }
    const gridRect = this.host.getBoundingClientRect();
    const w = gridRect.width;
    const h = gridRect.height;
    const cx = focusClientX === undefined ? w / 2 : focusClientX - gridRect.left;
    const cy = focusClientY === undefined ? h / 2 : focusClientY - gridRect.top;
    const oldPanX = Number.parseFloat(this.host.style.getPropertyValue("--hp-pan-x")) || 0;
    const oldPanY = Number.parseFloat(this.host.style.getPropertyValue("--hp-pan-y")) || 0;
    // Zoom-to-cursor: keep the world point under the cursor stationary.
    // Derived from: cursorWorld = (cx - W/2 - panX) / zoom, kept
    // constant across the zoom change.
    const ratio = newZoom / this.host.zoom;
    const targetPanX = (cx - w / 2) * (1 - ratio) + oldPanX * ratio;
    const targetPanY = (cy - h / 2) * (1 - ratio) + oldPanY * ratio;
    this.host.zoom = newZoom;
    this.host.style.setProperty("--hp-zoom", String(newZoom));
    const { panX, panY } = this.host.panController.clamp(targetPanX, targetPanY);
    this.host.style.setProperty("--hp-pan-x", `${panX}px`);
    this.host.style.setProperty("--hp-pan-y", `${panY}px`);
    if (panX !== 0 || panY !== 0 || newZoom !== 1) {
      this.host.setAttribute("data-hp-panned", "");
    } else {
      this.host.removeAttribute("data-hp-panned");
    }
    this.host.dispatchEvent(
      new CustomEvent<HpGridPanEventDetail>("hp-grid-pan", {
        detail: { panX, panY },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Bound handler for the in-shadow `zoom-in` button. Multiplies the
   * current zoom by `ZOOM_BUTTON_STEP`.
   */
  readonly stepIn = (): void => {
    this.apply(this.host.zoom * ZOOM_BUTTON_STEP);
  };

  /**
   * Bound handler for the in-shadow `zoom-out` button. Divides the
   * current zoom by `ZOOM_BUTTON_STEP`.
   */
  readonly stepOut = (): void => {
    this.apply(this.host.zoom / ZOOM_BUTTON_STEP);
  };

  /**
   * Bound wheel handler. Ctrl/⌘ + wheel zooms; plain wheel scrolls
   * the page as normal so embedding the grid inside scrollable
   * content stays sane. Per-event factor scales with `deltaY`
   * magnitude so trackpad pinch (small deltas) and mousewheel
   * (~100 px deltas) both feel right.
   *
   * @param event - The originating wheel event.
   */
  readonly handleWheel = (event: WheelEvent): void => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0015);
    this.apply(this.host.zoom * factor, event.clientX, event.clientY);
  };
}
