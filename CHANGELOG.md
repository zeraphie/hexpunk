# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **`@hexpunk/core/elements.css`** — token-driven preflight for native HTML primitives. Bare reset (auto-applied) styles every native element (headings, paragraphs, links, lists, tables, code, blockquote, hr, figure, details/summary, form inputs) using `--hp-*` tokens; `.hp-prose` (opt-in class) adds vertical rhythm, list indent, table chrome, and a 70ch max-width for long-form content. Focus ring mirrors `hp-base`; reduced-motion and forced-colors fallbacks included. Custom `<summary>` marker rotates 90° on open.
- Showcase: `/getting-started/elements` — preflight tour walking every styled primitive inside `<hp-demo>` blocks, with hp-banner callouts pointing to the `<hp-*>` component upgrade path for code, dividers, and form elements.
- Showcase: `/getting-started/prose` — `.hp-prose` walkthrough with side-by-side comparison, plain-English rhythm-rule breakdown, and a "when NOT to use it" section.
- README: top-level Styling section documenting the three canonical CSS imports (tokens.dark.css / tokens.light.css / elements.css).
- Package exports: `./elements.css`, `./hp-base.css`, `./tokens.dark.css`, `./tokens.light.css`. The four canonical CSS files now ship explicitly from `src/` and are importable as `@hexpunk/core/<name>.css`.

### Changed

- Showcase `global.css` — removed duplicated typography rules (`html/body` font, `a` colour, `code` chip) now provided by `elements.css`. Removed the bespoke `h2 { label-md uppercase }` override that contradicted the design system's type ramp (h2 → headline-lg); h2 now renders correctly between h1 and h3 in the size hierarchy. Removed the `p { --hp-on-surface-variant }` override; paragraphs now render at full body colour.
