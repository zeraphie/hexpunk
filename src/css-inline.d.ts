// `import css from "./x.css?inline"` — the Vite / Astro convention for
// reading a stylesheet as a string, used by hp-demo to scope a token
// set to one preview. The showcase's bundler understands the suffix
// natively; tools/build.ts mirrors it for the library bundle, and this
// declaration is what tsc needs to agree with both.
declare module "*.css?inline" {
  const css: string;
  export default css;
}
