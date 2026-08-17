/*
  ─ Canvas hex grid ─

  A viewport onto a hex world: rendered field, float64 camera with
  inertia and deep zoom, drag-snap, canvas tether arcs, semantic
  tiers and dive navigation — the engine does all of that; this
  element is the thin Lit shell that skins it with hexpunk tokens
  and turns slotted children into engine occupants.

  Placement decisions come from src/lib/spatial — the same code
  <hp-layout> runs — so a drag lands in the same cell on either
  surface. The two differ only in the applier: hp-layout writes CSS
  custom properties under an identity camera; this element writes
  the same properties under a camera-synced overlay, and lets the
  engine paint the field beneath.

  Pixi enters through a dynamic import on first connect: the
  element registers immediately, slotted cells render as plain DOM
  at once (that is the placeholder), and the canvas field appears
  when the chunk lands. Consumers who never render a grid never
  load it — enforced by the exports map, not tree-shaking luck.
*/
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";

import { scan } from "../../../icons/scan.js";
import { hpBase } from "../../../styles/hp-base.js";
import { HpHex } from "../../primitives/hp-hex.js";
import { axialToWorld, hexWidth, seamlessSide } from "../../../lib/spatial/lattice.js";
import { findRowsPosition } from "../../../lib/spatial/layouts/rows.js";
import { findSpiralPosition } from "../../../lib/spatial/layouts/spiral.js";
import { markClaimed, parseFillCells, type FillMask } from "../../../lib/spatial/layouts/index.js";
import { prepareOverlayLayer, syncOverlay } from "../../../lib/spatial/overlay.js";
import type { AxialCoord, WorldRect } from "../../../lib/spatial/types.js";
import type { TetherDef } from "../../../lib/spatial/tether.js";
import type { HexEngine } from "../../../engine/index.js";
import { hpGridStyles } from "./styles.js";

/** Apparent hex widths (px) at which the semantic tiers step. */
const TIER_THRESHOLDS = [100, 240, 520] as const;

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 14;

/** Axial-cell half-width cap for `layout="rows"`. A camera world has
 * no container width to respond to, so the cap is a world-shape
 * choice: at 10 half-cols the layout spans ~20 axial cells, wrapping
 * the typical components-page workload into 2–3 rows. `row-width`
 * pins a different count. */
const WIDE_HALF_COLS = 10;

/** Zoom-button step, matching the wheel's feel per press. */
const ZOOM_STEP = 1.4;

/** Breathing room around the content in the home framing, so edge
 * hexes don't kiss the viewport border. */
const FIT_PADDING_PX = 16;

/** The viewport chrome must not read as an empty-space press — that
 * would start a pan under every button click. */
function stopGestureFromControls(event: PointerEvent): void {
  event.stopPropagation();
}

export interface HpGridMoveEventDetail {
  element: HTMLElement;
  from: AxialCoord;
  to: AxialCoord;
}

export interface HpGridDropEventDetail {
  element: HTMLElement;
  at: AxialCoord;
}

export interface HpGridBondEventDetail {
  moved: HTMLElement;
  partner: HTMLElement;
}

export interface HpGridTetherEventDetail {
  source: HTMLElement;
  target: HTMLElement;
  tether: TetherDef;
}

export interface HpGridActivateEventDetail {
  cell: AxialCoord;
  element: HTMLElement | null;
}

