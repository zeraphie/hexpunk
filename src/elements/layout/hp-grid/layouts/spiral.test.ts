/**
 * Tests for the spiral-from-origin strategy (`findSpiralPosition`).
 */

import { describe, expect, test } from "bun:test";

import { type FillMask, markClaimed } from "./index.js";
import { findSpiralPosition } from "./spiral.js";
import {
  COMPONENTS_PAGE_WORKLOAD,
  RING1,
  ROSETTE,
  SINGLE,
  TEN_HONEYCOMB,
  hexDist,
  honeycombMask,
  place,
} from "./test-fixtures.js";

describe("findSpiralPosition", () => {
  test("first item lands at origin (spiral scan starts there)", () => {
    expect(findSpiralPosition(SINGLE, new Set())).toEqual({ q: 0, r: 0 });
  });

  test("second SINGLE lands at hex-distance 2 (closest legal tuck)", () => {
    // Ring 1 (distance 1) is all hex-adjacent to the placed SINGLE
    // → blocked. Ring 2 (distance 2) is the first ring with legal
    // positions. The spiral tie-break is `(r, q)` ascending, so we
    // get the topmost ring-2 hex first.
    const claimed = place(new Set(), 0, 0, SINGLE);
    const b = findSpiralPosition(SINGLE, claimed);
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
      const pos = findSpiralPosition(mask, claimed);
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
    const sorted = [...COMPONENTS_PAGE_WORKLOAD].sort((a, b) => b.length - a.length);
    const claimed = new Set<string>();
    const cells: Array<{ q: number; r: number }> = [];
    for (const mask of sorted) {
      const pos = findSpiralPosition(mask, claimed);
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

  test("12-cluster components-page snapshot packs without fallback", () => {
    const sorted = [...COMPONENTS_PAGE_WORKLOAD].sort((a, b) => b.length - a.length);
    const claimed = new Set<string>();
    const placements: Array<{ q: number; r: number }> = [];
    for (const mask of sorted) {
      const pos = findSpiralPosition(mask, claimed);
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

  test("ROSETTE cluster packs without overlapping a placed RING1", () => {
    const claimed = new Set<string>();
    markClaimed(0, 0, RING1, claimed);
    const pos = findSpiralPosition(ROSETTE, claimed);
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
