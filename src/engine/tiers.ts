/*
  ─ Semantic tiers ─

  Maps a cell's apparent (on-screen) size to a content tier —
  the semantic-zoom ladder: identity → summary → dossier → page.
  Pure math; consumers decide what each tier displays.
*/

/**
 * Tier for an apparent width against ascending thresholds:
 * below the first → 0, past the last → thresholds.length.
 */
export function tierFor(apparentWidth: number, thresholds: readonly number[]): number {
  let tier = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (apparentWidth >= thresholds[i]!) {
      tier = i + 1;
    }
  }
  return tier;
}
