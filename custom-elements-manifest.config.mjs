// Analyzer config for `cem analyze` (bun run analyze).
//
// Module order in the manifest follows the glob expansion, which
// differs between filesystems — a Windows regen reorders the whole
// file against a Linux one with identical content. Sorting by path
// makes the manifest, and everything generated from it, byte-stable
// across machines, so CI can diff a fresh regen against the commit.
//
// Every custom element also carries a lifecycle `status` — wip |
// experimental | done — read from the `@status` JSDoc tag on the
// class. The manifest is the single source the showcase banner,
// sidebar badges, ELEMENTS.md, and the barrel-partition test all
// read, so a missing or misspelled tag fails the regen loudly here
// rather than rendering an unlabelled component somewhere downstream.

/** Code-unit order: identical on every platform and ICU build. */
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

const STATUSES = new Set(["wip", "experimental", "done"]);

export default {
  globs: ["src/**/*.ts"],
  litelement: true,
  plugins: [
    {
      name: "hexpunk-status",
      analyzePhase({ ts, node, moduleDoc }) {
        if (!ts.isClassDeclaration(node) || !node.name) {
          return;
        }
        const tag = (node.jsDoc ?? [])
          .flatMap((doc) => doc.tags ?? [])
          .find((t) => t.tagName?.getText() === "status");
        if (!tag) {
          return;
        }
        const value = typeof tag.comment === "string" ? tag.comment.trim() : "";
        const decl = (moduleDoc.declarations ?? []).find((d) => d.name === node.name.getText());
        if (decl) {
          decl.status = value;
        }
      },
      packageLinkPhase({ customElementsManifest }) {
        const bad = [];
        for (const mod of customElementsManifest.modules) {
          for (const decl of mod.declarations ?? []) {
            if (!decl.customElement || !decl.tagName) {
              continue;
            }
            if (!STATUSES.has(decl.status)) {
              bad.push(`${decl.tagName} (${mod.path}): ${decl.status ?? "missing @status"}`);
            }
          }
        }
        if (bad.length > 0) {
          throw new Error(
            `hexpunk-status: every element class needs "@status wip|experimental|done" in its JSDoc.\n  ${bad.join("\n  ")}`
          );
        }
      },
    },
    {
      name: "hexpunk-stable-order",
      packageLinkPhase({ customElementsManifest }) {
        customElementsManifest.modules.sort(byPath);
      },
    },
  ],
};
