import { describe, expect, test } from "bun:test";

import {
  type FillMask,
  PACK_RANGE,
  findFirstFreePosition,
  isPositionClear,
  markClaimed,
  parseFillCells,
} from "./hp-grid-pack.js";

/** Convenience: claim a mask at a position and return the mutated set
 * so tests can chain placements. */
function place(claimed: Set<string>, q: number, r: number, mask: FillMask): Set<string> {
  markClaimed(q, r, mask, claimed);
  return claimed;
}

/** Hex axial distance between two cells — the cube-coord trick reduced
 * to two terms. Used to assert ≥1-hex gap between any two placed
 * clusters' filled hexes. */
function hexDist(a: { q: number; r: number }, b: { q: number; r: number }): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

/** Real hp-cluster fill masks — mirrors the HONEYCOMB_POSITIONS table
 * in hp-cluster.ts so test fixtures match production layouts. */
const HONEYCOMB_FILL_ORDER: Array<{ q: number; r: number }> = [
  { q: 0, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -2 },
  { q: 1, r: -2 },
  { q: 2, r: -2 },
  { q: 2, r: -1 },
  { q: 2, r: 0 },
  { q: 1, r: 1 },
  { q: 0, r: 2 },
  { q: -1, r: 2 },
  { q: -2, r: 2 },
  { q: -2, r: 1 },
  { q: -2, r: 0 },
  { q: -1, r: -1 },
];
function honeycombMask(childCount: number): FillMask {
  return HONEYCOMB_FILL_ORDER.slice(0, Math.min(childCount, HONEYCOMB_FILL_ORDER.length));
}

const SINGLE: FillMask = [{ q: 0, r: 0 }];
const RING1: FillMask = honeycombMask(7); // centre + ring 1
const TEN_HONEYCOMB: FillMask = honeycombMask(10); // centre + ring 1 + 3 ring-2 NE hexes
const ROSETTE: FillMask = [
  { q: 0, r: 0 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
];

describe("isPositionClear", () => {
  test("empty claim → any position is clear", () => {
    expect(isPositionClear(0, 0, SINGLE, new Set())).toBe(true);
    expect(isPositionClear(5, -3, TEN_HONEYCOMB, new Set())).toBe(true);
  });

  test("direct overlap rejected", () => {
    const claimed = place(new Set(), 0, 0, SINGLE);
    expect(isPositionClear(0, 0, SINGLE, claimed)).toBe(false);
  });

  test("hex-neighbour rejected (no edge-sharing across clusters)", () => {
    const claimed = place(new Set(), 0, 0, SINGLE);
    // All 6 hex-neighbours of (0,0) must reject a SINGLE placement.
    for (const [dq, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, -1],
      [-1, 1],
    ] as const) {
      expect(isPositionClear(dq, dr, SINGLE, claimed)).toBe(false);
    }
  });

  test("distance-2 placement accepted (1-hex gap satisfied)", () => {
    const claimed = place(new Set(), 0, 0, SINGLE);
    expect(isPositionClear(2, 0, SINGLE, claimed)).toBe(true);
    expect(isPositionClear(0, 2, SINGLE, claimed)).toBe(true);
    expect(isPositionClear(2, -2, SINGLE, claimed)).toBe(true);
  });

  test("non-hex-neighbour rectangular-diagonal IS allowed (tight packing)", () => {
    // (1, 1) is rect-diagonal from (0, 0) but hex-distance 2, so a
    // SINGLE there is fine. This is the pivotal property: tight
    // masonry exploits these rect-diagonal-but-hex-far cells.
    const claimed = place(new Set(), 0, 0, SINGLE);
    expect(isPositionClear(1, 1, SINGLE, claimed)).toBe(true);
    expect(isPositionClear(-1, -1, SINGLE, claimed)).toBe(true);
  });

  test("rect-diagonal-but-hex-far position next to a cluster is clear", () => {
    // RING1's bbox is q[-1,1] r[-1,1]. A bbox-rectangular-padding
    // algorithm would block every cell in q[-2,2] r[-2,2]. With
    // hex-adjacency, (2, 2) is hex-distance 3 from the nearest filled
    // cell — clearly legal. This is the property that lets neighbour
    // clusters tuck in tight.
    const claimed = place(new Set(), 0, 0, RING1);
    expect(isPositionClear(2, 2, SINGLE, claimed)).toBe(true);
    expect(isPositionClear(-2, -2, SINGLE, claimed)).toBe(true);
  });
});

