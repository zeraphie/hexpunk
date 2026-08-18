/**
 * Strategy-agnostic tests for the shared pack primitives —
 * `isPositionClear`, `markClaimed`, and `parseFillCells`. Per-strategy
 * tests live in `spiral.test.ts` and `rows.test.ts`.
 */

import { describe, expect, test } from "bun:test";

import { isPositionClear, markClaimed, parseFillCells } from "./index.js";
import { RING1, SINGLE, TEN_HONEYCOMB, place } from "./test-fixtures.js";

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

  test("hex-distance-2 tuck next to a 10-honeycomb is reachable", () => {
    const claimed = new Set<string>();
    markClaimed(0, 0, TEN_HONEYCOMB, claimed);
    expect(isPositionClear(1, 2, SINGLE, claimed)).toBe(true);
    expect(isPositionClear(3, -4, SINGLE, claimed)).toBe(true);
    expect(isPositionClear(-3, 2, SINGLE, claimed)).toBe(true);
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
