# Hexpunk — Elements Reference

Auto-generated from `custom-elements.json` by `tools/build-elements-md.ts` — do not edit
by hand. Regenerate with `bun run analyze`.

60 elements, alphabetical. Per element: tag, role, attributes / properties
(type, default), slots, events, CSS custom properties, CSS parts. Pair with `DESIGN.md`
(style) and `.ai/PROMPTS.md` (prompt recipes) when briefing an agent.

## `<hp-alert-dialog>`

Alert dialog — role="alertdialog" variant of hp-dialog. Requires an explicit action; backdrop clicks don't dismiss. Use for destructive confirmations and blocking errors.

**Attributes / properties**

- `open`: `boolean` = `false` — Reflect open state. Setting `open` programmatically opens / closes.

**Slots**

- (default) — Dialog message body
- `actions` — Action buttons (typically cancel + confirm)

**Events**

- `hp-alert-dialog-open` — When the dialog opens
- `hp-alert-dialog-close` — When the dialog closes

**CSS parts**

- `dialog` — The native <dialog> element
- `actions` — The action button container

## `<hp-avatar>`

Hex-shaped avatar. Image clips into the hex; falls back to the slotted content (typically initials) on load error or before src resolves.

**Attributes / properties**

- `src`: `string` = `""` — Image URL. When set, the image renders inside the hex. On load error or while pending, the slotted fallback shows instead.
- `alt`: `string` = `""` — Alt text for the image. Required for non-decorative avatars.
- `size`: `"sm" | "md" | "lg"` = `"md"` — Avatar size — matches hp-hex sizes.

**Slots**

- (default) — Fallback content shown when no src or on image load error

**CSS parts**

- `avatar` — The avatar wrapper
- `fallback` — The fallback container holding the slotted initials

## `<hp-background>`

Pointer-aware hex grid backdrop. A faint hex pattern fills the host; pointer movement stirs a soft energy wake that brightens the strokes it passes through, then drifts and fades. Pressing on empty (non-interactive) space ignites a few glowing runners that crawl outward along the lattice edges, branching at random. Two layout modes: contained (default — absolute, fills a positioned parent) and `page` (fixed full-viewport backdrop behind page content).

**Attributes / properties**

- `hex-size`: `number` = `14` — Hex side length in pixels (centre-to-vertex). Smaller = denser pattern. Default 14 — reads as ambient texture, not a focal element.
- `pointer-radius`: `number` = `200` — Radius in pixels of the pointer reveal on the CSS fallback path (tiers 2/3). The GL path's wake size is governed by splat-radius + diffusion instead. Default 200.
- `decay`: `number` = `0.964` — Energy retention per 60 Hz frame in the GL wake sim — higher values leave longer trails. Clamped to [0.5, 0.995]; wall-clock fade time is roughly proportional to 1/(1 − decay). Default 0.964 ≈ a 1.2–1.6 s visible fade (feel-tuned 2026-08-09 from 0.97 — "1.2× faster").
- `splat-strength`: `number` = `1` — Multiplier on the energy injected per pointer move. Default 1.
- `splat-radius`: `number` = `80` — Gaussian radius of the pointer splat in CSS pixels — the width of the freshly-painted wake before diffusion spreads it. Default 80.
- `scroll-stir`: `"edge" | "pointer" | "band" | "off"` = `"edge"` — Where scroll velocity stirs the field: "edge" (a band along the viewport edge new content arrives from), "pointer" (at the cursor/touch position), "band" (a soft full-width band at the viewport centre), or "off". Scroll stirring is capped at the bright tier and disabled under reduced motion.

**CSS custom properties**

- `--hp-bg-stroke` — Base stroke colour
- `--hp-bg-stroke-bright` — Energy-wake stroke colour
- `--hp-bg-stroke-hot` — Ignition-wavefront colour (defaults to the bright colour)
- `--hp-bg-faint-opacity` — Base layer opacity (default 0.25)
- `--hp-bg-bright-opacity` — Wake layer opacity (default 0.3)
- `--hp-bg-hot-opacity` — Ignition-wavefront opacity (default 2× bright, capped at 1)
- `--hp-bg-pointer-radius` — Reveal radius on the CSS fallback path (set from pointer-radius)
- `--hp-bg-decay` — Overrides the decay attribute
- `--hp-bg-splat-strength` — Overrides the splat-strength attribute
- `--hp-bg-splat-radius` — Overrides the splat-radius attribute
- `--hp-bg-z` — Stacking position in page mode (default -1)

## `<hp-badge>`

Small toned status / count badge. Thin shell over hp-cell content variant at sm size with an optional tone overlay.

**Attributes / properties**

- `tone`: `HpBadgeTone` = `"neutral"` — Semantic tone. Defaults to `neutral` (no tone overlay — uses the hp-cell content variant tokens).
- `active`: `boolean` = `false` — Fills the badge with the tone-container colour when set. Reads as "this state is in effect" — see hp-cell's `active`.

**Slots**

- (default) — Badge label or count

## `<hp-banner>`

Inline callout for notes, tips, warnings, and errors. The `tone` attribute drives both the accent colour and the leading icon; `label` adds an uppercase header above the slotted body.

**Attributes / properties**

- `tone`: `HpBannerTone` = `"neutral"` — Semantic tone. `alert` / `error` upgrade role to "alert" for assertive screen-reader announcement.
- `label`: `string | undefined` — Optional uppercase header label (e.g. "Note", "Warning").

**Slots**

- (default) — Banner body content

**CSS parts**

- `banner` — The wrapping container
- `icon` — The leading icon
- `label` — The uppercase label header (when set)

## `<hp-bond>`

Shared-edge bond indicator between two axially-adjacent hexes. Small filled hex dot at the shared edge midpoint; fades to a hairline once the bond settles.

**Attributes / properties**

- `state`: `HpBondState` = `"forming"` — `forming` (default, full visibility) or `settled` (hairline).

## `<hp-button>`

Button primitive — composes hp-cell variant="action" with the semantics consumers expect from a button: role="button", auto-tabindex, Enter / Space activate, disabled blocks clicks, type="submit" drives form.requestSubmit() inside a form.

