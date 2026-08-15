/*
  ─ Camera ─

  Float64 pan/zoom state — the single source of truth the Pixi
  world transform and the DOM overlay are both projected from.
  Owns the motion models: cursor-anchored zoom, decelerating
  inertia, and log-space tweens for fly-to moves.
*/
import type { CameraState } from "./types.js";

/** Inertia decay per 16.67 ms — pixi-viewport's reference feel. */
const FRICTION = 0.98;

/** Inertia ends below this speed (px/ms) — imperceptible drift. */
const MIN_INERTIA_SPEED = 0.002;

/** Tween damping rate (1/s). ≈ 90% of the remaining distance is
 * covered every 250 ms — snappy without reading as a cut. */
const TWEEN_LAMBDA = 9;

/** Tween close-enough cutoffs: stop within half a pixel of the
 * target position and within 0.4% of the target zoom. */
const TWEEN_EPSILON_PX = 0.5;
const TWEEN_EPSILON_LOG_Z = 0.004;

export interface CameraOptions {
  minZoom: number;
  maxZoom: number;
  /** Skip animation and jump instantly (reduced-motion). */
  instant?: boolean;
  /** Called after every state change, animated or direct. */
  onChange: () => void;
}

export class Camera {
  x = 0;
  y = 0;
  z = 1;

  private readonly options: CameraOptions;
  private inertia: { vx: number; vy: number; at: number } | null = null;
  private tween: CameraState | null = null;
  private tweenAt: number | null = null;

  constructor(options: CameraOptions) {
    this.options = options;
  }

  get state(): CameraState {
    return { x: this.x, y: this.y, z: this.z };
  }

  get animating(): boolean {
    return this.inertia !== null || this.tween !== null;
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.x) / this.z, (sy - this.y) / this.z];
  }

  worldToScreen(wx: number, wy: number): [number, number] {
    return [wx * this.z + this.x, wy * this.z + this.y];
  }

  panBy(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
    this.options.onChange();
  }

  /** Zoom by `factor` keeping the world point under `(sx, sy)`
   * fixed on screen — the cursor-anchored zoom feel. */
  zoomAt(sx: number, sy: number, factor: number): void {
    const next = Math.min(this.options.maxZoom, Math.max(this.options.minZoom, this.z * factor));
    if (next === this.z) {
      return;
    }
    const [wx, wy] = this.screenToWorld(sx, sy);
    this.z = next;
    this.x = sx - wx * next;
    this.y = sy - wy * next;
    this.options.onChange();
  }

  /** Start a decelerating glide from a release velocity (px/ms). */
  startInertia(vx: number, vy: number, now: number): void {
    if (this.options.instant) {
      return;
    }
    this.tween = null;
    this.inertia = { vx, vy, at: now };
    this.options.onChange();
  }

  /** Animate toward an absolute camera state. Zoom interpolates in
   * log space so a 2×-in feels like a 2×-out. Target zoom clamps
   * to the configured bounds. */
  tweenTo(target: CameraState): void {
    this.inertia = null;
    const z = Math.min(this.options.maxZoom, Math.max(this.options.minZoom, target.z));
    if (this.options.instant) {
      this.x = target.x;
      this.y = target.y;
      this.z = z;
      this.options.onChange();
      return;
    }
    this.tween = { x: target.x, y: target.y, z };
    this.tweenAt = null;
    this.options.onChange();
  }

  stopAnimations(): void {
    this.inertia = null;
    this.tween = null;
  }

  /** Advance animations to `now` (ms). Returns true while moving —
   * the render loop keeps scheduling frames as long as it does. */
  step(now: number): boolean {
    if (this.inertia) {
      const dt = Math.min(64, now - this.inertia.at);
      this.inertia.at = now;
      this.x += this.inertia.vx * dt;
      this.y += this.inertia.vy * dt;
      const decay = Math.pow(FRICTION, dt / 16.67);
      this.inertia.vx *= decay;
      this.inertia.vy *= decay;
      if (Math.hypot(this.inertia.vx, this.inertia.vy) < MIN_INERTIA_SPEED) {
        this.inertia = null;
      }
      return this.inertia !== null;
    }
    if (this.tween) {
      // Frame-rate-independent damping: cover 1 − e^(−λ·dt) of the
      // remaining distance regardless of display refresh rate.
      const dt = Math.min(64, this.tweenAt === null ? 16.67 : now - this.tweenAt) / 1000;
      this.tweenAt = now;
      const blend = 1 - Math.exp(-TWEEN_LAMBDA * dt);
      const logZ = Math.log(this.z);
      const logTarget = Math.log(this.tween.z);
      const nextLogZ =
        Math.abs(logTarget - logZ) < TWEEN_EPSILON_LOG_Z
          ? logTarget
          : logZ + (logTarget - logZ) * blend;
      this.z = Math.exp(nextLogZ);
      this.x += (this.tween.x - this.x) * blend;
      this.y += (this.tween.y - this.y) * blend;
      const settled =
        nextLogZ === logTarget &&
        Math.hypot(this.tween.x - this.x, this.tween.y - this.y) < TWEEN_EPSILON_PX;
      if (settled) {
        this.x = this.tween.x;
        this.y = this.tween.y;
        this.tween = null;
      }
      return this.tween !== null;
    }
    return false;
  }
}
