---
version: alpha
name: Hexpunk
description: A hexagonal-first, wireframe-cyberpunk design system. Outlined pointy-top hexes over a warm-dark canvas, blue idle / green engaged. Invisible snap-to-slot grid with molecule bonding and arc-link node graphs, built as Lit web components.

colors:
  primary: "#0088CC"
  on-primary: "#FFFFFF"
  primary-container: "#00557F"
  on-primary-container: "#C9ECFF"
  primary-bright: "#1AA4E8"

  secondary: "#00CC88"
  on-secondary: "#003B22"
  secondary-container: "#005B3D"
  on-secondary-container: "#9CFFD0"

  tertiary: "#5EA7FF"
  on-tertiary: "#00305F"
  tertiary-container: "#1C4A86"
  on-tertiary-container: "#D4E4FF"

  warn: "#FFB23F"
  on-warn: "#3F2400"
  warn-container: "#7A4A00"
  on-warn-container: "#FFE0B5"

  alert: "#FF6BB5"
  on-alert: "#52002F"
  alert-container: "#8E0058"
  on-alert-container: "#FFD9E8"

  error: "#FF6F6F"
  on-error: "#5C0000"
  error-container: "#8C1A1A"
  on-error-container: "#FFD9D9"

  background: "#1D1F20"
  on-background: "#EAEFF2"
  surface: "#1D1F20"
  on-surface: "#EAEFF2"
  surface-variant: "#262A2C"
  on-surface-variant: "#A8B2B8"

  surface-container-lowest: "#141617"
  surface-container-low: "#1A1C1D"
  surface-container: "#202325"
  surface-container-high: "#262A2C"
  surface-container-highest: "#2E3336"

  outline: "#0088CC"
  outline-variant: "#2A4955"
  outline-faint: "#1B2A30"

  inverse-surface: "#EAEFF2"
  inverse-on-surface: "#1D1F20"
  inverse-primary: "#00557F"

  focus-ring: "#FFFFFF"

  cyan-100: "#D6F0FF"
  cyan-200: "#A8DFFB"
  cyan-300: "#5EC2EE"
  cyan-400: "#1AA4E8"
  cyan-500: "#0088CC"
  cyan-600: "#006FAA"
  cyan-700: "#00557F"
  cyan-800: "#003F60"
  cyan-900: "#002A40"
  cyan-1000: "#001828"

  green-100: "#D6FBEE"
  green-200: "#A6F0D2"
  green-300: "#66DFAE"
  green-400: "#22D195"
  green-500: "#00CC88"
  green-600: "#00A56E"
  green-700: "#007F54"
  green-800: "#005B3D"
  green-900: "#003C28"
  green-1000: "#002418"

  sky-100: "#EAF1FF"
  sky-200: "#C9DAFE"
  sky-300: "#9CBFFC"
  sky-400: "#7CB0FB"
  sky-500: "#5EA7FF"
  sky-600: "#3D8DEC"
  sky-700: "#2470C8"
  sky-800: "#1C4A86"
  sky-900: "#0F3666"
  sky-1000: "#062445"

  amber-100: "#FFF1D6"
  amber-200: "#FFDFA3"
  amber-300: "#FFCB72"
  amber-400: "#FFBE57"
  amber-500: "#FFB23F"
  amber-600: "#E89A2A"
  amber-700: "#A06900"
  amber-800: "#7A4A00"
  amber-900: "#523000"
  amber-1000: "#2E1A00"

  magenta-100: "#FFE1F0"
  magenta-200: "#FFB6D9"
  magenta-300: "#FF8CC4"
  magenta-400: "#FF7ABB"
  magenta-500: "#FF6BB5"
  magenta-600: "#E14A98"
  magenta-700: "#B72478"
  magenta-800: "#8E0058"
  magenta-900: "#5C0036"
  magenta-1000: "#33001E"

  crimson-100: "#FFE0E0"
  crimson-200: "#FFB8B8"
  crimson-300: "#FF8F8F"
  crimson-400: "#FF7E7E"
  crimson-500: "#FF6F6F"
  crimson-600: "#DC4949"
  crimson-700: "#A82323"
  crimson-800: "#8C1A1A"
  crimson-900: "#5C0000"
  crimson-1000: "#330000"

  slate-100: "#EAEFF2"
  slate-200: "#D6DCE0"
  slate-300: "#A8B2B8"
  slate-400: "#6B7780"
  slate-500: "#475158"
  slate-600: "#333A3F"
  slate-700: "#2E3336"
  slate-800: "#262A2C"
  slate-900: "#1D1F20"
  slate-1000: "#141617"

typography:
  display-lg:
    fontFamily: "Iceland, Chakra Petch, Orbitron, ui-sans-serif, system-ui, sans-serif"
    fontSize: 56px
    fontWeight: "400"
    lineHeight: 1.05
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: "Chakra Petch, Orbitron, ui-sans-serif, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: "700"
    lineHeight: 1.15
    letterSpacing: -0.02em
  headline-md:
    fontFamily: "Chakra Petch, Orbitron, ui-sans-serif, system-ui, sans-serif"
    fontSize: 22px
    fontWeight: "700"
    lineHeight: 1.2
  title-md:
    fontFamily: "Chakra Petch, Orbitron, ui-sans-serif, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: "600"
    lineHeight: 1.3
    letterSpacing: 0.01em
  body-lg:
    fontFamily: "Chakra Petch, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: "400"
    lineHeight: 1.5
  body-md:
    fontFamily: "Chakra Petch, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 1.5
  body-sm:
    fontFamily: "Chakra Petch, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 1.45
  label-md:
    fontFamily: "Chakra Petch, Orbitron, ui-sans-serif, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: "700"
    lineHeight: 1.2
    letterSpacing: 0.16em
  label-sm:
    fontFamily: "Chakra Petch, Orbitron, ui-sans-serif, system-ui, sans-serif"
    fontSize: 10px
    fontWeight: "700"
    lineHeight: 1.2
    letterSpacing: 0.18em
  list-item-faint:
    fontFamily: "Chakra Petch, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: "400"
    lineHeight: 1.3
  list-item-sibling:
    fontFamily: "Chakra Petch, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: "500"
    lineHeight: 1.3
  list-item-selected:
    fontFamily: "Chakra Petch, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 19px
    fontWeight: "500"
    lineHeight: 1.25
  mono-sm:
    fontFamily: "Fira Code, JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: 13px
    fontWeight: "500"
    lineHeight: 1.45

rounded:
  none: 0px
  DEFAULT: 2px
  sm: 2px
  md: 4px
  full: 9999px

spacing:
  unit: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 64px
  gutter: 12px
  margin: 24px
  hex-cell-sm: 100px
  hex-cell-md: 180px
  hex-cell-lg: 320px
  hex-stroke: 6px
  edge-trace-gap: 4px
  edge-trace-width: 2px
  link-arc-width: 1.2px
  link-arc-glow: 13px
  link-arc-pulse-dot: 4px
  bond-indicator-size: 12px
  module-handle-size: 36px
  icon-sm: 16px
  icon-md: 20px
  icon-lg: 24px
  hex-cell-xs: 50px
  tether-width: 1px
  target-min: 44px
  grid-snap-tolerance: 0.35
  grid-reveal-opacity: 0.18
  unfold-depth-max: 3
  unfold-overlay-opacity: 0.6
  tether-opacity: 0.6

motion:
  duration-fast: 150ms
  duration-medium: 280ms
  duration-slow: 400ms
  ease-default: "cubic-bezier(0.2, 0.8, 0.2, 1)"
  pulse-period: 3400ms
  unfold-trigger: 90ms
  unfold-bloom: 280ms
  unfold-stagger: 60ms
  unfold-tether-draw: 120ms
  unfold-overlay-fade: 180ms
  unfold-close: 360ms

layers:
  base: 0
  support: 1
  default: 10
  hover: 20
  arc: 30
  trace: 40
  overlay: 50
  dragging: 60
  toast: 80
  focus-ring: 100

density:
  compact:
    hex-cell-sm: 80px
    hex-cell-md: 144px
    hex-cell-lg: 256px
    hex-cell-xs: 44px
    hex-stroke: 6px
    gutter: 8px
    margin: 16px
  default:
    hex-cell-sm: 100px
    hex-cell-md: 180px
    hex-cell-lg: 320px
    hex-cell-xs: 50px
    hex-stroke: 6px
    gutter: 12px
    margin: 24px
  comfortable:
    hex-cell-sm: 120px
    hex-cell-md: 216px
    hex-cell-lg: 380px
    hex-cell-xs: 60px
    hex-stroke: 12px
    gutter: 16px
    margin: 32px

