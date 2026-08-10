/*
  ─ Tile bake pass ─

  Renders one tessellation period of hex-stroke coverage into
  a small R8 texture, once per (hex-size, DPR) pair. Runtime
  then pays a single texture sample per fragment instead of
  ~30 ALU ops of hex math — and REPEAT wrap tiles it forever.
  (PLAN.hp-grid-smoothness.md § Decisions › Step 2 architecture)
*/

import { VERTEX_SHADER_SOURCE, createProgram } from "./gl.js";

/** √3 — pointy-top hex geometry constant (column step = side × √3). */
export const SQRT3 = Math.sqrt(3);

/** Supersample factor used at bake-time. Kept at 1 (native device-
 * pixel rate) — supersampling + any downsampling filter averaged the
 * thin stroke band across neighbouring texels and visibly dimmed the
 * pattern below the SVG reference. At 1× the bake renders with
 * fwidth AA directly at the final sample rate. Left as a named
 * constant so future tuning (an opt-in higher-quality mode) can just
 * bump this. */
export const SUPER_SAMPLE = 1;

/** Stroke half-width in CSS pixels — matches the SVG stroke-width of
 * 0.75 from the original implementation, halved because shader AA
 * bands the stroke symmetrically around its centre line. */
export const BASE_STROKE_HALF_WIDTH = 0.375;

/** Bake-time fragment shader. Computes pointy-top hex stroke coverage
 * for one tessellation tile via the "two-candidate-centre + closer-
 * wins" pattern, then emits AA-modulated coverage in the red channel. */
const BAKE_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

uniform float uHexSide;          // hex side length in bake-texture pixels
uniform float uStrokeHalfWidth;  // stroke half-width in bake-texture pixels

out vec4 fragColor;

const float SQRT3 = 1.7320508;

