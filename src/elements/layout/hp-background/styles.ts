/*
  ─ Shadow styles ─

  Host layout for both modes (contained + page), the canvas
  box, and the Option-C fallback presentation. The geometry
  invariants these rules encode are documented in geometry.ts.
*/

import { css } from "lit";

export const backgroundStyles = css`
  :host {
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
    overflow: hidden;
    /* contain: paint keeps the decorative painting isolated (canvas
     * can't leak outside the host) without the size containment that
     * contain: strict would impose — size containment suppressed
     * ResizeObserver from firing on ancestor-driven inset:0 size
     * changes (async content settling, fonts loading, hp-code
     * highlighting). */
    contain: paint;
    /* Both layers use full outline tokens, dialed by independent
     * opacities. The opacity dial lets us land between the system
     * outline rungs (--hp-outline-faint reads as nothing on common
     * backdrops; --hp-outline-variant reads as too present at 1.0).
     * Default 0.25 for the base sits the grid at "barely there, but
     * there"; 0.3 for the cursor halo keeps the brightening a soft
     * trail rather than a search-light. */
    --hp-bg-stroke: var(--hp-outline-variant);
    --hp-bg-stroke-bright: var(--hp-outline);
    --hp-bg-faint-opacity: 0.25;
    --hp-bg-bright-opacity: 0.3;
  }

  canvas {
    /* Canvas fills the host. The host is viewport-bounded in both
     * modes (fixed-viewport in page mode, bounded parent in
     * contained mode), so this is never an oversized canvas. The
     * backing-store resolution is reconciled per draw by
     * reconcileCanvasGeometry; these rules fix the on-screen box. */
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  /* Page-backdrop mode: host is fixed to the viewport, behind page
   * content. It never moves on scroll (the browser pins fixed
   * elements natively — no JS reposition for the software compositor
   * to lag on); the pattern scrolls via the uOffset uniform instead.
   * z-index keeps it behind foreground content in the same stacking
   * context; consumers can raise/lower via --hp-bg-z. Caveat: a
   * fixed host anchors to the nearest ancestor with a transform /
   * filter / contain, not the viewport — mount page mode directly
   * under body-level containers. */
  :host([page]) {
    position: fixed;
    inset: 0;
    z-index: var(--hp-bg-z, -1);
  }

  /* Static-tile fallback: WebGL2 unavailable, context lost, or
   * tier-2 software rendering (where the compositor displays WebGL
   * canvases unreliably — see the three-tier decision in the ADR).
   * The canvas hides; the host paints the stroke token as
   * background-color, masked into hex outlines by the SVG-data-URL
   * tile. Mask-not-background because a data-URL SVG can't see
   * currentColor (it would render black); with the mask the colour
   * rides the token cascade, so light/dark theme flips apply live.
   * Tile image + dimensions are written as inline custom properties
   * by applyFallbackTile so hex-size changes propagate. */
  :host([data-hp-fallback]) canvas {
    display: none;
  }

  :host([data-hp-fallback]) {
    opacity: var(--hp-bg-faint-opacity);
    background-color: var(--hp-bg-stroke);
    -webkit-mask-image: var(--hp-bg-fallback-image);
    mask-image: var(--hp-bg-fallback-image);
    -webkit-mask-repeat: repeat;
    mask-repeat: repeat;
    -webkit-mask-size: var(--hp-bg-tile-width) var(--hp-bg-tile-height);
    mask-size: var(--hp-bg-tile-width) var(--hp-bg-tile-height);
  }
`;
