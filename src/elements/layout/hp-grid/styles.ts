/**
 * Shadow-DOM CSS for `<hp-grid>`.
 *
 * Kept in its own module so the index can stay focused on element
 * wiring; the styles are large (the q/r → pixel transform plus the
 * viewport controls' chrome).
 */

import { css } from "lit";

import { ROW_STEP_FACTOR } from "./axial.js";

/**
 * Static `css` template assembled with the resolved `ROW_STEP_FACTOR`
 * baked into the `--hp-row-step` calc. Consumed as one entry of the
 * element's `static styles` array (combined with `hpBase`).
 */
export const hpGridStyles = css`
  :host {
    position: relative;
    display: block;
    width: 100%;
    min-height: 400px;
    overflow: hidden;
    cursor: grab;

    --hp-cell: var(--hp-hex-cell-sm);

    /* Effective cell width — reduced by the stroke so adjacent hexes
     * overlap exactly along their shared edge instead of producing
     * a double-thick line. */
    --hp-effective-cell: calc(var(--hp-cell) - var(--hp-hex-stroke));
    --hp-col-step: var(--hp-effective-cell);
    --hp-row-step: calc(var(--hp-effective-cell) * ${ROW_STEP_FACTOR});

    touch-action: none;
  }

  /* Surface tint laid as a translucent pseudo behind everything else
   * in the shadow tree. 75%-opaque --hp-surface lets whatever sits
   * behind the grid (the main hp-background, the page colour) show
   * through at 25%, so the canvas reads as a tinted recess rather
   * than an opaque block. Sits at the back of the stacking order
   * automatically — pseudo precedes the slot in shadow tree order. */
  :host::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--hp-surface);
    opacity: 0.75;
    pointer-events: none;
  }

  /* Slotted hp-background backdrop: dim the entire element so the
   * texture stays ambient on top of the tinted canvas surface. */
  ::slotted(hp-background) {
    opacity: 0.6;
  }

  :host([data-hp-panning]) {
    cursor: grabbing;
  }

  :host([size="md"]) {
    --hp-cell: var(--hp-hex-cell-md);
  }

  :host([size="lg"]) {
    --hp-cell: var(--hp-hex-cell-lg);
  }

  /* Each slotted child with both q and r positions itself via the
   * transform — origin is the grid's centre. The drag offset vars
   * default to 0 and only get set on the dragged child. The
   * transition animates the snap-into-slot when the drag ends
   * (data-hp-dragging is removed first, then drag-x/drag-y + q/r
   * change — the transition fires across that change). */
  ::slotted([q][r]) {
    position: absolute;
    left: 50%;
    top: 50%;
    translate: -50% -50%;
    /* Axial position is multiplied by --hp-zoom (defaults to 1) so
     * the canvas content scales as a unit; drag and pan are in
     * viewport pixels and added post-scale. The scale() after the
     * translate then visually resizes each hex. */
    transform: translate(
        calc(
          var(--hp-col-step) * (var(--hp-q, 0) + var(--hp-r, 0) / 2) * var(--hp-zoom, 1) +
            var(--hp-drag-x, 0px) + var(--hp-pan-x, 0px)
        ),
        calc(
          var(--hp-row-step) * var(--hp-r, 0) * var(--hp-zoom, 1) + var(--hp-drag-y, 0px) +
            var(--hp-pan-y, 0px)
        )
      )
      scale(var(--hp-zoom, 1));
    transition: transform var(--hp-unfold-trigger) var(--hp-ease-default);
    /* --hp-cursor crosses the shadow boundary because custom
     * properties cascade through it. Each draggable atom reads
     * cursor: var(--hp-cursor, pointer) on its own :host. */
    --hp-cursor: grab;
  }

  ::slotted([q][r][data-hp-dragging]) {
    z-index: var(--hp-layer-dragging);
    opacity: 0.85;
    --hp-cursor: grabbing;
    transition: none;
    /* GPU-composite the transform during the drag for smoother 60fps
     * tracking; cleared once data-hp-dragging is removed. */
    will-change: transform;
  }

  /* Hidden probe — read getBoundingClientRect to recover the resolved
   * pixel values of --hp-col-step and --hp-row-step. getComputedStyle
   * returns the raw calc() expression for custom properties, so
   * parseFloat can't recover the pixels directly. */
  .step-probe {
    position: absolute;
    top: 0;
    left: 0;
    width: var(--hp-col-step);
    height: var(--hp-row-step);
    visibility: hidden;
    pointer-events: none;
  }

  /* Viewport controls — bottom-right cluster of zoom-out / zoom-in /
   * recenter buttons. Always visible but at 60% opacity so they
   * don't compete with the content; full opacity on hover. */
  .controls {
    position: absolute;
    right: var(--hp-sm);
    bottom: var(--hp-sm);
    z-index: 1;
    display: flex;
    gap: var(--hp-xxs);
    opacity: 0.6;
    transition: opacity var(--hp-duration-fast) var(--hp-ease-default);
  }

  .controls:hover {
    opacity: 1;
  }

  .controls button {
    font: inherit;
    font-size: var(--hp-typo-label-sm-font-size);
    padding: 0 var(--hp-sm);
    background: var(--hp-surface-container);
    color: var(--hp-on-surface);
    border: 1px solid var(--hp-outline-variant);
    border-radius: var(--hp-rounded-sm);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    height: 2rem;
  }

  .controls button:hover {
    color: var(--hp-secondary);
  }

  .controls svg {
    width: 1rem;
    height: 1rem;
  }
`;
