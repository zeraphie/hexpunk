import { Glob } from "bun";

const elementEntries = await Array.fromAsync(new Glob("src/elements/*.ts").scan("."));

const result = await Bun.build({
  entrypoints: ["src/index.ts", ...elementEntries],
  outdir: "dist",
  target: "browser",
  format: "esm",
  external: ["lit", "lit/*"],
  splitting: true,
  sourcemap: "external",
});

if (!result.success) {
  console.error("Hexpunk build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Hexpunk: built ${result.outputs.length} file(s) → dist/`);
