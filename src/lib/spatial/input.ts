/*
  ─ Gesture layer ─

  Plain DOM pointer + wheel events, math hit-testing — no Pixi
  event system, which would park a permanent rAF on its shared
  ticker and break the zero-wakeups-at-idle contract. A
  pointerdown on a draggable occupant starts a drag; empty
  space pans. Wheel is Figma-grained: plain wheel pans (or
  scrolls a dived page), ctrl/⌘ + wheel — including
  trackpad pinch, which browsers deliver as exactly that —
  zooms at the cursor.
*/
import type { Camera } from "./camera.js";
import type { DiveController } from "./dive.js";
import type { DragController } from "./drag.js";
import { worldToAxial } from "./lattice.js";
import type { OccupancyMap } from "./occupancy.js";
import type { AxialCoord } from "./types.js";

/** Velocity window (ms): release speed comes from the oldest
 * pointer sample younger than this — pixi-viewport's approach. */
const VELOCITY_WINDOW = 100;

/** Flicks slower than this (px/ms) don't glide. */
const MIN_FLING_SPEED = 0.05;

/** Screen-pixel slop within which a press-and-release still counts as
 * a click rather than a drag. Covers hand jitter without swallowing
 * deliberate movement; duration is deliberately NOT part of the test,
 * since holding still on a link and releasing is still a click. */
const TAP_SLOP_PX = 5;

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
  /** Omitted by consumers with no page-dive mode — the gesture
   * grammar is otherwise identical, so it is shared rather than
   * reimplemented. */
  dive?: DiveController;
  /** Set false on surfaces that are laid out in document flow rather
   * than navigated as a viewport: the camera never moves, so drags on
   * empty space and the wheel are left to the page. Drag-to-move and
   * click still work identically. */
  pannable?: boolean;
  drag: DragController;
  occupancy: OccupancyMap;
  hexSide: number;
  /** Whether the occupant may be dragged right now — folds the
   * host-level flag and per-occupant overrides together. Receives the
   * originating event so DOM consumers can also honour a drag-handle
   * selector without reimplementing the gesture. */
  isDraggable: (id: string, event: PointerEvent) => boolean;
  onHover: (cell: AxialCoord | null) => void;
  /** A click — pressed and released without travelling. Consumers
   * decide what activating a cell means. */
  onActivate?: (detail: { cell: AxialCoord; occupant: string | null }) => void;
  onPan?: () => void;
  /** A gesture took or released the pointer. Surfaces use this to
   * suppress hover/hit reactions on everything else while a drag or
   * pan owns the pointer — a fast drag sweeps the cursor across
   * neighbouring cells, and their hover states firing mid-gesture
   * reads as glitching. */
  onGestureChange?: (mode: "pan" | "drag" | null) => void;
  /** Schedule a frame — drag mutations don't touch the camera,
   * so they can't ride its onChange invalidation. */
  requestRender: () => void;
}

export class GestureController {
  private readonly options: GestureOptions;
  private mode: "pan" | "drag" | null = null;
  private samples: [number, number, number][] = [];
  /** Press origin in client px, for the click-vs-drag test. */
  private pressedAt: [number, number] | null = null;

  constructor(options: GestureOptions) {
    this.options = options;
    options.canvas.addEventListener("pointerdown", this.handlePointerDown);
    options.canvas.addEventListener("pointermove", this.handlePointerMove);
    options.canvas.addEventListener("pointerup", this.handlePointerUp);
    options.canvas.addEventListener("pointercancel", this.handlePointerCancel);
    options.canvas.addEventListener("pointerleave", this.handlePointerLeave);
    // The surface's gestures are pointer-driven; the browser's HTML5
    // drag-and-drop fights them for the same movement (the host often
    // carries the `draggable` attribute) and cancels the pointer
    // stream when it wins. It never wins here.
    options.canvas.addEventListener("dragstart", this.handleDragStart);
    // Interruption nets. Pointer capture already delivers a release
    // that happens outside the window, so these fire only when no
    // release will ever come: focus torn away mid-gesture, or capture
    // lost without an up. Both abandon the gesture rather than drop —
    // released means drop, interrupted means cancel.
    options.canvas.addEventListener("lostpointercapture", this.handleInterruption);
    window.addEventListener("blur", this.handleInterruption);
    options.host.addEventListener("wheel", this.handleWheel, { passive: false });
    options.host.addEventListener("keydown", this.handleKeyDown);
  }

  /** Track mode transitions so consumers hear each change once. */
  private setMode(mode: "pan" | "drag" | null): void {
    if (mode === this.mode) {
      return;
    }
    this.mode = mode;
    this.options.onGestureChange?.(mode);
  }

  /** Lattice pitch, settable after construction — see the same setter
   * on DragController. Both must be moved together or a press would
   * hit-test against a different lattice than the drag runs on. */
  set hexSide(value: number) {
    this.options.hexSide = value;
  }

