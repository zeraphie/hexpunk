// hp-grid.ts — The invisible hex coordinate space.
//
// Surface primitive that owns the axial `(q, r)` coordinate system. Any
// slotted child with `q` and `r` attributes is positioned in the grid
// via CSS custom-property transforms — no layout JS at rest.
//
// **v2 scope.** Layout (q/r → CSS transforms via slotchange) plus the
// pointer-driven behaviour layer: drag, snap-to-slot, an in-memory
// occupancy map that rejects overlapping drops, and bond-event
// emission. On every drop the grid diffs the dragged element's
// axially-adjacent neighbours before vs. after the move and fires
// `hp-grid-bond` for each newly-bonded pair, `hp-grid-unbond` for
// each broken bond. Keyboard alternative, drag-overlay reveal, and
// multi-cell footprints are still deferred to follow-up passes — see
// PLAN.md's spatial-primitives stage.
//
// **`drag-handle` attribute** (on a [q][r] child): optional CSS
// selector that restricts where a drag can be initiated within that
// child. Without it the child is grabbable anywhere; with it only a
// pointerdown landing inside an element matching the selector starts
// a drag. Lets composite children like `<hp-cluster>` expose only
// their centre hex as the grip while outer slots stay inert.
//
// **Pannable canvas (Miro/Figma style).** Pointerdown on empty grid
// space (not on a [q][r] child) starts a canvas pan: the visual
// offset shifts via `--hp-pan-x` / `--hp-pan-y` CSS vars while every
// hex's q/r stays put. `overflow: hidden` on the host clips content
// that pans outside the visible bbox. A `hp-grid-pan` event fires
// on every pointermove so consumers deriving viewport-relative
// geometry (e.g. `<hp-tether>` recomputing bezier endpoints) can keep
// up. Cursor switches `grab → grabbing` while panning.
//
// **The math** (from DESIGN.md § Layout & Spacing — pointy-top hex with
// bounding box `w × w·2/√3`):
//
// - axial `q` step → `(+w, 0)` — adjacent cells in the same row.
// - axial `r` step → `(+w/2, +w·√3/2)` — adjacent cells along the r-axis.
//
// **Stroke-overlap correction.** Adjacent hexes' stroke bands sit
// *inside* each hex's outer boundary, so naïve `w`-spacing produces a
// `2 × hex-stroke` thick line at every shared edge. The grid uses an
// **effective cell width** of `w − hex-stroke` for both steps so the
// two adjacent hexes overlap by exactly `hex-stroke` pixels, making
// their stroke bands coincide into a single shared edge.
//
// The grid sets two inheritable custom properties: `--hp-col-step`
// (`w − hex-stroke`) and `--hp-row-step` (`(w − hex-stroke) · √3/2`).
// Each child's `q`/`r` attributes are reflected onto `--hp-q` /
// `--hp-r` inline style properties when the slot mounts; the CSS
// transform reads from there.
//
// **Drag interaction.** Pointer-down on a slotted child kicks off a
// drag: pointer-move updates a pair of `--hp-drag-x` / `--hp-drag-y`
// inline style overrides on the dragged child, shifting its rendered
// position to follow the cursor without disturbing the underlying
// `q`/`r` attributes. Pointer-up rounds the cursor offset to the
// nearest axial `(q, r)` slot, checks occupancy, and either updates
// the child's attributes (emitting an `hp-grid-move` event) or
// bounces back. The dragged child gains `data-hp-dragging` for the
// duration so consumers can style it (cursor, opacity, layer).
//
// `<hp-cluster>` and similar preset layouts will compose `<hp-grid>`
// with fixed children rather than re-implementing the coordinate math.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";

import "../tether/hp-tether.js";
import { scan } from "../../icons/scan.js";
import { hpBase } from "../../styles/hp-base.js";
import {
  type FillMask,
  findFirstFreePosition,
  markClaimed,
  parseFillCells,
} from "./hp-grid-pack.js";

// Pointy-top hex row step is `w · √3/2`. Precomputed to avoid relying
// on CSS `sqrt()` which isn't reliable across Baseline 2025.
const ROW_STEP_FACTOR = 0.8660254;

interface AxialCoord {
  q: number;
  r: number;
}

interface DragState {
  element: HTMLElement;
  pointerId: number;
  origin: { clientX: number; clientY: number };
  startCoord: AxialCoord;
}

/** Pan state — empty-space pointerdown initiates a Figma/Miro-style
 * pan that translates the canvas via `--hp-pan-x` / `--hp-pan-y`
 * CSS vars. Children remain at their q/r axial coords; only the
 * visual offset changes. */
interface PanState {
  pointerId: number;
  origin: { clientX: number; clientY: number };
  startPanX: number;
  startPanY: number;
}

/** Event emitted when a child finishes a drag onto a new slot. */
export interface HpGridMoveEventDetail {
  element: HTMLElement;
  from: AxialCoord;
  to: AxialCoord;
}

/** Event emitted whenever a bond is formed or broken between two
 * hexes by a drop. A "bond" here is pure axial adjacency on the q/r
 * grid — the two hexes share an edge. Fired after `hp-grid-move`,
 * once per bond gained or lost on the dropped element. Use
 * `hp-grid-bond` to play in a `<hp-bond>` indicator or kick off
 * consumer-side bonded-group logic; use `hp-grid-unbond` to clean
 * up indicators that no longer apply. */
export interface HpGridBondEventDetail {
  /** The hex that was just dropped — drives the event. */
  moved: HTMLElement;
  /** The neighbour on the other side of the bond. */
  partner: HTMLElement;
}

/** Fires once the 90ms post-drop snap animation has fully settled on
 * its target slot. Same detail shape as `hp-grid-move` so a single
 * handler can serve both. Use this when the consumer needs to react
 * to the visual completion (e.g. persisting layout state to a back-
 * end, kicking off a follow-on animation) and shouldn't fire while
 * the hex is mid-flight. Skipped on no-op drops (target == start)
 * and on cancelled drags. */
export type HpGridDropEventDetail = HpGridMoveEventDetail;

/** Fires every pointermove while the canvas is being panned via
 * empty-space drag. Detail carries the current pan offset in
 * pixels. Consumers that derive viewport-relative geometry (e.g.
 * `<hp-tether>` recomputing its bezier endpoints) should listen for
 * this so they keep up with the camera move. */
export interface HpGridPanEventDetail {
  panX: number;
  panY: number;
}

/** Event emitted on the tetherable grid when a drag-to-tether
 * interaction creates or removes an arc between two hexes. Detail
 * carries the two endpoint elements and the hp-tether element that
 * was created (for the tether event) or just removed (for untether —
 * the element is detached from the DOM at this point, but a
 * reference is provided so consumers can react). */
export interface HpGridTetherEventDetail {
  source: HTMLElement;
  target: HTMLElement;
  tether: HTMLElement;
}

