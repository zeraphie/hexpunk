// Generate vscode.html-custom-data.json from custom-elements.json so HTML LSPs
// (Zed, VS Code, Cursor, Neovim, Helix, Sublime via LSP) autocomplete <hp-*> tags.
//
// Despite the file name, this is the de-facto HTML LSP custom-data format —
// not a VS Code-specific artifact.

import { existsSync } from "node:fs";

const CEM_PATH = "custom-elements.json";
const OUT_PATH = "vscode.html-custom-data.json";

if (!existsSync(CEM_PATH)) {
  console.error(`build-vscode-data: ${CEM_PATH} not found. Run 'bun run analyze' first.`);
  process.exit(1);
}

interface CEMAttribute {
  name: string;
  description?: string;
  type?: { text?: string };
}

interface CEMDeclaration {
  kind: string;
  customElement?: boolean;
  tagName?: string;
  description?: string;
  attributes?: CEMAttribute[];
}

interface CEMModule {
  declarations?: CEMDeclaration[];
}

interface CEM {
  modules?: CEMModule[];
}

const cem = (await Bun.file(CEM_PATH).json()) as CEM;

const PRIMITIVE_TYPES = new Set(["string", "number", "boolean"]);

const tags = (cem.modules ?? [])
  .flatMap((m) => m.declarations ?? [])
  .filter((d): d is CEMDeclaration & { tagName: string } => Boolean(d.customElement && d.tagName))
  .map((d) => ({
    name: d.tagName,
    description: d.description ?? "",
    attributes: (d.attributes ?? []).map((a) => {
      const enumValues = a.type?.text
        ? a.type.text
            .split("|")
            .map((v) => v.trim().replace(/^['"]|['"]$/g, ""))
            .filter((v) => v && !PRIMITIVE_TYPES.has(v))
            .map((v) => ({ name: v }))
        : [];
      return {
        name: a.name,
        description: a.description ?? "",
        ...(enumValues.length > 0 ? { values: enumValues } : {}),
      };
    }),
  }));

await Bun.write(OUT_PATH, JSON.stringify({ version: 1.1, tags }, null, 2) + "\n");

console.log(`build-vscode-data: wrote ${OUT_PATH} (${tags.length} tags)`);
