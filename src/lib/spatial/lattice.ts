/*
  ─ Pointy-top lattice math ─

  Axial ⇄ world conversions in world units, parameterised by
  hex side length, plus the CSS-space step factors and the
  occupancy-key format. Pure functions shared by every element
  that positions hexes, so none of them can drift on geometry.
*/
import type { AxialCoord } from "./types.js";

export const SQRT3 = Math.sqrt(3);

/**
 * Pointy-top hex row step as a fraction of cell width — `w · √3/2`.
 * Pre-computed because CSS `sqrt()` isn't reliable across the
 * Baseline 2025 support matrix.
 */
export const ROW_STEP_FACTOR = 0.8660254;

/**
 * Pointy-top hex half-height as a fraction of cell width
 * (= 1 / √3 ≈ 0.5774). Used when fitting content to compute the
 * vertical pixel extent of a single hex.
 */
export const HEX_HALF_HEIGHT_FACTOR = 0.5773503;

/**
 * Fallback fill mask for children without a `data-fill-cells`
 * attribute — a single hex at the child's own `(q, r)`. A shared
 * constant so no pass allocates a fresh `[{q: 0, r: 0}]`.
 */
export const SINGLE_CELL_MASK: ReadonlyArray<AxialCoord> = [{ q: 0, r: 0 }];

/** Occupancy-map key for a cell. */
export function slotKey(q: number | string, r: number | string): string {
  return `${q},${r}`;
}

/** Bounding width of a pointy-top hex with side `s`. */
export function hexWidth(side: number): number {
  return SQRT3 * side;
}

/**
 * Hex side for a seamless lattice: the pitch is one visible ring
 * narrower than the rendered cell, so neighbouring hexes overlap by
 * exactly their outline and share a single edge instead of drawing
 * two. Both surfaces (flow layout and canvas grid) must derive their
 * pitch through this one function — deriving it twice is how the
 * same cell ends up sitting differently on the two.
 *
 * @param cellPx - Rendered cell width in px.
 * @param ringPx - Visible ring width in px. For hex atoms this is
 *   `HpHex.RING_INSET[size] × cellPx / 2` (the ring comes from a
 *   uniform polygon scale, not the stroke token); for arbitrary
 *   children, the stroke width is the honest stand-in.
 */
export function seamlessSide(cellPx: number, ringPx: number): number {
  return Math.max(1, cellPx - ringPx) / SQRT3;
}

/** Bounding height of a pointy-top hex with side `s`. */
export function hexHeight(side: number): number {
  return 2 * side;
}

/** Centre of the axial cell `(q, r)` in world units. */
export function axialToWorld(q: number, r: number, side: number): [number, number] {
  return [side * SQRT3 * (q + r / 2), side * 1.5 * r];
}

/**
 * Nearest axial cell to a world point — fractional axial via the
 * inverse basis, then cube-round (the redblobgames algorithm).
 */
export function worldToAxial(x: number, y: number, side: number): AxialCoord {
  const qf = ((SQRT3 / 3) * x - y / 3) / side;
  const rf = ((2 / 3) * y) / side;
  const sf = -qf - rf;
  let q = Math.round(qf);
  let s = Math.round(sf);
  let r = Math.round(rf);
  const dq = Math.abs(q - qf);
  const ds = Math.abs(s - sf);
  const dr = Math.abs(r - rf);
  if (dq > ds && dq > dr) {
    q = -s - r;
  } else if (ds > dr) {
    s = -q - r;
  } else {
    r = -q - s;
  }
  return { q, r };
}

/**
 * Flat vertex list (x0, y0, x1, y1, …) of a pointy-top hex centred
 * on the origin. `scale` insets the ring (highlight cells draw
 * slightly inside the field stroke).
 */
export function hexCorners(side: number, scale = 1): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(side * scale * Math.cos(angle), side * scale * Math.sin(angle));
  }
  return pts;
}

/**
 * The six axial neighbours of a cell, in clockwise ring order —
 * reconciled from two implementations that had diverged: hp-grid
 * walked E, W, SE, NW, NE, SW while the engine walked the ring, so
 * the same blocked drop resolved to different cells depending on
 * which one ran. Ring order won because
 * consecutive entries are themselves adjacent, which ring walks and
 * breadth-first searches both rely on; the flip-flopping order read
 * as a drop jumping across the cell rather than stepping around it.
 * Order is load-bearing — a nearest-free search returns the first
 * free neighbour it meets — so this is a behaviour change for
 * hp-grid, not just a de-duplication.
 */
export function axialNeighbours(cell: AxialCoord): AxialCoord[] {
  const { q, r } = cell;
  return [
    { q: q + 1, r },
    { q: q + 1, r: r - 1 },
    { q, r: r - 1 },
    { q: q - 1, r },
    { q: q - 1, r: r + 1 },
    { q, r: r + 1 },
  ];
}

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
/** Inclusive row range whose cells can intersect `[y0, y1]`. */
export function rowRange(y0: number, y1: number, side: number): [number, number] {
  return [Math.floor(y0 / (1.5 * side)) - 1, Math.ceil(y1 / (1.5 * side)) + 1];
}

/** Inclusive column range for row `r` intersecting `[x0, x1]`. */
export function colRange(x0: number, x1: number, r: number, side: number): [number, number] {
  return [Math.floor(x0 / (side * SQRT3) - r / 2) - 1, Math.ceil(x1 / (side * SQRT3) - r / 2) + 1];
}
