/*
  ─ Runtime pass ─

  One fullscreen triangle per redraw: sample the baked tile in
  shared page coordinates, brighten strokes by the energy
  field's local value, output premultiplied. Colour tokens are
  read from computed style at draw time so theme changes just
  work.
*/

import { type RgbaTuple, parseCssColor } from "../../../lib/css-color.js";
import type { TilePipeline } from "./bake.js";
import type { EnergyField } from "./field.js";
import type { CanvasGeometry } from "./geometry.js";
import { VERTEX_SHADER_SOURCE, createProgram } from "./gl.js";

/** Sentinel pointer position: far enough off-canvas that no splat
 * geometry derived from it can reach the visible viewport. */
export const OFFSCREEN_MOUSE = -1e6;

/** Runtime fragment shader. Samples the baked tile texture with
 * REPEAT wrap, brightens by the energy field, and outputs
 * premultiplied RGBA matching the context's premultipliedAlpha mode. */
const RUNTIME_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

uniform sampler2D uTileTex;
uniform sampler2D uFieldTex;
uniform vec2 uTileSize;          // visual tile period in device px (UV divisor)
uniform vec2 uOffset;            // page-coord offset in device px (see note)
uniform vec2 uCanvasSize;        // drawing buffer size in device px
uniform vec4 uFaintColor;        // premultiplied
uniform vec4 uBrightColor;       // premultiplied
uniform vec4 uHotColor;          // premultiplied — ignition hot tier
uniform vec4 uHeads[12];         // leading pixels: xy device px, z radius, w boost (0 = off)

out vec4 fragColor;

