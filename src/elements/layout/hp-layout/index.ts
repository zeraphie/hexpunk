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
import { findRowsPosition, halfColsForWidth } from "../../../lib/spatial/layouts/rows.js";
import { markClaimed, parseFillCells, type FillMask } from "../../../lib/spatial/layouts/index.js";
import type { AxialCoord } from "../../../lib/spatial/types.js";
import { hpLayoutStyles } from "./styles.js";

/** Widths this close (px) count as unchanged when deciding whether a
 * resize moved the `rows` wrap point. Subpixel jitter from zoom and
 * scrollbar appearance would otherwise re-pack for nothing. */
const REPACK_WIDTH_EPSILON = 0.5;

/** Breathing room in px around the placed content, so hexes on the
 * outer edge aren't clipped by the element's own box. */
const CONTENT_PADDING = 2;

/** The cell tiers, matched widest-first so the tier a rendered hex
 * belongs to can be recovered from its measured width. */
const SIZES = ["lg", "md", "sm", "xs", "xxs"] as const;

export type HpLayoutSize = (typeof SIZES)[number];

/** How far a measured width may sit from a tier's token and still
 * count as that tier. Absorbs subpixel layout and browser zoom; the
 * closest two tiers are 1.6× apart, so it cannot pick the wrong one. */
const TIER_TOLERANCE = 0.04;

/** Pitch changes below this are layout noise, not a new tier. Also
 * what stops a measure → re-place → measure loop from running away. */
const PITCH_EPSILON = 0.01;

/** Where a child's authored `size` is parked while the surface's tier
 * overrides it, so clearing `size` on the surface gives it back
 * instead of flattening the markup permanently. */
