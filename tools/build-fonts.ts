// build-fonts.ts — Mirror Google Fonts woff2 files into assets/fonts/.
//
// Hexpunk self-hosts its three typefaces (Iceland for the wordmark,
// Chakra Petch for UI, Fira Code for code) so the showcase + brand
// SVGs don't depend on a runtime fetch of fonts.gstatic.com. Only the
// latin subset is mirrored — adding Thai / Vietnamese / Cyrillic
// support would double the asset payload and isn't needed for any
// shipped surface.
//
// Run: `bun run fonts`. Re-running overwrites the existing files
// with whatever Google Fonts is currently serving (font shipping
// versions on the gstatic CDN bump occasionally).

import { mkdir, writeFile } from "node:fs/promises";

const GF_URL =
  "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=Fira+Code:wght@300;400;500;600;700&family=Iceland&display=swap";

const SLUG_MAP: Record<string, string> = {
  "Chakra Petch": "chakra-petch",
  "Fira Code": "fira-code",
  Iceland: "iceland",
};

const UA = "Mozilla/5.0 AppleWebKit/537.36 Chrome/120.0";

await mkdir("assets/fonts", { recursive: true });

const css = await (await fetch(GF_URL, { headers: { "user-agent": UA } })).text();

interface FontEntry {
  fam: string;
  weight: string;
  url: string;
}

const entries: FontEntry[] = [];
const parts = css.split("@font-face");

for (let i = 1; i < parts.length; i++) {
  const prevChunk = parts[i - 1] ?? "";
  const block = parts[i] ?? "";
  const commentMatches = [...prevChunk.matchAll(/\/\*\s*([^*]+?)\s*\*\//g)];
  const subset = commentMatches.length ? commentMatches[commentMatches.length - 1]?.[1].trim() : "";
  if (subset !== "latin") {
    continue;
  }
  const fam = /font-family:\s*'([^']+)'/.exec(block)?.[1];
  const weight = /font-weight:\s*(\d+)/.exec(block)?.[1];
  const url = /src:\s*url\((https:[^)]+)\)/.exec(block)?.[1];
  if (!fam || !weight || !url) {
    continue;
  }
  entries.push({ fam, weight, url });
}

const cssLines: string[] = [
  "/* fonts.css — self-hosted Hexpunk typeface stack.",
  " *",
  " * Generated from Google Fonts (latin subset only). Iceland is the wordmark face,",
  " * Chakra Petch is the body / UI face, Fira Code is the mono face. To regenerate,",
  " * re-run tools/build-fonts.ts (downloads from fonts.gstatic.com).",
  " */",
  "",
];

for (const { fam, weight, url } of entries) {
  const slug = SLUG_MAP[fam];
  if (!slug) {
    continue;
  }
  const filename = `${slug}-${weight}.woff2`;
  console.log(`fetching ${fam} ${weight} → ${filename}`);
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  await writeFile(`assets/fonts/${filename}`, buf);
  cssLines.push(
    `@font-face {`,
    `  font-family: "${fam}";`,
    `  font-style: normal;`,
    `  font-weight: ${weight};`,
    `  font-display: swap;`,
    `  src: url("./${filename}") format("woff2");`,
    `}`,
    ""
  );
}

await writeFile("assets/fonts/fonts.css", cssLines.join("\n"));
console.log(`\nwrote ${entries.length} font files + fonts.css`);
