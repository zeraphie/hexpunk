// floating.ts — Shared positioning + dismiss helpers for floating
// elements (popover, dropdown-menu, context-menu, hover-card,
// menubar). Standalone module — components call into these functions
// rather than inheriting from a base class.
//
// Scope:
//
// - `positionFloating(anchorRect, floatingRect, viewport, options)` —
// compute the floating element's top-left corner given the anchor's
// bbox, the floating's bbox, and the viewport. Honours requested
// side + alignment, applies a configurable offset, flips to the
// opposite side when the requested placement would overflow the
// viewport (when `flip: true`, default).
//
// - `onOutsidePointer(floating, callback)` — fires the callback when
// a pointer event lands outside the floating element. Returns a
// dispose function the caller invokes on close.
//
// - `onEscape(callback)` — fires the callback on the next Escape
// keystroke. Returns a dispose function.
//
// No DOM mutations happen here. Components are responsible for
// applying the computed position to their own floating element
// (typically `style.left` / `style.top`) and for opening / closing.

export type FloatingSide = "top" | "right" | "bottom" | "left";
export type FloatingAlign = "start" | "center" | "end";

export interface FloatingPositionOptions {
  /** Preferred side relative to the anchor. */
  side?: FloatingSide;
  /** Alignment along the chosen side. */
  align?: FloatingAlign;
  /** Pixel gap between anchor and floating element. Default 6. */
  offset?: number;
  /** Flip to the opposite side if the preferred placement overflows
   * the viewport. Default true. */
  flip?: boolean;
  /** Pixel padding to keep between floating element and viewport
   * edges when shifting. Default 8. */
  viewportPadding?: number;
}

export interface FloatingPositionResult {
  /** Page-coordinate left position. */
  x: number;
  /** Page-coordinate top position. */
  y: number;
  /** Actual side used after flip evaluation. */
  side: FloatingSide;
  /** Actual alignment used (unchanged from input today; shift may
   * refine in a follow-up). */
  align: FloatingAlign;
}

interface Viewport {
  width: number;
  height: number;
}

const OPPOSITE: Record<FloatingSide, FloatingSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

/** Compute the (x, y) for a floating element placed against an
 * anchor. Both rects are in viewport coordinates (e.g., from
 * getBoundingClientRect()); result is in the same coordinate space.
 * Caller is responsible for adding scroll offsets if needed. */
export function positionFloating(
  anchorRect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  },
  floatingRect: { width: number; height: number },
  viewport: Viewport,
  options: FloatingPositionOptions = {}
): FloatingPositionResult {
  const side = options.side ?? "bottom";
  const align = options.align ?? "center";
  const offset = options.offset ?? 6;
  const flip = options.flip ?? true;
  const pad = options.viewportPadding ?? 8;

  const place = (s: FloatingSide): { x: number; y: number } => {
    let x = 0;
    let y = 0;
    if (s === "top" || s === "bottom") {
      // Above or below the anchor; align horizontally.
      if (align === "start") {
        x = anchorRect.left;
      } else if (align === "end") {
        x = anchorRect.right - floatingRect.width;
      } else {
        x = anchorRect.left + (anchorRect.width - floatingRect.width) / 2;
      }
      if (s === "top") {
        y = anchorRect.top - floatingRect.height - offset;
      } else {
        y = anchorRect.bottom + offset;
      }
    } else {
      // Left or right of anchor; align vertically.
      if (align === "start") {
        y = anchorRect.top;
      } else if (align === "end") {
        y = anchorRect.bottom - floatingRect.height;
      } else {
        y = anchorRect.top + (anchorRect.height - floatingRect.height) / 2;
      }
      if (s === "left") {
        x = anchorRect.left - floatingRect.width - offset;
      } else {
        x = anchorRect.right + offset;
      }
    }
    return { x, y };
  };

  const overflows = (s: FloatingSide, x: number, y: number): boolean => {
    if (s === "top") {
      return y < pad;
    }
    if (s === "bottom") {
      return y + floatingRect.height > viewport.height - pad;
    }
    if (s === "left") {
      return x < pad;
    }
    return x + floatingRect.width > viewport.width - pad;
  };

  let chosenSide = side;
  let { x, y } = place(side);

  if (flip && overflows(side, x, y)) {
    const alt = OPPOSITE[side];
    const altPlacement = place(alt);
    if (!overflows(alt, altPlacement.x, altPlacement.y)) {
      chosenSide = alt;
      x = altPlacement.x;
      y = altPlacement.y;
    }
  }

  // Final shift along the perpendicular axis so the floating element
  // doesn't bleed off-screen when the anchor is near an edge.
  if (chosenSide === "top" || chosenSide === "bottom") {
    x = Math.max(pad, Math.min(x, viewport.width - floatingRect.width - pad));
  } else {
    y = Math.max(pad, Math.min(y, viewport.height - floatingRect.height - pad));
  }

  return { x, y, side: chosenSide, align };
}

/** Listen for pointer events outside the given element and fire the
 * callback. Returns a dispose function. The callback receives the
 * original event so consumers can check details (e.g., button). */
export function onOutsidePointer(
  floating: HTMLElement,
  callback: (event: PointerEvent) => void
): () => void {
  const handler = (event: PointerEvent): void => {
    const path = event.composedPath();
    if (path.includes(floating)) {
      return;
    }
    callback(event);
  };
  // capture: true so we see the event before any descendant handlers
  // can stopPropagation. passive: true since we never call preventDefault.
  document.addEventListener("pointerdown", handler, { capture: true, passive: true });
  return () => {
    document.removeEventListener("pointerdown", handler, { capture: true });
  };
}

/** Listen for a single Escape press anywhere in the document. */
export function onEscape(callback: (event: KeyboardEvent) => void): () => void {
  const handler = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      callback(event);
    }
  };
  document.addEventListener("keydown", handler);
  return () => {
    document.removeEventListener("keydown", handler);
  };
}
