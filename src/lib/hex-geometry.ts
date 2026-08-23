/*
  ─ Hex stencil geometry ─

  The single source of the hex outline: outer polygon per
  orientation, per-size inner polygon (the ring), and the ring
  inset each size implies. hp-hex renders these as SVG; the
  hex-controls generator bakes them into CSS masks; the spatial
  surfaces read the inset for seam math. One table, no drift.
*/

export type HexSize = "xxs" | "xs" | "sm" | "md" | "lg";

/** Outer-polygon points + viewBox per orientation. Keyed by whether
 * the hex renders pointy-top (default) or flat-top (md). */
export const OUTER_POINTS = {
  pointy: {
    viewBox: "0 0 100 115.47",
    points: "50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87",
  },
  flat: {
    viewBox: "0 0 100 86.6",
    points: "100,43.3 75,86.6 25,86.6 0,43.3 25,0 75,0",
  },
} as const;

/** Inner-polygon points per size — uniform scale of the outer hex
 * around its centre (pointy-top: centre 50,57.735; flat-top:
 * 50,43.3). Pre-computed because CSS transform: scale() on SVG
 * polygons doesn't apply reliably across engines. Each entry was
 * computed as
 * `outer * scale + (1 - scale) * centre` to keep the stroke ring
 * proportional to the cell. Scale factors:
 *
 * xxs (cell 20px, stroke 1px display ≈ 5 viewBox units) → 0.90
 * xs (cell 50px, stroke 1.5px ≈ 3 viewBox units) → 0.94
 * sm (cell 100px, stroke 2px) → 0.95
 * md (cell 180px flat-top, stroke 4px scaled) → 0.923
 * lg (cell 320px, stroke 6px scaled) → 0.925 */
export const INNER_POINTS: Record<HexSize, string> = {
  xxs: "50,5.77 95,31.76 95,83.71 50,109.7 5,83.71 5,31.76",
  xs: "50,3.46 97,30.6 97,84.87 50,112.01 3,84.87 3,30.6",
  sm: "50,2.89 97.5,30.31 97.5,85.16 50,112.58 2.5,85.16 2.5,30.31",
  md: "96.15,43.3 73.08,83.27 26.92,83.27 3.85,43.3 26.92,3.33 73.08,3.33",
  lg: "50,4.33 96.25,31.04 96.25,84.43 50,111.14 3.75,84.43 3.75,31.04",
};

/** Half-width of the visible ring as a fraction of the cell, i.e.
 * `1 - scale` from the table above. hp-hex publishes it as
 * `--hp-hex-inset`; hp-layout / hp-grid overlap neighbours by
 * exactly this so two outlines merge into one shared edge. */
export const RING_INSET: Record<HexSize, number> = {
  xxs: 0.1,
  xs: 0.06,
  sm: 0.05,
  md: 0.077,
  lg: 0.075,
};
