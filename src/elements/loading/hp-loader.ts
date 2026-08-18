// hp-loader.ts — Hexagonal-cluster loader.
//
// A cluster of small filled hexes arranged in concentric rings with
// a hollow middle, in two modes:
//
// - **Indeterminate** (a bare `<hp-loader>`): each hex scales
// between 1 and ~0.25 on a loop; per-hex animation-delay traces a
// clockwise spiral so the cluster reads as a rotating spiral wave
// rather than a uniform pulse.
// - **Determinate** (`value` set, `indeterminate` absent): progress
// maps onto the same spiral order — with N hexes in the cluster,
// `round(fraction × N)` render lit and the rest stay faint so the
// full silhouette reads as the track. The frontier hex (last lit)
// keeps the scale pulse so the loader stays visibly alive between
// value changes; at 100% the pulse stops and the cluster settles.
//
// Forward fill is choreographed, never cut: moving the frontier
// mid-pulse reads as a flash, so each newly due hex lights only
// after the previous one's animation completes — one hex per
// animation, rippling outward until the fill reaches the value. A
// parked frontier runs the full 1.4s pulse loop; while catching up
// each hex plays a one-shot ignite — a one-way grow from the faint
// not-progress state into the lit progress state — whose duration
// shrinks with the backlog (base ÷ backlog, floored), so a deep
// queue ripples faster and the fill stays on the value's heels.
// That bumpy catch-up is the default (`timing="irregular"`);
// `timing="linear"` spends the measured due-rate instead of the
// fixed budget, locking the ripple to the value's own pace.
// The label and ARIA carry the true value immediately. Mode entry,
// a regressing value, and the from-empty start snap instead (there
// is no in-flight animation worth finishing).
//
// hp-progress is the linear counterpart; this is the radial one.
// Both share the min / max / value / indeterminate contract and
// progressbar semantics — aria-valuenow is present only when
// determinate.
//
// Sizes — md / lg always paint the OUTER two rings with the centre +
// inner ring left empty (matches the cyberpunk-loader reference: a
// hex of hexes with a hole in the middle). lg differs from md by
// hex size, not ring count — three filled rings reads too busy at
// the larger scale:
//
// - `sm` — 1 ring of 6 hexes, ~36px square. Inline / button-adjacent.
// No hollow centre — too small for the empty middle to read.
// - `md` — outer 2 rings (12 + 18 = 30 hexes) of a 3-radius cluster,
// ~80px square. Default mid-surface loading indicator.
// - `lg` — outer 2 rings, larger hex size, ~180px square. Full-page
// / hero loading state.
//
// Default tone uses --hp-primary; positive / warn / alert / error
// swap to the matching semantic colour. Respects
// prefers-reduced-motion by slowing the animation rather than freezing
// it — the visual stays alive at a calm pace for users who've opted
// out of motion.

