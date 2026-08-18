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
import { Camera } from "../lib/spatial/camera.js";
import { DiveController } from "../lib/spatial/dive.js";
import { DragController, type DragEventDetail } from "../lib/spatial/drag.js";
import { FieldRenderer } from "./field.js";
import { axialToWorld, hexWidth } from "../lib/spatial/lattice.js";
import { OccupancyMap } from "../lib/spatial/occupancy.js";
import { prepareOverlayLayer, syncOverlay } from "../lib/spatial/overlay.js";
import { GestureController } from "../lib/spatial/input.js";
import { TetherController, type TetherDef } from "../lib/spatial/tether.js";
import { fadeAlpha, tierFor } from "../lib/spatial/tiers.js";
import type { AxialCoord, CameraState, EngineSkin, WorldRect } from "../lib/spatial/types.js";

export { Camera } from "../lib/spatial/camera.js";
export { DiveController } from "../lib/spatial/dive.js";
export { DragController, type DragEventDetail } from "../lib/spatial/drag.js";
export { FieldRenderer } from "./field.js";
export * from "../lib/spatial/lattice.js";
export { OccupancyMap } from "../lib/spatial/occupancy.js";
export { placeCell, prepareOverlayLayer, syncOverlay } from "../lib/spatial/overlay.js";
export { TetherController, type TetherDef, type TetherPath } from "../lib/spatial/tether.js";
export { fadeAlpha, tierFor } from "../lib/spatial/tiers.js";
export { readTokenColor, ThemeWatcher, type PackedColor } from "./tokens.js";
export type { AxialCoord, CameraState, EngineSkin, WorldRect } from "../lib/spatial/types.js";

/** Fraction of the gating threshold at which arcs begin to fade in —
 * a short ramp reads as the graph resolving, not as a hard switch. */
