/*
  ─ Hex layout primitive ─

  What flex is for rows and grid is for tracks, this is for the
  hex lattice: it places children and sizes to them, then gets
  out of the way. It has no camera — no pan, no zoom, no inertia
  — because a layout box belongs in document flow, where the
  page does the scrolling.

  Placement decisions still come from src/lib/spatial, so the
  occupancy rules, drag-snap outcomes and bond diffing are the
  same code the canvas grid runs and the two cannot disagree.

  Reach for <hp-grid> when the surface should behave like a
  viewport instead — a rendered hex field, camera pan/zoom,
  semantic zoom, dive navigation, tethers. That needs a canvas,
  and a canvas needs Pixi.
*/
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../../styles/hp-base.js";
import { HpHex } from "../../primitives/hp-hex.js";
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

/** Default cells per row for `layout="rows"`. A layout primitive
 * wraps tighter than a full-page packer; override with `row-width`. */
const DEFAULT_ROW_WIDTH = 6;

/** Breathing room in px around the placed content, so hexes on the
 * outer edge aren't clipped by the element's own box. */
const CONTENT_PADDING = 2;

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
 * Hex layout primitive — slotted children with `q` / `r` attributes
 * are placed on the axial lattice, and the element sizes to the
 * content it placed. No camera: the page scrolls it, the way it would
 * any other block. `draggable` opts into drag-to-move with snap.
 * Pure CSS, no rendering dependency.
 *
 * Use `<hp-grid>` instead for a viewport-like surface with camera
 * pan/zoom, semantic zoom, dive navigation or tethers.
 *
 * @fires hp-layout-move - On release, before the settle animation. detail: { element, from, to }
 * @fires hp-layout-drop - After the settle animation completes. detail: { element, at }
 * @fires hp-layout-bond - Two cells became axially adjacent. detail: { moved, partner }
 * @fires hp-layout-unbond - Previously-adjacent cells separated
 *
 * @slot - Cells carrying `q` / `r` attributes
 *
 * @cssproperty --hp-cell - Cell width; defaults to `--hp-hex-cell-sm`
 * @cssproperty --hp-layout-width - Measured content width (read-only)
 * @cssproperty --hp-layout-height - Measured content height (read-only)
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

  /** Cells per row for `layout="rows"`. */
  @property({ type: Number, attribute: "row-width" })
  rowWidth = DEFAULT_ROW_WIDTH;

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
  /** Cell-centre bounds in world units, from the last measure. A drag
   * is held inside these so the surface can't be pulled out of shape. */
  private bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    // A fixed identity camera: the shared controllers all speak world
    // coordinates, and holding it at 1× with no offset makes world
    // units and CSS pixels the same thing. It is never moved, which is
    // what makes this a layout box rather than a viewport.
    this.camera = new Camera({
      minZoom: 1,
      maxZoom: 1,
      instant: true,
      onChange: () => {},
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
      clampWorld: (wx, wy) => this.clampToBounds(wx, wy),
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
    this.gestures = new GestureController({
      host: this,
      canvas: this,
      camera: this.camera,
      drag: this.drag!,
      occupancy: this.occupancy,
      hexSide: this.hexSide,
      // No camera to drive, so empty-space presses and the wheel stay
      // with the page. Drag-to-move and click still behave identically
      // to the canvas grid, because that is the same code.
      pannable: false,
      isDraggable: (id, event) => this.canDrag(id, event),
      onHover: () => {},
      requestRender: () => this.invalidate(),
    });
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
      // Single hexes pack flush; multi-cell shapes keep the one-hex
      // gap that stops two clusters reading as one blob.
      const gap = mask.length > 1;
      const position =
        this.layout === "spiral"
          ? findSpiralPosition(mask as FillMask, claimed, gap)
          : findRowsPosition(mask as FillMask, claimed, this.rowWidth / 2, gap);
      markClaimed(position.q, position.r, mask as FillMask, claimed);
      element.setAttribute("q", String(position.q));
      element.setAttribute("r", String(position.r));
    }
    this.normalisePlacement(items.map((item) => item.element));
    this.syncOccupancy();
  }

  /**
   * Shift packed coordinates so they start near the origin. The
   * packers scan from the far edge of their range, which leaves
   * correct-but-alarming values like `r="-40"` on the DOM; a rigid
   * translation keeps the shape and makes the attributes readable.
   */
  private normalisePlacement(elements: readonly HTMLElement[]): void {
    let minQ = Infinity;
    let minR = Infinity;
    for (const element of elements) {
      minQ = Math.min(minQ, Number.parseFloat(element.getAttribute("q") ?? "0") || 0);
      minR = Math.min(minR, Number.parseFloat(element.getAttribute("r") ?? "0") || 0);
    }
    if (!Number.isFinite(minQ) || (minQ === 0 && minR === 0)) {
      return;
    }
    for (const element of elements) {
      const q = Number.parseFloat(element.getAttribute("q") ?? "0") || 0;
      const r = Number.parseFloat(element.getAttribute("r") ?? "0") || 0;
      element.setAttribute("q", String(q - minQ));
      element.setAttribute("r", String(r - minR));
    }
  }

  /**
   * Measure the placed content and make the element that size, with
   * the content's top-left at the element's top-left. The offset is
   * carried on the identity camera rather than baked into each
   * child's coordinates, so the shared controllers keep working in
   * plain world space and only the container shifts.
   */
  private updateContentBox(): void {
    const children = this.placeableChildren();
    if (children.length === 0 || !this.hexSide) {
      return;
    }
    const side = this.hexSide;
    const halfWidth = (SQRT3 * side) / 2;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const child of children) {
      const q = Number.parseFloat(child.getAttribute("q") ?? "0") || 0;
      const r = Number.parseFloat(child.getAttribute("r") ?? "0") || 0;
      for (const offset of parseFillCellsForBbox(child.dataset.fillCells)) {
        const [x, y] = axialToWorld(q + offset.q, r + offset.r, side);
        minX = Math.min(minX, x - halfWidth);
        maxX = Math.max(maxX, x + halfWidth);
        minY = Math.min(minY, y - side);
        maxY = Math.max(maxY, y + side);
      }
    }
    if (!Number.isFinite(minX)) {
      return;
    }
    // Bounds are for cell centres, so pull in by the half-extents the
    // box was grown by — clamping centres to the outer edge would let
    // a cell hang half outside.
    this.bounds = {
      minX: minX + halfWidth,
      maxX: maxX - halfWidth,
      minY: minY + side,
      maxY: maxY - side,
    };
    this.camera.x = CONTENT_PADDING - minX;
    this.camera.y = CONTENT_PADDING - minY;
    this.style.setProperty("--hp-layout-width", `${maxX - minX + CONTENT_PADDING * 2}px`);
    this.style.setProperty("--hp-layout-height", `${maxY - minY + CONTENT_PADDING * 2}px`);
    // Applied now rather than on the next frame: the offset never
    // animates, and deferring it would show one frame of content
    // sitting at the wrong place.
    const world = this.renderRoot.querySelector<HTMLElement>(".world");
    if (world) {
      syncOverlay(world, this.camera.state);
    }
  }

  /**
   * Hex side for the lattice pitch, one stroke narrower than the cell
   * so neighbours share a single edge instead of stacking two
   * strokes — the seamless look.
   *
   * The cell width is measured from a real child rather than taken
   * from `--hp-cell`, because an atom with its own `size` sets that
   * property on itself and wins over the inherited value; trusting
   * the token would pitch the lattice for one size while the hexes
   * rendered at another. Tokens are only the fallback for an empty
   * surface.
   *
   * Note it cannot read `--hp-effective-cell` either: that is a
   * `calc()`, and an unregistered custom property's computed value
   * keeps the expression unevaluated, so parsing it yields NaN.
   */
  private measureSide(): number {
    const style = getComputedStyle(this);
    const child = this.placeableChildren()[0];
    const rendered = child?.getBoundingClientRect().width ?? 0;
    const cell =
      rendered ||
      Number.parseFloat(style.getPropertyValue("--hp-cell")) ||
      Number.parseFloat(style.getPropertyValue("--hp-hex-cell-sm")) ||
      100;
    // Overlap by the ring's own half-width, so the two outlines land
    // on each other exactly. Falling back to the stroke token is only
    // for children that aren't hex atoms.
    const size = (child?.getAttribute("size") ?? "sm") as keyof typeof HpHex.RING_INSET;
    const inset = HpHex.RING_INSET[size];
    const ring =
      inset === undefined
        ? Number.parseFloat(style.getPropertyValue("--hp-hex-stroke")) || 0
        : (inset * cell) / 2;
    return Math.max(1, cell - ring) / SQRT3;
  }

  /**
   * Hold a drag inside the surface. Without it a cell can be dropped
   * beyond the content box, the box then grows to contain it, and the
   * layout reshapes itself because something was dragged off its edge.
   */
  private clampToBounds(wx: number, wy: number): [number, number] {
    if (!this.bounds) {
      return [wx, wy];
    }
    const { minX, minY, maxX, maxY } = this.bounds;
    return [
      Math.min(Math.max(minX, maxX), Math.max(Math.min(minX, maxX), wx)),
      Math.min(Math.max(minY, maxY), Math.max(Math.min(minY, maxY), wy)),
    ];
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
    this.updateContentBox();
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
    const dragSettling = this.drag?.step(now) ?? false;
    const world = this.renderRoot.querySelector<HTMLElement>(".world");
    if (world) {
      syncOverlay(world, this.camera.state);
    }
    if (dragSettling) {
      this.frameHandle = requestAnimationFrame(this.frame);
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-layout": HpLayout;
  }
}
