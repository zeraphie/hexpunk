// changelog.ts — Parse CHANGELOG.md once and slice it by component tag.
//
// The repo CHANGELOG.md is the source of truth. ComponentDocs.astro
// reads `getChangelogFor("hp-cell")` etc. and renders only the entries
// whose bullet text mentions that tag (matched as `<hp-cell>` with a
// word boundary). Entries that don't mention any specific tag stay in
// the root CHANGELOG only — they're not attributed per component.
//
// Parsing is intentionally minimal (Keep-a-Changelog format with `##`
// for versions, `###` for sections, `- ` for bullets). Astro evaluates
// component frontmatter per render in dev, so changes to CHANGELOG.md
// hot-reload without touching this file.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHANGELOG_PATH = join(__dirname, "../../../CHANGELOG.md");

export type ChangelogSection =
  | "added"
  | "changed"
  | "removed"
  | "fixed"
  | "deprecated"
  | "security";

export interface ChangelogEntry {
  version: string;
  date: string;
  sections: Partial<Record<ChangelogSection, string[]>>;
}

const KNOWN_SECTIONS: readonly ChangelogSection[] = [
  "added",
  "changed",
  "removed",
  "fixed",
  "deprecated",
  "security",
];

function parseChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = text.split(/\r?\n/);

  let current: ChangelogEntry | null = null;
  let section: ChangelogSection | null = null;

  for (const line of lines) {
    const versionMatch = line.match(/^##\s+\[([^\]]+)\](?:\s*-\s*(.+))?\s*$/);
    if (versionMatch) {
      if (current) {
        entries.push(current);
      }
      current = {
        version: versionMatch[1] ?? "",
        date: versionMatch[2] ?? "",
        sections: {},
      };
      section = null;
      continue;
    }

    const sectionMatch = line.match(/^###\s+(\w+)/);
    if (sectionMatch && current) {
      const name = sectionMatch[1]?.toLowerCase();
      if (name && (KNOWN_SECTIONS as readonly string[]).includes(name)) {
        section = name as ChangelogSection;
        current.sections[section] ??= [];
      } else {
        section = null;
      }
      continue;
    }

    if (!current || !section) {
      continue;
    }

    if (line.startsWith("- ")) {
      current.sections[section]!.push(line.slice(2).trim());
    } else if (line.startsWith("  ") && line.trim().length > 0) {
      // Continuation of the previous bullet — append with a leading
      // space so paragraph breaks render cleanly downstream.
      const bucket = current.sections[section]!;
      const last = bucket.pop();
      if (last !== undefined) {
        bucket.push(`${last} ${line.trim()}`);
      }
    }
  }
  if (current) {
    entries.push(current);
  }
  return entries;
}

let cached: ChangelogEntry[] | null = null;

function loadAll(): ChangelogEntry[] {
  if (cached) {
    return cached;
  }
  const raw = readFileSync(CHANGELOG_PATH, "utf8");
  cached = parseChangelog(raw);
  return cached;
}

/** Filter the parsed CHANGELOG to entries whose bullets mention `<tag>`
 *  (with a word boundary so `<hp-grid>` won't match a hypothetical
 *  `<hp-grid-cell>`). An entry is kept iff at least one of its
 *  sections has at least one matching bullet; non-matching bullets in
 *  matching entries are dropped. */
export function getChangelogFor(tag: string): ChangelogEntry[] {
  const all = loadAll();
  const tagRe = new RegExp(`<${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s>/])`);

  const out: ChangelogEntry[] = [];
  for (const entry of all) {
    const sections: Partial<Record<ChangelogSection, string[]>> = {};
    let hasAny = false;
    for (const sectionName of KNOWN_SECTIONS) {
      const items = entry.sections[sectionName];
      if (!items) {
        continue;
      }
      const matching = items.filter((item) => tagRe.test(item));
      if (matching.length) {
        sections[sectionName] = matching;
        hasAny = true;
      }
    }
    if (hasAny) {
      out.push({ version: entry.version, date: entry.date, sections });
    }
  }
  return out;
}

/** Render Keep-a-Changelog inline markdown (backtick `code`, **bold**)
 *  to HTML for direct `set:html` injection. Other formatting is left
 *  as plain text. */
export function renderInline(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/** Title-case a section name for display (`added` → `Added`). */
export function titleCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}
