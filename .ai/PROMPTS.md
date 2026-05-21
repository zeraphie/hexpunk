# Hexpunk — Prompt Library

Canonical prompts for generating Hexpunk UIs with an AI design tool (Claude Design, Claude Code, Cursor, etc.). Pair this file with `DESIGN.md` and `.ai/ELEMENTS.md` when briefing an agent.

## Prompting recipe

1. **Lead with the surface type** (`admin`, `web marketing`, `web app`, `game HUD`, `game menu`). Sets density expectations.
2. **Use Hexpunk vocabulary by name** — `anchor`, `action`, `utility`, `bond`, `arc-link`, `unfold` (in-place / spotlight / camera-zoom), `edge-trace`, `cluster`, `module`, `scroll-list`. DESIGN.md defines them; the agent can resolve them.
3. **Specify density** — "sparse 5-hex cluster" vs "dense node graph."
4. **Call out what should be rectangular** — "long-form copy in a content-card" — to prevent hex-everything-itis.
5. **Mention the seed pair** if you want brand variation — "rotate brand to amber + sky" maps to swapping palette stops.

## Admin

- "A Hexpunk admin dashboard for a CI/CD pipeline. Left hex nav rail with anchors for Builds, Deploys, Logs, Settings. Right side: a rectangular content area with hex anchors at corners. The Builds list is an unfoldable scroll-list — selecting a build spotlight-unfolds into stage detail hexes with arc-links between stages and a tether back to the list."
- "A Hexpunk permissions editor as a node-editor surface. Roles are bonded molecules. Permissions are arc-links between roles. Hovering a role brightens its arcs and accelerates pulse; everything else dims to 30%."
- "A Hexpunk login screen. Single centred organism, email + password molecules, submit uses the edge-trace on focus. Sparse outer framing hexes overflow the viewport edges."

## Web

- "A Hexpunk product landing page hero. Big hex-cell-lg framing hex spilling off the left edge. Centre cluster of 5 feature hexes — hover any one to in-place unfold its benefits. CTA uses a filled action hex; everything else is hollow."
- "A Hexpunk pricing page with three tiers as bonded molecules (price atom + features atom + CTA atom). Arc-links connect equivalent features across tiers so users can trace what differs."

## Game

- "A Hexpunk character HUD. Bottom-right cluster (5-hex rosette) for ability slots, top-left anchor for portrait. Inventory slot camera-zoom unfolds into a full item card on click; esc returns. Skill tree screen reuses the node-editor primitive with arc-links for prerequisites."
- "A Hexpunk crafting screen. Recipe nodes are bonded molecules (output hex + ingredient atoms). Arc-links show ingredient flow with green pulse on active recipes. Selecting a recipe spotlight-unfolds it for step-by-step detail."

## Questboard (the canonical example app)

Hexpunk is used as the design system for a Tauri/Lit/Rust quest-tracking app. The domain maps to Hexpunk primitives 1:1:

| Quest concept                | Hexpunk primitive                                             |
| ---------------------------- | ------------------------------------------------------------- | ---- | -------- |
| Quest card                   | `<hp-cell variant="action">` or `<hp-deco variant="content">` |
| Quest chapter                | bonded molecule of quests                                     |
| Quest prerequisite           | arc-link between quest hexes                                  |
| Quest detail view            | `<hp-unfoldable>` (spotlight mode)                            |
| Quest status                 | `<hp-status tone="positive                                    | warn | error">` |
| Player profile               | `<hp-cell variant="anchor">`                                  |
| Settings / filter / sort     | `<hp-cell variant="utility">` cluster                         |
| Skill tree / progression map | `<hp-graph>` with arc-links                                   |

When generating Questboard screens, prefer this mapping over inventing new patterns.

## Iteration

First generations are usually 70% right. Fix by hand, then keep the corrected version as a few-shot example for the next prompt in the same surface. Over time the prompt-with-examples set becomes the team's tacit style guide.
