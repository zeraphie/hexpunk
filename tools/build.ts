import { Glob, type BunPlugin } from "bun";
import { dirname, resolve } from "node:path";

const elementEntries = await Array.fromAsync(new Glob("src/elements/*.ts").scan("."));

/** `import css from "./x.css?inline"` resolves to the stylesheet's text —
 * the Vite / Astro convention the showcase already relies on, mirrored
 * here so the library bundle agrees (see src/css-inline.d.ts). */
const inlineCss: BunPlugin = {
  name: "css-inline",
  setup(build) {
    build.onResolve({ filter: /\.css\?inline$/ }, (args) => ({
      path: resolve(dirname(args.importer), args.path.replace(/\?inline$/, "")),
      namespace: "css-inline",
    }));
    build.onLoad({ filter: /.*/, namespace: "css-inline" }, async (args) => ({
      contents: await Bun.file(args.path).text(),
      loader: "text",
    }));
  },
};

const result = await Bun.build({
  entrypoints: ["src/index.ts", ...elementEntries],
  outdir: "dist",
  target: "browser",
  format: "esm",
  external: ["lit", "lit/*"],
  splitting: true,
  sourcemap: "external",
  plugins: [inlineCss],
});

if (!result.success) {
  console.error("Hexpunk build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Hexpunk: built ${result.outputs.length} file(s) → dist/`);