**Attributes / properties**

- `type`: `"button" | "submit" | "reset"` = `"button"` — Native button type. Determines submit / reset behaviour inside a `<form>`. Default `button` (inert in forms).
- `disabled`: `boolean` = `false` — When set, the button doesn't activate on click / Enter / Space and is removed from the tab order. Visual state inherits hp- cell's stroke at the disabled opacity.
- `filled`: `boolean` = `false` — High-emphasis filled CTA — forwards `filled` to the composed hp-cell.
- `size`: `"xxs" | "xs" | "sm" | "md" | "lg"` = `"sm"` — Cell size. - `xxs` (20px) — dense / tabular controls (e.g. inline icon buttons in a table row) - `xs` (32px) — comfortable form-control sized buttons (e.g. hp-toggle-group, segmented controls) - `sm` (100px, default) — full content / CTA size - `md` (180px) — feature-tile button - `lg` (320px) — hero / landing tile

**Slots**

- (default) — Button label content

## `<hp-cell>`

Universal labelled hex. Subsumes anchor / action / secondary / utility (interactive), content / support / slot (decorative), and positive / warn / alert / error (tone overlay) into one element.

**Attributes / properties**

- `variant`: `HpCellVariant` = `"anchor"` — Role + visual preset. Interactive variants (`anchor|action|secondary|utility`) lift on hover, show the focus trace, and accept keyboard input via the host's `tabindex`. Decorative variants (`content|support|slot`) are static.
- `size`: `"xxs" | "xs" | "sm" | "md" | "lg"` = `"sm"` — Cell size. - `xxs` (20px) — dense inline form-control hex - `xs` (32px) — comfortable inline form-control hex - `sm` (100px, default) — content-hex / general UI tile - `md` (180px, flat-top) — large content tile - `lg` (320px) — feature tile Variant-aware auto-defaults apply when `size` isn't set: `content` → `md`, `support` → `lg`. Form-input components (hp-checkbox, hp-radio) own their own xs/xxs defaults via their own `size` attribute.
- `tone`: `HpCellTone` = `"neutral"` — Semantic tone overlay. `neutral` (default) leaves variant tokens untouched; the others swap stroke / label to the matching semantic colour pair.
- `active`: `boolean` = `false` — When set with a non-neutral tone, fills the hex with the tone-container colour and flips the label to the on-container contrast pair. The cell reads as "this state is in effect".
- `filled`: `boolean` = `false` — Filled-hex paint. Works on `variant="action"` (high-emphasis CTA; darkens to primary-container on hover/focus) and `variant="anchor"` (identity / grip / drag-handle; hue-swaps to secondary on hover/focus/aria-pressed — same as the unfilled anchor engagement motion). Both paint the polygon with `--hp-primary` and flip the label to `--hp-on-primary` at rest.

**Slots**

- (default) — Label content of the cell (text or inline icon)

**CSS custom properties**

- `--hp-stroke-color` — Outline colour of the hex polygon
- `--hp-cell-label-color` — Label text colour
- `--hp-hex-fill` — Inner fill (defaults to canvas, set for swatches)
- `--hp-cursor` — Cursor override (e.g., grab inside hp-grid drags)
- `--hp-hex-pointer-events` — Pointer-events on the inner polygons

**CSS parts**

- `cell` — The wrapping cell element (positioned ancestor for label / trace)
- `label` — The label container (when the variant has a label)

## `<hp-checkbox>`

Hex checkbox. role="checkbox", aria-checked reflects state (true / false / mixed). Space toggles; disabled blocks.

**Attributes / properties**

- `checked`: `boolean` = `false` — Current checked state. Toggled on click / Space.
- `indeterminate`: `boolean` = `false` — Indeterminate (mixed) state — visual is a horizontal bar instead of a check. Sets aria-checked="mixed" for assistive tech. Cleared on next user toggle.
- `disabled`: `boolean` = `false` — Disabled — blocks toggle and removes from tab order.
- `name`: `string | undefined` — Optional name for form integration (not yet wired to the form submission API; placeholder for forthcoming hp-form integration).
- `value`: `string` = `"on"` — Optional value (paired with name) for form integration.
- `size`: `"xxs" | "xs" | "sm"` = `"xs"` — Cell size. `xs` (default, 32px) is the comfortable form-input size; `xxs` (20px) is dense / tabular; `sm` (100px) is the content-hex size — rarely useful here but available.

**Events**

- `change` — When checked changes via user input. detail: { checked }

**CSS parts**

- `box` — The hex container wrapping hp-hex + the glyph
- `glyph` — The check / dash glyph overlay

## `<hp-cluster>`

Multi-hex group layout. `layout="rosette"` (default) preserves the canonical 5-hex navigation rosette via named slots; `layout="honeycomb"` accepts N default-slot children and packs them in honeycomb rings outward from the first child (the centre).

**Attributes / properties**

- `size`: `"sm" | "md" | "lg"` = `"sm"` — Cell size for the cluster — `sm` (default), `md`, or `lg`.
- `layout`: `"rosette" | "honeycomb"` = `"rosette"` — Layout mode. `rosette` is the canonical 5-hex navigation rosette (named slots, current behaviour). `honeycomb` accepts N default-slot children packed into rings outward from the first child.

**Slots**

- (default) — Default slot — N children for honeycomb layout. First child is the centre.
- `centre` — Rosette centre hex
- `top` — Rosette top hex (north neighbour)
- `middle-left` — Rosette west-of-centre
- `middle-right` — Rosette east-of-centre
- `bottom` — Rosette bottom hex (south neighbour)

## `<hp-code>`

Monospaced code block with optional line numbers and per-line hover highlighting. Syntax highlighting is opt-in via `HpCode.setHighlighter(...)`.

**Attributes / properties**

- `language`: `string` = `""` — Language hint passed to the tokeniser (e.g. "typescript").
- `no-line-numbers`: `boolean` = `false` — Hide the line-number gutter.

**Slots**

- (default) — Raw code text (whitespace preserved after a dedent pass)

**CSS custom properties**

- `--hp-code-background` — Override the block background

**CSS parts**

