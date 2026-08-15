/*
  ─ Lightweight hex layout surface ─

  Positions slotted children on an axial lattice with CSS, and
  borrows every behavioural decision from src/lib/spatial — the
  same occupancy, drag-snap, bond diffing, camera and gesture
  grammar the canvas grid uses. Nothing about where a drop lands
  or which bonds form is decided here, so the two surfaces
  cannot disagree.

  Reach for <hp-grid> instead when the surface needs a rendered
  hex field, semantic zoom, dive navigation or tethers; those
  need a canvas, and a canvas needs Pixi.
*/
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../../styles/hp-base.js";
import { Camera } from "../../../lib/spatial/camera.js";
import { DragController } from "../../../lib/spatial/drag.js";
import { GestureController } from "../../../lib/spatial/input.js";
import { OccupancyMap } from "../../../lib/spatial/occupancy.js";
import { syncOverlay } from "../../../lib/spatial/overlay.js";
import { SQRT3, axialToWorld, parseFillCellsForBbox } from "../../../lib/spatial/lattice.js";
import { findSpiralPosition } from "../../../lib/spatial/layouts/spiral.js";
import { findRowsPosition } from "../../../lib/spatial/layouts/rows.js";
import { markClaimed, parseFillCells, type FillMask } from "../../../lib/spatial/layouts/index.js";
import type { AxialCoord } from "../../../lib/spatial/types.js";
import { hpLayoutStyles } from "./styles.js";

/** Axial-cell width cap for `layout="rows"` — sized so a typical
 * page of clusters wraps after a few per row rather than running off
 * the side. */
const ROWS_HALF_COLS = 10;

/** Zoom bounds for the CSS surface. Deliberately narrower than the
 * canvas grid's: CSS-scaled text stops being crisp well before the
 * camera runs out of range. */
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

export interface HpLayoutMoveEventDetail {
  element: HTMLElement;
  from: AxialCoord;
  to: AxialCoord;
}

export interface HpLayoutBondEventDetail {
  moved: HTMLElement;
  partner: HTMLElement;
}

/**
 * Hex coordinate surface — slotted children with `q` / `r`
 * attributes are placed on the axial lattice. `draggable` opts into
 * drag-to-move with snap, plus pan and zoom. Pure CSS: no canvas and
 * no rendering dependency.
 *
 * @fires hp-layout-move - On release, before the settle animation. detail: { element, from, to }
 * @fires hp-layout-drop - After the settle animation completes. detail: { element, at }
 * @fires hp-layout-bond - Two cells became axially adjacent. detail: { moved, partner }
 * @fires hp-layout-unbond - Previously-adjacent cells separated
 * @fires hp-layout-pan - While the surface is being panned
 *
 * @slot - Cells carrying `q` / `r` attributes
 *
 * @cssproperty --hp-cell - Cell width; defaults to `--hp-hex-cell-sm`
 */
@customElement("hp-layout")
export class HpLayout extends LitElement {
  /** Placement strategy. `free` honours each child's authored
   * `q` / `r`; `spiral` packs outward from the origin in rings;
   * `rows` packs in reading order with a width cap. The packed modes
   * run the same first-fit-decreasing pass the canvas grid uses. */
  @property({ reflect: true })
  layout: "free" | "spiral" | "rows" = "free";

  /** Opt into drag-to-move, pan and zoom. Per-cell override via the
   * child's own `draggable` attribute: present force-enables,
   * `draggable="false"` force-disables. */
  @property({ reflect: true, type: Boolean })
  override draggable = false;

  static override styles = [hpBase, hpLayoutStyles];

