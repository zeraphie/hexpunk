/*
  ─ Energy field ─

  The soft-reveal memory: a low-res ping-pong texture that
  pointer movement splats energy into, and that diffuses and
  decays each simulation step. Hex strokes brighten where
  energy lives — the wake drifts and fades after the cursor
  has moved on, which is what makes v2 feel soft.
  (PLAN.hp-grid-smoothness.md § Decisions › energy-trail reveal)
*/

import { VERTEX_SHADER_SOURCE, createProgram } from "./gl.js";

/** Field resolution divisor: one field texel per 8×8 device-pixel
 * block. Diffusion at 1 field-px/step then spreads ~8 screen px per
 * frame — organic drift without a velocity sim — and the whole pass
 * costs ~1.5% of a fullscreen-resolution one. */
export const FIELD_SCALE = 8;

/** Energy below this reads as fully faded (the runtime smoothstep
 * output is imperceptible), so the loop can sleep once the whole
 * field must be under it. */
export const FIELD_EPSILON = 0.004;

/** Energy ceiling in the sim (headroom above 1.0 for the ignition
 * ring's hot tier). The analytic sleep window must assume this as
 * the starting energy. */
export const FIELD_MAX = 1.5;

/** Maximum concurrent ignition rings — matches the shader's fixed
 * uniform array. Older rings are dropped first. */
export const MAX_RINGS = 4;

/** Sim fragment shader: one step of decay × diffusion plus a
 * segment-shaped splat from the previous to the current pointer
 * position (a segment, not a point, so fast sweeps paint a
 * continuous wake with no gaps). All coordinates in field pixels. */
const SIM_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uFieldSize;
uniform float uDecay;          // effective per-step decay (dt-normalized)
uniform vec2 uSplatA;          // segment start, field px
uniform vec2 uSplatB;          // segment end, field px
uniform float uSplatRadius;    // gaussian radius, field px
uniform float uSplatStrength;  // 0 disables the splat term
uniform vec4 uRings[4];        // ignition rings: xy centre, z radius, w strength (field px)
uniform float uRingThickness;  // gaussian half-width of the ring band, field px

