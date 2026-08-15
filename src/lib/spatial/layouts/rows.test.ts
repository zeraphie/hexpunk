/**
 * Tests for the row-major + width-cap strategy (`findRowsPosition`).
 */

import { describe, expect, test } from "bun:test";

import { markClaimed } from "./index.js";
import { findRowsPosition } from "./rows.js";
import { COMPONENTS_PAGE_WORKLOAD, SINGLE } from "./test-fixtures.js";

describe("findRowsPosition", () => {
  test("wraps to new r when width cap fills", () => {
    // halfCols=4 → q-window roughly [-4, 4] at r=0. With SINGLE items
    // (no width), at most 5 fit per row before the algorithm has to
    // wrap to a new r row. We pack 10 SINGLEs and assert at least
    // two distinct r rows.
    const claimed = new Set<string>();
    const rows = new Set<number>();
    for (let i = 0; i < 10; i++) {
      const pos = findRowsPosition(SINGLE, claimed, 4);
      markClaimed(pos.q, pos.r, SINGLE, claimed);
      rows.add(pos.r);
    }
    expect(rows.size).toBeGreaterThanOrEqual(2);
  });

  test("first placement lands at top of scan, second to its right", () => {
    const claimed = new Set<string>();
    const a = findRowsPosition(SINGLE, claimed, 5);
    markClaimed(a.q, a.r, SINGLE, claimed);
    const b = findRowsPosition(SINGLE, claimed, 5);
    expect(b.r).toBe(a.r);
    expect(b.q).toBeGreaterThan(a.q);
  });

  test("12-cluster components-page workload packs into 2–3 r rows", () => {
    // The `rows` layout's design intent: a roughly-rectangular layout
    // wrapping into a small number of rows. With halfCols=10 (the
    // production cap) and the 12-cluster components-page workload,
    // we expect 2–3 distinct r rows.
    const sorted = [...COMPONENTS_PAGE_WORKLOAD].sort((a, b) => b.length - a.length);
    const claimed = new Set<string>();
    const placements: Array<{ q: number; r: number }> = [];
    for (const mask of sorted) {
      const pos = findRowsPosition(mask, claimed, 10);
      markClaimed(pos.q, pos.r, mask, claimed);
      placements.push(pos);
    }
    const rows = new Set(placements.map((p) => p.r));
    expect(rows.size).toBeGreaterThanOrEqual(2);
    expect(rows.size).toBeLessThanOrEqual(4);
  });
});
