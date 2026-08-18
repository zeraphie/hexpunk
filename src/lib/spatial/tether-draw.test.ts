import { describe, expect, test } from "bun:test";
import { axialToWorld } from "./lattice.js";
import { OccupancyMap } from "./occupancy.js";
import { TetherController } from "./tether.js";

const SIDE = 64;
/** Mirrors the draw-in duration in tether.ts. */
const DRAW_IN_MS = 100;

function makeController(options: { instant?: boolean } = {}): TetherController {
  const occupancy = new OccupancyMap();
  occupancy.place("a", { q: 0, r: 0 });
  occupancy.place("b", { q: 5, r: 0 });
  return new TetherController({
    occupancy,
    hexSide: SIDE,
    instant: options.instant,
    positionOf: (id) => {
      const cell = occupancy.cellOf(id);
      return cell ? axialToWorld(cell.q, cell.r, SIDE) : null;
    },
  });
}

describe("tether draw-in", () => {
  test("a new arc starts short and reaches its endpoint", () => {
    const controller = makeController();
    controller.add({ id: "t1", from: "a", to: "b" });
    const start = controller.paths(0)[0]!;
    const full = controller.paths(DRAW_IN_MS)[0]!;
    // Mid-draw the visible end sits well short of the final anchor.
    const drawnLength = Math.hypot(start.toX - start.fromX, start.toY - start.fromY);
    const finalLength = Math.hypot(full.toX - full.fromX, full.toY - full.fromY);
    expect(drawnLength).toBeLessThan(finalLength * 0.2);
    expect(controller.animating).toBe(false);
  });

  test("the source anchor never moves while drawing", () => {
    const controller = makeController();
    controller.add({ id: "t1", from: "a", to: "b" });
    const early = controller.paths(0)[0]!;
    const mid = controller.paths(DRAW_IN_MS / 2)[0]!;
    expect(mid.fromX).toBeCloseTo(early.fromX, 6);
    expect(mid.fromY).toBeCloseTo(early.fromY, 6);
  });

  test("the drawn tip advances monotonically toward the target", () => {
    const controller = makeController();
    controller.add({ id: "t1", from: "a", to: "b" });
    const lengths = [0, DRAW_IN_MS * 0.3, DRAW_IN_MS * 0.7, DRAW_IN_MS].map((at) => {
      const path = controller.paths(at)[0]!;
      return Math.hypot(path.toX - path.fromX, path.toY - path.fromY);
    });
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i]!).toBeGreaterThan(lengths[i - 1]!);
    }
  });

  test("animating stays true until the sweep completes", () => {
    const controller = makeController();
    controller.add({ id: "t1", from: "a", to: "b" });
    expect(controller.animating).toBe(true);
    controller.paths(0);
    expect(controller.animating).toBe(true);
    controller.paths(DRAW_IN_MS - 1);
    expect(controller.animating).toBe(true);
    controller.paths(DRAW_IN_MS);
    expect(controller.animating).toBe(false);
  });

  test("drawInAll replays the sweep on settled arcs", () => {
    const controller = makeController();
    controller.add({ id: "t1", from: "a", to: "b" });
    controller.paths(0);
    controller.paths(DRAW_IN_MS);
    expect(controller.animating).toBe(false);

    controller.drawInAll();
    expect(controller.animating).toBe(true);
    const replay = controller.paths(1000)[0]!;
    const settled = controller.paths(1000 + DRAW_IN_MS)[0]!;
    const replayLength = Math.hypot(replay.toX - replay.fromX, replay.toY - replay.fromY);
    const settledLength = Math.hypot(settled.toX - settled.fromX, settled.toY - settled.fromY);
    expect(replayLength).toBeLessThan(settledLength * 0.2);
  });

  test("reduced motion skips the sweep entirely", () => {
    const controller = makeController({ instant: true });
    controller.add({ id: "t1", from: "a", to: "b" });
    expect(controller.animating).toBe(false);
    controller.drawInAll();
    expect(controller.animating).toBe(false);
    // The very first resolve is already the finished arc.
    const first = controller.paths(0)[0]!;
    const later = controller.paths(500)[0]!;
    expect(first.toX).toBeCloseTo(later.toX, 6);
    expect(first.toY).toBeCloseTo(later.toY, 6);
  });
});