  /** Which child holds which cell. Shared implementation, so a
   * blocked drop resolves the same way it would on the canvas. */
  private readonly occupancy = new OccupancyMap();
  private readonly cells = new Map<string, HTMLElement>();
  private camera!: Camera;
  private drag?: DragController;
  private gestures?: GestureController;
  private frameHandle = 0;
  private idCounter = 0;
  /** Hex side in px, measured once the element is styled. World units
   * and CSS pixels are then the same thing. */
  private hexSide = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.camera = new Camera({
      minZoom: ZOOM_MIN,
      maxZoom: ZOOM_MAX,
      instant: this.prefersReducedMotion,
      onChange: () => this.invalidate(),
    });
    // The drag controller waits for firstUpdated: it needs the
    // resolved cell width, which isn't readable until styles apply.
  }

  private buildDrag(): void {
    this.drag = new DragController({
      occupancy: this.occupancy,
      hexSide: this.hexSide,
      instant: this.prefersReducedMotion,
      onPosition: (id, wx, wy) => this.place(id, wx, wy),
      onTargetChange: () => {},
      onDragStart: (id) => this.cells.get(id)?.setAttribute("data-hp-dragging", ""),
      onMove: ({ id, from, to }) => {
        const element = this.cells.get(id);
        if (element) {
          element.setAttribute("q", String(to.q));
          element.setAttribute("r", String(to.r));
          this.emit<HpLayoutMoveEventDetail>("hp-layout-move", { element, from, to });
        }
      },
      onDrop: ({ id, at }) => {
        const element = this.cells.get(id);
        element?.removeAttribute("data-hp-dragging");
        if (element) {
          this.emit("hp-layout-drop", { element, at });
        }
      },
      onBond: ({ id, partner }) => this.emitBond("hp-layout-bond", id, partner),
      onUnbond: ({ id, partner }) => this.emitBond("hp-layout-unbond", id, partner),
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.gestures?.dispose();
    this.gestures = undefined;
    this.drag?.cancel();
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    }
  }

  override firstUpdated(): void {
    const world = this.renderRoot.querySelector<HTMLElement>(".world");
    if (!world) {
      return;
    }
    // Styles have resolved by now, so the cell width is readable and
    // the controllers can be built against a real hex side.
    this.hexSide = this.measureSide();
    this.buildDrag();
    this.syncOccupancy();
    // Origin sits at the surface's centre, matching the canvas grid's
    // initial camera so both start from the same view.
    this.camera.x = this.clientWidth / 2;
    this.camera.y = this.clientHeight / 2;
    this.gestures = new GestureController({
      host: this,
      canvas: this,
      camera: this.camera,
      drag: this.drag!,
      occupancy: this.occupancy,
      hexSide: this.hexSide,
      isDraggable: (id, event) => this.canDrag(id, event),
      onHover: () => {},
      onPan: () => this.emit("hp-layout-pan", { x: this.camera.x, y: this.camera.y }),
      requestRender: () => this.invalidate(),
    });
    this.invalidate();
  }

  override render() {
    return html`<div class="world"><slot @slotchange=${this.handleSlotChange}></slot></div>`;
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("layout") && this.layout !== "free") {
      // One frame's grace so composite children (hp-cluster) have
      // published their own `data-fill-cells` before packing reads it.
      requestAnimationFrame(() => this.pack());
    }
  }

  /**
   * Run the packer for `layout="spiral"` / `"rows"`, largest mask
   * first. Children publish their occupied cells via
   * `data-fill-cells`; those without it count as a single hex.
   */
  pack(): void {
    if (this.layout === "free") {
      return;
    }
    const children = this.placeableChildren();
    const items = children
      .map((element) => ({ element, mask: parseFillCells(element.dataset.fillCells) }))
      .sort((a, b) => b.mask.length - a.mask.length);
    const claimed = new Set<string>();
    for (const { element, mask } of items) {
      const position =
        this.layout === "spiral"
          ? findSpiralPosition(mask as FillMask, claimed)
          : findRowsPosition(mask as FillMask, claimed, ROWS_HALF_COLS);
      markClaimed(position.q, position.r, mask as FillMask, claimed);
      element.setAttribute("q", String(position.q));
      element.setAttribute("r", String(position.r));
    }
    this.syncOccupancy();
    this.recenter();
  }

  /** Fit the content into view, centred, never magnifying past 1×. */
  recenter(): void {
    const children = this.placeableChildren();
    if (children.length === 0) {
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const side = this.hexSide;
    for (const child of children) {
      const q = Number.parseFloat(child.getAttribute("q") ?? "0") || 0;
      const r = Number.parseFloat(child.getAttribute("r") ?? "0") || 0;
      for (const offset of parseFillCellsForBbox(child.dataset.fillCells)) {
        const [x, y] = axialToWorld(q + offset.q, r + offset.r, side);
        minX = Math.min(minX, x - side);
        maxX = Math.max(maxX, x + side);
        minY = Math.min(minY, y - side);
        maxY = Math.max(maxY, y + side);
      }
    }
    const width = this.clientWidth;
    const height = this.clientHeight;
    if (!width || !height || maxX <= minX) {
      return;
    }
    const zoom = Math.min(1, width / (maxX - minX), height / (maxY - minY));
    this.camera.tweenTo({
      z: zoom,
      x: width / 2 - ((minX + maxX) / 2) * zoom,
      y: height / 2 - ((minY + maxY) / 2) * zoom,
    });
  }

  /** Read the resolved cell width and convert to a hex side. */
  private measureSide(): number {
    const raw = getComputedStyle(this).getPropertyValue("--hp-effective-cell");
    return (Number.parseFloat(raw) || 100) / SQRT3;
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
        !element.hasAttribute("data-hp-decoration") &&
        !element.hasAttribute("hidden")
    );
  }

  private handleSlotChange(): void {
    this.syncOccupancy();
    this.invalidate();
  }

  /** Rebuild the occupancy map from the DOM, assigning stable ids so
   * the shared controllers can address children by key. */
  private syncOccupancy(): void {
    this.cells.clear();
    this.occupancy.clear();
    for (const child of this.placeableChildren()) {
      const q = Number.parseFloat(child.getAttribute("q") ?? "");
      const r = Number.parseFloat(child.getAttribute("r") ?? "");
      if (Number.isNaN(q) || Number.isNaN(r)) {
        continue;
      }
      const id = child.dataset.hpLayoutId ?? `cell-${++this.idCounter}`;
      child.dataset.hpLayoutId = id;
      this.cells.set(id, child);
      this.occupancy.place(id, { q, r });
      const [x, y] = axialToWorld(q, r, this.hexSide);
      this.place(id, x, y);
    }
  }

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
      this.emit<HpLayoutBondEventDetail>(type, { moved, partner });
    }
  }

  private invalidate(): void {
    if (!this.frameHandle) {
      this.frameHandle = requestAnimationFrame(this.frame);
    }
  }

  private readonly frame = (now: number): void => {
    this.frameHandle = 0;
    const cameraMoving = this.camera.step(now);
    const dragSettling = this.drag?.step(now) ?? false;
    const world = this.renderRoot.querySelector<HTMLElement>(".world");
    if (world) {
      syncOverlay(world, this.camera.state);
    }
    if (cameraMoving || dragSettling) {
      this.frameHandle = requestAnimationFrame(this.frame);
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-layout": HpLayout;
  }
}
