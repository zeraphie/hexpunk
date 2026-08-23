# Hexpunk — Elements Reference

Auto-generated from `custom-elements.json` by `tools/build-elements-md.ts` — do not edit
by hand. Regenerate with `bun run analyze`.

26 elements, alphabetical (31 wip elements omitted — showcase-only,
not exported). Per element: tag, status, role, attributes / properties (type, default),
slots, events, CSS custom properties, CSS parts. Pair with `DESIGN.md` (style) and
`.ai/PROMPTS.md` (prompt recipes) when briefing an agent.

## `<hp-background>`

**Status:** done

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

## `<hp-banner>`

**Status:** done

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

## `<hp-button>`

**Status:** done

Button primitive — composes hp-cell variant="action" with the semantics consumers expect from a button: role="button", auto-tabindex, Enter / Space activate, disabled blocks clicks, type="submit" drives form.requestSubmit() inside a form.

**Attributes / properties**

- `type`: `"button" | "submit" | "reset"` = `"button"` — Native button type. Determines submit / reset behaviour inside a `<form>`. Default `button` (inert in forms).
- `disabled`: `boolean` = `false` — When set, the button doesn't activate on click / Enter / Space and is removed from the tab order. Visual state inherits hp- cell's stroke at the disabled opacity.
- `filled`: `boolean` = `false` — High-emphasis filled CTA — forwards `filled` to the composed hp-cell.
- `size`: `"xxs" | "xs" | "sm" | "md" | "lg"` = `"sm"` — Cell size. - `xxs` (20px) — dense / tabular controls (e.g. inline icon buttons in a table row) - `xs` (32px) — comfortable form-control sized buttons (e.g. hp-toggle-group, segmented controls) - `sm` (100px, default) — full content / CTA size - `md` (180px) — feature-tile button - `lg` (320px) — hero / landing tile

**Slots**

- (default) — Button label content

## `<hp-cell>`

**Status:** done

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

## `<hp-code>`

**Status:** done

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

**Status:** done

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

## `<hp-copy>`

**Status:** done

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

**Status:** done

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

## `<hp-grid>`

**Status:** done

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

**Status:** done

SVG hex primitive. Every other hex-shaped atom composes this for its stencil; size is the only public knob.

**Attributes / properties**

- `size`: `"xxs" | "xs" | "sm" | "md" | "lg"` = `"sm"` — Cell size. - `xxs` (20px) — dense inline form controls - `xs` (50px) — comfortable inline form controls - `sm` (100px) — content-hex default - `md` (180px) — flat-top content hex - `lg` (320px) — large content hex

**CSS custom properties**

- `--hp-stroke-color` — Outer polygon fill (the "stroke")
- `--hp-hex-fill` — Inner polygon fill (defaults to canvas)
- `--hp-cell` — Cell width; usually set per size attribute
- `--hp-hex-pointer-events` — pointer-events on the painted polygons

## `<hp-latex>`

**Status:** done

LaTeX math primitive. Render-only.

**Attributes / properties**

- `value`: `string` = `""` — LaTeX source string
- `block`: `boolean` = `false` — Switch to block (display) mode (default: inline)
- `background`: `boolean` = `false` — Mount an hp-background backdrop (block-mode only)
- `copyable`: `boolean` = `false` — Show a copy-source button in the top-right corner (block-mode only)

**Events**

- `render-error` — Bubbling CustomEvent when the renderer throws; detail = { error, latex }

## `<hp-layout>`

**Status:** done

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

**Status:** done

Inline text link. Styled anchor with the hexpunk hue-swap.

**Attributes / properties**

- `href`: `string` = `""` — Destination URL.
- `target`: `string | undefined` — Optional anchor target — `_blank`, `_self`, etc. When `_blank`, `rel="noopener"` is appended automatically.
- `rel`: `string | undefined` — Optional `rel` override. With `target="_blank"` the component defaults to `noopener` — set this prop to extend / override.

**Slots**

- (default) — Link label

## `<hp-loader>`

**Status:** done

Hexagonal-cluster loader. A hollow cluster of small filled hexes — a clockwise spiral wave when indeterminate, a spiral progress fill when a `value` is set. role="progressbar" with aria-label="Loading" by default; aria-valuenow only when determinate.

**Attributes / properties**

- `size`: `"sm" | "md" | "lg"` = `"md"` — Cluster size — `sm` (7 hexes inline), `md` (19 hexes default), `lg` (37 hexes full-page).
- `tone`: `HpLoaderTone` = `"neutral"` — Semantic tone. Default `neutral` reads as --hp-primary ("system busy"); others map to the matching tone stroke.
- `min`: `number` = `0` — Lower bound. Default 0.
- `max`: `number` = `100` — Upper bound. Default 100.
- `value`: `number | null` = `null` — Current progress. Setting a value switches the loader to determinate mode (unless `indeterminate` is also set); a bare `<hp-loader>` spins. Clamped to [min, max].
- `indeterminate`: `boolean` = `false` — Force the indeterminate wave even while a `value` is retained — for flipping back to "busy" without losing the number.
- `timing`: `HpLoaderTiming` = `"irregular"` — Catch-up pacing. `irregular` (default) clears any backlog inside a fixed ~⅓s budget, so bursts of progress visibly quicken the ripple — the honest "this part loaded faster" jank real loaders have. `linear` locks the per-hex pace to the value's measured advance rate instead, so the ripple flows at constant speed.

