/**
 * Shared types for the `<hp-grid>` element.
 *
 * Internal interfaces (`AxialCoord`, `DragState`, `PanState`) are not
 * exported from the package — they live here so the concern modules
 * (drag.ts, pan.ts, …) can share them without circular imports.
 * Event-detail interfaces (`HpGrid*EventDetail`) are re-exported from
 * the package root so consumers can type their `addEventListener`
 * handlers.
 */

/**
 * Axial-coordinate pair for a pointy-top hex grid.
 *
 * @property q - Axial column.
 * @property r - Axial row.
 */
export interface AxialCoord {
  q: number;
  r: number;
}

/**
 * Live drag tracking — set on pointerdown of a draggable `[q][r]`
 * child, cleared on pointerup / cancel.
 *
 * @property element - The dragged child.
 * @property pointerId - Pointer ID captured at drag start, used to
 *   ensure pointermove / pointerup belong to the same gesture.
 * @property origin - Viewport coords where the pointer first went
 *   down. Drag offset = current − origin.
 * @property startCoord - The element's axial position when the drag
 *   started, used to compute the candidate drop slot.
 */
export interface DragState {
  element: HTMLElement;
  pointerId: number;
  origin: { clientX: number; clientY: number };
  startCoord: AxialCoord;
}

/**
 * Live pan tracking — set on empty-space pointerdown, cleared on
 * pointerup / cancel. Canvas pan is a Figma/Miro-style camera move:
 * children stay at their axial coords, the grid's `--hp-pan-x` /
 * `--hp-pan-y` CSS vars shift the visual offset.
 *
 * @property pointerId - Pointer ID captured at pan start.
 * @property origin - Viewport coords where the pointer went down.
 * @property startPanX - `--hp-pan-x` value at pan start (px).
 * @property startPanY - `--hp-pan-y` value at pan start (px).
 */
export interface PanState {
  pointerId: number;
  origin: { clientX: number; clientY: number };
  startPanX: number;
  startPanY: number;
}

/**
 * `hp-grid-move` event payload — fires immediately on drop, before
 * the snap-back animation runs.
 *
 * @property element - The dropped child.
 * @property from - Axial position the drag started from.
 * @property to - Axial position the child landed on.
 */
export interface HpGridMoveEventDetail {
  element: HTMLElement;
  from: AxialCoord;
  to: AxialCoord;
}

/**
 * `hp-grid-bond` / `hp-grid-unbond` event payload — fires once per
 * bond gained or lost on a drop. A "bond" here is pure axial
 * adjacency on the q/r grid (two hexes sharing an edge). Use
 * `hp-grid-bond` to play in a `<hp-bond>` indicator or kick off
 * consumer-side bonded-group logic; use `hp-grid-unbond` to clean
 * up indicators that no longer apply.
 *
 * @property moved - The hex that was just dropped, driving the event.
 * @property partner - The neighbour on the other side of the bond.
 */
export interface HpGridBondEventDetail {
  moved: HTMLElement;
  partner: HTMLElement;
}

/**
 * `hp-grid-drop` event payload — fires once the post-drop snap
 * animation has fully settled on its target slot. Same shape as
 * `HpGridMoveEventDetail` so a single handler can serve both events.
 * Skipped on no-op drops (target equals start) and on cancelled
 * drags.
 */
export type HpGridDropEventDetail = HpGridMoveEventDetail;

/**
 * `hp-grid-pan` event payload — fires on every pointermove during a
 * canvas pan, carrying the current pan offset in pixels. Consumers
 * that derive viewport-relative geometry (e.g. `<hp-tether>`
 * recomputing its bezier endpoints) listen for this to stay in sync.
 *
 * @property panX - Current horizontal pan in px.
 * @property panY - Current vertical pan in px.
 */
export interface HpGridPanEventDetail {
  panX: number;
  panY: number;
}

/**
 * `hp-grid-tether` / `hp-grid-untether` event payload — fires on the
 * tetherable grid when a drag-to-tether interaction creates or
 * removes an arc between two hexes. For the untether event the
 * `tether` element is already detached from the DOM at this point;
 * the reference is provided so consumers can clean up linked state.
 *
 * @property source - The hex that initiated the drag-to-tether.
 * @property target - The hex the drag landed on.
 * @property tether - The `<hp-tether>` element created or removed.
 */
export interface HpGridTetherEventDetail {
  source: HTMLElement;
  target: HTMLElement;
  tether: HTMLElement;
}
