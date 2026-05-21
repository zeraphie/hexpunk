# Hexpunk — Anti-Patterns

What NOT to ask for, and what NOT to generate. Pair with `DESIGN.md` and `PROMPTS.md` when briefing an agent.

## Visual anti-patterns

- **Dense honeycomb tiling.** Hexpunk is sparse by default. Tile patterns are decorative, not interactive — they violate the core principle that hex = interaction or identity.
- **Hexagonal paragraphs / content blocks.** Hexagons are for action, anchor, status. Prose and dense data stay rectangular (`content-card`).
- **Rounded corners beyond 2px.** The system reads as cut, not soft. Pills (`rounded.full`) are only for circular avatars or single-character tokens.
- **Filled hexes everywhere.** The wireframe outline is the signature. Filled hexes are exceptions reserved for high-emphasis CTAs (`hex-action-filled`) and active status states.
- **Inner shadows / embossing.** Hexpunk is etched, not extruded. Use stroke weight and the surface ramp for depth, not bevels.
- **Three colours / three weights in one cell.** One label + one value + one accent maximum.

## Motion anti-patterns

- **Ambient pulses on idle elements.** The system should feel still until touched. The only ambient motion allowed is the pulse along _live_ arc-links.
- **Drifting particles, floating decorations.** Pure noise.
- **Decorative bouncing.** Easing should feel deliberate and tactical.
- **Visible grid at rest.** The invisible hex grid is a layout primitive, not decoration. Reveal only during drag or hold-shift.

## Interaction anti-patterns

- **Input fields inside hex clip-paths.** Caret position and selection break inside non-rectangular shapes. Use `content-card` for inputs.
- **Drag targets that overlap or obscure another module's interactive area.** The snap-grid must keep modules from stacking on occupied slots.
- **Unfolds nested past depth 3.** The tether chain becomes navigationally hostile beyond that.
- **Unfold without a tether.** Continuity is the point — the user must see where the expanded view came from.
- **Camera-zoom unfold for routine peeking.** It reframes the whole canvas. Reserve for "entering" a context (character sheet, sub-graph), not "previewing" a value.
- **Arc-links crossing occupied hexes without dimming them.** The arc layer sits above hexes; visual separation drives readability.
- **Using `<hp-dialog>` for transient notifications.** Toasts are `<hp-toast>`. Dialogs interrupt and demand response; toasts inform and auto-dismiss.
- **Using `<hp-popover>` for tooltips.** Different motion intent — popovers Dock, tooltips fade. Tooltips fire frequently and shouldn't be heavy.
- **Stacking more than 3 toasts simultaneously.** `<hp-toast-stack>` queues additional toasts automatically. More than 3 visible at once becomes noise.
- **Fighting z-index for modal stacking.** Use the native `<dialog>` element + Top Layer via `<hp-dialog>`. The browser owns modal stacking; the design system doesn't.
- **Anchoring popovers / tooltips without bounds-checking.** Use CSS Anchor Positioning's auto-flip (or the JS-positioning fallback's equivalent). Never position into the void.
- **Multiple spinners on screen at once.** Pick one `<hp-spinner>` to represent the overall loading state. Two spinners say "we're confused"; one says "we're working."
- **`<hp-spinner>` for determinate progress.** Use `<hp-progress>` with the actual `value`. Spinners are the indeterminate fallback, not the default.
- **Flashing skeletons.** Skeletons that appear and disappear in under ~200ms feel jittery. Debounce — only render once the wait crosses a perceptible threshold.
- **Empty states that look like errors.** No alarm colours (`error`, `alert`, `warn`) on empty states. Empty is a normal app state, not a failure.
- **Empty states with no icon and no label.** Silence reads as broken — always include at least one.
- **Empty states with multiple competing CTAs.** One canonical next-action, not three.
- **Rendering tables as hex grids.** Tables are for dense data. Hexes are for interactive cells. Don't conflate.
- **Tables inside hex clip-paths.** Caret/selection breaks inside non-rectangular shapes — applies to cell editing too.
- **Using `<hp-table>` for complex data grids.** For virtualisation, server-side sort/filter, column resizing, or thousand-row datasets, reach for a real table library (TanStack Table, AG Grid) and apply Hexpunk classes / tokens on top. `<hp-table>` is for static / lightly-interactive tables.
- **`<hp-tabs>` with more than ~5-7 items.** Drop to a vertical hex nav rail — tabs scale badly past that count.
- **Breadcrumbs deeper than 4 levels.** Same rationale as `unfold-depth-max: 3` — the chain becomes navigationally hostile.
- **Paginating fewer than ~10 items.** Show them all instead. `<hp-pagination>` is for genuinely-paged datasets, not decoration.
- **Using `:focus` instead of `:focus-visible`.** Mouse/touch clicks shouldn't paint focus rings — only keyboard navigation should. `:focus-visible` is the modern, universally-supported default.
- **Trapping focus outside modal `<hp-dialog>`.** Non-modal overlays (popovers, tooltips, unfolds) let focus escape naturally. Trapping outside true modal context confuses keyboard users.
- **Auto-moving focus on tab switch.** `<hp-tabs>` panel content should NOT receive focus on tab change — matches native ARIA tabs guidance. Move focus only on user activation.
- **Composite widget with N tab stops.** Clusters, tabs, radio groups, pagination, breadcrumbs all take ONE tab stop with roving tabindex. Don't tab-iterate every member.
- **Overriding hexpunk-owned shortcuts.** `esc`, `space`, `enter`, arrow keys, `home`/`end`, `?`, and `tab` are reserved for system behaviour. Pick something else (or compose with a modifier) for app-level bindings.
- **Shipping a hotkey library when `hpBindKey()` does the job.** Avoids fragmenting hexpunk apps across `tinykeys` / `hotkeys-js` / `mousetrap`. Only reach for an external library if `hpBindKey` genuinely doesn't cover the use case.

