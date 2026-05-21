// build-tokens.ts — DESIGN.md frontmatter → CSS custom properties.
//
// Reads the YAML frontmatter at the top of DESIGN.md and emits a single
// CSS file at src/tokens/tokens.dark.css with every token exposed as a
// `--hp-*` custom property. Density modes become `[data-hp-density="<mode>"]`
// scoped overrides. Token references (`{colors.primary}`) inside the
// `components:` section are translated to `var(--hp-…)`.
//
// DESIGN.md is the single source of truth — never edit the generated CSS.

import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { $ } from "bun";
import { parse as parseYaml } from "yaml";

const SOURCE_PATH = "DESIGN.md";
const OUT_PATH = "src/tokens/tokens.dark.css";

// ── Types ──────────────────────────────────────────────────────────

type Primitive = string | number;

interface TypographyEntry {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string | number;
  lineHeight?: string | number;
  letterSpacing?: string;
  fontFeature?: string;
  fontVariation?: string;
}

interface Frontmatter {
  version?: string;
  name?: string;
  description?: string;
  colors?: Record<string, string>;
  typography?: Record<string, TypographyEntry>;
  rounded?: Record<string, Primitive>;
  spacing?: Record<string, Primitive>;
  motion?: Record<string, Primitive>;
  layers?: Record<string, number>;
  density?: Record<string, Record<string, Primitive>>;
  components?: Record<string, Record<string, Primitive>>;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Resolve `{group.token}` references inside component values to `var(--hp-token)`. */
function resolveRef(value: Primitive): string {
  if (typeof value !== "string") {
    return String(value);
  }
  return value.replace(/\{([^}]+)\}/g, (_, ref: string) => {
    const segments = ref.split(".");
    // Drop the group prefix; the CSS var name uses the leaf path.
    const tokenName = segments.slice(1).join("-");
    return `var(--hp-${tokenName})`;
  });
}

/** Convert camelCase property names to kebab-case for CSS variables. */
function toKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Quote multi-word font names so the CSS value parses correctly. */
function formatFontFamily(value: string): string {
  return value
    .split(",")
    .map((name) => {
      const trimmed = name.trim();
      const isGeneric =
        /^(sans-serif|serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded)$/.test(
          trimmed
        );
      const isSingleWord = /^[A-Za-z][A-Za-z0-9-]*$/.test(trimmed);
      if (isGeneric || isSingleWord) {
        return trimmed;
      }
      return `"${trimmed}"`;
    })
    .join(", ");
}

// ── Frontmatter extraction ─────────────────────────────────────────

if (!existsSync(SOURCE_PATH)) {
  console.error(`build-tokens: ${SOURCE_PATH} not found`);
  process.exit(1);
}

const content = await Bun.file(SOURCE_PATH).text();
const fmMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
if (!fmMatch) {
  console.error("build-tokens: no YAML frontmatter found in DESIGN.md");
  process.exit(1);
}

const fm = parseYaml(fmMatch[1] as string) as Frontmatter;

// ── CSS generation ─────────────────────────────────────────────────

const lines: string[] = [];

lines.push("/* tokens.dark.css — Generated from DESIGN.md frontmatter. Do not edit. */");
lines.push("");
lines.push(":root {");

if (fm.colors) {
  lines.push("  /* Colors */");
  for (const [name, value] of Object.entries(fm.colors)) {
    lines.push(`  --hp-${name}: ${value};`);
  }
  lines.push("");
}

if (fm.rounded) {
  lines.push("  /* Rounded */");
  for (const [name, value] of Object.entries(fm.rounded)) {
    const cssName = name === "DEFAULT" ? "rounded" : `rounded-${name}`;
    lines.push(`  --hp-${cssName}: ${value};`);
  }
  lines.push("");
}

if (fm.spacing) {
  lines.push("  /* Spacing + sizing */");
  for (const [name, value] of Object.entries(fm.spacing)) {
    lines.push(`  --hp-${name}: ${value};`);
  }
  lines.push("");
}

if (fm.motion) {
  lines.push("  /* Motion */");
  for (const [name, value] of Object.entries(fm.motion)) {
    lines.push(`  --hp-${name}: ${value};`);
  }
  lines.push("");
}

if (fm.layers) {
  lines.push("  /* Layers */");
  for (const [name, value] of Object.entries(fm.layers)) {
    lines.push(`  --hp-layer-${name}: ${value};`);
  }
  lines.push("");
}

if (fm.typography) {
  lines.push("  /* Typography */");
  for (const [name, props] of Object.entries(fm.typography)) {
    for (const [prop, value] of Object.entries(props)) {
      const cssProp = toKebab(prop);
      const cssValue =
        prop === "fontFamily" && typeof value === "string" ? formatFontFamily(value) : value;
      lines.push(`  --hp-typo-${name}-${cssProp}: ${cssValue};`);
    }
  }
  lines.push("");
}

if (fm.components) {
  lines.push("  /* Components */");
  for (const [comp, props] of Object.entries(fm.components)) {
    for (const [prop, value] of Object.entries(props)) {
      lines.push(`  --hp-comp-${comp}-${toKebab(prop)}: ${resolveRef(value)};`);
    }
  }
  lines.push("");
}

lines.push("}");

if (fm.density) {
  for (const [mode, tokens] of Object.entries(fm.density)) {
    // Default mode values already live in :root via the spacing block.
    if (mode === "default") {
      continue;
    }
    lines.push("");
    lines.push(`[data-hp-density="${mode}"] {`);
    for (const [name, value] of Object.entries(tokens)) {
      lines.push(`  --hp-${name}: ${value};`);
    }
    lines.push("}");
  }
}

lines.push("");

// ── Write output ───────────────────────────────────────────────────

const outDir = dirname(OUT_PATH);
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

await Bun.write(OUT_PATH, lines.join("\n"));

// Run oxfmt on the generated file so format:check stays green.
// Uses Bun's shell which resolves binaries from node_modules/.bin.
await $`oxfmt ${OUT_PATH}`.quiet().nothrow();

console.log(`build-tokens: wrote ${OUT_PATH} (${lines.length} lines)`);