const TETHER_FADE_START = 0.6;

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
  /** Set false to leave the wheel and empty-space presses with the
   * page — the gesture layer's flow-surface mode. Live-tunable via
   * the engine's `pannable` setter. */
  pannable?: boolean;
  /** Overrides the engine's own draggable resolution (host flag +
   * per-occupant overrides) with the consumer's rule. Receives the
   * originating event so DOM consumers can honour drag handles. */
  isDraggable?: (id: string, event: PointerEvent) => boolean;
  /** Element the gesture layer listens on. Defaults to the canvas —
   * right when overlay content is pointer-transparent (the
   * playground's cells). A surface whose overlay cells catch the
   * pointer themselves passes its host here instead: composed
   * events from the cells and raw events from the canvas both
   * bubble to it, so one listener sees every press. */
  gestureSurface?: HTMLElement;
  /**
   * Content tier from which arcs are drawn, fading in across the
   * threshold below it. Arcs between cells too small to label carry
   * no readable information, so by default they retire with the
   * first content tier. `0` keeps them at every zoom.
   */
  tetherMinTier?: number;
  /** Reduced-motion: animations jump instead of tweening. */
  instant?: boolean;
  onTierChange?: (tier: number) => void;
  onHoverCell?: (cell: AxialCoord | null) => void;
  /** A gesture took or released the pointer — see GestureOptions. */
  onGestureChange?: (mode: "pan" | "drag" | null) => void;
  /** A cell was clicked — pressed and released without travelling, so
   * a drag or pan never took over. The consumer decides what
   * activation means (diving in, selecting, opening). */
  onActivate?: (detail: { cell: AxialCoord; occupant: string | null }) => void;
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

  /** Applied to arcs the engine authors itself (a drop-toggle), so
   * they match arcs the consumer created explicitly. */
  defaultDirected = false;

  /** Draw arcs even while `tetherable` is off. Declaratively
   * authored arcs are content and must show on a surface that
   * doesn't offer drop-toggle authoring; `tetherable` alone keeps
   * gating the authoring gesture and the hide-the-graph toggle. */
  showArcs = false;

  private tetherableFlag: boolean;

  private readonly options: HexEngineOptions;
  private readonly camera: Camera;
  private readonly field: FieldRenderer;
  private readonly diveNav: DiveController;
  private readonly drag: DragController;
  private readonly gestures: GestureController;
  private readonly resizeObserver: ResizeObserver;
  readonly occupancy = new OccupancyMap();
  readonly tethers: TetherController;
  private readonly draggableOverrides = new Map<string, boolean>();
  private frameHandle = 0;
  private resizeHandle = 0;
  private lastTier = -1;
  private tetherSeq = 0;
  private destroyed = false;

  private constructor(options: HexEngineOptions, field: FieldRenderer) {
    this.options = options;
    this.field = field;
    this.draggable = options.draggable ?? false;
    this.tetherableFlag = options.tetherable ?? false;
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
    this.diveNav = new DiveController({
      camera: this.camera,
      viewport: () => ({ width: options.host.clientWidth, height: options.host.clientHeight }),
      diveFraction: options.diveFraction ?? 0.55,
      onSurface: () => options.onDiveChange?.(false),
    });
    this.drag = new DragController({
      occupancy: this.occupancy,
      hexSide: options.hexSide,
      instant: options.instant,
      clampWorld: (wx, wy) => this.clampToViewport(wx, wy),
      tetherMode: () => this.tetherableFlag,
      onTetherDrop: ({ source, target }) => this.toggleTether(source, target),
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
      canvas: options.gestureSurface ?? options.canvas,
      camera: this.camera,
      dive: this.diveNav,
      drag: this.drag,
      occupancy: this.occupancy,
      hexSide: options.hexSide,
      pannable: options.pannable,
      isDraggable: (id, event) =>
        options.isDraggable ? options.isDraggable(id, event) : this.canDrag(id),
      onHover: (cell) => {
        this.field.setHighlight(cell);
        this.options.onHoverCell?.(cell);
        this.invalidate();
      },
      onActivate: options.onActivate,
      onPan: options.onPan,
      onGestureChange: options.onGestureChange,
      requestRender: () => this.invalidate(),
    });
    prepareOverlayLayer(options.overlay);
    // Coalesce resizes into the next frame — drawing synchronously
    // from inside a ResizeObserver callback is a known way to
    // misrender on software compositors.
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeHandle || this.destroyed) {
        return;
      }
      this.resizeHandle = requestAnimationFrame(() => {
        this.resizeHandle = 0;
        if (this.destroyed) {
          return;
        }
        this.field.resize(options.host.clientWidth, options.host.clientHeight);
        this.diveNav.clampPan();
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
    return this.diveNav.dived;
  }

  /**
   * Graph-editor mode. Gates both authoring (drops toggle arcs) and
   * display — turning it off hides the arc layer without discarding
   * the arcs, so flipping back restores the graph as it was.
   */
  get tetherable(): boolean {
    return this.tetherableFlag;
  }

  set tetherable(value: boolean) {
    if (value === this.tetherableFlag) {
      return;
    }
    this.tetherableFlag = value;
    if (value) {
      // Reveal by drawing: each arc sweeps out from its source.
      this.tethers.drawInAll();
    }
    this.invalidate();
  }

  /** Schedule a frame. Consumers that mutate tether defs in place
   * (state, directed) call this to have the change drawn. */
  requestRender(): void {
    this.invalidate();
  }

  /** Live pan/zoom opt-out — forwards to the gesture layer, which
   * reads it per event. */
  set pannable(value: boolean) {
    this.gestures.pannable = value;
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
    const placed = this.occupancy.place(options.id, options.cell);
    if (placed) {
      // A new occupant is also a new obstacle, so arcs may re-anchor.
      this.invalidate();
    }
    return placed;
  }

  /**
   * Remove an occupant and every arc anchored to it — an arc with no
   * endpoint has nothing to hold onto. The removals are reported, so
   * a consumer tracking the graph never silently loses edges.
   */
  /** Whether this occupant can currently be dragged — the host flag
   * folded with any per-occupant override. Consumers use it to show
   * the matching affordance (cursor, handle) without duplicating the
   * rule. */
  canDrag(id: string): boolean {
    return this.draggableOverrides.get(id) ?? this.draggable;
  }

  removeOccupant(id: string): void {
    for (const tether of this.tethers.list()) {
      if (tether.from === id || tether.to === id) {
        this.removeTether(tether.id);
      }
    }
    this.occupancy.remove(id);
    this.draggableOverrides.delete(id);
    this.invalidate();
  }

  /**
   * Re-place many occupants at once — a layout pass. Cells are
   * cleared before any is claimed so occupants can swap positions,
   * and arcs are left intact: relocating an endpoint is a move, not
   * a disconnection.
   */
  placeOccupants(assignments: readonly (readonly [string, AxialCoord])[]): void {
    for (const [id] of assignments) {
      this.occupancy.remove(id);
    }
    for (const [id, cell] of assignments) {
      this.occupancy.place(id, cell);
    }
    this.invalidate();
  }

  /**
   * Arc opacity for the current zoom: full once the gating content
   * tier is reached, ramping to nothing below it.
   */
  private tetherAlpha(): number {
    const minTier = this.options.tetherMinTier ?? 1;
    if (minTier <= 0) {
      return 1;
    }
    const gate = this.options.tierThresholds[minTier - 1];
    if (gate === undefined) {
      return 1;
    }
    const apparent = hexWidth(this.options.hexSide) * this.camera.z;
    return fadeAlpha(apparent, gate, TETHER_FADE_START);
  }

  /**
   * Hold a dragged occupant inside the visible viewport: with the
   * pointer outside the host, the occupant rides the nearest
   * on-screen position, and a release settles it near where the
   * occupant is rather than where the pointer went. Inset by the hex
   * extents so the whole occupant stays visible; a viewport too
   * small for that collapses to its centreline.
   */
  private clampToViewport(wx: number, wy: number): [number, number] {
    const { host } = this.options;
    const [minX, minY] = this.camera.screenToWorld(0, 0);
    const [maxX, maxY] = this.camera.screenToWorld(host.clientWidth, host.clientHeight);
    const halfW = hexWidth(this.options.hexSide) / 2;
    const halfH = this.options.hexSide;
    const lowX = minX + halfW;
    const highX = maxX - halfW;
    const lowY = minY + halfH;
    const highY = maxY - halfH;
    return [
      lowX > highX ? (minX + maxX) / 2 : Math.min(highX, Math.max(lowX, wx)),
      lowY > highY ? (minY + maxY) / 2 : Math.min(highY, Math.max(lowY, wy)),
    ];
  }

  /** World centre of an occupant — its live drag position while one
   * is in flight, else the centre of the cell it holds. */
  private positionOf(id: string): [number, number] | null {
    const live = this.drag.livePositionOf(id);
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
      directed: options.directed ?? this.defaultDirected,
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
    this.diveNav.diveFraction = fraction;
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
    this.diveNav.dive(rect);
    this.options.onDiveChange?.(true);
  }

  surface(): void {
    this.diveNav.surface();
  }

  destroy(): void {
    // Set first: cancel() and dispose() can both trigger callbacks
    // that would otherwise schedule a frame onto a dead renderer.
    this.destroyed = true;
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    }
    if (this.resizeHandle) {
      cancelAnimationFrame(this.resizeHandle);
      this.resizeHandle = 0;
    }
    this.resizeObserver.disconnect();
    this.gestures.dispose();
    this.drag.cancel();
    this.tethers.clear();
    this.field.destroy();
  }

  /** Render-on-demand: one rAF per invalidation, self-sustaining
   * only while animations are live — zero rAF at idle. */
  private invalidate(): void {
    if (this.destroyed) {
      return;
    }
    if (!this.frameHandle) {
      this.frameHandle = requestAnimationFrame(this.frame);
    }
  }

  private readonly frame = (now: number): void => {
    this.frameHandle = 0;
    if (this.destroyed) {
      return;
    }
    const cameraMoving = this.camera.step(now);
    const dragSettling = this.drag.step(now);
    if (this.diveNav.dived && !this.camera.animating) {
      this.diveNav.clampPan();
    }
    const state = this.camera.state;
    // Arcs only exist while the graph layer is on and the zoom is
    // close enough to read them; a frozen morph resolves on its own
    // the next time paths are resolved.
    const arcAlpha = this.tetherAlpha();
    const drawArcs = (this.tetherableFlag || this.showArcs) && arcAlpha > 0;
    this.field.drawTethers(drawArcs ? this.tethers.paths(now) : [], state.z, arcAlpha);
    const visible = this.field.render(state);
    syncOverlay(this.options.overlay, state);
    const tier = this.tier;
    if (tier !== this.lastTier) {
      this.lastTier = tier;
      this.options.onTierChange?.(tier);
    }
    this.options.onCameraChange?.(state, visible);
    if (
      cameraMoving ||
      dragSettling ||
      ((this.tetherableFlag || this.showArcs) && this.tethers.animating)
    ) {
      this.frameHandle = requestAnimationFrame(this.frame);
    }
  };
}
