// wrap-panels-body.ts — Wrap every `<hp-code slot="code"
// language="html">` panel's content in a <body> tag so the
// displayed code reads as a real HTML document fragment (not a
// disembodied element list).
//
// Targets `slot="code"` panels only — standalone <hp-code>
// blocks in setup / installation sections aren't demo content
// and don't get the wrap.
//
// Idempotent — skips panels whose content already starts with
// `<body>` or contains `<!DOCTYPE`.
//
// Pass the category as a CLI arg (mirrors convert-jsx-panels.ts):
//
//   bun run tools/wrap-panels-body.ts primitives
//   bun run tools/wrap-panels-body.ts all
//
// Self-formats touched files via oxfmt at the end.

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

// Matches `<hp-code slot="code" language="html">{`CONTENT`}</hp-code>`
// where CONTENT can span multiple lines.
const PATTERN = /<hp-code slot="code" language="html">\{`([\s\S]*?)`\}<\/hp-code>/g;

const root = resolve(import.meta.dir, "..");
const touched: string[] = [];
let totalPanels = 0;

for await (const rel of new Glob(globPattern).scan(root)) {
  const path = resolve(root, rel);
  const before = await Bun.file(path).text();
  let panelsInFile = 0;

  const after = before.replace(PATTERN, (match, inner: string) => {
    // Skip if already wrapped or has full-document chrome.
    const trimmed = inner.trim();
    if (
      trimmed.startsWith("<body>") ||
      trimmed.startsWith("<!DOCTYPE") ||
      trimmed.startsWith("<html")
    ) {
      return match;
    }
    // Indent each non-empty line by two spaces.
    const indented = inner
      .split("\n")
      .map((line) => (line.length > 0 ? `  ${line}` : line))
      .join("\n");
    panelsInFile++;
    return `<hp-code slot="code" language="html">{\`<body>\n${indented}\n</body>\`}</hp-code>`;
  });

  if (after !== before) {
    await Bun.write(path, after);
    touched.push(rel);
    totalPanels += panelsInFile;
    console.log(`  ${rel} → ${panelsInFile} panel(s) wrapped`);
  }
}

if (touched.length === 0) {
  console.log("No unwrapped panels found in the matched files.");
} else {
  console.log(
    `Wrapped ${totalPanels} panel(s) across ${touched.length} file(s) in category "${category}".`
  );
}

await Bun.$`oxfmt`.quiet().nothrow();
