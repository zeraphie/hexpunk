/**
 * Spiral-from-origin pack strategy — `<hp-grid layout="spiral">`.
 *
 * Each cluster is placed at the first free position picked from a
 * scan ordered by axial distance from `(0, 0)`: ring 0 (the origin
 * itself), then the 6 ring-1 positions, then ring 2's 12 positions,
 * and so on outward. Paired with the FFD largest-first sort in
 * `HpGrid.pack()`, the result is a tight roughly-square honeycomb —
 * the biggest cluster anchors the centre and smaller ones nest
 * around it with a ≥1-hex gap.
 */

import { type AxialPos, type FillMask, PACK_RANGE, isPositionClear } from "./index.js";

/**
 * Hex axial distance from `(0, 0)` — `(|q| + |q+r| + |r|) / 2`. Used
 * by the spiral scan order to sort positions outward from the origin
 * in honeycomb rings.
 *
 * @param q - Axial column.
 * @param r - Axial row.
 * @returns Distance in hex steps.
 */
function hexDistanceFromOrigin(q: number, r: number): number {
  return (Math.abs(q) + Math.abs(q + r) + Math.abs(r)) / 2;
}

/**
 * Memoised spiral-from-origin scan order. The first call materialises
 * every `(q, r)` in `[-PACK_RANGE, PACK_RANGE]²` sorted by axial
 * distance from the origin (ring 0, then ring 1's 6 positions, then
 * ring 2's 12, …); ties broken deterministically by `(r, q)`. The
 * result is reused on every subsequent pack — cheap O(n) lookup
 * regardless of cluster count.
 */
let SPIRAL_POSITIONS: ReadonlyArray<AxialPos> | null = null;
function getSpiralPositions(): ReadonlyArray<AxialPos> {
  if (SPIRAL_POSITIONS) {
    return SPIRAL_POSITIONS;
  }
  const positions: Array<AxialPos & { dist: number }> = [];
  for (let r = -PACK_RANGE; r <= PACK_RANGE; r++) {
    for (let q = -PACK_RANGE; q <= PACK_RANGE; q++) {
      positions.push({ q, r, dist: hexDistanceFromOrigin(q, r) });
    }
  }
  positions.sort((a, b) => a.dist - b.dist || a.r - b.r || a.q - b.q);
  SPIRAL_POSITIONS = positions.map(({ q, r }) => ({ q, r }));
  return SPIRAL_POSITIONS;
}

/**
 * Find the first position whose 1-hex-padded mask doesn't collide,
 * scanning outward from the origin in honeycomb rings.
 *
 * Returns `{q: 0, r: 0}` as a defensive fallback when nothing fits
 * in `±PACK_RANGE`; real packs never hit it.
 *
 * @param mask - Cluster's filled-cell offsets.
 * @param claimed - Cells already taken by previously placed clusters.
 * @returns Origin coordinate for the cluster.
 */
export function findSpiralPosition(mask: FillMask, claimed: ReadonlySet<string>): AxialPos {
  const positions = getSpiralPositions();
  for (const { q, r } of positions) {
    if (isPositionClear(q, r, mask, claimed)) {
      return { q, r };
    }
  }
  return { q: 0, r: 0 };
}
