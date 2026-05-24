/**
 * Drag controller for `<hp-grid>`.
 *
 * Owns the full drag pipeline for `[q][r]` children: per-cell drag
 * eligibility, drag-handle gating, capture lifecycle, pointer-event
 * routing, the cursor → axial slot snap, BFS-to-nearest-free-slot
 * resolution, the bond diff that fires `hp-grid-bond` / `unbond` on
 * each move, and the tetherable-mode toggle path that swaps a drop
 * for an `<hp-tether>` arc.
 *
 * Empty-space pointerdowns are delegated to `host.panController` so
 * the grid acts as a Miro/Figma camera; only pointerdowns that land
 * on (or inside) a `[q][r]` child start a drag here.
 *
 * The bond and tether logic still lives in this file for now — the
 * follow-on refactor extracts them into `bonds.ts` and `tether.ts`
 * once the drag scaffolding is in its own module. Keeping them
 * inlined here for this commit avoids cross-module event ordering
 * bugs during the split.
 */

import { axialNeighbours, slotKey } from "./axial.js";
import type { PanController } from "./pan.js";
import type {
  AxialCoord,
  DragState,
  HpGridBondEventDetail,
  HpGridDropEventDetail,
  HpGridMoveEventDetail,
  HpGridTetherEventDetail,
} from "./types.js";

/**
 * Subset of `HpGrid` the drag controller reads / mutates. Narrowed
 * to keep the cross-concern coupling explicit.
 */
export interface DragHost extends HTMLElement {
  /** Current zoom factor — drag deltas are inverse-projected through
   * the same scaling the slotted-child transform applies. */
  readonly zoom: number;
  /** Surface-wide drag flag. Per-cell `draggable` attribute overrides
   * this on individual children (see `isCellDraggable`). */
  readonly draggable: boolean;
  /** Whether drops on other hexes toggle `<hp-tether>` arcs instead
   * of BFS-snapping to a free slot. */
  readonly tetherable: boolean;
  /** Live occupancy map (`"q,r"` → element). The drag controller
   * mutates this on every successful move. */
  readonly occupancy: Map<string, HTMLElement>;
  /** Pan controller — used to route empty-space pointerdowns. */
  readonly panController: PanController;
  /** Resolves `--hp-col-step` / `--hp-row-step` to numeric pixels. */
  computeStyleSteps(): { col: number; row: number };
}

/**
 * Per-cell drag eligibility. The `draggable` attribute on a `[q][r]`
 * child wins over the grid-wide default: `draggable="false"` blocks
 * even when the grid is draggable; any other presence opts the cell
 * in regardless of the grid default.
 *
 * @param cell - The `[q][r]` child.
 * @param gridDefault - The grid's surface-wide `draggable` flag.
 * @returns `true` if this cell is draggable.
 */
function isCellDraggable(cell: HTMLElement, gridDefault: boolean): boolean {
  const attr = cell.getAttribute("draggable");
  if (attr === "false") {
    return false;
  }
  if (attr !== null) {
    return true;
  }
  return gridDefault;
}

/**
 * Inverse-project a viewport-pixel drag offset onto axial coords +
 * round to the nearest slot.
 *
 * @param dx - Pointer offset since drag start (px).
 * @param dy - Pointer offset since drag start (px).
 * @param start - Axial position the drag started at.
 * @param steps - Resolved pixel step sizes (zoom-adjusted by caller).
 * @returns Nearest axial slot to the cursor.
 */
function snapToSlot(
  dx: number,
  dy: number,
  start: AxialCoord,
  steps: { col: number; row: number }
): AxialCoord {
  // Inverse of:
  //   x = col * (q + r/2)
  //   y = row * r
  const dr = dy / steps.row;
  const dq = dx / steps.col - dr / 2;
  return {
    q: Math.round(start.q + dq),
    r: Math.round(start.r + dr),
  };
}

/**
 * Build the CSS selector that `<hp-tether>`'s `from` / `to`
 * attributes need. Prefers the existing `id` (consumer-authored or
 * the grid's own auto-assigned one), else falls back to the
 * `data-hp-grid-id` stamped at slotchange.
 *
 * @returns Selector string, or `null` if neither id source exists.
 */
function tetherSelectorFor(el: HTMLElement): string | null {
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }
  const gid = el.dataset.hpGridId;
  if (gid) {
    return `[data-hp-grid-id="${gid}"]`;
  }
  return null;
}

