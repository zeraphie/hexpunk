/**
 * Pure axial-coordinate helpers for `<hp-grid>` — geometry constants,
 * neighbour math, occupancy-key formatting, and the `data-fill-cells`
 * parser used by fit-to-content. No DOM dependencies; safe to import
 * from any concern module without risking circular references.
 */

import type { AxialCoord } from "./types.js";

/**
 * Pointy-top hex row step as a fraction of cell width — `w · √3/2`.
 * Pre-computed to avoid CSS `sqrt()` which isn't reliable across
 * Baseline 2025.
 */
export const ROW_STEP_FACTOR = 0.8660254;

/**
 * Pointy-top hex half-height as a fraction of cell width
 * (= 1 / √3 ≈ 0.5774). Used by `recenter()` to compute the vertical
 * pixel extent of a single hex when fitting content.
 */
export const HEX_HALF_HEIGHT_FACTOR = 0.5773503;

/**
 * Fallback fill mask for children without a `data-fill-cells`
 * attribute — a single hex at the child's own `(q, r)`. Shared
 * constant so we don't allocate a fresh `[{q: 0, r: 0}]` per
 * fit-to-content pass.
 */
export const SINGLE_CELL_MASK: ReadonlyArray<AxialCoord> = [{ q: 0, r: 0 }];

/**
 * Parse an `hp-cluster`-style `data-fill-cells` attribute (space-
 * separated `"q,r q,r ..."` pairs) into an `AxialCoord[]`. Returns
 * `SINGLE_CELL_MASK` for missing / empty / unparseable input so the
 * caller can treat every child uniformly.
 *
 * Duplicates `parseFillCells` from pack.ts on purpose — the pack
 * variant returns a non-empty mask even for unparseable input, which
 * would mask legitimately-missing attributes when computing the
 * fit-to-content bbox.
 *
 * @param value - Raw attribute string, or `null` / `undefined`.
 * @returns Parsed cell offsets, never empty.
 */
export function parseFillCellsForBbox(value: string | null | undefined): ReadonlyArray<AxialCoord> {
  if (!value) {
    return SINGLE_CELL_MASK;
  }
  const cells: AxialCoord[] = [];
  for (const token of value.split(/\s+/)) {
    if (token.length === 0) {
      continue;
    }
    const [qStr, rStr] = token.split(",");
    const q = Number.parseFloat(qStr ?? "");
    const r = Number.parseFloat(rStr ?? "");
    if (!Number.isFinite(q) || !Number.isFinite(r)) {
      continue;
    }
    cells.push({ q, r });
  }
  return cells.length === 0 ? SINGLE_CELL_MASK : cells;
}

/**
 * Format a `(q, r)` axial coordinate as a Map key — `"q,r"`. Accepts
 * either numbers (typical) or strings (when reading directly off
 * element attributes).
 *
 * @param q - Axial column.
 * @param r - Axial row.
 * @returns Canonical `"q,r"` string.
 */
export function slotKey(q: number | string, r: number | string): string {
  return `${q},${r}`;
}

/**
 * The six pointy-top axial neighbours of `(q, r)`. Direction order:
 * E, W, S, N, NE, SW.
 *
 * @param coord - Centre coordinate.
 * @returns Fresh array of six neighbour coordinates.
 */
export function axialNeighbours(coord: AxialCoord): AxialCoord[] {
  return [
    { q: coord.q + 1, r: coord.r },
    { q: coord.q - 1, r: coord.r },
    { q: coord.q, r: coord.r + 1 },
    { q: coord.q, r: coord.r - 1 },
    { q: coord.q + 1, r: coord.r - 1 },
    { q: coord.q - 1, r: coord.r + 1 },
  ];
}
