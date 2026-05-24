import { describe, expect, test } from "bun:test";

import {
  type AxialExtent,
  findFirstFreePosition,
  isPositionClear,
  markClaimed,
  PACK_RANGE,
} from "./hp-grid-pack.js";

/** Convenience: claim a child at a position and return the mutated set
 * so tests can chain placements. */
function place(
  claimed: Set<string>,
  q: number,
  r: number,
  extent: AxialExtent
): Set<string> {
  markClaimed(q, r, extent, claimed);
  return claimed;
}

/** Convenience: enumerate every axial cell a placed item occupies, for
 * pairwise gap / overlap assertions. */
function cellsOf(q: number, r: number, extent: AxialExtent): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let dr = extent.rMin; dr <= extent.rMax; dr++) {
    for (let dq = extent.qMin; dq <= extent.qMax; dq++) {
      out.push([q + dq, r + dr]);
    }
  }
  return out;
}

/** Chebyshev-style distance on the axial cell grid we use for spacing
 * checks (max of |Δq|, |Δr|). Adequate for "are these two extents at
 * least one empty cell apart in every direction", which is exactly
 * what the pack algorithm guarantees. */
function gridDist(a: [number, number], b: [number, number]): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
}

/** Common test extents — borrowed from real hp-cluster child counts. */
const SINGLE: AxialExtent = { qMin: 0, qMax: 0, rMin: 0, rMax: 0 };
const RING1: AxialExtent = { qMin: -1, qMax: 1, rMin: -1, rMax: 1 }; // 7-child centre + ring 1
const RING2_TOP: AxialExtent = { qMin: -1, qMax: 2, rMin: -2, rMax: 1 }; // 10-child cluster (Forms / Layout)
const SLIM: AxialExtent = { qMin: 0, qMax: 1, rMin: -1, rMax: 0 }; // 3-child cluster

describe("isPositionClear", () => {
  test("empty claim → any position is clear", () => {
    expect(isPositionClear(0, 0, SINGLE, new Set())).toBe(true);
    expect(isPositionClear(5, -3, RING2_TOP, new Set())).toBe(true);
  });

  test("padding catches direct collision", () => {
    const claimed = place(new Set(), 0, 0, SINGLE);
    expect(isPositionClear(0, 0, SINGLE, claimed)).toBe(false);
  });

  test("padding catches 1-cell-away collision", () => {
    // SINGLE at (0,0) claims [0,0]. Candidate SINGLE at (1,0) has
    // padded check region [-1..1, -1..1] which includes (0,0).
    const claimed = place(new Set(), 0, 0, SINGLE);
    expect(isPositionClear(1, 0, SINGLE, claimed)).toBe(false);
  });

  test("2-cell separation is clear", () => {
    // SINGLE at (0,0) claims [0,0]. Candidate at (2,0) has padded
    // check region [1..3, -1..1] which does NOT include (0,0).
    const claimed = place(new Set(), 0, 0, SINGLE);
    expect(isPositionClear(2, 0, SINGLE, claimed)).toBe(true);
  });

  test("non-symmetric extent — padding stretches to extent bounds", () => {
    // SLIM at (0,0) claims [0..1, -1..0]. Candidate SLIM at (3, -1)
    // has check region [2..4, -3..0] → does not overlap.
    const claimed = place(new Set(), 0, 0, SLIM);
    expect(isPositionClear(3, -1, SLIM, claimed)).toBe(true);
    // Candidate SLIM at (2, 0) check region [1..3, -2..1] → overlaps
    // with (1, 0) which is claimed.
    expect(isPositionClear(2, 0, SLIM, claimed)).toBe(false);
  });
});

describe("markClaimed", () => {
  test("single cell marks one entry", () => {
    const claimed = new Set<string>();
    markClaimed(3, -2, SINGLE, claimed);
    expect(claimed.size).toBe(1);
    expect(claimed.has("3,-2")).toBe(true);
  });

  test("RING1 marks 9 cells (3×3 bbox)", () => {
    const claimed = new Set<string>();
    markClaimed(0, 0, RING1, claimed);
    expect(claimed.size).toBe(9);
  });

  test("subsequent marks accumulate", () => {
    const claimed = place(place(new Set(), 0, 0, SINGLE), 5, 5, SINGLE);
    expect(claimed.size).toBe(2);
  });
});

