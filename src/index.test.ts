// Pins the barrel partition to the manifest's `@status` labels:
// done / experimental elements are the public surface (index.ts or
// grid.ts), wip elements stay out of it and register for the
// showcase via showcase/src/lib/wip-elements.ts instead. Fails with
// the exact element and the file to fix when the three drift.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const read = (p: string) => readFileSync(join(root, p), "utf-8");

interface ManifestElement {
  tagName: string;
  className: string;
  modulePath: string;
  status: string;
}

const manifest = JSON.parse(read("custom-elements.json")) as {
  modules: {
    path: string;
    declarations?: { customElement?: boolean; tagName?: string; name: string; status?: string }[];
  }[];
};

const elements: ManifestElement[] = manifest.modules.flatMap((mod) =>
  (mod.declarations ?? [])
    .filter((d) => d.customElement && d.tagName)
    .map((d) => ({
      tagName: d.tagName as string,
      className: d.name,
      modulePath: mod.path,
      status: d.status ?? "",
    }))
);

/** Class names exported from the public entry modules. */
const exportedClasses = new Set(
  [
    ...["src/index.ts", "src/grid.ts"]
      .map(read)
      .join("\n")
      .replace(/\btype\s+\w+/g, "")
      .matchAll(/export\s*\{([^}]*)\}/g),
  ].flatMap((m) =>
    m[1]!
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
  )
);

/** Element module paths the showcase registers for wip tags. */
const wipRegistered = new Set(
  [
    ...read("showcase/src/lib/wip-elements.ts").matchAll(
      /import "\.\.\/\.\.\/\.\.\/(src\/[^"]+)";/g
    ),
  ].map((m) => m[1]!)
);

describe("element status partition", () => {
  test("every element carries a valid @status", () => {
    const bad = elements.filter((e) => !["wip", "experimental", "done"].includes(e.status));
    expect(bad.map((e) => `${e.tagName}: "${e.status}"`)).toEqual([]);
  });

  test("done and experimental elements are exported from a public entry", () => {
    const missing = elements
      .filter((e) => e.status === "done" || e.status === "experimental")
      .filter((e) => !exportedClasses.has(e.className));
    expect(missing.map((e) => `${e.className} (${e.status}) missing from src/index.ts`)).toEqual(
      []
    );
  });

  test("wip elements are not exported from a public entry", () => {
    const leaked = elements
      .filter((e) => e.status === "wip")
      .filter((e) => exportedClasses.has(e.className));
    expect(leaked.map((e) => `${e.className} is wip but exported`)).toEqual([]);
  });

  test("wip elements register for the showcase via wip-elements.ts", () => {
    const unregistered = elements
      .filter((e) => e.status === "wip")
      .filter((e) => !wipRegistered.has(e.modulePath));
    expect(
      unregistered.map((e) => `${e.tagName} (${e.modulePath}) missing from wip-elements.ts`)
    ).toEqual([]);
  });

  test("wip-elements.ts imports nothing that is not a wip element", () => {
    const wipPaths = new Set(elements.filter((e) => e.status === "wip").map((e) => e.modulePath));
    const extras = [...wipRegistered].filter((p) => !wipPaths.has(p));
    expect(extras).toEqual([]);
  });
});
