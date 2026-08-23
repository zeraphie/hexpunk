// build-stats.ts — heavy-component bundle costs → perf-stats.json.
//
// Bundles each heavy component in isolation (minified, lit external —
// consumers load lit once for the whole library) and records the
// minified + gzipped byte counts, split into the statically-imported
// cost and any code-split deferred chunks (hp-grid's rendering
// engine). The showcase's PerfStats tables read the emitted JSON, so
// the published size figures regenerate instead of going stale.
//
// Runtime figures (initialisation time, per-frame CPU) cannot come
// from a build — they are profiled in a real browser on real
// hardware — so those table rows stay hand-measured.

import { gzipSync } from "bun";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const OUT_PATH = "showcase/src/data/perf-stats.json";
const WORK_DIR = ".stats-build";

interface Target {
  id: string;
  entry: string;
  /** Code-splitting entries separate their dynamic chunks into a
   * deferred cost (fetched on first use, not with the page). */
  splitting?: boolean;
}

const TARGETS: Target[] = [
  { id: "hp-background", entry: "src/elements/layout/hp-background/index.ts" },
  { id: "hp-grid", entry: "src/grid.ts", splitting: true },
];

interface Cost {
  minifiedBytes: number;
  gzippedBytes: number;
}

function costOf(paths: string[]): Cost {
  let minified = 0;
  let gzipped = 0;
  for (const path of paths) {
    const bytes = readFileSync(path);
    minified += bytes.byteLength;
    gzipped += gzipSync(new Uint8Array(bytes)).byteLength;
  }
  return { minifiedBytes: minified, gzippedBytes: gzipped };
}

const stats: Record<string, { static: Cost; deferred?: Cost }> = {};

for (const target of TARGETS) {
  const outdir = join(WORK_DIR, target.id);
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  const result = await Bun.build({
    entrypoints: [target.entry],
    outdir,
    minify: true,
    splitting: target.splitting ?? false,
    // lit is the library-wide runtime, paid once by every consumer;
    // ?inline CSS imports are a Vite-only affordance of hp-demo.
    external: ["lit", "lit/*", "*?inline"],
  });
  if (!result.success) {
    console.error(`bundle failed for ${target.id}:`, result.logs);
    process.exit(1);
  }
  const files = readdirSync(outdir).filter((name) => name.endsWith(".js"));
  const entryName = files.find((name) => !name.includes("-")) ?? files[0]!;
  // The entry plus everything it reaches through STATIC imports loads
  // with the page; chunks reached only through dynamic `import()` are
  // deferred until first use. The entry names its async chunks inside
  // the `import()` call, so plain name-matching cannot tell the two
  // apart — walk the static edges instead.
  const staticEdges = (source: string): string[] =>
    [...source.matchAll(/(?:from|import)\s*["']\.\/([\w.-]+\.js)["']/g)].map((m) => m[1]!);
  const staticFiles = new Set<string>();
  const queue = [entryName];
  while (queue.length > 0) {
    const name = queue.pop()!;
    if (staticFiles.has(name)) {
      continue;
    }
    staticFiles.add(name);
    queue.push(...staticEdges(readFileSync(join(outdir, name), "utf-8")));
  }
  const deferredFiles = files.filter((name) => !staticFiles.has(name));
  stats[target.id] = { static: costOf([...staticFiles].map((name) => join(outdir, name))) };
  if (deferredFiles.length > 0) {
    stats[target.id]!.deferred = costOf(deferredFiles.map((name) => join(outdir, name)));
  }
}

rmSync(WORK_DIR, { recursive: true, force: true });
mkdirSync("showcase/src/data", { recursive: true });
await Bun.write(
  OUT_PATH,
  JSON.stringify({ generatedAt: new Date().toISOString(), stats }, null, 2) + "\n"
);

for (const [id, cost] of Object.entries(stats)) {
  const fmt = (c: Cost) =>
    `${(c.minifiedBytes / 1024).toFixed(0)} KB min / ${(c.gzippedBytes / 1024).toFixed(0)} KB gz`;
  console.log(
    `${id}: static ${fmt(cost.static)}${cost.deferred ? ` · deferred ${fmt(cost.deferred)}` : ""}`
  );
}
console.log(`wrote ${OUT_PATH}`);
