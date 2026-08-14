import { describe, expect, test } from "bun:test";
import { DragController } from "./drag.js";
import { axialToWorld } from "./lattice.js";
import { OccupancyMap } from "./occupancy.js";
import type { AxialCoord } from "./types.js";

const SIDE = 64;

interface Harness {
  drag: DragController;
  occupancy: OccupancyMap;
  positions: [string, number, number][];
  drops: { id: string; at: AxialCoord }[];
  moves: { id: string; from: AxialCoord; to: AxialCoord }[];
}

function makeHarness(options: { tetherMode?: boolean } = {}): Harness {
  const occupancy = new OccupancyMap();
  occupancy.place("a", { q: 0, r: 0 });
  occupancy.place("b", { q: 3, r: 0 });
  const positions: [string, number, number][] = [];
  const drops: { id: string; at: AxialCoord }[] = [];
  const moves: { id: string; from: AxialCoord; to: AxialCoord }[] = [];
  const drag = new DragController({
    occupancy,
    hexSide: SIDE,
    tetherMode: () => options.tetherMode ?? false,
    onPosition: (id, wx, wy) => positions.push([id, wx, wy]),
    onTargetChange: () => {},
    onMove: (detail) => moves.push(detail),
    onDrop: (detail) => drops.push(detail),
  });
  return { drag, occupancy, positions, drops, moves };
}

describe("drag", () => {
  test("live position is only reported while a gesture owns the occupant", () => {
    const { drag } = makeHarness();
    expect(drag.livePositionOf("a")).toBeNull();
    drag.begin("a", 0, 0);
    drag.update(120, 40);
    expect(drag.livePositionOf("a")).toEqual([120, 40]);
    expect(drag.livePositionOf("b")).toBeNull();
    drag.drop();
    // Still settling — the occupant is mid-flight, not yet at rest.
    expect(drag.livePositionOf("a")).not.toBeNull();
    drag.step(0);
    drag.step(1000);
    expect(drag.livePositionOf("a")).toBeNull();
  });

  test("grabbing again mid-settle lands the previous drag instead of stranding it", () => {
    const { drag, drops, positions } = makeHarness();
    drag.begin("a", 0, 0);
    drag.update(300, 0);
    drag.drop();
    drag.step(0);
    expect(drops).toHaveLength(0);

    // Interrupt the settle well inside its window.
    drag.begin("b", ...(axialToWorld(3, 0, SIDE) as [number, number]));
    expect(drops).toHaveLength(1);
    expect(drops[0]!.id).toBe("a");
    // It lands exactly on its target cell, and stops being live.
    const [targetX, targetY] = axialToWorld(drops[0]!.at.q, drops[0]!.at.r, SIDE);
    const landing = positions.filter(([id]) => id === "a").pop()!;
    expect(landing[1]).toBeCloseTo(targetX, 6);
    expect(landing[2]).toBeCloseTo(targetY, 6);
    expect(drag.livePositionOf("a")).toBeNull();
  });

  test("cancel returns the occupant home and reports the drop", () => {
    const { drag, drops, positions } = makeHarness();
    drag.begin("a", 0, 0);
    drag.update(250, 90);
    drag.cancel();
    expect(drops).toHaveLength(1);
    expect(drops[0]!.at).toEqual({ q: 0, r: 0 });
    const [, x, y] = positions[positions.length - 1]!;
    const [homeX, homeY] = axialToWorld(0, 0, SIDE);
    expect(x).toBeCloseTo(homeX, 6);
    expect(y).toBeCloseTo(homeY, 6);
    expect(drag.livePositionOf("a")).toBeNull();
  });

  test("a tether-mode drop onto an occupant leaves the grid unchanged", () => {
    const harness = makeHarness({ tetherMode: true });
    const pairs: { source: string; target: string }[] = [];
    const drag = new DragController({
      occupancy: harness.occupancy,
      hexSide: SIDE,
      instant: true,
      tetherMode: () => true,
      onTetherDrop: (detail) => pairs.push(detail),
      onPosition: () => {},
      onTargetChange: () => {},
      onMove: (detail) => harness.moves.push(detail),
    });
    drag.begin("a", 0, 0);
    drag.update(...(axialToWorld(3, 0, SIDE) as [number, number]));
    drag.drop();
    expect(pairs).toEqual([{ source: "a", target: "b" }]);
    // No move fired, and both occupants kept their cells.
    expect(harness.moves).toHaveLength(0);
    expect(harness.occupancy.cellOf("a")).toEqual({ q: 0, r: 0 });
    expect(harness.occupancy.cellOf("b")).toEqual({ q: 3, r: 0 });
  });
});
