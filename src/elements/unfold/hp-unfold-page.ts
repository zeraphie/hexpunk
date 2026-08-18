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
// **Mechanism — overlay + View Transitions.** On click the shared
// departure sequence (departure.ts) creates a fixed-position
// hex-clipped div at the source's bbox, fills it with the source's
// `--hp-stroke-color`, and sets
// `view-transition-name: hp-unfold-source` on the overlay. The
// browser snapshots the overlay; the
// `::view-transition-old(hp-unfold-source)` keyframes (defined in
// the showcase's `global.css`) scale it up to viewport-covering
// size. The destination renders underneath and is revealed when the
// overlay's snapshot fades at the end of the keyframe.
//
// **Navigation is pluggable — library-wide.** The default is a full
// document navigation (`window.location.href`), which pairs the
// keyframes with the browser's cross-document View Transition. A
// consumer with a client-side router (SPA frameworks, Astro's
// ClientRouter) registers its own function once via `setNavigate`
// (src/lib/navigate.ts) — every navigating hexpunk element follows
// it, the overlay, keyframes, and sessionStorage handshake are
// identical, and the transition runs same-document, so the page's
// module state (and every custom-element definition) survives the
// trip.
//
// **Back navigation** replays the reverse from the destination
// side: the shell that owns navigation (see `Layout.astro` in the
// showcase) detects a history-traversal arrival via the
// `sessionStorage` marker the departure stamps, and shrinks a
// viewport-sized overlay back onto the source's bbox with the Web
// Animations API.
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
// **Parity.** Any `<a data-hp-unfold>` a page shell wires to
// `beginUnfoldNavigation` (see the showcase's Layout.astro) and any
// `<hp-nav-item unfold>` ride exactly the same departure sequence.

import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";
import { beginUnfoldNavigation, buildUnfoldOverlay, computePeakScale } from "./departure.js";

const ANIMATION_DURATION = 280;
const HOLD_DURATION = 180;
const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/**
 * Camera-zoom navigation primitive. Click the source hex (or any
 * <a data-hp-unfold>) and its colour rapidly expands to cover the
 * viewport, then the destination page is revealed. The View
 * Transitions API drives the animation — cross-document by default,
 * same-document when a client router registers the library-wide
 * `setNavigate`.
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
      this.startNavigation();
    }
  }

  /** Forward navigation — the shared departure sequence: overlay at
   * the source's bbox, keyframe peak, sessionStorage handshake,
   * then the library navigation delegate. */
  private startNavigation(): void {
    if (!this.href || !this.sourceEl) {
      return;
    }
    beginUnfoldNavigation(this.sourceEl, this.href);
  }

  /** Preview animation — no navigation, just plays the expand /
   * hold / shrink cycle so consumers can demo the visual. */
  private async playPreview(): Promise<void> {
    if (!this.sourceEl) {
      return;
    }
    const peak = computePeakScale(this.sourceEl.getBoundingClientRect());
    const overlay = buildUnfoldOverlay(this.sourceEl);
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
