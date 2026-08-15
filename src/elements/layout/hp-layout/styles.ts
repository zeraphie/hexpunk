/*
  ─ Layout surface styles ─

  A hex analogue of a flex container: it sizes to its content and
  sits in document flow, so the page scrolls it rather than the
  element panning itself. Children are placed absolutely because
  the lattice interleaves rows, but the host reports the content
  box so surrounding layout still works.
*/
import { css } from "lit";

export const hpLayoutStyles = css`
  :host {
    position: relative;
    display: block;
    /* The lattice pitch is one stroke narrower than the cell, so
     * neighbouring hexes overlap by exactly their stroke width and
     * share a single edge instead of drawing two side by side. Same
     * correction hp-cluster applies internally. */
    --hp-effective-cell: calc(var(--hp-cell, var(--hp-hex-cell-sm)) - var(--hp-hex-stroke));
    --hp-col-step: var(--hp-effective-cell);
    --hp-row-step: calc(var(--hp-effective-cell) * 0.8660254);
    /* Measured from the placed content so the element occupies real
     * space in flow. Falls back to nothing until first placement. */
    inline-size: var(--hp-layout-width, auto);
    block-size: var(--hp-layout-height, auto);
  }

  /* Children are placed in CSS pixels from the content's top-left and
   * centred on their point. The transition animates the settle when a
   * drag releases. */
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
    touch-action: none;
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
