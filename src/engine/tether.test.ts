import { describe, expect, test } from "bun:test";
import { axialToWorld } from "./lattice.js";
import { OccupancyMap } from "./occupancy.js";
import { TetherController } from "./tether.js";

const SIDE = 64;

function makeController(
  cells: Record<string, [number, number]>,
  options: { instant?: boolean } = {}
): { controller: TetherController; occupancy: OccupancyMap } {
  const occupancy = new OccupancyMap();
  for (const [id, [q, r]] of Object.entries(cells)) {
    occupancy.place(id, { q, r });
  }
  const controller = new TetherController({
    occupancy,
    hexSide: SIDE,
    instant: options.instant,
    positionOf: (id) => {
      const cell = occupancy.cellOf(id);
      return cell ? axialToWorld(cell.q, cell.r, SIDE) : null;
    },
  });
  return { controller, occupancy };
}

describe("tether", () => {
  test("resolves a bezier between two occupants", () => {
    const { controller } = makeController({ a: [0, 0], b: [4, 0] });
    controller.add({ id: "t1", from: "a", to: "b" });
    const [path] = controller.paths(0);
    expect(path).toBeDefined();
    expect(path!.id).toBe("t1");
    // Anchors sit on the source/target hex rings, not the centres.
    const [ax, ay] = axialToWorld(0, 0, SIDE);
    expect(Math.hypot(path!.fromX - ax, path!.fromY - ay)).toBeCloseTo(SIDE, 3);
  });

  test("picks the shortest clear pair — facing vertices for a due-east run", () => {
    const { controller } = makeController({ a: [0, 0], b: [4, 0] });
    controller.add({ id: "t1", from: "a", to: "b" });
    const [path] = controller.paths(0);
    // Source anchor is right of its centre, target anchor left of its.
    const [ax] = axialToWorld(0, 0, SIDE);
    const [bx] = axialToWorld(4, 0, SIDE);
    expect(path!.fromX).toBeGreaterThan(ax);
    expect(path!.toX).toBeLessThan(bx);
  });

  test("routes around an obstacle to the clear side", () => {
    const clear = makeController({ a: [0, 0], b: [4, 0] });
    clear.controller.add({ id: "t1", from: "a", to: "b" });
    const straight = clear.controller.paths(0)[0]!;
    // Unobstructed, the shortest pair runs along the upper faces.
    expect(straight.fromY).toBeLessThan(0);
    expect(straight.toY).toBeLessThan(0);

    // Park a hex above the chord: the upper route now costs a
    // crossing (1000) and the equal-length lower route wins.
    const blocked = makeController({ a: [0, 0], b: [4, 0], wall: [2, -1] });
    blocked.controller.add({ id: "t1", from: "a", to: "b" });
    const detoured = blocked.controller.paths(0)[0]!;
    expect(detoured.fromY).toBeGreaterThan(0);
    expect(detoured.toY).toBeGreaterThan(0);
  });

  test("falls back to the shortest pair when every route is blocked", () => {
    // A hex directly between leaves no clear chord — the arc still
    // resolves rather than refusing to draw.
    const { controller } = makeController({ a: [0, 0], b: [4, 0], wall: [2, 0] });
    controller.add({ id: "t1", from: "a", to: "b" });
    expect(controller.paths(0)).toHaveLength(1);
  });

  test("never anchors on a vertex shared with an occupied neighbour", () => {
    // `east` sits on a's east face, so a's vertices 1 and 2 are out.
    const { controller } = makeController({ a: [0, 0], east: [1, 0], b: [0, 5] });
    controller.add({ id: "t1", from: "a", to: "b" });
    const path = controller.paths(0)[0]!;
    const [ax] = axialToWorld(0, 0, SIDE);
    const halfWidth = (Math.sqrt(3) * SIDE) / 2;
    // Vertices 1 and 2 are the only ones at +halfWidth.
    expect(path.fromX).toBeLessThan(ax + halfWidth - 0.001);
  });

  test("find matches a pair in either direction", () => {
    const { controller } = makeController({ a: [0, 0], b: [2, 0] });
    controller.add({ id: "t1", from: "a", to: "b" });
    expect(controller.find("a", "b")?.id).toBe("t1");
    expect(controller.find("b", "a")?.id).toBe("t1");
    expect(controller.find("a", "missing")).toBeNull();
  });

  test("removeFor drops every tether touching an occupant", () => {
    const { controller } = makeController({ a: [0, 0], b: [2, 0], c: [0, 2] });
    controller.add({ id: "t1", from: "a", to: "b" });
    controller.add({ id: "t2", from: "a", to: "c" });
    controller.add({ id: "t3", from: "b", to: "c" });
    controller.removeFor("a");
    expect(controller.list().map((t) => t.id)).toEqual(["t3"]);
  });

  test("re-picks with hysteresis and morphs, settling on the new pair", () => {
    const { controller, occupancy } = makeController({ a: [0, 0], b: [4, 0] });
    const settled: number[] = [];
    const tracked = new TetherController({
      occupancy,
      hexSide: SIDE,
      positionOf: (id) => {
        const cell = occupancy.cellOf(id);
        return cell ? axialToWorld(cell.q, cell.r, SIDE) : null;
      },
      onSettle: (detail) => settled.push(detail.fromVertex),
    });
    tracked.add({ id: "t1", from: "a", to: "b" });
    tracked.paths(0);
    expect(settled).toHaveLength(1);
    // Let the draw-in sweep finish so only the morph is in play.
    tracked.paths(50);
    expect(tracked.animating).toBe(false);

    // Move the target far north — the old anchor is no longer best.
    occupancy.place("b", { q: 0, r: -6 });
    tracked.paths(100);
    expect(tracked.animating).toBe(true);
    // Morph completes within its window and settles once more.
    tracked.paths(400);
    expect(tracked.animating).toBe(false);
    expect(settled).toHaveLength(2);
    expect(controller.size).toBe(0);
  });

  test("instant mode re-picks without a morph", () => {
    const { controller, occupancy } = makeController({ a: [0, 0], b: [4, 0] }, { instant: true });
    controller.add({ id: "t1", from: "a", to: "b" });
    controller.paths(0);
    occupancy.place("b", { q: 0, r: -6 });
    controller.paths(100);
    expect(controller.animating).toBe(false);
  });

  test("skips arcs whose endpoint has left the world", () => {
    const { controller, occupancy } = makeController({ a: [0, 0], b: [4, 0] });
    controller.add({ id: "t1", from: "a", to: "b" });
    occupancy.remove("b");
    expect(controller.paths(0)).toHaveLength(0);
  });
});
