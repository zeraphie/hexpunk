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

  /* CSS-tile fallback: WebGL2 unavailable, context lost, or tier-2
   * software rendering (where the compositor displays WebGL canvases
   * unreliably — see the three-tier decision in the ADR). The canvas
   * hides and two pseudo-element layers recreate the v1 two-SVG
   * effect: a faint base layer, and a bright layer revealed in a
   * radial window around the pointer. Both paint the stroke token as
   * background-color masked into hex outlines by the SVG-data-URL
   * tile. Mask-not-background because a data-URL SVG can't see
   * currentColor (it would render black); with the mask the colour
   * rides the token cascade, so light/dark theme flips apply live.
   *
   * The layers MUST be pseudo-elements, not the host: mask and
   * opacity are group effects — a mask or opacity on the host would
   * clip and dim everything it paints, capping the bright layer at
   * the faint layer's opacity. The host itself paints nothing.
   *
   * Tile image + dimensions + pointer radius are written as inline
   * custom properties by applyFallbackTile; the pointer position
   * arrives as inline properties per pointermove (input data, not
   * visual state — same contract as the original SVG version). */
  :host([data-hp-fallback]) canvas {
    display: none;
  }

  :host([data-hp-fallback])::before,
  :host([data-hp-fallback])::after {
    content: "";
    position: absolute;
    inset: 0;
    -webkit-mask-repeat: repeat;
    mask-repeat: repeat;
  }

  :host([data-hp-fallback])::before {
    background-color: var(--hp-bg-stroke);
    opacity: var(--hp-bg-faint-opacity);
    -webkit-mask-image: var(--hp-bg-fallback-image);
    mask-image: var(--hp-bg-fallback-image);
    -webkit-mask-size: var(--hp-bg-tile-width) var(--hp-bg-tile-height);
    mask-size: var(--hp-bg-tile-width) var(--hp-bg-tile-height);
  }

  /* Bright layer: the tile mask intersected with a radial window at
   * the pointer. Off-screen default coords keep it invisible until
   * the first pointermove. */
  :host([data-hp-fallback])::after {
    background-color: var(--hp-bg-stroke-bright);
    opacity: var(--hp-bg-bright-opacity);
    -webkit-mask-image:
      radial-gradient(
        circle var(--hp-bg-pointer-radius, 200px) at var(--hp-bg-x, -9999px) var(--hp-bg-y, -9999px),
        black 0%,
        transparent 100%
      ),
      var(--hp-bg-fallback-image);
    mask-image:
      radial-gradient(
        circle var(--hp-bg-pointer-radius, 200px) at var(--hp-bg-x, -9999px) var(--hp-bg-y, -9999px),
        black 0%,
        transparent 100%
      ),
      var(--hp-bg-fallback-image);
    -webkit-mask-size:
      auto,
      var(--hp-bg-tile-width) var(--hp-bg-tile-height);
    mask-size:
      auto,
      var(--hp-bg-tile-width) var(--hp-bg-tile-height);
    -webkit-mask-repeat: no-repeat, repeat;
    mask-repeat: no-repeat, repeat;
    -webkit-mask-composite: source-in;
    mask-composite: intersect;
  }

  /* Pointer-following brightness is a motion cue; suppress it for
   * users who opted out. The faint layer still renders — same
   * contract as the GL halo under reduced motion. */
  @media (prefers-reduced-motion: reduce) {
    :host([data-hp-fallback])::after {
      display: none;
    }
  }
`;