components:
  page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.on-background}"
    typography: "{typography.body-md}"

  hex-anchor:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.none}"
    size: "{spacing.hex-cell-sm}"
    padding: "{spacing.sm}"
  hex-anchor-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"

  hex-action:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.none}"
    size: "{spacing.hex-cell-sm}"
    padding: "{spacing.sm}"
  hex-action-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
  hex-action-focus:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-bright}"
  hex-action-filled:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    size: "{spacing.hex-cell-sm}"
  hex-action-filled-hover:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"

  hex-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.tertiary}"
    typography: "{typography.label-md}"
    size: "{spacing.hex-cell-sm}"
    padding: "{spacing.sm}"
  hex-secondary-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"

  hex-utility:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-sm}"
    size: "{spacing.hex-cell-sm}"
    padding: "{spacing.sm}"
  hex-utility-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"

  hex-content:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    size: "{spacing.hex-cell-md}"
    padding: "{spacing.sm}"

  hex-support:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.outline-faint}"
    size: "{spacing.hex-cell-lg}"

  hex-slot:
    backgroundColor: transparent
    textColor: "{colors.outline-variant}"
    size: "{spacing.hex-cell-sm}"

  hex-status-positive:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-sm}"
    size: "{spacing.hex-cell-sm}"
  hex-status-positive-active:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"

  hex-status-warn:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.warn}"
    typography: "{typography.label-sm}"
    size: "{spacing.hex-cell-sm}"
  hex-status-warn-active:
    backgroundColor: "{colors.warn-container}"
    textColor: "{colors.on-warn-container}"

  hex-status-alert:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.alert}"
    typography: "{typography.label-sm}"
    size: "{spacing.hex-cell-sm}"
  hex-status-alert-active:
    backgroundColor: "{colors.alert-container}"
    textColor: "{colors.on-alert-container}"

  hex-status-error:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.error}"
    typography: "{typography.label-sm}"
    size: "{spacing.hex-cell-sm}"
  hex-status-error-active:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.on-error-container}"

  content-card:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"

  input-field:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.on-surface}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  input-field-focus:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"

  textarea-field:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  textarea-field-focus:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"

  hex-checkbox:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.none}"
    size: "{spacing.hex-cell-xs}"
    padding: "{spacing.xs}"
  hex-checkbox-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
  hex-checkbox-checked:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    size: "{spacing.hex-cell-xs}"
  hex-checkbox-checked-hover:
    backgroundColor: "{colors.primary-bright}"
    textColor: "{colors.on-primary}"

  hex-radio:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.none}"
    size: "{spacing.hex-cell-xs}"
    padding: "{spacing.xs}"
  hex-radio-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
  hex-radio-checked:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    size: "{spacing.hex-cell-xs}"

  hex-switch-off:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.outline-variant}"
    typography: "{typography.label-sm}"
    size: "{spacing.hex-cell-sm}"
  hex-switch-on:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-sm}"
    size: "{spacing.hex-cell-sm}"

  select-trigger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.none}"
    size: "{spacing.hex-cell-md}"
    padding: "{spacing.sm}"
  select-trigger-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
  select-trigger-open:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-bright}"

  select-popover:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"

  slider-track:
    backgroundColor: "{colors.outline-faint}"
    textColor: "{colors.outline-variant}"
    height: 1px
  slider-track-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-bright}"
    height: 2px
  slider-thumb:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    size: "{spacing.hex-cell-xs}"
  slider-thumb-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    size: "{spacing.hex-cell-xs}"

  scroll-list-item:
    backgroundColor: transparent
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.list-item-faint}"
    padding: "{spacing.xs}"
  scroll-list-item-sibling:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
    typography: "{typography.list-item-sibling}"
    padding: "{spacing.sm}"
  scroll-list-item-selected:
    backgroundColor: transparent
    textColor: "{colors.secondary}"
    typography: "{typography.list-item-selected}"
    padding: "{spacing.md}"

  toast-inverse:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-on-surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  toast-inverse-action:
    textColor: "{colors.inverse-primary}"

  dialog:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.lg}"
  dialog-backdrop:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface-variant}"

  tooltip:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-on-surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs}"

  popover:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"

  skeleton-hex:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.outline-faint}"
    rounded: "{rounded.none}"
    size: "{spacing.hex-cell-sm}"
  skeleton-rect:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.outline-faint}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"

  spinner:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.none}"
    size: "{spacing.hex-cell-xs}"

  progress-track:
    backgroundColor: "{colors.outline-faint}"
    textColor: "{colors.outline-variant}"
    height: 2px
  progress-fill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-bright}"
    height: 2px

  empty-state-hex:
    backgroundColor: transparent
    textColor: "{colors.outline-faint}"
    rounded: "{rounded.none}"
    size: "{spacing.hex-cell-md}"
  empty-state-label:
    backgroundColor: transparent
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-md}"
    padding: "{spacing.md}"
  empty-state-icon:
    backgroundColor: transparent
    textColor: "{colors.outline-faint}"
    size: "{spacing.hex-cell-xs}"

  table:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
  table-header:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-md}"
    padding: "{spacing.sm}"
  table-row:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    padding: "{spacing.sm}"
  table-row-hover:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface}"
  table-cell-numeric:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
    typography: "{typography.mono-sm}"

  tabs:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
  tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    size: "{spacing.hex-cell-sm}"
  tab-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    size: "{spacing.hex-cell-sm}"
  tab-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"

  breadcrumbs:
    backgroundColor: transparent
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-sm}"
  breadcrumb-segment:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-sm}"
    size: "{spacing.hex-cell-xs}"
  breadcrumb-segment-current:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    size: "{spacing.hex-cell-xs}"

  pagination:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
  page-segment:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-sm}"
    size: "{spacing.hex-cell-xs}"
  page-segment-current:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    size: "{spacing.hex-cell-xs}"

  skip-link:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.primary-bright}"
    typography: "{typography.label-md}"
    rounded: "{rounded.none}"
    padding: "{spacing.md}"

  keymap-dialog:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.lg}"
  keymap-section:
    backgroundColor: transparent
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-md}"
    padding: "{spacing.md}"
  keymap-binding:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    padding: "{spacing.sm}"
  keymap-key:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.primary-bright}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs}"

  focus-indicator:
    backgroundColor: transparent
    textColor: "{colors.focus-ring}"

  surface-ramp:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.surface-container-highest}"
  surface-ramp-mid:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.surface-variant}"

  outline-rule:
    backgroundColor: "{colors.outline}"
    textColor: "{colors.outline-variant}"

  link-arc:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-surface-variant}"
  link-arc-idle:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-surface-variant}"
  link-arc-hover:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-surface}"
  link-arc-active:
    backgroundColor: "{colors.primary-bright}"
    textColor: "{colors.on-primary}"

  link-node:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    size: "{spacing.xs}"
  link-node-bonded:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    size: "{spacing.xs}"

  bond-indicator:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    size: "{spacing.bond-indicator-size}"

  module-handle:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.primary}"
    size: "{spacing.module-handle-size}"
    rounded: "{rounded.none}"
  module-handle-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.none}"

  grid-overlay-dot:
    backgroundColor: "{colors.outline-faint}"
    textColor: "{colors.outline-faint}"
    size: "{spacing.xs}"
  grid-overlay-slot:
    backgroundColor: transparent
    textColor: "{colors.outline-variant}"
    size: "{spacing.hex-cell-sm}"

  unfold-source:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    size: "{spacing.hex-cell-md}"
  unfold-source-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    size: "{spacing.hex-cell-lg}"

  unfold-tether:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.outline-variant}"

  unfold-overlay:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface-variant}"

  unfold-child:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    size: "{spacing.hex-cell-sm}"
    padding: "{spacing.sm}"
---

# Hexpunk

Hexpunk is a hexagonal-first design system. Pointy-top hexes drawn as 6px outlines over a warm dark canvas, animated by hue swaps and signal-routing edge traces. Idle is blue, engaged is green. The screen reads as a circuit being explored, not a page being scrolled.

## Overview

Hexpunk is a deliberate breakaway from rectangular web UI. It is wireframe-cyberpunk: stencilled hexagons, sparse arrangement, big partial cells used as architectural framing, small clusters used as command points.

The mantra:

> Readable first. Hexagonal second. Cyberpunk third.

Three target surfaces share atoms and diverge in density:

- **Admin** — hex anchors and actions, conventional content inside rectangular cards. Clarity beats spectacle.
- **Web** — hexagonal hero clusters, feature grids, onboarding; prose stays rectangular.
- **Game** — expressive asymmetric layouts, HUD panels, ability and inventory cells.

The system is implemented as **Lit** web components with handrolled CSS (see `## Implementation Notes`). No design-library dependency, no CSS-in-JS framework beyond Lit's own `css` template tag.

## Colors

The colour system has two layers:

1. **Palettes (100 → 1000)** — the source of truth. Seven ten-stop ramps named by hue, addressable in components as `{colors.<hue>-<stop>}`. Lighter = lower number, 500 is the canonical mid-stop, darker = higher number.
2. **Semantic tokens** (`primary`, `secondary`, `surface`, etc.) — each is a hex literal _picked from_ a palette stop. Semantic tokens express _function_ (primary action, surface, alert), and components reference them so a theme rotation only needs to re-pick stops, not edit every component.

The design.md alpha schema requires colour values to be hex literals (not refs), so semantic tokens and palette stops share hex values rather than being chained. Treat the **palette as the editorial source** and the **semantic token as the application binding**. When rotating brand colour, change the palette ramp and update the semantic mapping table below in lockstep.

### Seed colours

The whole system is generated from two seeds:

- **Cyan `#08c` (`#0088CC` → `cyan-500`)** — the canonical outline / idle blue from the Hexpunk reference pen. This is the resting voice of the system.
- **Green `#0c8` (`#00CC88` → `green-500`)** — the canonical engagement / hover green from the same pen. When you see green, something is being touched.

Every other palette is intentionally chosen to harmonize with this seed pair. `sky` is a calmer companion blue, `amber` / `magenta` / `crimson` are the alarm trio (warn / alert / error), and `slate` is the neutral ramp that produces the canvas and surface containers.

### Palettes

Each palette has ten stops `100, 200, 300, 400, 500, 600, 700, 800, 900, 1000`. Stops at 500 are the canonical brand value. Stops 100–400 are tints (lighter), 600–1000 are shades (darker).

- **cyan** — primary outline / idle action stroke. `cyan-500 = #0088CC`.
- **green** — engagement / hover / selection. `green-500 = #00CC88`.
- **sky** — alternate cool actions, secondary navigation, info accents. `sky-500 = #5EA7FF`.
- **amber** — warn (caution, pending). `amber-500 = #FFB23F`.
- **magenta** — alert (attention required, restricted). `magenta-500 = #FF6BB5`.
- **crimson** — error (destructive failure). `crimson-500 = #FF6F6F`.
- **slate** — neutral surface ramp. `slate-900 = #1D1F20` (canvas), `slate-100 = #EAEFF2` (on-canvas text).

### Semantic mapping (dark theme)

| Semantic                       | Palette stop            | Hex       |
| ------------------------------ | ----------------------- | --------- |
| `primary`                      | `cyan-500`              | `#0088CC` |
| `primary-bright`               | `cyan-400`              | `#1AA4E8` |
| `primary-container`            | `cyan-700`              | `#00557F` |
| `on-primary`                   | white                   | `#FFFFFF` |
| `on-primary-container`         | `cyan-100` ≈            | `#C9ECFF` |
| `secondary`                    | `green-500`             | `#00CC88` |
| `secondary-container`          | `green-800`             | `#005B3D` |
| `on-secondary`                 | `green-1000` ≈          | `#003B22` |
| `on-secondary-container`       | `green-100` ≈           | `#9CFFD0` |
| `tertiary`                     | `sky-500`               | `#5EA7FF` |
| `tertiary-container`           | `sky-800`               | `#1C4A86` |
| `warn`                         | `amber-500`             | `#FFB23F` |
| `warn-container`               | `amber-800`             | `#7A4A00` |
| `alert`                        | `magenta-500`           | `#FF6BB5` |
| `alert-container`              | `magenta-800`           | `#8E0058` |
| `error`                        | `crimson-500`           | `#FF6F6F` |
| `error-container`              | `crimson-800`           | `#8C1A1A` |
| `background` / `surface`       | `slate-900`             | `#1D1F20` |
| `on-background` / `on-surface` | `slate-100` ≈           | `#EAEFF2` |
| `surface-variant`              | `slate-800`             | `#262A2C` |
| `on-surface-variant`           | `slate-300`             | `#A8B2B8` |
| `surface-container-lowest`     | `slate-1000`            | `#141617` |
| `surface-container-low`        | between 900/1000        | `#1A1C1D` |
| `surface-container`            | between 800/900         | `#202325` |
| `surface-container-high`       | `slate-800`             | `#262A2C` |
| `surface-container-highest`    | `slate-700`             | `#2E3336` |
| `outline`                      | `cyan-500`              | `#0088CC` |
| `outline-variant`              | `cyan-800` desaturated  | `#2A4955` |
| `outline-faint`                | `slate-700` desaturated | `#1B2A30` |

`primary` and `outline` share `cyan-500` intentionally — the hex outline IS the primary signal, not a separate decorative line.

### Usage rules

- The idle → engaged hue swap (**blue → green**, primary → secondary) is the system's most important rule.
- Alarm colours (`warn`, `alert`, `error`) are reserved for their semantic. Never decorative.
- Read tokens by function, not by hue. Components should reference `primary`, not `cyan-500`, even though they resolve to the same value — this keeps theme rotation cheap.
- Component `backgroundColor` / `textColor` pairs are pre-validated for WCAG AA 4.5:1.

## Typography

Three faces — **Iceland** for display, **Chakra Petch** for everything else, **Fira Code** for mono. One geometric voice across body, headline, and label sizes; one signature display face for hero moments; one mono for code, telemetry, and aligned numbers.

- **Display (`display-lg`, logo wordmark):** Iceland — single weight, narrow, sharp angles, all-caps preferred. Used at 24px+ only. Chakra Petch + Orbitron as fallbacks.
- **Headlines / labels / body — the default voice:** Chakra Petch — geometric with hexagonal/octagonal character, weights 300–700, designed to work at both display and reading sizes. Every word in the system shares this DNA. Inter is the body fallback; Orbitron is the display/headline fallback.
- **Mono:** Fira Code — for input fields, code, telemetry readouts, anywhere numbers need to align. Ligature support for code contexts (use sparingly). JetBrains Mono and IBM Plex Mono as fallbacks.

Labels are the signature voice: 10–12px, weight **700**, **uppercase**, letter-spaced `0.16em`–`0.18em`. Chakra Petch's geometric character carries the label feel even at the lower weight cap (700 vs the heavier 800–900 of more conventional display faces). Reserve labels for short strings (≤ 24 characters) — section markers, hex captions, status tags. Long uppercase strings become hostile to read.

The scroll-list pattern (see Components) has three typographic tiers — `list-item-faint` (11px / 0.4 opacity), `list-item-sibling` (14px / 0.8), `list-item-selected` (19px / 1.0) — that encode position-in-list with type size, not just colour.

