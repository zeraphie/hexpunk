/*
  ─ Drag controller ─

  Drag-to-move on the lattice with hp-grid's semantics: the
  occupant rides the pointer, the live snap target (nearest
  free cell by BFS) shows as the field highlight, release
  animates into the slot — or back to its origin when nothing
  free is in range. Move fires on release, drop when the snap
  animation settles, bond/unbond from the adjacency diff.
*/
import { axialToWorld, worldToAxial } from "./lattice.js";
import type { OccupancyMap } from "./occupancy.js";
import type { AxialCoord } from "./types.js";

/** Snap-into-slot animation length. Long enough to read as
 * settling, short enough that rapid re-drags never queue. */
const SNAP_DURATION_MS = 180;

export interface DragEventDetail {
  id: string;
  from: AxialCoord;
  to: AxialCoord;
}

export interface DragOptions {
  occupancy: OccupancyMap;
  hexSide: number;
  /** Reduced-motion: drops land instantly, no settle animation. */
  instant?: boolean;
  /** Graph-editor mode: a drop onto another occupant toggles a
   * tether between the pair and the source returns home, instead
   * of the source claiming a cell. */
  tetherMode?: () => boolean;
  /** Fires when a tether-mode drop lands on another occupant. */
  onTetherDrop?: (detail: { source: string; target: string }) => void;
  /** Position the occupant's visual at a world point. */
  onPosition: (id: string, wx: number, wy: number) => void;
  /** Live snap target while dragging (null = out of range). */
  onTargetChange: (target: AxialCoord | null) => void;
  onDragStart?: (id: string) => void;
  /** Fires on release, before the settle animation. */
  onMove?: (detail: DragEventDetail) => void;
  /** Fires when the settle animation completes. */
  onDrop?: (detail: { id: string; at: AxialCoord }) => void;
  onBond?: (detail: { id: string; partner: string }) => void;
  onUnbond?: (detail: { id: string; partner: string }) => void;
}

interface ActiveDrag {
  id: string;
  from: AxialCoord;
  /** Pointer-to-centre offset at grab, so cells don't jump. */
  grabDx: number;
  grabDy: number;
  wx: number;
  wy: number;
  target: AxialCoord | null;
}

interface SnapAnimation {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  at: AxialCoord;
  startedAt: number | null;
}

export class DragController {
  private readonly options: DragOptions;
  private active: ActiveDrag | null = null;
  private snap: SnapAnimation | null = null;

  constructor(options: DragOptions) {
    this.options = options;
  }

  get dragging(): boolean {
    return this.active !== null;
  }

  get animating(): boolean {
    return this.snap !== null;
  }

  /** Begin dragging the occupant of `cell` from a world point. */
  begin(id: string, pointerWx: number, pointerWy: number): void {
    const from = this.options.occupancy.cellOf(id);
    if (!from || this.active) {
      return;
    }
    this.snap = null;
    const [cx, cy] = axialToWorld(from.q, from.r, this.options.hexSide);
    this.active = {
      id,
      from,
      grabDx: cx - pointerWx,
      grabDy: cy - pointerWy,
      wx: cx,
      wy: cy,
      target: from,
    };
    this.options.onDragStart?.(id);
  }

  update(pointerWx: number, pointerWy: number): void {
    if (!this.active) {
      return;
    }
    const drag = this.active;
    drag.wx = pointerWx + drag.grabDx;
    drag.wy = pointerWy + drag.grabDy;
    this.options.onPosition(drag.id, drag.wx, drag.wy);
    const under = worldToAxial(drag.wx, drag.wy, this.options.hexSide);
    // Tether mode highlights whatever cell the pointer is over —
    // including occupied ones, since those are the tether targets.
    const target = this.tethering()
      ? under
      : this.options.occupancy.findNearestFree(under, drag.id);
    if (!coordsEqual(target, drag.target)) {
      drag.target = target;
      this.options.onTargetChange(target);
    }
  }

  private tethering(): boolean {
    return this.options.tetherMode?.() ?? false;
  }

  /** Release: claim the target (origin when out of range), fire
   * move + bond diff, start the settle animation. */
  drop(): void {
    if (!this.active) {
      return;
    }
    const { occupancy, onMove, onBond, onUnbond } = this.options;
    const drag = this.active;
    this.active = null;
    this.options.onTargetChange(null);

    // Tether mode: landing on another occupant toggles an arc and
    // sends the source home; empty cells still move normally.
    if (this.tethering() && drag.target) {
      const landedOn = occupancy.occupantAt(drag.target);
      if (landedOn && landedOn !== drag.id) {
        this.options.onTetherDrop?.({ source: drag.id, target: landedOn });
        this.settle(drag, drag.from);
        return;
      }
    }

    const to = drag.target ?? drag.from;
    const moved = !coordsEqual(to, drag.from);
    if (moved) {
      const partnersBefore = occupancy.occupiedNeighbours(drag.from, drag.id);
      occupancy.place(drag.id, to);
      const partnersAfter = occupancy.occupiedNeighbours(to, drag.id);
      onMove?.({ id: drag.id, from: drag.from, to });
      for (const partner of partnersAfter) {
        if (!partnersBefore.includes(partner)) {
          onBond?.({ id: drag.id, partner });
        }
      }
      for (const partner of partnersBefore) {
        if (!partnersAfter.includes(partner)) {
          onUnbond?.({ id: drag.id, partner });
        }
      }
    }
    this.settle(drag, to);
  }

  /** Animate the released occupant into `to` (or land it instantly
   * under reduced motion), then report the drop. */
  private settle(drag: ActiveDrag, to: AxialCoord): void {
    const [toX, toY] = axialToWorld(to.q, to.r, this.options.hexSide);
    if (this.options.instant) {
      this.options.onPosition(drag.id, toX, toY);
      this.options.onDrop?.({ id: drag.id, at: to });
      return;
    }
    this.snap = { id: drag.id, fromX: drag.wx, fromY: drag.wy, toX, toY, at: to, startedAt: null };
  }

  cancel(): void {
    if (!this.active) {
      return;
    }
    const drag = this.active;
    this.active = null;
    this.options.onTargetChange(null);
    const [x, y] = axialToWorld(drag.from.q, drag.from.r, this.options.hexSide);
    this.options.onPosition(drag.id, x, y);
  }

  /** Advance the settle animation. True while still moving. */
  step(now: number): boolean {
    if (!this.snap) {
      return false;
    }
    const snap = this.snap;
    if (snap.startedAt === null) {
      snap.startedAt = now;
    }
    const progress = Math.min(1, (now - snap.startedAt) / SNAP_DURATION_MS);
    // Ease-out cubic: fast leave, soft landing.
    const eased = 1 - Math.pow(1 - progress, 3);
    this.options.onPosition(
      snap.id,
      snap.fromX + (snap.toX - snap.fromX) * eased,
      snap.fromY + (snap.toY - snap.fromY) * eased
    );
    if (progress >= 1) {
      this.snap = null;
      this.options.onDrop?.({ id: snap.id, at: snap.at });
      return false;
    }
    return true;
  }
}

function coordsEqual(a: AxialCoord | null, b: AxialCoord | null): boolean {
  return a?.q === b?.q && a?.r === b?.r;
}
