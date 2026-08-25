# Hexpunk — CLAUDE.md

Wireframe-cyberpunk, hexagonal-first design system. Lit web
components + Bun; Astro showcase in `showcase/` (deployed to
zeraphie.github.io/hexpunk). System spec and source of truth:
[DESIGN.md](../DESIGN.md) (tracked).

## Workflow

Research → design doc → plan → execute, step by step.

1. Substantial work starts as research/discussion and lands in
   `DESIGN.md` (system decisions) or a `.plan/PLAN.<topic>.md` ADR
   (focused reworks — e.g. `.plan/PLAN.hp-grid-smoothness.md`).
2. Plans derive from those as checkbox steps — `.plan/PLAN.md` is the
   canonical roadmap; ADRs carry their own step lists.
3. Execute one step at a time. After each step:
   - tick the checkbox, run `bun run check` — it typechecks and
     regenerates tokens / manifest / ELEMENTS.md, failing while any
     is stale; commit what it regenerated
   - **explain what was implemented, how it works, and why this
     approach over alternatives** — the explanation is part of the
     deliverable, not a courtesy
   - stop and wait for the user to review and verify before the
     next step
4. Never auto-advance. Commit when a step lands or when asked;
   never push unprompted.
5. Open design decisions are surfaced as questions with options —
   never "I'd lean toward X" and ship.

## Style

See [STYLE.md](STYLE.md). Formatting is oxfmt's job, linting is
oxlint's — style review is about what tools can't check.

## Key paths

- `DESIGN.md` — the system spec; every committed decision lives
  here, and only decided work — parked or speculative elements and
  modes stay in PLAN files until they're decided
- `.plan/` — local-only (gitignored) plans: `PLAN.md` the canonical
  roadmap, `PLAN.*.md` per-rework ADRs
- `.ai/STYLE.md` — code style rules
- `.ai/ANTI-PATTERNS.md` / `.ai/PROMPTS.md` / `.ai/ELEMENTS.md` —
  consumer-facing docs for briefing AI tools that _generate_ hexpunk
  UIs (ELEMENTS.md is generated from `custom-elements.json` by
  `tools/build-elements-md.ts` as part of `bun run analyze`; never
  hand-edited)
- `src/elements/` — Lit elements by category; components that
  outgrow one file become by-concern folders (see `hp-grid/`)
- `src/tokens/` — generated from DESIGN.md frontmatter by
  `tools/build-tokens.ts`; never hand-edited
- `src/styles/` — hp-base + shared CSS · `src/lib/` — shared helpers
- `showcase/` — Astro docs site (Bun workspace; imports library
  source directly; persistent-document router — page scripts wire
  per visit, see STYLE.md § Showcase pages)
- `tools/` — Bun build scripts (tokens, icons, CEM → editor data)
