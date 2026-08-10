/*
  ─ WebGL2 plumbing ─

  Context acquisition with the attribute set the on-demand
  render model needs, shader/program compilation with useful
  failure messages, and the shared fullscreen-triangle vertex
  stage both passes draw with.
  (PLAN.hp-grid-smoothness.md § Steps › Step 1)
*/

/** Vertex shader shared by the bake and runtime programs. Emits a
 * single triangle that covers the entire clip-space viewport, using
 * `gl_VertexID` so no vertex buffer is needed. */
export const VERTEX_SHADER_SOURCE = `#version 300 es
void main() {
  vec2 pos = vec2(
    (gl_VertexID == 1) ? 3.0 : -1.0,
    (gl_VertexID == 2) ? 3.0 : -1.0
  );
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

/**
 * Acquire a WebGL2 context configured for hp-background's on-demand
 * render model. Returns null when WebGL2 is unavailable (the caller
 * routes to the Option-C fallback).
 *
 * Attribute rationale:
 * - `antialias: false` — the bake pass does AA via `fwidth`; browser
 *   MSAA on the canvas would be redundant fillrate.
 * - `powerPreference: "low-power"` — decorative use case; lets
 *   battery-conscious systems route to the integrated GPU.
 * - `preserveDrawingBuffer: true` — critical for on-demand rendering.
 *   The default invalidates the buffer after each compositing pass,
 *   so any canvas region not visible at draw time would re-composite
 *   as blank once scrolled into view. Apps that redraw every rAF
 *   never notice; ours draws on demand. Costs one extra GPU copy.
 *
 * @param canvas - The shadow-root canvas element.
 * @returns A configured context, or null if WebGL2 init failed.
 */
export function acquireContext(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  return canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: true,
  });
}

/**
 * Detect a software rasterizer (tier 2 of the three-tier degradation
 * decision): hardware acceleration off, WebGL alive via SwiftShader /
 * llvmpipe / similar. Best-effort — Firefox sanitizes the renderer
 * string, in which case we report hardware and rely on the future
 * adaptive frame-time backstop (Step 4). A false negative only means
 * the energy sim runs slower; the static pattern is unaffected.
 *
 * @param gl - A live WebGL2 context.
 * @returns True when the context is software-rendered.
 */
export function isSoftwareRenderer(gl: WebGL2RenderingContext): boolean {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  if (!info) {
    return false;
  }
  const renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? "");
  return /swiftshader|llvmpipe|software|subzero/i.test(renderer);
}

/** Compile a WebGL2 shader, throwing with a useful message on failure. */
function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("hp-background: gl.createShader returned null");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`hp-background: shader compile failed: ${log}`);
  }
  return shader;
}

/**
 * Build a linked WebGL2 program from inline VS + FS sources. Shaders
 * are detached and deleted immediately after linking — they are only
 * needed at link time.
 *
 * @param gl - A live WebGL2 context.
 * @param vsSource - Vertex shader GLSL.
 * @param fsSource - Fragment shader GLSL.
 * @returns The linked program.
 * @throws When compilation or linking fails (caller falls back).
 */
export function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error("hp-background: gl.createProgram returned null");
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  const ok = gl.getProgramParameter(program, gl.LINK_STATUS);
  gl.detachShader(program, vs);
  gl.detachShader(program, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!ok) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`hp-background: program link failed: ${log}`);
  }
  return program;
}
