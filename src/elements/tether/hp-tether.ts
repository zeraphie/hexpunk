// hp-tether.ts — Arc-link between two molecules.
//
// Hexpunk's third spatial primitive (after grid + bonding): a curved
// SVG bezier connecting two distant hex molecules. Bonds are physical
// (cells touch, share an edge); links are remote (cells are apart, arc
// draws between them). Use linking for graph relationships — pages of
// a form, related items, dependencies — anything where the connection
// matters but the cells can't or shouldn't be adjacent.
//
// Endpoints are referenced by CSS selector (from / to attributes).
// Connection points are picked from the 6 vertices of each endpoint
// (see "Endpoint anchoring" below), with bbox coordinates projected
// into the link's own coordinate space so hp-tether can sit in any
// positioned ancestor and the path resolves correctly.
//
// Live-following: a MutationObserver watches each endpoint's parent
// with `subtree: true` and `attributeFilter: ["q", "r",
// "data-hp-dragging"]`, so the link reacts to ANY [q][r] sibling
// moving — not just the endpoints. This is what catches the "third
// hex passes between the two linked hexes" case: the third hex's
// drag mutates the obstacle layout, the observer fires, recompute
// re-scores, the link reroutes through the morph. Transition events
// (transitionrun / transitionend / transitioncancel) are listened
// to in capture mode on the parents — these events bubble, so one
// listener per parent catches every descendant's transform
// animation, keeping the rAF loop alive through the post-drop snap
// (~90ms) for the dragged hex and any obstacles it displaced.
//
// Endpoint anchoring: the arc attaches at hex vertices, not centres.
// All 6 vertices of each endpoint are computed from the pointy-top
// geometry. Each of the 36 candidate vertex pairs is scored as
// `crossings × 1000 + distance`, where "crossings" counts how many
// sibling [q][r] hexes the straight chord passes through. Vertices
// on a shared edge with ANY adjacent [q][r] neighbour are excluded
// outright — anchoring there would conflate the link with the
// bonded neighbour.
//
// Continuous re-pick: every recompute reconsiders whether a better
// vertex pair exists for the current geometry. When the optimal
// pair changes, a 60ms morph lerps both vertex position and outward
// direction from the old to the new pair, so the swap reads as an
// animation rather than a teleport. Hysteresis prevents flapping
// between near-tied pairs frame-to-frame. Consumers can also call
// `.retether()` to force an immediate re-pick.
//
// Path: cubic bezier with control points pulled along each vertex's
// *outward* direction (radial from hex centre through the chosen
// vertex). The curve leaves the source vertex face-on through its
// outward direction, and enters the target vertex the same way. This
// matches the node-editor convention (Rete.js, D3-node-editor, etc.)
// where links "flow out of" sockets along their natural axis instead
// of bulging perpendicular to the chord. Pull length is a modest
// fraction of chord length so the curve stays mostly straight.
//
// Glow: SVG feGaussianBlur filter applied to a duplicated stroke
// underneath the main path. Unique filter id per instance so multiple
// hp-tether elements don't clash.