Avoid stacking three weights in one cluster. A cell typically pairs one label with one display string or one body string.

## Icons

Hexpunk ships **two icon families** that coexist on the same surface and serve different tonal registers.

- **Stroke icons** — geometric, technical, 1.5px outlines in `currentColor`. The schematic mood. Default for admin surfaces and dashboards.
- **Pixel-art icons** — chunky retro-cyberpunk pixels built from stacked `box-shadow` offsets. The HUD/game mood. Used for accents, signature flourishes, and tonally-different moments.

Both share sizing tokens (`icon-sm` `16px`, `icon-md` `20px`, `icon-lg` `24px`) and the `currentColor` convention so an icon inherits its parent's text colour by default.

### Stroke icons — `<hp-icon>`

Source: [Lucide](https://lucide.dev) — ~1300 MIT-licensed icons with a 1.5px stroke that matches hexpunk's wireframe ethos — mirrored into `@hexpunk/icons` at build time, pinned to a known version. Plus ~6-8 custom hex-themed additions: `hex-outline`, `hex-dot`, `hex-grid`, `bond`, `link-arc`, `unfold`, `module-handle`, `tether`.

Authoring: one ESM module per icon, exporting the raw SVG string.

```ts
// @hexpunk/icons/deploy.ts
export const deploy =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">…</svg>` as const;
```

Component:

```html
<!-- Property-based (idiomatic, tree-shakable): -->
<hp-icon size="md" .svg="${deploy}"></hp-icon>

<!-- Slotted (consumer-provided SVG): -->
<hp-icon size="md"><svg>…</svg></hp-icon>
```

All custom hex-themed icons follow Lucide's conventions: `24×24` viewBox, `1.5px` stroke, all strokes use `currentColor`, line caps/joins are round.

### Pixel-art icons — `<hp-pixel>`

Built from stacked `box-shadow`s on a single host element. The host _is_ the centre pixel (sized `pixel-size × pixel-size`, `background: currentColor`); the other pixels are entries in the host's `box-shadow` string. State changes between named position-sets animate via smooth `box-shadow` interpolation — pixels glide between positions.

Three modes, distinguished by which prop is set (precedence: `states` > `frames` > `art`):

1. **Static** — single ASCII-grid frame.
2. **State morph** — coordinate arrays per named state; smooth transition between them on `state` change or pseudo-class match. The headline feature.
3. **Sprite-sheet** — multi-frame loop with `steps()` timing. For loaders and GIF-style animations.

```html
<!-- Static -->
<hp-pixel size="md" .art="${skullArt}"></hp-pixel>

<!-- State morph -->
<hp-pixel size="md" .states="${menuStates}" state="idle" interactive></hp-pixel>

<!-- Sprite-sheet -->
<hp-pixel size="sm" .frames="${loadingFrames}" duration="800ms" loop></hp-pixel>
```

**State-morph mechanics.**

- All states **must have the same length** array. Each index is the same logical pixel across states; the component asserts this at setup.
- The component computes one `box-shadow` string per state and stores them as CSS custom properties on the host (`--hp-pixel-idle`, `--hp-pixel-hover`, `--hp-pixel-active`, etc.).
- The active state is picked by **whichever CSS rule sets `--hp-pixel-shadow`**. Three layers compose without conflict:
  - **`interactive` mode (opt-in convenience).** The component injects `:host(:hover)`, `:host(:focus-visible)`, `:host(:active)` rules into its own shadow DOM, swapping `--hp-pixel-shadow` to the matching state if defined.
  - **CSS-driven swap (the checkbox-flip pattern, zero JS).** Consumer CSS sets `--hp-pixel-shadow` via any selector — `:checked` sibling, `[data-state]`, anything. No JS required.
  - **JS-driven swap.** Flip the `state` attribute on the element.
- The transition between states is `box-shadow var(--hp-pixel-duration, var(--hp-duration-medium)) var(--hp-pixel-easing, var(--hp-ease-default))`, interpolating each pixel's position smoothly.

### Pixel-icon authoring convention

Each pixel icon lives in `@hexpunk/pixel-icons/<name>.ts`, exporting individual state constants and a bundled `default` export.

```ts
// @hexpunk/pixel-icons/menu.ts

// oxfmt-ignore
export const idle = [
  [-2, -2], // top-left
  [0, -2], // top
  [2, -2], // top-right
  [-2, 0], // left
  [0, 0], // centre
  [2, 0], // right
  [-2, 2], // bottom-left
  [0, 2], // bottom
  [2, 2], // bottom-right
];

// oxfmt-ignore
export const hover = [
  [0, -3], // top-left    → top
  [0, -1.5], // top         → top-near
  [3, 0], // top-right   → right-far
  [-1.5, 0], // left        → left-near
  [0, 0], // centre      → centre
  [1.5, 0], // right       → right-near
  [-3, 0], // bottom-left → left-far
  [0, 1.5], // bottom      → bottom-near
  [0, 3], // bottom-right→ bottom
];

export const menu = { idle, hover };
export default menu;
```

Conventions:

1. **Same index = same logical pixel across states.** The component asserts equal lengths; mismatches throw in dev.
2. **Aligned columns inside each array.** Numbers padded to consistent character width so the grid is glance-readable; corresponding pixels line up vertically across states.
3. **One trailing comment per row** naming the pixel by its **rest-state role** (its position in the `idle` state). The `→` arrow notation flags non-trivial moves in non-idle states; omit when the pixel stays put.
4. **`// oxfmt-ignore` above each exported array** preserves the alignment. If the installed oxfmt version uses different ignore syntax, fall back to an `.oxfmtignore` excluding `**/pixel-icons/**`.

## Layout & Spacing

Hexpunk lays out on a **sparse hex grid** of pointy-top cells with three canonical sizes:

- `hex-cell-sm` (100px) — interactive cells: actions, anchors, utilities, status.
- `hex-cell-md` (180px) — content cells, scroll-list containers.
- `hex-cell-lg` (320px and up) — hero / framing hexes, often partially off-canvas.

A pointy-top hex's bounding box is `width = w` by `height = w · 2/√3`. Axial coordinates `(q, r)` project to pixels as:

- `x = w · (q + r / 2)`
- `y = w · √3 / 2 · r`

Equivalently, in step form:

- a `q`-step shifts the centre by `(w, 0)` — adjacent cells in the same row.
- an `r`-step shifts the centre by `(w / 2, w · √3 / 2)` — adjacent cells along the r-axis (one row down, half a column right).

The implementation expresses this in CSS via inheritable custom properties on the grid container, so **static layout requires no JavaScript** (see § Implementation Notes › Server-side rendering).

**Stroke-overlap correction.** Because hexpunk's hollow-hex stencil draws the stroke as an inset band on the inside of each cell, naïve `w`-spacing would produce a `2 × hex-stroke` thick line at every shared edge between adjacent hexes. The grid therefore uses an **effective cell width** of `w − hex-stroke` for both the q-step and r-step, so adjacent hexes overlap by exactly `hex-stroke` pixels and their stroke bands coincide into a single shared edge. The axial math is unchanged in spirit — the grid's `--hp-col-step` and `--hp-row-step` simply expose the corrected step values to consumers.

Spacing scale is an 8px rhythm (`unit`) with t-shirt steps (`xs` 4 / `sm` 8 / `md` 16 / `lg` 24 / `xl` 40 / `xxl` 64). `gutter` (12px) is the breathing room between hex cells before clip-paths cut in. `margin` (24px) is the default page edge.

### Density modes

Hexpunk ships three density modes — `compact`, `default`, `comfortable` — that scale cell sizes, stroke weight, gutter, and margin proportionally. Density is set via the **`data-hp-density`** attribute on any container and cascades through that subtree via CSS custom property inheritance.

```html
<body data-hp-density="compact">
  <!-- game HUD, dense dashboard -->
  <body>
    <!-- default; attribute optional -->
    <section data-hp-density="comfortable"><!-- hero / presentation --></section>
  </body>
</body>
```

The three modes:

| Token         | compact | default | comfortable |
| ------------- | ------- | ------- | ----------- |
| `hex-cell-sm` | 80px    | 100px   | 120px       |
| `hex-cell-md` | 144px   | 180px   | 216px       |
| `hex-cell-lg` | 256px   | 320px   | 380px       |
| `hex-stroke`  | 6px     | 6px     | 12px        |
| `gutter`      | 8px     | 12px    | 16px        |
| `margin`      | 16px    | 24px    | 32px        |

Everything else stays fixed regardless of density — spacing rhythm (`unit`, `xs`–`xxl`), motion timing, layer scale, accessibility floors (`target-min: 44px`), icon sizes, signature visuals (`edge-trace-*`, `link-arc-pulse-dot`), and interactive sizing (`bond-indicator-size`, `module-handle-size`, `tether-width`). Scaling these would either break the system's signal layer or violate a11y minimums.

**Surface defaults** (consumer-overridable, but these are the canonical pairings):

- Admin → `default`
- Web → `default`
- Game HUD → `compact`
- Hero / presentation / onboarding → `comfortable`

**Nested density.** A descendant `data-hp-density` overrides its ancestor's scope. So an admin app can have a tight sidebar (`data-hp-density="compact"`) inside an otherwise-default body without affecting the main canvas.

**Attribute naming.** `data-hp-density` (not `data-density`) — namespaced so it can't collide with other libraries that handle density.

### The invisible grid

Every Hexpunk surface is overlaid by a viewport-wide **invisible hex coordinate space**. Slots exist whether anything occupies them or not. The grid is the addressable surface; modules live at slot coordinates, not at pixel offsets.

- Coordinates are axial `(q, r)` for pointy-top hexes. Origin `(0, 0)` is the viewport centre by default; a surface can re-anchor it.
- Slot-to-pixel projection uses `hex-cell-sm` as the canonical column step. Surfaces that mix sizes (e.g. an `hex-cell-md` content cell beside `-sm` actions) reserve the larger cell's slot footprint as a multi-cell occupancy mask.
- The grid is **never drawn at rest.** It is invisible visual language — a layout primitive, not decoration.
- The grid **reveals during drag.** When the user picks up a module, the viewport fades in faint `grid-overlay-dot` markers at every slot centre (opacity `grid-reveal-opacity`, 0.18 by default) plus a brighter `grid-overlay-slot` outline around every slot the dragged module _could_ legally occupy. On release the overlay fades out over 180ms.
- The grid also reveals briefly on long-press / hold-shift, so users can audit available real estate without committing to a drag.

### Snap-to-slot drag and drop

- A module declares its **footprint** as a set of relative slot offsets from its origin (e.g. a 5-hex cluster is `[(0,0), (1,-1), (1,0), (0,1), (-1,1)]`).
- During drag the module ghost follows the cursor; the cursor projects to the nearest slot whose footprint is entirely free.
- Snap aggressiveness is governed by `grid-snap-tolerance` (default 0.35 × cell-width). Within tolerance the ghost jumps to the slot; beyond it the ghost free-floats so users can clearly see they're between targets.
- A drop on an illegal target rebounds the module to its previous slot with a 90ms ease-out and a `secondary` flash.
- Moved positions persist when the surface supports user layouts (admin dashboards, game HUDs, node editor). Persistence is per user, per surface.
- Keyboard alternative: `space` to grab, arrow keys step through valid slots in reading order, `space` to drop, `esc` to cancel.

### Molecule bonding

When two atoms (or two modules) are dragged so that their hex edges touch, they **bond** into a molecule. Bonding is the system's primary grouping primitive.

- **Adjacency:** two cells bond when they share a hex edge — for pointy-top axial coords, neighbours of `(q, r)` are `(q±1, r)`, `(q, r±1)`, `(q+1, r-1)`, `(q-1, r+1)`.
- **Bond indicator:** a small `bond-indicator` (12px, `secondary`-coloured hex dot) appears at the midpoint of each shared edge while the bond is forming, then fades to a hairline on the shared edge once settled.
- **Centre handle:** the resulting molecule exposes a `module-handle` at its **centroid** — the geometric centre of all cell coordinates projected to pixels, rendered as a small hex grip (36px bounding box, pointy-top, `surface-container-high` background with a `primary` icon). Grabbing the handle drags the whole molecule as a rigid body; the grid snaps the centroid to the nearest slot whose entire footprint is free.
- **Member dragging still works.** Pulling on an individual atom drags only that atom; if pulled beyond the bond strength threshold (1.2 × cell-width), the bond breaks with a tactile snap-back on the remaining members and a brief `alert`-coloured flash on the broken edge.
- **Transitive bonds:** bonding is associative. Three atoms in a row form one molecule with a single centroid handle, not two separate pairs.
- **Bonds are visual + functional.** They imply the modules are conceptually grouped (e.g. an input + its submit action) and should be moved, persisted, and announced (`aria-owns`) as a unit.

### Sparse layout rules

- Not every slot is occupied. Empty space is the visual language.
- Empty slots are dormant — invisible at rest, revealed during drag (see above). The visible `hex-slot` atom is only used when a surface wants to _advertise_ an available drop target permanently (e.g. an empty inventory slot in a game HUD).
- Never let a dragged module overlap an occupied cell, or hide an input behind a decorative hex.
- **Large framing hexes are allowed to overflow the viewport.** Big `hex-cell-lg` cells partially off-canvas read as architectural framing (compare the screenshot reference: huge half-hex framing the bottom-left, a small cluster in the bottom-right). Framing hexes are _not_ draggable and do not occupy interactive slots.

### When NOT to use hexagons

For dense data, prose, and forms longer than a single screen, drop into rectangular `content-card` layouts with hex anchors at the corners. Use hexagons for:

- navigation, dashboards, login screens, command panels
- HUD panels, ability buttons, status meters, inventory slots
- hero interactions, feature clusters, CTA groups

Use conventional rectangles for:

- long forms, tables, legal text, complex data grids, multi-paragraph copy

A page should feel hex-led but not hex-tortured.

## Elevation & Depth

Hexpunk's depth is line-based, not shadow-based.

- **Stroke weight** is the primary depth signal. Standard hex stroke is 6px at `hex-cell-sm`, scaling proportionally at larger sizes (~6% of width is a reliable ratio). Background framing hexes can drop to 2–4px stroke in `outline-faint`.
- **Opacity** is secondary. Idle action hexes sit at 0.75 opacity; hover / focus brings them to 1.0 and lifts `z-index` to 10.
- **Surface ramp** is the tertiary depth tool, reserved for raised content cards and the rare filled hex.
- **Glow** is optional, used sparingly: an outer drop shadow tinted `primary` or `secondary` at 8–14% opacity, blur 12–24px. Apply only on hovered/selected interactive hexes — never as ambient atmosphere.
- **Inner shadows are forbidden.** Hexpunk is etched, not embossed.

Stacking order, expressed via the `layers:` tokens: page background (`layer-base`) → framing support hexes (`layer-support`) → content/anchor/action hexes at rest (`layer-default`) → hovered or focused hexes (`layer-hover`) → arc-links (`layer-arc`) → edge traces and glows (`layer-trace`) → drag-reveal overlay (`layer-overlay`) → a module being dragged (`layer-dragging`) → toasts that don't use native Top Layer (`layer-toast`) → focus rings (`layer-focus-ring`).

Modal dialogs (`<hp-dialog>`) and popovers sit in the browser's Top Layer, above z-index entirely. The `layers:` scale only governs in-flow stacking.

## Shapes

The system is geometrically opinionated. Pointy-top hexes everywhere a cell can live, minimal radius, no pills.

### Hex geometry

- **Pointy-top clip-path (square bounding box):**

  ```css
  clip-path: polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%);
  ```

- **Pointy-top clip-path (aspect-ratio container `width × width·2/√3`):**

  ```css
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  ```

Choose one orientation per template. Hexpunk defaults to pointy-top everywhere.

### The hollow-hex treatment

The signature visual is a **hollow outlined hex**: an outer element clip-pathed with the polygon and filled with stroke colour, then an inner pseudo-element (`::before`) inset by the stroke width on every side, also clip-pathed and filled with the canvas colour. The result reads as a stencil cut from the canvas with a glowing edge.

```css
.hp-hex {
  --hp-stroke: 6px;
  position: relative;
  width: var(--hp-cell);
  aspect-ratio: 1 / 1;
  background: var(--hp-stroke-color, var(--hp-primary));
  clip-path: var(--hp-hex-clip);
  transition:
    background 280ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 280ms;
  opacity: 0.75;
}

.hp-hex::before {
  content: "";
  position: absolute;
  inset: var(--hp-stroke);
  background: var(--hp-canvas, var(--hp-background));
  clip-path: var(--hp-hex-clip);
}

.hp-hex:hover,
.hp-hex:focus-visible,
.hp-hex[aria-pressed="true"] {
  background: var(--hp-stroke-hover, var(--hp-secondary));
  opacity: 1;
  z-index: var(--hp-layer-hover);
}
```

- **Stroke weight:** 6px at `hex-cell-sm` (100px). Scale proportionally for larger cells (rule of thumb: ~6% of width). Framing background hexes may use 2–4px in `outline-faint`.
- **Stroke colour idle:** `outline` (blue, equal to `primary`).
- **Stroke colour engaged:** `secondary` (green) on hover / focus / active.
- **Interior:** matches the canvas (`background`). This is what makes hexes read as windows cut in the same material.
- **Filled hexes** (`hex-action-filled`, `hex-status-*-active`) skip the `::before` inset and fill the whole polygon. Use sparingly — they break the wireframe rhythm.

### Other shapes

- **Content cards:** rectangles with `rounded.sm` (2px). Never round more than 2px — the system reads as cut, not soft.
- **Hairlines:** 1px `outline-variant` between sections.
- **Pill / circle:** `rounded.full` (9999px) only for circular avatars or single-character tokens where a hex would be illegible.

## Components

Classified atomically — atom / molecule / organism / template — but expressed as flat tokens in `components:` because the schema does not nest. Naming: `<role>-<variant>` (`hex-action`, `hex-action-hover`). All components ship as `hp-*` Lit web components.

### Atoms — single hex cells

The hex catalogue is exposed as three `variant`-driven elements (plus the primitive `<hp-hex>` and the special `<hp-module-handle>`). Tokens still use the role-named keys below (`hex-action-hover`, `hex-status-warn-active`, etc.) for tokens.dark.css / token discovery, but consumers pick atoms via the `variant` attribute.

- `<hp-hex>` — the primitive. SVG stencil, `size="sm|md|lg"`, customised via `--hp-stroke-color` / `--hp-hex-fill`. Composed inside every other hex atom; rarely instantiated directly except for palette swatches.
- `<hp-cell variant="anchor|action|secondary|utility">` — interactive labelled hex. Cursor pointer, hue-swaps to `secondary` on hover / focus-visible / `aria-pressed`. `filled` boolean (action only) for the high-emphasis CTA variant.
  - `variant="anchor"` (`hex-anchor`) — identity / grip / section marker. Drag handles live here. Idle blue stroke + on-surface label, hover green.
  - `variant="action"` (`hex-action`) — primary action. Pairs with `-hover` and `-focus`. Hollow by default; the `filled` attribute toggles the high-emphasis CTA (filled primary, on-primary label).
  - `variant="secondary"` (`hex-secondary`) — calmer alternates (cancel, alternate path) in sky-blue.
  - `variant="utility"` (`hex-utility`) — small support actions (settings, close, edit, expand, filter, recover). Uses `label-sm` typography.
- `<hp-deco variant="content|support|slot">` — presentational hex. No hover state.
  - `variant="content"` (`hex-content`) — a single cell containing a value, icon, or short label. `body-sm` typography. Default size `md`.
  - `variant="support"` (`hex-support`) — structural / decorative framing hex. Must not look interactive. `outline-faint` stroke at 0.6 opacity. Often `hex-cell-lg` and partially off-canvas. Auto `aria-hidden`.
  - `variant="slot"` (`hex-slot`) — empty available position, only shown when the surface advertises a permanent drop target. Soft `outline-variant` stroke with transparent interior. Auto `aria-hidden`.
- `<hp-status tone="positive|warn|alert|error">` — semantic indicator. Stroke colour matches semantic; `active` boolean fills the hex with the tone-container colour.
- `link-node` (`<hp-link-node>`) — the small dot at a hex anchor where arcs originate or terminate. Promotes to `link-node-bonded` once at least one arc is attached.
- `bond-indicator` (`<hp-bond>`) — the small green marker on the shared edge of two bonded atoms.
- `module-handle` (`<hp-module-handle>`) — hex grip at a molecule's centroid; grabs the whole molecule.
- `grid-overlay-dot` / `grid-overlay-slot` — the faint markers revealed during drag; not directly authored, rendered by `<hp-grid>`.
- `link-arc` (`<hp-link>`) — the curved bezier connector between two `link-node` dots. Variants: `-idle`, `-hover`, `-active`. Pulsing dot travels along the arc to show liveness.
- `unfold-source` / `unfold-child` / `unfold-tether` / `unfold-overlay` — the pieces of the unfold pattern. Authored via the `<hp-unfoldable>` wrapper; consumers rarely instantiate them directly.

**Form atoms** (form-associated by default; see § Implementation Notes › Form association):

- `hex-checkbox` (`<hp-checkbox>`) — small hex (`hex-cell-xs`). Hollow at rest; filled with `primary` when checked. The `formless` attribute opts out of form participation for CSS-only state-flip patterns.
- `hex-radio` (`<hp-radio>`) — same visual as checkbox. Single-selection within an `<hp-radio-group>` enforced via roving tabindex; the group bonds the radios into a molecule.
- `hex-switch` (`<hp-switch>`) — bonded hex pair. The "on" hex fills with `primary`; toggling slides the fill between them (Snapping motion). On-brand because it physically demonstrates the bonding primitive.
- `textarea-field` (`<hp-textarea>`) — rectangular content card with body typography. Same flanking-hex molecule pattern as `<hp-input>`. Resizable vertically.
- `select-trigger` / `select-popover` (`<hp-select>`) — `hex-action`-shaped trigger opening a rectangular popover that contains a `<hp-scroll-list>` of options. Docking motion on open/close.
- `slider-track` / `slider-thumb` (`<hp-slider>`) — rectangular hairline track plus a small hex thumb (`hex-cell-xs`). Thumb snaps to ticks; focus draws a pulsing edge-trace. Optional value label as a floating `hex-content` above the thumb.

**Form-atom shape rationale — hex vs rect.** Checkboxes, radios, and switches are _signal-shaped_ atoms (toggle states, group selection) — they get the hex treatment. Inputs and textareas are _content-shaped_ (variable-length text, caret/selection inside the shape) — they stay rectangular because caret/selection breaks inside non-rectangular clip-paths. Selects split the difference: hex trigger + rectangular popover. Sliders are hybrid: rectangular track plus a hex thumb so the interactive grip reads as a Hexpunk cell.

**Overlay atoms** (rectangular by necessity; built on native browser overlay APIs):

- `dialog` (`<hp-dialog>`) — modal or non-modal dialog wrapping native `<dialog>`. Top Layer + backdrop handled natively; no z-index management needed. **Docking** motion on open/close; focus trap automatic for modals via the native element. `esc` closes natively. Optional `<hp-cell variant="utility">` close button in the corner.
- `tooltip` (`<hp-tooltip>`) — hover/focus info via the Popover API (`popover="hint"`). Triggered by `mouseenter` / `focusin`; dismissed on `mouseleave` / `focusout` — never steals focus. **Opacity + small scale** (0.95 → 1.0) over `duration-fast`. Lighter than Docking because tooltips appear frequently.
- `popover` (`<hp-popover>`) — generic anchored floating panel via the Popover API (`popover="auto"`). Variable size. **Docking** motion over `duration-medium`. Anchored via CSS Anchor Positioning where supported (Chromium 125+), small ~30-line JS-positioning fallback for Firefox/Safari. Used internally by `<hp-select>` and `<hp-combobox>` for their option lists.
- `toast` (`<hp-toast>`) / `<hp-toast-stack>` — transient notifications using `toast-inverse` styling. Docks in from the viewport edge; auto-dismisses after a configurable duration (default 5s, paused on hover/focus). `<hp-toast-stack>` container caps visible toasts at 3 and queues additional toasts automatically.

**Overlay shape rationale.** Dialogs, tooltips, popovers, and toasts are all rectangular: they hold variable-length content where caret / selection / scroll behaviour inside non-rectangular clip-paths breaks. They use Top Layer / Popover API for proper stacking — modal stacking is the browser's job, not the design system's. Hexpunk never fights z-index where a native API does the work correctly.

**Loading atoms:**

- `skeleton-hex` / `skeleton-rect` (`<hp-skeleton shape="hex|rect">`) — placeholder for loading content. Hex variant matches the cell it replaces (hollow with `outline-faint` stroke); rect variant covers content-card prose with optional `lines` attribute for prose-shimmer. **Scanning** motion: a thin `secondary`-tinted line sweeps across the placeholder over ~1.5s. Reduced-motion fallback is a static `outline-faint` line.
- `spinner` (`<hp-spinner>`) — indeterminate progress. Hex with one edge highlighted in `primary`, advancing one edge-position per `duration-medium`. Six edges → ~1.68s per full rotation. Repeated **Charging** metaphor. `size` attr: `sm` / `md` / `lg`; `inline` variant fits inside an `<hp-cell variant="action">` for button loading.
- `progress-track` / `progress-fill` (`<hp-progress>`) — determinate or indeterminate progress bar. Linear hairline (2px), `outline-faint` track + `primary` fill. `value` 0–1 for determinate. `indeterminate` boolean → fill becomes a Scanning sweep with no terminus.

**Loading-state rules.** Don't show multiple spinners simultaneously — pick one to represent the overall load. Don't use `<hp-spinner>` for determinate operations — use `<hp-progress>` with the actual value. Don't flash skeletons under ~200ms — debounce so skeletons only appear when the wait is perceptible.

**Empty-state atom:**

- `empty-state-hex` / `empty-state-label` / `empty-state-icon` (`<hp-empty>`) — canonical "nothing here yet" composition. Faint ghost-hex outline (`outline-faint` stroke, 2–4px — much thinner than normal cells) with three optional pieces:
  - **Icon slot** (`slot="icon"`) — centered inside the ghost hex. Accepts `<hp-icon>` (stroke) or `<hp-pixel>` (pixel art); sized via `empty-state-icon` token.
  - **Label slot or `label` attribute** — `label-md` text rendered below the hex.
  - **Default slot** — for an optional `<hp-cell variant="action">` CTA below the label.
  - At least one of icon or label must be present; silence reads as broken.

  Sizes: `size="md"` (panels, filtered lists) or `size="lg"` (full-canvas / new-user empties). Slow **Scanning** sweep across the ghost over `~3s` signals "ready to be filled"; reduced-motion fallback is a static `outline-faint` line.

  Available as both **component** (`<hp-empty>` — canonical use, locks the pattern) and **pattern** (the same composition can be assembled from `<hp-deco variant="support">` + atoms when embedding in a custom layout). Prefer the component unless the layout genuinely doesn't fit.

**Empty-state rules.** No alarm colours on empty states — empty is a normal app state, not a failure. Always include a label or an icon (or both). One canonical CTA, not three competing.

**Table atom:**

- `table` / `table-header` / `table-row` (`<hp-table>`) — lightweight wrapper around a native `<table>` projected through the default slot, styled by Hexpunk and behaviour-enriched. Hairline `outline-variant` rules between rows, `label-md` uppercase headers, `mono-sm` for `class="numeric"` cells, hover row highlight via `table-row-hover`, density-aware row padding. Sticky header is enabled by `sticky-header` attribute (CSS-only, no JS).

  **Built-in behaviour (opt-out where applicable):**
  - **Click-to-sort.** Clicking a `<th>` toggles its `data-sort` through `unsorted` → `asc` → `desc`. Hexpunk renders the sort glyph and reorders rows by cell text content. Numeric columns (`class="numeric"`) sort numerically. Disable per-column with `data-no-sort`; disable globally with the `manual-sort` attribute on `<hp-table>` (consumer takes over sorting).
  - **Row reorder.** Adding `reorderable` to `<hp-table>` injects an `<hp-cell variant="anchor">` grip at the start of each row and wires drag-reorder. The element emits `reorder` events with `{from, to, ids}` detail; consumer persists the new order.
  - **Loading state.** Adding `loading` swaps `<tbody>` for a stack of `<hp-skeleton shape="rect">` rows (count via `loading-rows`, default `5`). Header stays visible.
  - **Empty state.** When `<tbody>` has no rows and `loading` is not set, `<hp-table>` projects its `slot="empty"` content. Consumers slot an `<hp-empty>` to provide the canonical empty composition.

  ```html
  <hp-table sticky-header reorderable>
    <thead>
      <tr>
        <th>NAME</th>
        <th data-sort="asc">STATUS</th>
        <th class="numeric">DUE</th>
        <th data-no-sort>ACTIONS</th>
      </tr>
    </thead>
    <tbody>
      <tr data-id="q-1">
        <td>Refactor auth</td>
        <td><hp-status tone="warn">PENDING</hp-status></td>
        <td class="numeric">2026-06-01</td>
        <td><hp-cell variant="utility">edit</hp-cell></td>
      </tr>
      <!-- ... -->
    </tbody>
    <hp-empty slot="empty" label="NO QUESTS YET">
      <hp-cell variant="action">ADD QUEST</hp-cell>
    </hp-empty>
  </hp-table>
  ```

**Table scope.** `<hp-table>` is a styled, mildly-interactive table — not a data grid. For virtualisation, server-side sort/filter, column resizing, or thousand-row datasets, reach for a real table library (TanStack Table, AG Grid) and apply Hexpunk classes / tokens on the rendered output.

**Navigation atoms** (in addition to `<hp-cluster>` and `<hp-cell variant="anchor">` nav rails):

- `tabs` / `tab` / `tab-active` (`<hp-tabs>`) — bonded molecule of N hex actions; exactly one is `active`. Switching slides the fill from the old tab to the new (**Snapping** motion, same metaphor as `<hp-switch>` extended to N). ARIA: `role="tablist"` on the host, `role="tab"` per segment, paired `role="tabpanel"` panels via `aria-controls`. Used for view toggles, filter tabs, content-pane switching.
- `breadcrumbs` / `breadcrumb-segment` / `breadcrumb-segment-current` (`<hp-breadcrumbs>`) — chain of small `<hp-cell variant="anchor">` hexes (`hex-cell-xs`) connected by hairline tether lines. Each segment is a back-link; the last is the current page (filled, non-interactive). This is the unfold tether-chain pattern lifted to route scale. ARIA: `aria-label="breadcrumb"` + ordered-list semantics.
- `pagination` / `page-segment` / `page-segment-current` (`<hp-pagination>`) — bonded molecule of `<hp-cell variant="utility">` prev/next arrows flanking a row of small numbered segments (`hex-cell-xs`), one filled to show the current page. Same vocabulary as tabs, scoped to pages. Used for image galleries, search results, simple lists. Complex pagination (jump-to-page, page-size selector, server-side ranges) stays a consumer concern.

**Navigation rules.** Don't use `<hp-tabs>` for more than ~5-7 items — drop to a vertical hex nav rail. Don't nest breadcrumbs past 4 levels (same rationale as `unfold-depth-max: 3` — the chain becomes navigationally hostile). Don't paginate fewer than ~10 items (show them all instead).

- `skip-link` (`<hp-skip-link>`) — "skip to main content" accessibility primitive. Visually hidden until focused; on `:focus-visible`, Docks in from the top of the viewport. Activating jumps to and focuses the target element (by `id`). One per page, at the top of the keyboard-tab order.
- `keymap-dialog` / `keymap-section` / `keymap-binding` / `keymap-key` (`<hp-keymap>`) — discoverable keymap viewer. Opens as an `<hp-dialog>` on `?` (when present in the page) and lists every registered app-level binding, grouped by section. Each binding renders its keys as styled keycap-like chips (`keymap-key` token, mono-sm). Pairs with `hpBindKey()` helper (see § Implementation Notes › Keyboard shortcuts) so the dialog always reflects the live set.

### Molecules — small linked clusters

- **Input molecule:** an `input-field` content card flanked by a `hex-anchor` (label / grip) and a `hex-utility` (clear / submit).
- **Search molecule:** anchor + extended `input-field` + action.
- **Action group:** an `hex-action` plus 1–2 `hex-utility` cells in adjacent slots.
- **Scroll-list molecule (`<hp-scroll-list>`):** a `hex-cell-md` or `hex-cell-lg` container with a vertical list inside, masked with `linear-gradient(transparent 0%, black 40%, black 60%, transparent 100%)`. Three item tiers (`scroll-list-item`, `-sibling`, `-selected`) encode neighbourhood with type size and opacity. Items animate between tiers as the user scrolls or keys through; the selected item snaps to the vertical centre with a 150ms ease. Wheel and arrow keys both work; click selects and centres.

### Organisms — multi-atom compositions

- **Cluster (`<hp-cluster>`):** five small hexes arranged top / middle-left / middle-right / bottom plus a centre — the canonical "navigation rosette" from the pen.
- **Login organism:** email molecule + password molecule + `hex-content` (remember) + `hex-action` (enter).
- **Dashboard cluster:** anchor + 4–6 content hexes + 2 utility hexes in a sparse cluster.
- **HUD strip:** anchor + status hexes + action hexes laid horizontally with half-cell vertical offset between alternating cells.

### Templates — full screens

- **Login screen** — single centred organism, sparse outer slots, animated edge trace on focus.
- **Admin dashboard** — hex nav rail (anchors + utilities) + rectangular content area with hex anchors at section corners. Optional `<hp-grid>` enabled for drag-rearrangeable widgets.
- **Game HUD** — hex clusters at all four corners; centre reserved for the play surface. Huge framing `hex-support` cells off-canvas.
- **Node editor (`<hp-node-editor>`)** — full-canvas graph editor. Invisible grid, draggable molecule nodes, arc-link edges with pulse, side cluster of `hex-utility` controls for arc colour / width / glow / density / pulse-speed. The flagship demonstration of all three Hexpunk spatial primitives at once (grid + bonding + linking).

### Component property notes

The schema's component allowlist is 8 properties (`backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`). Hexpunk's stroke weight, edge trace, glow, and clip-path are not expressible there — they live in this prose, in CSS custom properties (`--hp-stroke`, `--hp-stroke-color`, `--hp-trace-color`, `--hp-cell-clip`, `--hp-canvas`), and in the Lit element implementations.

### Suggested CSS class / element prefixes

```
hp-              base prefix (CSS class and custom-element)
hp-hex           generic hex cell
hp-anchor        anchor hex
hp-action        primary action hex
hp-secondary     secondary action hex
hp-utility       utility hex
hp-content       content cell or card
hp-support       structural / framing hex
hp-slot          available sparse slot
hp-status        status hex (with --hp-status-tone CSS variable)
hp-cluster       canonical 5-hex rosette
hp-module        draggable component group
hp-scroll-list   scrolling list inside a hex
hp-trace         edge-trace overlay
hp-focus         focus-ring overlay
```

## Motion

**Every motion in Hexpunk communicates.** Animation is a signal layer, not a decoration layer — each transition confirms an action, shows where data flows, or indicates where the user just was. Motion that doesn't signal something specific is forbidden.

The idle state is still. Hexpunk has no ambient drift, no decorative bouncing, no pulse-just-because. The single ambient motion permitted is the arc pulse along **live** `<hp-link>` arcs — and that pulse is itself a signal ("this connection is alive"). When the arc goes idle, the pulse stops.

The system speaks in six motion metaphors. Together they are the entire animation vocabulary; anything outside them is noise.

- **Routing** — the signature edge trace. Signals _"a signal entered this cell and completed a circuit."_ Reserved for high-emphasis actions where the routing metaphor matters (login submit, deploy, primary CTA).
- **Locking** — focus rings snap in with a 1px contraction. Signals _"this element is now active or focused."_
- **Scanning** — long horizontal sweeps. Signals _"loading"_ or _"hero attention."_ Reserved for hero and loading states only.
- **Snapping** — dragged components arrive on slot with a 90ms ease-out; scroll-list items snap-centre at 150ms. Signals _"drop position confirmed."_
- **Charging** — fills sweep along a hex edge for held actions. Signals _"hold-to-confirm progress."_
- **Docking** — panels slide along a 30deg axis when entering or leaving. Signals _"context entering or leaving."_ This is also the canonical Hexpunk page-transition (see § Implementation Notes › Navigation).

Motion that doesn't fit one of these six is removed, not promoted to a seventh. The vocabulary stays small on purpose.

Durations: `duration-fast` (`150ms`), `duration-medium` (`280ms`), `duration-slow` (`400ms`). Easing: `ease-default` (`cubic-bezier(0.2, 0.8, 0.2, 1)`). All non-essential motion respects `prefers-reduced-motion: reduce` — disable trace animation, leave instant state changes.

### Base hover — hue swap

Every interactive hex's base hover behaviour is a **stroke colour transition from blue (`primary`) to green (`secondary`)** over 280ms, plus opacity 0.75 → 1.0 and `z-index` lift. This is the system's resting interaction, inherited from the original Hexpunk reference.

### Signature elaboration — edge trace on alternating sides

For high-emphasis action hexes (login submit, deploy, primary CTA), layer an **external edge trace** on top of the hue swap. A 2px line grows along three of the hex's six edges in sequence — edges **1**, **3**, **5** counting clockwise from top — separated by a 2px visual gap from the cell border.

- The trace lives **outside** the cell's clip-path (use an SVG overlay or a wrapper element). Never inside the clip — it gets cut off.
- Stroke colour: `secondary` on engagement; `primary-bright` for focus-vs-hover differentiation.
- Each segment animates over 120ms; the three segments stagger so the total reveal is ~280ms.
- The trace draws on hover / focus, holds while engaged, and unwinds in reverse on exit (180ms).
- On touch, the trace draws on press-and-hold; tap actions complete before the full reveal.

The effect reads as a signal entering the cell, completing a circuit, then settling. It is the most important visual behaviour in the system, and the reason Hexpunk doesn't feel like a website.

## Linking & Node Editor

Hexpunk's third spatial primitive — after the **invisible grid** and **molecule bonding** — is the **arc link**. Arcs are curved, glowing lines that connect distant hex anchors across the canvas. They are how a designer expresses _relationship at a distance_ without dragging cells edge-to-edge.

### Arc link visual

The arc is a cubic-bezier curve drawn in SVG, layered over the hex canvas. It is inspired by network-globe visualizations (think flight-path overlays) and uses the same teal/green family that signals engagement everywhere else in Hexpunk.

- **Stroke colour:** `secondary` (`green-500`, `#00CC88`) at full opacity for active links, `secondary-container` (`green-800`) for idle / inactive links. Hover brightens to `secondary` plus a glow lift.
- **Stroke width:** `link-arc-width` (1.2px default). Adjustable per-density: tighter graphs may drop to 0.6px, hero connections may raise to 2px.
- **Glow:** outer SVG filter `feGaussianBlur` of `link-arc-glow` (13px default) on a duplicated stroke, opacity 25–40%. Always tinted with the stroke colour, never neutral.
- **Endpoint dots:** a small filled circle (`link-node`, `spacing.xs` = 4px) at the geometric centre of each connected hex's edge or anchor point. Idle dots are `primary`-coloured; once an arc connects, the dot promotes to `link-node-bonded` (`secondary` filled).
- **Path shape:** cubic bezier with control points pulled toward the midpoint above the chord. Bulge magnitude is proportional to chord length — short links are nearly straight, long links arc gracefully. For curved screens or globes, the path projects onto the sphere; for flat canvases it's a 2D bezier.
- **Direction (optional):** a small arrowhead at the target end indicates directed graphs. Omit for undirected.

### Arc pulse — the signal-on-the-wire

A small `link-arc-pulse-dot` (4px circle) travels along the arc from source to target with `pulse-period` (3.4s) by default (matching the Claude design demo's `Pulse speed`). The dot uses `primary-bright` (`cyan-400`) for high contrast against the green stroke, and fades in over the first 10% of the path and out over the last 10%.

- Pulses run **continuously** on active arcs to show "data is flowing" / "this connection is live."
- Pulses **stop** on inactive arcs; the arc remains drawn but quiet.
- Pulses **accelerate** briefly (period → 1.2s) when the source or target hex is hovered, to confirm which arcs belong to that node.
- All pulses respect `prefers-reduced-motion: reduce` — the dot becomes a static halo at the midpoint instead.

The pulse is the _only_ ambient motion Hexpunk allows. Everything else stays still until touched.

### Adjustable arc properties

Following the Claude design demo's pattern, arcs expose first-class adjustables when the surface is a node editor:

- `arc-colour` (defaults to `secondary`; a surface may pick from any palette)
- `arc-width` (0.6–2px)
- `arc-glow` (0–24px)
- `arc-density` (visibility fraction; 100% shows every arc, lower hides faint connections)
- `pulse-speed` (1–8s period)
- `show-arcs` / `show-nodes` toggles

These render as small `hex-utility` controls in the editor's settings cluster.

### Node editor pattern

Combine the three primitives — invisible grid, molecule bonding, arc links — and you get a Hexpunk **node editor**: a canvas-style screen where users arrange hex molecules in space and connect them with arcs.

- **Nodes** are hex **molecules** (single hex or bonded group), placed on the invisible grid.
- **Edges** are **arc links** between any two nodes' anchor points (a hex can expose multiple anchor points, one per side).
- **Bonding vs linking:** bonds are _physical_ (cells touch, share an edge), links are _remote_ (cells are apart, arc draws between them). Use bonding for tightly-coupled UI groups; use linking for graph relationships.
- **Creating an arc:** click-and-drag from one hex's `link-node` dot to another. A live preview arc tracks the cursor. Releasing on a valid target node completes the link with a 280ms arc-draw animation (the curve traces from source to target).
- **Deleting an arc:** click the arc to select (it brightens and pulses faster), then press `delete` / `backspace`. Or drag either endpoint off the target node — the arc unwinds in reverse.
- **Highlighting:** hovering a node fades all other arcs to 30% opacity and accelerates the pulse on its own arcs. This is how a user explores a graph.
- **Layout:** moving a node animates connected arcs in real time. Bezier control points are recomputed every frame so the curves stay graceful. Modules with many connections feel "spring-loaded."

The node editor is its own template (`<hp-node-editor>`) but the primitives compose anywhere — admin dashboards can render a small relationship graph in a sidebar, game HUDs can use arcs for ability dependencies (skill trees), web onboarding can use arcs to visualize "step A leads to step B."

### Use cases

- **Admin:** data pipelines, workflow editors, permission graphs, infrastructure topologies.
- **Web:** product comparison graphs, onboarding sequences, "how it works" diagrams.
- **Game:** skill trees, crafting recipes, ability dependency graphs, dialogue branch maps, faction relationship maps.

## Unfold & Drilldown

Hexpunk's fourth spatial primitive — after grid, bonding, and linking — is the **unfold**. It is how a small hex expands into a detailed inner organism without leaving the surface, in the spirit of the holographic JARVIS / Iron Man HUD where any element can blow up into its inner components in place.

The unfold is not a new visual language — it composes the existing three primitives. The hex grows, an arc tether links it to its origin slot (continuity), and inner children materialize one by one with edge traces (routing). Pieces come _from_ the source and return _to_ it. This preserves the user's mental map of "where am I, where did this come from."

### Three flavours

1. **In-place unfold (default).** The source hex stays where it is. It grows from `hex-cell-sm` to `hex-cell-md`, claiming a wider footprint on the grid. Adjacent slots dim to `unfold-overlay-opacity` (0.6) and a molecule of `unfold-child` hexes blooms outward from the source into the now-cleared neighbourhood. Edge traces draw on each child as it arrives. Best for dashboards, list rows, admin panels where context should stay readable.

2. **Spotlight unfold.** The source hex flies out of its container to the viewport centre and grows to `hex-cell-lg`. Behind it, an `unfold-overlay` covers the surface (60% opacity `surface-container-lowest`). Children materialize around the spotlight. A tether arc draws back to the source's original slot — closing animates the children flying back along the tether before the hex recedes. Best for scroll-list items where "navigating to" a specific entry should blow it up into detail without losing the list.

3. **Camera-zoom unfold.** The viewport itself reframes onto the source: the source hex grows to fill the canvas (400ms ease-out) while parent context scales down off-edge. Children appear at the new zoom level. The most Iron-Man-feeling mode — use sparingly because it interrupts task flow. Best for game UIs (entering a character sheet, opening a map, focusing on a node).

### Tether arc

A hairline (`tether-width`, 1px) `secondary-container`-coloured arc, drawn from the expanded hex's edge to its origin slot using the same SVG bezier primitive as `<hp-link>`. The tether:

- is always visible while unfolded
- pulses subtly when the user hovers the close button or presses `esc`, signalling "click here to return"
- on close, animates the children flying back along its curve before contracting
- becomes the breadcrumb for **stacked unfolds** — a child inside an unfolded host can itself be unfolded, drawing a new tether back to its parent. The chain of visible tethers is the navigation trail. Max recommended depth `unfold-depth-max` (3) — beyond that the user is lost.

### Choreography

1. **Trigger** (0ms): source hex begins growing — `unfold-trigger` (90ms ease-out) to first stage.
2. **Dim** (0–180ms): surrounding context fades to `unfold-overlay-opacity` over `unfold-overlay-fade` (180ms). Non-relevant arcs drop to 30%.
3. **Tether** (90–210ms): tether arc draws from source to origin slot over `unfold-tether-draw` (120ms).
4. **Bloom** (180–460ms): child hexes materialize one by one, each with a 90ms edge trace, staggered by `unfold-stagger` (60ms). For a six-child molecule the total `unfold-bloom` is ~280ms.
5. **Live** (~460ms): source hex completes its blue → green hue swap, signalling the unfold is engaged.

**Reverse (close):**

1. Hue swap back to blue (90ms).
2. Children recede in reverse stagger order along the tether (~`unfold-bloom`, 280ms).
3. Tether unwinds (`unfold-tether-draw`, 120ms).
4. Source hex contracts to original size (`unfold-trigger`, 90ms).
5. Context fades back in (`unfold-overlay-fade`, 180ms).

Total close time `unfold-close` (~360ms). All motion respects `prefers-reduced-motion` — children appear / disappear instantly, tether is static, hue swap remains.

### Triggers

- **Click / tap** an `unfoldable` hex → in-place unfold
- **Enter** on focused unfoldable hex → in-place unfold
- **Double-click** → spotlight unfold
- **Long-press / shift-click** → camera-zoom unfold
- A dedicated `<hp-cell variant="utility">` with `expand` icon next to a non-default unfoldable
- **`esc`** collapses one level. **`shift+esc`** collapses to root.

### Authoring

A hex declares its detail content by slotting children into an `<hp-unfoldable>` wrapper:

```html
<hp-unfoldable mode="in-place">
  <hp-cell variant="anchor" slot="source">PIPELINE</hp-cell>
  <hp-deco variant="content">STAGE 1 — ingest</hp-deco>
  <hp-deco variant="content">STAGE 2 — transform</hp-deco>
  <hp-deco variant="content">STAGE 3 — emit</hp-deco>
  <hp-status tone="positive">ONLINE</hp-status>
</hp-unfoldable>
```

The `source` slot is what's visible at rest. The remaining children are the molecule that blooms on unfold. `<hp-unfoldable>` owns the trigger / animation / tether wiring; consumers just provide content.

### Patterns

- **List → detail.** A scroll-list inside a hex; selecting an item unfolds the host hex (spotlight mode), revealing the item's properties as a child molecule. Closing returns to the list with the same item still highlighted.
- **Dashboard widget → deep dive.** A small metric hex unfolds in-place to show its history, related metrics, and configuration utility hexes. Surrounding widgets dim, never disappear.
- **Game inventory slot → item card.** Camera-zoom unfold from an inventory hex to a full item card with stats, lore, action utilities. `esc` returns to the inventory grid.
- **Node editor node → inner subgraph.** An `<hp-module>` unfolds (camera-zoom) into its own sub-graph editor. Tether back to the parent canvas is the "exit" path.

### Use cases

- **Admin:** drill into a pipeline stage, a permission rule, a deploy step.
- **Web:** "show more" on product cards / feature tiles / pricing slots that bloom into detail in place.
- **Game:** character sheets, skill node details, inventory item cards, dialogue branch detail.

## Themes

Hexpunk has two first-class themes. The native dark theme is encoded in the YAML frontmatter. The light theme is **not** an inversion — it preserves geometry, interaction grammar, and proportions, but recasts the palette as daylight technical UI.

### Dark — "tactical glass"

Defined in the frontmatter. Feels like illuminated circuitry over warm dark glass. Blue idle, green engaged. Strokes do the work; the surface ramp is barely visible most of the time.

### Light — "blueprint"

Parallel role mapping, calmer accents, stronger structural strokes. Suggested values:

| Role                     | Light     |
| ------------------------ | --------- |
| `primary`                | `#006F9E` |
| `on-primary`             | `#FFFFFF` |
| `primary-container`      | `#C7ECFF` |
| `on-primary-container`   | `#001F2D` |
| `primary-bright`         | `#0091CC` |
| `secondary`              | `#007A4D` |
| `on-secondary`           | `#FFFFFF` |
| `secondary-container`    | `#9CE9C5` |
| `on-secondary-container` | `#00301E` |
| `tertiary`               | `#245CA8` |
| `warn`                   | `#B46200` |
| `alert`                  | `#A9005F` |
| `error`                  | `#B3261E` |
| `background`             | `#F2F4F2` |
| `surface`                | `#FFFFFF` |
| `surface-container`      | `#F6FAFC` |
| `surface-container-high` | `#E6F1F8` |
| `on-surface`             | `#0B151C` |
| `on-surface-variant`     | `#475E67` |
| `outline`                | `#006F9E` |
| `outline-variant`        | `#B7D5E0` |
| `outline-faint`          | `#DCE6EC` |
| `focus-ring`             | `#001F2D` |

To ship light, copy this DESIGN.md, substitute the table above into the YAML, and run `npx @google/design.md diff` to keep parity with dark.

## Accessibility

Targets **WCAG 2.2 AA**, with **AAA** where practical.

- Body text contrast ≥ 4.5:1. Large text ≥ 3:1. Non-text UI ≥ 3:1.
- Colour is never the only state indicator. The hue swap (blue → green) is paired with opacity, stroke colour, edge trace, and `z-index` lift. Status hexes pair colour with icon and label.
- Practical target size ≥ 44px. `hex-cell-sm` is 100px so this is automatic, but molecules with sub-cell hit areas (e.g. utility hex on a small input) must extend their touch target.
- Focus states use the `focus-ring` colour plus the edge trace or a 2px outer outline. Focus must be visible against any surface in the ramp.
- All non-essential motion respects `prefers-reduced-motion: reduce`.
- Keyboard navigation order follows visual reading order on a sparse hex grid: left-to-right within a row, top-to-bottom between rows, with explicit `tabindex` on draggable modules.
- Drag-and-drop must have a keyboard alternative (`space` to grab, arrow keys to step between slots, `space` to drop, `esc` to cancel).
- Scroll-list molecules are operable by mouse wheel, click, arrow keys, and `home` / `end`. Selection is announced via `aria-activedescendant`.

### Focus management

Hexpunk's focus discipline is system-level — every `<hp-*>` follows these rules so keyboard navigation is consistent across every consumer surface.

1. **Roving tabindex on composite widgets.** Cluster-shaped components take **one** tab stop; arrow keys navigate within. The active member has `tabindex="0"`, others `tabindex="-1"`. Applies to `<hp-cluster>`, `<hp-tabs>`, `<hp-radio-group>`, `<hp-pagination>`, `<hp-breadcrumbs>`, and `<hp-grid>` (when modules are interactive).
2. **Focus restoration on close.** Opening components (`<hp-dialog>`, `<hp-popover>`, `<hp-tooltip>`, `<hp-unfoldable>`) save the previously-focused element on open and restore it on close. Native `<dialog>` and Popover API handle this for free; `<hp-unfoldable>` implements explicitly.
3. **`:focus-visible` only.** All focus rings use `:focus-visible`, never plain `:focus`. Mouse/touch clicks never show a focus ring; keyboard navigation always does.
4. **Focus ring composition.** Default ring: `outline: 2px solid var(--hp-focus-ring)` + `outline-offset: 2px`. High-emphasis hexes (action, anchor) layer the edge-trace overlay on focus. Forced-colors fallback: `outline: 2px solid CanvasText` (see § Forced-colors / high-contrast mode).
5. **Focus-ring stacking.** Always above in-flow content via `layer-focus-ring: 100`. Modal dialogs and popovers use Top Layer regardless.
6. **No focus traps outside modal `<hp-dialog>`.** Tooltips, non-modal popovers, and unfolds let focus escape naturally. Only the modal dialog traps.
7. **No auto-focus on programmatic content swap.** `<hp-tabs>` switching panels does NOT auto-move focus to the new panel content. Focus moves only when the user activates with `Enter` / `Space` (matches native ARIA tabs guidance).
8. **Disconnected-element fallback.** When the focused element is removed (route swap, dynamic content), focus falls to a documented parent container marked `tabindex="-1"` — never to `<body>`.

**RTL / directionality is explicitly out of scope.** Hexpunk targets LTR layouts only — the hex grid, animation choreography, and spatial primitives are designed around an LTR reading flow, and the re-imagined UI vocabulary does not have meaningful mirrored equivalents. Physical CSS properties (`margin-left`, `right`, `padding-right`, etc.) are permitted in component styles. Consumers shipping to RTL languages are on their own; the system will not provide mirrored variants. Every other a11y commitment above is non-negotiable.

### Forced-colors / high-contrast mode

When `@media (forced-colors: active)` is true (Windows High Contrast and similar OS modes), Hexpunk **opts in to the browser's system-colour substitution**. No element uses `forced-color-adjust: none` — the hollow-hex pattern is geometric, not chromatic, and survives the transformation gracefully. Outer stroke auto-becomes `CanvasText`, `::before` interior auto-becomes `Canvas`, the hex reads as a pure wireframe.

Explicit handling required:

- **Engaged-state signal.** The blue → green hue swap doesn't survive forced-colours. The opacity lift (`0.75` → `1.0`) and layer change (`layer-default` → `layer-hover`) are the **primary** non-colour state indicators; hue swap is secondary. Components must work with the primary signals alone.
- **Focus rings.** Inside `@media (forced-colors: active)`, `:focus-visible` uses `outline: 2px solid CanvasText` (or `Highlight` where appropriate). Never `outline: none` on focus.
- **Status hexes.** Lose their semantic colour. The mandatory icon + accessible label carry the meaning.
- **Edge-trace and glow.** Simplify to a static `CanvasText` outline. No animated trace, no tinted glow.
- **`<hp-link>` arcs.** Draw in `currentColor` (system-substituted), pulse becomes a static halo at the midpoint — the same fallback used for `prefers-reduced-motion`.

## Implementation Notes

This section is non-normative for the design.md spec but defines Hexpunk's reference implementation.

### Component framework — Lit 3

Hexpunk ships as a library of [Lit](https://lit.dev) web components. Lit was chosen because:

- Custom elements are framework-agnostic — they slot into admin React apps, vanilla HTML pages, and game UIs without re-wrapping.
- The `hp-` element name prefix maps directly to the custom-elements naming requirement (hyphen mandatory).
- Lit's reactive properties and declarative `lit-html` templates give us small, predictable components without a build chain requirement.
- Shadow DOM scopes styles by default — each hex's stroke / clip-path / trace is encapsulated and can't leak.

Element catalogue (one custom element per atom or molecule):

```
<hp-hex>             primitive: SVG hex stencil (size, --hp-stroke-color, --hp-hex-fill)
<hp-cell>            atom: labelled interactive hex
                       variant="anchor|action|secondary|utility", filled? (action only)
<hp-deco>            atom: presentational hex
                       variant="content|support|slot"
<hp-status>          atom: semantic indicator hex
                       tone="positive|warn|alert|error", active?
<hp-link-node>       atom: arc endpoint dot
<hp-bond>            atom: edge-bond indicator between two atoms
<hp-icon>            atom: lucide icon wrapper, sized to hex content area
<hp-pixel>           atom: pixel-art shape inside a hex (states + morphing)
<hp-trace>           overlay: external edge trace for high-emphasis cells

<hp-scroll-list>     molecule: scrolling list inside a hex
<hp-cluster>         organism: 5-hex rosette
<hp-module>          organism wrapper: draggable, snap-to-slot, supports bonding
<hp-module-handle>   atom: centroid grip for moving a bonded molecule

<hp-grid>            surface primitive: the invisible slot lattice. Hosts modules,
                     reveals overlay during drag, computes valid drop targets.
                     One per surface; modules are slotted children.
<hp-link>            curve primitive: arc-link between two <hp-link-node> dots.
                     Hosts pulse animation, draw/unwind transitions.
<hp-graph>           container primitive: manages a set of <hp-link>s, exposes
                     selection, hover propagation, density / pulse-speed knobs.
<hp-node-editor>     template: full graph-editor surface (grid + graph + utility
                     cluster).

<hp-unfoldable>      wrapper: makes its host hex expandable into a detail molecule.
                     Modes: "in-place" | "spotlight" | "camera-zoom". Manages
                     trigger, choreography, tether, child stagger, stacking.

<hp-trace>           overlay: external edge trace
```

### Grid, bonding, linking — implementation

- **`<hp-grid>`** owns the axial coordinate system, the slot occupancy map, and the drag-overlay rendering. Children placed inside it declare a `slot` attribute (`q,r`) and a `footprint` attribute (relative offsets). The grid is the source of truth for layout; modules don't position themselves.
- **`<hp-module>`** handles pointer / keyboard drag, asks the grid for valid drops, emits a `move` event on successful placement, and a `bond` / `unbond` event when its edges touch / separate from another module. It owns its own centroid handle.
- **`<hp-link>`** is a presentational SVG element; pass it source and target `<hp-link-node>` references (or coordinates) and it computes the bezier, draws the stroke + glow, and runs the pulse via Web Animations API (`element.animate(...)` on the dot, not CSS keyframes — easier to control mid-flight).
- **`<hp-graph>`** owns the set of links and the hover-propagation logic (hovering a node dims unrelated arcs).
- **`<hp-unfoldable>`** is a host wrapper. Its `source` slot is rendered at rest; its other children are kept in a virtual detail molecule. On trigger it inserts the detail children into a transient `<hp-grid>` neighbourhood adjacent to the source, animates them in (using Web Animations API), and draws the tether via an internal `<hp-link>`. Cooperates with the host grid to know which slots are free for the bloom.
- All five cooperate via small Lit reactive controllers (`ReactiveController`) rather than a heavy state library. No Redux, no Zustand, no MobX.

### CSS strategy

- **Tokens** live as CSS custom properties on `:root` (global theme), generated from this DESIGN.md's frontmatter. The export pipeline (`npx @google/design.md export --format dtcg` then a small token-to-CSS script) produces `tokens.dark.css` and `tokens.light.css`.
- **Component styles** live inside each Lit element via the `css` template tag (`static styles = css\`...\``). Styles use `var(--hp-\*)` to reference tokens.
- **Shared utilities** (clip-paths, mixins, the hollow-hex pattern) live in a `hp-base.css` `CSSStyleSheet` that's `adoptedStyleSheets`-pushed to every shadow root.
- **SCSS** is optional and only used at build time if a project prefers it for the token-to-CSS generation step. Runtime is pure CSS in template literals.
- **No CSS-in-JS framework** beyond Lit's `css` tag. No Emotion, no styled-components, no Tailwind.

### Dependencies

Hexpunk is committed to staying small. Approved runtime dependencies:

- `lit` — required.
- `@lit-labs/motion` — optional, only if FLIP transitions are needed for drag-and-drop slot re-flow.

Anything else needs a written justification. The pen reference used Velocity.js for scroll easing; the Hexpunk port uses native `scrollTo({ behavior: 'smooth' })` or a small custom easing helper instead.

### Browser support

Hexpunk targets a **Baseline 2025** floor — the strictest matrix that doesn't require polyfills for any of the system's foundational APIs.

| Browser                                           | Minimum | Released |
| ------------------------------------------------- | ------- | -------- |
| Chromium (Chrome / Edge / WebView2 / Brave / Arc) | 130     | 2024-10  |
| Safari (macOS / iOS / iPadOS WKWebView)           | 18      | 2024-09  |
| Firefox                                           | 130     | 2024-09  |

This floor was chosen so every foundational API is natively available with no shim:

- Declarative Shadow DOM
- Adopted Stylesheets
- `ElementInternals` + `formAssociated`
- Top Layer `<dialog>`
- Container queries
- `:has()`
- View Transitions API (same-document)
- Web Animations API
- CSS anchor positioning (Chromium-only on this floor — used as progressive enhancement)

**Cross-document View Transitions** is treated as progressive enhancement. Where the browser supports it (Chromium 126+), full-page navigations in static-site contexts animate natively. Where it doesn't (Firefox, current Safari), router-driven same-document swap is used and animated via the same named transitions.

**Tauri consumers** inherit their webview from the host OS:

- **Windows** — WebView2 is evergreen; always within matrix.
- **macOS** — WKWebView is tied to the system Safari. Baseline 2025 means **macOS 15 (Sequoia, 2024-09)** or newer.
- **Linux** — WebKitGTK **2.46+** (2024-10) brings Safari-18-class features. Modern distros (Ubuntu 24.10+, Fedora 41+) ship this; older LTS distros require a backport. Hexpunk does not patch around WebKitGTK 2.44 or earlier.

The matrix is non-normative: consumers may ship to looser floors at their own risk and re-introduce polyfills as needed. Hexpunk itself will not.

### Server-side rendering

Hexpunk follows an **opt-in SSR** model. Static layout renders on the server via Lit SSR + Declarative Shadow DOM; behaviour layers on top once JS hydrates. The browser-support floor (Baseline 2025) guarantees DSD is natively available in every supported browser, so no shim ships.

**SSR-friendly by default:**

- All atoms — `<hp-hex>`, `<hp-cell>` (all variants), `<hp-deco>` (all variants), `<hp-status>`, `<hp-link-node>`, `<hp-bond>`, `<hp-module-handle>`, `<hp-icon>`, `<hp-pixel>`.
- Spatial-primitive **layout** — `<hp-grid>` and `<hp-cluster>` with static children render fully positioned, because layout is expressed in CSS custom properties + transforms (see § Layout & Spacing). The grid's _behaviour_ (drag, snap, bond) hydrates on client.
- `<hp-scroll-list>` — CSS scroll + linear-gradient mask. The visual ships static; key/wheel selection wires up on hydration.
- `<hp-trace>` static state — the edge-trace overlay renders server-side; the animation runs on client.

**Client-only (renders an empty host server-side, hydrates fully on connect):**

- `<hp-link>` — SVG bezier curve drawing requires runtime coordinate math.
- `<hp-graph>` — arc layout, hover propagation, density toggling.
- `<hp-unfoldable>` — choreography, child stagger, tether wiring.
- `<hp-node-editor>` — composes the above.

**Authoring rules for SSR-friendly elements:**

- No side effects in `connectedCallback`. Defer subscriptions to `firstUpdated`.
- No DOM reads in `render()`. Templates are pure functions of properties.
- No async work in the render pipeline.
- All visual state must be derivable from declared properties, attributes, or CSS custom properties — never from runtime measurement.
- Light-DOM access (`querySelector`, slotted-children inspection) is allowed in `firstUpdated` and beyond, never during render.

Elements that can't meet these rules are **client-only**: they ship a sentinel template (empty host or a `<slot>` echo) server-side, and the real template is gated behind a `this.hydrated` flag flipped on `connectedCallback`.

### Keyboard shortcuts

Hexpunk owns a small set of system shortcuts. Consumer apps own every other binding. Apps register their bindings via `<hp-keymap>` and/or the `hpBindKey()` helper so the keymap dialog (opened with `?`) always reflects the live set.

**Hexpunk-owned shortcuts:**

| Key                 | Action                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `esc`               | Close modal `<hp-dialog>`, close popover, cancel drag, collapse one `<hp-unfoldable>` level                  |
| `shift+esc`         | Collapse to unfold root                                                                                      |
| `space`             | Activate focused button-like atom; grab/drop draggable module                                                |
| `enter`             | Activate focused action, trigger unfold, submit input                                                        |
| `arrow keys`        | Navigate within composite widgets (tabs, radios, cluster, grid, scroll-list); step between slots during drag |
| `home` / `end`      | Jump to first/last in scroll-list, tab list, pagination                                                      |
| `?` (`shift+/`)     | Open the system keymap dialog (when `<hp-keymap>` is present)                                                |
| `tab` / `shift+tab` | Standard focus traversal between widgets                                                                     |

Anything not in this list is fair game for consumer apps.

**`hpBindKey()` helper:**

```ts
import { hpBindKey } from "@hexpunk/core/hotkeys";

const unbind = hpBindKey(
  "mod+s",
  (e) => {
    e.preventDefault();
    save();
  },
  { reserveCheck: true }
);
```

- Handles modifiers (`mod` = `ctrl` on Windows/Linux, `cmd` on macOS), key sequences (`g d`), and single keys.
- Suppresses bindings inside `<input>`, `<textarea>`, and `contenteditable` regions.
- `reserveCheck: true` logs a dev warning if the binding collides with a hexpunk-owned shortcut.
- Returns an unbind function.

Bindings registered via `hpBindKey` or declared inside an `<hp-keymap>` share an internal registry, so the keymap dialog stays in sync without manual coordination.

### Form association

Every input-like atom in Hexpunk is **form-associated by default**. Components declare `static formAssociated = true`, attach internals via `this.attachInternals()` in the constructor, and call `internals.setFormValue(value)` whenever the value changes. This gives consumers:

- `<hp-input name="email">` inside a `<form>` contributes to `FormData` natively.
- `form.reset()` resets every `<hp-*>` form atom.
- Validity propagation (`internals.setValidity({...}, message)`) lights up the standard `:invalid` / `:valid` / `:user-invalid` pseudo-classes for free.
- Screen readers see proper form-field semantics via ElementInternals' ARIA propagation.

Form-associated atoms (mandatory form participation by default): `<hp-input>`, `<hp-textarea>`, `<hp-checkbox>`, `<hp-radio>`, `<hp-switch>`, `<hp-select>`.

**Opt-out — the `formless` attribute.** For legitimate cases where an input-shaped atom carries UI state but should _not_ participate in form submission — a checkbox driving a CSS-only state-flip pattern, an "expand details" toggle, a tab switcher — add `formless`:

```html
<hp-checkbox formless aria-label="show advanced settings"></hp-checkbox>
```

When `formless` is set the element still attaches internals (for ARIA wiring) but does not call `setFormValue`. The element is invisible to `FormData`, `form.reset()`, and validation. Default is `formless = false`; you must explicitly opt out.

`formless` is for genuinely-presentational uses (CSS state flips, UI toggles that don't represent a form value). It is not an escape hatch for skipping validation work — see anti-patterns.

**Authoring rules for form-associated atoms:**

- `static formAssociated = true` on the class.
- `private internals = this.attachInternals()` in the constructor.
- Call `this.internals.setFormValue(this.value)` whenever the value changes (typically in `willUpdate` or after a user-driven event).
- Call `this.internals.setValidity(flags, message)` to propagate validity. Pass `{}` and `''` to clear.
- Implement `formResetCallback()` to restore the initial value on `form.reset()`.
- Implement `formDisabledCallback(disabled)` if the element should react to a disabled `<fieldset>`.
- Honour the `formless` opt-out: gate `setFormValue` / `setValidity` / reset-restoration on `!this.formless`.

### Drag-and-drop

`<hp-module>` is the draggable wrapper. It tracks the sparse-grid slot map, snaps to nearest available slot on drop, refuses overlap, and exposes a `layout` event so consumers can persist user arrangements. Keyboard interaction is mandatory (see Accessibility).

## Do's and Don'ts

**Do**

- Use hexagons for identity, action, and status. Make them count.
- Treat the blue-to-green hue swap as the system's resting interaction.
- Reserve the edge-trace elaboration for primary actions where the routing metaphor matters.
- Lay out sparsely. Empty slots are part of the design.
- Keep the grid invisible by default; reveal it only during drag (or hold-shift).
- Bond atoms into molecules when they belong together; expose a single centroid handle for the group.
- Use arc-links for _relationships at a distance_. Use edge-bonds for _cells that belong together_. Use unfolds for _detail behind a cell_.
- Keep unfolds in-place by default; spotlight and camera-zoom are stronger gestures — reserve them for navigating into items or entering immersive views.
- Always tether an unfolded hex back to its origin slot. Continuity is the point.
- Pulse only along live arc-links. No other ambient motion.
- Let large framing hexes spill off the canvas — that's the architecture talking.
- Drop into rectangles for prose and dense data; anchor those rectangles with hex corners.
- Pair every colour signal with an icon, label, or position so colour-blind users get the message.
- Reference semantic tokens (`primary`, `secondary`) in components, not palette stops (`cyan-500`) — keeps brand rotation cheap.
- Respect `prefers-reduced-motion`.

**Don't**

- Don't tile dense honeycombs — Hexpunk is sparse by default.
- Don't decorate paragraphs or content blocks as hexagons. Hex is for interaction and identity.
- Don't add ambient pulses, drifting particles, or constant motion. The system should feel still until touched. The arc pulse is the only exception, and only on _live_ arcs.
- Don't draw the grid at rest. It's an invisible layout primitive — making it visible is reserved for drag / hold-shift.
- Don't put input fields inside hex clip-paths — caret position and selection break. Use `content-card` for inputs.
- Don't invert the dark theme to make light. Light is a separate palette with its own balance.
- Don't pile three weights or three colours into one cell. One label, one value, one accent.
- Don't let a dragged module overlap or obscure another module's interactive area.
- Don't fill every hex. The wireframe is the point; filled hexes are reserved for high-emphasis exceptions.
- Don't cross arc-links through occupied hex cells without dimming them. The arc layer sits above hexes; readability depends on visual separation.
- Don't reference palette stops directly (`{colors.cyan-500}`) in components when a semantic token (`{colors.primary}`) is available.
- Don't nest unfolds past `unfold-depth-max` (3 levels). Past that the tether chain becomes navigationally hostile.
- Don't use camera-zoom unfold for routine interactions. It reframes the whole canvas — reserve it for "entering" a context (a character sheet, a sub-graph), not "peeking at" a value.
- Don't unfold without a tether. Without continuity the user loses where they were.