describe("findFirstFreePosition", () => {
  test("first item lands at top-left of scan bounds", () => {
    const claimed = new Set<string>();
    const pos = findFirstFreePosition(SINGLE, claimed, 5);
    // r starts at -PACK_RANGE, q starts at the leftmost valid column
    // for that row (shifted by r/2).
    expect(pos.r).toBe(-PACK_RANGE);
  });

  test("two SINGLE items pack with ≥1 cell gap", () => {
    const claimed = new Set<string>();
    const a = findFirstFreePosition(SINGLE, claimed, 5);
    markClaimed(a.q, a.r, SINGLE, claimed);
    const b = findFirstFreePosition(SINGLE, claimed, 5);
    markClaimed(b.q, b.r, SINGLE, claimed);
    // Both at the same row, two axial columns apart (1 cell gap).
    expect(b.r).toBe(a.r);
    expect(b.q).toBe(a.q + 2);
  });

  test("wraps to new row when current row is full", () => {
    const claimed = new Set<string>();
    // halfCols=2 → tight viewport, only ~3 SINGLE items fit per row
    // (each takes 2 axial cells of horizontal space). 4th wraps.
    const halfCols = 2;
    const placements: Array<{ q: number; r: number }> = [];
    for (let i = 0; i < 8; i++) {
      const pos = findFirstFreePosition(SINGLE, claimed, halfCols);
      markClaimed(pos.q, pos.r, SINGLE, claimed);
      placements.push(pos);
    }
    // At least one item lands on a row below the first.
    const firstRow = placements[0]!.r;
    const rows = new Set(placements.map((p) => p.r));
    expect(rows.size).toBeGreaterThan(1);
    expect([...rows].some((row) => row > firstRow)).toBe(true);
  });

  test("multi-item pack: no two items overlap and all pairs ≥1 cell apart", () => {
    const claimed = new Set<string>();
    // Mixed sizes mirroring the components-page categories.
    const items: AxialExtent[] = [
      RING1,
      RING2_TOP,
      SLIM,
      SLIM,
      RING2_TOP,
      SLIM,
      RING1,
      SLIM,
      SINGLE,
      RING1,
    ];
    const placed: Array<{ q: number; r: number; ext: AxialExtent }> = [];
    for (const ext of items) {
      const pos = findFirstFreePosition(ext, claimed, 12);
      markClaimed(pos.q, pos.r, ext, claimed);
      placed.push({ q: pos.q, r: pos.r, ext });
    }
    // For every pair, every cell of A is at least 2 cells away from
    // every cell of B (Chebyshev distance ≥ 2 = "one empty cell
    // between them").
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!;
        const b = placed[j]!;
        const cellsA = cellsOf(a.q, a.r, a.ext);
        const cellsB = cellsOf(b.q, b.r, b.ext);
        let minDist = Number.POSITIVE_INFINITY;
        for (const cA of cellsA) {
          for (const cB of cellsB) {
            const d = gridDist(cA, cB);
            if (d < minDist) minDist = d;
          }
        }
        expect(minDist).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test("row-major: items prefer lower r, then lower q", () => {
    const claimed = new Set<string>();
    const first = findFirstFreePosition(SINGLE, claimed, 10);
    markClaimed(first.q, first.r, SINGLE, claimed);
    const second = findFirstFreePosition(SINGLE, claimed, 10);
    // Second comes after first in row-major scan: same r, higher q
    // (or higher r if row 1 is full — but with halfCols=10 there's
    // plenty of room).
    expect(second.r === first.r).toBe(true);
    expect(second.q > first.q).toBe(true);
  });

  test("every placement stays within the viewport's visual q-range", () => {
    // The r/2 horizontal shift in axial-to-pixel projection means
    // placements on different r rows must shift their q-window to
    // stay centred under the viewport. With halfCols=4 we pack
    // a mix of sizes and assert every placement's visual x
    // (= q + r/2) stays inside [-halfCols, halfCols].
    const halfCols = 4;
    const claimed = new Set<string>();
    const items: AxialExtent[] = [SINGLE, SLIM, RING1, SINGLE, SLIM, SINGLE];
    for (const ext of items) {
      const pos = findFirstFreePosition(ext, claimed, halfCols);
      markClaimed(pos.q, pos.r, ext, claimed);
      // The cluster's leftmost hex visual x must be ≥ -halfCols,
      // and rightmost ≤ +halfCols.
      const visualLeft = pos.q + ext.qMin + pos.r / 2;
      const visualRight = pos.q + ext.qMax + pos.r / 2;
      expect(visualLeft).toBeGreaterThanOrEqual(-halfCols);
      expect(visualRight).toBeLessThanOrEqual(halfCols);
    }
  });

  test("12-cluster components-page snapshot packs cleanly", () => {
    // Real-world sanity: mirror the sitemap-derived category counts
    // and confirm everything places without falling back to (0,0).
    const cats: AxialExtent[] = [
      RING1, // Primitives (7)
      RING2_TOP, // Forms (10)
      SLIM, // Status (3)
      SLIM, // Loading (3)
      RING2_TOP, // Layout (10)
      SLIM, // Images (4) — actually RING-ish but SLIM is the tightest case
      RING1, // Navigation (5)
      RING2_TOP, // Overlays (8)
      SLIM, // Messaging (3)
      SLIM, // Tether (2)
      RING1, // Unfold (5)
      SLIM, // Deprecated (3)
    ];
    const claimed = new Set<string>();
    const placements: Array<{ q: number; r: number }> = [];
    for (const ext of cats) {
      const pos = findFirstFreePosition(ext, claimed, 35);
      markClaimed(pos.q, pos.r, ext, claimed);
      placements.push(pos);
    }
    // Every placement must be uniquely positioned (the fallback
    // (0,0) would only fire if scan failed — duplicates would
    // signal that).
    const seen = new Set<string>();
    for (const p of placements) {
      const key = `${p.q},${p.r}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