/**
 * Canvas hex grid — a pannable, zoomable viewport onto the lattice.
 * Slotted children with `q` / `r` attributes become camera-riding
 * overlay cells; the field beneath is engine-rendered. Ships from
 * `@hexpunk/core/grid`, and the rendering engine loads by dynamic
 * import on first connect.
 *
 * Use `<hp-layout>` instead when the hexes are part of a page — it
 * places the same lattice in document flow with no camera and no
 * rendering dependency.
 *
 * @fires hp-grid-move - On release, before the settle animation. detail: { element, from, to }
 * @fires hp-grid-drop - After the settle animation completes. detail: { element, at }
 * @fires hp-grid-bond - Two cells became axially adjacent. detail: { moved, partner }
 * @fires hp-grid-unbond - Previously-adjacent cells separated
 * @fires hp-grid-tether - An arc was created. detail: { source, target, tether }
 * @fires hp-grid-untether - An arc was removed. detail: { source, target, tether }
 * @fires hp-grid-activate - A cell was clicked, not dragged. detail: { cell, element }
 * @fires hp-grid-tier - The semantic tier stepped. detail: { tier }
 * @fires hp-grid-dive - Dive navigation engaged or surfaced. detail: { dived }
 * @fires hp-grid-pan - The camera panned
 *
 * @slot - Cells carrying `q` / `r` attributes; `<hp-tether>` children
 *   are read as declarative arc data and drawn on the canvas
 *
 * @csspart controls - The viewport chrome cluster (bottom right)
 * @csspart zoom-out - The − button
 * @csspart zoom-in - The + button
 * @csspart recenter - The fly-home button
 */
@customElement("hp-grid")
export class HpGrid extends LitElement {
  /** Placement strategy — same packers as `<hp-layout>`. `free`
   * honours authored `q` / `r`; `spiral` and `rows` run the shared
   * first-fit-decreasing pack. */
  @property({ reflect: true })
  layout: "free" | "spiral" | "rows" = "free";

  /** Opt into drag-to-move. Per-cell override via the child's own
   * `draggable` attribute: present force-enables, `draggable="false"`
   * force-disables. */
  @property({ reflect: true, type: Boolean })
  override draggable = false;

  /** Graph-editor mode: dropping a cell onto another toggles an arc
   * between the pair instead of moving in. */
  @property({ reflect: true, type: Boolean })
  tetherable = false;

  /** The grid owns the pointer while the cursor is inside it — wheel
   * pans, ctrl/⌘-wheel zooms, empty-space drags pan. Set
   * `pannable="false"` to hand the wheel and empty-space presses back
   * to the page; cell drag and click keep working. */
  @property({ reflect: true })
  pannable?: string;

  /** Cells per row for `layout="rows"`; unset uses the world-shape
   * default. */
  @property({ type: Number, attribute: "row-width" })
  rowWidth?: number;

  static override styles = [hpBase, hpGridStyles];

