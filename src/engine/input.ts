/*
  ─ Gesture layer ─

  Plain DOM pointer + wheel events, math hit-testing — no Pixi
  event system, which would park a permanent rAF on its shared
  ticker and break the zero-wakeups-at-idle contract. A
  pointerdown on a draggable occupant starts a drag; empty
  space pans. Wheel is Figma-grained: plain wheel pans (or
  scrolls a committed page), ctrl/⌘ + wheel — including
  trackpad pinch, which browsers deliver as exactly that —
  zooms at the cursor.
*/
import type { Camera } from "./camera.js";
import type { CommitController } from "./commit.js";
import type { DragController } from "./drag.js";
import { worldToAxial } from "./lattice.js";
import type { OccupancyMap } from "./occupancy.js";
import type { AxialCoord } from "./types.js";

/** Velocity window (ms): release speed comes from the oldest
 * pointer sample younger than this — pixi-viewport's approach. */
const VELOCITY_WINDOW = 100;

/** Flicks slower than this (px/ms) don't glide. */
const MIN_FLING_SPEED = 0.05;

/** Mouse-wheel deltas clamp here before the exponential zoom map
 * so one notch (±100) and a trackpad tick (±2) both feel right. */
const WHEEL_DELTA_CLAMP = 20;
const WHEEL_ZOOM_RATE = 0.012;

export interface GestureOptions {
  /** Element that owns wheel + keyboard (the component host). */
  host: HTMLElement;
  /** Element that owns pointer capture (the canvas). */
  canvas: HTMLElement;
  camera: Camera;
  commit: CommitController;
  drag: DragController;
  occupancy: OccupancyMap;
  hexSide: number;
  /** Whether the occupant may be dragged right now — folds the
   * host-level flag and per-occupant overrides together. */
  isDraggable: (id: string) => boolean;
  onHover: (cell: AxialCoord | null) => void;
  onPan?: () => void;
  /** Schedule a frame — drag mutations don't touch the camera,
   * so they can't ride its onChange invalidation. */
  requestRender: () => void;
}

export class GestureController {
  private readonly options: GestureOptions;
  private mode: "pan" | "drag" | null = null;
  private samples: [number, number, number][] = [];

  constructor(options: GestureOptions) {
    this.options = options;
    options.canvas.addEventListener("pointerdown", this.handlePointerDown);
    options.canvas.addEventListener("pointermove", this.handlePointerMove);
    options.canvas.addEventListener("pointerup", this.handlePointerUp);
    options.canvas.addEventListener("pointerleave", this.handlePointerLeave);
    options.host.addEventListener("wheel", this.handleWheel, { passive: false });
    options.host.addEventListener("keydown", this.handleKeyDown);
  }

  /** Camera screen space is canvas-local: client coordinates shift
   * by the canvas box (deltas are unaffected, absolutes are not). */
  private local(event: { clientX: number; clientY: number }): [number, number] {
    const box = this.options.canvas.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top];
  }

  private pointerWorld(event: { clientX: number; clientY: number }): [number, number] {
    const [sx, sy] = this.local(event);
    return this.options.camera.screenToWorld(sx, sy);
  }

  dispose(): void {
    const { canvas, host } = this.options;
    canvas.removeEventListener("pointerdown", this.handlePointerDown);
    canvas.removeEventListener("pointermove", this.handlePointerMove);
    canvas.removeEventListener("pointerup", this.handlePointerUp);
    canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    host.removeEventListener("wheel", this.handleWheel);
    host.removeEventListener("keydown", this.handleKeyDown);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const { camera, canvas, commit, drag, occupancy, hexSide, isDraggable, requestRender } =
      this.options;
    camera.stopAnimations();
    this.samples = [[event.clientX, event.clientY, performance.now()]];
    // Capture is best-effort: it can throw when the pointer is
    // already gone (pen lifted between events) and its loss only
    // degrades edge-of-element tracking, never the gesture itself.
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // no capture — gesture continues uncaptured
    }
    if (!commit.committed) {
      const [wx, wy] = this.pointerWorld(event);
      const occupant = occupancy.occupantAt(worldToAxial(wx, wy, hexSide));
      if (occupant && isDraggable(occupant)) {
        this.mode = "drag";
        drag.begin(occupant, wx, wy);
        this.options.onHover(null);
        requestRender();
        return;
      }
    }
    this.mode = "pan";
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const { camera, commit, drag, hexSide, onHover, onPan, requestRender } = this.options;
    if (this.mode === null) {
      const [wx, wy] = this.pointerWorld(event);
      onHover(worldToAxial(wx, wy, hexSide));
      return;
    }
    if (this.mode === "drag") {
      drag.update(...this.pointerWorld(event));
      requestRender();
      return;
    }
    const previous = this.samples[this.samples.length - 1]!;
    if (commit.committed) {
      camera.panBy(0, event.clientY - previous[1]);
      commit.clampPan();
    } else {
      camera.panBy(event.clientX - previous[0], event.clientY - previous[1]);
      onPan?.();
    }
    this.samples.push([event.clientX, event.clientY, performance.now()]);
    if (this.samples.length > 60) {
      this.samples.splice(0, 30);
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.mode === null) {
      return;
    }
    const mode = this.mode;
    this.mode = null;
    try {
      this.options.canvas.releasePointerCapture(event.pointerId);
    } catch {
      // was never captured — nothing to release
    }
    if (mode === "drag") {
      this.options.drag.drop();
      this.options.requestRender();
      return;
    }
    if (this.options.commit.committed) {
      return;
    }
    const now = performance.now();
    const oldest = this.samples.find(([, , at]) => now - at <= VELOCITY_WINDOW);
    if (!oldest) {
      return;
    }
    const elapsed = now - oldest[2];
    if (elapsed < 10) {
      return;
    }
    const vx = (event.clientX - oldest[0]) / elapsed;
    const vy = (event.clientY - oldest[1]) / elapsed;
    if (Math.hypot(vx, vy) >= MIN_FLING_SPEED) {
      this.options.camera.startInertia(vx, vy, now);
    }
  };

  private readonly handlePointerLeave = (): void => {
    if (this.mode === null) {
      this.options.onHover(null);
    }
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    const { camera, commit } = this.options;
    event.preventDefault();
    camera.stopAnimations();
    if (event.ctrlKey || event.metaKey) {
      const clamped = Math.max(-WHEEL_DELTA_CLAMP, Math.min(WHEEL_DELTA_CLAMP, event.deltaY));
      const [sx, sy] = this.local(event);
      camera.zoomAt(sx, sy, Math.exp(-clamped * WHEEL_ZOOM_RATE));
      commit.handleZoom();
    } else if (commit.committed) {
      camera.panBy(0, -event.deltaY);
      commit.clampPan();
    } else {
      camera.panBy(-event.deltaX, -event.deltaY);
      this.options.onPan?.();
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      this.options.commit.exit();
    }
  };
}