void main() {
  vec2 p = gl_FragCoord.xy;

  float s = uHexSide;
  float tileW = s * SQRT3;
  float tileH = 3.0 * s;

  // Tile-local position. The bake-texture is exactly one tile so this
  // mod is effectively identity, but kept explicit so the math is
  // robust to any future bake-target size change.
  vec2 tp = vec2(mod(p.x, tileW), mod(p.y, tileH));

  // Two hex-centre candidates per tile period: (0, 0) and its
  // wrap-equivalents at the four tile corners, plus the interior
  // centre at (tileW / 2, 1.5 * s). Pick whichever is nearest to
  // determine which hex this pixel belongs to.
  vec2 dA = tp - vec2(0.0, 0.0);
  vec2 dB = tp - vec2(tileW, 0.0);
  vec2 dC = tp - vec2(0.0, tileH);
  vec2 dD = tp - vec2(tileW, tileH);
  vec2 dE = tp - vec2(tileW * 0.5, 1.5 * s);

  vec2 best = dA;
  float bestSq = dot(dA, dA);
  float dBSq = dot(dB, dB);
  if (dBSq < bestSq) { best = dB; bestSq = dBSq; }
  float dCSq = dot(dC, dC);
  if (dCSq < bestSq) { best = dC; bestSq = dCSq; }
  float dDSq = dot(dD, dD);
  if (dDSq < bestSq) { best = dD; bestSq = dDSq; }
  float dESq = dot(dE, dE);
  if (dESq < bestSq) { best = dE; }

  // Distance from 'best' (offset from the nearest hex centre) to that
  // hex's nearest edge. Apothem = centre-to-edge = s * sqrt(3) / 2.
  // The three abs(dot) terms cover all six edges via the hex's
  // 3-fold symmetry.
  float apothem = s * SQRT3 * 0.5;
  float d1 = apothem - abs(best.x);
  float d2 = apothem - abs(0.5 * best.x + 0.5 * SQRT3 * best.y);
  float d3 = apothem - abs(0.5 * best.x - 0.5 * SQRT3 * best.y);
  float dist = min(d1, min(d2, d3));

  // Anti-aliased stroke coverage: 1 on the edge centre, smoothly
  // decaying to 0 at strokeHalfWidth + 1 derivative-pixel away.
  float fw = fwidth(dist);
  float coverage = 1.0 - smoothstep(uStrokeHalfWidth - fw, uStrokeHalfWidth + fw, dist);

  fragColor = vec4(coverage, 0.0, 0.0, 1.0);
}
`;

/**
 * Owns the baked tile texture and the pass that produces it. One
 * instance per element; resources are (re)created on context init /
 * restore via {@link init} and dropped via {@link release}.
 */
export class TilePipeline {
  private program: WebGLProgram | null = null;
  private fbo: WebGLFramebuffer | null = null;
  private uHexSideLoc: WebGLUniformLocation | null = null;
  private uStrokeHalfWidthLoc: WebGLUniformLocation | null = null;

  /** The baked coverage texture (REPEAT wrap, LINEAR filter), or null
   * before the first successful {@link init}. */
  texture: WebGLTexture | null = null;

  /** Visual tile period in device pixels at last bake — the runtime
   * shader's UV divisor. */
  tileSize: [number, number] = [0, 0];

  /** `devicePixelRatio` snapshotted at last bake; a mismatch with the
   * live value means a re-bake is due (window dragged between
   * displays of different DPR). */
  bakedDpr = 0;

  /** `hexSize` snapshotted at last bake; re-bake on mismatch. */
  bakedHexSize = 0;

  /**
   * Create the program, texture, and FBO on a fresh context.
   *
   * LINEAR (not LINEAR_MIPMAP_LINEAR): at SUPER_SAMPLE=1 the texel
   * rate matches the device-pixel rate so no mipmap level would ever
   * be selected — and mipmaps actively hurt intensity by averaging
   * the thin stroke across coarser LODs.
   *
   * @param gl - A live WebGL2 context.
   * @throws When program compilation or resource allocation fails
   *   (caller routes to the fallback path).
   */
  init(gl: WebGL2RenderingContext): void {
    this.program = createProgram(gl, VERTEX_SHADER_SOURCE, BAKE_FRAGMENT_SHADER_SOURCE);
    this.uHexSideLoc = gl.getUniformLocation(this.program, "uHexSide");
    this.uStrokeHalfWidthLoc = gl.getUniformLocation(this.program, "uStrokeHalfWidth");

    this.texture = gl.createTexture();
    if (!this.texture) {
      throw new Error("hp-background: gl.createTexture returned null");
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.fbo = gl.createFramebuffer();
    if (!this.fbo) {
      throw new Error("hp-background: gl.createFramebuffer returned null");
    }
  }

  /**
   * Render the coverage tile for the current hex size and DPR. Tile
   * dimensions are `hexSize × dpr × superSample × (√3, 3)` — exactly
   * one tessellation period, tiled at runtime by REPEAT wrap.
   *
   * @param gl - A live WebGL2 context.
   * @param hexSize - Hex side length in CSS pixels.
   * @returns False when the framebuffer is unexpectedly incomplete —
   *   the GL driver is misbehaving and the caller should fall back.
   */
  bake(gl: WebGL2RenderingContext, hexSize: number): boolean {
    if (!this.program || !this.texture || !this.fbo) {
      return false;
    }
    const dpr = window.devicePixelRatio || 1;
    const hexSide = hexSize * dpr * SUPER_SAMPLE;
    const strokeHalf = BASE_STROKE_HALF_WIDTH * dpr * SUPER_SAMPLE;
    const tileWBake = Math.max(1, Math.round(hexSide * SQRT3));
    const tileHBake = Math.max(1, Math.round(hexSide * 3));

    // Re-allocate (not just re-render): bake dimensions depend on
    // hexSize and DPR.
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, tileWBake, tileHBake, 0, gl.RED, gl.UNSIGNED_BYTE, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return false;
    }
    gl.viewport(0, 0, tileWBake, tileHBake);
    gl.disable(gl.BLEND);
    gl.useProgram(this.program);
    gl.uniform1f(this.uHexSideLoc, hexSide);
    gl.uniform1f(this.uStrokeHalfWidthLoc, strokeHalf);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.bakedDpr = dpr;
    this.bakedHexSize = hexSize;
    this.tileSize = [hexSize * dpr * SQRT3, hexSize * dpr * 3];
    return true;
  }

  /**
   * Delete GL resources and drop refs. Pass null after context loss —
   * deleting against a lost context is illegal, but the refs still
   * need clearing.
   *
   * @param gl - The context to delete against, or null when lost.
   */
  release(gl: WebGL2RenderingContext | null): void {
    if (gl) {
      if (this.program) {
        gl.deleteProgram(this.program);
      }
      if (this.texture) {
        gl.deleteTexture(this.texture);
      }
      if (this.fbo) {
        gl.deleteFramebuffer(this.fbo);
      }
    }
    this.program = null;
    this.texture = null;
    this.fbo = null;
    this.uHexSideLoc = null;
    this.uStrokeHalfWidthLoc = null;
    this.tileSize = [0, 0];
    this.bakedDpr = 0;
    this.bakedHexSize = 0;
  }
}
