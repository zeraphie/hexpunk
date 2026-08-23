# Style Guide — Hexpunk

The TypeScript + Lit adaptation of the shared style guide (root
`STYLE.md` symlink). Where they disagree, this file wins.

## Principles

- Readability over cleverness
- Lit elements are classes by necessity; everything else goes with
  the ecosystem's grain — pure logic stays plain functions (axial
  math, packers, colour parsing)
- Start simple, earn complexity; don't abstract until there's a
  second use case
- **Split files early.** One concern per file. ~250 lines: look for
  a sensible seam; ~400: finding one is a priority. Judgment
  thresholds, not lint rules. Tests exempt. Components that outgrow
  a single file become by-concern folders (`hp-grid/`,
  `hp-background/`).
- **Comments exist for exactly three reasons:**
  1. carrying the intent of a file or function, to keep maintainers
     on track;
  2. reading as a reference for new maintainers;
  3. explaining a highly complex piece of code (shader math, GL
     state, perf tricks) — what it does and why it was done that
     way.
     Anything else is deleted: narration of what the code already
     says, waffle, and references to anything outside the repo (chat
     artifacts, removed code). Explanations longer than a few lines
     belong in DESIGN.md — link the section. **Never reference plan
     / ADR files or their phase/step/question labels from code or
     other shipped text — plans are temporary; the comment must
     carry the reasoning itself.**
     CEM-facing JSDoc (below) is API surface, not commentary — it
     follows its own rule.
- Non-obvious modules open with an intent preamble: box-drawing
  title rule, then tapered prose (each line slightly shorter). A
  DESIGN.md section link may close it when one exists — never a
  plan/ADR file. Max ~6 prose lines; trivial modules get nothing.

  ```
  /*
    ─ Page-attached alignment ─

    Every hp-background samples the tile texture in page
    coordinates, so adjacent instances read as windows onto
    one continuous global hex grid — no seam at element
    boundaries.
  */
  ```

- Constants carry inline rationale where the value isn't
  self-evident
- Box-drawing section dividers (`// ── Section ──`) available for
  long files
- Minimal dependencies: runtime deps are exactly `lit` today
  (plus `pixi.js` scoped to the grid engine once Phase 2 lands).
  Any further dependency needs a strong written case **and**
  current maintenance activity (recent releases, issue triage);
  the default answer is no.
- No emoji in technical writing

## TypeScript + Lit

