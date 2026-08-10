/*
  ─ CSS colour parsing ─

  Resolves any CSS colour string to numeric RGBA by letting the
  browser's canvas-2D rasteriser do the parsing — one shared
  1×1 context, every colour form supported (oklch, color-mix,
  named colours) with no hand-rolled parser to maintain.
  (PLAN.hp-grid-smoothness.md § Decisions › Token bridge)
*/

/** Module-scoped canvas-2D context used to canonicalise / rasterise
 * CSS colour strings. Lazy-initialised on first call. */
let colorParserCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

function ensureColorParserCtx(): typeof colorParserCtx {
  if (colorParserCtx) {
    return colorParserCtx;
  }
  // willReadFrequently keeps the browser from round-tripping this
  // 1×1 canvas through the GPU — every use here is an immediate
  // getImageData readback.
  if (typeof OffscreenCanvas !== "undefined") {
    colorParserCtx = new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true });
  }
  if (!colorParserCtx && typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    colorParserCtx = c.getContext("2d", { willReadFrequently: true });
  }
  return colorParserCtx;
}

/** Non-premultiplied RGBA components, each in `[0, 1]`. */
export type RgbaTuple = [number, number, number, number];

/**
 * Resolve a CSS colour string to non-premultiplied `[r, g, b, a]` in
 * `[0, 1]`. Falls back to opaque black if canvas-2D is somehow
 * unavailable (extremely unlikely in any browser that has WebGL2).
 *
 * @param s - Any CSS colour string (`#rgb`, `oklch()`, `color-mix()`,
 *   named colours, …). Empty / whitespace parses as `transparent`.
 * @returns RGBA floats in `[0, 1]`, alpha not multiplied into RGB.
 */
export function parseCssColor(s: string): RgbaTuple {
  const ctx = ensureColorParserCtx();
  if (!ctx) {
    return [0, 0, 0, 1];
  }
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = s.trim() || "transparent";
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return [data[0]! / 255, data[1]! / 255, data[2]! / 255, data[3]! / 255];
}
