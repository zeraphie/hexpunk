/**
 * Bond detection + event emission for `<hp-grid>`.
 *
 * A "bond" is pure axial adjacency on the q/r grid — two hexes share
 * an edge. Drag drops snapshot the moved hex's occupied-neighbour set
 * BEFORE the move and again AFTER, then diff the two: partners only
 * in BEFORE are unbonds (the move broke an edge), partners only in
 * AFTER are new bonds. The drag controller calls into here from its
 * `finish` pipeline; consumers listen for `hp-grid-bond` /
 * `hp-grid-unbond` to paint indicators or update bonded-group state.
 *
 * Pure functions — no controller class. They take the host's
 * occupancy map by reference and dispatch events directly on the
 * host element passed in.
 */

import { axialNeighbours, slotKey } from "./axial.js";
import type { AxialCoord, HpGridBondEventDetail } from "./types.js";

/**
 * Elements occupying the 6 axial neighbours of `coord`, with
 * `exclude` filtered out. Drag-finish calls this twice (once for
 * `startCoord`, once for `target`) and feeds the results to
 * `dispatchBondEvents`.
 *
 * @param occupancy - Live `"q,r"` → element map from the grid.
 * @param coord - Centre coordinate to look outward from.
 * @param exclude - Element to skip (typically the moved hex itself,
 *   so its own slot isn't reported as a self-bond).
 * @returns Up to 6 occupied neighbours.
 */
export function findOccupiedNeighbours(
  occupancy: ReadonlyMap<string, HTMLElement>,
  coord: AxialCoord,
  exclude: HTMLElement
): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const n of axialNeighbours(coord)) {
    const occupier = occupancy.get(slotKey(n.q, n.r));
    if (occupier && occupier !== exclude) {
      out.push(occupier);
    }
  }
  return out;
}

/**
 * Diff a before/after pair of neighbour sets and dispatch
 * `hp-grid-bond` (added) / `hp-grid-unbond` (removed) on the host
 * for each adjacency that changed.
 *
 * Safe to call with empty arrays — fires nothing if neither side
 * changed.
 *
 * @param host - Element to dispatch on (typically the grid).
 * @param moved - The hex that just moved.
 * @param before - Neighbours of the start coord, pre-move.
 * @param after - Neighbours of the target coord, post-move.
 */
export function dispatchBondEvents(
  host: HTMLElement,
  moved: HTMLElement,
  before: ReadonlyArray<HTMLElement>,
  after: ReadonlyArray<HTMLElement>
): void {
  for (const partner of before) {
    if (!after.includes(partner)) {
      host.dispatchEvent(
        new CustomEvent<HpGridBondEventDetail>("hp-grid-unbond", {
          detail: { moved, partner },
          bubbles: true,
          composed: true,
        })
      );
    }
  }
  for (const partner of after) {
    if (!before.includes(partner)) {
      host.dispatchEvent(
        new CustomEvent<HpGridBondEventDetail>("hp-grid-bond", {
          detail: { moved, partner },
          bubbles: true,
          composed: true,
        })
      );
    }
  }
}