/**
 * Find an existing `<hp-tether>` child of `host` whose `from` / `to`
 * pair matches `a` / `b` in either direction. Used by the tetherable
 * toggle: matching pair means we remove instead of create.
 */
function findTetherBetween(
  host: DragHost,
  a: string,
  b: string
): HTMLElement | null {
  const tethers = host.querySelectorAll<HTMLElement>("hp-tether");
  for (const tether of tethers) {
    const from = tether.getAttribute("from");
    const to = tether.getAttribute("to");
    if ((from === a && to === b) || (from === b && to === a)) {
      return tether;
    }
  }
  return null;
}

/**
 * Owns the active drag gesture and the post-drop choreography. One
 * instance per grid; lives for the element's lifetime.
 */
export class DragController {
  private state: DragState | null = null;
  /** While dragging in tetherable mode, the sibling `[q][r]`
   * currently under the cursor (so it can paint a target highlight
   * via `data-hp-tether-target`). */
  private currentTetherTarget: HTMLElement | null = null;

  /**
   * @param host - The grid element. Drag start / cancel hooks fire on
   *   the host; per-child pointer listeners get attached to the
   *   dragged element so capture stays correct even if the pointer
   *   exits the grid bbox.
   */
  constructor(private readonly host: DragHost) {}

  /**
   * Bound pointerdown handler. Empty-space pointerdowns route to the
   * pan controller; pointerdowns on a `[q][r]` child (subject to
   * `draggable` and `drag-handle` gating) start a drag.
   */
  readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    const target = (event.target as Element).closest<HTMLElement>("[q][r]");
    if (!target || !this.host.contains(target)) {
      // Empty-space pointerdown → start panning the canvas. The grid
      // itself acts like a Miro/Figma viewport: hexes stay at their
      // q/r coords, the visible offset shifts via --hp-pan-x/y.
      // Only when drag/pan is enabled — a static grid ignores empty
      // pointerdowns so layout surfaces don't accidentally pan.
      if (this.host.draggable) {
        this.host.panController.start(event);
      }
      return;
    }

    // Drag eligibility per cell: explicit `draggable="false"` blocks
    // even when the grid is draggable; explicit `draggable` (presence,
    // any value other than "false") overrides the grid default. With
    // no attribute, falls through to the grid's own draggable state.
    if (!isCellDraggable(target, this.host.draggable)) {
      return;
    }

    // Drag-handle gating: if the [q][r] child declares a
    // `drag-handle` attribute (CSS selector), only initiate drag
    // when the pointerdown originated inside the cluster's specific
    // handle element. Lets a composite like <hp-cluster> expose its
    // centre hex as the sole grip while its outer slots are inert.
    //
    // Resolves the handle via `target.querySelector()` rather than
    // `closest()` from event.target — closest() with `:first-child`
    // matches ANY first-child ancestor (e.g., the hp-cell inside an
    // <a class="component-link"><hp-cell></hp-cell></a> wrapper is
    // its own parent's first child, so closest() returns it and the
    // gate passes incorrectly). querySelector() returns the first
    // matching descendant of the cluster in DOM order — the cluster's
    // actual centre — and we check whether the pointerdown landed on
    // that specific element or one of its descendants.
    //
    // Pointerdown outside the handle does NOT start a canvas pan —
    // outer cells are typically navigation links, and pan would steal
    // the click. The event falls through so the link handles its own
    // click.
    const handleSelector = target.getAttribute("drag-handle");
    if (handleSelector) {
      const handleEl = target.querySelector(handleSelector);
      const evtTarget = event.target as Node;
      if (!handleEl || (handleEl !== evtTarget && !handleEl.contains(evtTarget))) {
        return;
      }
    }

    const q = Number.parseFloat(target.getAttribute("q") ?? "0");
    const r = Number.parseFloat(target.getAttribute("r") ?? "0");
    if (Number.isNaN(q) || Number.isNaN(r)) {
      return;
    }

    target.setPointerCapture(event.pointerId);
    target.setAttribute("data-hp-dragging", "");
    target.style.setProperty("--hp-drag-x", "0px");
    target.style.setProperty("--hp-drag-y", "0px");

    this.state = {
      element: target,
      pointerId: event.pointerId,
      origin: { clientX: event.clientX, clientY: event.clientY },
      startCoord: { q, r },
    };

