// convert-jsx-panels.ts — One-shot transformer for the
// HTML-code-panel migration (see PLAN.html-code-panels.md).
//
// Reads every showcase page and rewrites `<hp-code language="jsx">`
// panels into `<hp-code language="html">` panels containing just the
// element markup. Strips the JSX wrapper
// (`import "@hexpunk/core"; export default () => (<>...</>);`) and
// dedents the inner block.
//
// Pass the category as a CLI arg to limit the file scope:
//
//   bun run tools/convert-jsx-panels.ts primitives
//   bun run tools/convert-jsx-panels.ts forms
//   bun run tools/convert-jsx-panels.ts all
//
// Self-formats the touched files at the end via oxfmt so CI stays
// green. Re-runs are idempotent — the regex only matches the JSX
// shape, so already-converted HTML panels pass through unchanged.

import { Glob } from "bun";
import { resolve } from "node:path";

const CATEGORY_PATHS: Record<string, string> = {
  primitives: "showcase/src/pages/components/primitives/*.astro",
  forms: "showcase/src/pages/components/forms/*.astro",
  status: "showcase/src/pages/components/status/*.astro",
  loading: "showcase/src/pages/components/loading/*.astro",
  layout: "showcase/src/pages/components/layout/*.astro",
  images: "showcase/src/pages/components/images/*.astro",
  navigation: "showcase/src/pages/components/navigation/*.astro",
  overlays: "showcase/src/pages/components/overlays/*.astro",
  messaging: "showcase/src/pages/components/messaging/*.astro",
  tether: "showcase/src/pages/components/tether/*.astro",
  unfold: "showcase/src/pages/components/unfold/*.astro",
  deprecated: "showcase/src/pages/components/deprecated/*.astro",
  "getting-started": "showcase/src/pages/getting-started/*.astro",
  all: "showcase/src/pages/**/*.astro",
};

const category = process.argv[2] ?? "all";
const globPattern = CATEGORY_PATHS[category];
if (!globPattern) {
  console.error(`Unknown category: ${category}`);
  console.error(`Available: ${Object.keys(CATEGORY_PATHS).join(", ")}`);
  process.exit(1);
}

/** Strip minimum common indent from a block of lines. */
function dedent(s: string): string {
  const lines = s.split("\n");
  const indents = lines
    .filter((l) => l.trim().length > 0)
    .map((l) => /^(\s*)/.exec(l)?.[1].length ?? 0);
  const min = indents.length > 0 ? Math.min(...indents) : 0;
  return lines
    .map((l) => l.slice(min))
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

// Matches a JSX hp-code panel:
//   language="jsx">{`import "@hexpunk/...";
//
//   export default () => (
//     <>
//       <CONTENT>
//     </>
//   );`}
//
// Captures the CONTENT block. The `s` flag lets `.` match newlines.
const PATTERN_FRAGMENT =
  /language="jsx">\{`import "@hexpunk\/[^"]+";\s*\n\s*\nexport default \(\) => \(\s*\n\s*<>\s*\n([\s\S]*?)\n\s*<\/>\s*\n\);`\}/g;

// Single-element variant (no Fragment wrapper):
//   language="jsx">{`import "@hexpunk/...";
//
//   export default () => (
//     <ELEMENT ... />
//   );`}
const PATTERN_SINGLE =
  /language="jsx">\{`import "@hexpunk\/[^"]+";\s*\n\s*\nexport default \(\) => \(\s*\n([\s\S]*?)\n\s*\);`\}/g;

const root = resolve(import.meta.dir, "..");
const touched: string[] = [];
let totalPanels = 0;

for await (const rel of new Glob(globPattern).scan(root)) {
  const path = resolve(root, rel);
  const before = await Bun.file(path).text();
  let panelsInFile = 0;

  let after = before.replace(PATTERN_FRAGMENT, (_, inner: string) => {
    panelsInFile++;
    return `language="html">{\`${dedent(inner)}\`}`;
  });

  after = after.replace(PATTERN_SINGLE, (_, inner: string) => {
    panelsInFile++;
    return `language="html">{\`${dedent(inner)}\`}`;
  });

  if (after !== before) {
    await Bun.write(path, after);
    touched.push(rel);
    totalPanels += panelsInFile;
    console.log(`  ${rel} → ${panelsInFile} panel(s)`);
  }
}

if (touched.length === 0) {
  console.log("No JSX panels found in the matched files.");
} else {
  console.log(
    `Converted ${totalPanels} panel(s) across ${touched.length} file(s) in category "${category}".`
  );
}

// Self-format. oxfmt reads .astro? — if not, no-op for those.
await Bun.$`oxfmt`.quiet().nothrow();