- `pre` — The internal <pre> element
- `code` — The internal <code> element

## `<hp-collapsible>`

Disclosure: trigger + collapsible content. Trigger toggles `open`; content expands via a smooth grid-template-rows transition. aria-expanded + aria-controls wire automatically.

**Attributes / properties**

- `open`: `boolean` = `false` — Open / closed state. Reflects to the host.
- `disabled`: `boolean` = `false` — Disabled — blocks the trigger and removes it from the tab order.

**Slots**

- `trigger` — The element that toggles open / close
- (default) — Revealed content (default slot)

**Events**

- `hp-collapsible-open` — When the panel opens
- `hp-collapsible-close` — When the panel closes

**CSS parts**

- `trigger` — The trigger container
- `content` — The collapsible content region

## `<hp-context-menu>`

Context menu — right-click on the target region opens the menu at the cursor.

**Attributes / properties**

- `open`: `boolean` = `false`

**Slots**

- (default) — Target region (everything not slotted into "content")
- `content` — hp-menu-item children

**Events**

- `hp-context-menu-open` — When the menu opens
- `hp-context-menu-close` — When the menu closes
- `hp-menu-select` — When a menuitem is activated (bubbles from hp-menu-item)

**CSS parts**

- `menu` — The floating menu container

## `<hp-copy>`

Copy-to-clipboard button.

**Attributes / properties**

- `value`: `string` = `""` — Text to write to the clipboard on click
- `copied`: `string` = `"Copied"` — Toast text shown briefly after a successful copy (default: "Copied")
- `icon-only`: `boolean` = `false` — Drop the visible text label (still in the a11y tree); show only the icon

**Slots**

- (default) — Idle button text (default: "Copy"). Provide consumer-translated content for i18n: `<hp-copy value="...">Copy code</hp-copy>`.

**Events**

- `hp-copy-success` — Bubbling CustomEvent on successful clipboard write; detail = { value }
- `hp-copy-error` — Bubbling CustomEvent on failed clipboard write; detail = { error, value }

**CSS parts**

- `button` — The internal <button> element

## `<hp-demo>`

Documentation example envelope. Hex-pattern preview area + code area + Copy code button. Wraps each example on a component doc page.

**Attributes / properties**

- `caption`: `string | undefined` — Optional caption shown above the demo (e.g., "Default", "Sizes", "Active state"). Leave empty for a bare envelope.
- `no-copy`: `boolean` = `false` — Suppress the Copy code button.
- `no-theme-toggle`: `boolean` = `false` — Suppress the per-demo theme toggle.

**Slots**

- (default) — Rendered demo element(s) (the foreground)
- `code` — <pre><code> block showing the source

**CSS parts**

- `caption` — The caption strip (when set)
- `preview` — The preview area with backdrop
- `actions` — The footer toolbar with the Copy button
- `code` — The code area

## `<hp-dialog>`

Modal dialog backed by the native <dialog> + showModal(). Browser focus trap + Escape dismiss + aria-modal. Backdrop click closes by default — `no-backdrop-close` opts out.

**Attributes / properties**

- `open`: `boolean` = `false` — Reflect open state. Setting `open` programmatically calls showModal(); clearing it calls close().
- `no-backdrop-close`: `boolean` = `false` — When set, clicking the backdrop doesn't close. Use for destructive / blocking dialogs that require an explicit action.

**Slots**

- (default) — Dialog body content

**Events**

- `hp-dialog-open` — When the dialog opens (open transitions to true)
- `hp-dialog-close` — When the dialog closes (backdrop click, Escape, or .close())

**CSS parts**

- `dialog` — The native <dialog> element

## `<hp-dropdown-menu>`

Dropdown menu — click-triggered popover with menuitem semantics and arrow-key navigation.

**Attributes / properties**

- `side`: `FloatingSide` = `"bottom"`
- `align`: `FloatingAlign` = `"start"`
- `offset`: `number` = `6`
- `open`: `boolean` = `false`

**Slots**

- (default) — Trigger element (first child)
- `content` — hp-menu-item children

**Events**

- `hp-dropdown-open` — When the menu opens
- `hp-dropdown-close` — When the menu closes
- `hp-menu-select` — When a menuitem is activated. detail: { value, item }

**CSS parts**

- `menu` — The floating menu container

## `<hp-form>`

Form container — thin wrapper around the native <form> with consistent gap + label / input alignment. Stub.

**Attributes / properties**

- `method`: `"get" | "post" | "dialog"` = `"post"` — HTTP method for native submission. Default `post`.
- `action`: `string` = `""` — Submission endpoint.
- `name`: `string | undefined` — Optional form name.
- `no-validate`: `boolean` = `false` — Skip browser native validation when set — let custom JS handle it.

**Slots**

- (default) — Form controls (hp-checkbox, hp-toggle, hp-button, etc.)

## `<hp-grid>`

Canvas hex grid — a pannable, zoomable viewport onto the lattice. Slotted children with `q` / `r` attributes become camera-riding overlay cells; the field beneath is engine-rendered. Ships from `@hexpunk/core/grid`, and the rendering engine loads by dynamic import on first connect.

**Attributes / properties**

- `layout`: `"free" | "spiral" | "rows"` = `"free"` — Placement strategy — same packers as `<hp-layout>`. `free` honours authored `q` / `r`; `spiral` and `rows` run the shared first-fit-decreasing pack.
- `draggable`: `boolean` = `false` — Opt into drag-to-move. Per-cell override via the child's own `draggable` attribute: present force-enables, `draggable="false"` force-disables.
- `tetherable`: `boolean` = `false` — Graph-editor mode: dropping a cell onto another toggles an arc between the pair instead of moving in.
- `pannable`: `string | undefined` — The grid owns the pointer while the cursor is inside it — wheel pans, ctrl/⌘-wheel zooms, empty-space drags pan. Set `pannable="false"` to hand the wheel and empty-space presses back to the page; cell drag and click keep working.
- `row-width`: `number | undefined` — Cells per row for `layout="rows"`; unset uses the world-shape default.
- `dived (property)`: `boolean`
- `tier (property)`: `number` — Current semantic tier (0 until the engine is live).
- `recenter (property)` — Fly the camera home — everything visible again. The way back after panning or zooming far enough to lose the content.

