/*
  ─ Occupancy ─

  Which occupant sits on which axial cell — the source of truth
  drag-snap resolves against. Nearest-free lookup is a BFS over
  axial neighbours, so drops flow around occupied cells the way
  hp-grid's drag has always behaved.
*/
import { axialNeighbours } from "./lattice.js";
import type { AxialCoord } from "./types.js";

/** BFS gives up past this ring — a drop this far from any free
 * cell snaps back instead of teleporting across the world. */
const MAX_SEARCH_RINGS = 10;

function key(cell: AxialCoord): string {
  return `${cell.q},${cell.r}`;
}

export class OccupancyMap {
  private readonly cells = new Map<string, string>();
  private readonly byId = new Map<string, AxialCoord>();

  occupantAt(cell: AxialCoord): string | null {
    return this.cells.get(key(cell)) ?? null;
  }

  cellOf(id: string): AxialCoord | null {
    return this.byId.get(id) ?? null;
  }

  /** Every placed occupant id. */
  ids(): Iterable<string> {
    return this.byId.keys();
  }

  /** Claim a cell. Refuses (returns false) if another occupant
   * holds it — callers resolve a free cell first. */
  place(id: string, cell: AxialCoord): boolean {
    const holder = this.cells.get(key(cell));
    if (holder !== undefined && holder !== id) {
      return false;
    }
    const previous = this.byId.get(id);
    if (previous) {
      this.cells.delete(key(previous));
    }
    this.cells.set(key(cell), id);
    this.byId.set(id, cell);
    return true;
  }

  /** Drop every placement — a full rebuild, e.g. after a re-slot. */
  clear(): void {
    this.cells.clear();
    this.byId.clear();
  }

  remove(id: string): void {
    const cell = this.byId.get(id);
    if (cell) {
      this.cells.delete(key(cell));
      this.byId.delete(id);
    }
  }

  /**
   * Nearest free cell to `from`, ignoring `ignoreId`'s own claim
   * (a dragged occupant doesn't block itself). BFS in ring order —
   * the drop cell itself wins when free.
   */
  findNearestFree(from: AxialCoord, ignoreId?: string): AxialCoord | null {
    const visited = new Set<string>([key(from)]);
    let frontier: AxialCoord[] = [from];
    for (let ring = 0; ring <= MAX_SEARCH_RINGS; ring++) {
      for (const cell of frontier) {
        const holder = this.cells.get(key(cell));
        if (holder === undefined || holder === ignoreId) {
          return cell;
        }
      }
      const next: AxialCoord[] = [];
      for (const cell of frontier) {
        for (const neighbour of axialNeighbours(cell)) {
          const k = key(neighbour);
          if (!visited.has(k)) {
            visited.add(k);
            next.push(neighbour);
          }
        }
      }
      frontier = next;
    }
    return null;
  }

  /** Ids of occupants on the six neighbours of `cell`. */
  occupiedNeighbours(cell: AxialCoord, ignoreId?: string): string[] {
    const partners: string[] = [];
    for (const neighbour of axialNeighbours(cell)) {
      const holder = this.cells.get(key(neighbour));
      if (holder !== undefined && holder !== ignoreId) {
        partners.push(holder);
      }
    }
    return partners;
  }
}