import { LitElement, css, html, nothing, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { PropertyValues } from "lit";

import { hpBase } from "../../styles/hp-base.js";

export type HpLoaderTone = "neutral" | "positive" | "warn" | "alert" | "error";

export type HpLoaderTiming = "irregular" | "linear";

const SQRT3 = Math.sqrt(3);

interface HexCoord {
  q: number;
  r: number;
}

/** Generate axial coordinates for a hexagonal cluster covering rings
 * in [firstRing, lastRing] (inclusive). Inner rings (below firstRing)
 * are skipped, leaving a hollow centre. Coordinates are returned in
 * spiral order: innermost filled ring first, traversed counter-
 * clockwise from the east in axial space (NW → W → SW → SE → E →
 * NE), then the next ring outward, etc. CCW axial traversal renders
 * as a clockwise wave on screen because animation-delay is negative
 * — later indices start the cycle earlier, so the "currently
 * shrinking" hex travels from the highest index back toward the
 * innermost ring, which is clockwise on screen. */
function getRingCoords(firstRing: number, lastRing: number): HexCoord[] {
  const coords: HexCoord[] = [];
  if (firstRing === 0) {
    coords.push({ q: 0, r: 0 });
  }
  const dirs: ReadonlyArray<readonly [number, number]> = [
    [0, -1], // NW step
    [-1, 0], // W step
    [-1, +1], // SW step
    [0, +1], // SE step
    [+1, 0], // E step
    [+1, -1], // NE step
  ];
  for (let ring = Math.max(1, firstRing); ring <= lastRing; ring++) {
    let q = ring;
    let r = 0;
    for (const [dq, dr] of dirs) {
      for (let step = 0; step < ring; step++) {
        coords.push({ q, r });
        q += dq;
        r += dr;
      }
    }
  }
  return coords;
}

/** Pointy-top hex polygon points centred at (cx, cy) with side
 * length s. Top → top-right → bottom-right → bottom → bottom-left
 * → top-left. */
function hexPolygonPoints(cx: number, cy: number, s: number): string {
  const dx = (s * SQRT3) / 2;
  const dy = s / 2;
  return [
    `${cx},${cy - s}`,
    `${cx + dx},${cy - dy}`,
    `${cx + dx},${cy + dy}`,
    `${cx},${cy + s}`,
    `${cx - dx},${cy + dy}`,
    `${cx - dx},${cy - dy}`,
  ].join(" ");
}

interface SizeConfig {
  /** Innermost filled ring (inclusive). 0 = include the centre hex. */
  firstRing: number;
  /** Outermost filled ring (inclusive). Cluster bbox sizes off this. */
  lastRing: number;
  /** Side length of each constituent hex in viewBox units. */
  hexSize: number;
  /** Spacing multiplier between hex centres. 1.0 = touching, >1.0 =
   * visible gaps between hexes. */
  gap: number;
}

const SIZE_CONFIG: Record<"sm" | "md" | "lg", SizeConfig> = {
  // md and lg share the same internal cluster proportions — differ
  // only in host pixel size, so the cluster pattern scales uniformly
  // without redesign.
  sm: { firstRing: 1, lastRing: 1, hexSize: 5, gap: 1.18 },
  md: { firstRing: 2, lastRing: 3, hexSize: 6, gap: 1.18 },
  lg: { firstRing: 2, lastRing: 3, hexSize: 6, gap: 1.18 },
};

/** Catch-up ignite pacing: each due hex's grow-in runs at
 * base ÷ backlog (floored) so the whole backlog clears in roughly
 * the base duration however deep it is, while a single due hex
 * gets the full unhurried grow. The floor keeps the cascade
 * readable when dozens of hexes are due at once. Reduced-motion
 * uses the slower pair — the duration is applied inline (it is
 * per-hex dynamic), which would override a CSS media query. */
const IGNITE_BASE_MS = 350;
const IGNITE_MIN_MS = 50;
const IGNITE_REDUCED_BASE_MS = 800;
const IGNITE_REDUCED_MIN_MS = 200;

/**
 * Hexagonal-cluster loader. A hollow cluster of small filled hexes —
 * a clockwise spiral wave when indeterminate, a spiral progress fill
 * when a `value` is set. role="progressbar" with
 * aria-label="Loading" by default; aria-valuenow only when
 * determinate.
 */
@customElement("hp-loader")
export class HpLoader extends LitElement {
  /** Cluster size — `sm` (7 hexes inline), `md` (19 hexes default),
   * `lg` (37 hexes full-page). */
  @property({ reflect: true })
  size: "sm" | "md" | "lg" = "md";

  /** Semantic tone. Default `neutral` reads as --hp-primary ("system
   * busy"); others map to the matching tone stroke. */
  @property({ reflect: true })
  tone: HpLoaderTone = "neutral";

  /** Lower bound. Default 0. */
  @property({ type: Number })
  min = 0;

  /** Upper bound. Default 100. */
  @property({ type: Number })
  max = 100;

  /** Current progress. Setting a value switches the loader to
   * determinate mode (unless `indeterminate` is also set); a bare
   * `<hp-loader>` spins. Clamped to [min, max]. */
  @property({ type: Number, reflect: true })
  value: number | null = null;

  /** Force the indeterminate wave even while a `value` is retained —
   * for flipping back to "busy" without losing the number. */
  @property({ reflect: true, type: Boolean })
  indeterminate = false;

  /** Catch-up pacing. `irregular` (default) clears any backlog
   * inside a fixed ~⅓s budget, so bursts of progress visibly
   * quicken the ripple — the honest "this part loaded faster" jank
   * real loaders have. `linear` locks the per-hex pace to the
   * value's measured advance rate instead, so the ripple flows at
   * constant speed. */
  @property({ reflect: true })
  timing: HpLoaderTiming = "irregular";

  /** Determinate when a value is set and `indeterminate` doesn't
   * override it — the mode rule the renderer and ARIA share. */
  private get isDeterminate(): boolean {
    return !this.indeterminate && this.value !== null;
  }

  /** Progress in [0, 1]. 0 when the range is empty or inverted. */
  private get fraction(): number {
    const span = this.max - this.min;
    if (span <= 0) {
      return 0;
    }
    const v = this.value ?? this.min;
    return Math.min(1, Math.max(0, (v - this.min) / span));
  }

  /** Hexes due lit for the current value — `round(fraction × N)`. */
  private get targetLit(): number {
    const config = SIZE_CONFIG[this.size];
    const n = getRingCoords(config.firstRing, config.lastRing).length;
    return Math.round(this.fraction * n);
  }

  /** Hexes actually rendered lit. Trails `targetLit` on forward
   * progress — advancing exactly one hex per completed frontier
   * animation (see `handleFrontierAnimation`), so every hex
   * animates once before the next lights. */
  @state()
  private visualLit = 0;

  /** How the frontier animates: the parked 1.4s pulse loop, or the
   * quick one-shot ignite while the fill is catching up. Sticky for
   * the current frontier — re-evaluated only when the frontier
   * moves, never mid-animation. */
  @state()
  private frontierMode: "pulse" | "ignite" = "pulse";

  /** Duration of the current ignite, frozen when it starts —
   * recomputing mid-flight would rescale the running animation and
   * visibly jump it. */
  private igniteDurationMs = IGNITE_BASE_MS;

  /** Read once at connect; the ignite duration maths swaps to the
   * slower reduced pair when set (and ignores the linear-timing
   * estimator — calm choreography wins over rate-matching). */
  private reducedMotion = false;

  /** `timing="linear"` rate estimator: EMA of the interval per newly
   * due hex, sampled in `willUpdate` whenever the target advances.
   * Samples cap at the base duration so stalls can't poison the
   * average upward. */
  private estIntervalMs = IGNITE_BASE_MS;
  private prevTargetLit = 0;
  private lastAdvanceAt = 0;

  /** Per-hex ignite duration for the given backlog. `irregular`
   * spends the fixed base budget — quicker the deeper the queue;
   * `linear` spends the measured due-interval, locking the ripple
   * to the value's own pace. */
  private igniteDuration(backlog: number): number {
    if (this.reducedMotion) {
      return Math.max(
        IGNITE_REDUCED_MIN_MS,
        Math.round(IGNITE_REDUCED_BASE_MS / Math.max(1, backlog))
      );
    }
    const budget = this.timing === "linear" ? this.estIntervalMs : IGNITE_BASE_MS;
    return Math.max(IGNITE_MIN_MS, Math.round(budget / Math.max(1, backlog)));
  }

  /** Previous-update mode, so entering determinate renders the fill
   * directly instead of animating a catch-up from zero. */
  private wasDeterminate = false;

  override willUpdate(_changed: PropertyValues<this>): void {
    const determinate = this.isDeterminate;
    if (determinate) {
      const target = this.targetLit;
      // Sample the due-rate while the target advances — feeds the
      // `linear` pacing. Equal-weight EMA follows tempo changes in
      // a couple of steps without twitching on a single outlier.
      if (target > this.prevTargetLit) {
        const now = performance.now();
        if (this.lastAdvanceAt > 0) {
          const perHex = Math.min(
            (now - this.lastAdvanceAt) / (target - this.prevTargetLit),
            IGNITE_BASE_MS
          );
          this.estIntervalMs = this.estIntervalMs * 0.5 + perHex * 0.5;
        }
        this.lastAdvanceAt = now;
      }
      this.prevTargetLit = target;
      // Catch-up choreography covers forward progress only. Mode
      // entry paints the fill as-is; a regressing value snaps down;
      // and from empty there is no animating frontier to wait on —
      // without this the fill would deadlock at zero.
      if (!this.wasDeterminate || target < this.visualLit || this.visualLit === 0) {
        this.visualLit = target;
        this.frontierMode = "pulse";
      }
    }
    this.wasDeterminate = determinate;
  }

  /** The frontier finished an animation (a parked-pulse iteration
   * or a one-shot ignite) — the only moments the fill may advance.
   * One hex per completion: the next hex ignites if the fill is
   * still behind, or the frontier settles into the parked pulse. */
  private handleFrontierAnimation = (e: AnimationEvent): void => {
    const isOurs = e.animationName === "hp-loader-pulse" || e.animationName === "hp-loader-ignite";
    if (!this.isDeterminate || !isOurs) {
      return;
    }
    if (this.targetLit > this.visualLit) {
      this.visualLit += 1;
      // Every newly lit hex grows in — the last due one included;
      // it parks into the pulse when its own ignite completes.
      this.frontierMode = "ignite";
      this.igniteDurationMs = this.igniteDuration(this.targetLit - this.visualLit);
    } else if (this.frontierMode === "ignite") {
      // Ignite finished with nothing due — park into the pulse loop.
      this.frontierMode = "pulse";
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "progressbar");
    }
    if (!this.hasAttribute("aria-label")) {
      this.setAttribute("aria-label", "Loading");
    }
    this.syncAria();
  }

  override updated(changed: Map<string, unknown>): void {
    if (
      changed.has("value") ||
      changed.has("min") ||
      changed.has("max") ||
      changed.has("indeterminate")
    ) {
      this.syncAria();
    }
  }

  private syncAria(): void {
    this.setAttribute("aria-valuemin", String(this.min));
    this.setAttribute("aria-valuemax", String(this.max));
    if (this.isDeterminate) {
      const v = Math.min(this.max, Math.max(this.min, this.value ?? this.min));
      this.setAttribute("aria-valuenow", String(v));
    } else {
      this.removeAttribute("aria-valuenow");
    }
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
        --hp-stroke-color: var(--hp-primary);
        width: 40px;
        height: 40px;
      }

      :host([size="md"]) {
        width: 96px;
        height: 96px;
      }

      :host([size="lg"]) {
        width: 200px;
        height: 200px;
      }

      :host([tone="positive"]) {
        --hp-stroke-color: var(--hp-secondary);
      }
      :host([tone="warn"]) {
        --hp-stroke-color: var(--hp-warn);
      }
      :host([tone="alert"]) {
        --hp-stroke-color: var(--hp-alert);
      }
      :host([tone="error"]) {
        --hp-stroke-color: var(--hp-error);
      }

      svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      polygon {
        fill: var(--hp-stroke-color);
        transform-box: fill-box;
        transform-origin: center;
      }

      .wave,
      .frontier {
        animation: hp-loader-pulse 1.4s ease-in-out infinite;
      }

      /* Catch-up ignite: the frontier's one-shot while the fill is
 * behind the value — one hex per shot. A one-way grow from the
 * faint not-progress state into the lit progress state; never
 * an oscillation, so lit-ness only ever increases. */
      .ignite {
        animation: hp-loader-ignite 0.35s ease-out;
      }

      /* Not-yet-reached hexes stay faint so the whole cluster
 * silhouette reads as the track under the lit fill. */
      .unlit {
        opacity: 0.18;
      }

      /* Percentage label in the hollow centre (md / lg only — sm
 * has no hollow to hold it). Font-size is in viewBox units so
 * the label scales with the cluster. */
      .label {
        fill: var(--hp-stroke-color);
        font-family: var(--hp-typo-label-md-font-family, inherit);
        font-size: 11px;
        font-weight: 600;
      }

      @keyframes hp-loader-pulse {
        0%,
        100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(0.25);
          opacity: 0.4;
        }
      }

      @keyframes hp-loader-ignite {
        from {
          transform: scale(0.25);
          opacity: 0.18;
        }
        to {
          transform: scale(1);
          opacity: 1;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .wave,
        .frontier {
          animation-duration: 5s;
        }
      }
    `,
  ];

  override render() {
    const config = SIZE_CONFIG[this.size];
    const s = config.hexSize;
    const coords = getRingCoords(config.firstRing, config.lastRing);

    // Pointy-top axial → pixel: x = w·√3·(q + r/2), y = w·1.5·r where
    // w is the hex side length scaled by the gap multiplier.
    const cw = s * SQRT3 * config.gap;
    const ch = s * 1.5 * config.gap;

    // Animation cycle length matches the CSS keyframe duration.
    const cycle = 1.4;

    const determinate = this.isDeterminate;
    // Lit hexes count along the spiral order the coords already come
    // in — the fill winds inner ring → outer, the same path the
    // indeterminate wave travels. `visualLit` (not the raw value)
    // drives the split so forward progress lands at pulse boundaries.
    const lit = determinate ? Math.min(this.visualLit, coords.length) : 0;

    const polygons = coords.map((coord, idx) => {
      const cx = cw * (coord.q + coord.r / 2);
      const cy = ch * coord.r;
      const points = hexPolygonPoints(cx, cy, s);
      if (determinate) {
        // The frontier (last lit hex) animates — the parked pulse,
        // or the backlog-paced ignite while catching up; a full
        // cluster settles. Everything else holds steady.
        const frontier = idx === lit - 1 && lit < coords.length;
        const igniting = frontier && this.frontierMode === "ignite";
        const cls = idx < lit ? (frontier ? (igniting ? "ignite" : "frontier") : "lit") : "unlit";
        const style = igniting ? `animation-duration: ${this.igniteDurationMs}ms` : nothing;
        return svg`<polygon class=${cls} points=${points} style=${style}></polygon>`;
      }
      // Negative delays spread the hexes across the cycle on first
      // paint — all start mid-animation at their assigned phase.
      const delay = -(idx / coords.length) * cycle;
      return svg`<polygon class="wave" points=${points} style=${`animation-delay: ${delay.toFixed(3)}s`}></polygon>`;
    });

    // The hollow centre fits the label at md / lg; sm's cluster has
    // no hollow, so its value stays ARIA-only. Decorative here —
    // aria-valuenow carries the number for assistive tech.
    const label =
      determinate && this.size !== "sm"
        ? svg`<text
 class="label"
 x="0"
 y="0"
 text-anchor="middle"
 dominant-baseline="central"
 >${Math.round(this.fraction * 100)}%</text>`
        : "";

    // viewBox sized to fit the outermost ring's bbox: hex centres sit
    // at ±(lastRing × axial-step), each hex extends a further s in
    // either direction. Add a hair of padding for the scale-up phase.
    const pad = s * 0.1;
    const halfW = config.lastRing * cw + (s * SQRT3) / 2 + pad;
    const halfH = config.lastRing * ch + s + pad;

    return html`
      <svg
        viewBox=${`${-halfW} ${-halfH} ${halfW * 2} ${halfH * 2}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        @animationiteration=${determinate ? this.handleFrontierAnimation : nothing}
        @animationend=${determinate ? this.handleFrontierAnimation : nothing}
      >
        ${polygons} ${label}
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-loader": HpLoader;
  }
}