import { LitElement, css, html, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { PropertyValues } from "lit";

import { hpBase } from "../../styles/hp-base.js";

let instanceCounter = 0;

/** Fires when the link has settled on a vertex pair — once on initial
 * attach, and again every time a vertex-swap morph completes. Use
 * this when the consumer needs to react to the link's *stable*
 * state, not its in-flight one. Does not fire during the morph or
 * during a drag where the endpoints are tracking but the chosen
 * vertex pair hasn't changed. */
export interface HpTetherSettleEventDetail {
  fromEl: Element;
  toEl: Element;
  fromVertexIdx: number;
  toVertexIdx: number;
}

/** Duration of the vertex-swap morph when the best vertex pair
 * changes. Snappier than the grid's 90ms snap. */
const RELINK_TRANSITION_MS = 60;

/** Hysteresis applied when continuously re-evaluating the best
 * vertex pair. A candidate pair must beat the current locked
 * pair's score by at least this much before triggering a morph —
 * prevents flapping between pairs that tie on score frame-to-frame.
 * Units: same as `scorePair` (pixels, on the distance side; one
 * obstacle crossing is worth 1000 so changes-in-crossings always
 * trip the threshold). */
const RELINK_HYSTERESIS_PX = 24;

/** For each pointy-top axial neighbour direction `(dq, dr)`, the pair
 * of vertex indices on each hex that lie on the shared edge — those
 * are the vertices the link must NOT attach to (anchoring there
 * would draw the curve through the adjacent hex). Vertex indexing
 * is the same as `HpTether.hexVertices` / `OUTWARD_DIRS`: 0=top, 1=
 * top-right, 2=bottom-right, 3=bottom, 4=bottom-left, 5=top-left. */
const ADJACENCY_EXCLUSIONS: Record<
  string,
  { from: readonly [number, number]; to: readonly [number, number] }
> = {
  "1,-1": { from: [0, 1], to: [3, 4] }, // NE
  "1,0": { from: [1, 2], to: [4, 5] }, // E
  "0,1": { from: [2, 3], to: [5, 0] }, // SE
  "-1,1": { from: [3, 4], to: [0, 1] }, // SW
  "-1,0": { from: [4, 5], to: [1, 2] }, // W
  "0,-1": { from: [5, 0], to: [2, 3] }, // NW
};

/**
 * Arc-tether between two distant molecules — curved SVG bezier
 * connecting two hexes referenced by CSS selector (`from` / `to`).
 * Reroutes around obstacles, re-settles after drags.
 *
 * @fires hp-tether-settle - When the tether settles on a vertex pair.
 * detail: { fromEl, toEl, fromVertexIdx, toVertexIdx }
 *
 * @cssproperty --hp-tether-arc-width - Stroke width of the arc
 * @cssproperty --hp-tether-arc-glow - Glow filter blur radius
 * @cssproperty --hp-tether-arc-pulse-dot - Diameter of the pulse dot
 */
@customElement("hp-tether")
export class HpTether extends LitElement {
  /** CSS selector for the source molecule. Resolved against document. */
  @property() from?: string;

  /** CSS selector for the target molecule. Resolved against document. */
  @property() to?: string;

  /** `active` (default) shows full-opacity stroke + travelling pulse;
   * `idle` drops to the container shade and silences the pulse. */
  @property({ reflect: true })
  state: "idle" | "active" = "active";

  /** Render an arrowhead at the target end for directed graphs. */
  @property({ type: Boolean, reflect: true })
  directed = false;

  @state() private pathD = "";

  private fromEl: Element | null = null;
  private toEl: Element | null = null;
  /** Locked vertex indices (0-5). `-1` means "not yet selected" — the
   * next recompute will pick the nearest pair and store the indices
   * here. Consumers call `.retether()` to reset back to `-1`. */
  private fromVertexIdx = -1;
  private toVertexIdx = -1;
  /** Previous indices held during a retether morph so the curve can
   * lerp from old vertex+outward to new vertex+outward. `-1` when
   * no transition is in progress. */
  private prevFromVertexIdx = -1;
  private prevToVertexIdx = -1;
  /** `performance.now()` when the current retether transition started,
   * or 0 when none is active. */
  private transitionStart = 0;
  private mutationObserver: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private animatingEls = new Set<Element>();
  /** Parent elements currently delegated to for transition + mutation
   * observation. Tracked so disconnect / endpoint-change can remove
   * the listeners. Typically a single hp-grid. */
  private observedParents = new Set<Element>();
  private rafId = 0;
  private readonly uid = `hp-tether-${++instanceCounter}`;

  override connectedCallback(): void {
    super.connectedCallback();
    this.mutationObserver = new MutationObserver(() => this.scheduleRecompute());
    this.resizeObserver = new ResizeObserver(() => this.scheduleRecompute());
    this.resizeObserver.observe(this);
    // Defer endpoint resolution by two animation frames so custom-
    // element upgrade + Lit's shadow-DOM populate has time to land
    // on the endpoints before we measure them. Without this, the
    // first getBoundingClientRect on an hp-cell / hp-anchor / etc.
    // can return its pre-upgrade dimensions (inline-block with no
    // explicit width); we'd compute a path between those wrong
    // vertices, the path renders, and then the next observer fire
    // corrects it — producing a visible flicker. The CSS animation
    // on .arc / .glow runs once on first paint of the path; the
    // defer ensures that "first paint" is at the correct geometry.
    this.firstDrawScheduled = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.firstDrawScheduled = false;
        this.resolveEndpoints();
      });
    });
  }

  /** True while the constructor delay before first endpoint
   * resolution is pending. Used to suppress any earlier recompute
   * call from observers that fire before our deferred resolve. */
  private firstDrawScheduled = false;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.mutationObserver?.disconnect();
    this.resizeObserver?.disconnect();
    for (const p of this.observedParents) {
      this.detachParent(p);
    }
    this.observedParents.clear();
    this.animatingEls.clear();
    this.transitionStart = 0;
    this.prevFromVertexIdx = -1;
    this.prevToVertexIdx = -1;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  override updated(changed: PropertyValues<this>): void {
    if (changed.has("from") || changed.has("to")) {
      this.resolveEndpoints();
    }
  }

  // ── Endpoint resolution ────────────────────────────────────────────

  private detachParent(p: Element): void {
    p.removeEventListener("transitionrun", this.handleTransitionRun, true);
    p.removeEventListener("transitionend", this.handleTransitionEnd, true);
    p.removeEventListener("transitioncancel", this.handleTransitionEnd, true);
    p.removeEventListener("hp-grid-pan", this.scheduleRecompute);
  }

  private attachParent(p: Element): void {
    this.mutationObserver?.observe(p, {
      attributes: true,
      subtree: true,
      attributeFilter: ["q", "r", "data-hp-dragging"],
    });
    p.addEventListener("transitionrun", this.handleTransitionRun, true);
    p.addEventListener("transitionend", this.handleTransitionEnd, true);
    p.addEventListener("transitioncancel", this.handleTransitionEnd, true);
    // Canvas pan via <hp-grid> shifts every slotted child's viewport
    // position without firing mutation observers (CSS-only transform
    // changes). Listen for the grid's pan event so arcs keep up.
    p.addEventListener("hp-grid-pan", this.scheduleRecompute);
  }

  private resolveEndpoints(): void {
    if (!this.mutationObserver) {
      return;
    }
    // Tear down prior observation, including the animatingEls set
    // (which can hold siblings from the previous parent context).
    this.mutationObserver.disconnect();
    for (const p of this.observedParents) {
      this.detachParent(p);
    }
    this.observedParents.clear();
    this.animatingEls.clear();

    this.fromEl = this.from ? document.querySelector(this.from) : null;
    this.toEl = this.to ? document.querySelector(this.to) : null;

    // New endpoints → new vertex selection on next recompute,
    // and reset any in-flight transition.
    this.fromVertexIdx = -1;
    this.toVertexIdx = -1;
    this.prevFromVertexIdx = -1;
    this.prevToVertexIdx = -1;
    this.transitionStart = 0;

    // Delegate observation to the parent(s) — covers endpoints AND
    // every sibling obstacle without needing per-element listeners.
    const parents = new Set<Element>();
    if (this.fromEl?.parentElement) {
      parents.add(this.fromEl.parentElement);
    }
    if (this.toEl?.parentElement) {
      parents.add(this.toEl.parentElement);
    }
    for (const p of parents) {
      this.attachParent(p);
      this.observedParents.add(p);
    }

    this.scheduleRecompute();
  }

  private dispatchSettle(): void {
    if (!this.fromEl || !this.toEl) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<HpTetherSettleEventDetail>("hp-tether-settle", {
        detail: {
          fromEl: this.fromEl,
          toEl: this.toEl,
          fromVertexIdx: this.fromVertexIdx,
          toVertexIdx: this.toVertexIdx,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /** Re-pick the nearest vertex pair on the next recompute. Call this
   * after the graph rearranges enough that the locked vertex is no
   * longer the natural anchor (e.g. after a large drag, or when a
   * consumer's relayout has moved both endpoints). */
  public retether(): void {
    this.fromVertexIdx = -1;
    this.toVertexIdx = -1;
    this.scheduleRecompute();
  }

  /** Re-play the draw-in animation. The CSS animation otherwise
   * runs exactly once when the path element is first added to the
   * DOM (i.e., after the connectedCallback defer when geometry is
   * settled); consumers building a graph editor that wants to
   * highlight a newly-created or recently-touched link can call
   * this to flash the draw-in on demand. Uses Web Animations API
   * so it doesn't interfere with the once-on-mount CSS animation
   * on the same elements. */
  public drawIn(): void {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }
    const paths = root.querySelectorAll<SVGPathElement>(".arc, .glow");
    for (const path of paths) {
      path.animate([{ strokeDashoffset: "1" }, { strokeDashoffset: "0" }], {
        duration: 80,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        fill: "forwards",
      });
    }
  }

  // ── Recompute scheduling ───────────────────────────────────────────

  private scheduleRecompute = (): void => {
    if (this.rafId) {
      return;
    }
    // During the initial two-frame defer in connectedCallback, drop
    // any recompute requests from the observers we just attached.
    // Those observers' first-fire of the lifecycle gets folded into
    // the deferred resolveEndpoints + recompute that follows, so we
    // avoid a wrong-geometry render frame before the path's first
    // CSS-animated paint.
    if (this.firstDrawScheduled) {
      return;
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.recompute();
      // Keep the loop alive while either endpoint is mid-drag OR
      // mid-transform-transition. Neither MutationObserver nor a
      // single transitionend tick is enough on its own — drag moves
      // the transform via inline-style writes that don't notify
      // MutationObserver, and the snap transition continues for
      // ~90ms after data-hp-dragging clears.
      if (this.isUpdating()) {
        this.scheduleRecompute();
      }
    });
  };

  private isUpdating(): boolean {
    if (this.animatingEls.size > 0) {
      return true;
    }
    if (this.transitionStart > 0) {
      return true;
    }
    // Any [q][r] sibling currently being dragged in either observed
    // parent — keeps the rAF loop alive so the link re-scores as
    // obstacles move (the "third hex passes between" case).
    for (const p of this.observedParents) {
      if (p.querySelector("[q][r][data-hp-dragging]")) {
        return true;
      }
    }
    return false;
  }

  private handleTransitionRun = (event: Event): void => {
    const e = event as TransitionEvent;
    if (e.propertyName !== "transform") {
      return;
    }
    // Capture-mode listener on the parent — `target` is the actual
    // transitioning descendant. Filter to [q][r] so non-grid
    // animations on unrelated descendants don't keep our rAF alive.
    const target = e.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (!target.hasAttribute("q") || !target.hasAttribute("r")) {
      return;
    }
    this.animatingEls.add(target);
    this.scheduleRecompute();
  };

  private handleTransitionEnd = (event: Event): void => {
    const e = event as TransitionEvent;
    if (e.propertyName !== "transform") {
      return;
    }
    const target = e.target;
    if (!(target instanceof Element)) {
      return;
    }
    this.animatingEls.delete(target);
    // One final tick after the transition settles, in case the loop
    // already exited on the previous frame.
    this.scheduleRecompute();
  };

  // ── Path computation ───────────────────────────────────────────────

  /** Unit outward vectors for each vertex (radial from hex centre).
   * Same index order as `hexVertices`: 0=top, 1=top-right, 2=bottom-
   * right, 3=bottom, 4=bottom-left, 5=top-left. Used to pull bezier
   * control points so the curve leaves/enters each hex face-on. */
  private static readonly OUTWARD_DIRS: { x: number; y: number }[] = [
    { x: 0, y: -1 },
    { x: 0.8660254, y: -0.5 },
    { x: 0.8660254, y: 0.5 },
    { x: 0, y: 1 },
    { x: -0.8660254, y: 0.5 },
    { x: -0.8660254, y: -0.5 },
  ];

  /** Six vertices of a pointy-top hex in viewport coords. Anchors the
   * hex to the TOP of the host bbox using a width-derived height
   * (`width × 2/√3`). Inline-block hosts pick up a baseline-descender
   * space that inflates `rect.height` *below* the hex; centring on
   * `rect.height` would push every vertex down by half the inflation.
   * Anchoring at `rect.top` keeps the visible top vertex at the bbox
   * top edge regardless of how much descender padding sits below.
   * Order: clockwise from top. */
  private static hexVertices(rect: DOMRect): { x: number; y: number }[] {
    const cx = rect.left + rect.width / 2;
    const halfW = rect.width / 2;
    // Pointy-top hex with width = `rect.width` has total height
    // `width × 2/√3` ≈ width × 1.1547. Half-height (centre→top
    // vertex) = `width × 1/√3` ≈ width × 0.5774.
    const halfH = rect.width * 0.5773502;
    const cy = rect.top + halfH;
    const quarterH = halfH * 0.5;
    return [
      { x: cx, y: rect.top },
      { x: cx + halfW, y: cy - quarterH },
      { x: cx + halfW, y: cy + quarterH },
      { x: cx, y: cy + halfH },
      { x: cx - halfW, y: cy + quarterH },
      { x: cx - halfW, y: cy - quarterH },
    ];
  }

  /** Do segments AB and CD cross? Standard parametric intersection. */
  private static segmentsIntersect(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    dx: number,
    dy: number
  ): boolean {
    const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
    if (Math.abs(denom) < 1e-9) {
      return false;
    }
    const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
    const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  /** Does line segment (x1,y1)→(x2,y2) intersect axis-aligned rect? */
  private static lineCrossesRect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    rect: DOMRect
  ): boolean {
    // Trivial reject: segment bbox doesn't touch rect.
    if (Math.max(x1, x2) < rect.left) {
      return false;
    }
    if (Math.min(x1, x2) > rect.right) {
      return false;
    }
    if (Math.max(y1, y2) < rect.top) {
      return false;
    }
    if (Math.min(y1, y2) > rect.bottom) {
      return false;
    }
    // 4 segment-vs-edge tests.
    const { left: L, right: R, top: T, bottom: B } = rect;
    return (
      HpTether.segmentsIntersect(x1, y1, x2, y2, L, T, R, T) ||
      HpTether.segmentsIntersect(x1, y1, x2, y2, R, T, R, B) ||
      HpTether.segmentsIntersect(x1, y1, x2, y2, R, B, L, B) ||
      HpTether.segmentsIntersect(x1, y1, x2, y2, L, B, L, T)
    );
  }

  /** Sibling [q][r] elements that aren't the endpoints — these are
   * the hex obstacles the chord should avoid passing through. Scoped
   * to fromEl's immediate parent (typically <hp-grid>). */
  private gatherObstacles(): DOMRect[] {
    if (!this.fromEl) {
      return [];
    }
    const parent = this.fromEl.parentElement;
    if (!parent) {
      return [];
    }
    return Array.from(parent.querySelectorAll("[q][r]"))
      .filter((el) => el !== this.fromEl && el !== this.toEl)
      .map((el) => el.getBoundingClientRect());
  }

  /** Score each of the 36 candidate vertex pairs by
   * `crossings × 1000 + distance`. Heavy penalty per obstacle
   * crossing keeps non-occluding chords on top; among equally clean
   * candidates the shortest wins. Falls back to shortest if every
   * pair crosses something — "within a reasonable amount". */
  /** Vertices on `el` that lie on a shared edge with ANY axial-
   * adjacent sibling on the q/r grid. Those vertices are ambiguous
   * attach points — anchoring there would visually conflate this
   * link with the bonded neighbour, regardless of whether the
   * neighbour is this link's other endpoint or some unrelated hex.
   * Returns an empty set when the element isn't on a q/r grid. */
  private excludedVerticesForEndpoint(el: Element | null): Set<number> {
    const excluded = new Set<number>();
    if (!el) {
      return excluded;
    }
    const parent = el.parentElement;
    if (!parent) {
      return excluded;
    }
    const eq = Number.parseFloat(el.getAttribute("q") ?? "");
    const er = Number.parseFloat(el.getAttribute("r") ?? "");
    if (Number.isNaN(eq) || Number.isNaN(er)) {
      return excluded;
    }
    for (const sib of parent.querySelectorAll("[q][r]")) {
      if (sib === el) {
        continue;
      }
      const sq = Number.parseFloat(sib.getAttribute("q") ?? "");
      const sr = Number.parseFloat(sib.getAttribute("r") ?? "");
      if (Number.isNaN(sq) || Number.isNaN(sr)) {
        continue;
      }
      const entry = ADJACENCY_EXCLUSIONS[`${sq - eq},${sr - er}`];
      if (entry) {
        for (const v of entry.from) {
          excluded.add(v);
        }
      }
    }
    return excluded;
  }

  /** Score a single vertex pair: `crossings × 1000 + distance`.
   * Pulled out so the live re-pick check can compare the currently
   * locked pair's score against the candidate's using identical
   * logic. */
  private static scorePair(
    fv: { x: number; y: number }[],
    tv: { x: number; y: number }[],
    fromIdx: number,
    toIdx: number,
    obstacles: DOMRect[]
  ): number {
    const f = fv[fromIdx]!;
    const t = tv[toIdx]!;
    const dx = t.x - f.x;
    const dy = t.y - f.y;
    let crossings = 0;
    for (const obs of obstacles) {
      if (HpTether.lineCrossesRect(f.x, f.y, t.x, t.y, obs)) {
        crossings++;
      }
    }
    return crossings * 1000 + Math.sqrt(dx * dx + dy * dy);
  }

  private pickBestVertexPair(
    fromRect: DOMRect,
    toRect: DOMRect
  ): { fromIdx: number; toIdx: number } {
    const fv = HpTether.hexVertices(fromRect);
    const tv = HpTether.hexVertices(toRect);
    const obstacles = this.gatherObstacles();
    const fromExcluded = this.excludedVerticesForEndpoint(this.fromEl);
    const toExcluded = this.excludedVerticesForEndpoint(this.toEl);
    let best = { fromIdx: -1, toIdx: -1 };
    let bestScore = Infinity;
    for (let i = 0; i < 6; i++) {
      if (fromExcluded.has(i)) {
        continue;
      }
      for (let j = 0; j < 6; j++) {
        if (toExcluded.has(j)) {
          continue;
        }
        const score = HpTether.scorePair(fv, tv, i, j, obstacles);
        if (score < bestScore) {
          bestScore = score;
          best = { fromIdx: i, toIdx: j };
        }
      }
    }
    // Defensive fallback: shouldn't trigger — at most 2 of 6 vertices
    // are excluded per side, so 16 candidates always remain.
    if (best.fromIdx < 0) {
      best = { fromIdx: 0, toIdx: 0 };
    }
    return best;
  }

  private recompute(): void {
    if (!this.fromEl || !this.toEl) {
      this.pathD = "";
      return;
    }
    const linkRect = this.getBoundingClientRect();
    const fromRect = this.fromEl.getBoundingClientRect();
    const toRect = this.toEl.getBoundingClientRect();

    // Initial pick (or post-`.retether()` re-pick).
    if (this.fromVertexIdx < 0 || this.toVertexIdx < 0) {
      const pair = this.pickBestVertexPair(fromRect, toRect);
      this.fromVertexIdx = pair.fromIdx;
      this.toVertexIdx = pair.toIdx;
      // Initial settle — no morph runs for the first pick, fire now.
      this.dispatchSettle();
    } else if (this.transitionStart === 0) {
      // Continuous re-pick: every recompute reconsiders whether a
      // better vertex pair exists for the current geometry. The
      // morph carries the visual transition so this no longer
      // teleports. Hysteresis (RELINK_HYSTERESIS_PX) prevents
      // flapping between near-tied pairs. If the currently locked
      // vertex got excluded (e.g. an adjacent hex just bonded onto
      // that face), currentScore = Infinity and any candidate wins.
      const candidate = this.pickBestVertexPair(fromRect, toRect);
      if (candidate.fromIdx !== this.fromVertexIdx || candidate.toIdx !== this.toVertexIdx) {
        const fv = HpTether.hexVertices(fromRect);
        const tv = HpTether.hexVertices(toRect);
        const obstacles = this.gatherObstacles();
        const fromExcluded = this.excludedVerticesForEndpoint(this.fromEl);
        const toExcluded = this.excludedVerticesForEndpoint(this.toEl);
        const currentValid =
          !fromExcluded.has(this.fromVertexIdx) && !toExcluded.has(this.toVertexIdx);
        const currentScore = currentValid
          ? HpTether.scorePair(fv, tv, this.fromVertexIdx, this.toVertexIdx, obstacles)
          : Number.POSITIVE_INFINITY;
        const candidateScore = HpTether.scorePair(
          fv,
          tv,
          candidate.fromIdx,
          candidate.toIdx,
          obstacles
        );
        if (candidateScore < currentScore - RELINK_HYSTERESIS_PX) {
          this.prevFromVertexIdx = this.fromVertexIdx;
          this.prevToVertexIdx = this.toVertexIdx;
          this.fromVertexIdx = candidate.fromIdx;
          this.toVertexIdx = candidate.toIdx;
          this.transitionStart = performance.now();
        }
      }
    }

    const fromVerts = HpTether.hexVertices(fromRect);
    const toVerts = HpTether.hexVertices(toRect);
    let fromV = fromVerts[this.fromVertexIdx]!;
    let toV = toVerts[this.toVertexIdx]!;
    let outFrom = HpTether.OUTWARD_DIRS[this.fromVertexIdx]!;
    let outTo = HpTether.OUTWARD_DIRS[this.toVertexIdx]!;

    // Vertex-swap morph: interpolate position + outward direction
    // from the previous pair to the new pair over the transition
    // window. Both endpoints lerp simultaneously with smoothstep
    // easing so the curve eases in and out rather than jumping.
    if (this.transitionStart > 0 && this.prevFromVertexIdx >= 0 && this.prevToVertexIdx >= 0) {
      const elapsed = performance.now() - this.transitionStart;
      const t = Math.min(elapsed / RELINK_TRANSITION_MS, 1);
      if (t >= 1) {
        this.transitionStart = 0;
        this.prevFromVertexIdx = -1;
        this.prevToVertexIdx = -1;
        // Morph complete — the link is stable on its new pair.
        this.dispatchSettle();
      } else {
        const ease = t * t * (3 - 2 * t);
        const prevFromV = fromVerts[this.prevFromVertexIdx]!;
        const prevToV = toVerts[this.prevToVertexIdx]!;
        const prevOutFrom = HpTether.OUTWARD_DIRS[this.prevFromVertexIdx]!;
        const prevOutTo = HpTether.OUTWARD_DIRS[this.prevToVertexIdx]!;
        fromV = {
          x: prevFromV.x + (fromV.x - prevFromV.x) * ease,
          y: prevFromV.y + (fromV.y - prevFromV.y) * ease,
        };
        toV = {
          x: prevToV.x + (toV.x - prevToV.x) * ease,
          y: prevToV.y + (toV.y - prevToV.y) * ease,
        };
        outFrom = {
          x: prevOutFrom.x + (outFrom.x - prevOutFrom.x) * ease,
          y: prevOutFrom.y + (outFrom.y - prevOutFrom.y) * ease,
        };
        outTo = {
          x: prevOutTo.x + (outTo.x - prevOutTo.x) * ease,
          y: prevOutTo.y + (outTo.y - prevOutTo.y) * ease,
        };
      }
    }

    const fx = fromV.x - linkRect.left;
    const fy = fromV.y - linkRect.top;
    const tx = toV.x - linkRect.left;
    const ty = toV.y - linkRect.top;

    const dx = tx - fx;
    const dy = ty - fy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) {
      this.pathD = "";
      return;
    }

    // Pull each control point along its vertex's outward direction.
    // Length is a modest fraction of the chord so the curve stays
    // mostly straight; capped so very long links don't loop.
    const pullLen = Math.min(len / 4, 40);
    const c1x = fx + outFrom.x * pullLen;
    const c1y = fy + outFrom.y * pullLen;
    const c2x = tx + outTo.x * pullLen;
    const c2y = ty + outTo.y * pullLen;

    this.pathD = `M ${fx.toFixed(2)} ${fy.toFixed(2)} C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)}`;
  }

  // ── Styles ─────────────────────────────────────────────────────────

  static override styles = [
    hpBase,
    css`
      :host {
        position: absolute;
        inset: 0;
        display: block;
        pointer-events: none;
        z-index: var(--hp-layer-arc);
        color: var(--hp-secondary-container);
        transition: color var(--hp-duration-medium) var(--hp-ease-default);
      }

      :host([state="active"]) {
        color: var(--hp-secondary);
      }

      :host(:hover) {
        color: var(--hp-secondary);
      }

      svg {
        display: block;
        width: 100%;
        height: 100%;
        overflow: visible;
      }

      /* Draw-in animation. pathLength is set on the path element
 * so dasharray/dashoffset are in 0..1 units regardless of
 * actual path length. stroke-dashoffset: 1 hides the line
 * entirely; the animation tweens to 0 over 80ms so the line
 * draws in from source vertex toward destination. The
 * animation runs once when the path element is first added
 * to the DOM — subsequent recomputes update the path's d
 * attribute but reuse the same element instance, so they
 * don't retrigger. The connectedCallback defer ensures that
 * "first add" happens after the endpoints have a stable
 * bbox, so the draw-in plays on a correctly-positioned arc
 * rather than the wrong one. */
      .glow,
      .arc {
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        animation: hp-tether-draw-in 80ms var(--hp-ease-default) forwards;
      }

      .glow {
        stroke-width: calc(var(--hp-tether-arc-width) * 2.5);
        opacity: 0.35;
      }

      .arc {
        stroke-width: var(--hp-tether-arc-width);
      }

      @keyframes hp-tether-draw-in {
        to {
          stroke-dashoffset: 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .glow,
        .arc {
          animation: none;
          stroke-dashoffset: 0;
        }
      }
    `,
  ];

  // ── Render ─────────────────────────────────────────────────────────

  override render() {
    const glowId = `${this.uid}-glow`;
    const arrowId = `${this.uid}-arrow`;
    const d = this.pathD;

    return html`
      <svg aria-hidden="true">
        <defs>
          ${svg`
 <filter id=${glowId} x="-50%" y="-50%" width="200%" height="200%">
 <feGaussianBlur stdDeviation="3.5" />
 </filter>
 <marker
 id=${arrowId}
 viewBox="0 0 10 10"
 refX="9"
 refY="5"
 markerWidth="6"
 markerHeight="6"
 orient="auto-start-reverse"
 >
 <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
 </marker>
 `}
        </defs>
        ${d
          ? svg`
 <path
 class="glow"
 d=${d}
 pathLength="1"
 filter="url(#${glowId})"
 />
 <path
 class="arc"
 d=${d}
 pathLength="1"
 marker-end=${this.directed ? `url(#${arrowId})` : ""}
 />
 `
          : ""}
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-tether": HpTether;
  }
  interface HTMLElementEventMap {
    "hp-tether-settle": CustomEvent<HpTetherSettleEventDetail>;
  }
}