## `<hp-nav-item>`

**Status:** done

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

**Status:** done

Top-nav menu with optional hover-revealed submenus.

**Slots**

- (default) — hp-nav-item children

## `<hp-pixel>`

**Status:** done

Pixel-art renderer. Draws a sequence of states (each a list of [x, y, paletteIndex] pixels) on a fixed hex-clipped canvas; configurable palette and per-state delay drive a sprite-like animation loop.

**Attributes / properties**

- `art`: `string | undefined` — Static ASCII grid. `#` = lit, `.` = empty, digits index into `palette`.
- `type`: `"menu" | "expandable" | "dropside" | undefined` — Built-in icon set by name — no JS wiring needed. Explicit `.states` / `.palette` win when both are set.
- `states (property)`: `HpPixelStates | undefined` — Named position-set states. All states must have the same length.
- `state`: `string | undefined` — Current state when `.states` is set. Falls back to `"idle"`.
- `palette (property)`: `string[] | undefined` — Optional palette for multi-colour pixels. Indices come from digits in ASCII art or the third element of a position tuple.
- `pixel-size`: `number` = `3` — Pixel size in CSS px. Default `3`.
- `interactive`: `boolean` = `false` — Auto-swap to `hover` / `focus` / `active` named states on the matching pseudo-classes. No JS state-flip required.

## `<hp-separator>`

**Status:** done

Visual + semantic divider. Horizontal (default) or vertical; optional centre glyph (hex / dot / none). `decorative` switches between role=separator and role=presentation.

**Attributes / properties**

- `orientation`: `HpSeparatorOrientation` = `"horizontal"` — Layout direction. Horizontal is a row divider; vertical is a column divider.
- `decorative`: `boolean` = `false` — When set, the separator is purely visual (role=presentation, invisible to assistive tech). Default unset = role=separator.
- `mark`: `HpSeparatorMark` = `"hex"` — Centre glyph. `hex` (default) reads as a small node on the divider; `dot` is a tighter filled dot; `none` is a clean line.

**CSS parts**

- `line` — The line segments either side of the centre glyph
- `mark` — The centre glyph element

## `<hp-sidebar>`

**Status:** done

Navigation sidebar chrome. Compose with `<hp-sidebar-item>` leaves and `<hp-sidebar-group>` collapsible sections.

**Attributes / properties**

- `variant`: `HpSidebarVariant` = `"primary"` — Visual variant. - `"primary"` (default): full chrome with a right border. Intended as the page's main nav rail on the left. - `"secondary"`: lighter chrome, no right border. Intended for a right-rail table-of-contents or similar companion list.

**Slots**

- (default) — Nav tree (hp-sidebar-item + hp-sidebar-group children)

## `<hp-sidebar-group>`

**Status:** done

Collapsible nav section inside `<hp-sidebar>`. Children (typically `<hp-sidebar-item>` and other `<hp-sidebar-group>`) are slotted into the expanded panel.

**Attributes / properties**

- `label`: `string` = `""` — Summary label text.
- `open`: `boolean` = `false` — Whether the section is expanded. Reflects user toggles.

**Slots**

- (default) — Group contents (items + nested groups)

**CSS parts**

- `summary` — The summary row (label + chevron)

## `<hp-sidebar-item>`

**Status:** done

Leaf navigation entry inside `<hp-sidebar>`. The slotted text content is the visible label.

**Attributes / properties**

- `href`: `string` = `""` — Destination URL.
- `active`: `boolean` = `false` — Currently-active page; applies the active highlight.

**Slots**

- (default) — Label text

**CSS parts**

- `link` — The internal anchor element

## `<hp-tab>`

**Status:** done

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

**Status:** done

Panel body inside hp-tabs. role="tabpanel"; visibility driven by the parent hp-tabs via the `hidden` attribute.

**Attributes / properties**

- `value`: `string` = `""`

**Slots**

- (default) — Panel content

## `<hp-tabs>`

**Status:** done

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

## `<hp-tether>`

**Status:** done

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

## `<hp-unfold-page>`

**Status:** experimental

Camera-zoom navigation primitive. Click the source hex (or any <a data-hp-unfold>) and its colour rapidly expands to cover the viewport, then the destination page is revealed. The View Transitions API drives the animation — cross-document by default, same-document when a client router registers the library-wide `setNavigate`.

**Attributes / properties**

- `href`: `string` = `""` — Target URL. Must be same-origin for cross-document View Transitions to engage; cross-origin navigations skip the VT and just navigate.
- `preview`: `boolean` = `false` — When set, clicking the source plays the expand-and-shrink animation in place without navigating. The overlay scales up to viewport coverage, holds, then scales back down. Use for showcase demos and visual previews.

**Slots**

- `source` — The hex / element that triggers the expand
