// departure.ts — Shared "unfold away to a route" sequence.
//
// The camera-zoom departure is one contract with three consumers:
// <hp-unfold-page>, <hp-nav-item unfold>, and any plain
// <a data-hp-unfold> a page shell wires up itself (see the
// showcase's Layout.astro). Each of them: build a hex-clipped
// overlay over the source's bbox, name it for the view transition,
// stash the target + peak scale so the destination's keyframes and
// the eventual back-navigation reversal can read them, then hand
// off to the library navigation delegate.
//
// No element registration happens here — hp-nav-item imports the
// sequence without pulling hp-unfold-page into its module graph.

import { hpNavigate } from "../../lib/navigate.js";

/** view-transition-name stamped on the departure overlay; the
 * consumer's ::view-transition-old(hp-unfold-source) keyframes
 * drive the expand. */
export const UNFOLD_VIEW_TRANSITION_NAME = "hp-unfold-source";

/** sessionStorage key holding the destination pathname — the
 * back-navigation reversal matches it against unfold sources on the
 * arrival page. */
export const UNFOLD_STORAGE_TARGET = "hp-unfold-target";

/** sessionStorage key holding the computed peak scale, applied to
 * --hp-unfold-peak on the destination so the keyframes hit the same
 * scale the departure computed. */
export const UNFOLD_STORAGE_PEAK = "hp-unfold-peak";

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
const MIN_PEAK_SCALE = 25;

/** Peak scale that gets the hex bbox to at least 2× the longer
 * viewport axis, so the hex's inscribed area covers the viewport
 * from any starting position. At least MIN_PEAK_SCALE so very small
 * sources still get a meaningful expansion (and divide-by-zero is
 * impossible). */
export function computePeakScale(rect: { width: number }): number {
  const target = 2 * Math.max(window.innerWidth, window.innerHeight);
  const w = Math.max(rect.width, 1);
  return Math.max(MIN_PEAK_SCALE, target / w);
}

/** Resolve the source's intended "main" colour: --hp-stroke-color
 * (a hex's outline / fill token) when set, else the computed text
 * colour (what a text link's expand should flood with), else the
 * brand primary. */
export function unfoldSourceColor(sourceEl: HTMLElement): string {
  const computed = window.getComputedStyle(sourceEl);
  const stroke = computed.getPropertyValue("--hp-stroke-color").trim();
  if (stroke) {
    return stroke;
  }
  if (computed.color) {
    return computed.color;
  }
  return "var(--hp-primary)";
}

/** Build the colour-only hex overlay at the source's current bbox.
 * The overlay carries no content — it's the source's "skin" — so
 * when it scales, only the colour expands while the original source
 * (with its label) stays on the page. Returns null when the source
 * has no usable bbox. */
export function buildUnfoldOverlay(
  sourceEl: HTMLElement,
  color: string = unfoldSourceColor(sourceEl)
): HTMLDivElement | null {
  const rect = sourceEl.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }
  // Seed from the larger axis so squat text links still produce a
  // hex that wraps their bbox; 32px floor keeps tiny sources from
  // degenerating into a sliver.
  const seed = Math.max(rect.width, rect.height, 32);
  const hexHeight = seed * 1.1547;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const overlay = document.createElement("div");
  overlay.setAttribute("aria-hidden", "true");
  overlay.dataset.hpUnfoldOverlay = "";
  Object.assign(overlay.style, {
    position: "fixed",
    left: `${cx - seed / 2}px`,
    top: `${cy - hexHeight / 2}px`,
    width: `${seed}px`,
    height: `${hexHeight}px`,
    background: color,
    clipPath: HEX_CLIP,
    zIndex: "9999",
    pointerEvents: "none",
    transformOrigin: "center",
    willChange: "transform, opacity",
  });
  return overlay;
}

/** The full departure: overlay + keyframe peak + sessionStorage
 * handshake, then navigation through the registered delegate. When
 * the source has no usable bbox the animation is skipped but the
 * navigation still happens. */
export function beginUnfoldNavigation(sourceEl: HTMLElement, href: string): void {
  const overlay = buildUnfoldOverlay(sourceEl);
  if (overlay) {
    overlay.style.viewTransitionName = UNFOLD_VIEW_TRANSITION_NAME;
    document.body.appendChild(overlay);
    const peak = computePeakScale(sourceEl.getBoundingClientRect());
    // Set on the outgoing document so the view-transition snapshot
    // captures the right keyframe target; also stash for the
    // destination to apply on arrival, since custom properties don't
    // cross document boundaries (and the router swap resets <html>).
    document.documentElement.style.setProperty("--hp-unfold-peak", String(peak));
    try {
      sessionStorage.setItem(UNFOLD_STORAGE_TARGET, new URL(href, location.origin).pathname);
      sessionStorage.setItem(UNFOLD_STORAGE_PEAK, String(peak));
    } catch {
      // sessionStorage unavailable (private mode, blocked) — the
      // back-navigation reversal won't run, but forward still works.
    }
  }
  hpNavigate(href);
}
