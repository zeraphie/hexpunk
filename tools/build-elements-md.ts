// Generate .ai/ELEMENTS.md from custom-elements.json — the compact per-element
// AI-briefing reference (tag, role, attributes/properties, slots, events, CSS
// custom properties, CSS parts) that DESIGN.md and .ai/PROMPTS.md point agents at.

import { $ } from "bun";
import { existsSync } from "node:fs";

const CEM_PATH = "custom-elements.json";
const OUT_PATH = ".ai/ELEMENTS.md";

if (!existsSync(CEM_PATH)) {
  console.error(`build-elements-md: ${CEM_PATH} not found. Run 'bun run analyze' first.`);
  process.exit(1);
}

interface CEMType {
  text?: string;
}

interface CEMMember {
  kind: string;
  name: string;
  type?: CEMType;
  default?: string;
  description?: string;
  attribute?: string;
  privacy?: string;
  static?: boolean;
}

interface CEMNamed {
  name: string;
  description?: string;
  type?: CEMType;
}

interface CEMDeclaration {
  kind: string;
  customElement?: boolean;
  tagName?: string;
  description?: string;
  members?: CEMMember[];
  slots?: CEMNamed[];
  events?: CEMNamed[];
  cssProperties?: CEMNamed[];
  cssParts?: CEMNamed[];
}

interface CEMModule {
  declarations?: CEMDeclaration[];
}

interface CEM {
  modules?: CEMModule[];
}

const cem = (await Bun.file(CEM_PATH).json()) as CEM;

const elements = (cem.modules ?? [])
  .flatMap((m) => m.declarations ?? [])
  .filter((d): d is CEMDeclaration & { tagName: string } => Boolean(d.customElement && d.tagName))
  .sort((a, b) => a.tagName.localeCompare(b.tagName));

// Collapse a multi-line manifest description into a single markdown-safe line.
const oneLine = (s: string | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

// First paragraph only — element descriptions lead with the role, then elaborate.
const lead = (s: string | undefined): string => oneLine((s ?? "").split(/\n\s*\n/, 1)[0]);

const isPublicField = (m: CEMMember): boolean =>
  m.kind === "field" && !m.static && m.privacy !== "private" && m.privacy !== "protected";

const section = (title: string, items: string[]): string[] =>
  items.length > 0 ? [`**${title}**`, "", ...items, ""] : [];

const withDesc = (label: string, description: string | undefined): string => {
  const d = oneLine(description);
  return d ? `- ${label} — ${d}` : `- ${label}`;
};

const lines: string[] = [
  "# Hexpunk — Elements Reference",
  "",
  "Auto-generated from `custom-elements.json` by `tools/build-elements-md.ts` — do not edit",
  "by hand. Regenerate with `bun run analyze`.",
  "",
  `${elements.length} elements, alphabetical. Per element: tag, role, attributes / properties`,
  "(type, default), slots, events, CSS custom properties, CSS parts. Pair with `DESIGN.md`",
  "(style) and `.ai/PROMPTS.md` (prompt recipes) when briefing an agent.",
  "",
];

for (const el of elements) {
  lines.push(`## \`<${el.tagName}>\``, "");
  const role = lead(el.description);
  if (role) {
    lines.push(role, "");
  }

  const fields = (el.members ?? []).filter(isPublicField).map((m) => {
    const name = m.attribute ?? `${m.name} (property)`;
    const type = m.type?.text ? `: \`${oneLine(m.type.text)}\`` : "";
    const def = m.default !== undefined ? ` = \`${oneLine(m.default)}\`` : "";
    return withDesc(`\`${name}\`${type}${def}`, m.description);
  });
  lines.push(...section("Attributes / properties", fields));

  lines.push(
    ...section(
      "Slots",
      (el.slots ?? []).map((s) => withDesc(s.name ? `\`${s.name}\`` : "(default)", s.description))
    )
  );

  lines.push(
    ...section(
      "Events",
      // The analyzer emits a nameless placeholder event on most elements — skip it.
      (el.events ?? [])
        .filter((e) => e.name)
        .map((e) => {
          const type = e.type?.text && e.type.text !== "CustomEvent" ? `: \`${e.type.text}\`` : "";
          return withDesc(`\`${e.name}\`${type}`, e.description);
        })
    )
  );

  lines.push(
    ...section(
      "CSS custom properties",
      (el.cssProperties ?? []).map((p) => withDesc(`\`${p.name}\``, p.description))
    )
  );

  lines.push(
    ...section(
      "CSS parts",
      (el.cssParts ?? []).map((p) => withDesc(`\`${p.name}\``, p.description))
    )
  );
}

await Bun.write(OUT_PATH, lines.join("\n").replace(/\n+$/, "\n"));

// Normalise through the repo formatter so regeneration never fails format:check
// (oxfmt escapes markdown metacharacters that leak in from manifest descriptions).
const fmt = await $`oxfmt ${OUT_PATH}`.quiet().nothrow();
if (fmt.exitCode !== 0) {
  console.error(`build-elements-md: oxfmt failed on ${OUT_PATH}`);
  process.exit(1);
}

console.log(`build-elements-md: wrote ${OUT_PATH} (${elements.length} elements)`);
