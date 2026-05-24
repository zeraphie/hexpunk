/**
 * Shared test fixtures for the packed-layout pack tests.
 *
 * Mirrors the `HONEYCOMB_POSITIONS` table in `../hp-cluster.ts` so
 * test fixtures match production layouts. Exposes pre-built masks
 * (`SINGLE`, `RING1`, `TEN_HONEYCOMB`, `ROSETTE`) plus the
 * `honeycombMask(n)` helper and the `place` / `hexDist` utilities
 * that every strategy test uses.
 */

import { type FillMask, markClaimed } from "./index.js";

/**
 * Claim a mask at `(q, r)` and return the mutated set so tests can
 * chain placements.
 */
export function place(claimed: Set<string>, q: number, r: number, mask: FillMask): Set<string> {
  markClaimed(q, r, mask, claimed);
  return claimed;
}

/**
 * Hex axial distance between two cells — the cube-coord trick reduced
 * to two terms. Used to assert ≥1-hex gap between any two placed
 * clusters' filled hexes.
 */
export function hexDist(
  a: { q: number; r: number },
  b: { q: number; r: number }
): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

/**
 * Real `hp-cluster` fill order — every honeycomb cluster with N
 * children fills the first N entries of this list. Kept in lock-step
 * with the CSS / `HONEYCOMB_POSITIONS` table in `hp-cluster.ts`.
 */
export const HONEYCOMB_FILL_ORDER: Array<{ q: number; r: number }> = [
  { q: 0, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -2 },
  { q: 1, r: -2 },
  { q: 2, r: -2 },
  { q: 2, r: -1 },
  { q: 2, r: 0 },
  { q: 1, r: 1 },
  { q: 0, r: 2 },
  { q: -1, r: 2 },
  { q: -2, r: 2 },
  { q: -2, r: 1 },
  { q: -2, r: 0 },
  { q: -1, r: -1 },
];

/**
 * Build a honeycomb fill mask containing the first N positions.
 *
 * @param childCount - Number of children in the synthetic cluster
 *   (1–19; clamped).
 */
export function honeycombMask(childCount: number): FillMask {
  return HONEYCOMB_FILL_ORDER.slice(0, Math.min(childCount, HONEYCOMB_FILL_ORDER.length));
}

/** Single-cell mask — the default for non-cluster children. */
export const SINGLE: FillMask = [{ q: 0, r: 0 }];

/** 7-child honeycomb — centre + full ring 1. */
export const RING1: FillMask = honeycombMask(7);

/** 10-child honeycomb — centre + ring 1 + 3 ring-2 hexes (the Forms /
 * Layout cluster shape on the components-page workload). */
export const TEN_HONEYCOMB: FillMask = honeycombMask(10);

/** 5-cell cross — `hp-cluster layout="rosette"`. */
export const ROSETTE: FillMask = [
  { q: 0, r: 0 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
];

/**
 * The 12-cluster components-page workload (centre + ring-1 / partial
 * ring-2 honeycombs). Mirrors the sitemap-derived categories.
 */
export const COMPONENTS_PAGE_WORKLOAD: FillMask[] = [
  honeycombMask(7), // Primitives
  honeycombMask(10), // Forms
  honeycombMask(3), // Status
  honeycombMask(3), // Loading
  honeycombMask(10), // Layout
  honeycombMask(4), // Images
  honeycombMask(5), // Navigation
  honeycombMask(8), // Overlays
  honeycombMask(3), // Messaging
  honeycombMask(2), // Tether
  honeycombMask(5), // Unfold
  honeycombMask(3), // Deprecated
];
