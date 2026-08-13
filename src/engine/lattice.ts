/*
  ─ Pointy-top lattice math ─

  Axial ⇄ world conversions in world units, parameterised by
  hex side length. Pure functions — the O(1) alternative to
  scene-graph hit-testing and per-child culling.
*/
import type { AxialCoord } from "./types.js";

export const SQRT3 = Math.sqrt(3);

/** Bounding width of a pointy-top hex with side `s`. */
export function hexWidth(side: number): number {
  return SQRT3 * side;
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

/** The six axial neighbours of a cell, in ring order. */
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

/** Inclusive row range whose cells can intersect `[y0, y1]`. */
export function rowRange(y0: number, y1: number, side: number): [number, number] {
  return [Math.floor(y0 / (1.5 * side)) - 1, Math.ceil(y1 / (1.5 * side)) + 1];
}

/** Inclusive column range for row `r` intersecting `[x0, x1]`. */
export function colRange(x0: number, x1: number, r: number, side: number): [number, number] {
  return [Math.floor(x0 / (side * SQRT3) - r / 2) - 1, Math.ceil(x1 / (side * SQRT3) - r / 2) + 1];
}
