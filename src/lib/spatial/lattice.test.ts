import { describe, expect, test } from "bun:test";
import { axialToWorld, colRange, hexCorners, hexWidth, rowRange, worldToAxial } from "./lattice.js";

const SIDE = 64;

describe("lattice", () => {
  test("axialToWorld and worldToAxial round-trip on cell centres", () => {
    for (let q = -5; q <= 5; q++) {
      for (let r = -5; r <= 5; r++) {
        const [x, y] = axialToWorld(q, r, SIDE);
        expect(worldToAxial(x, y, SIDE)).toEqual({ q, r });
      }
    }
  });

  test("points near a cell centre round to that cell", () => {
    const [x, y] = axialToWorld(3, -2, SIDE);
    expect(worldToAxial(x + SIDE * 0.3, y - SIDE * 0.3, SIDE)).toEqual({ q: 3, r: -2 });
  });

  test("hexCorners returns six vertices on the circumradius", () => {
    const pts = hexCorners(SIDE);
    expect(pts).toHaveLength(12);
    for (let i = 0; i < 12; i += 2) {
      expect(Math.hypot(pts[i]!, pts[i + 1]!)).toBeCloseTo(SIDE, 6);
    }
  });

  test("row and column ranges cover the cells inside a rect", () => {
    const [x, y] = axialToWorld(2, 1, SIDE);
    const [rMin, rMax] = rowRange(y - 1, y + 1, SIDE);
    expect(rMin).toBeLessThanOrEqual(1);
    expect(rMax).toBeGreaterThanOrEqual(1);
    const [qMin, qMax] = colRange(x - 1, x + 1, 1, SIDE);
    expect(qMin).toBeLessThanOrEqual(2);
    expect(qMax).toBeGreaterThanOrEqual(2);
  });

  test("hexWidth matches the horizontal centre spacing", () => {
    const [x0] = axialToWorld(0, 0, SIDE);
    const [x1] = axialToWorld(1, 0, SIDE);
    expect(x1 - x0).toBeCloseTo(hexWidth(SIDE), 6);
  });
});
