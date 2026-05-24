/**
 * Canvas-pan controller for `<hp-grid>`.
 *
 * Empty-space pointerdown on the grid host (anywhere that isn't a
 * `[q][r]` child) starts a Figma/Miro-style camera pan: child
 * positions stay at their axial coords, the grid translates the
 * visual offset via `--hp-pan-x` / `--hp-pan-y` CSS vars while every
 * pointermove updates the offset. Cursor switches `grab → grabbing`
 * for the duration; the host attribute `data-hp-panning` reflects
 * the state.
 *
 * The pan range is clamped so every `[q][r]` child stays at least
 * partially inside the viewport (content larger than the viewport
 * collapses to the best-fit centre — the user can still pan, just
 * within the legal bbox). `clampPan` is also re-used by the zoom
 * controller to keep zoom-to-cursor honest about its target.
 */

import type { HpGridPanEventDetail, PanState } from "./types.js";

/**
 * Subset of `HpGrid` the pan controller needs to read / mutate.
 * Narrowed to keep the cross-concern coupling explicit.
 */
export interface PanHost extends HTMLElement {
  /** Current zoom factor — pan bounds are computed in zoomed pixel
   * space (the child sizes get multiplied by `zoom`). */
  readonly zoom: number;
  /** Resolves `--hp-col-step` / `--hp-row-step` to numeric pixels. */
  computeStyleSteps(): { col: number; row: number };
}

/**
 * Owns the active pan gesture and the clamped pan-bounds maths.
 * One instance per grid; lives for the element's lifetime.
 */
export class PanController {
  private state: PanState | null = null;

  /**
   * @param host - The grid element. Listeners are added to / removed
   *   from this host directly; pan transforms apply to its inline
   *   styles.
   */
  constructor(private readonly host: PanHost) {}

  /**
   * Begin a pan from an empty-space pointerdown. Captures the pointer
   * so subsequent pointermove / pointerup events route to the host
   * even if the cursor leaves it, snapshots the current pan offset
   * (so the delta is added to it), and wires up the move / end
   * listeners.
   *
   * @param event - The originating pointerdown.
   */
  start(event: PointerEvent): void {
    this.host.setPointerCapture(event.pointerId);
    const startPanX = Number.parseFloat(this.host.style.getPropertyValue("--hp-pan-x")) || 0;
    const startPanY = Number.parseFloat(this.host.style.getPropertyValue("--hp-pan-y")) || 0;
    this.state = {
      pointerId: event.pointerId,
      origin: { clientX: event.clientX, clientY: event.clientY },
      startPanX,
      startPanY,
    };
    this.host.setAttribute("data-hp-panning", "");
    this.host.addEventListener("pointermove", this.handleMove);
    this.host.addEventListener("pointerup", this.handleEnd);
    this.host.addEventListener("pointercancel", this.handleEnd);
    event.preventDefault();
  }

  /**
   * Clamp a target pan offset to the legal range — every `[q][r]`
   * child must remain at least partially inside the viewport. Used
   * by both the live pan handler and the zoom controller (so zoom-
   * to-cursor never pushes content fully offscreen).
   *
   * @param panX - Requested horizontal pan in px.
   * @param panY - Requested vertical pan in px.
   * @returns Clamped pan offset.
   */
  clamp(panX: number, panY: number): { panX: number; panY: number } {
    const b = this.computeBounds();
    return {
      panX: Math.max(b.minX, Math.min(b.maxX, panX)),
      panY: Math.max(b.minY, Math.min(b.maxY, panY)),
    };
  }

