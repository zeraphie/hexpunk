import { describe, expect, test } from "bun:test";
import { fadeAlpha, tierFor } from "./tiers.js";

const THRESHOLDS = [100, 240, 520] as const;

describe("tiers", () => {
  test("below the first threshold is tier 0", () => {
    expect(tierFor(99.9, THRESHOLDS)).toBe(0);
  });

  test("thresholds are inclusive lower bounds", () => {
    expect(tierFor(100, THRESHOLDS)).toBe(1);
    expect(tierFor(240, THRESHOLDS)).toBe(2);
    expect(tierFor(520, THRESHOLDS)).toBe(3);
  });

  test("far past the last threshold stays at the top tier", () => {
    expect(tierFor(10_000, THRESHOLDS)).toBe(3);
  });

  test("empty thresholds always yield tier 0", () => {
    expect(tierFor(5_000, [])).toBe(0);
  });
});

describe("fadeAlpha", () => {
  test("is full at and above the threshold", () => {
    expect(fadeAlpha(100, 100, 0.6)).toBe(1);
    expect(fadeAlpha(500, 100, 0.6)).toBe(1);
  });

  test("is nothing at and below the ramp start", () => {
    expect(fadeAlpha(60, 100, 0.6)).toBe(0);
    expect(fadeAlpha(10, 100, 0.6)).toBe(0);
  });

  test("ramps linearly across the band", () => {
    expect(fadeAlpha(80, 100, 0.6)).toBeCloseTo(0.5, 6);
    expect(fadeAlpha(70, 100, 0.6)).toBeCloseTo(0.25, 6);
    expect(fadeAlpha(90, 100, 0.6)).toBeCloseTo(0.75, 6);
  });

  test("a zero-width band cannot divide by zero", () => {
    expect(fadeAlpha(50, 100, 1)).toBe(0);
    expect(fadeAlpha(100, 100, 1)).toBe(1);
  });
});
