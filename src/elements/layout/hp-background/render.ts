/*
  ─ Runtime pass ─

  One fullscreen triangle per redraw: sample the baked tile in
  shared page coordinates, blend faint→bright by cursor
  proximity, output premultiplied. Colour tokens are read from
  computed style at draw time so theme changes just work.
  (PLAN.hp-grid-smoothness.md § Steps › Step 2)
*/

import { type RgbaTuple, parseCssColor } from "../../../lib/css-color.js";
import type { TilePipeline } from "./bake.js";
import type { CanvasGeometry } from "./geometry.js";
import { VERTEX_SHADER_SOURCE, createProgram } from "./gl.js";

/** Sentinel mouse position. -1e6 puts the cursor far enough
 * off-canvas that the smoothstep halo collapses to zero everywhere
 * the visible viewport could ever reach. */
export const OFFSCREEN_MOUSE = -1e6;

/** Runtime fragment shader. Samples the baked tile texture with
 * REPEAT wrap, computes the cursor-halo blend, and outputs
 * premultiplied RGBA matching the context's premultipliedAlpha mode. */
const RUNTIME_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

uniform sampler2D uTileTex;
uniform vec2 uTileSize;          // visual tile period in device px (UV divisor)
uniform vec2 uOffset;            // page-coord offset in device px (see note)
uniform vec2 uMouse;             // mouse position in device px (canvas-local)
uniform float uPointerRadius;    // halo radius in device px
uniform vec4 uFaintColor;        // premultiplied
uniform vec4 uBrightColor;       // premultiplied

out vec4 fragColor;

void main() {
  // Page-attached sampling: every hp-background on the page samples
  // the same tiled texture using *page coordinates* rather than
  // canvas-local coordinates, so adjacent instances read as windows
  // onto one shared global hex grid. gl_FragCoord.y is y-up in WebGL
  // while page Y is y-down, so we flip y before adding the offset.
  vec2 page = vec2(gl_FragCoord.x, -gl_FragCoord.y) + uOffset;
  float coverage = texture(uTileTex, page / uTileSize).r;

  // Cursor halo stays canvas-local — it follows the actual on-screen
  // pointer, not a page-locked position.
  float halo = smoothstep(uPointerRadius, 0.0, distance(gl_FragCoord.xy, uMouse));
  vec4 col = mix(uFaintColor, uBrightColor, halo);
  fragColor = col * coverage;
}
`;

/** Per-draw inputs the element assembles for {@link RenderPass.draw}. */
export interface DrawInput {
  /** This frame's reconciled geometry (must be `visible: true`). */
  geometry: CanvasGeometry;
  /** The baked tile to sample. */
  tile: TilePipeline;
  /** Pointer position in viewport CSS px, or {@link OFFSCREEN_MOUSE}
   * sentinels when the halo should be suppressed (no pointer yet,
   * reduced motion). */
  mouseClientX: number;
  mouseClientY: number;
  /** Halo radius in CSS px. */
  pointerRadius: number;
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
  private uTileSizeLoc: WebGLUniformLocation | null = null;
  private uOffsetLoc: WebGLUniformLocation | null = null;
  private uMouseLoc: WebGLUniformLocation | null = null;
  private uPointerRadiusLoc: WebGLUniformLocation | null = null;
  private uFaintColorLoc: WebGLUniformLocation | null = null;
  private uBrightColorLoc: WebGLUniformLocation | null = null;

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
    this.uTileSizeLoc = gl.getUniformLocation(this.program, "uTileSize");
    this.uOffsetLoc = gl.getUniformLocation(this.program, "uOffset");
    this.uMouseLoc = gl.getUniformLocation(this.program, "uMouse");
    this.uPointerRadiusLoc = gl.getUniformLocation(this.program, "uPointerRadius");
    this.uFaintColorLoc = gl.getUniformLocation(this.program, "uFaintColor");
    this.uBrightColorLoc = gl.getUniformLocation(this.program, "uBrightColor");

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
    const dpr = window.devicePixelRatio || 1;
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

    gl.uniform2f(this.uTileSizeLoc, input.tile.tileSize[0], input.tile.tileSize[1]);
    gl.uniform2f(this.uOffsetLoc, geo.offLeft, geo.offBottom);

    // Convert stored viewport CSS coords to canvas-local device px.
    // The visible slice's viewport origin is recoverable from the
    // page-coord offset:
    //   visLeft   = offLeft   / dpr - scrollX
    //   visBottom = offBottom / dpr - scrollY
    const visLeft = geo.offLeft / dpr - window.scrollX;
    const visBottom = geo.offBottom / dpr - window.scrollY;
    gl.uniform2f(
      this.uMouseLoc,
      (input.mouseClientX - visLeft) * dpr,
      (visBottom - input.mouseClientY) * dpr
    );
    gl.uniform1f(this.uPointerRadiusLoc, input.pointerRadius * dpr);

    const cs = getComputedStyle(host);
    const faintOpacity = parseFloat(cs.getPropertyValue("--hp-bg-faint-opacity")) || 0;
    const brightOpacity = parseFloat(cs.getPropertyValue("--hp-bg-bright-opacity")) || 0;
    const faint = parseCssColor(cs.getPropertyValue("--hp-bg-stroke"));
    const bright = parseCssColor(cs.getPropertyValue("--hp-bg-stroke-bright"));
    this.bindPremultiplied(gl, this.uFaintColorLoc, faint, faintOpacity);
    this.bindPremultiplied(gl, this.uBrightColorLoc, bright, brightOpacity);

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
    this.uTileSizeLoc = null;
    this.uOffsetLoc = null;
    this.uMouseLoc = null;
    this.uPointerRadiusLoc = null;
    this.uFaintColorLoc = null;
    this.uBrightColorLoc = null;
  }
}
