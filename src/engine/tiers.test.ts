import { describe, expect, test } from "bun:test";
import { tierFor } from "./tiers.js";

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