const AUTHORED_SIZE = "hpLayoutAuthoredSize";

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
 * @cssproperty --hp-cell - Cell width for an empty surface; once there
 *   are children the lattice follows their rendered width. Use `size`
 *   to scale the cells themselves.
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

  /** Cell tier for the whole surface — the only way to scale a lattice
   * that has no camera to zoom.
   *
   * It is written onto the children as their own `size`, because the
   * tier is more than a width: the stroke step, the ring proportion,
   * and md's flat-top orientation are all chosen by that attribute.
   * Pushing a cell width down instead would scale the hexes while
   * leaving them drawn to another tier's proportions.
   *
   * Leaving it unset touches nothing — children keep whatever size
   * they were authored with, which is how a surface of mixed sizes is
   * still expressible. */
  @property({ reflect: true })
  size?: HpLayoutSize;

  /** Opt into drag-to-move, pan and zoom. Per-cell override via the
   * child's own `draggable` attribute: present force-enables,
   * `draggable="false"` force-disables. */
  @property({ reflect: true, type: Boolean })
  override draggable = false;

  /** Cells per row for `layout="rows"`. Unset — the default — wraps
   * to the element's own width, the way flex items wrap, and re-packs
   * when that width changes. Set it to pin a fixed count for
   * compositions that must hold their shape regardless of space. */
  @property({ type: Number, attribute: "row-width" })
  rowWidth?: number;

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
  /** Watches the children's rendered size. Their measured width is the
   * authority for the pitch, and it is not knowable up front: a child
   * settles on its own update cycle, and its width can come from its
   * `variant` as much as its `size` — a `content` cell renders at the
   * md width having been authored with neither. */
  private sizeObserver?: ResizeObserver;
  private measureHandle = 0;
  /** Cell width per tier, read from the tokens rather than hardcoded —
   * a measured width is matched back against these to recover which
   * tier a child is actually drawn at. */
  private cellTokens: [HpLayoutSize, number][] = [];
  /** Hex side in px, measured once the element is styled. World units
   * and CSS pixels are then the same thing. */
  private hexSide = 0;
  /** Host width the last responsive-rows pack ran against, so a
   * height-only resize (which every pack causes) can't re-trigger. */
  private lastPackWidth = 0;
  /** First pack paints in place; only re-packs animate. */
  private hasPacked = false;
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
    if (this.hasUpdated) {
      // Moved in the DOM rather than freshly created: disconnect took
      // the observer down, so re-arm it or the surface stops following
      // its children's size for the rest of its life.
      this.observeChildren();
    }
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
    this.sizeObserver?.disconnect();
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    }
    if (this.measureHandle) {
      cancelAnimationFrame(this.measureHandle);
      this.measureHandle = 0;
    }
  }

  override firstUpdated(): void {
    const world = this.renderRoot.querySelector<HTMLElement>(".world");
    if (!world) {
      return;
    }
    // Styles have resolved by now, so the cell width is readable and
    // the controllers can be built against a real hex side. It may
    // still be provisional — a child that hasn't finished its own
    // update cycle measures at the wrong tier — so the observer below
    // corrects it as soon as the children settle.
    this.applySize();
    this.hexSide = this.deriveSide();
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
      onGestureChange: (mode) => {
        if (mode) {
          this.setAttribute("data-hp-gesture", mode);
        } else {
          this.removeAttribute("data-hp-gesture");
        }
      },
      requestRender: () => this.invalidate(),
    });
    this.observeChildren();
  }

  override render() {
    return html`<div class="world"><slot @slotchange=${this.handleSlotChange}></slot></div>`;
  }

  override updated(changed: Map<string, unknown>): void {
    if ((changed.has("layout") || changed.has("rowWidth")) && this.layout !== "free") {
      // One frame's grace so composite children (hp-cluster) have
      // published their own `data-fill-cells` before packing reads it.
      requestAnimationFrame(() => this.pack());
    }
    if (changed.has("size")) {
      this.applySize();
      // Children re-render at the new tier on their own schedule; the
      // observer picks the pitch up from whatever they settle at. The
      // measure is scheduled anyway so an empty surface still follows
      // its own tier, where no child resize will ever fire.
      this.scheduleMeasure();
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
    // The first pack is the surface's opening state — it paints
    // already laid out. Every later pack is a change, and changes
    // glide.
    if (!this.hasPacked) {
      this.hasPacked = true;
      this.setAttribute("data-hp-placing", "");
      requestAnimationFrame(() => this.removeAttribute("data-hp-placing"));
    }
    // The wrap cap follows the element's width unless `row-width`
    // pins it. Recorded even when pinned, so switching the attribute
    // off mid-life starts from an honest baseline.
    this.lastPackWidth = this.clientWidth;
    const pinned = this.pinnedRowWidth;
    const halfCols =
      pinned === null
        ? halfColsForWidth(this.lastPackWidth - CONTENT_PADDING * 2, this.hexSide)
        : pinned / 2;
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
          : findRowsPosition(mask as FillMask, claimed, halfCols, gap);
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

  /** Cell width per tier, from the tokens. Re-read on every derive
   * rather than cached: density modes rescale these at runtime, and a
   * match against last mode's values would miss every tier. They are
   * plain lengths, so they parse where a derived `calc()` property
   * would not (an unregistered custom property's computed value keeps
   * the expression unevaluated). */
  private readCellTokens(style: CSSStyleDeclaration): void {
    this.cellTokens = SIZES.map((size) => [
      size,
      Number.parseFloat(style.getPropertyValue(`--hp-hex-cell-${size}`)) || 0,
    ]);
  }

  /** Which tier a rendered width belongs to, or null for a child that
   * isn't drawn at any of them. */
  private tierFor(width: number): HpLayoutSize | null {
    for (const [size, token] of this.cellTokens) {
      if (token > 0 && Math.abs(width - token) <= token * TIER_TOLERANCE) {
        return size;
      }
    }
    return null;
  }

  /**
   * Hex side for the lattice pitch, one ring narrower than the cell so
   * neighbours share a single edge instead of stacking two — the
   * seamless look.
   *
   * The width is measured from a real child rather than read off a
   * token or an attribute, because neither is authoritative: an atom
   * with its own `size` sets `--hp-cell` on itself and wins over the
   * inherited value, and a cell's width can come from its `variant`
   * too — a `content` cell renders at the md width having been
   * authored with no size at all.
   *
   * The tier is then recovered *from that width*, so the cell and the
   * ring inset it pairs with always describe the same hex. Reading the
   * attribute instead is what made this wrong before: mid-update it
   * still said `sm` while the hex was already drawn at md, and the
   * lattice ended up pitched a few pixels off.
   */
  private deriveSide(): number {
    const style = getComputedStyle(this);
    this.readCellTokens(style);
    const child = this.placeableChildren()[0];
    const rendered = child?.getBoundingClientRect().width ?? 0;
    // Tokens are the fallback for an empty surface only.
    const cell =
      rendered ||
      Number.parseFloat(style.getPropertyValue("--hp-cell")) ||
      Number.parseFloat(style.getPropertyValue("--hp-hex-cell-sm")) ||
      100;
    const tier = rendered ? this.tierFor(rendered) : (this.size ?? "sm");
    const inset = tier === null ? undefined : HpHex.RING_INSET[tier];
    // Overlap by the ring's own width so the two outlines land on each
    // other exactly. Falling back to the stroke token covers children
    // that aren't hex atoms, where there is no ring to match.
    const ring =
      inset === undefined
        ? Number.parseFloat(style.getPropertyValue("--hp-hex-stroke")) || 0
        : (inset * cell) / 2;
    return Math.max(1, cell - ring) / SQRT3;
  }

  /**
   * Push the surface's tier onto the children, remembering what they
   * were authored with. The tier is an attribute rather than a cell
   * width because the stroke step, the ring proportion and md's
   * flat-top orientation are all selected by it.
   */
  private applySize(): void {
    const size = this.size;
    for (const child of this.placeableChildren()) {
      if (size) {
        child.dataset[AUTHORED_SIZE] ??= child.getAttribute("size") ?? "";
        child.setAttribute("size", size);
        continue;
      }
      const authored = child.dataset[AUTHORED_SIZE];
      if (authored === undefined) {
        continue;
      }
      delete child.dataset[AUTHORED_SIZE];
      if (authored) {
        child.setAttribute("size", authored);
      } else {
        child.removeAttribute("size");
      }
    }
  }

  /** Follow the children's rendered size, and the host's own — the
   * responsive `rows` wrap point lives on the host width. Re-observing
   * wholesale keeps the set in step with slot changes without
   * per-child bookkeeping. */
  private observeChildren(): void {
    this.sizeObserver ??= new ResizeObserver(() => this.scheduleMeasure());
    this.sizeObserver.disconnect();
    this.sizeObserver.observe(this);
    for (const child of this.placeableChildren()) {
      this.sizeObserver.observe(child);
    }
  }

  /** Never measure inside the observer callback — that is what turns a
   * resize into a loop. Coalesce to the next frame instead. */
  private scheduleMeasure(): void {
    if (this.measureHandle) {
      return;
    }
    this.measureHandle = requestAnimationFrame(() => {
      this.measureHandle = 0;
      this.remeasure();
    });
  }

  /** The authored row cap, or null to derive one from the width.
   * Folds together never-set (undefined), attribute-removed (Lit's
   * Number converter yields null) and unparseable (NaN). */
  private get pinnedRowWidth(): number | null {
    return typeof this.rowWidth === "number" && Number.isFinite(this.rowWidth)
      ? this.rowWidth
      : null;
  }

  /** Whether the wrap point is the element's own width. */
  private get autoRows(): boolean {
    return this.layout === "rows" && this.pinnedRowWidth === null;
  }

  /** Re-derive the pitch and, if anything actually moved, re-place —
   * and in responsive `rows`, re-pack when the width the rows wrap at
   * has changed. */
  private remeasure(): void {
    // A drag owns the positions while it runs; re-placing under it
    // would tear the cell out from beneath the pointer. Hold the
    // measurement rather than dropping it — a resize that lands mid-
    // drag is still real, and the drag is already running a frame loop.
    if (this.drag?.dragging || this.drag?.animating) {
      this.scheduleMeasure();
      return;
    }
    const side = this.deriveSide();
    const pitchChanged = Math.abs(side - this.hexSide) >= PITCH_EPSILON;
    if (pitchChanged) {
      this.hexSide = side;
      if (this.drag) {
        this.drag.hexSide = side;
      }
      if (this.gestures) {
        this.gestures.hexSide = side;
      }
    }
    // A pitch change moves the wrap cap too (the same width holds
    // fewer lg columns than sm), so it re-packs rather than merely
    // re-placing. Width comparison guards the loop: every pack grows
    // or shrinks the measured height, which re-fires the observer,
    // but only an inline-size change can alter where rows wrap.
    if (
      this.autoRows &&
      (pitchChanged || Math.abs(this.clientWidth - this.lastPackWidth) >= REPACK_WIDTH_EPSILON)
    ) {
      this.pack();
      return;
    }
    if (pitchChanged) {
      this.syncOccupancy();
    }
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
    this.applySize();
    this.syncOccupancy();
    this.observeChildren();
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