describe("markClaimed", () => {
  test("single cell marks one entry", () => {
    const claimed = new Set<string>();
    markClaimed(3, -2, SINGLE, claimed);
    expect(claimed.size).toBe(1);
    expect(claimed.has("3,-2")).toBe(true);
  });

  test("7-child honeycomb marks exactly 7 cells", () => {
    const claimed = new Set<string>();
    markClaimed(0, 0, RING1, claimed);
    expect(claimed.size).toBe(7);
  });

  test("10-child honeycomb marks exactly 10 cells (only filled, not bbox)", () => {
    // Bbox of a 10-child cluster is q[-1,2] r[-2,1] = 12 cells, but
    // only 10 are filled. The 2 unfilled corners stay free.
    const claimed = new Set<string>();
    markClaimed(0, 0, TEN_HONEYCOMB, claimed);
    expect(claimed.size).toBe(10);
    // Specifically, the two unfilled bbox corners must NOT be claimed.
    // Positions 11 (2, -1) and 12 (2, 0) are NOT in the 10-fill set,
    // BUT (2, -1) is part of the 10-fill set — let's pick a clearly-
    // unfilled bbox cell: (-1, -2) and (-1, -1) are unfilled.
    expect(claimed.has("-1,-2")).toBe(false);
    expect(claimed.has("-1,-1")).toBe(false);
  });
});