## Token anti-patterns

- **Referencing palette stops directly in components** (`{colors.cyan-500}`). Components reference semantic tokens (`{colors.primary}`) so brand rotation stays cheap.
- **Inventing colour values outside the seven palettes.** Pick from `cyan / green / sky / amber / magenta / crimson / slate`. The seed pair is `#08c` (cyan-500) and `#0c8` (green-500).
- **Inverting dark to make light.** The light theme is a separate, intentionally-balanced palette.
- **Adding new top-level YAML keys without justification.** The design.md alpha schema's recognised top-level keys are `colors`, `typography`, `rounded`, `spacing`, and `components`. Hexpunk extends with `motion:` because motion is the system's signal layer and earns first-class structural treatment alongside colour and typography (see DESIGN.md § Motion). Other extensions (`geometry`, `accessibility`, etc.) stay in prose unless they earn equivalent first-class status.

## Layout anti-patterns

- **Pure honeycomb dashboards.** Use hexagons for navigation, identity, and actions; drop into rectangles for tables, prose, and dense data.
- **Symmetric grids.** Hexpunk reads as arranged, not stacked. Sparseness and asymmetry are features.
- **Forgetting the framing hexes.** Big `hex-cell-lg` cells partially off-canvas are an architectural cue, not an oversight.
- **Overriding `--hp-cell-*` directly when a named density mode would do.** Pick the right `data-hp-density` value instead. Direct token overrides are escape hatches for genuinely novel cases, not for "this app wants slightly smaller hexes."
- **Inventing a fourth density mode in a consumer app.** Three modes are intentional. If a real case appears, propose it upstream rather than diverging — see DESIGN.md § Layout & Spacing › Density modes.

## Component-authoring anti-patterns

- **Shipping an input-like atom that doesn't participate in `<form>` by default.** Every input-shaped `<hp-*>` atom must declare `static formAssociated = true` and call `setFormValue` on change. Skipping this means hexpunk inputs are worse than native — a strange position for a design system. See DESIGN.md § Implementation Notes › Form association.
- **Using `formless` to dodge validation work.** `formless` is for atoms that legitimately carry UI state instead of a form value (CSS-only state-flip patterns, expand/collapse toggles). If you're hitting validation friction on a real input, fix the validation calls — don't bypass form association.

## Hexpunk + AI tools

- **Don't assume Claude Design will get runtime behaviour right.** It produces _layouts_, not choreography. `<hp-grid>` snap math, `<hp-unfoldable>` timing, arc-link bezier control points are runtime — wire those up yourself.
- **Don't paste DESIGN.md and stop there.** Pair it with `PROMPTS.md` (good examples) and `ELEMENTS.md` (props reference) so the agent has both _style_ and _vocabulary_ context.
- **Don't use Hexpunk for everything.** A healthcare onboarding flow probably shouldn't be cyberpunk wireframe. Hexpunk has a strong aesthetic — recognise when it doesn't fit.
