/*
  ─ Option-C fallback tile ─

  When WebGL2 is unavailable the host paints a repeating
  SVG-data-URL hex tile instead — degraded but present, no
  cursor reactivity, inherently full-height (it is a CSS
  background, not a canvas).
  (PLAN.hp-grid-smoothness.md § Open questions › Q2, resolved)
*/

/**
 * Build a CSS data-URL repeating-hex-tile image, used as a
 * **mask** (not a background): a data-URL SVG is a separate document
 * that cannot see the page's `currentColor` — stroked that way it
 * always renders black. Instead the host paints
 * `background-color: var(--hp-bg-stroke)` and this tile masks it
 * into hex outlines, so the colour tracks the token cascade and
 * light/dark theme flips with no JS. Embeds a 5-hex tile (1 centred
 * + 4 corner-quartered) sized to `hexSize` so neighbouring tiles
 * assemble into a continuous tessellation under `mask-repeat`.
 *
 * @param hexSize - Hex side length in CSS pixels (centre-to-vertex).
 * @returns A `url("data:image/svg+xml;…")` value for `mask-image`.
 */
export function buildFallbackTileDataUrl(hexSize: number): string {
  const s = hexSize;
  const cw = s * Math.sqrt(3);
  const ch = s * 1.5;
  const tileW = cw;
  const tileH = 2 * ch;
  const hex = (cx: number, cy: number): string => {
    const pts: Array<[number, number]> = [
      [cx, cy - s],
      [cx + cw / 2, cy - s / 2],
      [cx + cw / 2, cy + s / 2],
      [cx, cy + s],
      [cx - cw / 2, cy + s / 2],
      [cx - cw / 2, cy - s / 2],
    ];
    return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  };
  const centres: Array<[number, number]> = [
    [cw / 2, ch],
    [0, 0],
    [tileW, 0],
    [0, tileH],
    [tileW, tileH],
  ];
  const polygons = centres.map(([cx, cy]) => `<polygon points="${hex(cx, cy)}"/>`).join("");
  // Stroke colour is irrelevant — CSS mask-image uses the alpha
  // channel; white keeps the intent obvious.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileW.toFixed(2)}" height="${tileH.toFixed(2)}" viewBox="0 0 ${tileW.toFixed(2)} ${tileH.toFixed(2)}"><g fill="none" stroke="#fff" stroke-width="0.75">${polygons}</g></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/**
 * Write the fallback tile image + dimensions + pointer-reveal radius
 * onto the host as inline custom properties so the
 * `:host([data-hp-fallback])` CSS picks them up and `hex-size` /
 * `pointer-radius` changes propagate.
 *
 * @param host - The hp-background element in fallback state.
 * @param hexSize - Hex side length in CSS pixels.
 * @param pointerRadius - Bright-reveal radius in CSS pixels.
 */
export function applyFallbackTile(host: HTMLElement, hexSize: number, pointerRadius: number): void {
  host.style.setProperty("--hp-bg-fallback-image", buildFallbackTileDataUrl(hexSize));
  const tileW = hexSize * Math.sqrt(3);
  const tileH = hexSize * 3;
  host.style.setProperty("--hp-bg-tile-width", `${tileW.toFixed(2)}px`);
  host.style.setProperty("--hp-bg-tile-height", `${tileH.toFixed(2)}px`);
  host.style.setProperty("--hp-bg-pointer-radius", `${pointerRadius}px`);
}
