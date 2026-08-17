/*
  ─ Canvas grid styles ─

  The host is a viewport: a fixed-footprint window onto a hex
  world, not a box that grows with content. The engine's canvas
  paints the field; slotted cells live in an absolutely-positioned
  overlay layer that rides the camera through one transform per
  frame, so the two surfaces can never swim apart.
*/
import { css } from "lit";

export const hpGridStyles = css`
  :host {
    position: relative;
    display: block;
    width: 100%;
    min-height: 400px;
    overflow: hidden;
    cursor: grab;
    /* The viewport owns touch input the way it owns the wheel —
     * panning a world and scrolling a page cannot share a finger. */
    touch-action: none;
  }

  /* A flow-embedded surface hands the pointer back to the page. */
  :host([pannable="false"]) {
    cursor: default;
    touch-action: auto;
  }

  /* Surface tint laid behind the canvas. 75%-opaque --hp-surface
   * lets whatever sits behind the grid show through at 25%, so the
   * viewport reads as a tinted recess rather than an opaque block. */
  :host::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--hp-surface);
    opacity: 0.75;
    pointer-events: none;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  /* The camera-synced layer. Its transform is written by the engine
   * every frame; cells inside lay out in world units at scale 1. */
  .overlay {
    position: absolute;
    left: 0;
    top: 0;
  }

  /* Cells are placed at world coordinates and centred on their
   * point — the same applier contract as hp-layout, so positioning
   * behaviour is shared code, not a parallel implementation. The
   * transition animates the settle when a drag releases. */
  ::slotted([q][r]) {
    position: absolute;
    left: 0;
    top: 0;
    translate: -50% -50%;
    transform: translate(var(--hp-x, 0px), var(--hp-y, 0px));
    transition: transform var(--hp-unfold-trigger) var(--hp-ease-default);
  }

  :host([draggable]) ::slotted([q][r]) {
    --hp-cursor: grab;
  }

  ::slotted([q][r][data-hp-dragging]) {
    z-index: var(--hp-layer-dragging);
    opacity: 0.85;
    --hp-cursor: grabbing;
    /* No transition while the pointer owns the position, or every
     * move would lag a frame behind the cursor. */
    transition: none;
  }

  /* Tether children are declarative data for the canvas arcs, not
   * rendered elements. */
  ::slotted(hp-tether) {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    ::slotted([q][r]) {
      transition: none;
    }
  }
`;
