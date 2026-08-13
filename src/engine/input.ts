/*
  ─ Gesture layer ─

  Plain DOM pointer + wheel events, math hit-testing — no Pixi
  event system, which would park a permanent rAF on its shared
  ticker and break the zero-wakeups-at-idle contract. Wheel is
  Figma-grained: plain wheel pans (or scrolls a committed page),
  ctrl/⌘ + wheel — including trackpad pinch, which browsers
  deliver as exactly that — zooms at the cursor.
  (PLAN.hp-grid-smoothness.md § Phase 2 research findings)
*/
import type { Camera } from "./camera.js";
import type { CommitController } from "./commit.js";
import { worldToAxial } from "./lattice.js";
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
  hexSide: number;
  onHover: (cell: AxialCoord | null) => void;
}

export class GestureController {
  private readonly options: GestureOptions;
  private dragging = false;
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
    const { camera, canvas } = this.options;
    this.dragging = true;
    camera.stopAnimations();
    this.samples = [[event.clientX, event.clientY, performance.now()]];
    canvas.setPointerCapture(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const { camera, commit, hexSide, onHover } = this.options;
    if (!this.dragging) {
      const [sx, sy] = this.local(event);
      const [wx, wy] = camera.screenToWorld(sx, sy);
      onHover(worldToAxial(wx, wy, hexSide));
      return;
    }
    const previous = this.samples[this.samples.length - 1]!;
    if (commit.committed) {
      camera.panBy(0, event.clientY - previous[1]);
      commit.clampPan();
    } else {
      camera.panBy(event.clientX - previous[0], event.clientY - previous[1]);
    }
    this.samples.push([event.clientX, event.clientY, performance.now()]);
    if (this.samples.length > 60) {
      this.samples.splice(0, 30);
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    this.options.canvas.releasePointerCapture(event.pointerId);
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
    if (!this.dragging) {
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
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      this.options.commit.exit();
    }
  };
}
