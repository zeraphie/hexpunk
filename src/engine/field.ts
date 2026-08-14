/*
  ─ Field renderer ─

  The Pixi layer: one shared GraphicsContext hex reused by a
  pool of cells, culled to the visible axial range each frame,
  inside a render-group world container the camera transforms.
  Zoom bands re-stroke the one shared hex so apparent stroke
  width holds steady at any zoom.
*/
import { Container, Graphics, GraphicsContext, WebGLRenderer } from "pixi.js";
import { axialToWorld, colRange, hexCorners, rowRange } from "./lattice.js";
import type { TetherPath } from "./tether.js";
import type { AxialCoord, CameraState, EngineSkin } from "./types.js";

/** Hard cap on pooled field cells — past this the visible range is
 * partially drawn rather than the pool growing unbounded. A real
 * LOD floor for deep zoom-out is future work. */
const POOL_MAX = 3500;

/** Highlight ring inset so it reads inside the field stroke. */
const HIGHLIGHT_SCALE = 0.94;

export interface FieldOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  hexSide: number;
  skin: EngineSkin;
}

export class FieldRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly world: Container;
  private readonly cellLayer: Container;
  private readonly tetherLayer: Graphics;
  private readonly highlight: Graphics;
  private readonly pool: Graphics[] = [];
  private readonly hexSide: number;
  private skin: EngineSkin;
  private hexContext: GraphicsContext | null = null;
  private band = Number.NaN;
  private width: number;
  private height: number;

  private constructor(renderer: WebGLRenderer, options: FieldOptions) {
    this.renderer = renderer;
    this.hexSide = options.hexSide;
    this.skin = options.skin;
    this.width = options.width;
    this.height = options.height;
    this.world = new Container({ isRenderGroup: true });
    this.cellLayer = new Container();
    // Arcs sit above the field but below the hover ring, so a
    // highlighted cell still reads as the topmost thing.
    this.tetherLayer = new Graphics();
    this.highlight = new Graphics();
    this.highlight.visible = false;
    this.world.addChild(this.cellLayer, this.tetherLayer, this.highlight);
  }

  /** Async because Pixi v8 renderer init is async. */
  static async create(options: FieldOptions): Promise<FieldRenderer> {
    const renderer = new WebGLRenderer();
    await renderer.init({
      canvas: options.canvas,
      width: options.width,
      height: options.height,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
      backgroundAlpha: 0,
    });
    return new FieldRenderer(renderer, options);
  }

  /** The context's actual rasterizer — feeds software detection. */
  get rendererString(): string {
    const gl = this.renderer.gl;
    return String(gl.getParameter(gl.RENDERER) ?? "unknown");
  }

  setSkin(skin: EngineSkin): void {
    this.skin = skin;
    this.band = Number.NaN;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderer.resolution = window.devicePixelRatio || 1;
    this.renderer.resize(width, height);
  }

  setHighlight(cell: AxialCoord | null): void {
    if (!cell) {
      this.highlight.visible = false;
      return;
    }
    const [x, y] = axialToWorld(cell.q, cell.r, this.hexSide);
    this.highlight.position.set(x, y);
    this.highlight.visible = true;
  }

  /**
   * Redraw the tether layer. Widths divide by the live zoom so arcs
   * hold their apparent weight; unlike the field's banded hexes this
   * is exact, because a handful of arcs re-tessellate for free.
   */
  drawTethers(paths: readonly TetherPath[], zoom: number): void {
    const layer = this.tetherLayer;
    layer.clear();
    if (paths.length === 0) {
      return;
    }
    const width = this.skin.tetherWidth / zoom;
    const arrow = this.skin.tetherArrowSize / zoom;
    for (const path of paths) {
      const color = path.state === "idle" ? this.skin.tetherIdleColor : this.skin.tetherColor;
      layer
        .moveTo(path.fromX, path.fromY)
        .bezierCurveTo(path.c1x, path.c1y, path.c2x, path.c2y, path.toX, path.toY)
        .stroke({ width, color, cap: "round" });
      if (!path.directed) {
        continue;
      }
      // The curve's tangent at t=1 runs from the last control point
      // to the endpoint, so the head always sits flush to the face.
      const angle = Math.atan2(path.toY - path.c2y, path.toX - path.c2x);
      const spread = Math.PI / 7;
      layer
        .moveTo(path.toX, path.toY)
        .lineTo(
          path.toX - arrow * Math.cos(angle - spread),
          path.toY - arrow * Math.sin(angle - spread)
        )
        .lineTo(
          path.toX - arrow * Math.cos(angle + spread),
          path.toY - arrow * Math.sin(angle + spread)
        )
        .fill({ color });
    }
  }

  /** Cull to the camera's visible axial range, then draw. Returns
   * the number of live field cells (surfaced for diagnostics). */
  render(camera: CameraState): number {
    this.ensureBand(camera.z);
    const used = this.cull(camera);
    this.world.scale.set(camera.z);
    this.world.position.set(camera.x, camera.y);
    this.renderer.render(this.world);
    return used;
  }

  destroy(): void {
    this.renderer.destroy();
  }

  /** Rebuild the shared context when the zoom crosses a half-octave
   * band so `skin.strokeWidth` stays apparent-constant. One hexagon
   * retriangulates; every pooled cell swaps to the new context. */
  private ensureBand(zoom: number): void {
    const band = Math.round(Math.log2(zoom) * 2);
    if (band === this.band) {
      return;
    }
    this.band = band;
    const bandZoom = Math.pow(2, band / 2);
    const previous = this.hexContext;
    this.hexContext = new GraphicsContext().poly(hexCorners(this.hexSide), true).stroke({
      width: this.skin.strokeWidth / bandZoom,
      color: this.skin.strokeColor,
      alpha: this.skin.strokeAlpha,
    });
    for (const cell of this.pool) {
      cell.context = this.hexContext;
    }
    this.highlight.context = new GraphicsContext()
      .poly(hexCorners(this.hexSide, HIGHLIGHT_SCALE), true)
      .stroke({ width: this.skin.highlightWidth / bandZoom, color: this.skin.highlightColor });
    previous?.destroy();
  }

  private cull(camera: CameraState): number {
    const side = this.hexSide;
    const x0 = (0 - camera.x) / camera.z;
    const y0 = (0 - camera.y) / camera.z;
    const x1 = (this.width - camera.x) / camera.z;
    const y1 = (this.height - camera.y) / camera.z;
    const [rMin, rMax] = rowRange(y0, y1, side);
    let used = 0;
    for (let r = rMin; r <= rMax && used < POOL_MAX; r++) {
      const [qMin, qMax] = colRange(x0, x1, r, side);
      for (let q = qMin; q <= qMax && used < POOL_MAX; q++) {
        let cell = this.pool[used];
        if (!cell) {
          cell = new Graphics(this.hexContext!);
          this.pool.push(cell);
          this.cellLayer.addChild(cell);
        }
        const [x, y] = axialToWorld(q, r, side);
        cell.position.set(x, y);
        cell.visible = true;
        used++;
      }
    }
    for (let i = used; i < this.pool.length; i++) {
      this.pool[i]!.visible = false;
    }
    return used;
  }
}
