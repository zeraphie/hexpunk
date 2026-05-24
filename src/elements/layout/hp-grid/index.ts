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

import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";

import "../../tether/hp-tether.js";
import { scan } from "../../../icons/scan.js";
import { hpBase } from "../../../styles/hp-base.js";
import { slotKey } from "./axial.js";
import { DragController } from "./drag.js";
import { type FillMask, markClaimed, parseFillCells } from "./layouts/index.js";
import { findRowsPosition } from "./layouts/rows.js";
import { findSpiralPosition } from "./layouts/spiral.js";
import { PanController, stopPanFromButton } from "./pan.js";
import { recenter as recenterContent } from "./recenter.js";
import { hpGridStyles } from "./styles.js";
import { ZoomController } from "./zoom.js";
import type {
  HpGridBondEventDetail,
  HpGridDropEventDetail,
  HpGridMoveEventDetail,
  HpGridPanEventDetail,
  HpGridTetherEventDetail,
} from "./types.js";

export type {
  HpGridBondEventDetail,
  HpGridDropEventDetail,
  HpGridMoveEventDetail,
  HpGridPanEventDetail,
  HpGridTetherEventDetail,
} from "./types.js";

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

  /** Layout mode.
   *
   * - `free` (default) respects each child's authored `q` / `r`
   *   attributes.
   * - `spiral` runs an FFD bin-pack with a spiral-from-origin scan:
   *   children are sorted by mask size descending, then each is
   *   placed at the first free position picked from a scan ordered
   *   by axial distance from `(0, 0)` (ring 0, then ring 1's 6
   *   positions, ring 2's 12, …). Produces a tight roughly-square
   *   honeycomb — largest cluster anchors the centre, smaller ones
   *   nest around it with a ≥1-hex gap.
   * - `rows` runs the same FFD pack but with a row-major scan capped
   *   at `WIDE_HALF_COLS` axial cells wide, so the layout grows as
   *   left-to-right rows that wrap downward — roughly-rectangular
   *   wide arrangement, ideal for full-page-width surfaces (component
   *   index pages) where the spiral's square shape leaves too much
   *   horizontal space unused.
   *
   * Children publish their actual filled hexes via `data-fill-cells`
   * (composite elements like `<hp-cluster>` set this on slotchange);
   * children without it are treated as single-hex. The gap check
   * uses hex-adjacency (the 6 axial neighbours) — not rectangular
   * bbox padding — so non-symmetric clusters' empty corners stay
   * available for neighbours to tuck into.
   *
   * Triggered automatically on first render when set to `spiral` or
   * `rows`, and re-runs when the attribute changes. Manual repack
   * via `.pack()`. Drag interactions stay live; calling `.pack()`
   * again re-runs the FFD pack from scratch (dragged positions are
   * ignored). */
  @property({ reflect: true })
  layout: "free" | "spiral" | "rows" = "free";

  /**
   * Track which children occupy which axial slots — keyed `"q,r"`.
   * Mutated by `handleSlotChange`, `pack()`, and the drag controller
   * on every successful move.
   *
   * @internal Public so concern modules (drag in particular) can
   *   read & write occupancy through the `DragHost` interface; not
   *   part of the documented API.
   */
  readonly occupancy = new Map<string, HTMLElement>();

  /** Monotonic counter for `data-hp-grid-id` auto-assignment on
   * [q][r] children that don't carry an existing `id` attribute.
   * Stable enough for the hp-tether `from` / `to` selectors that get
   * generated when a tether is created. */
  private tetherIdCounter = 0;

  /** Pan controller — owns the active pan state, the pan move/end
   * handlers, and `clamp`. Public so the zoom controller can reuse
   * the clamp via the `ZoomHost` interface. */
  readonly panController = new PanController(this);

  /** Zoom controller — owns wheel zoom + button-zoom. */
  private readonly zoomController = new ZoomController(this);

  /** Drag controller — owns the active drag, snap-to-slot, the
   * bond-diff + drop events, and the tetherable toggle path. Bond
   * and tether interactions are byproducts of drag drops, so they
   * live with the drag pipeline. */
  private readonly dragController = new DragController(this);

  /**
   * Current zoom factor. 1 = no zoom; > 1 zooms in, < 1 zooms out.
   * Bounded by `ZOOM_MIN` / `ZOOM_MAX` (see zoom.ts). Mirrored to
   * `--hp-zoom` inline style so the slotted-child transform sees it.
   *
   * @internal Public so the pan / zoom controllers (and the recenter
   *   pass) can read & write it; not part of the documented API.
   */
  zoom = 1;

  static override styles = [hpBase, hpGridStyles];

  override connectedCallback(): void {
    super.connectedCallback();
    // Listen on the host (not the slot) so empty-space pointerdown
    // events reach us — the slot has no visible area of its own and
    // only fires for slotted-child clicks. Composed event flow still
    // brings slotted children's pointerdowns up to this listener.
    this.addEventListener("pointerdown", this.dragController.handlePointerDown);
    // Ctrl/⌘ + wheel zooms (Miro/Figma convention). passive: false so
    // we can preventDefault the page scroll.
    this.addEventListener("wheel", this.zoomController.handleWheel, { passive: false });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("pointerdown", this.dragController.handlePointerDown);
    this.removeEventListener("wheel", this.zoomController.handleWheel);
    this.dragController.cancel();
  }

  override firstUpdated(): void {
    if (this.isPackedLayout()) {
      // Wait one frame so slotted children (hp-cluster) have run their
      // own slotchange and published `data-fill-cells` attrs.
      requestAnimationFrame(() => this.pack());
    }
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("layout") && this.isPackedLayout()) {
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

  private isPackedLayout(): boolean {
    return this.layout === "spiral" || this.layout === "rows";
  }

  /** Axial-cell width cap for `layout="rows"`. Sized to force 2–3
   * rows for the typical components-page workload (~12 mixed-size
   * clusters): at halfCols=10 the layout spans ~20 axial wide,
   * which fits 4–6 medium clusters per row before wrapping. Pinned
   * here rather than viewport-derived so wide layouts stay
   * predictable across screen sizes. */
  private static readonly WIDE_HALF_COLS = 10;

  /**
   * Run the FFD bin-pack for `layout="spiral"` or `layout="rows"`.
   * Children are sorted by mask size descending (largest first; ties
   * broken by document order), then each is placed at the first free
   * position the chosen strategy returns. Strategies live in
   * `./layouts/spiral.ts` and `./layouts/rows.ts`; this method just
   * orchestrates.
   *
   * Children publish their actual filled hexes via `data-fill-cells`
   * (composite elements like `<hp-cluster>` set this on slotchange);
   * children without it are treated as single-hex.
   */
  public pack(): void {
    // Take every direct element child except decorative backdrops.
    // Children needn't have authored q/r — pack assigns them.
    // hp-background is the only known non-packable decoration; if
    // future siblings need exclusion they can carry `data-hp-decoration`.
    const children = Array.from(this.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement &&
        el.tagName.toLowerCase() !== "hp-background" &&
        !el.hasAttribute("data-hp-decoration") &&
        !el.hasAttribute("hidden")
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
    // Largest-first (FFD): big shapes anchor first, small ones
    // settle around them. Ties broken by document order so the
    // layout is deterministic.
    items.sort((a, b) => b.mask.length - a.mask.length || a.order - b.order);

    // `spiral` → spiral-from-origin scan, roughly-square honeycomb.
    // `rows` → row-major + width cap, roughly-rectangular wide
    // arrangement that fills horizontal space on full-page-width
    // surfaces.
    const rows = this.layout === "rows";

    const claimed = new Set<string>();
    for (const item of items) {
      const pos = rows
        ? findRowsPosition(item.mask, claimed, HpGrid.WIDE_HALF_COLS)
        : findSpiralPosition(item.mask, claimed);
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
      this.occupancy.set(
        slotKey(String(item.el.getAttribute("q")), String(item.el.getAttribute("r"))),
        item.el
      );
    }
    requestAnimationFrame(() => this.recenter());
  }

  override render() {
    return html`
      <div class="step-probe" aria-hidden="true"></div>
      <slot @slotchange=${this.handleSlotChange}></slot>
      <div class="controls" part="controls" @pointerdown=${stopPanFromButton}>
        <button
          type="button"
          aria-label="Zoom out"
          part="zoom-out"
          @click=${this.zoomController.stepOut}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          part="zoom-in"
          @click=${this.zoomController.stepIn}
        >
          +
        </button>
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

  /**
   * Fit every positioned child inside the viewport and centre the
   * content. Public so consumers can recenter programmatically; the
   * bound `recenter` button in the controls slot calls it on click,
   * and the FFD pack pipeline runs it after every placement
   * pass. Implementation lives in `./recenter.ts`.
   */
  recenter(): void {
    recenterContent(this);
  }

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

  // ── Coordinate math ────────────────────────────────────────────────

  /**
   * Resolve `--hp-col-step` / `--hp-row-step` to numeric pixel values
   * via the hidden probe element. `getComputedStyle` on a custom
   * property returns the raw `calc()` expression (unresolved), so we
   * apply the vars to width/height on a hidden div and read the
   * resolved size.
   *
   * @returns Resolved step sizes in px. `{ col: 1, row: 1 }` if the
   *   probe isn't reachable (pre-paint / detached).
   * @internal Public so concern modules (pan, zoom, recenter) can
   *   reach the same numbers; not part of the documented API.
   */
  computeStyleSteps(): { col: number; row: number } {
    const probe = this.shadowRoot?.querySelector<HTMLElement>(".step-probe");
    if (!probe) {
      return { col: 1, row: 1 };
    }
    const rect = probe.getBoundingClientRect();
    return { col: rect.width || 1, row: rect.height || 1 };
  }
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
