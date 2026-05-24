// hp-cluster.ts — Multi-hex group layout.
//
// Two layout modes, switched via the `layout` attribute:
//
//   `rosette` (default — back-compat) — the canonical 5-hex
//   navigation rosette: a centre cell with four named-slot
//   neighbours (top / middle-left / middle-right / bottom).
//   Children project via `slot="..."`. Existing showcase usages
//   continue to work unchanged.
//
//   `honeycomb` — accepts N default-slot children. First child is
//   the centre (0, 0); remaining children fill outward by ring,
//   clockwise from north. Ring 1 holds 6 positions; ring 2 holds
//   12. v1 caps at 2 rings (19 hexes total — every existing
//   showcase category fits comfortably).
//
// Drag handling stays in hp-grid via its `drag-handle="..."`
// selector on the cluster element — hp-cluster is purely layout.
// For honeycomb mode the canonical handle is `:first-child`
// (selects the centre); for rosette mode `[slot='centre']`.
//
// Internally reuses the same effective-cell math as `<hp-grid>` so
// a cluster's hexes share edges cleanly with each other (overlap
// by `hex-stroke` to avoid double-thick shared edges).

import { LitElement, css, html, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

const ROW_STEP_FACTOR = 0.8660254;

/** Axial coordinates of each honeycomb position in fill order — matches
 * the CSS :nth-child rules in this element's stylesheet. Used to report
 * the cluster's actual filled-hex extent (data-axial-* attributes) so
 * hp-grid masonry packing knows the cluster's real footprint, not just
 * its host bbox. */
const HONEYCOMB_POSITIONS: ReadonlyArray<{ q: number; r: number }> = [
  { q: 0, r: 0 }, //  1: centre
  { q: 0, r: -1 }, //  2: N
  { q: 1, r: -1 }, //  3: NE
  { q: 1, r: 0 }, //  4: SE
  { q: 0, r: 1 }, //  5: S
  { q: -1, r: 1 }, //  6: SW
  { q: -1, r: 0 }, //  7: NW
  { q: 0, r: -2 }, //  8: ring 2 N
  { q: 1, r: -2 }, //  9
  { q: 2, r: -2 }, // 10
  { q: 2, r: -1 }, // 11
  { q: 2, r: 0 }, // 12
  { q: 1, r: 1 }, // 13
  { q: 0, r: 2 }, // 14
  { q: -1, r: 2 }, // 15
  { q: -2, r: 2 }, // 16
  { q: -2, r: 1 }, // 17
  { q: -2, r: 0 }, // 18
  { q: -1, r: -1 }, // 19
];

/**
 * Multi-hex group layout. `layout="rosette"` (default) preserves
 * the canonical 5-hex navigation rosette via named slots;
 * `layout="honeycomb"` accepts N default-slot children and packs
 * them in honeycomb rings outward from the first child (the
 * centre).
 *
 * @slot - Default slot — N children for honeycomb layout. First child is the centre.
 * @slot centre - Rosette centre hex
 * @slot top - Rosette top hex (north neighbour)
 * @slot middle-left - Rosette west-of-centre
 * @slot middle-right - Rosette east-of-centre
 * @slot bottom - Rosette bottom hex (south neighbour)
 */
@customElement("hp-cluster")
export class HpCluster extends LitElement {
  /** Cell size for the cluster — `sm` (default), `md`, or `lg`. */
  @property({ reflect: true })
  size: "sm" | "md" | "lg" = "sm";

  /** Layout mode. `rosette` is the canonical 5-hex navigation
   * rosette (named slots, current behaviour). `honeycomb` accepts
   * N default-slot children packed into rings outward from the
   * first child. */
  @property({ reflect: true })
  layout: "rosette" | "honeycomb" = "rosette";

  static override styles = [
    hpBase,
    css`
      :host {
        position: relative;
        display: inline-block;

        --hp-cell: var(--hp-hex-cell-sm);
        --hp-effective-cell: calc(var(--hp-cell) - var(--hp-hex-stroke));
        --hp-col-step: var(--hp-effective-cell);
        --hp-row-step: calc(var(--hp-effective-cell) * ${ROW_STEP_FACTOR});

        /* Default footprint sized for the rosette (1 ring on every
         * side): 2 col-steps wide + the cell width itself; 2
         * row-steps tall + the cell height. */
        width: calc(var(--hp-col-step) * 2 + var(--hp-cell));
        height: calc(var(--hp-row-step) * 2 + var(--hp-cell) * 1.1547);
      }

      /* Honeycomb mode grows to accommodate ring 2 — outermost q,r
       * extent is ±2, giving 4 col-steps wide + 4 row-steps tall
       * plus the cell itself. */
      :host([layout="honeycomb"]) {
        width: calc(var(--hp-col-step) * 4 + var(--hp-cell));
        height: calc(var(--hp-row-step) * 4 + var(--hp-cell) * 1.1547);
      }

      :host([size="md"]) {
        --hp-cell: var(--hp-hex-cell-md);
      }

      :host([size="lg"]) {
        --hp-cell: var(--hp-hex-cell-lg);
      }

      ::slotted(*) {
        position: absolute;
        left: 50%;
        top: 50%;
      }

      /* ── Cursor: only the drag-handle child inherits the grab
       * cursor from hp-grid. Non-handle children (rosette outer
       * slots, honeycomb ring) override --hp-cursor back to pointer
       * so they read as navigation/click targets, not draggable
       * surfaces. Custom property cascades through the cell's
       * shadow boundary; cell hosts read cursor: var(--hp-cursor,
       * pointer) on their own :host. */

      :host([layout="rosette"]) ::slotted([slot="top"]),
      :host([layout="rosette"]) ::slotted([slot="middle-left"]),
      :host([layout="rosette"]) ::slotted([slot="middle-right"]),
      :host([layout="rosette"]) ::slotted([slot="bottom"]) {
        --hp-cursor: pointer;
      }

      :host([layout="honeycomb"]) ::slotted(:nth-child(n + 2)) {
        --hp-cursor: pointer;
      }

      /* ── Rosette layout (5 named slots) ─────────────────────── */

      /* Centre lifted above outer slots so the focal child of the
       * rosette (typically a label or trigger) is never occluded
       * by surrounding hexes' overlap area. */
      :host([layout="rosette"]) ::slotted([slot="centre"]) {
        translate: -50% -50%;
        z-index: 1;
      }

      /* Axial (0, -1) — top */
      :host([layout="rosette"]) ::slotted([slot="top"]) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -0.5), calc(var(--hp-row-step) * -1));
      }

      /* Axial (-1, 0) — middle-left */
      :host([layout="rosette"]) ::slotted([slot="middle-left"]) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -1), 0);
      }

      /* Axial (1, 0) — middle-right */
      :host([layout="rosette"]) ::slotted([slot="middle-right"]) {
        translate: -50% -50%;
        transform: translate(var(--hp-col-step), 0);
      }

      /* Axial (0, 1) — bottom */
      :host([layout="rosette"]) ::slotted([slot="bottom"]) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * 0.5), var(--hp-row-step));
      }

      /* ── Honeycomb layout (N default-slot children) ─────────── */
      /* Axial pixel formula: x = col_step * (q + r/2), y = row_step * r.
       * Children fill clockwise from north, centre first, then ring 1
       * (6 positions), then ring 2 (12 positions). v1 caps at ring 2;
       * children beyond index 19 stack at the centre. */

      /* Centre — (0, 0). Lifted above outer rings same as rosette. */
      :host([layout="honeycomb"]) ::slotted(:nth-child(1)) {
        translate: -50% -50%;
        z-index: 1;
      }

      /* Ring 1 — 6 positions, clockwise from north. */

      /* (0, -1) — N */
      :host([layout="honeycomb"]) ::slotted(:nth-child(2)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -0.5), calc(var(--hp-row-step) * -1));
      }
      /* (1, -1) — NE */
      :host([layout="honeycomb"]) ::slotted(:nth-child(3)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * 0.5), calc(var(--hp-row-step) * -1));
      }
      /* (1, 0) — SE */
      :host([layout="honeycomb"]) ::slotted(:nth-child(4)) {
        translate: -50% -50%;
        transform: translate(var(--hp-col-step), 0);
      }
      /* (0, 1) — S */
      :host([layout="honeycomb"]) ::slotted(:nth-child(5)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * 0.5), var(--hp-row-step));
      }
      /* (-1, 1) — SW */
      :host([layout="honeycomb"]) ::slotted(:nth-child(6)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -0.5), var(--hp-row-step));
      }
      /* (-1, 0) — NW */
      :host([layout="honeycomb"]) ::slotted(:nth-child(7)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -1), 0);
      }

      /* Ring 2 — 12 positions, clockwise from north. */

      /* (0, -2) — N */
      :host([layout="honeycomb"]) ::slotted(:nth-child(8)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -1), calc(var(--hp-row-step) * -2));
      }
      /* (1, -2) — N+NE */
      :host([layout="honeycomb"]) ::slotted(:nth-child(9)) {
        translate: -50% -50%;
        transform: translate(0, calc(var(--hp-row-step) * -2));
      }
      /* (2, -2) — NE */
      :host([layout="honeycomb"]) ::slotted(:nth-child(10)) {
        translate: -50% -50%;
        transform: translate(var(--hp-col-step), calc(var(--hp-row-step) * -2));
      }
      /* (2, -1) — NE+SE */
      :host([layout="honeycomb"]) ::slotted(:nth-child(11)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * 1.5), calc(var(--hp-row-step) * -1));
      }
      /* (2, 0) — E */
      :host([layout="honeycomb"]) ::slotted(:nth-child(12)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * 2), 0);
      }
      /* (1, 1) — SE+S */
      :host([layout="honeycomb"]) ::slotted(:nth-child(13)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * 1.5), var(--hp-row-step));
      }
      /* (0, 2) — S */
      :host([layout="honeycomb"]) ::slotted(:nth-child(14)) {
        translate: -50% -50%;
        transform: translate(var(--hp-col-step), calc(var(--hp-row-step) * 2));
      }
      /* (-1, 2) — S+SW */
      :host([layout="honeycomb"]) ::slotted(:nth-child(15)) {
        translate: -50% -50%;
        transform: translate(0, calc(var(--hp-row-step) * 2));
      }
      /* (-2, 2) — SW */
      :host([layout="honeycomb"]) ::slotted(:nth-child(16)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -1), calc(var(--hp-row-step) * 2));
      }
      /* (-2, 1) — SW+NW */
      :host([layout="honeycomb"]) ::slotted(:nth-child(17)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -1.5), var(--hp-row-step));
      }
      /* (-2, 0) — W */
      :host([layout="honeycomb"]) ::slotted(:nth-child(18)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -2), 0);
      }
      /* (-1, -1) — NW+N */
      :host([layout="honeycomb"]) ::slotted(:nth-child(19)) {
        translate: -50% -50%;
        transform: translate(calc(var(--hp-col-step) * -1.5), calc(var(--hp-row-step) * -1));
      }
    `,
  ];

  override render(): TemplateResult {
    if (this.layout === "honeycomb") {
      return html`<slot @slotchange=${this.updateAxialExtent}></slot>`;
    }
    return html`
      <slot name="top"></slot>
      <slot name="middle-left"></slot>
      <slot name="centre"></slot>
      <slot name="middle-right"></slot>
      <slot name="bottom"></slot>
    `;
  }

  /** Rosette layout always fills the centre + 4 named slots. The
   * cluster shape is fixed (cross pattern), so the fill mask is a
   * compile-time constant. */
  private static readonly ROSETTE_FILL_CELLS: ReadonlyArray<{ q: number; r: number }> = [
    { q: 0, r: 0 }, // centre
    { q: 0, r: -1 }, // top
    { q: -1, r: 0 }, // middle-left
    { q: 1, r: 0 }, // middle-right
    { q: 0, r: 1 }, // bottom
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    // Rosette fill is static — set it once on connect. Honeycomb is
    // child-count-dependent and is computed on slotchange.
    if (this.layout === "rosette") {
      this.writeFillCells(HpCluster.ROSETTE_FILL_CELLS);
    }
  }

  /** Walks slotted children, finds which honeycomb positions are
   * filled (children fill in order matching HONEYCOMB_POSITIONS), and
   * publishes both the per-cell fill list (`data-fill-cells`) and the
   * bounding box (`data-axial-q-min` etc.) so hp-grid masonry mode
   * can pack clusters using their actual hex footprint rather than
   * the worst-case bbox. Per-cell occupancy lets neighbouring
   * clusters interpenetrate each other's empty bbox corners — a
   * ring-2-NE cluster's unfilled NW corner becomes drop space for
   * the next cluster. */
  private updateAxialExtent = (): void => {
    if (this.layout !== "honeycomb") {
      return;
    }
    const childCount = this.children.length;
    if (childCount === 0) {
      this.writeFillCells([{ q: 0, r: 0 }]);
      return;
    }
    const filled = HONEYCOMB_POSITIONS.slice(
      0,
      Math.min(childCount, HONEYCOMB_POSITIONS.length)
    );
    this.writeFillCells(filled);
  };

  /** Publishes the cluster's fill mask + bbox on host data attrs.
   * `data-fill-cells` is the authoritative per-cell mask, space-
   * separated `"q,r q,r ..."`. `data-axial-q-min`/`q-max`/`r-min`/
   * `r-max` mirror the bbox derived from it (kept for cheap consumers
   * that only care about footprint dimensions, like the viewport-
   * bound calc in hp-grid's pack scan). */
  private writeFillCells(cells: ReadonlyArray<{ q: number; r: number }>): void {
    let qMin = Number.POSITIVE_INFINITY;
    let qMax = Number.NEGATIVE_INFINITY;
    let rMin = Number.POSITIVE_INFINITY;
    let rMax = Number.NEGATIVE_INFINITY;
    const parts: string[] = [];
    for (const c of cells) {
      if (c.q < qMin) qMin = c.q;
      if (c.q > qMax) qMax = c.q;
      if (c.r < rMin) rMin = c.r;
      if (c.r > rMax) rMax = c.r;
      parts.push(`${c.q},${c.r}`);
    }
    this.setAttribute("data-fill-cells", parts.join(" "));
    this.setAttribute("data-axial-q-min", String(qMin));
    this.setAttribute("data-axial-q-max", String(qMax));
    this.setAttribute("data-axial-r-min", String(rMin));
    this.setAttribute("data-axial-r-max", String(rMax));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-cluster": HpCluster;
  }
}
