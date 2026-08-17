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
    /* Measured from the placed content so the element occupies real
     * space in flow. Falls back to nothing until first placement. */
    inline-size: var(--hp-layout-width, auto);
    block-size: var(--hp-layout-height, auto);
  }

  /* rows wraps at the element's own width, so the element must take
   * the room it's given rather than sizing to content — the way a
   * flex container fills its line. 100% rather than auto because a
   * flex parent (hp-demo's preview is one) would shrink-wrap an auto
   * width back to the content, leaving nothing to wrap at. Height
   * still comes from the measured content. */
  :host([layout="rows"]) {
    inline-size: 100%;
  }

  /* hp-base already gives the host the xxs / xs cell widths (and the
   * per-tier stroke for every tier); only md and lg need adding, since
   * those live on the atoms rather than the base. The host's own
   * --hp-cell is the pitch source for an empty surface — once there
   * are children, their rendered width is what the lattice follows. */
  :host([size="md"]) {
    --hp-cell: var(--hp-hex-cell-md);
  }

  :host([size="lg"]) {
    --hp-cell: var(--hp-hex-cell-lg);
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
