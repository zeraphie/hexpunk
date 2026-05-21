// hp-unfold-page.ts — Camera-zoom unfold to a new route.
//
// Third of three sibling unfold primitives. Companion to:
// - hp-unfold-list (ring expansion in place)
// - hp-unfold-overlay (hex lightbox)
//
// **Visual:** the source hex's colour rapidly expands to cover the
// viewport, then the destination page is revealed underneath. Back
// navigation reverses — a viewport-sized hex shrinks back to the
// source's original position. The hex's CONTENT (label text) does
// NOT scale; only the colour / fill expands, since the animation
// targets a separate overlay element rather than the source's own
// snapshot.
//
// **Mechanism — overlay + cross-document View Transitions.** On
// click we create a fixed-position hex-clipped div at the source's
// bbox, fill it with the source's `--hp-stroke-color`, and set
// `view-transition-name: hp-unfold-source` on the overlay. The
// browser snapshots the overlay; the
// `::view-transition-old(hp-unfold-source)` keyframes (defined in
// the showcase's `global.css`) scale it up to viewport-covering
// size. The destination loads underneath and is revealed when the
// overlay's snapshot fades at the end of the keyframe.
//
// **Back navigation** uses the `pagereveal` event handler in
// `Layout.astro` to recreate an overlay at the source's bbox
// before first-paint of the returning page. The browser snapshots
// it as the new state and the
// `::view-transition-new(hp-unfold-source)` shrink keyframes drive
// the inverse animation. `sessionStorage` is used to track which
// element was clicked so the correct source is animated on return.
//
// **Preview mode.** A `preview` boolean attribute switches the
// element to a "play the animation without navigating" mode —
// useful for showcase demos. The overlay scales up, holds briefly,
// then scales back down via Web Animations API (no navigation, no
// view transition).
//
// **Authoring:**
//
// <hp-unfold-page href="/palette">
// <hp-cell variant="action" filled slot="source">palette</hp-cell>
// </hp-unfold-page>
//
// <hp-unfold-page preview>
// <hp-cell variant="action" filled slot="source">play</hp-cell>
// </hp-unfold-page>
//
// **Text-link parity.** Any `<a data-hp-unfold>` triggers the same
// animation via the global handler in Layout.astro — text links use
// the link's CSS `color` as the overlay fill. See that file for the
// shared overlay-creation logic; `hp-unfold-page` and the link
// handler are intentionally symmetrical.

import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

const VIEW_TRANSITION_NAME = "hp-unfold-source";
const STORAGE_TARGET = "hp-unfold-target";
const STORAGE_PEAK = "hp-unfold-peak";
const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
const ANIMATION_DURATION = 280;
const HOLD_DURATION = 180;
const MIN_PEAK_SCALE = 25;
const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/** Peak scale that gets the hex bbox to at least 2× the longer viewport
 * axis, so the hex's inscribed area covers the viewport from any
 * starting position. Returns at least MIN_PEAK_SCALE so very small
 * sources still get a meaningful expansion (and divide-by-zero is
 * impossible). */
function computePeakScale(rect: { width: number }): number {
  const target = 2 * Math.max(window.innerWidth, window.innerHeight);
  const w = Math.max(rect.width, 1);
  return Math.max(MIN_PEAK_SCALE, target / w);
}

/**
 * Camera-zoom navigation primitive. Click the source hex (or any
 * <a data-hp-unfold>) and its colour rapidly expands to cover the
 * viewport, then the destination page is revealed. View Transitions
 * API drive the cross-document animation.
 *
 * @slot source - The hex / element that triggers the expand
 */
@customElement("hp-unfold-page")
export class HpUnfoldPage extends LitElement {
  /** Target URL. Must be same-origin for cross-document View
   * Transitions to engage; cross-origin navigations skip the VT
   * and just navigate. */
  @property({ reflect: true })
  href = "";

  /** When set, clicking the source plays the expand-and-shrink
   * animation in place without navigating. The overlay scales up
   * to viewport coverage, holds, then scales back down. Use for
   * showcase demos and visual previews. */
  @property({ reflect: true, type: Boolean })
  preview = false;

