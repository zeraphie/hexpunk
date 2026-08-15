import { describe, expect, test } from "bun:test";
import { OccupancyMap } from "./occupancy.js";

describe("occupancy", () => {
  test("place claims a cell and move frees the previous one", () => {
    const map = new OccupancyMap();
    expect(map.place("a", { q: 0, r: 0 })).toBe(true);
    expect(map.place("a", { q: 2, r: -1 })).toBe(true);
    expect(map.occupantAt({ q: 0, r: 0 })).toBeNull();
    expect(map.occupantAt({ q: 2, r: -1 })).toBe("a");
  });

  test("place refuses a cell held by another occupant", () => {
    const map = new OccupancyMap();
    map.place("a", { q: 0, r: 0 });
    expect(map.place("b", { q: 0, r: 0 })).toBe(false);
    expect(map.cellOf("b")).toBeNull();
  });

  test("findNearestFree returns the drop cell itself when free", () => {
    const map = new OccupancyMap();
    map.place("a", { q: 0, r: 0 });
    expect(map.findNearestFree({ q: 3, r: 3 })).toEqual({ q: 3, r: 3 });
  });

  test("findNearestFree skips occupied cells and ignores the dragged id", () => {
    const map = new OccupancyMap();
    map.place("a", { q: 0, r: 0 });
    map.place("b", { q: 1, r: 0 });
    const free = map.findNearestFree({ q: 0, r: 0 }, "a");
    expect(free).toEqual({ q: 0, r: 0 });
    const nudged = map.findNearestFree({ q: 1, r: 0 }, "a");
    expect(nudged).not.toEqual({ q: 1, r: 0 });
    expect(map.occupantAt(nudged!)).toBeNull();
  });

  test("occupiedNeighbours lists adjacent occupants only", () => {
    const map = new OccupancyMap();
    map.place("centre", { q: 0, r: 0 });
    map.place("east", { q: 1, r: 0 });
    map.place("far", { q: 3, r: 0 });
    expect(map.occupiedNeighbours({ q: 0, r: 0 }, "centre")).toEqual(["east"]);
  });

  test("a fully fenced region falls through to the next ring", () => {
    const map = new OccupancyMap();
    map.place("centre", { q: 0, r: 0 });
    for (const [q, r] of [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
    ] as const) {
      map.place(`ring-${q}-${r}`, { q, r });
    }
    const free = map.findNearestFree({ q: 0, r: 0 });
    expect(free).not.toBeNull();
    expect(map.occupantAt(free!)).toBeNull();
  });
});
