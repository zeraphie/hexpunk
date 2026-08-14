/*
  ─ Hex canvas engine ─

  Aesthetic-neutral pan/zoom hex world: Pixi field + float64
  camera + DOM overlay + semantic tiers + drag-snap occupancy +
  dive navigation. hp-grid and future consumers (VTT) skin
  this; the engine never names a hexpunk token.

  Deliberately NOT exported from src/index.ts — pixi.js enters
  a consumer's module graph only through this entrypoint, so
  consumers that never render a grid never pay for it.
*/
import { Camera } from "./camera.js";
import { DiveController } from "./dive.js";
import { DragController, type DragEventDetail } from "./drag.js";
import { FieldRenderer } from "./field.js";
import { axialToWorld, hexWidth } from "./lattice.js";
import { OccupancyMap } from "./occupancy.js";
import { prepareOverlayLayer, syncOverlay } from "./overlay.js";
import { GestureController } from "./input.js";
import { TetherController, type TetherDef } from "./tether.js";
import { tierFor } from "./tiers.js";
import type { AxialCoord, CameraState, EngineSkin, WorldRect } from "./types.js";

export { Camera } from "./camera.js";
export { DiveController } from "./dive.js";
export { DragController, type DragEventDetail } from "./drag.js";
export { FieldRenderer } from "./field.js";
export * from "./lattice.js";
export { OccupancyMap } from "./occupancy.js";
export { placeCell, prepareOverlayLayer, syncOverlay } from "./overlay.js";
export { TetherController, type TetherDef, type TetherPath } from "./tether.js";
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
  /** Apparent-width viewport fraction that reads as dived. */
  diveFraction?: number;
  /** Host-level drag opt-in; per-occupant `draggable` overrides. */
  draggable?: boolean;
  /** Graph-editor mode: dropping an occupant onto another toggles
   * a tether between them instead of moving it. */
  tetherable?: boolean;
  /** Reduced-motion: animations jump instead of tweening. */
  instant?: boolean;
  onTierChange?: (tier: number) => void;
  onHoverCell?: (cell: AxialCoord | null) => void;
  onCameraChange?: (state: CameraState, visibleCells: number) => void;
  onDiveChange?: (dived: boolean) => void;
  onPan?: () => void;
  /** Reposition an occupant's visual during drag + settle. */
  onOccupantPosition?: (id: string, wx: number, wy: number) => void;
  onDragStart?: (id: string) => void;
  onMove?: (detail: DragEventDetail) => void;
  onDrop?: (detail: { id: string; at: AxialCoord }) => void;
  onBond?: (detail: { id: string; partner: string }) => void;
  onUnbond?: (detail: { id: string; partner: string }) => void;
  onTether?: (detail: { tether: TetherDef }) => void;
  onUntether?: (detail: { tether: TetherDef }) => void;
  /** An arc finished choosing (or re-choosing) its vertex pair. */
  onTetherSettle?: (detail: { id: string; fromVertex: number; toVertex: number }) => void;
}

export class HexEngine {
  /** Host-level drag opt-in, live-tunable; per-occupant
   * `draggable` overrides keep winning either way. */
  draggable: boolean;

  /** Graph-editor mode, live-tunable. */
  tetherable: boolean;

  private readonly options: HexEngineOptions;
  private readonly camera: Camera;
  private readonly field: FieldRenderer;
  private readonly dive: DiveController;
  private readonly drag: DragController;
  private readonly gestures: GestureController;
  private readonly resizeObserver: ResizeObserver;
  readonly occupancy = new OccupancyMap();
  readonly tethers: TetherController;
  private readonly draggableOverrides = new Map<string, boolean>();
  /** Live world centre of a dragged occupant — arcs follow it while
   * the drag runs, and fall back to the axial centre otherwise. */
  private readonly livePositions = new Map<string, [number, number]>();
  private frameHandle = 0;
  private resizeQueued = false;
  private lastTier = -1;
  private tetherSeq = 0;