**Slots**

- (default) — Cells carrying `q` / `r` attributes; `<hp-tether>` children are read as declarative arc data and drawn on the canvas

**Events**

- `type`
- `hp-grid-move` — On release, before the settle animation. detail: { element, from, to }
- `hp-grid-drop` — After the settle animation completes. detail: { element, at }
- `hp-grid-bond` — Two cells became axially adjacent. detail: { moved, partner }
- `hp-grid-unbond` — Previously-adjacent cells separated
- `hp-grid-tether` — An arc was created. detail: { source, target, tether }
- `hp-grid-untether` — An arc was removed. detail: { source, target, tether }
- `hp-grid-activate` — A cell was clicked, not dragged. detail: { cell, element }
- `hp-grid-tier` — The semantic tier stepped. detail: { tier }
- `hp-grid-dive` — Dive navigation engaged or surfaced. detail: { dived }
- `hp-grid-pan` — The camera panned

**CSS parts**

- `controls` — The viewport chrome cluster (bottom right)
- `zoom-out` — The − button
- `zoom-in` — The + button
- `recenter` — The fly-home button

## `<hp-hex>`

SVG hex primitive. Every other hex-shaped atom composes this for its stencil; size is the only public knob.

**Attributes / properties**

- `size`: `"xxs" | "xs" | "sm" | "md" | "lg"` = `"sm"` — Cell size. - `xxs` (20px) — dense inline form controls - `xs` (50px) — comfortable inline form controls - `sm` (100px) — content-hex default - `md` (180px) — flat-top content hex - `lg` (320px) — large content hex

**CSS custom properties**

- `--hp-stroke-color` — Outer polygon fill (the "stroke")
- `--hp-hex-fill` — Inner polygon fill (defaults to canvas)
- `--hp-cell` — Cell width; usually set per size attribute
- `--hp-hex-pointer-events` — pointer-events on the painted polygons

## `<hp-hover-card>`

Hover- / focus-triggered floating card. Larger and interactive than hp-tooltip; lighter than hp-popover (no outside-click).

**Attributes / properties**

- `side`: `FloatingSide` = `"bottom"` — Preferred side relative to the trigger.
- `align`: `FloatingAlign` = `"center"` — Alignment along the chosen side.
- `offset`: `number` = `8` — Pixel gap between trigger and card.
- `open-delay`: `number` = `400` — Open delay (ms) before showing. Default 400 — long enough to avoid flashes while skimming, short enough to feel responsive on intent.
- `close-delay`: `number` = `300` — Close delay (ms) before hiding after pointer leaves both the trigger and the card. Default 300 — gives users time to move the pointer from trigger to card.

**Slots**

- (default) — Trigger element (first child)
- `content` — Card body

**Events**

- `hp-hover-card-open` — When the card opens
- `hp-hover-card-close` — When the card closes

**CSS parts**

- `card` — The floating card element

## `<hp-icon>`

SVG icon wrapper — sized via `size` (sm / md / lg), strokes inherit `currentColor`.

**Attributes / properties**

- `size`: `"sm" | "md" | "lg"` = `"md"` — Icon size — `sm` (16px), `md` (default, 20px), or `lg` (24px).

**Slots**

- (default) — SVG content (stroke-based icon)

## `<hp-label>`

Form label primitive — wraps a native <label> with consistent styling and the `for` forwarding, plus optional required / optional markers.

**Attributes / properties**

- `for`: `string` = `""` — ID of the input this label targets. Forwarded to the inner `<label>`'s `for` attribute — clicking the label focuses / toggles the linked input. Maps to the `for` HTML attribute.
- `required`: `boolean` = `false` — Append a "\*" required marker after the label text. Stamps aria-required on the linked input is the consumer's job — this is the visual cue only.
- `optional`: `boolean` = `false` — Append a muted "(optional)" hint after the label text.

**Slots**

- (default) — Label text

## `<hp-latex>`

LaTeX math primitive. Render-only.

**Attributes / properties**

- `value`: `string` = `""` — LaTeX source string
- `block`: `boolean` = `false` — Switch to block (display) mode (default: inline)
- `background`: `boolean` = `false` — Mount an hp-background backdrop (block-mode only)
- `copyable`: `boolean` = `false` — Show a copy-source button in the top-right corner (block-mode only)

**Events**

- `render-error` — Bubbling CustomEvent when the renderer throws; detail = { error, latex }

## `<hp-layout>`

Hex layout primitive — slotted children with `q` / `r` attributes are placed on the axial lattice, and the element sizes to the content it placed. No camera: the page scrolls it, the way it would any other block. `draggable` opts into drag-to-move with snap. Pure CSS, no rendering dependency.

**Attributes / properties**

- `layout`: `"free" | "spiral" | "rows"` = `"free"` — Placement strategy. `free` honours each child's authored `q` / `r`; `spiral` packs outward from the origin in rings; `rows` packs in reading order with a width cap. The packed modes run the same first-fit-decreasing pass the canvas grid uses.
- `size`: `HpLayoutSize | undefined` — Cell tier for the whole surface — the only way to scale a lattice that has no camera to zoom. It is written onto the children as their own `size`, because the tier is more than a width: the stroke step, the ring proportion, and md's flat-top orientation are all chosen by that attribute. Pushing a cell width down instead would scale the hexes while leaving them drawn to another tier's proportions. Leaving it unset touches nothing — children keep whatever size they were authored with, which is how a surface of mixed sizes is still expressible.
- `draggable`: `boolean` = `false` — Opt into drag-to-move, pan and zoom. Per-cell override via the child's own `draggable` attribute: present force-enables, `draggable="false"` force-disables.
- `row-width`: `number | undefined` — Cells per row for `layout="rows"`. Unset — the default — wraps to the element's own width, the way flex items wrap, and re-packs when that width changes. Set it to pin a fixed count for compositions that must hold their shape regardless of space.

**Slots**

- (default) — Cells carrying `q` / `r` attributes

**Events**

