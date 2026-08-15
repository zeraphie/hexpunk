/*
  ─ Layout surface styles ─

  One transformed world container carries the camera; each child
  carries only its own world position. That split is deliberate —
  it is the same model the canvas grid uses, so pan, zoom and
  drag resolve identically in both and the CSS never re-derives
  axial maths.
*/
import { css } from "lit";

export const hpLayoutStyles = css`
  :host {
    position: relative;
    display: block;
    overflow: hidden;
    /* Cell width drives the whole lattice; consumers override it
     * per instance. Falls back to the small cell tier. */
    --hp-effective-cell: var(--hp-cell, var(--hp-hex-cell-sm));
  }

  :host([draggable]) {
    touch-action: none;
  }

  /* The camera lives here: one transform write per frame instead of
   * one per child, so a hundred cells cost the same as one. */
  .world {
    position: absolute;
    inset: 0;
    transform-origin: 0 0;
    will-change: transform;
  }

  /* Children are placed in world units and centred on their point.
   * The transition animates the settle when a drag releases. */
  ::slotted([q][r]) {
    position: absolute;
    left: 0;
    top: 0;
    translate: -50% -50%;
    transform: translate(var(--hp-x, 0px), var(--hp-y, 0px));
    transition: transform var(--hp-unfold-trigger) var(--hp-ease-default);
  }

  :host([draggable]) ::slotted([q][r]) {
    /* Custom properties cross the shadow boundary, so each atom
     * reads cursor: var(--hp-cursor) on its own :host. */
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

  /* Decorative backdrops opt out of placement entirely. */
  ::slotted(hp-background) {
    position: absolute;
    inset: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    ::slotted([q][r]) {
      transition: none;
    }
  }
`;
