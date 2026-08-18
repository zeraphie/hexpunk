import { describe, expect, test } from "bun:test";
import { Camera } from "./camera.js";

function makeCamera(overrides: { instant?: boolean } = {}): Camera {
  return new Camera({ minZoom: 0.2, maxZoom: 14, onChange: () => {}, ...overrides });
}

describe("camera", () => {
  test("zoomAt keeps the world point under the cursor fixed", () => {
    const cam = makeCamera();
    cam.x = 120;
    cam.y = -40;
    const cursor: [number, number] = [300, 200];
    const before = cam.screenToWorld(...cursor);
    cam.zoomAt(...cursor, 1.7);
    const after = cam.screenToWorld(...cursor);
    expect(after[0]).toBeCloseTo(before[0], 9);
    expect(after[1]).toBeCloseTo(before[1], 9);
  });

  test("zoomAt clamps to the configured bounds", () => {
    const cam = makeCamera();
    cam.zoomAt(0, 0, 1000);
    expect(cam.z).toBe(14);
    cam.zoomAt(0, 0, 0.000001);
    expect(cam.z).toBe(0.2);
  });

  test("tween converges on the target and reports settled", () => {
    const cam = makeCamera();
    cam.tweenTo({ x: 500, y: -250, z: 4 });
    let now = 0;
    let moving = true;
    for (let i = 0; i < 600 && moving; i++) {
      now += 16.67;
      moving = cam.step(now);
    }
    expect(moving).toBe(false);
    expect(cam.x).toBeCloseTo(500, 3);
    expect(cam.y).toBeCloseTo(-250, 3);
    expect(cam.z).toBeCloseTo(4, 2);
  });

  test("instant mode jumps without animating", () => {
    const cam = makeCamera({ instant: true });
    cam.tweenTo({ x: 100, y: 100, z: 2 });
    expect(cam.animating).toBe(false);
    expect(cam.x).toBe(100);
    expect(cam.z).toBe(2);
  });

  test("inertia decays to a stop", () => {
    const cam = makeCamera();
    cam.startInertia(1.5, -0.5, 0);
    let now = 0;
    let moving = true;
    for (let i = 0; i < 2000 && moving; i++) {
      now += 16.67;
      moving = cam.step(now);
    }
    expect(moving).toBe(false);
    expect(cam.x).toBeGreaterThan(0);
    expect(cam.y).toBeLessThan(0);
  });
});
