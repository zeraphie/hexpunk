/*
  ─ Hex canvas engine ─

  Aesthetic-neutral pan/zoom hex world: Pixi field + float64
  camera + DOM overlay + semantic tiers + drag-snap occupancy +
  commit navigation. hp-grid and future consumers (VTT) skin
  this; the engine never names a hexpunk token.

  Deliberately NOT exported from src/index.ts — pixi.js enters
  a consumer's module graph only through this entrypoint, so
  consumers that never render a grid never pay for it.
*/
import { Camera } from "./camera.js";
import { CommitController } from "./commit.js";
import { DragController, type DragEventDetail } from "./drag.js";
import { FieldRenderer } from "./field.js";
import { hexWidth } from "./lattice.js";
import { OccupancyMap } from "./occupancy.js";
import { prepareOverlayLayer, syncOverlay } from "./overlay.js";
import { GestureController } from "./input.js";
import { tierFor } from "./tiers.js";
import type { AxialCoord, CameraState, EngineSkin, WorldRect } from "./types.js";

export { Camera } from "./camera.js";
export { CommitController } from "./commit.js";
export { DragController, type DragEventDetail } from "./drag.js";
export { FieldRenderer } from "./field.js";
export * from "./lattice.js";
export { OccupancyMap } from "./occupancy.js";
export { placeCell, prepareOverlayLayer, syncOverlay } from "./overlay.js";
export { tierFor } from "./tiers.js";
export { readTokenColor, ThemeWatcher, type PackedColor } from "./tokens.js";
export type { AxialCoord, CameraState, EngineSkin, WorldRect } from "./types.js";

export interface OccupantOptions {
  id: string;
  cell: AxialCoord;
  /** Overrides the engine-level `draggable` flag per occupant. */
  draggable?: boolean;
}

export interface HexEngineOptions {
  /** Component host — owns wheel/keyboard, sizes the engine. */
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  /** Overlay layer for rich DOM cells (camera-synced). */
  overlay: HTMLElement;
  hexSide: number;
  skin: EngineSkin;
  minZoom: number;
  maxZoom: number;
  /** Ascending apparent-width thresholds for semantic tiers. */
  tierThresholds: readonly number[];
  /** Apparent-width viewport fraction that reads as committed. */
  commitFraction?: number;
  /** Host-level drag opt-in; per-occupant `draggable` overrides. */
  draggable?: boolean;
  /** Reduced-motion: animations jump instead of tweening. */
  instant?: boolean;
  onTierChange?: (tier: number) => void;
  onHoverCell?: (cell: AxialCoord | null) => void;
  onCameraChange?: (state: CameraState, visibleCells: number) => void;
  onCommitChange?: (committed: boolean) => void;
  onPan?: () => void;
  /** Reposition an occupant's visual during drag + settle. */
  onOccupantPosition?: (id: string, wx: number, wy: number) => void;
  onDragStart?: (id: string) => void;
  onMove?: (detail: DragEventDetail) => void;
  onDrop?: (detail: { id: string; at: AxialCoord }) => void;
  onBond?: (detail: { id: string; partner: string }) => void;
  onUnbond?: (detail: { id: string; partner: string }) => void;
}

export class HexEngine {
  private readonly options: HexEngineOptions;
  private readonly camera: Camera;
  private readonly field: FieldRenderer;
  private readonly commit: CommitController;
  private readonly drag: DragController;
  private readonly gestures: GestureController;
  private readonly resizeObserver: ResizeObserver;
  readonly occupancy = new OccupancyMap();
  private readonly draggableOverrides = new Map<string, boolean>();
  private frameHandle = 0;
  private resizeQueued = false;
  private lastTier = -1;