- `type`
- `hp-layout-move` — On release, before the settle animation. detail: { element, from, to }
- `hp-layout-drop` — After the settle animation completes. detail: { element, at }
- `hp-layout-bond` — Two cells became axially adjacent. detail: { moved, partner }
- `hp-layout-unbond` — Previously-adjacent cells separated

**CSS custom properties**

- `--hp-cell` — Cell width for an empty surface; once there are children the lattice follows their rendered width. Use `size` to scale the cells themselves.
- `--hp-layout-width` — Measured content width (read-only)
- `--hp-layout-height` — Measured content height (read-only)

## `<hp-link>`

Inline text link. Styled anchor with the hexpunk hue-swap.

**Attributes / properties**

- `href`: `string` = `""` — Destination URL.
- `target`: `string | undefined` — Optional anchor target — `_blank`, `_self`, etc. When `_blank`, `rel="noopener"` is appended automatically.
- `rel`: `string | undefined` — Optional `rel` override. With `target="_blank"` the component defaults to `noopener` — set this prop to extend / override.

**Slots**

- (default) — Link label

## `<hp-link-node>`

Endpoint dot for hp-tether arcs. Tiny filled marker.

**Attributes / properties**

- `bonded`: `boolean` = `false` — When set, the node is bonded to at least one arc-link and fills with `secondary`.

## `<hp-loader>`

Hexagonal-cluster loader. A hollow cluster of small filled hexes — a clockwise spiral wave when indeterminate, a spiral progress fill when a `value` is set. role="progressbar" with aria-label="Loading" by default; aria-valuenow only when determinate.

**Attributes / properties**

- `size`: `"sm" | "md" | "lg"` = `"md"` — Cluster size — `sm` (7 hexes inline), `md` (19 hexes default), `lg` (37 hexes full-page).
- `tone`: `HpLoaderTone` = `"neutral"` — Semantic tone. Default `neutral` reads as --hp-primary ("system busy"); others map to the matching tone stroke.
- `min`: `number` = `0` — Lower bound. Default 0.
- `max`: `number` = `100` — Upper bound. Default 100.
- `value`: `number | null` = `null` — Current progress. Setting a value switches the loader to determinate mode (unless `indeterminate` is also set); a bare `<hp-loader>` spins. Clamped to [min, max].
- `indeterminate`: `boolean` = `false` — Force the indeterminate wave even while a `value` is retained — for flipping back to "busy" without losing the number.
- `timing`: `HpLoaderTiming` = `"irregular"` — Catch-up pacing. `irregular` (default) clears any backlog inside a fixed ~⅓s budget, so bursts of progress visibly quicken the ripple — the honest "this part loaded faster" jank real loaders have. `linear` locks the per-hex pace to the value's measured advance rate instead, so the ripple flows at constant speed.

## `<hp-menu-item>`

A single menu item inside hp-dropdown-menu / hp-context-menu. role="menuitem"; Enter / Space activate; emits hp-menu-select.

**Attributes / properties**

- `value`: `string` = `""` — Value emitted in hp-menu-select. Defaults to the trimmed text content if not provided.
- `disabled`: `boolean` = `false` — Disabled — blocks activation and removes from focus order.

**Slots**

- (default) — Item label

**Events**

- `hp-menu-select` — When activated. detail: { value, item }

## `<hp-menubar>`

Menu bar — managed keyboard navigation across a row of dropdown triggers. role="menubar"; arrow keys move focus between triggers; Home / End jump.

**Attributes / properties**

- `orientation`: `"horizontal" | "vertical"` = `"horizontal"` — Layout direction — controls arrow-key axis.

**Slots**

- (default) — hp-dropdown-menu children (or any [role="menuitem"] triggers)

## `<hp-module-handle>`

Drag handle — a small filled hex used as the grip for moving an hp-cluster or hp-unfold-list. Pure visual indicator; the parent drives the actual drag interaction via drag-handle attribute.

**Attributes / properties**

- `active`: `boolean` = `false` — When set, the handle is currently grabbed — fills with `primary`.

## `<hp-nav-item>`

Single item inside hp-navigation-menu. Plain link when no `content` slot, dropdown trigger when there is one.

**Attributes / properties**

- `href`: `string | undefined` — Destination URL when no submenu is provided — turns the trigger into a plain link.
- `unfold`: `boolean` = `false` — Navigate with the camera-zoom unfold instead of a plain jump: the item's colour expands to cover the viewport before the destination is revealed, riding the same departure sequence as hp-unfold-page. Reserve it for destination-defining links — the expand reads as "you're going somewhere important".

**Slots**

- (default) — The trigger label / link text
- `content` — Optional submenu body (revealed on hover / focus)

**CSS parts**

- `trigger` — The trigger element
- `panel` — The submenu panel (when content is provided)

## `<hp-navigation-menu>`

Top-nav menu with optional hover-revealed submenus.

**Slots**

- (default) — hp-nav-item children

## `<hp-option>`

Single option inside hp-select. role="option"; Enter / Space activate; emits hp-option-select.

**Attributes / properties**

- `value`: `string` = `""` — Value emitted to the parent hp-select.
- `selected`: `boolean` = `false` — Selected — auto-set by parent hp-select.
- `disabled`: `boolean` = `false` — Disabled — blocks activation.

**Slots**

- (default) — Option label

**Events**

- `hp-option-select` — When activated. detail: { value }

## `<hp-pixel>`

Pixel-art renderer. Draws a sequence of states (each a list of [x, y, paletteIndex] pixels) on a fixed hex-clipped canvas; configurable palette and per-state delay drive a sprite-like animation loop.

**Attributes / properties**

- `art`: `string | undefined` — Static ASCII grid. `#` = lit, `.` = empty, digits index into `palette`.
- `type`: `"menu" | "expandable" | "dropside" | undefined` — Built-in icon set by name — no JS wiring needed. Explicit `.states` / `.palette` win when both are set.
- `states (property)`: `HpPixelStates | undefined` — Named position-set states. All states must have the same length.
- `state`: `string | undefined` — Current state when `.states` is set. Falls back to `"idle"`.
- `palette (property)`: `string[] | undefined` — Optional palette for multi-colour pixels. Indices come from digits in ASCII art or the third element of a position tuple.
- `pixel-size`: `number` = `3` — Pixel size in CSS px. Default `3`.
- `interactive`: `boolean` = `false` — Auto-swap to `hover` / `focus` / `active` named states on the matching pseudo-classes. No JS state-flip required.

