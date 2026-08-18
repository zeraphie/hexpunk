/*
  ─ Pointer + motion-preference tracking ─

  Window-level capture (the host is pointer-events: none, so
  it never sees its own events) storing raw viewport coords;
  conversion to canvas space happens at draw time where the
  geometry is known. Reduced-motion suppresses the halo live.
*/

import { OFFSCREEN_MOUSE } from "./render.js";

/** Elements whose activation a click is "for" — igniting on these
 * would visually compete with the component's own feedback. Shadow
 * internals are covered because the check walks composedPath(). */
const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "option",
  "audio[controls]",
  "video[controls]",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="option"]',
  '[role="combobox"]',
].join(",");

/** True when the event's composed path contains anything a click
 * meaningfully activates (incl. focusable hosts via tabindex >= 0). */
function isInteractionTarget(event: Event): boolean {
  for (const node of event.composedPath()) {
    if (!(node instanceof Element)) {
      continue;
    }
    if (node.matches(INTERACTIVE_SELECTOR)) {
      return true;
    }
    const tabindex = node.getAttribute("tabindex");
    if (tabindex !== null && Number.parseInt(tabindex, 10) >= 0) {
      return true;
    }
  }
  return false;
}

/**
 * Tracks the pointer position and the `prefers-reduced-motion`
 * preference for one element. The owner supplies a redraw scheduler;
 * the tracker never draws.
 *
 * Step 5 extends this module with touch + scroll energy splats — the
 * capture surface is deliberately isolated here so the element wiring
 * doesn't change when it does.
 */
export class PointerTracker {
  /** Last pointer position in viewport CSS coords, or the off-screen
   * sentinel before the first move / under reduced motion. */
  mouseClientX = OFFSCREEN_MOUSE;
  mouseClientY = OFFSCREEN_MOUSE;

  /** True while the user prefers reduced motion — the halo is
   * suppressed (mouse reads as off-screen) but the faint base
   * pattern still renders. */
  reducedMotion = false;

  private reducedMotionQuery: MediaQueryList | null = null;

  /**
   * @param onActivity - Called on every tracked change (pointer move
   *   or preference flip). The owner decides what a repaint means —
   *   scheduling a GL redraw on the canvas path, or repositioning
   *   the CSS reveal mask on the fallback path.
   * @param onIgniteStart - Called with viewport CSS coords when the
   *   user presses on something that is NOT an interaction target —
   *   ignition begins and continues while held. Owner applies
   *   mode/motion gating.
   * @param onIgniteEnd - Called on any pointer release/cancel —
   *   ignition winds down (cheap no-op when nothing was held).
   */
  constructor(
    private readonly onActivity: () => void,
    private readonly onIgniteStart: (clientX: number, clientY: number) => void,
    private readonly onIgniteEnd: () => void
  ) {}

  /** Attach window/media listeners. Call from connectedCallback. */
  connect(): void {
    // Pointermove is high-frequency; passive keeps it off the scroll
    // critical path.
    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", this.handlePointerDown, { passive: true });
    // Release anywhere ends the hold — including over interactive
    // elements and off-target cancels.
    window.addEventListener("pointerup", this.handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", this.handlePointerUp, { passive: true });
    if (typeof window.matchMedia === "function") {
      this.reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.reducedMotion = this.reducedMotionQuery.matches;
      this.reducedMotionQuery.addEventListener("change", this.handleReducedMotionChange);
    }
  }

  /** Detach everything attached by {@link connect}. */
  disconnect(): void {
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerUp);
    if (this.reducedMotionQuery) {
      this.reducedMotionQuery.removeEventListener("change", this.handleReducedMotionChange);
      this.reducedMotionQuery = null;
    }
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.mouseClientX = event.clientX;
    this.mouseClientY = event.clientY;
    this.onActivity();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (isInteractionTarget(event)) {
      return;
    }
    this.onIgniteStart(event.clientX, event.clientY);
  };

  private readonly handlePointerUp = (): void => {
    this.onIgniteEnd();
  };

  private readonly handleReducedMotionChange = (e: MediaQueryListEvent): void => {
    this.reducedMotion = e.matches;
    this.onActivity();
  };
}