  /**
   * Compute the legal pan range so every `[q][r]` child stays at
   * least partially inside the viewport. For each child, `pan_x` is
   * bounded by `[child_half_w − viewport_half_w − offset_x,
   * viewport_half_w − offset_x − child_half_w]`; intersecting every
   * child's range yields the grid-wide bounds. Contradictory ranges
   * (content larger than viewport in some axis) get swapped so the
   * user can still pan to either edge instead of being clamped to
   * the midpoint.
   *
   * @returns Pan-bounds rectangle in px. Zero-bounds when layout
   *   hasn't resolved yet.
   * @internal Exposed for the zoom controller's zoom-to-cursor
   *   recompute pass; consumers should use `clamp` instead.
   */
  computeBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const gridRect = this.host.getBoundingClientRect();
    const w = gridRect.width;
    const h = gridRect.height;
    if (w === 0 || h === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    const steps = this.host.computeStyleSteps();
    const zoom = this.host.zoom;
    let minX = Number.NEGATIVE_INFINITY;
    let maxX = Number.POSITIVE_INFINITY;
    let minY = Number.NEGATIVE_INFINITY;
    let maxY = Number.POSITIVE_INFINITY;
    let foundAny = false;
    for (const child of this.host.querySelectorAll<HTMLElement>("[q][r]")) {
      // Skip hidden children — they don't contribute visible area to
      // the pan range, and counting them would let stale positions
      // of filtered-out clusters constrain the bounds.
      if (child.hasAttribute("hidden")) {
        continue;
      }
      const q = Number.parseFloat(child.getAttribute("q") ?? "");
      const r = Number.parseFloat(child.getAttribute("r") ?? "");
      if (Number.isNaN(q) || Number.isNaN(r)) {
        continue;
      }
      // Use the COMPUTED (pre-transform) size so we factor in zoom
      // ourselves rather than reading the already-scaled bbox.
      const childStyle = getComputedStyle(child);
      const baseW = Number.parseFloat(childStyle.width);
      const baseH = Number.parseFloat(childStyle.height);
      if (!baseW || !baseH) {
        continue;
      }
      foundAny = true;
      const wi = baseW * zoom;
      const hi = baseH * zoom;
      const offsetX = steps.col * (q + r / 2) * zoom;
      const offsetY = steps.row * r * zoom;
      const lowerX = wi / 2 - w / 2 - offsetX;
      const upperX = w / 2 - offsetX - wi / 2;
      const lowerY = hi / 2 - h / 2 - offsetY;
      const upperY = h / 2 - offsetY - hi / 2;
      if (lowerX > minX) {
        minX = lowerX;
      }
      if (upperX < maxX) {
        maxX = upperX;
      }
      if (lowerY > minY) {
        minY = lowerY;
      }
      if (upperY < maxY) {
        maxY = upperY;
      }
    }
    if (!foundAny) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    if (minX > maxX) {
      // Content is wider than the viewport — swap so the user can pan
      // from "child's left edge at viewport's left" to "child's right
      // edge at viewport's right". Without the swap, the range
      // collapses to the midpoint and the overflowing parts stay
      // permanently clipped behind the grid's bounds.
      [minX, maxX] = [maxX, minX];
    }
    if (minY > maxY) {
      [minY, maxY] = [maxY, minY];
    }
    return { minX, maxX, minY, maxY };
  }

  private readonly handleMove = (event: PointerEvent): void => {
    if (!this.state || event.pointerId !== this.state.pointerId) {
      return;
    }
    const dx = event.clientX - this.state.origin.clientX;
    const dy = event.clientY - this.state.origin.clientY;
    // Clamp pan so every [q][r] child stays within the visible
    // viewport. If the content is bigger than the viewport, the
    // clamp collapses to the midpoint that best-fits the content.
    const { panX, panY } = this.clamp(this.state.startPanX + dx, this.state.startPanY + dy);
    this.host.style.setProperty("--hp-pan-x", `${panX}px`);
    this.host.style.setProperty("--hp-pan-y", `${panY}px`);
    if (panX !== 0 || panY !== 0) {
      this.host.setAttribute("data-hp-panned", "");
    } else {
      this.host.removeAttribute("data-hp-panned");
    }
    // Notify consumers (e.g. <hp-tether>) that the canvas offset has
    // changed so they can recompute viewport-relative geometry.
    this.host.dispatchEvent(
      new CustomEvent<HpGridPanEventDetail>("hp-grid-pan", {
        detail: { panX, panY },
        bubbles: true,
        composed: true,
      })
    );
  };

  private readonly handleEnd = (event: PointerEvent): void => {
    if (!this.state || event.pointerId !== this.state.pointerId) {
      return;
    }
    this.host.removeEventListener("pointermove", this.handleMove);
    this.host.removeEventListener("pointerup", this.handleEnd);
    this.host.removeEventListener("pointercancel", this.handleEnd);
    if (this.host.hasPointerCapture(event.pointerId)) {
      this.host.releasePointerCapture(event.pointerId);
    }
    this.host.removeAttribute("data-hp-panning");
    this.state = null;
  };
}

/**
 * Stop a pointerdown from bubbling up to the host's empty-space pan
 * handler. The viewport controls (zoom +/-, recenter) need this so
 * clicking a button doesn't simultaneously initiate a pan.
 *
 * @param event - The originating pointerdown.
 */
export function stopPanFromButton(event: Event): void {
  event.stopPropagation();
}
