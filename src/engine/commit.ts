/*
  ─ Commit controller ─

  "Hex becomes the page": committing a cell tweens the camera
  until the cell's full-width band exceeds the viewport, locks
  horizontal pan, and clamps vertical pan to the cell — reading
  is scrolling, leaving is zooming out. The camera itself is the
  navigation transition.
*/
import type { Camera } from "./camera.js";
import type { CameraState, WorldRect } from "./types.js";

/** Committed page width as a fraction of the viewport. */
const FIT_FRACTION = 0.94;

/** Screen-edge padding (px) the clamp keeps around the page. */
const EDGE_PADDING = 24;

/** Zooming out past this fraction of the entry threshold ends the
 * commit — slightly under 1 so the exit needs a deliberate pull,
 * a stand-in until real hysteresis is tuned. */
const EXIT_FRACTION = 0.9;

export interface CommitOptions {
  camera: Camera;
  viewport: () => { width: number; height: number };
  /** Apparent-width fraction of the viewport that counts as
   * committed scale — exit fires below `EXIT_FRACTION ×` this. */
  commitFraction: number;
  onExit: () => void;
}

export class CommitController {
  private readonly options: CommitOptions;
  private target: WorldRect | null = null;
  private returnTo: CameraState | null = null;

  constructor(options: CommitOptions) {
    this.options = options;
  }

  get committed(): boolean {
    return this.target !== null;
  }

  /** Tween the camera onto `rect` and remember where we came from. */
  enter(rect: WorldRect): void {
    const { camera, viewport } = this.options;
    if (!this.target) {
      this.returnTo = camera.state;
    }
    this.target = rect;
    const { width } = viewport();
    const z = (width * FIT_FRACTION) / rect.w;
    camera.tweenTo({
      z,
      x: width / 2 - rect.cx * z,
      y: EDGE_PADDING - (rect.cy - rect.h / 2) * z,
    });
  }

  /** Leave the page, flying back to the pre-commit camera. */
  exit(): void {
    if (!this.target) {
      return;
    }
    this.target = null;
    const returnTo = this.returnTo;
    this.returnTo = null;
    if (returnTo) {
      this.options.camera.tweenTo(returnTo);
    }
    this.options.onExit();
  }

  /** Width-lock + vertical clamp; centres content shorter than the
   * viewport. Call after any committed-state pan or zoom. */
  clampPan(): void {
    if (!this.target) {
      return;
    }
    const { camera, viewport } = this.options;
    const { width, height } = viewport();
    const rect = this.target;
    camera.x = width / 2 - rect.cx * camera.z;
    const maxY = EDGE_PADDING - (rect.cy - rect.h / 2) * camera.z;
    const minY = height - EDGE_PADDING - (rect.cy + rect.h / 2) * camera.z;
    camera.y =
      minY > maxY ? height / 2 - rect.cy * camera.z : Math.min(maxY, Math.max(minY, camera.y));
  }

  /** After a zoom change while committed: exit once the cell drops
   * clearly below committed scale, else re-clamp. */
  handleZoom(): void {
    if (!this.target) {
      return;
    }
    const { camera, viewport, commitFraction } = this.options;
    const apparent = this.target.w * camera.z;
    if (apparent < viewport().width * commitFraction * EXIT_FRACTION) {
      this.exit();
    } else {
      this.clampPan();
    }
  }
}