  private sourceEl: HTMLElement | null = null;
  private sourceListeners: AbortController | null = null;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.sourceListeners?.abort();
    this.sourceListeners = null;
  }

  private readonly onSourceSlotChange = (ev: Event): void => {
    const slot = ev.target as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true });
    const nextSource = (assigned[0] as HTMLElement | undefined) ?? null;

    this.sourceListeners?.abort();
    this.sourceEl = nextSource;
    if (!nextSource) {
      return;
    }

    if (!nextSource.hasAttribute("tabindex")) {
      nextSource.setAttribute("tabindex", "0");
    }
    nextSource.setAttribute("role", this.preview ? "button" : "link");

    const ctl = new AbortController();
    nextSource.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        this.activate();
      },
      { signal: ctl.signal }
    );
    // Stop pan-passthrough when inside an hp-grid (same pattern as
    // hp-unfold-list / hp-unfold-overlay).
    nextSource.addEventListener(
      "pointerdown",
      (e) => {
        if ((e as PointerEvent).button !== 0) {
          return;
        }
        e.stopPropagation();
      },
      { signal: ctl.signal }
    );
    nextSource.addEventListener(
      "keydown",
      (e) => {
        const key = (e as KeyboardEvent).key;
        if (key === "Enter" || key === " ") {
          e.preventDefault();
          this.activate();
        }
      },
      { signal: ctl.signal }
    );
    this.sourceListeners = ctl;
  };

  /** Entry point for click / Enter / Space activations. Dispatches
   * to preview or navigate based on the attribute. */
  private activate(): void {
    if (this.preview) {
      void this.playPreview();
    } else {
      this.navigate();
    }
  }

  /** Forward navigation. Creates an overlay at the source's bbox,
   * names it for the cross-document VT, stashes the target URL
   * for back-nav arrival detection, then navigates. */
  private navigate(): void {
    if (!this.href || !this.sourceEl) {
      return;
    }
    const overlay = this.createOverlay();
    if (overlay) {
      overlay.style.viewTransitionName = VIEW_TRANSITION_NAME;
      document.body.appendChild(overlay);
      const peak = computePeakScale(this.sourceEl.getBoundingClientRect());
      // Set on the outgoing document so the view-transition snapshot
      // captures the right keyframe target; also stash for the
      // destination page's inline init to apply on arrival, since
      // custom properties don't cross document boundaries.
      document.documentElement.style.setProperty("--hp-unfold-peak", String(peak));
      try {
        sessionStorage.setItem(STORAGE_TARGET, new URL(this.href, location.origin).pathname);
        sessionStorage.setItem(STORAGE_PEAK, String(peak));
      } catch {
        // sessionStorage unavailable (private mode, blocked) — back
        // nav reverse animation won't run, but forward still works.
      }
    }
    window.location.href = this.href;
  }

  /** Preview animation — no navigation, just plays the expand /
   * hold / shrink cycle so consumers can demo the visual. */
  private async playPreview(): Promise<void> {
    if (!this.sourceEl) {
      return;
    }
    const peak = computePeakScale(this.sourceEl.getBoundingClientRect());
    const overlay = this.createOverlay();
    if (!overlay) {
      return;
    }
    document.body.appendChild(overlay);
    try {
      await overlay.animate([{ transform: "scale(1)" }, { transform: `scale(${peak})` }], {
        duration: ANIMATION_DURATION,
        easing: EASING,
        fill: "forwards",
      }).finished;
      await new Promise((r) => setTimeout(r, HOLD_DURATION));
      await overlay.animate([{ transform: `scale(${peak})` }, { transform: "scale(1)" }], {
        duration: ANIMATION_DURATION,
        easing: EASING,
        fill: "forwards",
      }).finished;
      await overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 120,
        fill: "forwards",
      }).finished;
    } finally {
      overlay.remove();
    }
  }

  /** Build the colour-only hex overlay at the source's current
   * bbox. The overlay carries no label / content — it's just the
   * source's "skin" — so when the snapshot scales, only the colour
   * expands. The original source (with its label) stays on the
   * page until the destination swaps in. */
  private createOverlay(): HTMLDivElement | null {
    if (!this.sourceEl) {
      return null;
    }
    const rect = this.sourceEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }
    const color = this.getSourceColor();
    const w = rect.width;
    const h = w * 1.1547;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    overlay.dataset.hpUnfoldOverlay = "";
    Object.assign(overlay.style, {
      position: "fixed",
      left: `${cx - w / 2}px`,
      top: `${cy - h / 2}px`,
      width: `${w}px`,
      height: `${h}px`,
      background: color,
      clipPath: HEX_CLIP,
      zIndex: "9999",
      pointerEvents: "none",
      transformOrigin: "center",
      willChange: "transform, opacity",
    });
    return overlay;
  }

  /** Resolve the source's intended "main" colour. Prefers
   * `--hp-stroke-color` (the hex's outline / fill token), falls
   * back to the element's computed colour, then to currentColor. */
  private getSourceColor(): string {
    if (!this.sourceEl) {
      return "currentColor";
    }
    const computed = window.getComputedStyle(this.sourceEl);
    const stroke = computed.getPropertyValue("--hp-stroke-color").trim();
    if (stroke) {
      return stroke;
    }
    const color = computed.color;
    if (color) {
      return color;
    }
    return "currentColor";
  }

  static override styles = [hpBase];

  override render() {
    return html`<slot name="source" @slotchange=${this.onSourceSlotChange}></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-unfold-page": HpUnfoldPage;
  }
}
