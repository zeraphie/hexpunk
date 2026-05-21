// hp-spinner.ts — Hexagonal-cluster spinner.
//
// A cluster of small filled hexes arranged in concentric rings with
// a hollow middle. Each hex scales between 1 and ~0.25 on a loop;
// per-hex animation-delay traces a clockwise spiral so the cluster
// reads as a rotating spiral wave rather than a uniform pulse.
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

import { LitElement, css, html, svg } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

export type HpSpinnerTone = "neutral" | "positive" | "warn" | "alert" | "error";

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

/**
 * Hexagonal-cluster spinner. A hollow cluster of small filled hexes
 * pulsing in a clockwise spiral. role="status" with
 * aria-label="Loading" by default.
 */
@customElement("hp-spinner")
export class HpSpinner extends LitElement {
  /** Cluster size — `sm` (7 hexes inline), `md` (19 hexes default),
   * `lg` (37 hexes full-page). */
  @property({ reflect: true })
  size: "sm" | "md" | "lg" = "md";

  /** Semantic tone. Default `neutral` reads as --hp-primary ("system
   * busy"); others map to the matching tone stroke. */
  @property({ reflect: true })
  tone: HpSpinnerTone = "neutral";

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "status");
    }
    if (!this.hasAttribute("aria-label")) {
      this.setAttribute("aria-label", "Loading");
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
        animation: hp-spinner-pulse 1.4s ease-in-out infinite;
      }

      @keyframes hp-spinner-pulse {
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

      @media (prefers-reduced-motion: reduce) {
        polygon {
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

    const polygons = coords.map((coord, idx) => {
      const cx = cw * (coord.q + coord.r / 2);
      const cy = ch * coord.r;
      const points = hexPolygonPoints(cx, cy, s);
      // Negative delays spread the hexes across the cycle on first
      // paint — all start mid-animation at their assigned phase.
      const delay = -(idx / coords.length) * cycle;
      return svg`<polygon points=${points} style=${`animation-delay: ${delay.toFixed(3)}s`}></polygon>`;
    });

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
      >
        ${polygons}
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-spinner": HpSpinner;
  }
}
