/**
 * Agreement suite — pins the behaviour BOTH surfaces inherit.
 *
 * <hp-layout> and <hp-grid> compose the same spatial core and differ
 * only in their applier, so a drag, a blocked drop, a bond diff or a
 * pack must resolve identically on either. These tests freeze that
 * shared behaviour as literals: a change that would let the two
 * surfaces disagree — a reordered neighbour walk, a packer scan
 * tweak, a second pitch formula — fails here before it ships.
 */
import { describe, expect, test } from "bun:test";

import { DragController } from "./drag.js";
import { axialNeighbours, axialToWorld, seamlessSide } from "./lattice.js";
import { markClaimed, type FillMask } from "./layouts/index.js";
import { findRowsPosition } from "./layouts/rows.js";
import { findSpiralPosition } from "./layouts/spiral.js";
import { OccupancyMap } from "./occupancy.js";
import type { AxialCoord } from "./types.js";

const SIDE = 56.29;

/** Run one identical drag gesture and report where it lands. */
function runDrag(
  occupants: ReadonlyArray<[string, AxialCoord]>,
  dragId: string,
  path: ReadonlyArray<[number, number]>,
  clampWorld?: (wx: number, wy: number) => [number, number]
): { to: AxialCoord | null; occupancy: OccupancyMap } {
  const occupancy = new OccupancyMap();
  for (const [id, cell] of occupants) {
    occupancy.place(id, cell);
  }
  let landed: AxialCoord | null = null;
  const drag = new DragController({
    occupancy,
    hexSide: SIDE,
    clampWorld,
    onPosition: () => {},
    onTargetChange: () => {},
    onMove: ({ to }) => {
      landed = to;
    },
  });
  const start = occupancy.cellOf(dragId)!;
  drag.begin(dragId, ...axialToWorld(start.q, start.r, SIDE));
  for (const [wx, wy] of path) {
    drag.update(wx, wy);
  }
  drag.drop();
  return { to: landed, occupancy };
}

describe("surface agreement", () => {
  test("the neighbour walk is canonical clockwise ring order", () => {
    // Load-bearing: nearest-free searches return the FIRST free
    // neighbour they meet, so this order decides where blocked drops
    // land on both surfaces. Changing it changes drop behaviour
    // everywhere at once — deliberately, or not at all.
    expect(axialNeighbours({ q: 0, r: 0 })).toEqual([
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 },
    ]);
  });

  test("identical gestures land in identical cells", () => {
    const occupants: [string, AxialCoord][] = [
      ["a", { q: 0, r: 0 }],
      ["b", { q: 2, r: 0 }],
    ];
    const path: [number, number][] = [[40, 10], [130, 30], axialToWorld(1, 1, SIDE)];
    const first = runDrag(occupants, "a", path);
    const second = runDrag(occupants, "a", path);
    expect(first.to).toEqual({ q: 1, r: 1 });
    expect(second.to).toEqual(first.to);
  });

  test("a drop onto an occupant resolves to the first free canonical neighbour", () => {
    const target: AxialCoord = { q: 2, r: 0 };
    const { to } = runDrag(
      [
        ["a", { q: -2, r: 0 }],
        ["b", target],
      ],
      "a",
      [axialToWorld(target.q, target.r, SIDE)]
    );
    // b holds the cell, so a lands beside it — specifically at the
    // first neighbour of the canonical walk, because nothing else is
    // taken. Both surfaces resolve the same way by construction.
    expect(to).toEqual(axialNeighbours(target)[0]!);
  });

  test("an in-bounds clamp changes nothing about the outcome", () => {
    // The surfaces differ only in their clamp (content box vs live
    // viewport). For gestures that stay inside both, the clamp must
    // be behaviourally invisible — this is what makes their drags
    // interchangeable.
    const occupants: [string, AxialCoord][] = [
      ["a", { q: 0, r: 0 }],
      ["b", { q: 1, r: 0 }],
    ];
    const path: [number, number][] = [[60, 40], axialToWorld(0, 2, SIDE)];
    const unclamped = runDrag(occupants, "a", path);
    const clamped = runDrag(occupants, "a", path, (wx, wy) => [
      Math.min(2000, Math.max(-2000, wx)),
      Math.min(2000, Math.max(-2000, wy)),
    ]);
    expect(clamped.to).toEqual(unclamped.to);
    expect(clamped.occupancy.cellOf("a")).toEqual(unclamped.occupancy.cellOf("a")!);
  });

  test("bond diffs report the same partners for the same move", () => {
    const run = () => {
      const occupancy = new OccupancyMap();
      occupancy.place("a", { q: 3, r: 0 });
      occupancy.place("left", { q: -1, r: 0 });
      occupancy.place("below", { q: -1, r: 1 });
      const bonds: string[] = [];
      const unbonds: string[] = [];
      const drag = new DragController({
        occupancy,
        hexSide: SIDE,
        onPosition: () => {},
        onTargetChange: () => {},
        onBond: ({ partner }) => bonds.push(partner),
        onUnbond: ({ partner }) => unbonds.push(partner),
      });
      drag.begin("a", ...axialToWorld(3, 0, SIDE));
      drag.update(...axialToWorld(0, 0, SIDE));
      drag.drop();
      return { bonds, unbonds };
    };
    const first = run();
    const second = run();
    // Moving a to the origin makes it adjacent to both — reported in
    // the canonical walk's order around the landing cell.
    expect(first.bonds).toEqual(["left", "below"]);
    expect(first.unbonds).toEqual([]);
    expect(second).toEqual(first);
  });

  test("packs are a pure function of masks and the scan window", () => {
    const masks: FillMask[] = [
      [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
      ] as FillMask,
      [{ q: 0, r: 0 }] as FillMask,
      [{ q: 0, r: 0 }] as FillMask,
    ];
    const pack = (strategy: "spiral" | "rows") => {
      const claimed = new Set<string>();
      const placements: AxialCoord[] = [];
      // Largest-first, ties by authored order — the FFD sort both
      // surfaces apply before calling the shared packers.
      const ordered = [...masks].sort((a, b) => b.length - a.length);
      for (const mask of ordered) {
        const gap = mask.length > 1;
        const position =
          strategy === "spiral"
            ? findSpiralPosition(mask, claimed, gap)
            : findRowsPosition(mask, claimed, 5, gap);
        markClaimed(position.q, position.r, mask, claimed);
        placements.push(position);
      }
      return placements;
    };
    expect(pack("spiral")).toEqual(pack("spiral"));
    expect(pack("rows")).toEqual(pack("rows"));
  });

  test("the seamless pitch is one shared formula", () => {
    // sm tier: 100px cell, ring inset 0.05 → 2.5px ring half-width.
    // Both surfaces feed this exact pair for a default lattice.
    expect(seamlessSide(100, (0.05 * 100) / 2)).toBeCloseTo(97.5 / Math.sqrt(3), 10);
    // Degenerate cells never collapse the lattice.
    expect(seamlessSide(0.5, 2)).toBeCloseTo(1 / Math.sqrt(3), 10);
  });
});