/**
 * Hex coordinate space — slotted children with q / r attributes are
 * positioned by CSS transforms. `draggable` opts into drag-to-move
 * and canvas pan; `tetherable` opts into drag-to-toggle hp-tether
 * arcs.
 *
 * @fires hp-grid-move - Fires immediately on drop. detail: { element, from, to }
 * @fires hp-grid-drop - Fires after the snap-back animation completes
 * @fires hp-grid-bond - Two cells became axially adjacent. detail: { moved, partner }
 * @fires hp-grid-unbond - Previously-adjacent cells separated
 * @fires hp-grid-pan - Fires while the canvas is panning
 * @fires hp-grid-tether - drag-to-tether created an arc. detail: { source, target, tether }
 * @fires hp-grid-untether - drag-to-tether removed an existing arc
 *
 * @slot - Slotted cells with q / r attributes
 *
 * @cssproperty --hp-cell - Cell width
 */
@customElement("hp-grid")
export class HpGrid extends LitElement {
  /** Cell size for the grid — `sm` (default `hex-cell-sm`), `md`, `lg`. */
  @property({ reflect: true })
  size: "sm" | "md" | "lg" = "sm";

  /** Opt into graph-editor semantics. When set, dropping a hex onto
   * another hex toggles an `<hp-tether>` arc between the two instead
   * of BFS-snapping to the nearest empty axial neighbour. The
   * source snaps back to its origin slot; the target stays put. A
   * tether is created if none exists between the pair (in either
   * direction); an existing tether is removed (toggle). Empty-cell
   * drops still move the hex normally. Consumers building layout
   * surfaces leave this off; consumers building graph / node
   * editors turn it on. */
  @property({ reflect: true, type: Boolean })
  tetherable = false;

  /** Opt into drag / pan. When unset (default), the grid is static —
   * cells stay where they're authored and empty-space pointerdowns
   * do nothing. When set, all interactive cells become draggable
   * by default and empty-space drags pan the canvas. Per-cell
   * override via the cell's own `draggable` attribute: `draggable`
   * (presence) force-enables drag on that cell (useful for decorative
   * cells that would otherwise be static); `draggable="false"`
   * force-disables drag on that cell (useful for interactive cells
   * that should stay put). */
  @property({ reflect: true, type: Boolean })
  draggable = false;

  /** Layout mode. `free` (default) respects each child's authored
   * `q` / `r` attributes. `masonry` ignores them on first render and
   * runs an FFD bin-pack: children are sorted by mask size descending
   * (largest first), then each is placed at the first free position
   * picked from a scan ordered by axial distance from the origin
   * (ring 0, then ring 1's 6 positions, then ring 2's 12, …). The
   * result: the largest cluster anchors the centre, smaller ones
   * nest around it with a ≥1-hex gap, producing a tight roughly-
   * square honeycomb.
   *
   * Children publish their actual filled hexes via `data-fill-cells`
   * (composite elements like `<hp-cluster>` set this on slotchange);
   * children without it are treated as single-hex. The gap check
   * uses hex-adjacency (the 6 axial neighbours) — not rectangular
   * bbox padding — so non-symmetric clusters' empty corners stay
   * available for neighbours to tuck into.
   *
   * Triggered automatically on first render when set to `masonry`,
   * and re-runs when the attribute is toggled. Manual repack via
   * `.pack()`. Drag interactions stay live; calling `.pack()` again
   * re-runs the FFD pack from scratch (dragged positions are
   * ignored). */
  @property({ reflect: true })
  layout: "free" | "masonry" = "free";

  /** Track which children occupy which axial slots — keyed `"q,r"`. */
  private readonly occupancy = new Map<string, HTMLElement>();

  /** Monotonic counter for `data-hp-grid-id` auto-assignment on
   * [q][r] children that don't carry an existing `id` attribute.
   * Stable enough for the hp-tether `from` / `to` selectors that get
   * generated when a tether is created. */
  private tetherIdCounter = 0;

  /** Active drag, if any. */
  private drag: DragState | null = null;

  /** Active pan, if any. */
  private pan: PanState | null = null;

  /** Current zoom factor. 1 = no zoom; > 1 zooms in, < 1 zooms out.
   * Bounded by ZOOM_MIN / ZOOM_MAX. Mirrored to `--hp-zoom` inline
   * style so the slotted-child transform sees it. */
  private zoom = 1;

  private static readonly ZOOM_MIN = 0.25;
  private static readonly ZOOM_MAX = 4;
  /** Multiplicative step per +/- button click. Wheel uses a smaller
   * per-event factor based on `deltaY`. */
  private static readonly ZOOM_BUTTON_STEP = 1.25;