  /** Live pan/zoom opt-out. Read per event, so a surface can hand the
   * wheel back to the page (or reclaim it) without rebuilding the
   * gesture layer. */
  set pannable(value: boolean) {
    this.options.pannable = value;
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
    canvas.removeEventListener("pointercancel", this.handlePointerCancel);
    canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    canvas.removeEventListener("dragstart", this.handleDragStart);
    canvas.removeEventListener("lostpointercapture", this.handleInterruption);
    window.removeEventListener("blur", this.handleInterruption);
    host.removeEventListener("wheel", this.handleWheel);
    host.removeEventListener("keydown", this.handleKeyDown);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const { camera, canvas, dive, drag, occupancy, hexSide, isDraggable, requestRender } =
      this.options;
    camera.stopAnimations();
    this.samples = [[event.clientX, event.clientY, performance.now()]];
    this.pressedAt = [event.clientX, event.clientY];
    // Capture is best-effort: it can throw when the pointer is
    // already gone (pen lifted between events) and its loss only
    // degrades edge-of-element tracking, never the gesture itself.
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // no capture — gesture continues uncaptured
    }
    if (!dive?.dived) {
      const [wx, wy] = this.pointerWorld(event);
      const occupant = occupancy.occupantAt(worldToAxial(wx, wy, hexSide));
      if (occupant && isDraggable(occupant, event)) {
        this.setMode("drag");
        drag.begin(occupant, wx, wy);
        this.options.onHover(null);
        requestRender();
        return;
      }
    }
    if (this.options.pannable === false) {
      // Nothing to pan — let the press through to the page so native
      // scrolling and text selection still work.
      this.setMode(null);
      return;
    }
    this.setMode("pan");
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const { camera, dive, drag, hexSide, onHover, onPan, requestRender } = this.options;
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
    if (dive?.dived) {
      camera.panBy(0, event.clientY - previous[1]);
      dive.clampPan();
    } else {
      camera.panBy(event.clientX - previous[0], event.clientY - previous[1]);
      onPan?.();
    }
    this.samples.push([event.clientX, event.clientY, performance.now()]);
    if (this.samples.length > 60) {
      this.samples.splice(0, 30);
    }
  };

  /**
   * Abandon the active gesture: an interrupted drag sends its
   * occupant home rather than dropping it wherever it was. No-op at
   * rest, which is what lets `lostpointercapture` sit as a listener —
   * a normal release clears the mode before it fires.
   */
  private abortGesture(pointerId?: number): void {
    if (this.mode === null) {
      return;
    }
    const mode = this.mode;
    this.setMode(null);
    this.pressedAt = null;
    if (pointerId !== undefined) {
      try {
        this.options.canvas.releasePointerCapture(pointerId);
      } catch {
        // was never captured — nothing to release
      }
    }
    if (mode === "drag") {
      this.options.drag.cancel();
      this.options.requestRender();
    }
  }

  /** The browser withdrew the pointer (touch takeover, native DnD
   * winning elsewhere, device change). Without this, a cancelled
   * drag stays "active" forever and every later press moves the
   * stranded occupant. */
  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.abortGesture(event.pointerId);
  };

  private readonly handleInterruption = (): void => {
    this.abortGesture();
  };

  private readonly handleDragStart = (event: Event): void => {
    event.preventDefault();
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.mode === null) {
      return;
    }
    const mode = this.mode;
    this.setMode(null);
    const pressedAt = this.pressedAt;
    this.pressedAt = null;
    try {
      this.options.canvas.releasePointerCapture(event.pointerId);
    } catch {
      // was never captured — nothing to release
    }
    const travelled = pressedAt
      ? Math.hypot(event.clientX - pressedAt[0], event.clientY - pressedAt[1])
      : Number.POSITIVE_INFINITY;
    const clicked = travelled <= TAP_SLOP_PX;
    if (clicked) {
      this.emitActivate(event);
    }
    if (mode === "drag") {
      this.options.drag.drop();
      this.options.requestRender();
      return;
    }
    // A click never flings, and a dived page has no camera to throw.
    if (clicked || this.options.dive?.dived) {
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

  private emitActivate(event: PointerEvent): void {
    const { camera, hexSide, occupancy, onActivate } = this.options;
    if (!onActivate) {
      return;
    }
    const [sx, sy] = this.local(event);
    const [wx, wy] = camera.screenToWorld(sx, sy);
    const cell = worldToAxial(wx, wy, hexSide);
    onActivate({ cell, occupant: occupancy.occupantAt(cell) });
  }

  private readonly handlePointerLeave = (): void => {
    if (this.mode === null) {
      this.options.onHover(null);
    }
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    const { camera, dive } = this.options;
    if (this.options.pannable === false) {
      // The page owns the wheel on a flow-layout surface.
      return;
    }
    event.preventDefault();
    camera.stopAnimations();
    if (event.ctrlKey || event.metaKey) {
      const clamped = Math.max(-WHEEL_DELTA_CLAMP, Math.min(WHEEL_DELTA_CLAMP, event.deltaY));
      const [sx, sy] = this.local(event);
      camera.zoomAt(sx, sy, Math.exp(-clamped * WHEEL_ZOOM_RATE));
      dive?.handleZoom();
    } else if (dive?.dived) {
      camera.panBy(0, -event.deltaY);
      dive.clampPan();
    } else {
      camera.panBy(-event.deltaX, -event.deltaY);
      this.options.onPan?.();
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      // A live gesture claims the key first: Esc mid-drag is the
      // universal "put it back". Surfacing a dive keeps second turn.
      if (this.mode !== null) {
        this.abortGesture();
        return;
      }
      this.options.dive?.surface();
    }
  };
}
