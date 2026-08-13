/*
  ─ Hex canvas engine ─

  Aesthetic-neutral pan/zoom hex world: Pixi field + float64
  camera + DOM overlay + semantic tiers + commit navigation.
  hp-grid's Phase 2 renderer and future consumers (VTT) skin
  this; the engine never names a hexpunk token.

  Deliberately NOT exported from src/index.ts — pixi.js enters
  a consumer's module graph only through this entrypoint, so
  non-grid consumers never pay for it (Q6 isolation shape).
  (PLAN.hp-grid-smoothness.md § Phase 2 · step 2)
*/
import { Camera } from "./camera.js";
import { CommitController } from "./commit.js";
import { FieldRenderer } from "./field.js";
import { hexWidth } from "./lattice.js";
import { prepareOverlayLayer, syncOverlay } from "./overlay.js";
import { GestureController } from "./input.js";
import { tierFor } from "./tiers.js";
import type { AxialCoord, CameraState, EngineSkin, WorldRect } from "./types.js";

export { Camera } from "./camera.js";
export { CommitController } from "./commit.js";
export { FieldRenderer } from "./field.js";
export * from "./lattice.js";
export { placeCell, prepareOverlayLayer, syncOverlay } from "./overlay.js";
export { tierFor } from "./tiers.js";
export { readTokenColor, ThemeWatcher, type PackedColor } from "./tokens.js";
export type { AxialCoord, CameraState, EngineSkin, WorldRect } from "./types.js";

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
  /** Reduced-motion: animations jump instead of tweening. */
  instant?: boolean;
  onTierChange?: (tier: number) => void;
  onHoverCell?: (cell: AxialCoord | null) => void;
  onCameraChange?: (state: CameraState, visibleCells: number) => void;
  onCommitChange?: (committed: boolean) => void;
}

export class HexEngine {
  private readonly options: HexEngineOptions;
  private readonly camera: Camera;
  private readonly field: FieldRenderer;
  private readonly commit: CommitController;
  private readonly gestures: GestureController;
  private readonly resizeObserver: ResizeObserver;
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
    this.gestures = new GestureController({
      host: options.host,
      canvas: options.canvas,
      camera: this.camera,
      commit: this.commit,
      hexSide: options.hexSide,
      onHover: (cell) => {
        this.field.setHighlight(cell);
        options.onHoverCell?.(cell);
        this.invalidate();
      },
    });
    prepareOverlayLayer(options.overlay);
    // Coalesce resizes into the next frame — never draw from
    // inside a ResizeObserver callback (Phase 1 invariant).
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

  /** The context's actual rasterizer string (tier detection, HUDs). */
  get rendererString(): string {
    return this.field.rendererString;
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
    this.field.destroy();
  }

  /** Render-on-demand: one rAF per invalidation, self-sustaining
   * only while camera animations are live — zero rAF at idle. */
  private invalidate(): void {
    if (!this.frameHandle) {
      this.frameHandle = requestAnimationFrame(this.frame);
    }
  }

  private readonly frame = (now: number): void => {
    this.frameHandle = 0;
    const animating = this.camera.step(now);
    if (this.commit.committed && this.camera.animating === false) {
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
    if (animating) {
      this.frameHandle = requestAnimationFrame(this.frame);
    }
  };
}
