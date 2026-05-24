/**
 * Tether helpers for `<hp-grid>`'s tetherable drag mode.
 *
 * A "tether" is an `<hp-tether>` arc rendered between two hexes by
 * `from` / `to` CSS-selector attributes. In tetherable mode, a drag
 * release onto another hex (instead of empty space) toggles such an
 * arc: matching pair already connected → remove; no pair → create.
 *
 * This file owns:
 *
 *   - `TetherTargetTracker` — runtime state for the "candidate hex
 *     under the cursor during a drag" highlight. Sets and clears the
 *     `data-hp-tether-target` attribute on whichever sibling `[q][r]`
 *     hex the pointer is over.
 *   - `tetherSelectorFor` / `findTetherBetween` — pure id-resolution
 *     and lookup helpers.
 *   - `toggleTether` — the create-or-remove core, including the
 *     `hp-grid-tether` / `hp-grid-untether` event emission.
 *
 * Drag-state cleanup (resetting `--hp-drag-x` / `--hp-drag-y`, the
 * snap-back to start coord) stays in DragController — those are drag
 * concerns, not tether concerns.
 */

import type { HpGridTetherEventDetail } from "./types.js";

/**
 * Build the CSS selector that `<hp-tether>`'s `from` / `to`
 * attributes need. Prefers the existing `id` (consumer-authored or
 * the grid's own auto-assigned one), else falls back to the
 * `data-hp-grid-id` stamped at slotchange.
 *
 * @param el - The hex to identify.
 * @returns Selector string, or `null` if neither id source exists.
 */
export function tetherSelectorFor(el: HTMLElement): string | null {
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
 * pair matches the selector pair in either direction. Used by the
 * toggle behaviour: matching pair means we remove instead of create.
 *
 * @param host - The grid element.
 * @param a - One endpoint selector.
 * @param b - The other endpoint selector.
 * @returns Matching tether, or `null` if none exists.
 */
export function findTetherBetween(
  host: HTMLElement,
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
 * Toggle an `<hp-tether>` arc between `source` and `target`. Creates
 * a new tether if none exists between the pair (in either direction);
 * removes the existing tether otherwise. Fires `hp-grid-tether` /
 * `hp-grid-untether` on the host so consumers can react.
 *
 * No-op when either endpoint can't be expressed as a selector (no
 * id and no `data-hp-grid-id` to fall back to).
 *
 * @param host - Grid element. New tethers are appended as children;
 *   events dispatch on this element.
 * @param source - The dragged hex.
 * @param target - The hex the drag landed on.
 */
export function toggleTether(
  host: HTMLElement,
  source: HTMLElement,
  target: HTMLElement
): void {
  const sourceId = tetherSelectorFor(source);
  const targetId = tetherSelectorFor(target);
  if (!sourceId || !targetId) {
    return;
  }
  const existing = findTetherBetween(host, sourceId, targetId);
  if (existing) {
    existing.remove();
    host.dispatchEvent(
      new CustomEvent<HpGridTetherEventDetail>("hp-grid-untether", {
        detail: { source, target, tether: existing },
        bubbles: true,
        composed: true,
      })
    );
    return;
  }
  const tether = document.createElement("hp-tether");
  tether.setAttribute("from", sourceId);
  tether.setAttribute("to", targetId);
  tether.setAttribute("data-hp-grid-tether", "");
  // Append as a slotted child of the grid. hp-tether's
  // `position: absolute; inset: 0` covers the grid's bbox; its from /
  // to selectors resolve globally so DOM position doesn't matter for
  // geometry.
  host.appendChild(tether);
  // Replay the draw-in animation explicitly — the once-on-mount CSS
  // animation already runs, but the connectedCallback defer happens
  // to also be ~2 rAFs so this call lands at the right moment to be
  // perceptible regardless of timing.
  queueMicrotask(() => {
    const apiEl = tether as HTMLElement & { drawIn?: () => void };
    apiEl.drawIn?.();
  });
  host.dispatchEvent(
    new CustomEvent<HpGridTetherEventDetail>("hp-grid-tether", {
      detail: { source, target, tether },
      bubbles: true,
      composed: true,
    })
  );
}

/**
 * Tracks the "candidate tether-target" hex under the cursor during a
 * tetherable-mode drag. Sets `data-hp-tether-target` on whichever
 * sibling `[q][r]` the pointer is over so consumers / CSS can paint
 * a highlight (hp-base reacts to it the same way it reacts to
 * `data-hp-dragging`).
 *
 * Owned by DragController and cleared on drop / cancel.
 */
export class TetherTargetTracker {
  private current: HTMLElement | null = null;

  /**
   * Update the highlighted target to whichever sibling `[q][r]` hex
   * sits under the given viewport point. Skips the drag source
   * itself and any non-grid descendants.
   *
   * @param host - The grid element (used for the `contains` check
   *   so we don't highlight hexes from other grids).
   * @param source - The currently-dragged hex.
   * @param clientX - Pointer X in viewport coords.
   * @param clientY - Pointer Y in viewport coords.
   */
  update(host: HTMLElement, source: HTMLElement, clientX: number, clientY: number): void {
    let next: HTMLElement | null = null;
    const hits = document.elementsFromPoint(clientX, clientY);
    for (const hit of hits) {
      const candidate = hit.closest<HTMLElement>("[q][r]");
      if (!candidate || candidate === source) {
        continue;
      }
      if (!host.contains(candidate)) {
        continue;
      }
      next = candidate;
      break;
    }
    if (next === this.current) {
      return;
    }
    if (this.current) {
      this.current.removeAttribute("data-hp-tether-target");
    }
    this.current = next;
    if (next) {
      next.setAttribute("data-hp-tether-target", "");
    }
  }

  /** Clear the current target on drop / cancel. */
  clear(): void {
    if (this.current) {
      this.current.removeAttribute("data-hp-tether-target");
      this.current = null;
    }
  }
}
