# Hexpunk

<img src="./assets/logo-lockup.svg" alt="Hexpunk" width="360" />

[![Version](https://img.shields.io/github/package-json/v/zeraphie/hexpunk)](./package.json)
[![CI](https://github.com/zeraphie/hexpunk/actions/workflows/ci.yml/badge.svg)](https://github.com/zeraphie/hexpunk/actions/workflows/ci.yml)
[![Showcase](https://img.shields.io/badge/showcase-online-orange)](https://zeraphie.github.io/hexpunk/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Runtime: Bun](https://img.shields.io/badge/runtime-bun-fbf0df)](https://bun.sh)
[![Built with Lit](https://img.shields.io/badge/built%20with-lit-324fff)](https://lit.dev)

Hexagonal-first, wireframe-cyberpunk Lit component design system.

The full design system specification is in [DESIGN.md](./DESIGN.md). Everything else in this repo derives from it.

## Quick start

```bash
bun install
bun run showcase
```

Hexpunk runs on **macOS**, **Linux**, and **Windows**. All tooling (Bun, oxfmt, oxlint, Lit) is cross-platform; `.gitattributes` enforces LF for text files. If `bun install` doesn't auto-install native bindings for oxfmt/oxlint on your platform, run `bun run setup:bindings` — it detects your OS + arch and installs the right `@oxlint/binding-*` and `@oxfmt/binding-*` packages.

## Styling

Three CSS files ship from the package. Import them at the root of your app (once, before any `<hp-*>` element renders):

```ts
import "@hexpunk/core/tokens.dark.css"; // design tokens, default theme
import "@hexpunk/core/tokens.light.css"; // light theme overrides (opt-in via [data-theme="light"])
import "@hexpunk/core/elements.css"; // native HTML primitive styling
```

- **`tokens.dark.css` / `tokens.light.css`** — the design system's source of truth for colour, typography, motion, spacing, layers, and component-scoped tokens. Generated from `DESIGN.md`. Dark applies at `:root`; light applies under `[data-theme="light"]` so consumers can toggle themes per-subtree.
- **`elements.css`** — token-driven styling for native HTML primitives (`<p>`, `<a>`, headings, lists, tables, code, blockquote, form fields, details/summary). Two layers in one file:
  1. **Bare reset** (auto-applied): every native primitive picks up tokenised typography, colour, focus ring, and forced-colors fallbacks. No vertical rhythm — headings and paragraphs get zero margin so they compose freely.
  2. **`.hp-prose`** (opt-in class): adds vertical rhythm, list padding, table chrome, blockquote indent, and a 70ch max-width. Wrap article bodies / MDX output / docs prose in `<article class="hp-prose">`.

The showcase has a [preflight tour](https://zeraphie.github.io/hexpunk/getting-started/elements) and a [`.hp-prose` walkthrough](https://zeraphie.github.io/hexpunk/getting-started/prose).

For full hex geometry, hover trace, and motion choreography, reach for the `<hp-*>` components — raw HTML stays as the design system's prose substrate.

## Scripts

| Script                   | Purpose                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `bun run showcase`       | Local showcase page with hot reload                                  |
| `bun run build`          | Build the library to `dist/`                                         |
| `bun run test`           | Run tests                                                            |
| `bun run analyze`        | Regenerate `custom-elements.json` and `vscode.html-custom-data.json` |
| `bun run tokens`         | Regenerate CSS variables from `DESIGN.md`                            |
| `bun run lint`           | Lint with oxlint                                                     |
| `bun run lint:fix`       | Lint + autofix with oxlint                                           |
| `bun run lint:design`    | Validate `DESIGN.md` against the design.md spec                      |
| `bun run format`         | Format with oxfmt                                                    |
| `bun run format:check`   | Check formatting without writing                                     |
| `bun run check`          | Run format-check + lint + design-lint + tests                        |
| `bun run setup:bindings` | Install platform-specific native bindings for oxfmt / oxlint         |

## Stack

- [Lit 3](https://lit.dev) — web components
- [Bun](https://bun.sh) — runtime, bundler, test runner
- [Custom Elements Manifest](https://custom-elements-manifest.open-wc.org/) — element introspection
- [design.md](https://github.com/google-labs-code/design.md) — design system file format

## Editor autocomplete

Hexpunk ships `vscode.html-custom-data.json` (generated from `custom-elements.json` by `bun run analyze`) so HTML language servers can autocomplete `<hp-*>` tags + attributes in any consumer's editor.

**Zed** — add to `.zed/settings.json`:

```json
{
  "lsp": {
    "vscode-html-language-server": {
      "settings": {
        "html": {
          "customData": ["./node_modules/@hexpunk/core/vscode.html-custom-data.json"]
        }
      }
    }
  }
}
```

**VS Code / Cursor** — add to `.vscode/settings.json`:

```json
{
  "html.customData": ["./node_modules/@hexpunk/core/vscode.html-custom-data.json"]
}
```

**Neovim / Helix / Sublime** — configure your HTML LSP's `html.customData` setting to the same path.
