// Analyzer config for `cem analyze` (bun run analyze).
//
// Module order in the manifest follows the glob expansion, which
// differs between filesystems — a Windows regen reorders the whole
// file against a Linux one with identical content. Sorting by path
// makes the manifest, and everything generated from it, byte-stable
// across machines, so CI can diff a fresh regen against the commit.

/** Code-unit order: identical on every platform and ICU build. */
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export default {
  globs: ["src/**/*.ts"],
  litelement: true,
  plugins: [
    {
      name: "hexpunk-stable-order",
      packageLinkPhase({ customElementsManifest }) {
        customElementsManifest.modules.sort(byPath);
      },
    },
  ],
};
