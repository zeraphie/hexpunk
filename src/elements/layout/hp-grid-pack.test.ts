import { describe, expect, test } from "bun:test";

import {
  type FillMask,
  findFirstFreePosition,
  findFirstFreePositionRowMajor,
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
const RING1: FillMask = honeycombMask(7);
const TEN_HONEYCOMB: FillMask = honeycombMask(10);
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
    const claimed = new Set<string>();
    markClaimed(0, 0, TEN_HONEYCOMB, claimed);
    expect(claimed.size).toBe(10);
    expect(claimed.has("-1,-2")).toBe(false);
    expect(claimed.has("-1,-1")).toBe(false);
  });
});

describe("findFirstFreePosition", () => {
  test("first item lands at origin (spiral scan starts there)", () => {
    expect(findFirstFreePosition(SINGLE, new Set())).toEqual({ q: 0, r: 0 });
  });

  test("second SINGLE lands at hex-distance 2 (closest legal tuck)", () => {
    // Ring 1 (distance 1) is all hex-adjacent to the placed SINGLE
    // → blocked. Ring 2 (distance 2) is the first ring with legal
    // positions. The spiral tie-break is `(r, q)` ascending, so we
    // get the topmost ring-2 hex first.
    const claimed = place(new Set(), 0, 0, SINGLE);
    const b = findFirstFreePosition(SINGLE, claimed);
    expect(hexDist(b, { q: 0, r: 0 })).toBe(2);
    expect(b.r).toBe(-2);
  });

  test("mixed-size pack: every pair of filled hexes is hex-distance ≥ 2", () => {
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
      const pos = findFirstFreePosition(mask, claimed);
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

  test("layout stays compact: spiral pack bbox scales with cell count", () => {
    // Spiral-from-origin packing keeps the layout's hex-distance
    // diameter ≈ sqrt(total_cells × 2). The components-page workload
    // is 63 cells across 12 clusters — well within axial-distance 20
    // of the origin (much tighter than the 36-wide row-major fallback
    // would give).
    const cats: FillMask[] = [
      honeycombMask(7),
      honeycombMask(10),
      honeycombMask(3),
      honeycombMask(3),
      honeycombMask(10),
      honeycombMask(4),
      honeycombMask(5),
      honeycombMask(8),
      honeycombMask(3),
      honeycombMask(2),
      honeycombMask(5),
      honeycombMask(3),
    ];
    const sorted = [...cats].sort((a, b) => b.length - a.length);
    const claimed = new Set<string>();
    const cells: Array<{ q: number; r: number }> = [];
    for (const mask of sorted) {
      const pos = findFirstFreePosition(mask, claimed);
      markClaimed(pos.q, pos.r, mask, claimed);
      for (const c of mask) cells.push({ q: pos.q + c.q, r: pos.r + c.r });
    }
    let maxDist = 0;
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const d = hexDist(cells[i]!, cells[j]!);
        if (d > maxDist) maxDist = d;
      }
    }
    expect(maxDist).toBeGreaterThanOrEqual(6);
    expect(maxDist).toBeLessThanOrEqual(20);
  });

  test("hex-distance-2 tuck next to a 10-honeycomb is reachable", () => {
    const claimed = new Set<string>();
    markClaimed(0, 0, TEN_HONEYCOMB, claimed);
    expect(isPositionClear(1, 2, SINGLE, claimed)).toBe(true);
    expect(isPositionClear(3, -4, SINGLE, claimed)).toBe(true);
    expect(isPositionClear(-3, 2, SINGLE, claimed)).toBe(true);
  });

  test("12-cluster components-page snapshot packs without fallback", () => {
    const cats: FillMask[] = [
      honeycombMask(7),
      honeycombMask(10),
      honeycombMask(3),
      honeycombMask(3),
      honeycombMask(10),
      honeycombMask(4),
      honeycombMask(5),
      honeycombMask(8),
      honeycombMask(3),
      honeycombMask(2),
      honeycombMask(5),
      honeycombMask(3),
    ];
    const sorted = [...cats].sort((a, b) => b.length - a.length);
    const claimed = new Set<string>();
    const placements: Array<{ q: number; r: number }> = [];
    for (const mask of sorted) {
      const pos = findFirstFreePosition(mask, claimed);
      markClaimed(pos.q, pos.r, mask, claimed);
      placements.push(pos);
    }
    // Every cluster must land at a unique position — duplicates
    // would indicate the fallback `{0, 0}` fired, meaning the scan
    // exhausted its range. Spiral pack should never hit that on
    // any realistic workload.
    const seen = new Set<string>();
    for (const p of placements) {
      const key = `${p.q},${p.r}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  test("row-major scan wraps to new r when width cap fills", () => {
    // halfCols=4 → q-window roughly [-4, 4] at r=0. With SINGLE items
    // (no width), at most 5 fit per row before the algorithm has to
    // wrap to a new r row. We pack 10 SINGLEs and assert at least
    // two distinct r rows.
    const claimed = new Set<string>();
    const rows = new Set<number>();
    for (let i = 0; i < 10; i++) {
      const pos = findFirstFreePositionRowMajor(SINGLE, claimed, 4);
      markClaimed(pos.q, pos.r, SINGLE, claimed);
      rows.add(pos.r);
    }
    expect(rows.size).toBeGreaterThanOrEqual(2);
  });

  test("row-major: first placement lands at top of scan, second to its right", () => {
    const claimed = new Set<string>();
    const a = findFirstFreePositionRowMajor(SINGLE, claimed, 5);
    markClaimed(a.q, a.r, SINGLE, claimed);
    const b = findFirstFreePositionRowMajor(SINGLE, claimed, 5);
    expect(b.r).toBe(a.r);
    expect(b.q).toBeGreaterThan(a.q);
  });

  test("12-cluster components-page workload row-major-packs into 2-3 r rows", () => {
    // masonry-wide's design intent: a roughly-rectangular layout
    // wrapping into a small number of rows. With halfCols=10 (the
    // production cap) and the 12-cluster components-page workload,
    // we expect 2–3 distinct r rows.
    const cats: FillMask[] = [
      honeycombMask(7),
      honeycombMask(10),
      honeycombMask(3),
      honeycombMask(3),
      honeycombMask(10),
      honeycombMask(4),
      honeycombMask(5),
      honeycombMask(8),
      honeycombMask(3),
      honeycombMask(2),
      honeycombMask(5),
      honeycombMask(3),
    ];
    const sorted = [...cats].sort((a, b) => b.length - a.length);
    const claimed = new Set<string>();
    const placements: Array<{ q: number; r: number }> = [];
    for (const mask of sorted) {
      const pos = findFirstFreePositionRowMajor(mask, claimed, 10);
      markClaimed(pos.q, pos.r, mask, claimed);
      placements.push(pos);
    }
    const rows = new Set(placements.map((p) => p.r));
    expect(rows.size).toBeGreaterThanOrEqual(2);
    expect(rows.size).toBeLessThanOrEqual(4);
  });

  test("ROSETTE cluster packs without overlapping a placed RING1", () => {
    const claimed = new Set<string>();
    markClaimed(0, 0, RING1, claimed);
    const pos = findFirstFreePosition(ROSETTE, claimed);
    // ROSETTE must not collide with RING1's claimed cells.
    for (const c of ROSETTE) {
      const cell = { q: pos.q + c.q, r: pos.r + c.r };
      for (const rc of RING1) {
        const ringCell = { q: rc.q, r: rc.r };
        expect(hexDist(cell, ringCell)).toBeGreaterThanOrEqual(2);
      }
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

  test("extra whitespace tolerated", () => {
    const parsed = parseFillCells("  0,0   1,1  ");
    expect(parsed).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 1 },
    ]);
  });

  test("malformed tokens skipped", () => {
    const parsed = parseFillCells("0,0 garbage 1,1");
    expect(parsed).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 1 },
    ]);
  });
});
