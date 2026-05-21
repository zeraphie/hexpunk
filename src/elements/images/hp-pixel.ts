// hp-pixel.ts — Box-shadow pixel-art atom.
//
// Renders pixel art as a single CSS box-shadow: the host element holds
// a tiny "anchor" pixel and every pixel of the art is a shadow entry
// offset from it. Crisp at any size, animatable via box-shadow
// transitions, no SVG or canvas required.
//
// Three modes, chosen by which prop is set (precedence: states > art):
//
// 1. **Static** — `.art` is an ASCII string (`#` = lit, `.` = empty).
// 2. **State morph** — `.states` is a record of named position arrays
// (e.g. `{ idle: [[x,y]…], hover: [[x,y]…] }`). The shadow string
// is computed per state and smoothly interpolated between them via
// CSS `transition: box-shadow`.
// 3. **Sprite-sheet frames** — `.frames` array, `steps()` animation.
// *Not yet implemented* — coming when the first real consumer needs
// a loader animation.
//
// `interactive` (boolean attribute) wires the system's standard
// engagement states — `:hover` / `:focus-visible` / `:active` /
// `[aria-pressed="true"]` — to the matching named states in `.states`,
// with no JS state-flip required. Mirrors the CSS-driven hover pattern
// from the CodePen reference.
//
// `palette` is an optional array of CSS colours; digits in the ASCII
// art (or the third element of a position tuple) index into it. When
// omitted, every pixel uses `currentColor` so the art inherits its
// parent's text colour.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { PropertyValues } from "lit";

import { hpBase } from "../../styles/hp-base.js";

/** Pixel position — `[x, y]` in pixel-grid units (centred on `0,0`),
 * with an optional palette index as the third element. */
export type HpPixelPosition = [x: number, y: number, colorIndex?: number];

export type HpPixelStates = Record<string, HpPixelPosition[]>;

// ── ASCII art parser ───────────────────────────────────────────────

/** Parse an ASCII grid into a list of `[x, y, colorIndex?]` positions
 * centred on `(0, 0)`. `#` is a lit pixel using `currentColor`;
 * digits `1`–`9` index into an optional palette; `.` and spaces are
 * empty cells. */
function parseAsciiArt(art: string): HpPixelPosition[] {
  const rows = art.replace(/^\n+|\n+$/g, "").split("\n");
  const height = rows.length;
  const width = Math.max(0, ...rows.map((r) => r.length));
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const positions: HpPixelPosition[] = [];

  for (let r = 0; r < height; r++) {
    const row = rows[r];
    if (!row) {
      continue;
    }
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === "." || ch === " ") {
        continue;
      }
      const x = c - cx;
      const y = r - cy;
      if (ch && /^[1-9]$/.test(ch)) {
        positions.push([x, y, Number.parseInt(ch, 10) - 1]);
      } else {
        positions.push([x, y]);
      }
    }
  }

  return positions;
}

// ── Box-shadow generator ───────────────────────────────────────────

function shadowFor(positions: HpPixelPosition[], pixelSize: number, palette?: string[]): string {
  if (positions.length === 0) {
    return "none";
  }
  return positions
    .map(([x, y, colorIndex]) => {
      const color =
        palette && colorIndex !== undefined && palette[colorIndex] !== undefined
          ? palette[colorIndex]
          : "currentColor";
      return `${x * pixelSize}px ${y * pixelSize}px 0 0 ${color}`;
    })
    .join(", ");
}

function bboxFor(positionGroups: HpPixelPosition[][]): {
  width: number;
  height: number;
} {
  let maxX = 0;
  let maxY = 0;
  for (const group of positionGroups) {
    for (const [x, y] of group) {
      const ax = Math.abs(x);
      const ay = Math.abs(y);
      if (ax > maxX) {
        maxX = ax;
      }
      if (ay > maxY) {
        maxY = ay;
      }
    }
  }
  return { width: maxX * 2 + 1, height: maxY * 2 + 1 };
}

// ── Component ──────────────────────────────────────────────────────

/**
 * Pixel-art renderer. Draws a sequence of states (each a list of
 * [x, y, paletteIndex] pixels) on a fixed hex-clipped canvas;
 * configurable palette and per-state delay drive a sprite-like
 * animation loop.
 */
@customElement("hp-pixel")
export class HpPixel extends LitElement {
  /** Static ASCII grid. `#` = lit, `.` = empty, digits index into `palette`. */
  @property() art?: string;

  /** Named position-set states. All states must have the same length. */
  @property({ attribute: false }) states?: HpPixelStates;

