/*
  ─ Token bridge ─

  Canvas can't read CSS custom properties, so the engine reads
  --hp-* tokens off a host element via getComputedStyle and
  re-reads when the theme flips — themes keep flowing through
  custom properties, never through JS-set visual state.
*/
import { parseCssColor } from "../lib/css-color.js";

/** Colour resolved for the GPU: packed 0xRRGGBB plus alpha. */
export interface PackedColor {
  color: number;
  alpha: number;
}

/**
 * Resolve a custom property on `host` to a packed colour.
 * `fallback` covers hosts rendered outside the token cascade.
 */
export function readTokenColor(host: Element, property: string, fallback: string): PackedColor {
  const raw = getComputedStyle(host).getPropertyValue(property).trim() || fallback;
  const [r, g, b, a] = parseCssColor(raw);
  return {
    color: (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255),
    alpha: a,
  };
}

/**
 * Fires `onChange` when the document theme flips — a `data-theme`
 * attribute change on any ancestor of interest (observed on the
 * root element) or an OS-level colour-scheme switch.
 */
export class ThemeWatcher {
  private readonly observer: MutationObserver;
  private readonly mediaQuery: MediaQueryList | null;
  private readonly handleMediaChange: () => void;

  constructor(onChange: () => void) {
    this.observer = new MutationObserver(onChange);
    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    this.handleMediaChange = onChange;
    this.mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    this.mediaQuery?.addEventListener("change", this.handleMediaChange);
  }

  dispose(): void {
    this.observer.disconnect();
    this.mediaQuery?.removeEventListener("change", this.handleMediaChange);
  }
}
