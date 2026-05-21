// api.ts — Read custom-elements.json (CEM manifest) once and expose
// a per-tag lookup for the ComponentApi.astro renderer.
//
// `bun run analyze` regenerates the manifest from JSDoc on each
// element class. Documentation surfaces consumed:
//
// - Properties + attributes (kind === "field", non-private members)
// - Events (from `@fires` / `@event` JSDoc on the class)
// - Slots (from `@slot` JSDoc on the class)
// - CSS custom properties (from `@cssproperty` JSDoc)
// - CSS parts (from `@csspart` JSDoc)
//
// Slots / events / CSS custom properties / parts only appear when
// the element author has added the matching JSDoc tag. Properties +
// attributes derive automatically from the `@property` decorator.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(__dirname, "../../../custom-elements.json");

export interface ApiField {
  name: string;
  attribute?: string;
  type?: string;
  default?: string;
  description?: string;
  reflects?: boolean;
}

export interface ApiEvent {
  name: string;
  type?: string;
  description?: string;
}

export interface ApiSlot {
  name: string;
  description?: string;
}

export interface ApiCssProperty {
  name: string;
  description?: string;
  default?: string;
}

export interface ApiCssPart {
  name: string;
  description?: string;
}

export interface Api {
  tagName: string;
  className: string;
  description?: string;
  properties: ApiField[];
  events: ApiEvent[];
  slots: ApiSlot[];
  cssProperties: ApiCssProperty[];
  cssParts: ApiCssPart[];
}

interface ManifestField {
  kind: string;
  name: string;
  privacy?: string;
  attribute?: string;
  type?: { text?: string };
  default?: string;
  description?: string;
  reflects?: boolean;
}

interface ManifestEvent {
  name: string;
  type?: { text?: string };
  description?: string;
}

interface ManifestSlot {
  name?: string;
  description?: string;
}

interface ManifestCssProperty {
  name: string;
  description?: string;
  default?: string;
}

interface ManifestCssPart {
  name: string;
  description?: string;
}

interface ManifestDeclaration {
  kind: string;
  name: string;
  tagName?: string;
  customElement?: boolean;
  description?: string;
  members?: ManifestField[];
  events?: ManifestEvent[];
  slots?: ManifestSlot[];
  cssProperties?: ManifestCssProperty[];
  cssParts?: ManifestCssPart[];
}

interface ManifestModule {
  declarations?: ManifestDeclaration[];
}

interface Manifest {
  modules?: ManifestModule[];
}

let cached: Map<string, Api> | null = null;

function load(): Map<string, Api> {
  if (cached) {
    return cached;
  }
  const map = new Map<string, Api>();
  try {
    const raw = readFileSync(MANIFEST_PATH, "utf-8");
    const manifest = JSON.parse(raw) as Manifest;
    for (const module of manifest.modules ?? []) {
      for (const decl of module.declarations ?? []) {
        if (!decl.customElement || !decl.tagName) {
          continue;
        }
        const fields = (decl.members ?? []).filter(
          (m): m is ManifestField => m.kind === "field" && m.privacy !== "private" && !!m.attribute
        );
        map.set(decl.tagName, {
          tagName: decl.tagName,
          className: decl.name,
          description: decl.description,
          properties: fields.map((f) => ({
            name: f.name,
            attribute: f.attribute,
            type: f.type?.text,
            default: f.default,
            description: f.description,
            reflects: f.reflects,
          })),
          events: (decl.events ?? []).map((e) => ({
            name: e.name,
            type: e.type?.text,
            description: e.description,
          })),
          slots: (decl.slots ?? []).map((s) => ({
            name: s.name ?? "",
            description: s.description,
          })),
          cssProperties: (decl.cssProperties ?? []).map((c) => ({
            name: c.name,
            description: c.description,
            default: c.default,
          })),
          cssParts: (decl.cssParts ?? []).map((p) => ({
            name: p.name,
            description: p.description,
          })),
        });
      }
    }
  } catch {
    // Manifest missing or malformed — return empty cache so the docs
    // render with empty API tables instead of crashing. Run
    // `bun run analyze` to regenerate.
  }
  cached = map;
  return map;
}

/** Look up the API surface for an element by its tag name. Returns
 *  null if the manifest doesn't include the element (e.g., element
 *  not exported, manifest stale). */
export function getApiFor(tagName: string): Api | null {
  return load().get(tagName) ?? null;
}
