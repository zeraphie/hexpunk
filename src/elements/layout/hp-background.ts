// hp-background.ts — Pointer-aware hex grid backdrop.
//
// A faint SVG hex tile pattern that fills its host area. Lines brighten
// in a soft circle around the pointer, giving any surface (hp-grid
// demo canvas, document body, full-screen showcase chrome) a subtle
// sense of presence without competing with the foreground.
//
// **Two-layer SVG** — both layers draw the same hex grid:
//
// - Bottom layer (always visible) strokes at --hp-outline-faint.
// - Top layer strokes at --hp-outline (brighter) but is masked by a
// radial gradient centered at the cursor. Within the radius the
// mask is opaque so the brighter strokes show through; outside
// it's transparent so only the faint layer reads.
//
// The cursor position is captured via a window-level pointermove
// listener and written to --hp-bg-x / --hp-bg-y as pixel offsets
// relative to the host bbox. The radial-gradient mask consumes those
// custom properties directly — no per-frame DOM updates beyond a
// single style set, no rAF loop. Performance is fine even with the
// backdrop applied to large surfaces.
//
// **Layout** — position: absolute, inset: 0, pointer-events: none.
// Drop one in as a child of any positioned container (hp-grid, a
// demo wrapper, the document body) and it stretches to fill while
// staying out of the hit-test path. Stroke colour reads from
// currentColor, so consumers can tint via the standard `color`
// property or the --hp-outline-faint / --hp-outline tokens.

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/** Build a CSS data-URL repeating-hex-tile background, used as the
 * Option-C fallback when WebGL2 init fails or the context is lost.
 * Embeds a 5-hex tile (1 centered + 4 corner-quartered) sized to
 * `hexSize` so neighbouring tiles assemble into a continuous
 * tessellation when CSS `background-repeat: repeat` tiles them. The
 * stroke uses `currentColor` so the host's `color` (set to
 * `--hp-bg-stroke` via the fallback `:host` rules) drives the tint. */
function buildFallbackTileDataUrl(hexSize: number): string {
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileW.toFixed(2)}" height="${tileH.toFixed(2)}" viewBox="0 0 ${tileW.toFixed(2)} ${tileH.toFixed(2)}"><g fill="none" stroke="currentColor" stroke-width="0.75">${polygons}</g></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/** √3 — pointy-top hex geometry constant (column step = side × √3). */
const SQRT3 = Math.sqrt(3);
/** Supersample factor used at bake-time. Kept at 1 (native device-
 * pixel rate) — supersampling + mipmap or supersampling + LINEAR
 * downsampling both averaged the thin stroke band across neighbouring
 * texels and visibly dimmed the pattern below the SVG reference. At
 * 1× the bake renders with fwidth AA directly at the final sample
 * rate, matching SVG-equivalent line intensity. Left as a named
 * constant so future tuning (e.g. an opt-in higher-quality mode) can
 * just bump this. */
const SUPER_SAMPLE = 1;
/** Stroke half-width in CSS pixels — matches the SVG `stroke-width:
 * 0.75` of the prior implementation, halved because shader AA bands
 * the stroke symmetrically around its centre line. */
const BASE_STROKE_HALF_WIDTH = 0.375;
/** Sentinel mouse position. `vec2(-1e6)` puts the cursor far enough
 * off-canvas that the smoothstep halo collapses to zero everywhere
 * the visible viewport could ever reach. */
const OFFSCREEN_MOUSE = -1e6;

/** Vertex shader shared by the bake and runtime programs. Emits a
 * single triangle that covers the entire clip-space viewport, using
 * `gl_VertexID` so no vertex buffer is needed. */