## `<hp-popover>`

Anchored floating panel. Click-triggered; click-outside / Escape dismiss; focus restoration to the trigger on close.

**Attributes / properties**

- `side`: `FloatingSide` = `"bottom"` — Preferred side relative to the trigger.
- `align`: `FloatingAlign` = `"center"` — Alignment along the chosen side.
- `offset`: `number` = `8` — Pixel gap between trigger and panel. Default 8.
- `open`: `boolean` = `false` — Reflect open state. Setting `open` programmatically opens / closes.

**Slots**

- (default) — Trigger element (first child)
- `content` — Panel body

**Events**

- `hp-popover-open` — When the panel opens
- `hp-popover-close` — When the panel closes

**CSS parts**

- `panel` — The floating panel element

## `<hp-progress>`

Determinate progress indicator. role="progressbar"; aria-valuemin / max / now reflect state. `indeterminate` mode animates a sliding ribbon when the percent isn't known.

**Attributes / properties**

- `min`: `number` = `0` — Lower bound. Default 0.
- `max`: `number` = `100` — Upper bound. Default 100.
- `value`: `number` = `0` — Current value. Clamped to [min, max]. Ignored when `indeterminate` is set.
- `indeterminate`: `boolean` = `false` — Indeterminate mode — animates a sliding ribbon, hides the numeric value from assistive tech. Use when progress is knowable but a specific number isn't available.
- `tone`: `HpProgressTone` = `"neutral"` — Semantic tone for the fill — neutral (primary), positive, warn, alert, error.

**CSS parts**

- `track` — The track that the fill sits inside
- `fill` — The filled portion (or sliding ribbon when indeterminate)

## `<hp-radio>`

Single radio option. Pairs with hp-radio-group as a parent. role="radio", aria-checked reflects state; emits hp-radio-select on click / Space / Enter for the group to track.

**Attributes / properties**

- `value`: `string` = `""` — Value emitted when this radio is selected. Required for the parent hp-radio-group to track selection.
- `checked`: `boolean` = `false` — Selected state. Set by the parent hp-radio-group; consumers shouldn't write directly — use the group's `value` instead.
- `disabled`: `boolean` = `false` — Disabled — blocks selection, removes from tab order.
- `size`: `"xxs" | "xs" | "sm"` = `"xs"` — Cell size. `xs` (default, 32px) is the comfortable form-input size; `xxs` (20px) is dense / tabular; `sm` (100px) is the content-hex size — rarely useful here but available.

**Events**

- `hp-radio-select` — When this radio is activated. detail: { value }

**CSS parts**

- `radio` — The radio container wrapping hp-hex + inner dot
- `dot` — The inner filled hex shown when checked

## `<hp-radio-group>`

Radio group container. Manages selection across slotted hp-radio children — arrow keys move focus + selection between siblings, Home / End jump to first / last, only one child checked at a time. role="radiogroup".

**Attributes / properties**

- `value`: `string` = `""` — Currently selected radio value. Setting this checks the matching child; clearing it unchecks all.
- `disabled`: `boolean` = `false` — Disable the entire group — every child reads as disabled.
- `orientation`: `"horizontal" | "vertical"` = `"vertical"` — Orientation — controls arrow-key direction. `horizontal` moves with ArrowLeft/Right; `vertical` (default) with ArrowUp/Down.
- `name`: `string | undefined` — Optional form name (placeholder for forthcoming hp-form wiring).

**Slots**

- (default) — One or more <hp-radio> children

**Events**

- `change` — When selection changes via click or arrow keys. detail: { value }

## `<hp-scroll-area>`

Custom-scrollbar wrapper. Hides the native scrollbar inside and paints a themed one on top. Native scroll model preserved.

**Attributes / properties**

- `visibility`: `HpScrollVisibility` = `"auto"` — Scrollbar visibility: - `auto` (default): visible whenever the content overflows - `always`: persistently visible - `hover`: only visible while the area is hovered

**Slots**

- (default) — Scrollable content

**CSS parts**

- `viewport` — The scroll viewport (the element that actually scrolls)
- `scrollbar` — The vertical scrollbar track
- `thumb` — The scrollbar thumb

## `<hp-select>`

Custom listbox select — trigger button + popover list of options. role="combobox" on the trigger, role="listbox" on the popover, role="option" on each child.

**Attributes / properties**

- `value`: `string` = `""` — Currently selected value. Setting programmatically activates the matching option (or empty when no match).
- `placeholder`: `string` = `"Select…"` — Placeholder shown on the trigger when no value is selected.
- `disabled`: `boolean` = `false` — Disabled — blocks toggle and removes from tab order.
- `name`: `string | undefined` — Optional form name.

**Slots**

- (default) — hp-option children

**Events**

- `hp-select-open` — When the listbox opens
- `hp-select-close` — When the listbox closes
- `change` — When the value changes via user input. detail: { value }

**CSS parts**

- `trigger` — The trigger button
- `listbox` — The popover listbox

## `<hp-separator>`

Visual + semantic divider. Horizontal (default) or vertical; optional centre glyph (hex / dot / none). `decorative` switches between role=separator and role=presentation.

**Attributes / properties**

- `orientation`: `HpSeparatorOrientation` = `"horizontal"` — Layout direction. Horizontal is a row divider; vertical is a column divider.
- `decorative`: `boolean` = `false` — When set, the separator is purely visual (role=presentation, invisible to assistive tech). Default unset = role=separator.
- `mark`: `HpSeparatorMark` = `"hex"` — Centre glyph. `hex` (default) reads as a small node on the divider; `dot` is a tighter filled dot; `none` is a clean line.

**CSS parts**

- `line` — The line segments either side of the centre glyph
- `mark` — The centre glyph element

## `<hp-sidebar>`

