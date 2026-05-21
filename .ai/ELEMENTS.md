# Hexpunk — Elements Reference

This file is **auto-generated from `custom-elements.json`** once elements land in `src/elements/`. Until then, see the catalogue in `DESIGN.md` under `## Components` and `## Implementation Notes`.

To regenerate this file:

```bash
bun run analyze     # produces custom-elements.json
# then a small script transforms it into this file
```

## Stub catalogue

```
<hp-hex>             primitive: SVG hex stencil (size, --hp-stroke-color, --hp-hex-fill)
<hp-cell>            atom: labelled interactive hex
                       variant="anchor|action|secondary|utility"
                       filled? (action only — high-emphasis CTA)
<hp-deco>            atom: presentational hex
                       variant="content|support|slot"
                       (content has label; support / slot are aria-hidden)
<hp-status>          atom: semantic indicator hex
                       tone="positive|warn|alert|error", active?
<hp-link-node>       atom: arc endpoint dot
<hp-bond>            atom: edge-bond indicator between two atoms
<hp-icon>            atom: lucide icon wrapper, sized to hex content area
<hp-pixel>           atom: pixel-art shape inside a hex (states + morphing)
<hp-trace>           overlay: external edge trace for high-emphasis cells
<hp-module-handle>   atom: centroid grip for moving a bonded molecule

<hp-scroll-list>     molecule: scrolling list inside a hex (planned)
<hp-cluster>         molecule: 5-hex rosette (centre + top/middle-left/middle-right/bottom)
<hp-module>          molecule wrapper: draggable, snap-to-slot, supports bonding (planned)

<hp-grid>            surface primitive: invisible slot lattice with pan + zoom
<hp-link>            curve primitive: arc-link between two <hp-link-node> dots
<hp-graph>           container primitive: manages a set of <hp-link>s (planned)
<hp-node-editor>     template: full graph-editor surface (planned)
<hp-unfoldable>      wrapper: makes its host hex expandable into a detail molecule (planned)
```

Each element will be documented here with: tag name, attributes, properties, slots, events, CSS variables, and a usage example.