const VERTEX_SHADER_SOURCE = `#version 300 es
void main() {
  vec2 pos = vec2(
    (gl_VertexID == 1) ? 3.0 : -1.0,
    (gl_VertexID == 2) ? 3.0 : -1.0
  );
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

/** Bake-time fragment shader. Computes pointy-top hex stroke coverage
 * for one tessellation tile via the "two-candidate-centre + closer-
 * wins" pattern, then emits AA-modulated coverage in the red channel.
 * The output texture is then sampled at runtime with REPEAT wrap to
 * tile the pattern across the canvas. */
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
  // hex's nearest edge. Apothem = centre-to-edge distance = s * sqrt(3) / 2.
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

/** Runtime fragment shader. Samples the baked tile texture with REPEAT
 * wrap, computes the cursor-halo blend, and outputs premultiplied
 * RGBA matching the canvas context's `premultipliedAlpha: true` mode. */
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
  // onto one shared global hex grid. uOffset.x = (rect.left +
  // scrollX) * dpr; uOffset.y = (rect.bottom + scrollY) * dpr.
  // gl_FragCoord.y is y-up in WebGL while page Y is y-down, so we
  // flip the y component before adding the offset.
  vec2 page = vec2(gl_FragCoord.x, -gl_FragCoord.y) + uOffset;
  float coverage = texture(uTileTex, page / uTileSize).r;

  // Cursor halo stays canvas-local — it follows the actual on-screen
  // pointer, not a page-locked position.
  float halo = smoothstep(uPointerRadius, 0.0, distance(gl_FragCoord.xy, uMouse));
  vec4 col = mix(uFaintColor, uBrightColor, halo);
  fragColor = col * coverage;
}
`;

/** Module-scoped canvas-2D context used to canonicalise / rasterise
 * CSS colour strings into [r, g, b, a] floats. Lazy-initialised on
 * first call. Falls back to `[0, 0, 0, 1]` if canvas-2D is somehow
 * unavailable (extremely unlikely in any browser that has WebGL2). */
let colorParserCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

function ensureColorParserCtx(): typeof colorParserCtx {
  if (colorParserCtx) {
    return colorParserCtx;
  }
  if (typeof OffscreenCanvas !== "undefined") {
    colorParserCtx = new OffscreenCanvas(1, 1).getContext("2d");
  }
  if (!colorParserCtx && typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    colorParserCtx = c.getContext("2d");
  }
  return colorParserCtx;
}

/** Resolve a CSS colour string to non-premultiplied `[r, g, b, a]` in
 * `[0, 1]`. Uses the browser's canvas-2D rasteriser to handle every
 * CSS colour form (`#rgb`, `oklch()`, `color-mix()`, named colours,
 * etc.) without a hand-rolled parser. */