Navigation sidebar chrome. Compose with `<hp-sidebar-item>` leaves and `<hp-sidebar-group>` collapsible sections.

**Attributes / properties**

- `variant`: `HpSidebarVariant` = `"primary"` — Visual variant. - `"primary"` (default): full chrome with a right border. Intended as the page's main nav rail on the left. - `"secondary"`: lighter chrome, no right border. Intended for a right-rail table-of-contents or similar companion list.

**Slots**

- (default) — Nav tree (hp-sidebar-item + hp-sidebar-group children)

## `<hp-sidebar-group>`

Collapsible nav section inside `<hp-sidebar>`. Children (typically `<hp-sidebar-item>` and other `<hp-sidebar-group>`) are slotted into the expanded panel.

**Attributes / properties**

- `label`: `string` = `""` — Summary label text.
- `open`: `boolean` = `false` — Whether the section is expanded. Reflects user toggles.

**Slots**

- (default) — Group contents (items + nested groups)

**CSS parts**

- `summary` — The summary row (label + chevron)

## `<hp-sidebar-item>`

Leaf navigation entry inside `<hp-sidebar>`. The slotted text content is the visible label.

**Attributes / properties**

- `href`: `string` = `""` — Destination URL.
- `active`: `boolean` = `false` — Currently-active page; applies the active highlight.

**Slots**

- (default) — Label text

**CSS parts**

- `link` — The internal anchor element

## `<hp-slider>`

Single-thumb continuous-value slider. role="slider"; aria-valuemin / max / now reflect state. Arrow keys step by `step`, PageUp/PageDown by 10×, Home/End jump to min/max. Pointer drag with capture.

**Attributes / properties**

- `min`: `number` = `0` — Lower bound (default 0).
- `max`: `number` = `100` — Upper bound (default 100).
- `step`: `number` = `1` — Step size for arrow keys / pointer drag (default 1).
- `value`: `number` = `0` — Current value. Clamped to [min, max] on set.
- `disabled`: `boolean` = `false` — Disabled — no input, removed from tab order.
- `name`: `string | undefined` — Optional form name (placeholder for hp-form).

**Events**

- `change` — When the value changes (keyboard or pointer). detail: { value }

**CSS parts**

- `slider` — The slider container
- `track` — The track that the fill sits on
- `fill` — The progress fill (left edge → thumb)
- `thumb` — The hex thumb

## `<hp-tab>`

Single tab inside hp-tabs. role="tab"; auto-slotted into the tablist via slot="tab" in connectedCallback.

**Attributes / properties**

- `value`: `string` = `""`
- `active`: `boolean` = `false`
- `disabled`: `boolean` = `false`

**Slots**

- (default) — Tab label

**Events**

- `hp-tab-select` — When this tab is clicked. detail: { value }

## `<hp-tab-panel>`

Panel body inside hp-tabs. role="tabpanel"; visibility driven by the parent hp-tabs via the `hidden` attribute.

**Attributes / properties**

- `value`: `string` = `""`

**Slots**

- (default) — Panel content

## `<hp-tabs>`

Tabbed content container. Slotted hp-tab children render the tab list; hp-tab-panel children render the panels. Arrow keys cycle tabs; Home / End jump; roving tabindex. `route="hash"` syncs value to URL hash.

**Attributes / properties**

- `value`: `string` = `""` — Selected tab value. Setting this activates the matching tab and shows the matching panel. Default = first tab's value.
- `orientation`: `"horizontal" | "vertical"` = `"horizontal"` — Tab list orientation. Horizontal arrows = Left / Right; vertical = Up / Down.
- `route`: `"hash" | "query" | undefined` — Sync value with the URL. - `"hash"`: reads / writes `location.hash`. Simple but collides with any other consumer of the hash (e.g. heading anchors in panel content, in-page TOC links). Best for standalone pages where the hash is yours alone. - `"query"`: reads / writes a search param (default `tab`, set via `query-param` attribute). Leaves the hash free for in-page anchors. Best for docs pages where panels contain headings with their own slug anchors.
- `query-param`: `string` = `"tab"` — Search-param name used when `route="query"`. Defaults to `tab`.

**Slots**

- `tab` — hp-tab children for the tablist (auto-slotted)
- (default) — hp-tab-panel children for the panels

**Events**

- `hp-tabs-change`
- `change` — When the active tab changes. detail: { value }

**CSS parts**

- `list` — The tablist row / column
- `panels` — The panels container

## `<hp-tag>`

Dismissable tag / chip. hp-cell content variant + optional × close button.

**Attributes / properties**

- `tone`: `HpTagTone` = `"neutral"` — Semantic tone — same set as hp-cell.
- `removable`: `boolean` = `false` — Show the dismiss button. Fires `hp-tag-remove` on click / Enter / Space.
- `disabled`: `boolean` = `false` — Disabled — blocks dismiss action and dims the visual.

**Slots**

- (default) — Tag label

**Events**

- `hp-tag-remove` — When the dismiss × is activated (click / Enter / Space)

**CSS parts**

- `remove` — The dismiss button (when removable)

## `<hp-tether>`

Arc-tether between two distant molecules — curved SVG bezier connecting two hexes referenced by CSS selector (`from` / `to`). Reroutes around obstacles, re-settles after drags.

**Attributes / properties**

- `from`: `string | undefined` — CSS selector for the source molecule. Resolved against document.
- `to`: `string | undefined` — CSS selector for the target molecule. Resolved against document.
- `state`: `"idle" | "active"` = `"active"` — `active` (default) shows full-opacity stroke + travelling pulse; `idle` drops to the container shade and silences the pulse.
- `directed`: `boolean` = `false` — Render an arrowhead at the target end for directed graphs.

**Events**

- `hp-tether-settle` — When the tether settles on a vertex pair. detail: { fromEl, toEl, fromVertexIdx, toVertexIdx }

**CSS custom properties**

- `--hp-tether-arc-width` — Stroke width of the arc
- `--hp-tether-arc-glow` — Glow filter blur radius
- `--hp-tether-arc-pulse-dot` — Diameter of the pulse dot

## `<hp-toast>`