  static override styles = [
    hpBase,
    css`
      :host {
        position: relative;
        display: block;
        width: 100%;
        min-height: 400px;
        overflow: hidden;
        cursor: grab;

        --hp-cell: var(--hp-hex-cell-sm);

        /* Effective cell width — reduced by the stroke so adjacent hexes
 * overlap exactly along their shared edge instead of producing
 * a double-thick line. */
        --hp-effective-cell: calc(var(--hp-cell) - var(--hp-hex-stroke));
        --hp-col-step: var(--hp-effective-cell);
        --hp-row-step: calc(var(--hp-effective-cell) * ${ROW_STEP_FACTOR});

        touch-action: none;
      }

      /* Surface tint laid as a translucent pseudo behind everything
 * else in the shadow tree. 75%-opaque --hp-surface lets whatever
 * sits behind the grid (the main hp-background, the page
 * colour) show through at 25%, so the canvas reads as a tinted
 * recess rather than an opaque block. Sits at the back of the
 * stacking order automatically — pseudo precedes the slot in
 * shadow tree order. */
      :host::before {
        content: "";
        position: absolute;
        inset: 0;
        background: var(--hp-surface);
        opacity: 0.75;
        pointer-events: none;
      }

      /* Slotted hp-background backdrop: dim the entire element so the
 * texture stays ambient on top of the tinted canvas surface. */
      ::slotted(hp-background) {
        opacity: 0.6;
      }

      :host([data-hp-panning]) {
        cursor: grabbing;
      }

      :host([size="md"]) {
        --hp-cell: var(--hp-hex-cell-md);
      }

      :host([size="lg"]) {
        --hp-cell: var(--hp-hex-cell-lg);
      }

      /* Each slotted child with both q and r positions itself via the
 * transform — origin is the grid's centre. The drag offset vars
 * default to 0 and only get set on the dragged child. The
 * transition animates the snap-into-slot when the drag ends
 * (data-hp-dragging is removed first, then drag-x/drag-y +
 * q/r change — the transition fires across that change). */
      ::slotted([q][r]) {
        position: absolute;
        left: 50%;
        top: 50%;
        translate: -50% -50%;
        /* Axial position is multiplied by --hp-zoom (defaults to 1)
 * so the canvas content scales as a unit; drag and pan are
 * in viewport pixels and added post-scale. The scale()
 * after the translate then visually resizes each hex. */
        transform: translate(
            calc(
              var(--hp-col-step) * (var(--hp-q, 0) + var(--hp-r, 0) / 2) * var(--hp-zoom, 1) +
                var(--hp-drag-x, 0px) + var(--hp-pan-x, 0px)
            ),
            calc(
              var(--hp-row-step) * var(--hp-r, 0) * var(--hp-zoom, 1) + var(--hp-drag-y, 0px) +
                var(--hp-pan-y, 0px)
            )
          )
          scale(var(--hp-zoom, 1));
        transition: transform var(--hp-unfold-trigger) var(--hp-ease-default);
        /* --hp-cursor crosses the shadow boundary because custom
 * properties cascade through it. Each draggable atom reads
 * cursor: var(--hp-cursor, pointer) on its own :host. */
        --hp-cursor: grab;
      }

      ::slotted([q][r][data-hp-dragging]) {
        z-index: var(--hp-layer-dragging);
        opacity: 0.85;
        --hp-cursor: grabbing;
        transition: none;
        /* GPU-composite the transform during the drag for smoother
 * 60fps tracking; cleared once data-hp-dragging is removed. */
        will-change: transform;
      }

      /* Hidden probe — read getBoundingClientRect to recover the
 * resolved pixel values of --hp-col-step and --hp-row-step.
 * getComputedStyle returns the raw calc() expression for custom
 * properties, so parseFloat can't recover the pixels directly. */
      .step-probe {
        position: absolute;
        top: 0;
        left: 0;
        width: var(--hp-col-step);
        height: var(--hp-row-step);
        visibility: hidden;
        pointer-events: none;
      }

      /* Viewport controls — bottom-right cluster of zoom-out / zoom-in
 * / recenter buttons. Always visible but at 60% opacity so they
 * don't compete with the content; full opacity on hover. */
      .controls {
        position: absolute;
        right: var(--hp-sm);
        bottom: var(--hp-sm);
        z-index: 1;
        display: flex;
        gap: var(--hp-xxs);
        opacity: 0.6;
        transition: opacity var(--hp-duration-fast) var(--hp-ease-default);
      }

      .controls:hover {
        opacity: 1;
      }

      .controls button {
        font: inherit;
        font-size: var(--hp-typo-label-sm-font-size);
        padding: 0 var(--hp-sm);
        background: var(--hp-surface-container);
        color: var(--hp-on-surface);
        border: 1px solid var(--hp-outline-variant);
        border-radius: var(--hp-rounded-sm);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 2rem;
        height: 2rem;
      }

      .controls button:hover {
        color: var(--hp-secondary);
      }

      .controls svg {
        width: 1rem;
        height: 1rem;
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    // Listen on the host (not the slot) so empty-space pointerdown
    // events reach us — the slot has no visible area of its own and
    // only fires for slotted-child clicks. Composed event flow still
    // brings slotted children's pointerdowns up to this listener.
    this.addEventListener("pointerdown", this.handlePointerDown);
    // Ctrl/⌘ + wheel zooms (Miro/Figma convention). passive: false so
    // we can preventDefault the page scroll.
    this.addEventListener("wheel", this.handleWheel, { passive: false });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("pointerdown", this.handlePointerDown);
    this.removeEventListener("wheel", this.handleWheel);
    this.cancelDrag();
  }

  override firstUpdated(): void {
    if (this.layout === "masonry") {
      // Wait one frame so slotted children (hp-cluster) have run their
      // own slotchange and published `data-axial-*` extent attrs.
      requestAnimationFrame(() => this.pack());
    }
  }

  override updated(changed: Map<string, unknown>): void {
    // Re-run packing when `layout` flips to "masonry" after first
    // render (toggle via JS / attribute). The firstUpdated handler
    // covers the initial case; this covers the "user changed the
    // mode" case.
    if (changed.has("layout") && this.layout === "masonry") {
      // updated() fires after firstUpdated on the very first render,
      // and we don't want to double-pack — skip when the previous
      // value is undefined (first render). The firstUpdated path
      // already scheduled the pack.
      const previous = changed.get("layout");
      if (previous !== undefined) {
        requestAnimationFrame(() => this.pack());
      }
    }
  }

  /** Run the masonry bin-pack: every `[q][r]` child is placed at the
   * leftmost-topmost axial position whose 1-cell-padded extent doesn't
   * collide with already-placed children. Children's extent comes from
   * their `data-axial-q-min`/`q-max`/`r-min`/`r-max` attributes
   * (set by composite elements like `<hp-cluster>` after slotchange);
   * children without those attrs are treated as single-hex (`0,0,0,0`).
   *
   * Sort order: children are processed by their *current* `q`/`r`
   * position (lowest r first, then lowest q), so dragged children
   * stay roughly where the user put them when repacking. On the first
   * call (children at their authored positions), this matches author
   * order if positions were left at the default `0,0`. */
  public pack(): void {
    // Take every direct element child except decorative backdrops.
    // Children needn't have authored q/r — masonry assigns them.
    // hp-background is the only known non-packable decoration; if
    // future siblings need exclusion they can carry `data-hp-decoration`.
    const children = Array.from(this.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement &&
        el.tagName.toLowerCase() !== "hp-background" &&
        !el.hasAttribute("data-hp-decoration")
    );
    if (children.length === 0) {
      return;
    }
    interface Item {
      el: HTMLElement;
      mask: FillMask;
      // Original document index — preserved as a stable tie-breaker
      // when two clusters have the same size.
      order: number;
    }
    const items: Item[] = children.map((el, order) => ({
      el,
      mask: parseFillCells(el.getAttribute("data-fill-cells")),
      order,
    }));
    // Largest-first (FFD): big shapes anchor the centre, small ones
    // nest around them. Ties broken by document order so the layout
    // is deterministic. Combined with the spiral-from-origin scan in
    // findFirstFreePosition, this produces a tight, roughly-square
    // honeycomb arrangement.
    items.sort((a, b) => b.mask.length - a.mask.length || a.order - b.order);

    const claimed = new Set<string>();
    for (const item of items) {
      const pos = findFirstFreePosition(item.mask, claimed);
      item.el.setAttribute("q", String(pos.q));
      item.el.setAttribute("r", String(pos.r));
      // Mirror to the CSS custom properties the host stylesheet reads
      // so the position update applies immediately — slotchange does
      // not fire on attribute mutation.
      item.el.style.setProperty("--hp-q", String(pos.q));
      item.el.style.setProperty("--hp-r", String(pos.r));
      markClaimed(pos.q, pos.r, item.mask, claimed);
    }
    // Refresh occupancy + pan bounds now that positions changed.
    this.occupancy.clear();
    for (const item of items) {
      this.occupancy.set(slotKey(String(item.el.getAttribute("q")), String(item.el.getAttribute("r"))), item.el);
    }
    requestAnimationFrame(() => this.recenter());
  }

  override render() {
    return html`
      <div class="step-probe" aria-hidden="true"></div>
      <slot @slotchange=${this.handleSlotChange}></slot>
      <div class="controls" part="controls" @pointerdown=${this.stopPanFromButton}>
        <button type="button" aria-label="Zoom out" part="zoom-out" @click=${this.zoomOut}>
          −
        </button>
        <button type="button" aria-label="Zoom in" part="zoom-in" @click=${this.zoomIn}>+</button>
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

  /** Recenter button stops propagation so pointerdown doesn't bubble
   * up to the host's pan handler. Otherwise clicking the button
   * would also start a pan. */
  private stopPanFromButton(event: Event): void {
    event.stopPropagation();
  }

  /** Compute the legal pan range so every [q][r] child stays fully
   * inside the viewport. For each child, `pan_x` is bounded by
   * `[child_half_w - viewport_half_w - offset_x,
   * viewport_half_w - offset_x - child_half_w]`; intersecting
   * every child's range gives the grid-wide bounds. Contradictory
   * ranges (children too big to fit) collapse to their midpoint —
   * the best-fit center. Returns zero bounds when layout is not
   * yet ready. */
  private computePanBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const gridRect = this.getBoundingClientRect();
    const w = gridRect.width;
    const h = gridRect.height;
    if (w === 0 || h === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    const steps = this.computeStyleSteps();
    let minX = Number.NEGATIVE_INFINITY;
    let maxX = Number.POSITIVE_INFINITY;
    let minY = Number.NEGATIVE_INFINITY;
    let maxY = Number.POSITIVE_INFINITY;
    let foundAny = false;
    for (const child of this.querySelectorAll<HTMLElement>("[q][r]")) {
      const q = Number.parseFloat(child.getAttribute("q") ?? "");
      const r = Number.parseFloat(child.getAttribute("r") ?? "");
      if (Number.isNaN(q) || Number.isNaN(r)) {
        continue;
      }
      // Use the COMPUTED (pre-transform) size so we factor in zoom
      // ourselves rather than reading the already-scaled bbox.
      const childStyle = getComputedStyle(child);
      const baseW = Number.parseFloat(childStyle.width);
      const baseH = Number.parseFloat(childStyle.height);
      if (!baseW || !baseH) {
        continue;
      }
      foundAny = true;
      const wi = baseW * this.zoom;
      const hi = baseH * this.zoom;
      const offsetX = steps.col * (q + r / 2) * this.zoom;
      const offsetY = steps.row * r * this.zoom;
      const lowerX = wi / 2 - w / 2 - offsetX;
      const upperX = w / 2 - offsetX - wi / 2;
      const lowerY = hi / 2 - h / 2 - offsetY;
      const upperY = h / 2 - offsetY - hi / 2;
      if (lowerX > minX) {
        minX = lowerX;
      }
      if (upperX < maxX) {
        maxX = upperX;
      }
      if (lowerY > minY) {
        minY = lowerY;
      }
      if (upperY < maxY) {
        maxY = upperY;
      }
    }
    if (!foundAny) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    if (minX > maxX) {
      // Content is wider than the viewport — swap so the user can pan
      // from "child's left edge at viewport's left" to "child's right
      // edge at viewport's right". Without the swap, the range
      // collapses to the midpoint and the overflowing parts stay
      // permanently clipped behind the grid's bounds.
      [minX, maxX] = [maxX, minX];
    }
    if (minY > maxY) {
      [minY, maxY] = [maxY, minY];
    }
    return { minX, maxX, minY, maxY };
  }

  private clampPan(panX: number, panY: number): { panX: number; panY: number } {
    const b = this.computePanBounds();
    return {
      panX: Math.max(b.minX, Math.min(b.maxX, panX)),
      panY: Math.max(b.minY, Math.min(b.maxY, panY)),
    };
  }

  /** Fit every positioned child inside the viewport and centre the
   * content. Computes the content's pixel-space bbox from `[q][r]`
   * children's pre-transform sizes, picks the zoom level that frames
   * the whole bbox with a small margin (max zoom = 1; never zooms
   * past native), then pans so the bbox's midpoint sits at the
   * viewport centre. Falls back to zoom-1 / pan-0 when nothing is
   * positioned yet (e.g. detached / pre-paint). Public so consumers
   * can recenter programmatically too. */
  public recenter(): void {
    const gridRect = this.getBoundingClientRect();
    const vw = gridRect.width;
    const vh = gridRect.height;
    if (vw === 0 || vh === 0) {
      return;
    }
    const steps = this.computeStyleSteps();
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let foundAny = false;
    for (const child of this.querySelectorAll<HTMLElement>("[q][r]")) {
      const q = Number.parseFloat(child.getAttribute("q") ?? "");
      const r = Number.parseFloat(child.getAttribute("r") ?? "");
      if (Number.isNaN(q) || Number.isNaN(r)) {
        continue;
      }
      const childStyle = getComputedStyle(child);
      const baseW = Number.parseFloat(childStyle.width);
      const baseH = Number.parseFloat(childStyle.height);
      if (!baseW || !baseH) {
        continue;
      }
      foundAny = true;
      // Child centre in pixel coords (origin at viewport centre,
      // pre-zoom — the transform multiplies by --hp-zoom).
      const cx = steps.col * (q + r / 2);
      const cy = steps.row * r;
      const left = cx - baseW / 2;
      const right = cx + baseW / 2;
      const top = cy - baseH / 2;
      const bottom = cy + baseH / 2;
      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    }
    if (!foundAny) {
      this.zoom = 1;
      this.style.removeProperty("--hp-zoom");
      this.style.removeProperty("--hp-pan-x");
      this.style.removeProperty("--hp-pan-y");
      this.removeAttribute("data-hp-panned");
      return;
    }
    // 5% margin each side, so content never sits flush against
    // viewport edges.
    const padding = 1.1;
    const contentW = Math.max(1, (maxX - minX) * padding);
    const contentH = Math.max(1, (maxY - minY) * padding);
    const zoomFit = Math.min(vw / contentW, vh / contentH);
    // Never zoom IN past native — masonry packing's natural scale is
    // already correct, we only zoom OUT when content overflows.
    const z = Math.max(HpGrid.ZOOM_MIN, Math.min(1, zoomFit));
    this.zoom = z;
    if (z === 1) {
      this.style.removeProperty("--hp-zoom");
    } else {
      this.style.setProperty("--hp-zoom", String(z));
    }
    const contentCx = (minX + maxX) / 2;
    const contentCy = (minY + maxY) / 2;
    // Pan so the content's midpoint lands at viewport centre. The
    // transform applies zoom to (q, r) positions, then adds pan; to
    // move the content's pixel-centre `contentCx` (at the chosen
    // zoom) onto the viewport's 0, pan must be `-contentCx * z`.
    const panX = -contentCx * z;
    const panY = -contentCy * z;
    if (panX === 0 && panY === 0 && z === 1) {
      this.style.removeProperty("--hp-pan-x");
      this.style.removeProperty("--hp-pan-y");
      this.removeAttribute("data-hp-panned");
    } else {
      this.style.setProperty("--hp-pan-x", `${panX}px`);
      this.style.setProperty("--hp-pan-y", `${panY}px`);
      this.setAttribute("data-hp-panned", "");
    }
    this.dispatchEvent(
      new CustomEvent<HpGridPanEventDetail>("hp-grid-pan", {
        detail: { panX, panY },
        bubbles: true,
        composed: true,
      })
    );
  }

  // ── Zoom ───────────────────────────────────────────────────────────

  /** Apply a new zoom factor, optionally centred on a viewport point
   * so that point stays under the cursor after zooming (Miro/Figma
   * feel). Without a focus point, zooms around the grid centre. Pan
   * is clamped after the zoom change so the new content extent
   * still fits in the viewport. */
  private applyZoom(target: number, focusClientX?: number, focusClientY?: number): void {
    const newZoom = Math.max(HpGrid.ZOOM_MIN, Math.min(HpGrid.ZOOM_MAX, target));
    if (newZoom === this.zoom) {
      return;
    }
    const gridRect = this.getBoundingClientRect();
    const w = gridRect.width;
    const h = gridRect.height;
    const cx = focusClientX === undefined ? w / 2 : focusClientX - gridRect.left;
    const cy = focusClientY === undefined ? h / 2 : focusClientY - gridRect.top;
    const oldPanX = Number.parseFloat(this.style.getPropertyValue("--hp-pan-x")) || 0;
    const oldPanY = Number.parseFloat(this.style.getPropertyValue("--hp-pan-y")) || 0;
    // Zoom-to-cursor: keep the world point under the cursor stationary.
    // Derived from: cursorWorld = (cx - W/2 - panX) / zoom, kept constant
    // across the zoom change.
    const ratio = newZoom / this.zoom;
    const targetPanX = (cx - w / 2) * (1 - ratio) + oldPanX * ratio;
    const targetPanY = (cy - h / 2) * (1 - ratio) + oldPanY * ratio;
    this.zoom = newZoom;
    this.style.setProperty("--hp-zoom", String(newZoom));
    const { panX, panY } = this.clampPan(targetPanX, targetPanY);
    this.style.setProperty("--hp-pan-x", `${panX}px`);
    this.style.setProperty("--hp-pan-y", `${panY}px`);
    if (panX !== 0 || panY !== 0 || newZoom !== 1) {
      this.setAttribute("data-hp-panned", "");
    } else {
      this.removeAttribute("data-hp-panned");
    }
    this.dispatchEvent(
      new CustomEvent<HpGridPanEventDetail>("hp-grid-pan", {
        detail: { panX, panY },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleWheel = (event: WheelEvent): void => {
    // Ctrl/⌘ + wheel only — plain wheel scrolls the page as normal.
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    event.preventDefault();
    // Smooth per-event factor scales with the deltaY magnitude so
    // trackpad pinch (small deltas) and mousewheel (~100 px deltas)
    // both feel right.
    const factor = Math.exp(-event.deltaY * 0.0015);
    this.applyZoom(this.zoom * factor, event.clientX, event.clientY);
  };

  private zoomIn = (): void => {
    this.applyZoom(this.zoom * HpGrid.ZOOM_BUTTON_STEP);
  };

  private zoomOut = (): void => {
    this.applyZoom(this.zoom / HpGrid.ZOOM_BUTTON_STEP);
  };

  // ── Slot wiring ────────────────────────────────────────────────────

  private handleSlotChange(event: Event): void {
    const slot = event.target as HTMLSlotElement;
    this.occupancy.clear();
    // `flatten: true` traverses nested slots so hp-grid still finds
    // [q][r] children when it's used as a wrapper inside another
    // component's shadow (e.g. hp-toggle-group's layout=honeycomb
    // mode renders <hp-grid><slot/></hp-grid> in its shadow).
    for (const child of slot.assignedElements({ flatten: true })) {
      const q = child.getAttribute("q");
      const r = child.getAttribute("r");
      if (q !== null && r !== null) {
        const el = child as HTMLElement;
        el.style.setProperty("--hp-q", q);
        el.style.setProperty("--hp-r", r);
        this.occupancy.set(slotKey(q, r), el);
        // Stamp every [q][r] child with a stable id when missing,
        // so hp-tether's from / to selectors can resolve once a tether
        // is created via drag-to-tether. The data-hp-grid-id attribute
        // doubles as the selector seed and is namespaced to avoid
        // clashing with consumer-authored ids. We promote to a real
        // `id` only if the element has neither — preserving any id
        // the consumer set explicitly.
        if (!el.id && !el.dataset.hpGridId) {
          el.dataset.hpGridId = String(++this.tetherIdCounter);
          el.id = `hp-grid-${this.tetherIdCounter}`;
        }
      }
    }
    // Defer to the next animation frame — at slotchange time child
    // bboxes are often still 0×0 (layout pending), which would
    // collapse our pan bounds. By the next frame layout has settled
    // and the recenter math has real dimensions to work with.
    requestAnimationFrame(() => {
      this.recenter();
    });
  }

  // ── Drag lifecycle ─────────────────────────────────────────────────

  /** Resolve whether a [q][r] child is eligible to drag. Per-cell
   * `draggable` attribute wins: `draggable="false"` opts the cell out,
   * any other presence opts it in. Absent attribute falls through to
   * the grid's own draggable flag (the surface-wide default). */
  private static isCellDraggable(cell: HTMLElement, gridDefault: boolean): boolean {
    const attr = cell.getAttribute("draggable");
    if (attr === "false") {
      return false;
    }
    if (attr !== null) {
      return true;
    }
    return gridDefault;
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    const target = (event.target as Element).closest<HTMLElement>("[q][r]");
    if (!target || !this.contains(target)) {
      // Empty-space pointerdown → start panning the canvas. The grid
      // itself acts like a Miro/Figma viewport: hexes stay at their
      // q/r coords, the visible offset shifts via --hp-pan-x/y.
      // Only when drag/pan is enabled — a static grid ignores empty
      // pointerdowns so layout surfaces don't accidentally pan.
      if (this.draggable) {
        this.startPan(event);
      }
      return;
    }

    // Drag eligibility per cell: explicit `draggable="false"` blocks
    // even when the grid is draggable; explicit `draggable` (presence,
    // any value other than "false") overrides the grid default. With
    // no attribute, falls through to the grid's own draggable state.
    if (!HpGrid.isCellDraggable(target, this.draggable)) {
      return;
    }

    // Drag-handle gating: if the [q][r] child declares a
    // `drag-handle` attribute (CSS selector), only initiate drag
    // when the pointerdown originated inside the cluster's specific
    // handle element. Lets a composite like <hp-cluster> expose its
    // centre hex as the sole grip while its outer slots are inert.
    //
    // Resolves the handle via `target.querySelector()` rather than
    // `closest()` from event.target — closest() with `:first-child`
    // matches ANY first-child ancestor (e.g., the hp-cell inside an
    // <a class="component-link"><hp-cell></hp-cell></a> wrapper is
    // its own parent's first child, so closest() returns it and the
    // gate passes incorrectly). querySelector() returns the first
    // matching descendant of the cluster in DOM order — the cluster's
    // actual centre — and we check whether the pointerdown landed on
    // that specific element or one of its descendants.
    //
    // Pointerdown outside the handle does NOT start a canvas pan —
    // outer cells are typically navigation links, and pan would steal
    // the click. The event falls through so the link handles its own
    // click.
    const handleSelector = target.getAttribute("drag-handle");
    if (handleSelector) {
      const handleEl = target.querySelector(handleSelector);
      const evtTarget = event.target as Node;
      if (!handleEl || (handleEl !== evtTarget && !handleEl.contains(evtTarget))) {
        return;
      }
    }

    const q = Number.parseFloat(target.getAttribute("q") ?? "0");
    const r = Number.parseFloat(target.getAttribute("r") ?? "0");
    if (Number.isNaN(q) || Number.isNaN(r)) {
      return;
    }

    target.setPointerCapture(event.pointerId);
    target.setAttribute("data-hp-dragging", "");
    target.style.setProperty("--hp-drag-x", "0px");
    target.style.setProperty("--hp-drag-y", "0px");

    this.drag = {
      element: target,
      pointerId: event.pointerId,
      origin: { clientX: event.clientX, clientY: event.clientY },
      startCoord: { q, r },
    };

    target.addEventListener("pointermove", this.handlePointerMove);
    target.addEventListener("pointerup", this.handlePointerUp);
    target.addEventListener("pointercancel", this.handlePointerCancel);
    event.preventDefault();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }
    const dx = event.clientX - this.drag.origin.clientX;
    const dy = event.clientY - this.drag.origin.clientY;
    this.drag.element.style.setProperty("--hp-drag-x", `${dx}px`);
    this.drag.element.style.setProperty("--hp-drag-y", `${dy}px`);

    // In tetherable mode, highlight whichever sibling [q][r] the
    // dragged hex currently overlaps so consumers / CSS can paint
    // a "potential tether target" cue (hp-base reacts to
    // data-hp-tether-target the same way hp-cluster reacts to
    // data-hp-dragging). The element under the cursor is found via
    // elementsFromPoint (the dragged hex itself is one of the hits,
    // so we skip the first matching [q][r] that IS the source).
    if (this.tetherable) {
      this.updateTetherTarget(event.clientX, event.clientY);
    }
  };

  /** While dragging in tetherable mode, set / clear
   * `data-hp-tether-target` on the sibling [q][r] hex under the
   * cursor. Cleared on every move and re-set so the highlight
   * follows the pointer. */
  private currentTetherTarget: HTMLElement | null = null;

  private updateTetherTarget(clientX: number, clientY: number): void {
    if (!this.drag) {
      return;
    }
    const source = this.drag.element;
    let next: HTMLElement | null = null;
    const hits = document.elementsFromPoint(clientX, clientY);
    for (const hit of hits) {
      const candidate = hit.closest<HTMLElement>("[q][r]");
      if (!candidate || candidate === source) {
        continue;
      }
      if (!this.contains(candidate)) {
        continue;
      }
      next = candidate;
      break;
    }
    if (next === this.currentTetherTarget) {
      return;
    }
    if (this.currentTetherTarget) {
      this.currentTetherTarget.removeAttribute("data-hp-tether-target");
    }
    this.currentTetherTarget = next;
    if (next) {
      next.setAttribute("data-hp-tether-target", "");
    }
  }

  private clearTetherTarget(): void {
    if (this.currentTetherTarget) {
      this.currentTetherTarget.removeAttribute("data-hp-tether-target");
      this.currentTetherTarget = null;
    }
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }
    const dx = event.clientX - this.drag.origin.clientX;
    const dy = event.clientY - this.drag.origin.clientY;
    this.finishDrag(dx, dy);
  };

  private handlePointerCancel = (event: PointerEvent): void => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }
    this.finishDrag(0, 0);
  };

  private finishDrag(dx: number, dy: number): void {
    if (!this.drag) {
      return;
    }
    const { element, startCoord, pointerId } = this.drag;

    const rawSteps = this.computeStyleSteps();
    // The cursor delta is in viewport pixels; axial steps need to be
    // scaled by current zoom so a 1-axial-unit drag at zoom=2 covers
    // twice the screen distance as at zoom=1.
    const steps = { col: rawSteps.col * this.zoom, row: rawSteps.row * this.zoom };
    const cursorSlot = this.snapToSlot(dx, dy, startCoord, steps);

    // Tetherable mode: if the cursor landed on another [q][r] child,
    // toggle an hp-tether between source and target instead of
    // BFS-snapping to a free slot. The source returns to its
    // starting coord (snap-back); the target stays put. Drops on
    // empty cells fall through to the regular move path so layout
    // editing still works alongside tethering.
    if (this.tetherable) {
      const occupier = this.occupancy.get(slotKey(cursorSlot.q, cursorSlot.r));
      if (occupier && occupier !== element) {
        this.finishDragAsTether(element, occupier, startCoord, pointerId);
        return;
      }
    }

    // If the cursor slot is occupied (by another child), BFS axial
    // neighbours until we find a free slot. Bounce-back is no longer
    // the default — the hex finds the nearest empty home instead.
    const target = this.findFreeSlot(cursorSlot, element);

    const fromKey = slotKey(startCoord.q, startCoord.r);
    const toKey = slotKey(target.q, target.r);

    // Snapshot bonds BEFORE the move so we can diff against the
    // post-move set and only fire events for adjacencies that
    // actually changed. The element is still occupying startCoord
    // in `occupancy` here.
    const bondsBefore = this.findOccupiedNeighbours(startCoord, element);

    // Drop the dragging attribute FIRST so the base transform
    // transition re-engages, then change q/r and clear drag offsets in
    // the same task — the browser animates the snap from the cursor
    // position into the new slot over `--hp-unfold-trigger` (90ms).
    element.removeAttribute("data-hp-dragging");

    this.occupancy.delete(fromKey);
    this.occupancy.set(toKey, element);
    element.setAttribute("q", String(target.q));
    element.setAttribute("r", String(target.r));
    element.style.setProperty("--hp-q", String(target.q));
    element.style.setProperty("--hp-r", String(target.r));
    element.style.removeProperty("--hp-drag-x");
    element.style.removeProperty("--hp-drag-y");

    if (target.q !== startCoord.q || target.r !== startCoord.r) {
      this.dispatchEvent(
        new CustomEvent<HpGridMoveEventDetail>("hp-grid-move", {
          detail: { element, from: startCoord, to: target },
          bubbles: true,
          composed: true,
        })
      );

      // Bond diff: any partner in `before` but not `after` is an
      // unbond; any in `after` but not `before` is a new bond. Skip
      // the diff entirely on a no-op snap (same slot) — that can
      // happen on a cancelled drag and would produce phantom events.
      const bondsAfter = this.findOccupiedNeighbours(target, element);
      for (const partner of bondsBefore) {
        if (!bondsAfter.includes(partner)) {
          this.dispatchEvent(
            new CustomEvent<HpGridBondEventDetail>("hp-grid-unbond", {
              detail: { moved: element, partner },
              bubbles: true,
              composed: true,
            })
          );
        }
      }
      for (const partner of bondsAfter) {
        if (!bondsBefore.includes(partner)) {
          this.dispatchEvent(
            new CustomEvent<HpGridBondEventDetail>("hp-grid-bond", {
              detail: { moved: element, partner },
              bubbles: true,
              composed: true,
            })
          );
        }
      }

      // Post-animation event: fires after the ~90ms snap transition
      // completes. Listeners auto-detach via AbortController on the
      // first relevant event. Skipped entirely if the transition gets
      // cancelled (e.g. the user re-grabs the hex mid-flight before
      // it settles).
      const ac = new AbortController();
      element.addEventListener(
        "transitionend",
        (e) => {
          if ((e as TransitionEvent).propertyName !== "transform") {
            return;
          }
          ac.abort();
          this.dispatchEvent(
            new CustomEvent<HpGridDropEventDetail>("hp-grid-drop", {
              detail: { element, from: startCoord, to: target },
              bubbles: true,
              composed: true,
            })
          );
        },
        { signal: ac.signal }
      );
      element.addEventListener(
        "transitioncancel",
        (e) => {
          if ((e as TransitionEvent).propertyName !== "transform") {
            return;
          }
          ac.abort();
        },
        { signal: ac.signal }
      );
    }

    this.clearTetherTarget();
    this.cleanupDrag(element, pointerId);
  }

  /** Tetherable-mode finish path: when a drag-release lands on another
   * [q][r] hex (rather than empty space), toggle an arc between the
   * pair instead of moving. Source snaps back to its origin. */
  private finishDragAsTether(
    source: HTMLElement,
    target: HTMLElement,
    startCoord: AxialCoord,
    pointerId: number
  ): void {
    // Snap source back home: clear the inline drag offsets and the
    // dragging attribute so the transition lerps the hex from cursor
    // position back into its starting slot.
    source.removeAttribute("data-hp-dragging");
    source.style.removeProperty("--hp-drag-x");
    source.style.removeProperty("--hp-drag-y");
    // Make sure --hp-q / --hp-r still match the start (in case
    // anything diverged). q/r attributes are untouched since the
    // hex never moved.
    source.style.setProperty("--hp-q", String(startCoord.q));
    source.style.setProperty("--hp-r", String(startCoord.r));

    this.clearTetherTarget();

    const sourceId = this.tetherSelectorFor(source);
    const targetId = this.tetherSelectorFor(target);
    if (!sourceId || !targetId) {
      this.cleanupDrag(source, pointerId);
      return;
    }

    // Toggle: if a tether already connects this pair (in either
    // direction), remove it. Otherwise create a new one.
    const existing = this.findTetherBetween(sourceId, targetId);
    if (existing) {
      existing.remove();
      this.dispatchEvent(
        new CustomEvent<HpGridTetherEventDetail>("hp-grid-untether", {
          detail: { source, target, tether: existing },
          bubbles: true,
          composed: true,
        })
      );
    } else {
      const tether = document.createElement("hp-tether");
      tether.setAttribute("from", sourceId);
      tether.setAttribute("to", targetId);
      tether.setAttribute("data-hp-grid-tether", "");
      // Append as a slotted child of the grid. hp-tether's
      // `position: absolute; inset: 0` covers the grid's bbox; its
      // from / to selectors resolve globally so DOM position
      // doesn't matter for geometry.
      this.appendChild(tether);
      // Replay the draw-in animation explicitly — the once-on-mount
      // CSS animation already runs, but the connectedCallback
      // defer happens to also be ~2 rAFs so this call lands at the
      // right moment to be perceptible regardless of timing.
      queueMicrotask(() => {
        const apiEl = tether as HTMLElement & { drawIn?: () => void };
        apiEl.drawIn?.();
      });
      this.dispatchEvent(
        new CustomEvent<HpGridTetherEventDetail>("hp-grid-tether", {
          detail: { source, target, tether },
          bubbles: true,
          composed: true,
        })
      );
    }

    this.cleanupDrag(source, pointerId);
  }

  /** Build the CSS selector hp-tether's from/to attributes need.
   * Prefers the existing `id` (consumer-authored or our own auto-
   * assigned one), else falls back to the data-hp-grid-id we
   * stamp at slotchange. Returns null if neither is available — a
   * pathological case that just skips the tether create / remove. */
  private tetherSelectorFor(el: HTMLElement): string | null {
    if (el.id) {
      return `#${CSS.escape(el.id)}`;
    }
    const gid = el.dataset.hpGridId;
    if (gid) {
      return `[data-hp-grid-id="${gid}"]`;
    }
    return null;
  }

  /** Search this grid's hp-tether children for an existing arc that
   * connects the given selector pair, in either direction. Used
   * by the toggle behaviour: matching pair means we remove instead
   * of create. */
  private findTetherBetween(a: string, b: string): HTMLElement | null {
    const tethers = this.querySelectorAll<HTMLElement>("hp-tether");
    for (const tether of tethers) {
      const from = tether.getAttribute("from");
      const to = tether.getAttribute("to");
      if ((from === a && to === b) || (from === b && to === a)) {
        return tether;
      }
    }
    return null;
  }

  /** Shared drag-listener / capture teardown — used by both the
   * normal finishDrag path and the new finishDragAsTether path. */
  private cleanupDrag(element: HTMLElement, pointerId: number): void {
    element.removeEventListener("pointermove", this.handlePointerMove);
    element.removeEventListener("pointerup", this.handlePointerUp);
    element.removeEventListener("pointercancel", this.handlePointerCancel);
    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
    this.drag = null;
  }

  private cancelDrag(): void {
    if (!this.drag) {
      return;
    }
    const { element, pointerId } = this.drag;
    // Match finishDrag's ordering — dragging attribute first, then the
    // offset reset so the transform animates back to origin.
    element.removeAttribute("data-hp-dragging");
    element.style.removeProperty("--hp-drag-x");
    element.style.removeProperty("--hp-drag-y");
    this.clearTetherTarget();
    this.cleanupDrag(element, pointerId);
  }

  // ── Pan lifecycle ──────────────────────────────────────────────────

  private startPan(event: PointerEvent): void {
    this.setPointerCapture(event.pointerId);
    const startPanX = Number.parseFloat(this.style.getPropertyValue("--hp-pan-x")) || 0;
    const startPanY = Number.parseFloat(this.style.getPropertyValue("--hp-pan-y")) || 0;
    this.pan = {
      pointerId: event.pointerId,
      origin: { clientX: event.clientX, clientY: event.clientY },
      startPanX,
      startPanY,
    };
    this.setAttribute("data-hp-panning", "");
    this.addEventListener("pointermove", this.handlePanMove);
    this.addEventListener("pointerup", this.handlePanEnd);
    this.addEventListener("pointercancel", this.handlePanEnd);
    event.preventDefault();
  }

  private handlePanMove = (event: PointerEvent): void => {
    if (!this.pan || event.pointerId !== this.pan.pointerId) {
      return;
    }
    const dx = event.clientX - this.pan.origin.clientX;
    const dy = event.clientY - this.pan.origin.clientY;
    // Clamp pan so every [q][r] child stays within the visible
    // viewport. If the content is bigger than the viewport, the
    // clamp collapses to the midpoint that best-fits the content.
    const { panX, panY } = this.clampPan(this.pan.startPanX + dx, this.pan.startPanY + dy);
    this.style.setProperty("--hp-pan-x", `${panX}px`);
    this.style.setProperty("--hp-pan-y", `${panY}px`);
    if (panX !== 0 || panY !== 0) {
      this.setAttribute("data-hp-panned", "");
    } else {
      this.removeAttribute("data-hp-panned");
    }
    // Notify consumers (e.g. <hp-tether>) that the canvas offset has
    // changed so they can recompute viewport-relative geometry.
    this.dispatchEvent(
      new CustomEvent<HpGridPanEventDetail>("hp-grid-pan", {
        detail: { panX, panY },
        bubbles: true,
        composed: true,
      })
    );
  };

  private handlePanEnd = (event: PointerEvent): void => {
    if (!this.pan || event.pointerId !== this.pan.pointerId) {
      return;
    }
    this.removeEventListener("pointermove", this.handlePanMove);
    this.removeEventListener("pointerup", this.handlePanEnd);
    this.removeEventListener("pointercancel", this.handlePanEnd);
    if (this.hasPointerCapture(event.pointerId)) {
      this.releasePointerCapture(event.pointerId);
    }
    this.removeAttribute("data-hp-panning");
    this.pan = null;
  };

  // ── Coordinate math ────────────────────────────────────────────────

  /** Resolve --hp-col-step / --hp-row-step to numeric pixel values via
   * the hidden probe element. getComputedStyle on a custom property
   * returns the raw calc() expression (unresolved), so we apply the
   * vars to width/height on a hidden div and read the resolved size. */
  private computeStyleSteps(): { col: number; row: number } {
    const probe = this.shadowRoot?.querySelector<HTMLElement>(".step-probe");
    if (!probe) {
      return { col: 1, row: 1 };
    }
    const rect = probe.getBoundingClientRect();
    return { col: rect.width || 1, row: rect.height || 1 };
  }

  /** Inverse-project a pixel drag offset onto axial coords + round. */
  private snapToSlot(
    dx: number,
    dy: number,
    start: AxialCoord,
    steps: { col: number; row: number }
  ): AxialCoord {
    // Inverse of:
    // x = col * (q + r/2)
    // y = row * r
    const dr = dy / steps.row;
    const dq = dx / steps.col - dr / 2;
    return {
      q: Math.round(start.q + dq),
      r: Math.round(start.r + dr),
    };
  }

  /** Find the nearest unoccupied axial slot to `target` via BFS. The
   * dragged element is treated as if its current slot is free so a
   * drop on its own origin works without bouncing into a neighbour. */
  private findFreeSlot(target: AxialCoord, dragged: HTMLElement): AxialCoord {
    if (this.isFree(target, dragged)) {
      return target;
    }

    const visited = new Set<string>([slotKey(target.q, target.r)]);
    const queue: AxialCoord[] = [target];

    // Safety cap — every drop should resolve within a couple of rings.
    let attempts = 0;
    while (queue.length > 0 && attempts < 256) {
      attempts++;
      const current = queue.shift() as AxialCoord;
      for (const neighbour of axialNeighbours(current)) {
        const key = slotKey(neighbour.q, neighbour.r);
        if (visited.has(key)) {
          continue;
        }
        visited.add(key);
        if (this.isFree(neighbour, dragged)) {
          return neighbour;
        }
        queue.push(neighbour);
      }
    }

    // Should never get here unless every nearby slot is occupied —
    // fall back to the cursor target and let the bounce happen.
    return target;
  }

  private isFree(coord: AxialCoord, dragged: HTMLElement): boolean {
    const occupier = this.occupancy.get(slotKey(coord.q, coord.r));
    return !occupier || occupier === dragged;
  }

  /** Elements occupying the 6 axial neighbours of `coord`, with
   * `exclude` filtered out. Used to compute bond before/after sets
   * on drop so we can dispatch `hp-grid-bond` / `hp-grid-unbond`
   * only for adjacencies that changed. */
  private findOccupiedNeighbours(coord: AxialCoord, exclude: HTMLElement): HTMLElement[] {
    const out: HTMLElement[] = [];
    for (const n of axialNeighbours(coord)) {
      const occupier = this.occupancy.get(slotKey(n.q, n.r));
      if (occupier && occupier !== exclude) {
        out.push(occupier);
      }
    }
    return out;
  }
}

/** The six pointy-top axial neighbours of `(q, r)`. */
function axialNeighbours(coord: AxialCoord): AxialCoord[] {
  return [
    { q: coord.q + 1, r: coord.r },
    { q: coord.q - 1, r: coord.r },
    { q: coord.q, r: coord.r + 1 },
    { q: coord.q, r: coord.r - 1 },
    { q: coord.q + 1, r: coord.r - 1 },
    { q: coord.q - 1, r: coord.r + 1 },
  ];
}

function slotKey(q: number | string, r: number | string): string {
  return `${q},${r}`;
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-grid": HpGrid;
  }
  interface HTMLElementEventMap {
    "hp-grid-move": CustomEvent<HpGridMoveEventDetail>;
    "hp-grid-drop": CustomEvent<HpGridDropEventDetail>;
    "hp-grid-bond": CustomEvent<HpGridBondEventDetail>;
    "hp-grid-unbond": CustomEvent<HpGridBondEventDetail>;
    "hp-grid-tether": CustomEvent<HpGridTetherEventDetail>;
    "hp-grid-untether": CustomEvent<HpGridTetherEventDetail>;
    "hp-grid-pan": CustomEvent<HpGridPanEventDetail>;
  }
}