    target.addEventListener("pointermove", this.handleMove);
    target.addEventListener("pointerup", this.handleUp);
    target.addEventListener("pointercancel", this.handleCancel);
    event.preventDefault();
  };

  /**
   * Abort an in-flight drag (e.g. on disconnect). Resets the
   * dragging cell's transform back to its origin slot via the same
   * cleanup the normal finish path uses.
   */
  cancel(): void {
    if (!this.state) {
      return;
    }
    const { element, pointerId } = this.state;
    // Match finishDrag's ordering — dragging attribute first, then the
    // offset reset so the transform animates back to origin.
    element.removeAttribute("data-hp-dragging");
    element.style.removeProperty("--hp-drag-x");
    element.style.removeProperty("--hp-drag-y");
    this.clearTetherTarget();
    this.cleanup(element, pointerId);
  }

  private readonly handleMove = (event: PointerEvent): void => {
    if (!this.state || event.pointerId !== this.state.pointerId) {
      return;
    }
    const dx = event.clientX - this.state.origin.clientX;
    const dy = event.clientY - this.state.origin.clientY;
    this.state.element.style.setProperty("--hp-drag-x", `${dx}px`);
    this.state.element.style.setProperty("--hp-drag-y", `${dy}px`);

    // In tetherable mode, highlight whichever sibling [q][r] the
    // dragged hex currently overlaps so consumers / CSS can paint
    // a "potential tether target" cue (hp-base reacts to
    // data-hp-tether-target the same way hp-cluster reacts to
    // data-hp-dragging). The element under the cursor is found via
    // elementsFromPoint (the dragged hex itself is one of the hits,
    // so we skip the first matching [q][r] that IS the source).
    if (this.host.tetherable) {
      this.updateTetherTarget(event.clientX, event.clientY);
    }
  };

  private readonly handleUp = (event: PointerEvent): void => {
    if (!this.state || event.pointerId !== this.state.pointerId) {
      return;
    }
    const dx = event.clientX - this.state.origin.clientX;
    const dy = event.clientY - this.state.origin.clientY;
    this.finish(dx, dy);
  };

  private readonly handleCancel = (event: PointerEvent): void => {
    if (!this.state || event.pointerId !== this.state.pointerId) {
      return;
    }
    this.finish(0, 0);
  };

  /**
   * Resolve a pointerup drag offset to a target axial slot, then
   * either snap the dragged hex into the nearest free slot (regular
   * mode) or toggle an `<hp-tether>` arc to the dropped-on hex
   * (tetherable mode + drop landed on another hex).
   *
   * Fires `hp-grid-move` on a successful move, `hp-grid-bond` /
   * `hp-grid-unbond` for any adjacency that changed, and
   * `hp-grid-drop` once the 90ms snap animation completes.
   */
  private finish(dx: number, dy: number): void {
    if (!this.state) {
      return;
    }
    const { element, startCoord, pointerId } = this.state;

    const rawSteps = this.host.computeStyleSteps();
    // The cursor delta is in viewport pixels; axial steps need to be
    // scaled by current zoom so a 1-axial-unit drag at zoom=2 covers
    // twice the screen distance as at zoom=1.
    const steps = {
      col: rawSteps.col * this.host.zoom,
      row: rawSteps.row * this.host.zoom,
    };
    const cursorSlot = snapToSlot(dx, dy, startCoord, steps);

    // Tetherable mode: if the cursor landed on another [q][r] child,
    // toggle an hp-tether between source and target instead of
    // BFS-snapping to a free slot. The source returns to its starting
    // coord (snap-back); the target stays put. Drops on empty cells
    // fall through to the regular move path so layout editing still
    // works alongside tethering.
    if (this.host.tetherable) {
      const occupier = this.host.occupancy.get(slotKey(cursorSlot.q, cursorSlot.r));
      if (occupier && occupier !== element) {
        this.finishAsTether(element, occupier, startCoord, pointerId);
        return;
      }
    }

    // If the cursor slot is occupied (by another child), BFS axial
    // neighbours until we find a free slot. Bounce-back is no longer
    // the default — the hex finds the nearest empty home instead.
    const target = this.findFreeSlot(cursorSlot, element);

    const fromKey = slotKey(startCoord.q, startCoord.r);
    const toKey = slotKey(target.q, target.r);

    // Snapshot bonds BEFORE the move so we can diff against the
    // post-move set and only fire events for adjacencies that
    // actually changed. The element is still occupying startCoord in
    // `occupancy` here.
    const bondsBefore = this.findOccupiedNeighbours(startCoord, element);

    // Drop the dragging attribute FIRST so the base transform
    // transition re-engages, then change q/r and clear drag offsets in
    // the same task — the browser animates the snap from the cursor
    // position into the new slot over `--hp-unfold-trigger` (90ms).
    element.removeAttribute("data-hp-dragging");

    this.host.occupancy.delete(fromKey);
    this.host.occupancy.set(toKey, element);
    element.setAttribute("q", String(target.q));
    element.setAttribute("r", String(target.r));
    element.style.setProperty("--hp-q", String(target.q));
    element.style.setProperty("--hp-r", String(target.r));
    element.style.removeProperty("--hp-drag-x");
    element.style.removeProperty("--hp-drag-y");

    if (target.q !== startCoord.q || target.r !== startCoord.r) {
      this.host.dispatchEvent(
        new CustomEvent<HpGridMoveEventDetail>("hp-grid-move", {
          detail: { element, from: startCoord, to: target },
          bubbles: true,
          composed: true,
        })
      );

      // Bond diff: any partner in `before` but not `after` is an
      // unbond; any in `after` but not `before` is a new bond. Skip
      // the diff entirely on a no-op snap (same slot) — that can
      // happen on a cancelled drag and would produce phantom events.
      const bondsAfter = this.findOccupiedNeighbours(target, element);
      for (const partner of bondsBefore) {
        if (!bondsAfter.includes(partner)) {
          this.host.dispatchEvent(
            new CustomEvent<HpGridBondEventDetail>("hp-grid-unbond", {
              detail: { moved: element, partner },
              bubbles: true,
              composed: true,
            })
          );
        }
      }
      for (const partner of bondsAfter) {
        if (!bondsBefore.includes(partner)) {
          this.host.dispatchEvent(
            new CustomEvent<HpGridBondEventDetail>("hp-grid-bond", {
              detail: { moved: element, partner },
              bubbles: true,
              composed: true,
            })
          );
        }
      }

      // Post-animation event: fires after the ~90ms snap transition
      // completes. Listeners auto-detach via AbortController on the
      // first relevant event. Skipped entirely if the transition gets
      // cancelled (e.g. the user re-grabs the hex mid-flight before
      // it settles).
      const ac = new AbortController();
      element.addEventListener(
        "transitionend",
        (e) => {
          if ((e as TransitionEvent).propertyName !== "transform") {
            return;
          }
          ac.abort();
          this.host.dispatchEvent(
            new CustomEvent<HpGridDropEventDetail>("hp-grid-drop", {
              detail: { element, from: startCoord, to: target },
              bubbles: true,
              composed: true,
            })
          );
        },
        { signal: ac.signal }
      );
      element.addEventListener(
        "transitioncancel",
        (e) => {
          if ((e as TransitionEvent).propertyName !== "transform") {
            return;
          }
          ac.abort();
        },
        { signal: ac.signal }
      );
    }

    this.clearTetherTarget();
    this.cleanup(element, pointerId);
  }

  /**
   * Tetherable-mode finish path: when a drag-release lands on another
   * `[q][r]` hex (rather than empty space), toggle an arc between
   * the pair instead of moving. The source snaps back to its origin.
   */
  private finishAsTether(
    source: HTMLElement,
    target: HTMLElement,
    startCoord: AxialCoord,
    pointerId: number
  ): void {
    // Snap source back home: clear the inline drag offsets and the
    // dragging attribute so the transition lerps the hex from cursor
    // position back into its starting slot.
    source.removeAttribute("data-hp-dragging");
    source.style.removeProperty("--hp-drag-x");
    source.style.removeProperty("--hp-drag-y");
    // Make sure --hp-q / --hp-r still match the start (in case
    // anything diverged). q/r attributes are untouched since the hex
    // never moved.
    source.style.setProperty("--hp-q", String(startCoord.q));
    source.style.setProperty("--hp-r", String(startCoord.r));

    this.clearTetherTarget();

    const sourceId = tetherSelectorFor(source);
    const targetId = tetherSelectorFor(target);
    if (!sourceId || !targetId) {
      this.cleanup(source, pointerId);
      return;
    }

    // Toggle: if a tether already connects this pair (in either
    // direction), remove it. Otherwise create a new one.
    const existing = findTetherBetween(this.host, sourceId, targetId);
    if (existing) {
      existing.remove();
      this.host.dispatchEvent(
        new CustomEvent<HpGridTetherEventDetail>("hp-grid-untether", {
          detail: { source, target, tether: existing },
          bubbles: true,
          composed: true,
        })
      );
    } else {
      const tether = document.createElement("hp-tether");
      tether.setAttribute("from", sourceId);
      tether.setAttribute("to", targetId);
      tether.setAttribute("data-hp-grid-tether", "");
      // Append as a slotted child of the grid. hp-tether's
      // `position: absolute; inset: 0` covers the grid's bbox; its
      // from / to selectors resolve globally so DOM position doesn't
      // matter for geometry.
      this.host.appendChild(tether);
      // Replay the draw-in animation explicitly — the once-on-mount
      // CSS animation already runs, but the connectedCallback defer
      // happens to also be ~2 rAFs so this call lands at the right
      // moment to be perceptible regardless of timing.
      queueMicrotask(() => {
        const apiEl = tether as HTMLElement & { drawIn?: () => void };
        apiEl.drawIn?.();
      });
      this.host.dispatchEvent(
        new CustomEvent<HpGridTetherEventDetail>("hp-grid-tether", {
          detail: { source, target, tether },
          bubbles: true,
          composed: true,
        })
      );
    }

    this.cleanup(source, pointerId);
  }

  private updateTetherTarget(clientX: number, clientY: number): void {
    if (!this.state) {
      return;
    }
    const source = this.state.element;
    let next: HTMLElement | null = null;
    const hits = document.elementsFromPoint(clientX, clientY);
    for (const hit of hits) {
      const candidate = hit.closest<HTMLElement>("[q][r]");
      if (!candidate || candidate === source) {
        continue;
      }
      if (!this.host.contains(candidate)) {
        continue;
      }
      next = candidate;
      break;
    }
    if (next === this.currentTetherTarget) {
      return;
    }
    if (this.currentTetherTarget) {
      this.currentTetherTarget.removeAttribute("data-hp-tether-target");
    }
    this.currentTetherTarget = next;
    if (next) {
      next.setAttribute("data-hp-tether-target", "");
    }
  }

  private clearTetherTarget(): void {
    if (this.currentTetherTarget) {
      this.currentTetherTarget.removeAttribute("data-hp-tether-target");
      this.currentTetherTarget = null;
    }
  }

  /**
   * Find the nearest unoccupied axial slot to `target` via BFS. The
   * dragged element is treated as if its current slot is free so a
   * drop on its own origin works without bouncing into a neighbour.
   */
  private findFreeSlot(target: AxialCoord, dragged: HTMLElement): AxialCoord {
    if (this.isFree(target, dragged)) {
      return target;
    }
    const visited = new Set<string>([slotKey(target.q, target.r)]);
    const queue: AxialCoord[] = [target];
    // Safety cap — every drop should resolve within a couple of rings.
    let attempts = 0;
    while (queue.length > 0 && attempts < 256) {
      attempts++;
      const current = queue.shift() as AxialCoord;
      for (const neighbour of axialNeighbours(current)) {
        const key = slotKey(neighbour.q, neighbour.r);
        if (visited.has(key)) {
          continue;
        }
        visited.add(key);
        if (this.isFree(neighbour, dragged)) {
          return neighbour;
        }
        queue.push(neighbour);
      }
    }
    // Should never get here unless every nearby slot is occupied —
    // fall back to the cursor target and let the bounce happen.
    return target;
  }

  private isFree(coord: AxialCoord, dragged: HTMLElement): boolean {
    const occupier = this.host.occupancy.get(slotKey(coord.q, coord.r));
    return !occupier || occupier === dragged;
  }

  /**
   * Elements occupying the 6 axial neighbours of `coord`, with
   * `exclude` filtered out. Used to compute bond before/after sets
   * on drop so we can dispatch `hp-grid-bond` / `hp-grid-unbond`
   * only for adjacencies that changed.
   */
  private findOccupiedNeighbours(
    coord: AxialCoord,
    exclude: HTMLElement
  ): HTMLElement[] {
    const out: HTMLElement[] = [];
    for (const n of axialNeighbours(coord)) {
      const occupier = this.host.occupancy.get(slotKey(n.q, n.r));
      if (occupier && occupier !== exclude) {
        out.push(occupier);
      }
    }
    return out;
  }

  /** Shared drag-listener / capture teardown — used by both the
   * normal finish path and the tether finish path. */
  private cleanup(element: HTMLElement, pointerId: number): void {
    element.removeEventListener("pointermove", this.handleMove);
    element.removeEventListener("pointerup", this.handleUp);
    element.removeEventListener("pointercancel", this.handleCancel);
    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
    this.state = null;
  }
}