  private constructor(options: HexEngineOptions, field: FieldRenderer) {
    this.options = options;
    this.field = field;
    this.draggable = options.draggable ?? false;
    this.tetherable = options.tetherable ?? false;
    this.tethers = new TetherController({
      occupancy: this.occupancy,
      hexSide: options.hexSide,
      instant: options.instant,
      positionOf: (id) => this.positionOf(id),
      onSettle: (detail) => options.onTetherSettle?.(detail),
    });
    this.camera = new Camera({
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      instant: options.instant,
      onChange: () => this.invalidate(),
    });
    this.dive = new DiveController({
      camera: this.camera,
      viewport: () => ({ width: options.host.clientWidth, height: options.host.clientHeight }),
      diveFraction: options.diveFraction ?? 0.55,
      onSurface: () => options.onDiveChange?.(false),
    });
    this.drag = new DragController({
      occupancy: this.occupancy,
      hexSide: options.hexSide,
      instant: options.instant,
      tetherMode: () => this.tetherable,
      onTetherDrop: ({ source, target }) => this.toggleTether(source, target),
      onPosition: (id, wx, wy) => {
        this.livePositions.set(id, [wx, wy]);
        options.onOccupantPosition?.(id, wx, wy);
      },
      onTargetChange: (target) => {
        this.field.setHighlight(target);
        this.invalidate();
      },
      onDragStart: options.onDragStart,
      onMove: options.onMove,
      onDrop: (detail) => {
        this.livePositions.delete(detail.id);
        options.onDrop?.(detail);
      },
      onBond: options.onBond,
      onUnbond: options.onUnbond,
    });
    this.gestures = new GestureController({
      host: options.host,
      canvas: options.canvas,
      camera: this.camera,
      dive: this.dive,
      drag: this.drag,
      occupancy: this.occupancy,
      hexSide: options.hexSide,
      isDraggable: (id) => this.draggableOverrides.get(id) ?? this.draggable,
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
        this.dive.clampPan();
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

  get dived(): boolean {
    return this.dive.dived;
  }

  /** True while a tween or inertia glide is driving the camera —
   * consumers gate zoom-threshold triggers on this so a passing
   * animation never counts as user intent. */
  get animating(): boolean {
    return this.camera.animating;
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
    this.livePositions.delete(id);
    // An arc with no endpoint has nothing to anchor to.
    this.tethers.removeFor(id);
  }

  /** World centre of an occupant — its live drag position while one
   * is in flight, else the centre of the cell it holds. */
  private positionOf(id: string): [number, number] | null {
    const live = this.livePositions.get(id);
    if (live) {
      return live;
    }
    const cell = this.occupancy.cellOf(id);
    return cell ? axialToWorld(cell.q, cell.r, this.options.hexSide) : null;
  }

  /** Create an arc between two occupants. Ignored when one already
   * exists between the pair in either direction. */
  addTether(
    from: string,
    to: string,
    options: { directed?: boolean; state?: "idle" | "active" } = {}
  ): TetherDef | null {
    if (from === to || this.tethers.find(from, to)) {
      return null;
    }
    const tether: TetherDef = {
      id: `tether-${++this.tetherSeq}`,
      from,
      to,
      state: options.state ?? "active",
      directed: options.directed ?? false,
    };
    this.tethers.add(tether);
    this.options.onTether?.({ tether });
    this.invalidate();
    return tether;
  }

  removeTether(id: string): void {
    const tether = this.tethers.list().find((candidate) => candidate.id === id);
    if (!tether) {
      return;
    }
    this.tethers.remove(id);
    this.options.onUntether?.({ tether });
    this.invalidate();
  }

  /** Create the arc between a pair, or remove the existing one —
   * the drop-on-occupant behaviour in graph-editor mode. */
  toggleTether(from: string, to: string): void {
    const existing = this.tethers.find(from, to);
    if (existing) {
      this.removeTether(existing.id);
      return;
    }
    this.addTether(from, to);
  }

  setSkin(skin: EngineSkin): void {
    this.field.setSkin(skin);
    this.invalidate();
  }

  /** Live-tune the dived-scale threshold. */
  setDiveFraction(fraction: number): void {
    this.dive.diveFraction = fraction;
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

  diveInto(rect: WorldRect): void {
    this.dive.enter(rect);
    this.options.onDiveChange?.(true);
  }

  surface(): void {
    this.dive.exit();
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
    if (this.dive.dived && !this.camera.animating) {
      this.dive.clampPan();
    }
    const state = this.camera.state;
    this.field.drawTethers(this.tethers.paths(now), state.z);
    const visible = this.field.render(state);
    syncOverlay(this.options.overlay, state);
    const tier = this.tier;
    if (tier !== this.lastTier) {
      this.lastTier = tier;
      this.options.onTierChange?.(tier);
    }
    this.options.onCameraChange?.(state, visible);
    if (cameraMoving || dragSettling || this.tethers.animating) {
      this.frameHandle = requestAnimationFrame(this.frame);
    }
  };
}
