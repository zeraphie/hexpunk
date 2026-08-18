// astro.config.mjs — Showcase site config.
//
// Outputs the static build to `../dist/showcase/` (repo-root-relative)
// so the existing Pages workflow keeps uploading from that path. The
// `base` is set for the GitHub project-site URL prefix; for local dev
// Astro ignores it.

import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://zeraphie.github.io",
  base: "/hexpunk",
  outDir: "../dist/showcase",
  // Light-DOM links (header, prose) prefetch as they enter the
  // viewport. The sidebar's shadow-DOM links are invisible to
  // Astro's scanners — Layout runs its own observer for those —
  // and the components index opts its 52 cards down to hover
  // (data-astro-prefetch) so that page doesn't fan out.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
  // Serve the repo-root `assets/` directory as the public root so the
  // showcase reuses the same favicon + self-hosted fonts that ship in
  // the published npm package (package.json `files`). Saves a copy.
  publicDir: "../assets",
  build: {
    assets: "_assets",
  },
  vite: {
    server: {
      fs: {
        // Allow Vite to serve files from the repo root so the layout
        // can import @hexpunk/core source from ../src/.
        allow: [".."],
      },
    },
  },
});
