/*
  ─ Semantic tiers ─

  Maps a cell's apparent (on-screen) size to a content tier —
  the semantic-zoom ladder: identity → summary → dossier → page.
  Pure math; consumers decide what each tier displays.
*/

/**
 * Opacity for a detail layer that retires below `threshold`: 1 at or
 * above it, 0 at or below `startFraction × threshold`, and a linear
 * ramp between. Fading a layer out over a short band reads as detail
 * resolving; switching it at a hard boundary reads as a glitch.
 */
export function fadeAlpha(apparentWidth: number, threshold: number, startFraction: number): number {
  if (apparentWidth >= threshold) {
    return 1;
  }
  const start = threshold * startFraction;
  if (apparentWidth <= start || threshold <= start) {
    return 0;
  }
  return (apparentWidth - start) / (threshold - start);
}

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