Transient notification toast. Slides in, auto-dismisses after `duration` ms (0 = sticky). `alert` / `error` tones upgrade aria-live to assertive.

**Attributes / properties**

- `open`: `boolean` = `false` — Open state — drives the slide-in animation.
- `tone`: `HpToastTone` = `"neutral"` — Semantic tone. `alert` / `error` upgrade role to "alert" for assertive screen-reader announcement.
- `duration`: `number` = `4000` — Auto-dismiss after this many ms. 0 = sticky (manual close only). Default 4000.

**Slots**

- (default) — Toast message body

**Events**

- `hp-toast-open` — When the toast becomes visible
- `hp-toast-close` — When the toast closes (auto or via .close())

**CSS parts**

- `toast` — The wrapping toast element
- `content` — The content container

## `<hp-toggle>`

Two-state on/off switch. role="switch", aria-checked reflects state; Space / Enter activate; disabled blocks.

**Attributes / properties**

- `checked`: `boolean` = `false` — On (checked) state.
- `disabled`: `boolean` = `false` — Disabled — no activation, removed from tab order.
- `name`: `string | undefined` — Optional form name (placeholder for forthcoming hp-form wiring).
- `value`: `string` = `"on"` — Submitted value when checked.

**Events**

- `change` — When the switch flips via user input. detail: { checked }

**CSS parts**

- `track` — The pill-shaped track element
- `thumb` — The sliding hex thumb

## `<hp-toggle-group>`

Group of toggle buttons with single or multi-select semantics. Slotted children carry `value` attributes; the group tracks `value` (string for single, space-separated for multiple) and stamps aria-pressed on each pressed child.

**Attributes / properties**

- `type`: `HpToggleGroupType` = `"single"` — Selection model. `single` allows one button pressed at a time (toggling on a different button unpresses the previous one). `multiple` allows any combination.
- `value`: `string` = `""` — Current selection. Single mode: the chosen value as a string; empty string = nothing selected. Multiple mode: space-separated values.
- `orientation`: `"horizontal" | "vertical"` = `"horizontal"` — Layout direction — also drives the honeycomb zigzag direction when `layout="honeycomb"`.
- `layout`: `HpToggleGroupLayout` = `"flex"` — Visual arrangement. - `flex` (default) — children laid out as inline-flex with a standard row / column. - `honeycomb` — children positioned in a hex-grid zigzag. Subsequent items add to the right (orientation=horizontal) or alternate bottom-right / bottom-left (orientation=vertical). Each adjacent pair shares an edge with hp-grid's stroke-overlap correction so the strokes coincide into a single line.
- `disabled`: `boolean` = `false` — Disable the entire group.

**Slots**

- (default) — hp-button or hp-cell children with `value` attributes

**Events**

- `change` — When selection changes. detail: { value }

## `<hp-toolbar>`

Toolbar container with managed keyboard navigation. Roving tabindex over slotted focusable children; arrow keys move between them; Home / End jump to first / last; Tab leaves the toolbar.

**Attributes / properties**

- `orientation`: `"horizontal" | "vertical"` = `"horizontal"` — Layout direction — controls which arrow keys move focus.

**Slots**

- (default) — Toolbar controls (hp-button, hp-toggle, hp-checkbox, hp-separator, etc.)

## `<hp-tooltip>`

Lightweight tooltip — wraps a trigger element and shows the slotted `content` on hover / focus. role="tooltip", auto aria-describedby on the trigger while visible, Escape dismisses.

**Attributes / properties**

- `side`: `HpTooltipSide` = `"top"` — Tooltip side relative to the trigger.
- `open-delay`: `number` = `300` — Delay before showing on hover (ms). Default 300. Reduces flickering when the cursor passes over a trigger.
- `close-delay`: `number` = `100` — Delay before hiding on mouseleave (ms). Default 100.

**Slots**

- (default) — Trigger element (first child)
- `content` — Tooltip body

**CSS parts**

- `tooltip` — The tooltip body element

## `<hp-unfold-list>`

Ring-expanding list primitive — click the source to fan slotted children into a 6-slot ring around it; click outside to close.

**Attributes / properties**

- `open`: `boolean` = `false` — Reflected open / closed state. Drives the bloom CSS + the `aria-pressed` mirror on the source.
- `unordered`: `boolean` = `false` — When set, children land at a randomly-shuffled subset of the 6 ring positions and stagger in random order (both keyed off the same permutation). Without it, children land in clockwise spiral order and stagger in that same order. Mirrors the ordered / unordered semantics of `<ol>` vs `<ul>`.

**Slots**

- `source` — The trigger hex (always visible)
- (default) — Children fanned into the ring when open

**Events**

- `hp-unfold-open` — When the list opens
- `hp-unfold-close` — When the list closes

## `<hp-unfold-overlay>`

Hex-clipped lightbox / modal. Native <dialog> + showModal() under the hood; the slotted body is clipped to a hex shape with an animated open / close.

**Attributes / properties**

- `open`: `boolean` = `false` — Reflected open / closed state. Setting it imperatively calls showModal / close on the inner <dialog>.

**Slots**

- `source` — The trigger element (always visible)
- (default) — The overlay body content

**Events**

- `hp-unfold-open` — When the overlay opens
- `hp-unfold-close` — When the overlay closes (backdrop or .close())

## `<hp-unfold-page>`

Camera-zoom navigation primitive. Click the source hex (or any <a data-hp-unfold>) and its colour rapidly expands to cover the viewport, then the destination page is revealed. The View Transitions API drives the animation — cross-document by default, same-document when a client router registers the library-wide `setNavigate`.

**Attributes / properties**

- `href`: `string` = `""` — Target URL. Must be same-origin for cross-document View Transitions to engage; cross-origin navigations skip the VT and just navigate.
- `preview`: `boolean` = `false` — When set, clicking the source plays the expand-and-shrink animation in place without navigating. The overlay scales up to viewport coverage, holds, then scales back down. Use for showcase demos and visual previews.

**Slots**

- `source` — The hex / element that triggers the expand

## `<hp-visually-hidden>`

Visually hidden but accessible — content is read by assistive tech but doesn't render on screen.

**Slots**

- (default) — Content for screen readers only