  private engine?: HexEngine;
  /** Guards the async init against disconnect and reconnect races —
   * only the newest init may adopt the engine it created. */
  private initSeq = 0;
  private themeWatcher?: { dispose(): void };
  private readonly cells = new Map<string, HTMLElement>();
  /** Slotted hp-tether element → the engine arc it declared. */
  private readonly tetherDefs = new Map<Element, TetherDef>();
  private tetherObserver?: MutationObserver;
  private idCounter = 0;
  /** Hex side in world units (CSS px at zoom 1). */
  private hexSide = 0;
  /** First pack paints in place; only re-packs animate. */
  private hasPacked = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      // Moved in the DOM: disconnect destroyed the engine, so a fresh
      // init has to bring the canvas back to life.
      void this.initEngine();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.initSeq++;
    this.themeWatcher?.dispose();
    this.themeWatcher = undefined;
    this.tetherObserver?.disconnect();
    this.tetherObserver = undefined;
    this.engine?.destroy();
    this.engine = undefined;
  }

  override render() {
    return html`
      <canvas aria-hidden="true"></canvas>
      <div class="overlay"><slot @slotchange=${this.handleSlotChange}></slot></div>
      <div class="controls" part="controls" @pointerdown=${stopGestureFromControls}>
        <button type="button" aria-label="Zoom out" part="zoom-out" @click=${this.stepOut}>
          −
        </button>
        <button type="button" aria-label="Zoom in" part="zoom-in" @click=${this.stepIn}>+</button>
        <button type="button" aria-label="Recenter canvas" part="recenter" @click=${this.recenter}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            ${unsafeSVG(scan)}
          </svg>
        </button>
      </div>
    `;
  }

  override firstUpdated(): void {
    this.hexSide = this.deriveSide();
    const overlay = this.overlayElement;
    if (overlay) {
      prepareOverlayLayer(overlay);
    }
    // Cells are plain DOM — place them immediately so the element is
    // useful before (or without) the rendering chunk. The engine
    // adopts the same camera on arrival, so nothing jumps.
    this.syncOccupants();
    this.fitContent();
    if (this.layout !== "free") {
      // One frame's grace so composite children (hp-cluster) have
      // published their own `data-fill-cells` before packing reads it.
      requestAnimationFrame(() => this.pack());
    }
    void this.initEngine();
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("layout") && changed.get("layout") !== undefined && this.layout !== "free") {
      requestAnimationFrame(() => this.pack());
    }
    if (!this.engine) {
      return;
    }
    if (changed.has("draggable")) {
      this.engine.draggable = this.draggable;
    }
    if (changed.has("tetherable")) {
      this.engine.tetherable = this.tetherable;
    }
    if (changed.has("pannable")) {
      this.engine.pannable = this.pannableEnabled;
    }
  }

  /** Dive the camera into a world rect — the hex-becomes-page
   * navigation. Consumers wire this to `hp-grid-activate`; nothing
   * dives automatically. */
  diveInto(rect: WorldRect): void {
    this.engine?.diveInto(rect);
  }

  /** Return from a dive to the previous camera. */
  surface(): void {
    this.engine?.surface();
  }

  get dived(): boolean {
    return this.engine?.dived ?? false;
  }

  /** Current semantic tier (0 until the engine is live). */
  get tier(): number {
    return this.engine?.tier ?? 0;
  }

  /**
   * Run the shared FFD pack for `layout="spiral"` / `"rows"`, largest
   * mask first, then refit the camera to the packed content. Children
   * publish occupied cells via `data-fill-cells`; those without it
   * count as a single hex.
   */
  pack(): void {
    if (this.layout === "free") {
      return;
    }
    // The first pack is the surface's opening state — it paints
    // already laid out. Every later pack is a change, and changes
    // glide.
    if (!this.hasPacked) {
      this.hasPacked = true;
      this.setAttribute("data-hp-placing", "");
      requestAnimationFrame(() => this.removeAttribute("data-hp-placing"));
    }
    const children = this.placeableChildren();
    const items = children
      .map((element, order) => ({
        element,
        order,
        mask: parseFillCells(element.dataset.fillCells),
      }))
      .sort((a, b) => b.mask.length - a.mask.length || a.order - b.order);
    const halfCols = this.pinnedRowWidth === null ? WIDE_HALF_COLS : this.pinnedRowWidth / 2;
    const claimed = new Set<string>();
    for (const { element, mask } of items) {
      const gap = mask.length > 1;
      const position =
        this.layout === "spiral"
          ? findSpiralPosition(mask as FillMask, claimed, gap)
          : findRowsPosition(mask as FillMask, claimed, halfCols, gap);
      markClaimed(position.q, position.r, mask as FillMask, claimed);
      element.setAttribute("q", String(position.q));
      element.setAttribute("r", String(position.r));
    }
    this.syncOccupants();
    this.fitContent();
  }

  /** The authored row cap, or null for the world-shape default. Folds
   * never-set, attribute-removed (Lit's Number converter yields null)
   * and unparseable together. */
  private get pinnedRowWidth(): number | null {
    return typeof this.rowWidth === "number" && Number.isFinite(this.rowWidth)
      ? this.rowWidth
      : null;
  }

  private get pannableEnabled(): boolean {
    return this.pannable !== "false";
  }

  private get overlayElement(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".overlay");
  }

  /**
   * Hex side for the lattice pitch, one ring narrower than the sm
   * cell so field lines and overlay cells share one edge. The grid
   * pitches for the sm tier: a viewport scales by zooming the camera,
   * not by re-tiering its cells, so `size` does not exist here.
   */
  private deriveSide(): number {
    const style = getComputedStyle(this);
    const cell =
      Number.parseFloat(style.getPropertyValue("--hp-cell")) ||
      Number.parseFloat(style.getPropertyValue("--hp-hex-cell-sm")) ||
      100;
    return seamlessSide(cell, (HpHex.RING_INSET.sm * cell) / 2);
  }

  /**
   * Load the rendering engine and hand it the current DOM state. The
   * import is dynamic so pixi stays out of every static module graph;
   * the sequence guard aborts adoption when the element disconnects
   * (or reconnects) while the chunk is in flight.
   */
  private async initEngine(): Promise<void> {
    const seq = ++this.initSeq;
    const canvas = this.renderRoot.querySelector("canvas");
    const overlay = this.overlayElement;
    if (!canvas || !overlay || this.engine) {
      return;
    }
    const engineModule = await import("../../../engine/index.js");
    if (seq !== this.initSeq || !this.isConnected) {
      return;
    }
    const buildSkin = () => ({
      strokeColor: engineModule.readTokenColor(this, "--hp-outline-variant", "#2a4955").color,
      strokeAlpha: engineModule.readTokenColor(this, "--hp-outline-variant", "#2a4955").alpha,
      strokeWidth: 1.5,
      highlightColor: engineModule.readTokenColor(this, "--hp-outline", "#0088cc").color,
      highlightWidth: 2.5,
      // Arcs take the secondary hue, matching hp-tether's palette.
      tetherColor: engineModule.readTokenColor(this, "--hp-secondary", "#00cc88").color,
      tetherIdleColor: engineModule.readTokenColor(this, "--hp-secondary-container", "#005b3d")
        .color,
      tetherWidth: 2,
      tetherArrowSize: 11,
    });
    const engine = await engineModule.HexEngine.create({
      host: this,
      canvas,
      overlay,
      // Cells catch the pointer themselves (hex-shaped hit areas), so
      // gestures listen on the host, where cell and canvas presses
      // both bubble to.
      gestureSurface: this,
      hexSide: this.hexSide,
      skin: buildSkin(),
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      tierThresholds: TIER_THRESHOLDS,
      draggable: this.draggable,
      tetherable: this.tetherable,
      pannable: this.pannableEnabled,
      instant: this.prefersReducedMotion,
      isDraggable: (id, event) => this.canDrag(id, event),
      onOccupantPosition: (id, wx, wy) => this.place(id, wx, wy),
      onDragStart: (id) => this.cells.get(id)?.setAttribute("data-hp-dragging", ""),
      onMove: ({ id, from, to }) => {
        const element = this.cells.get(id);
        if (element) {
          element.setAttribute("q", String(to.q));
          element.setAttribute("r", String(to.r));
          this.emit<HpGridMoveEventDetail>("hp-grid-move", { element, from, to });
        }
      },
      onDrop: ({ id, at }) => {
        const element = this.cells.get(id);
        element?.removeAttribute("data-hp-dragging");
        if (element) {
          this.emit<HpGridDropEventDetail>("hp-grid-drop", { element, at });
        }
      },
      onBond: ({ id, partner }) => this.emitBond("hp-grid-bond", id, partner),
      onUnbond: ({ id, partner }) => this.emitBond("hp-grid-unbond", id, partner),
      onTether: ({ tether }) => this.emitTether("hp-grid-tether", tether),
      onUntether: ({ tether }) => this.emitTether("hp-grid-untether", tether),
      onActivate: ({ cell, occupant }) =>
        this.emit<HpGridActivateEventDetail>("hp-grid-activate", {
          cell,
          element: occupant ? (this.cells.get(occupant) ?? null) : null,
        }),
      onGestureChange: (mode) => {
        if (mode) {
          this.setAttribute("data-hp-gesture", mode);
        } else {
          this.removeAttribute("data-hp-gesture");
        }
      },
      onTierChange: (tier) => this.emit("hp-grid-tier", { tier }),
      onDiveChange: (dived) => this.emit("hp-grid-dive", { dived }),
      onPan: () => this.emit("hp-grid-pan", undefined),
    });
    if (seq !== this.initSeq || !this.isConnected) {
      engine.destroy();
      return;
    }
    this.engine = engine;
    this.themeWatcher = new engineModule.ThemeWatcher(() => engine.setSkin(buildSkin()));
    // The engine starts at the camera the placeholder laid out, so
    // the field appears under the cells without anything moving.
    this.syncOccupants();
    this.syncTethers();
    this.fitContent();
  }

  private get prefersReducedMotion(): boolean {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  private canDrag(id: string, event: PointerEvent): boolean {
    const element = this.cells.get(id);
    if (!element) {
      return false;
    }
    const own = element.getAttribute("draggable");
    if (own === "false") {
      return false;
    }
    if (own === null && !this.draggable) {
      return false;
    }
    // A drag-handle narrows where the gesture may start.
    const handle = element.getAttribute("drag-handle");
    if (handle) {
      const target = event.target as Element | null;
      return Boolean(target?.closest(handle));
    }
    return true;
  }

  private placeableChildren(): HTMLElement[] {
    return Array.from(this.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        element.tagName.toLowerCase() !== "hp-background" &&
        element.tagName.toLowerCase() !== "hp-tether" &&
        !element.hasAttribute("data-hp-decoration") &&
        !element.hasAttribute("hidden")
    );
  }

  private handleSlotChange(): void {
    this.syncOccupants();
    this.syncTethers();
  }

  /** Rebuild occupancy from the DOM. Ids prefer the child's own `id`
   * so `<hp-tether from to>` can reference cells naturally. */
  private syncOccupants(): void {
    this.cells.clear();
    this.engine?.occupancy.clear();
    for (const child of this.placeableChildren()) {
      const q = Number.parseFloat(child.getAttribute("q") ?? "");
      const r = Number.parseFloat(child.getAttribute("r") ?? "");
      if (Number.isNaN(q) || Number.isNaN(r)) {
        continue;
      }
      const id = child.id || child.dataset.hpGridId || `cell-${++this.idCounter}`;
      if (!child.id) {
        child.dataset.hpGridId = id;
      }
      this.cells.set(id, child);
      if (this.engine) {
        this.engine.addOccupant({ id, cell: { q, r } });
      }
      const [x, y] = axialToWorld(q, r, this.hexSide);
      this.place(id, x, y);
    }
  }

  /** Mirror slotted `<hp-tether>` children into engine arcs, and
   * follow their `state` / `directed` attributes live. */
  private syncTethers(): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    for (const def of this.tetherDefs.values()) {
      engine.removeTether(def.id);
    }
    this.tetherDefs.clear();
    this.tetherObserver?.disconnect();
    this.tetherObserver = new MutationObserver((records) => {
      for (const record of records) {
        const def = this.tetherDefs.get(record.target as Element);
        if (!def) {
          continue;
        }
        const marker = record.target as Element;
        def.state = marker.getAttribute("state") === "idle" ? "idle" : "active";
        def.directed = marker.hasAttribute("directed");
      }
      engine.requestRender();
    });
    for (const marker of Array.from(this.children)) {
      if (marker.tagName.toLowerCase() !== "hp-tether") {
        continue;
      }
      const from = this.resolveOccupant(marker.getAttribute("from"));
      const to = this.resolveOccupant(marker.getAttribute("to"));
      if (!from || !to) {
        continue;
      }
      const def = engine.addTether(from, to, {
        directed: marker.hasAttribute("directed"),
        state: marker.getAttribute("state") === "idle" ? "idle" : "active",
      });
      if (def) {
        this.tetherDefs.set(marker, def);
        this.tetherObserver.observe(marker, {
          attributes: true,
          attributeFilter: ["state", "directed"],
        });
      }
    }
    // Declarative arcs are content: they show whether or not the
    // surface offers drop-toggle authoring.
    engine.showArcs = this.tetherDefs.size > 0;
  }

  /**
   * An `<hp-tether>` endpoint reference as an occupant id. The
   * element's declarative contract is a selector (`#node-a` — what
   * the standalone hp-tether takes), so the leading `#` is accepted;
   * any other selector resolves through the DOM and lands on the
   * matched cell's id.
   */
  private resolveOccupant(ref: string | null): string | null {
    if (!ref) {
      return null;
    }
    const id = ref.startsWith("#") ? ref.slice(1) : ref;
    if (this.cells.has(id)) {
      return id;
    }
    let matched: Element | null = null;
    try {
      matched = this.querySelector(ref);
    } catch {
      return null;
    }
    if (!(matched instanceof HTMLElement)) {
      return null;
    }
    const resolved = matched.id || matched.dataset.hpGridId;
    return resolved && this.cells.has(resolved) ? resolved : null;
  }

  /** World bounding box of the content as centre + size. Zeroes for
   * an empty surface. */
  private contentBounds(): [number, number, number, number] {
    const children = this.placeableChildren();
    if (children.length === 0) {
      return [0, 0, 0, 0];
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const halfWidth = hexWidth(this.hexSide) / 2;
    for (const child of children) {
      const q = Number.parseFloat(child.getAttribute("q") ?? "0") || 0;
      const r = Number.parseFloat(child.getAttribute("r") ?? "0") || 0;
      const [x, y] = axialToWorld(q, r, this.hexSide);
      minX = Math.min(minX, x - halfWidth);
      maxX = Math.max(maxX, x + halfWidth);
      minY = Math.min(minY, y - this.hexSide);
      maxY = Math.max(maxY, y + this.hexSide);
    }
    return [(minX + maxX) / 2, (minY + maxY) / 2, maxX - minX, maxY - minY];
  }

  /**
   * The camera's home framing: content centred, zoomed so every hex
   * is fully inside the viewport — capped at 1 so a small surface
   * shows its cells at natural size rather than inflating them.
   */
  private fitFraming(): [number, number, number] {
    const [cx, cy, w, h] = this.contentBounds();
    const vw = this.clientWidth - FIT_PADDING_PX * 2;
    const vh = this.clientHeight - FIT_PADDING_PX * 2;
    let zoom = 1;
    if (w > 0 && h > 0 && vw > 0 && vh > 0) {
      zoom = Math.max(MIN_ZOOM, Math.min(1, vw / w, vh / h));
    }
    return [cx, cy, zoom];
  }

  /**
   * Jump the camera to its home framing. Before the engine arrives
   * the same framing is written straight onto the overlay, so the
   * placeholder and the live canvas agree about where the world sits.
   */
  private fitContent(): void {
    const [cx, cy, zoom] = this.fitFraming();
    if (this.engine) {
      this.engine.jumpTo(zoom, cx, cy);
      return;
    }
    const overlay = this.overlayElement;
    if (overlay) {
      syncOverlay(overlay, {
        x: this.clientWidth / 2 - cx * zoom,
        y: this.clientHeight / 2 - cy * zoom,
        z: zoom,
      });
    }
  }

  /** Fly the camera home — everything visible again. The way back
   * after panning or zooming far enough to lose the content. */
  readonly recenter = (): void => {
    const [cx, cy, zoom] = this.fitFraming();
    this.engine?.flyTo(zoom, cx, cy);
  };

  /** Zoom about the viewport centre, so the buttons don't shift what
   * the user is looking at. */
  private zoomBy(factor: number): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    const cam = engine.cameraState;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.z * factor));
    const wx = (this.clientWidth / 2 - cam.x) / cam.z;
    const wy = (this.clientHeight / 2 - cam.y) / cam.z;
    engine.flyTo(zoom, wx, wy);
  }

  private readonly stepIn = (): void => this.zoomBy(ZOOM_STEP);
  private readonly stepOut = (): void => this.zoomBy(1 / ZOOM_STEP);

  /** Position a child in world units. Geometry, not visual state — it
   * rides custom properties so the CSS owns the transform. */
  private place(id: string, wx: number, wy: number): void {
    const element = this.cells.get(id);
    element?.style.setProperty("--hp-x", `${wx}px`);
    element?.style.setProperty("--hp-y", `${wy}px`);
  }

  private emit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(type, { detail, bubbles: true, composed: true }));
  }

  private emitBond(type: string, id: string, partnerId: string): void {
    const moved = this.cells.get(id);
    const partner = this.cells.get(partnerId);
    if (moved && partner) {
      this.emit<HpGridBondEventDetail>(type, { moved, partner });
    }
  }

  private emitTether(type: string, tether: TetherDef): void {
    const source = this.cells.get(tether.from);
    const target = this.cells.get(tether.to);
    if (source && target) {
      this.emit<HpGridTetherEventDetail>(type, { source, target, tether });
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-grid": HpGrid;
  }
}