out vec4 fragColor;

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uFieldSize;
  vec2 px = 1.0 / uFieldSize;

  // 5-tap diffusion: centre keeps half its energy, the rest averages
  // in from the 4-neighbourhood. Weights sum to 1 so diffusion alone
  // conserves energy; uDecay is the only sink.
  float c = texture(uField, uv).r;
  float n = texture(uField, uv + vec2(0.0, px.y)).r;
  float s = texture(uField, uv - vec2(0.0, px.y)).r;
  float e = texture(uField, uv + vec2(px.x, 0.0)).r;
  float w = texture(uField, uv - vec2(px.x, 0.0)).r;
  float energy = (c * 0.5 + (n + s + e + w) * 0.125) * uDecay;

  float d = sdSegment(gl_FragCoord.xy, uSplatA, uSplatB);
  energy += uSplatStrength * exp(-(d * d) / max(uSplatRadius * uSplatRadius, 1e-4));

  // Ignition rings: an expanding annulus per active ring. The
  // runtime pass only brightens where hex strokes exist, so the
  // wavefront reads as light travelling along the lattice lines.
  float th2 = max(uRingThickness * uRingThickness, 1e-4);
  for (int i = 0; i < 4; i++) {
    float rd = abs(distance(gl_FragCoord.xy, uRings[i].xy) - uRings[i].z);
    energy += uRings[i].w * exp(-(rd * rd) / th2);
  }

  // Headroom above 1.0 feeds the runtime's hot tier (ignition
  // wavefront brighter than the pointer wake); the cap keeps
  // half-float precision comfortable.
  fragColor = vec4(min(energy, 1.5), 0.0, 0.0, 1.0);
}
`;

/** One pointer-movement splat, all values in field pixels. */
export interface FieldSplat {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  radius: number;
  strength: number;
}

/** One ignition ring for this step, all values in field pixels. */
export interface FieldRing {
  x: number;
  y: number;
  radius: number;
  strength: number;
}

/**
 * Owns the ping-pong energy textures and the simulation pass. One
 * instance per element; resources are (re)created on context init /
 * restore via {@link init} and dropped via {@link release}.
 */
export class EnergyField {
  private program: WebGLProgram | null = null;
  private textures: [WebGLTexture | null, WebGLTexture | null] = [null, null];
  private fbos: [WebGLFramebuffer | null, WebGLFramebuffer | null] = [null, null];
  /** Index of the texture currently holding the latest field state. */
  private readIndex = 0;
  /** True when R16F render targets are available; RGBA8 otherwise
   * (energy then clamps at 1.0 — visually equivalent, less headroom). */
  private halfFloat = false;

  private uFieldLoc: WebGLUniformLocation | null = null;
  private uFieldSizeLoc: WebGLUniformLocation | null = null;
  private uDecayLoc: WebGLUniformLocation | null = null;
  private uSplatALoc: WebGLUniformLocation | null = null;
  private uSplatBLoc: WebGLUniformLocation | null = null;
  private uSplatRadiusLoc: WebGLUniformLocation | null = null;
  private uSplatStrengthLoc: WebGLUniformLocation | null = null;
  private uRingsLoc: WebGLUniformLocation | null = null;
  private uRingThicknessLoc: WebGLUniformLocation | null = null;
  /** Scratch buffer for the ring uniform array (4 × vec4). */
  private readonly ringData = new Float32Array(MAX_RINGS * 4);

  /** Field texture dimensions (device px / FIELD_SCALE). */
  width = 0;
  height = 0;

  /** The texture holding the latest field state — what the runtime
   * pass samples. Null before init. */
  get texture(): WebGLTexture | null {
    return this.textures[this.readIndex];
  }

  /**
   * Compile the sim program and detect half-float renderability.
   * Textures are allocated lazily by {@link ensureSize}.
   *
   * @param gl - A live WebGL2 context.
   * @throws When program compilation fails (caller falls back).
   */
  init(gl: WebGL2RenderingContext): void {
    this.program = createProgram(gl, VERTEX_SHADER_SOURCE, SIM_FRAGMENT_SHADER_SOURCE);
    this.uFieldLoc = gl.getUniformLocation(this.program, "uField");
    this.uFieldSizeLoc = gl.getUniformLocation(this.program, "uFieldSize");
    this.uDecayLoc = gl.getUniformLocation(this.program, "uDecay");
    this.uSplatALoc = gl.getUniformLocation(this.program, "uSplatA");
    this.uSplatBLoc = gl.getUniformLocation(this.program, "uSplatB");
    this.uSplatRadiusLoc = gl.getUniformLocation(this.program, "uSplatRadius");
    this.uSplatStrengthLoc = gl.getUniformLocation(this.program, "uSplatStrength");
    this.uRingsLoc = gl.getUniformLocation(this.program, "uRings");
    this.uRingThicknessLoc = gl.getUniformLocation(this.program, "uRingThickness");
    // R16F is only renderable with this extension; half-float LINEAR
    // filtering is core WebGL2.
    this.halfFloat = gl.getExtension("EXT_color_buffer_float") !== null;
  }

  /**
   * Match the field to the canvas backing store, reallocating both
   * ping-pong textures when the size changes (which zeroes the field
   * — acceptable on resize).
   *
   * @param gl - A live WebGL2 context.
   * @param canvasW - Canvas backing-store width in device px.
   * @param canvasH - Canvas backing-store height in device px.
   */
  ensureSize(gl: WebGL2RenderingContext, canvasW: number, canvasH: number): void {
    const w = Math.max(1, Math.ceil(canvasW / FIELD_SCALE));
    const h = Math.max(1, Math.ceil(canvasH / FIELD_SCALE));
    if (w === this.width && h === this.height && this.textures[0]) {
      return;
    }
    this.width = w;
    this.height = h;
    for (let i = 0; i < 2; i++) {
      if (!this.textures[i]) {
        this.textures[i] = gl.createTexture();
        this.fbos[i] = gl.createFramebuffer();
      }
      gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (this.halfFloat) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, w, h, 0, gl.RED, gl.HALF_FLOAT, null);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[i]);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        this.textures[i],
        0
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.readIndex = 0;
  }

  /**
   * Advance the simulation one step: read the current field, write
   * decay × diffusion + splat into the other texture, swap.
   *
   * @param gl - A live WebGL2 context.
   * @param decay - Effective per-step decay (already dt-normalized).
   * @param splat - This frame's pointer splat, or null for none.
   * @param rings - Active ignition rings (at most {@link MAX_RINGS});
   *   pass an empty array for none.
   * @param ringThickness - Ring band gaussian half-width in field px.
   */
  step(
    gl: WebGL2RenderingContext,
    decay: number,
    splat: FieldSplat | null,
    rings: FieldRing[] = [],
    ringThickness = 1
  ): void {
    if (!this.program || !this.textures[0]) {
      return;
    }
    const write = 1 - this.readIndex;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[write]);
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.BLEND);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.readIndex]);
    gl.uniform1i(this.uFieldLoc, 0);
    gl.uniform2f(this.uFieldSizeLoc, this.width, this.height);
    gl.uniform1f(this.uDecayLoc, decay);
    if (splat) {
      gl.uniform2f(this.uSplatALoc, splat.ax, splat.ay);
      gl.uniform2f(this.uSplatBLoc, splat.bx, splat.by);
      gl.uniform1f(this.uSplatRadiusLoc, splat.radius);
      gl.uniform1f(this.uSplatStrengthLoc, splat.strength);
    } else {
      gl.uniform1f(this.uSplatStrengthLoc, 0);
      gl.uniform2f(this.uSplatALoc, 0, 0);
      gl.uniform2f(this.uSplatBLoc, 0, 0);
      gl.uniform1f(this.uSplatRadiusLoc, 1);
    }
    this.ringData.fill(0);
    for (let i = 0; i < Math.min(rings.length, MAX_RINGS); i++) {
      const ring = rings[i]!;
      this.ringData[i * 4] = ring.x;
      this.ringData[i * 4 + 1] = ring.y;
      this.ringData[i * 4 + 2] = ring.radius;
      this.ringData[i * 4 + 3] = ring.strength;
    }
    gl.uniform4fv(this.uRingsLoc, this.ringData);
    gl.uniform1f(this.uRingThicknessLoc, ringThickness);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.readIndex = write;
  }

  /**
   * Zero the field (both textures) without releasing resources —
   * used when reduced motion engages so the wake vanishes cleanly.
   *
   * @param gl - A live WebGL2 context.
   */
  clear(gl: WebGL2RenderingContext): void {
    for (let i = 0; i < 2; i++) {
      if (this.fbos[i]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[i]);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Delete GL resources and drop refs. Pass null after context loss.
   *
   * @param gl - The context to delete against, or null when lost.
   */
  release(gl: WebGL2RenderingContext | null): void {
    if (gl) {
      for (let i = 0; i < 2; i++) {
        if (this.textures[i]) {
          gl.deleteTexture(this.textures[i]);
        }
        if (this.fbos[i]) {
          gl.deleteFramebuffer(this.fbos[i]);
        }
      }
      if (this.program) {
        gl.deleteProgram(this.program);
      }
    }
    this.textures = [null, null];
    this.fbos = [null, null];
    this.program = null;
    this.uFieldLoc = null;
    this.uFieldSizeLoc = null;
    this.uDecayLoc = null;
    this.uSplatALoc = null;
    this.uSplatBLoc = null;
    this.uSplatRadiusLoc = null;
    this.uSplatStrengthLoc = null;
    this.uRingsLoc = null;
    this.uRingThicknessLoc = null;
    this.width = 0;
    this.height = 0;
    this.readIndex = 0;
  }
}