- Strict TS; no `any` unless truly unavoidable
- `useDefineForClassFields: false` — a reflecting boolean
  `@property` defaulting to `false` discards author-set attributes
  on upgrade; use plain attributes for opt-in flags (see
  hp-background's `page` comment)
- Visual state is state-driven: CSS custom properties + attribute
  selectors. Never inline `el.style.*` writes from JS for visual
  state; cross-shadow context overrides go through `--hp-*`
  properties and `::slotted` attribute specificity.
- **Never put backticks inside CSS comments in a Lit `css`
  template** — the template terminates early and the parse error
  points several lines away. Grep before saving.
- Shared styles via `adoptedStyleSheets` (the hp-base pattern);
  colours only via `--hp-*` tokens — components never hardcode
  palette values
- **CEM-facing JSDoc is mandatory on every element class**: class
  description plus `@fires` / `@slot` / `@cssproperty` /
  `@csspart`. It generates `custom-elements.json`, which feeds the
  showcase API tab and editor completions. Keep it accurate when
  the API changes, and re-run `bun run analyze`.
- Public exports flow through the `src/index.ts` barrel

## Naming

| Thing                 | Convention                | Example                      |
| --------------------- | ------------------------- | ---------------------------- |
| Files                 | `kebab-case`              | `hp-background.ts`           |
| Custom elements       | `hp-<kebab>`              | `<hp-toggle-group>`          |
| Element classes       | `Hp`-prefixed PascalCase  | `HpToggleGroup`              |
| Events                | `hp-<component>-<verb>`   | `hp-grid-move`               |
| Variables / functions | `camelCase`               | `computePanBounds`           |
| Constants             | `SCREAMING_SNAKE_CASE`    | `ZOOM_MAX`                   |
| Private class members | `private camelCase`       | `private pendingFrame`       |
| Tokens / CSS props    | `--hp-*`                  | `--hp-bg-stroke`             |
| Git branches          | gitflow `type/short-desc` | `feature/hp-grid-smoothness` |

## Tests

- Runner: `bun test`; tests collocate next to source
  (`spiral.test.ts` beside `spiral.ts`)
- Unit-test pure logic hard (axial math, packers, parsers) — it's
  the part that can be tested without a browser
- Component / GL rendering test strategy is an open ADR question
  (PLAN.hp-grid-smoothness.md Q5) — don't invent one ad hoc
- Test behaviour, not implementation; names describe the scenario:
  `"skips hidden children when packing"`
- No mocks unless hitting a real external service

## Tooling

- Bun only — `bun add` / `bun run`; never npm or yarn (lockfile
  drift)
- `check` = format:check + lint + typecheck + test + generate:check;
  CI runs the same five as parallel jobs ahead of deploy
- `generate` (tokens, manifest, editor data, ELEMENTS.md) is what
  must track `src/` and DESIGN.md. `check` regenerates in place and
  fails on any diff, so a changed element or token never ships
  without its regenerated files — commit what it regenerated
- Generated files are never hand-edited: `src/tokens/*.css`,
  `custom-elements.json`, `vscode.html-custom-data.json`,
  `.ai/ELEMENTS.md`, generated icon modules

## Showcase pages

- The layout installs Astro's `<ClientRouter />`, so the document
  outlives any one page: a page's module script runs once per
  document while the DOM it wired is swapped out and back in on
  every navigation. A script that wires DOM (lookups, listeners,
  timers, engines) wires it **per visit** through `onPageVisit`
  (`showcase/src/lib/visit.ts`):

  ```ts
  import { onPageVisit } from "../../lib/visit.ts";

  onPageVisit((signal) => {
    const el = document.getElementById("demo");
    if (!el) {
      return; // page-load fires on every page, not just this one
    }
    el.addEventListener("click", onClick, { signal });
    const engine = start(el);
    return () => engine.destroy();
  });
  ```

  The signal aborts on departure — pass it to listeners, check it
  after any await; the returned teardown releases what a signal
  can't. Never `DOMContentLoaded`, `readyState` or module-level
  run-once wiring: they work on a full load and leave every return
  visit dead. Import-only scripts (`import "…/grid.ts"`) are fine
  as they are.

- The library side of the same contract: elements navigate through
  `hpNavigate` (`src/lib/navigate.ts`), never `window.location`,
  so a consumer's router can take over; URL writes carry the
  existing `history.state` forward, as hp-tabs does with
  `replaceState(history.state, …)`, because routers keep their
  own state there.

## Commits

- `type(scope): short description` — scope is the component or
  area (`fix(hp-background): …`); present tense, imperative
- Keep messages to the subject line — the log should read cleanly
  as a list. A body is the exception, for genuinely non-obvious
  changes, and stays to a few lines (root cause + a
  `Refs PLAN.<topic>.md` pointer). Long explanations belong in
  the ADR, not the log.
- No trailers (no Co-Authored-By)

## Performance consideration

Every component gets a loading-cost check before it merges — page
speed is a first-class review item, not an afterthought.

- Measure the isolated cost:
  `bun build src/elements/<path>/<element>.ts --external lit
--minify` then gzip — report min + gzip KB. Measure one-time
  init cost (time from connect to first usable render) and any
  steady-state per-frame cost in the showcase.
- A component is **heavy** when it materially exceeds the atom
  baseline (~5-6 KB gzip) or does meaningful work at connect
  (GL init, large parses, render loops). Heavy is allowed —
  hexpunk's spatial primitives earn their weight — but it must
  be _known_:
  - the component's showcase **Performance** section states the
    measured numbers and the idle behaviour;
  - deferred mitigations (lazy init, subpath import, dynamic
    import of optional machinery) are listed in the driving ADR
    even when not implemented yet.
- Components with animation loops must be able to prove the
  loop is idle-silent (no rAF when nothing animates) — that is
  part of the measurement, not optional.
- Reference points (2026-08-10): typical atom ≈ 5.6 KB gzip;
  hp-background (WebGL field sim) ≈ 14 KB gzip, ~20 ms init,
  ~0.1 ms/frame while animating, zero at idle.

## Error handling

- Components degrade visibly and name the state (the
  `data-hp-fallback` pattern) — never mystery blanks
- Guard at the boundary; early returns; no defensive re-checks
  deep inside
- Never swallow errors silently — a degraded render path logs one
  clear warning with what failed and what the consumer can do