void main() {
  // Page-attached sampling: every hp-background on the page samples
  // the same tiled texture using *page coordinates* rather than
  // canvas-local coordinates, so adjacent instances read as windows
  // onto one shared global hex grid. gl_FragCoord.y is y-up in WebGL
  // while page Y is y-down, so we flip y before adding the offset.
  vec2 page = vec2(gl_FragCoord.x, -gl_FragCoord.y) + uOffset;
  float coverage = texture(uTileTex, page / uTileSize).r;

  // The energy field is viewport-attached and rendered in the same
  // gl_FragCoord orientation as this pass, so the UV is a straight
  // divide — no flip. Bilinear filtering on the low-res field gives
  // the wake its soft edge for free.
  float energy = texture(uFieldTex, gl_FragCoord.xy / uCanvasSize).r;

  // Leading-pixel highlight: runner heads glow at DRAW time only —
  // the boost is never written into the field, so the trail behind
  // keeps its own dimmer level while the head visibly leads the way.
  for (int i = 0; i < 12; i++) {
    float hd = distance(gl_FragCoord.xy, uHeads[i].xy);
    energy += uHeads[i].w * exp(-(hd * hd) / max(uHeads[i].z * uHeads[i].z, 1e-4));
  }

  vec4 col = mix(uFaintColor, uBrightColor, smoothstep(0.0, 1.0, energy));
  // Hot tier: energy above 1.0 (ignition rings overshoot there)
  // pushes past bright toward the hot colour, so the travelling
  // wavefront reads brighter than any pointer wake.
  col = mix(col, uHotColor, smoothstep(1.0, 1.4, energy));
  fragColor = col * coverage;
}
`;

/** One leading-pixel highlight, in canvas-local device px. */
export interface HeadGlow {
  x: number;
  y: number;
  radius: number;
  strength: number;
}

/** Maximum head highlights per draw — matches the shader's fixed
 * uniform array (keep the GLSL array size and loop bound in sync). */
export const MAX_HEADS = 12;

/** Per-draw inputs the element assembles for {@link RenderPass.draw}. */
export interface DrawInput {
  /** This frame's reconciled geometry (must be `visible: true`). */
  geometry: CanvasGeometry;
  /** The baked tile to sample. */
  tile: TilePipeline;
  /** The energy field whose current state brightens the strokes. */
  field: EnergyField;
  /** Live runner heads to highlight; empty when none. */
  heads: HeadGlow[];
}

/**
 * Owns the runtime program and the per-frame draw. One instance per
 * element; resources are (re)created on context init / restore via
 * {@link init} and dropped via {@link release}.
 */
export class RenderPass {
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private uTileTexLoc: WebGLUniformLocation | null = null;
  private uFieldTexLoc: WebGLUniformLocation | null = null;
  private uTileSizeLoc: WebGLUniformLocation | null = null;
  private uOffsetLoc: WebGLUniformLocation | null = null;
  private uCanvasSizeLoc: WebGLUniformLocation | null = null;
  private uFaintColorLoc: WebGLUniformLocation | null = null;
  private uBrightColorLoc: WebGLUniformLocation | null = null;
  private uHotColorLoc: WebGLUniformLocation | null = null;
  private uHeadsLoc: WebGLUniformLocation | null = null;
  /** Scratch buffer for the head uniform array. */
  private readonly headData = new Float32Array(MAX_HEADS * 4);

  /**
   * Create the runtime program and the (attribute-less) VAO WebGL2
   * requires for any draw call.
   *
   * @param gl - A live WebGL2 context.
   * @throws When compilation or allocation fails (caller falls back).
   */
  init(gl: WebGL2RenderingContext): void {
    this.program = createProgram(gl, VERTEX_SHADER_SOURCE, RUNTIME_FRAGMENT_SHADER_SOURCE);
    this.uTileTexLoc = gl.getUniformLocation(this.program, "uTileTex");
    this.uFieldTexLoc = gl.getUniformLocation(this.program, "uFieldTex");
    this.uTileSizeLoc = gl.getUniformLocation(this.program, "uTileSize");
    this.uOffsetLoc = gl.getUniformLocation(this.program, "uOffset");
    this.uCanvasSizeLoc = gl.getUniformLocation(this.program, "uCanvasSize");
    this.uFaintColorLoc = gl.getUniformLocation(this.program, "uFaintColor");
    this.uBrightColorLoc = gl.getUniformLocation(this.program, "uBrightColor");
    this.uHotColorLoc = gl.getUniformLocation(this.program, "uHotColor");
    this.uHeadsLoc = gl.getUniformLocation(this.program, "uHeads");

    this.vao = gl.createVertexArray();
    if (!this.vao) {
      throw new Error("hp-background: gl.createVertexArray returned null");
    }
    gl.bindVertexArray(this.vao);
  }

  /**
   * Draw one frame into the canvas backbuffer.
   *
   * @param gl - A live WebGL2 context.
   * @param host - The element, for computed-style token reads.
   * @param input - This frame's geometry, tile, and pointer state.
   */
  draw(gl: WebGL2RenderingContext, host: HTMLElement, input: DrawInput): void {
    if (!this.program || !input.tile.texture) {
      return;
    }
    const geo = input.geometry;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Premultiplied source-over: the shader outputs (rgb · α, α), so
    // the blend equation is (ONE, ONE_MINUS_SRC_ALPHA).
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, input.tile.texture);
    gl.uniform1i(this.uTileTexLoc, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, input.field.texture);
    gl.uniform1i(this.uFieldTexLoc, 1);

    gl.uniform2f(this.uTileSizeLoc, input.tile.tileSize[0], input.tile.tileSize[1]);
    gl.uniform2f(this.uOffsetLoc, geo.offLeft, geo.offBottom);
    gl.uniform2f(this.uCanvasSizeLoc, gl.drawingBufferWidth, gl.drawingBufferHeight);

    this.headData.fill(0);
    for (let i = 0; i < Math.min(input.heads.length, MAX_HEADS); i++) {
      const head = input.heads[i]!;
      this.headData[i * 4] = head.x;
      this.headData[i * 4 + 1] = head.y;
      this.headData[i * 4 + 2] = head.radius;
      this.headData[i * 4 + 3] = head.strength;
    }
    gl.uniform4fv(this.uHeadsLoc, this.headData);

    const cs = getComputedStyle(host);
    const faintOpacity = parseFloat(cs.getPropertyValue("--hp-bg-faint-opacity")) || 0;
    const brightOpacity = parseFloat(cs.getPropertyValue("--hp-bg-bright-opacity")) || 0;
    const faint = parseCssColor(cs.getPropertyValue("--hp-bg-stroke"));
    const bright = parseCssColor(cs.getPropertyValue("--hp-bg-stroke-bright"));
    // Hot tier defaults: the bright colour at double its opacity
    // (capped at 1) — visibly hotter without introducing a new hue
    // unless the consumer sets --hp-bg-stroke-hot explicitly.
    const hotRaw = cs.getPropertyValue("--hp-bg-stroke-hot").trim();
    const hot = hotRaw ? parseCssColor(hotRaw) : bright;
    const hotOpacityRaw = parseFloat(cs.getPropertyValue("--hp-bg-hot-opacity"));
    const hotOpacity = Number.isFinite(hotOpacityRaw)
      ? hotOpacityRaw
      : Math.min(1, brightOpacity * 2);
    this.bindPremultiplied(gl, this.uFaintColorLoc, faint, faintOpacity);
    this.bindPremultiplied(gl, this.uBrightColorLoc, bright, brightOpacity);
    this.bindPremultiplied(gl, this.uHotColorLoc, hot, hotOpacity);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Bind a colour uniform premultiplied: rgb · finalα where finalα =
   * parsedα · token opacity — what the shader's `col * coverage` and
   * the blend equation both expect. */
  private bindPremultiplied(
    gl: WebGL2RenderingContext,
    loc: WebGLUniformLocation | null,
    rgba: RgbaTuple,
    opacity: number
  ): void {
    const a = rgba[3] * opacity;
    gl.uniform4f(loc, rgba[0] * a, rgba[1] * a, rgba[2] * a, a);
  }

  /**
   * Delete GL resources and drop refs. Pass null after context loss.
   *
   * @param gl - The context to delete against, or null when lost.
   */
  release(gl: WebGL2RenderingContext | null): void {
    if (gl) {
      if (this.program) {
        gl.deleteProgram(this.program);
      }
      if (this.vao) {
        gl.deleteVertexArray(this.vao);
      }
    }
    this.program = null;
    this.vao = null;
    this.uTileTexLoc = null;
    this.uFieldTexLoc = null;
    this.uTileSizeLoc = null;
    this.uOffsetLoc = null;
    this.uCanvasSizeLoc = null;
    this.uFaintColorLoc = null;
    this.uBrightColorLoc = null;
    this.uHotColorLoc = null;
    this.uHeadsLoc = null;
  }
}