describe("findFirstFreePosition", () => {
  test("first item lands at top of scan bounds", () => {
    const pos = findFirstFreePosition(SINGLE, new Set(), 5);
    expect(pos.r).toBe(-PACK_RANGE);
  });

  test("two SINGLE items pack at hex-distance 2 (exactly 1 cell gap)", () => {
    const claimed = new Set<string>();
    const a = findFirstFreePosition(SINGLE, claimed, 5);
    markClaimed(a.q, a.r, SINGLE, claimed);
    const b = findFirstFreePosition(SINGLE, claimed, 5);
    markClaimed(b.q, b.r, SINGLE, claimed);
    expect(hexDist(a, b)).toBe(2);
  });

  test("wraps to new row when current row fills (tight viewport)", () => {
    const claimed = new Set<string>();
    const halfCols = 2;
    const placements: Array<{ q: number; r: number }> = [];
    for (let i = 0; i < 8; i++) {
      const pos = findFirstFreePosition(SINGLE, claimed, halfCols);
      markClaimed(pos.q, pos.r, SINGLE, claimed);
      placements.push(pos);
    }
    const rows = new Set(placements.map((p) => p.r));
    expect(rows.size).toBeGreaterThan(1);
  });

  test("mixed-size pack: every pair of filled hexes is hex-distance ≥ 2", () => {
    // The defining property of "≥1-hex gap between clusters": for
    // every pair of placed clusters, every filled cell of A is at
    // hex-distance ≥ 2 from every filled cell of B.
    const claimed = new Set<string>();
    const items: FillMask[] = [
      RING1,
      TEN_HONEYCOMB,
      honeycombMask(3),
      honeycombMask(3),
      TEN_HONEYCOMB,
      honeycombMask(4),
      RING1,
      honeycombMask(8),
      honeycombMask(3),
      honeycombMask(2),
      RING1,
      honeycombMask(3),
    ];
    const placed: Array<{ q: number; r: number; mask: FillMask }> = [];
    for (const mask of items) {
      const pos = findFirstFreePosition(mask, claimed, 35);
      markClaimed(pos.q, pos.r, mask, claimed);
      placed.push({ q: pos.q, r: pos.r, mask });
    }
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!;
        const b = placed[j]!;
        for (const cellA of a.mask) {
          for (const cellB of b.mask) {
            const absA = { q: a.q + cellA.q, r: a.r + cellA.r };
            const absB = { q: b.q + cellB.q, r: b.r + cellB.r };
            expect(hexDist(absA, absB)).toBeGreaterThanOrEqual(2);
          }
        }
      }
    }
  });

  test("hex-distance-2 tuck next to a 10-honeycomb is reachable", () => {
    // A 10-child honeycomb (Forms-shape: centre + ring 1 + 3 NE
    // ring-2 hexes) at origin still leaves close-in positions free,
    // because hex-distance-2 from the cluster's filled cells is the
    // gap rule — not bbox-rectangular padding. We assert several
    // tuck positions that a bbox algorithm would have blocked but
    // hex-distance leaves available.
    const claimed = new Set<string>();
    markClaimed(0, 0, TEN_HONEYCOMB, claimed);
    // (1, 2) is hex-distance 2 from (0, 1), the cluster's southmost
    // filled cell — closest legal tuck below the cluster.
    expect(isPositionClear(1, 2, SINGLE, claimed)).toBe(true);
    // (3, -4) is hex-distance 2 from (2, -2), the cluster's NE
    // ring-2 tip — legal tuck to the NE.
    expect(isPositionClear(3, -4, SINGLE, claimed)).toBe(true);
    // (-3, 2) is hex-distance 2 from (-1, 1) — legal tuck to the SW.
    expect(isPositionClear(-3, 2, SINGLE, claimed)).toBe(true);
  });

  test("row-major: items prefer lower r, then lower q", () => {
    const claimed = new Set<string>();
    const first = findFirstFreePosition(SINGLE, claimed, 10);
    markClaimed(first.q, first.r, SINGLE, claimed);
    const second = findFirstFreePosition(SINGLE, claimed, 10);
    // Same row, higher q (room to the right of the first item).
    expect(second.r).toBe(first.r);
    expect(second.q).toBeGreaterThan(first.q);
  });

  test("every placement stays within the viewport's visual q-range", () => {
    const halfCols = 4;
    const claimed = new Set<string>();
    const items: FillMask[] = [
      SINGLE,
      ROSETTE,
      RING1,
      SINGLE,
      ROSETTE,
      SINGLE,
    ];
    for (const mask of items) {
      const pos = findFirstFreePosition(mask, claimed, halfCols);
      markClaimed(pos.q, pos.r, mask, claimed);
      for (const cell of mask) {
        const visualX = pos.q + cell.q + pos.r / 2;
        expect(visualX).toBeGreaterThanOrEqual(-halfCols);
        expect(visualX).toBeLessThanOrEqual(halfCols);
      }
    }
  });

  test("12-cluster components-page snapshot packs cleanly", () => {
    // Counts taken from the actual sitemap.ts categories.
    const cats: FillMask[] = [
      honeycombMask(7), // Primitives
      honeycombMask(10), // Forms
      honeycombMask(3), // Status
      honeycombMask(3), // Loading
      honeycombMask(10), // Layout
      honeycombMask(4), // Images
      honeycombMask(5), // Navigation
      honeycombMask(8), // Overlays
      honeycombMask(3), // Messaging
      honeycombMask(2), // Tether
      honeycombMask(5), // Unfold
      honeycombMask(3), // Deprecated
    ];
    const claimed = new Set<string>();
    const placements: Array<{ q: number; r: number }> = [];
    for (const mask of cats) {
      const pos = findFirstFreePosition(mask, claimed, 35);
      markClaimed(pos.q, pos.r, mask, claimed);
      placements.push(pos);
    }
    const seen = new Set<string>();
    for (const p of placements) {
      const key = `${p.q},${p.r}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("parseFillCells", () => {
  test("null / empty → single-cell fallback", () => {
    expect(parseFillCells(null)).toEqual([{ q: 0, r: 0 }]);
    expect(parseFillCells("")).toEqual([{ q: 0, r: 0 }]);
    expect(parseFillCells(undefined)).toEqual([{ q: 0, r: 0 }]);
  });

  test("space-separated 'q,r' pairs parsed correctly", () => {
    const parsed = parseFillCells("0,0 1,-1 -1,0");
    expect(parsed).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: -1 },
      { q: -1, r: 0 },
    ]);
  });

  test("extra whitespace and trailing spaces tolerated", () => {
    const parsed = parseFillCells("  0,0   1,1  ");
    expect(parsed).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 1 },
    ]);
  });

  test("malformed tokens skipped (don't crash)", () => {
    const parsed = parseFillCells("0,0 garbage 1,1");
    expect(parsed).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 1 },
    ]);
  });
});
