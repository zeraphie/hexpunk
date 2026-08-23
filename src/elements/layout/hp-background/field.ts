/*
  ─ Energy field ─

  The soft-reveal memory: a low-res ping-pong texture that
  pointer movement splats energy into, and that diffuses and
  decays each simulation step. Hex strokes brighten where
  energy lives — the wake drifts and fades after the cursor
  has moved on, which is what makes v2 feel soft.
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

/** Maximum concurrent ignition-runner splats per step — matches the
 * shader's fixed uniform array (keep the GLSL array sizes and loop
 * bound in sync when changing this). */
export const MAX_RUNNER_SPLATS = 12;

/** Sim fragment shader: one step of decay × diffusion plus a
 * segment-shaped splat from the previous to the current pointer
 * position (a segment, not a point, so fast sweeps paint a
 * continuous wake with no gaps). All coordinates in field pixels. */
const SIM_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uFieldSize;
uniform float uDecay;          // effective per-step decay (dt-normalized)
uniform vec2 uSplatA;          // pointer segment start, field px
uniform vec2 uSplatB;          // pointer segment end, field px
uniform float uSplatRadius;    // gaussian radius, field px
uniform float uSplatStrength;  // 0 disables the splat term
uniform vec4 uRunnerSeg[12];    // ignition runner segments: a.xy, b.xy (field px)
uniform vec2 uRunnerParams[12]; // x = radius, y = strength (0 = inactive)

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

  // Pointer wake is CAPPED at 1.0: the hot tier (energy above 1.0)
  // belongs exclusively to the ignition runners, so sustained cursor
  // movement can saturate to bright but never reads hot. The max()
  // keeps the cap from ever reducing energy already above it (a
  // runner trail under the cursor).
  float d = sdSegment(gl_FragCoord.xy, uSplatA, uSplatB);
  float pointerTerm = uSplatStrength * exp(-(d * d) / max(uSplatRadius * uSplatRadius, 1e-4));
  energy = max(energy, min(energy + pointerTerm, 1.0));

  // Ignition runners: short glowing segments crawling along lattice
  // edges (paths computed on the CPU). Their trail deposit is capped
  // at 1.0 like the pointer wake — repeated frames near a slow head
  // would otherwise accumulate into the hot tier and wash out the
  // leading pixel. Hot is reserved for the DRAW-TIME head highlight
  // in the runtime pass, which is never stored here.
  float runnerSum = 0.0;
  for (int i = 0; i < 12; i++) {
    float rd = sdSegment(gl_FragCoord.xy, uRunnerSeg[i].xy, uRunnerSeg[i].zw);
    runnerSum += uRunnerParams[i].y * exp(-(rd * rd) / max(uRunnerParams[i].x * uRunnerParams[i].x, 1e-4));
  }
  energy = max(energy, min(energy + runnerSum, 1.0));

  // Cap keeps half-float precision comfortable (the stored field
  // never exceeds 1.0 now; the ceiling guards future sources).
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

/** One ignition-runner head segment for this step, all values in
 * field pixels. */
export interface RunnerSplat {
  ax: number;
  ay: number;
  bx: number;
  by: number;
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
  private readIndex: 0 | 1 = 0;
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
  private uRunnerSegLoc: WebGLUniformLocation | null = null;
  private uRunnerParamsLoc: WebGLUniformLocation | null = null;
  /** Scratch buffers for the runner uniform arrays. */
  private readonly runnerSegData = new Float32Array(MAX_RUNNER_SPLATS * 4);
  private readonly runnerParamData = new Float32Array(MAX_RUNNER_SPLATS * 2);

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
    this.uRunnerSegLoc = gl.getUniformLocation(this.program, "uRunnerSeg");
    this.uRunnerParamsLoc = gl.getUniformLocation(this.program, "uRunnerParams");
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
    for (const i of [0, 1] as const) {
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
   * @param runners - Ignition-runner head segments (at most
   *   {@link MAX_RUNNER_SPLATS}); pass an empty array for none.
   */
  step(
    gl: WebGL2RenderingContext,
    decay: number,
    splat: FieldSplat | null,
    runners: RunnerSplat[] = []
  ): void {
    if (!this.program || !this.textures[0]) {
      return;
    }
    const write: 0 | 1 = this.readIndex === 0 ? 1 : 0;
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
    this.runnerSegData.fill(0);
    this.runnerParamData.fill(0);
    for (let i = 0; i < Math.min(runners.length, MAX_RUNNER_SPLATS); i++) {
      const r = runners[i]!;
      this.runnerSegData[i * 4] = r.ax;
      this.runnerSegData[i * 4 + 1] = r.ay;
      this.runnerSegData[i * 4 + 2] = r.bx;
      this.runnerSegData[i * 4 + 3] = r.by;
      this.runnerParamData[i * 2] = r.radius;
      this.runnerParamData[i * 2 + 1] = r.strength;
    }
    gl.uniform4fv(this.uRunnerSegLoc, this.runnerSegData);
    gl.uniform2fv(this.uRunnerParamsLoc, this.runnerParamData);
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
    for (const i of [0, 1] as const) {
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
      for (const i of [0, 1] as const) {
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
    this.uRunnerSegLoc = null;
    this.uRunnerParamsLoc = null;
    this.width = 0;
    this.height = 0;
    this.readIndex = 0;
  }
}