  /** Current state when `.states` is set. Falls back to `"idle"`. */
  @property({ reflect: true }) state?: string;

  /** Optional palette for multi-colour pixels. Indices come from
   * digits in ASCII art or the third element of a position tuple. */
  @property({ attribute: false }) palette?: string[];

  /** Pixel size in CSS px. Default `3`. */
  @property({ attribute: "pixel-size", type: Number }) pixelSize = 3;

  /** Auto-swap to `hover` / `focus` / `active` named states on the
   * matching pseudo-classes. No JS state-flip required. */
  @property({ type: Boolean, reflect: true }) interactive = false;

  static override styles = [
    hpBase,
    css`
      :host {
        position: relative;
        display: inline-block;
        color: currentColor;
        line-height: 0;

        /* Default shadow chain — overridden by interactive variants below
 * and by JS-set --hp-pixel-shadow when consumer flips the state attribute. */
        --hp-pixel-shadow: var(--hp-pixel-idle, none);
      }

      :host([interactive]) {
        cursor: var(--hp-cursor, pointer);
      }

      /* Interactive engagement — swaps the shadow to matching state vars
 * when the consumer sets the interactive attribute. Cascading
 * fallbacks ensure missing states gracefully degrade. */
      :host([interactive]:hover) {
        --hp-pixel-shadow: var(--hp-pixel-hover, var(--hp-pixel-idle));
      }

      :host([interactive]:focus-visible) {
        --hp-pixel-shadow: var(--hp-pixel-focus, var(--hp-pixel-hover, var(--hp-pixel-idle)));
      }

      :host([interactive]:active),
      :host([interactive][aria-pressed="true"]) {
        --hp-pixel-shadow: var(--hp-pixel-active, var(--hp-pixel-hover, var(--hp-pixel-idle)));
      }

      .canvas {
        position: absolute;
        left: 50%;
        top: 50%;
        width: var(--hp-pixel-size, 3px);
        height: var(--hp-pixel-size, 3px);
        transform: translate(-50%, -50%);
        background: transparent;
        box-shadow: var(--hp-pixel-shadow);
        transition: box-shadow var(--hp-duration-medium) var(--hp-ease-default);
      }
    `,
  ];

  override willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has("art") ||
      changed.has("states") ||
      changed.has("state") ||
      changed.has("pixelSize") ||
      changed.has("palette")
    ) {
      this.recompute();
    }
  }

  private recompute(): void {
    const pixelSize = this.pixelSize;
    this.style.setProperty("--hp-pixel-size", `${pixelSize}px`);

    if (this.states) {
      this.applyStates(this.states, pixelSize);
    } else if (this.art) {
      this.applyStaticArt(this.art, pixelSize);
    } else {
      this.style.setProperty("--hp-pixel-shadow", "none");
    }
  }

  private applyStates(states: HpPixelStates, pixelSize: number): void {
    const lengths = new Set(Object.values(states).map((s) => s.length));
    if (lengths.size > 1) {
      console.warn("hp-pixel: all states must have the same length for smooth morphing");
    }

    for (const [name, positions] of Object.entries(states)) {
      this.style.setProperty(`--hp-pixel-${name}`, shadowFor(positions, pixelSize, this.palette));
    }

    // When `state` is set explicitly AND we're not in interactive mode,
    // pin `--hp-pixel-shadow` to that state. Otherwise remove the inline
    // override so the :host([interactive]:hover/...) CSS rules can swap
    // the shadow based on pointer/focus state — inline style would beat
    // those rules and lock the pixel art to a single frame.
    if (this.state && !this.interactive) {
      this.style.setProperty("--hp-pixel-shadow", `var(--hp-pixel-${this.state})`);
    } else {
      this.style.removeProperty("--hp-pixel-shadow");
    }

    this.applyHostSize(Object.values(states), pixelSize);
  }

  private applyStaticArt(art: string, pixelSize: number): void {
    const positions = parseAsciiArt(art);
    this.style.setProperty("--hp-pixel-shadow", shadowFor(positions, pixelSize, this.palette));
    this.applyHostSize([positions], pixelSize);
  }

  private applyHostSize(groups: HpPixelPosition[][], pixelSize: number): void {
    const { width, height } = bboxFor(groups);
    this.style.width = `${width * pixelSize}px`;
    this.style.height = `${height * pixelSize}px`;
  }

  override render() {
    return html`<div class="canvas" part="canvas"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-pixel": HpPixel;
  }
}
