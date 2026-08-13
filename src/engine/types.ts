/*
  ─ Engine contracts ─

  Shared types for the aesthetic-neutral hex canvas engine.
  The hexpunk look arrives as an EngineSkin built by the token
  bridge; nothing in the engine names a design-system token.
*/

/** Camera state in float64. screen = world × z + (x, y). */
export interface CameraState {
  x: number;
  y: number;
  z: number;
}

/** Axis-aligned rectangle in world units, centre + size. */
export interface WorldRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** Axial hex coordinate (pointy-top). */
export interface AxialCoord {
  q: number;
  r: number;
}

/**
 * Visual configuration for the canvas field. Colours are packed
 * 0xRRGGBB; widths are apparent screen pixels — the field's zoom
 * bands re-stroke so these hold steady at any zoom.
 */
export interface EngineSkin {
  strokeColor: number;
  strokeAlpha: number;
  strokeWidth: number;
  highlightColor: number;
  highlightWidth: number;
}