function parseColor(s: string): [number, number, number, number] {
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

/** Build a linked WebGL2 program from inline VS + FS sources. */
function createProgram(
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
  // Attached shaders are flagged for deletion; they're freed once the
  // program is deleted. Detaching first lets us delete them now.
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

/**
 * Pointer-aware hex grid backdrop. Faint SVG hex tiles that brighten
 * softly around the cursor. Positioned absolutely; drop inside any
 * positioned container.
 *
 * @cssproperty --hp-bg-stroke - Base stroke colour
 * @cssproperty --hp-bg-stroke-bright - Cursor-halo stroke colour
 * @cssproperty --hp-bg-faint-opacity - Base layer opacity (default 0.25)
 * @cssproperty --hp-bg-bright-opacity - Halo layer opacity (default 0.3)
 * @cssproperty --hp-bg-pointer-radius - Pixel radius of the cursor halo
 */
@customElement("hp-background")
export class HpBackground extends LitElement {
  /** Hex side length in pixels (centre-to-vertex). Smaller = denser
   * pattern. Default 14 — reads as ambient texture, not a focal
   * element. */
  @property({ type: Number, attribute: "hex-size" })
  hexSize = 14;

  /** Radius in pixels where the brighter strokes are fully visible
   * around the cursor. Falls to transparent at the edge. Default 200. */
  @property({ type: Number, attribute: "pointer-radius" })
  pointerRadius = 200;

  /** Cached grid dimensions; recomputed by the ResizeObserver.
   *
   * @deprecated Unused in the WebGL2 path — kept in Step 1 to keep the
   *   diff focused; removed in Step 3 along with the rest of the SVG
   *   rendering machinery. */
  @state() private cols = 0;
  /** @deprecated See {@link cols}. */
  @state() private rows = 0;

  /** True when WebGL2 init failed or the context was lost — the host
   * renders the static SVG-data-URL fallback (Option C) in this state.
   * Reflected to a `data-hp-fallback` attribute on the host so CSS
   * targets the alternate visual. */
  @state() private fallback = false;

  private resizeObserver?: ResizeObserver;
  /** Cached canvas element handle, grabbed in `firstUpdated`. */
  private canvas: HTMLCanvasElement | null = null;
  /** Active WebGL2 context, null while in the fallback state. */
  private gl: WebGL2RenderingContext | null = null;

  // ── GL resources (re-created on context restore) ───────────────────
  private bakeProgram: WebGLProgram | null = null;
  private runtimeProgram: WebGLProgram | null = null;
  private tileTexture: WebGLTexture | null = null;
  private bakeFbo: WebGLFramebuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;

  // ── Cached uniform locations ───────────────────────────────────────
  private uHexSideLoc: WebGLUniformLocation | null = null;
  private uStrokeHalfWidthLoc: WebGLUniformLocation | null = null;
  private uTileTexLoc: WebGLUniformLocation | null = null;
  private uTileSizeLoc: WebGLUniformLocation | null = null;
  private uOffsetLoc: WebGLUniformLocation | null = null;
  private uMouseLoc: WebGLUniformLocation | null = null;
  private uPointerRadiusLoc: WebGLUniformLocation | null = null;
  private uFaintColorLoc: WebGLUniformLocation | null = null;
  private uBrightColorLoc: WebGLUniformLocation | null = null;

  // ── Bake-state cache (drives "is a re-bake needed?" decisions) ─────
  /** `devicePixelRatio` snapshotted at last bake. Re-bake triggers when
   * this no longer matches the live value (e.g. window dragged between
   * displays of different DPR). */
  private bakedDpr = 0;
  /** `hexSize` snapshotted at last bake; re-bake on mismatch. */
  private bakedHexSize = 0;
  /** Visual tile period in device pixels at last bake — used by the
   * runtime shader's `uTileSize` UV divisor. Cached so each draw
   * doesn't recompute it. */
  private bakedTileSize: [number, number] = [0, 0];
  /** Active matchMedia query that watches for DPR changes. Re-created
   * each time the DPR changes (the query string includes a fixed value
   * so a different DPR causes it to no longer match). */
  private dprMediaQuery: MediaQueryList | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("aria-hidden", "true");
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this);
    // Window-level pointer listener — the host has pointer-events: none
    // so it can't catch its own events, but window always sees them.
    // Pointermove is high-frequency; passive flag avoids forcing the
    // browser to wait on the listener before scrolling.
    window.addEventListener("pointermove", this.handleWindowPointerMove, {
      passive: true,
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    window.removeEventListener("pointermove", this.handleWindowPointerMove);
    if (this.canvas) {
      this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
      this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    }
    if (this.dprMediaQuery) {
      this.dprMediaQuery.removeEventListener("change", this.handleDprChange);
      this.dprMediaQuery = null;
    }
    this.releaseGLResources();
    this.gl = null;
    this.canvas = null;
  }

  override firstUpdated(): void {
    this.canvas = this.shadowRoot?.querySelector("canvas") ?? null;
    this.initGL();
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("hexSize")) {
      if (this.fallback) {
        this.updateFallbackTile();
      } else if (this.gl) {
        // Tile geometry changed — re-bake at the new size, then
        // redraw to pick up the new uTileSize uniform.
        this.bake();
        this.draw();
      }
    }
  }

  private initGL(): void {
    const canvas = this.canvas;
    if (!canvas) {
      return;
    }
    // `antialias: false` because the bake pass does AA via `fwidth` +
    // 2× supersampling; browser MSAA on the canvas would be
    // redundant fillrate. `low-power` flags the decorative use case
    // so battery-conscious systems can route to the integrated GPU.
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) {
      this.enterFallback();
      return;
    }
    this.gl = gl;
    // Remove + re-add so context-restore calls don't accumulate duplicate
    // listeners. The handlers are stable arrow-function refs so remove()
    // works idempotently on the first call too.
    canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    canvas.addEventListener("webglcontextlost", this.handleContextLost);
    canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
    try {
      this.initGLResources(gl);
    } catch {
      // Shader compile, link, or FBO allocation failed — fall back to
      // the static SVG tile background. Rare in practice (a healthy
      // WebGL2 context that supports R8 + REPEAT + mipmaps covers
      // every desktop/mobile target hexpunk realistically ships to).
      this.releaseGLResources();
      this.gl = null;
      this.enterFallback();
      return;
    }
    this.watchDpr();
    this.handleResize();
    this.bake();
    this.draw();
  }

  /** Compile both programs, create the bake FBO + tile texture + VAO,
   * cache uniform locations. Throws on any GL error so `initGL` can
   * catch and route to the fallback path. */
  private initGLResources(gl: WebGL2RenderingContext): void {
    this.bakeProgram = createProgram(gl, VERTEX_SHADER_SOURCE, BAKE_FRAGMENT_SHADER_SOURCE);
    this.runtimeProgram = createProgram(gl, VERTEX_SHADER_SOURCE, RUNTIME_FRAGMENT_SHADER_SOURCE);

    this.uHexSideLoc = gl.getUniformLocation(this.bakeProgram, "uHexSide");
    this.uStrokeHalfWidthLoc = gl.getUniformLocation(this.bakeProgram, "uStrokeHalfWidth");
    this.uTileTexLoc = gl.getUniformLocation(this.runtimeProgram, "uTileTex");
    this.uTileSizeLoc = gl.getUniformLocation(this.runtimeProgram, "uTileSize");
    this.uOffsetLoc = gl.getUniformLocation(this.runtimeProgram, "uOffset");
    this.uMouseLoc = gl.getUniformLocation(this.runtimeProgram, "uMouse");
    this.uPointerRadiusLoc = gl.getUniformLocation(this.runtimeProgram, "uPointerRadius");
    this.uFaintColorLoc = gl.getUniformLocation(this.runtimeProgram, "uFaintColor");
    this.uBrightColorLoc = gl.getUniformLocation(this.runtimeProgram, "uBrightColor");

    // VAO is required for any draw call in WebGL2 (even with
    // attribute-less single-triangle rendering). Bind it once; we'll
    // never unbind.
    this.vao = gl.createVertexArray();
    if (!this.vao) {
      throw new Error("hp-background: gl.createVertexArray returned null");
    }
    gl.bindVertexArray(this.vao);

    this.tileTexture = gl.createTexture();
    if (!this.tileTexture) {
      throw new Error("hp-background: gl.createTexture returned null");
    }
    gl.bindTexture(gl.TEXTURE_2D, this.tileTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    // LINEAR (not LINEAR_MIPMAP_LINEAR) — at SUPER_SAMPLE=1 the texel
    // rate matches the device-pixel rate so no mipmap level is ever
    // selected. Mipmaps would actively hurt intensity by averaging the
    // thin stroke across coarser LODs.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.bakeFbo = gl.createFramebuffer();
    if (!this.bakeFbo) {
      throw new Error("hp-background: gl.createFramebuffer returned null");
    }
  }

  /** Detach and delete every GL resource. Safe to call when `this.gl`
   * is already null (e.g. after context loss). Used on context loss,
   * init failure, and disconnect. */
  private releaseGLResources(): void {
    const gl = this.gl;
    if (gl) {
      if (this.bakeProgram) {
        gl.deleteProgram(this.bakeProgram);
      }
      if (this.runtimeProgram) {
        gl.deleteProgram(this.runtimeProgram);
      }
      if (this.tileTexture) {
        gl.deleteTexture(this.tileTexture);
      }
      if (this.bakeFbo) {
        gl.deleteFramebuffer(this.bakeFbo);
      }
      if (this.vao) {
        gl.deleteVertexArray(this.vao);
      }
    }
    this.bakeProgram = null;
    this.runtimeProgram = null;
    this.tileTexture = null;
    this.bakeFbo = null;
    this.vao = null;
    this.uHexSideLoc = null;
    this.uStrokeHalfWidthLoc = null;
    this.uTileTexLoc = null;
    this.uTileSizeLoc = null;
    this.uOffsetLoc = null;
    this.uMouseLoc = null;
    this.uPointerRadiusLoc = null;
    this.uFaintColorLoc = null;
    this.uBrightColorLoc = null;
  }

  /** Bake the hex-stroke-coverage tile texture. Tile dimensions are
   * `hexSize × dpr × superSample × (√3, 3)`, so a single tile period
   * fits exactly in the texture and `gl.REPEAT` wrapping handles
   * tiling at runtime. Generates mipmaps after rendering so the
   * runtime sampler can downsample cleanly on low-DPR displays or
   * during zoom transitions. */
  private bake(): void {
    const gl = this.gl;
    if (!gl || !this.bakeProgram || !this.tileTexture || !this.bakeFbo) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const hexSide = this.hexSize * dpr * SUPER_SAMPLE;
    const strokeHalf = BASE_STROKE_HALF_WIDTH * dpr * SUPER_SAMPLE;
    const tileWBake = Math.max(1, Math.round(hexSide * SQRT3));
    const tileHBake = Math.max(1, Math.round(hexSide * 3));

    // (Re-)allocate the R8 texture at the new bake size. We always
    // re-allocate rather than just re-rendering because bake-pass
    // dimensions depend on hexSize and DPR.
    gl.bindTexture(gl.TEXTURE_2D, this.tileTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, tileWBake, tileHBake, 0, gl.RED, gl.UNSIGNED_BYTE, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bakeFbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.tileTexture,
      0
    );
    // Defensive completeness check — if this fires the GL driver is
    // misbehaving (R8 + REPEAT + LINEAR_MIPMAP_LINEAR is required
    // color-renderable in WebGL2) and we should fall back.
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.releaseGLResources();
      this.gl = null;
      this.enterFallback();
      return;
    }
    gl.viewport(0, 0, tileWBake, tileHBake);
    gl.disable(gl.BLEND);
    gl.useProgram(this.bakeProgram);
    gl.uniform1f(this.uHexSideLoc, hexSide);
    gl.uniform1f(this.uStrokeHalfWidthLoc, strokeHalf);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // No mipmap generation — see TEXTURE_MIN_FILTER comment in
    // initGLResources for why LINEAR (LOD 0 only) is the right pick
    // at SUPER_SAMPLE=1.

    // Done with the FBO; subsequent draws target the canvas backbuffer.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.bakedDpr = dpr;
    this.bakedHexSize = this.hexSize;
    this.bakedTileSize = [this.hexSize * dpr * SQRT3, this.hexSize * dpr * 3];
  }

  /** Subscribe to DPR-change notifications via matchMedia. When the
   * resolution changes (e.g. window drags to a different-DPR display)
   * the current query stops matching and we re-bake at the new DPR. */
  private watchDpr(): void {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    if (this.dprMediaQuery) {
      this.dprMediaQuery.removeEventListener("change", this.handleDprChange);
    }
    const dpr = window.devicePixelRatio || 1;
    this.dprMediaQuery = window.matchMedia(`(resolution: ${dpr}dppx)`);
    this.dprMediaQuery.addEventListener("change", this.handleDprChange);
  }

  private readonly handleDprChange = (): void => {
    if (this.fallback || !this.gl) {
      // If we're in fallback the SVG tile is DPR-independent; nothing
      // to do beyond re-arming the watcher for the new DPR.
      this.watchDpr();
      return;
    }
    this.bake();
    // The canvas backing-store size also changes with DPR; let the
    // resize handler recompute it then redraw.
    this.handleResize();
    this.watchDpr();
  };

  private readonly handleContextLost = (event: Event): void => {
    // Default behaviour is to permanently lose the context. preventDefault
    // tells the browser we want it restored when possible. Swap to the
    // fallback bg in the meantime so the host doesn't go visually blank.
    event.preventDefault();
    // Drop refs to the now-invalid GL objects. We pre-null `gl` so
    // releaseGLResources skips the (illegal) deletes against the
    // lost context.
    this.gl = null;
    this.releaseGLResources();
    this.enterFallback();
  };

  private readonly handleContextRestored = (): void => {
    // The original context object is gone; re-acquire and re-init.
    // initGL will set fallback back to false on success.
    this.fallback = false;
    this.removeAttribute("data-hp-fallback");
    this.initGL();
  };

  private enterFallback(): void {
    this.fallback = true;
    this.setAttribute("data-hp-fallback", "");
    this.updateFallbackTile();
  }

  private updateFallbackTile(): void {
    this.style.setProperty("--hp-bg-fallback-image", buildFallbackTileDataUrl(this.hexSize));
    const tileW = this.hexSize * Math.sqrt(3);
    const tileH = this.hexSize * 3;
    this.style.setProperty("--hp-bg-tile-width", `${tileW.toFixed(2)}px`);
    this.style.setProperty("--hp-bg-tile-height", `${tileH.toFixed(2)}px`);
  }

  private handleResize(): void {
    const canvas = this.canvas;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      if (this.gl) {
        this.gl.viewport(0, 0, w, h);
      }
    }
    this.draw();
  }

  /** Runtime pass: sample the baked tile texture, blend faint→bright
   * by cursor proximity, output premultiplied. Reads colour CSS
   * custom properties via `getComputedStyle` each draw so token /
   * theme changes pick up at the next redraw without bookkeeping. */
  private draw(): void {
    const gl = this.gl;
    if (!gl || !this.runtimeProgram || !this.tileTexture) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Premultiplied source-over blending: the shader outputs
    // (rgb · α, α) already, so the standard premultiplied blend
    // equation is (ONE, ONE_MINUS_SRC_ALPHA).
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.runtimeProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tileTexture);
    gl.uniform1i(this.uTileTexLoc, 0);

    gl.uniform2f(this.uTileSizeLoc, this.bakedTileSize[0], this.bakedTileSize[1]);
    // Page-attached offset: every hp-background on the page samples
    // the tile texture in shared page-coordinate space, so adjacent
    // instances read as windows onto a single continuous grid. y is
    // (rect.bottom + scrollY) because the shader flips gl_FragCoord.y
    // (WebGL is y-up, page is y-down).
    const rect = this.getBoundingClientRect();
    gl.uniform2f(
      this.uOffsetLoc,
      (rect.left + window.scrollX) * dpr,
      (rect.bottom + window.scrollY) * dpr
    );
    // Step 2 keeps the mouse off-screen; Step 3 wires real pointermove.
    gl.uniform2f(this.uMouseLoc, OFFSCREEN_MOUSE, OFFSCREEN_MOUSE);
    gl.uniform1f(this.uPointerRadiusLoc, this.pointerRadius * dpr);

    const cs = getComputedStyle(this);
    const faintOpacity = parseFloat(cs.getPropertyValue("--hp-bg-faint-opacity")) || 0;
    const brightOpacity = parseFloat(cs.getPropertyValue("--hp-bg-bright-opacity")) || 0;
    const faintRaw = parseColor(cs.getPropertyValue("--hp-bg-stroke"));
    const brightRaw = parseColor(cs.getPropertyValue("--hp-bg-stroke-bright"));
    // Pre-multiply: rgb · final_alpha, where final_alpha = parsed_alpha
    // · token_opacity. The shader's `col * coverage` and the blend
    // equation both expect premultiplied input.
    const faintA = faintRaw[3] * faintOpacity;
    const brightA = brightRaw[3] * brightOpacity;
    gl.uniform4f(
      this.uFaintColorLoc,
      faintRaw[0] * faintA,
      faintRaw[1] * faintA,
      faintRaw[2] * faintA,
      faintA
    );
    gl.uniform4f(
      this.uBrightColorLoc,
      brightRaw[0] * brightA,
      brightRaw[1] * brightA,
      brightRaw[2] * brightA,
      brightA
    );

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private handleWindowPointerMove = (event: PointerEvent): void => {
    const rect = this.getBoundingClientRect();
    this.style.setProperty("--hp-bg-x", `${event.clientX - rect.left}px`);
    this.style.setProperty("--hp-bg-y", `${event.clientY - rect.top}px`);
  };

  private computeGridSize(): void {
    const rect = this.getBoundingClientRect();
    const s = this.hexSize;
    // Pointy-top tessellation step: cw = s·√3 horizontally, ch = 1.5·s
    // vertically (with every other row offset by cw/2). Add 1-2 extra
    // rows / cols so the grid bleeds past the host edges and the
    // pattern doesn't visibly clip.
    const cw = s * Math.sqrt(3);
    const ch = s * 1.5;
    this.cols = Math.max(1, Math.ceil(rect.width / cw) + 2);
    this.rows = Math.max(1, Math.ceil(rect.height / ch) + 2);
  }

  static override styles = [
    hpBase,
    css`
      :host {
        position: absolute;
        inset: 0;
        display: block;
        pointer-events: none;
        overflow: hidden;
        contain: strict;
        /* Both layers use full outline tokens, dialed by independent
 * opacities. The opacity dial lets us land between the system
 * outline rungs (--hp-outline-faint reads as nothing on common
 * backdrops; --hp-outline-variant reads as too present at
 * 1.0). Default 0.25 for the base sits the grid at "barely
 * there, but there"; 0.3 for the cursor halo keeps the
 * brightening a soft trail rather than a search-light. */
        --hp-bg-stroke: var(--hp-outline-variant);
        --hp-bg-stroke-bright: var(--hp-outline);
        --hp-bg-faint-opacity: 0.25;
        --hp-bg-bright-opacity: 0.3;
      }

      canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
      }

      /* Option-C fallback: WebGL2 unavailable or context lost. The
       * canvas hides; the host paints a repeating SVG-data-URL hex
       * tile that gives a "degraded but present" hex pattern with no
       * cursor reactivity. Tile dimensions + image are written as
       * inline custom properties by updateFallbackTile() so hex-size
       * changes propagate. */
      :host([data-hp-fallback]) canvas {
        display: none;
      }

      :host([data-hp-fallback]) {
        color: var(--hp-bg-stroke);
        opacity: var(--hp-bg-faint-opacity);
        background-image: var(--hp-bg-fallback-image);
        background-repeat: repeat;
        background-size: var(--hp-bg-tile-width) var(--hp-bg-tile-height);
      }

      svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
      }

      g {
        fill: none;
        stroke-width: 0.75;
      }

      .faint {
        stroke: var(--hp-bg-stroke);
        opacity: var(--hp-bg-faint-opacity);
      }

      .bright {
        stroke: var(--hp-bg-stroke-bright);
        opacity: var(--hp-bg-bright-opacity);
        /* Mask reveals the brighter strokes only within pointerRadius
 * of the cursor. CSS var fallbacks land the focus offscreen
 * before the first pointermove so the brighter layer is
 * effectively hidden on initial paint. */
        mask: radial-gradient(
          circle var(--hp-bg-pointer-radius, 200px) at var(--hp-bg-x, -9999px)
            var(--hp-bg-y, -9999px),
          black 0%,
          transparent 100%
        );
      }

      @media (prefers-reduced-motion: reduce) {
        /* Pointer-following brightness is a subtle motion cue; suppress
 * for users who've opted out. The faint layer still renders. */
        .bright {
          display: none;
        }
      }
    `,
  ];

  override render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-background": HpBackground;
  }
}