  private constructor(options: HexEngineOptions, field: FieldRenderer) {
    this.options = options;
    this.field = field;
    this.camera = new Camera({
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      instant: options.instant,
      onChange: () => this.invalidate(),
    });
    this.commit = new CommitController({
      camera: this.camera,
      viewport: () => ({ width: options.host.clientWidth, height: options.host.clientHeight }),
      commitFraction: options.commitFraction ?? 0.55,
      onExit: () => options.onCommitChange?.(false),
    });
    this.drag = new DragController({
      occupancy: this.occupancy,
      hexSide: options.hexSide,
      instant: options.instant,
      onPosition: (id, wx, wy) => options.onOccupantPosition?.(id, wx, wy),
      onTargetChange: (target) => {
        this.field.setHighlight(target);
        this.invalidate();
      },
      onDragStart: options.onDragStart,
      onMove: options.onMove,
      onDrop: options.onDrop,
      onBond: options.onBond,
      onUnbond: options.onUnbond,
    });
    this.gestures = new GestureController({
      host: options.host,
      canvas: options.canvas,
      camera: this.camera,
      commit: this.commit,
      drag: this.drag,
      occupancy: this.occupancy,
      hexSide: options.hexSide,
      isDraggable: (id) => this.draggableOverrides.get(id) ?? options.draggable ?? false,
      onHover: (cell) => {
        this.field.setHighlight(cell);
        this.options.onHoverCell?.(cell);
        this.invalidate();
      },
      onPan: options.onPan,
      requestRender: () => this.invalidate(),
    });
    prepareOverlayLayer(options.overlay);
    // Coalesce resizes into the next frame — drawing synchronously
    // from inside a ResizeObserver callback is a known way to
    // misrender on software compositors.
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeQueued) {
        return;
      }
      this.resizeQueued = true;
      requestAnimationFrame(() => {
        this.resizeQueued = false;
        this.field.resize(options.host.clientWidth, options.host.clientHeight);
        this.commit.clampPan();
        this.invalidate();
      });
    });
    this.resizeObserver.observe(options.host);
  }

  static async create(options: HexEngineOptions): Promise<HexEngine> {
    const field = await FieldRenderer.create({
      canvas: options.canvas,
      width: options.host.clientWidth,
      height: options.host.clientHeight,
      hexSide: options.hexSide,
      skin: options.skin,
    });
    const engine = new HexEngine(options, field);
    engine.invalidate();
    return engine;
  }

  get cameraState(): CameraState {
    return this.camera.state;
  }

  get committed(): boolean {
    return this.commit.committed;
  }

  get tier(): number {
    return tierFor(hexWidth(this.options.hexSide) * this.camera.z, this.options.tierThresholds);
  }

  /** The context's actual rasterizer string (diagnostics, HUDs). */
  get rendererString(): string {
    return this.field.rendererString;
  }

  /** Claim a cell for an occupant. False when the cell is held —
   * callers pick a different cell rather than silently stacking. */
  addOccupant(options: OccupantOptions): boolean {
    if (options.draggable !== undefined) {
      this.draggableOverrides.set(options.id, options.draggable);
    }
    return this.occupancy.place(options.id, options.cell);
  }

  removeOccupant(id: string): void {
    this.occupancy.remove(id);
    this.draggableOverrides.delete(id);
  }

  setSkin(skin: EngineSkin): void {
    this.field.setSkin(skin);
    this.invalidate();
  }

  /** Fly the camera so the world point sits centred at `zoom`. */
  flyTo(zoom: number, wx = 0, wy = 0): void {
    const { host } = this.options;
    this.camera.tweenTo({
      z: zoom,
      x: host.clientWidth / 2 - wx * zoom,
      y: host.clientHeight / 2 - wy * zoom,
    });
  }

  /** Jump the camera without animating (initial placement). */
  jumpTo(zoom: number, wx = 0, wy = 0): void {
    const { host } = this.options;
    this.camera.z = zoom;
    this.camera.x = host.clientWidth / 2 - wx * zoom;
    this.camera.y = host.clientHeight / 2 - wy * zoom;
    this.invalidate();
  }

  commitTo(rect: WorldRect): void {
    this.commit.enter(rect);
    this.options.onCommitChange?.(true);
  }

  exitCommit(): void {
    this.commit.exit();
  }

  destroy(): void {
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    }
    this.resizeObserver.disconnect();
    this.gestures.dispose();
    this.drag.cancel();
    this.field.destroy();
  }

  /** Render-on-demand: one rAF per invalidation, self-sustaining
   * only while animations are live — zero rAF at idle. */
  private invalidate(): void {
    if (!this.frameHandle) {
      this.frameHandle = requestAnimationFrame(this.frame);
    }
  }

  private readonly frame = (now: number): void => {
    this.frameHandle = 0;
    const cameraMoving = this.camera.step(now);
    const dragSettling = this.drag.step(now);
    if (this.commit.committed && !this.camera.animating) {
      this.commit.clampPan();
    }
    const state = this.camera.state;
    const visible = this.field.render(state);
    syncOverlay(this.options.overlay, state);
    const tier = this.tier;
    if (tier !== this.lastTier) {
      this.lastTier = tier;
      this.options.onTierChange?.(tier);
    }
    this.options.onCameraChange?.(state, visible);
    if (cameraMoving || dragSettling) {
      this.frameHandle = requestAnimationFrame(this.frame);
    }
  };
}
