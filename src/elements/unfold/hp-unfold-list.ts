// hp-unfold-list.ts — Ring-expanding unfold primitive.
//
// The first of three sibling unfold primitives. Each handles a
// distinct navigation contract; they don't share a `mode` attribute:
//
// - **hp-unfold-list** (this file) — source stays on the surface;
// detail children explode outward into the 6-ring of axial
// neighbours around the source, optionally inside an
// `<hp-grid>` / `<hp-cluster>` where the children's bloom positions
// align with the parent's lattice. Ordered by default (clockwise
// spiral fill / stagger); `unordered` randomises the position +
// stagger order, stable per-mount.
//
// - `<hp-unfold-overlay>` (follow-up) — source stays in place; a
// hex-clipped Popover-API overlay opens at the viewport centre.
//
// - `<hp-unfold-page>` (follow-up) — cross-document View Transitions:
// source hex grows to fill the canvas, browser tweens into the
// destination page's hero hex.
//
// **Authoring:**
//
// <hp-unfold-list>
// <hp-cell variant="anchor" slot="source">PIPELINE</hp-cell>
// <hp-deco variant="content">STAGE 1 — ingest</hp-deco>
// <hp-deco variant="content">STAGE 2 — transform</hp-deco>
// <hp-status tone="positive">ONLINE</hp-status>
// </hp-unfold-list>
//
// <hp-unfold-list unordered>
// <hp-cell variant="anchor" slot="source">TAGS</hp-cell>
// <hp-deco variant="content">cyberpunk</hp-deco>
// <hp-deco variant="content">wireframe</hp-deco>
// <hp-deco variant="content">hex-first</hp-deco>
// </hp-unfold-list>
//
// The source slot is always visible. Default-slot children are
// hidden at rest; on trigger they reveal in the 6-ring with the
// stagger from `--hp-unfold-stagger`.
//
// **Triggers:** click / tap / Enter / Space on the source toggles
// open. `Esc` closes if open. The host mirrors `[open]` and sets
// `aria-pressed` on the source so hp-cell's existing hue swap
// engages without separate wiring.
//
// **Grid alignment.** The 6-ring positions are computed via
// `--hp-col-step` / `--hp-row-step` — the same step math hp-grid and
// hp-cluster use. When hp-unfold-list is placed inside an `<hp-grid>`
// at axial (q, r), its children land at the visual positions of the
// six axial neighbours. The grid's occupancy map doesn't currently
// know about the unfold children, so consumers should reserve
// neighbour cells (or accept overlap) until a later phase wires
// `hp-unfold-open` to a grid-level dim / occupancy hook.
//
// **Spiral fill > 6.** The first ring caps at 6 children. Extras
// stay slotted but hidden — a follow-up spiral-fill pattern will
// extend into the second ring (12 positions) and beyond.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "./hp-module-handle.js";
import { hpBase } from "../../styles/hp-base.js";

/** Max children the first ring can host. */
const RING_CAPACITY = 6;

/** Fisher-Yates shuffle of [0..n-1] using `Math.random`. Stable in
 * the sense the caller owns the array's lifetime — callers cache the
 * result per mount so the shuffle doesn't reroll on every open. */
function shuffledRange(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i] as number;
    arr[i] = arr[j] as number;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Ring-expanding list primitive — click the source to fan slotted
 * children into a 6-slot ring around it; click outside to close.
 *
 * @fires hp-unfold-open - When the list opens
 * @fires hp-unfold-close - When the list closes
 *
 * @slot source - The trigger hex (always visible)
 * @slot - Children fanned into the ring when open
 */
@customElement("hp-unfold-list")
export class HpUnfoldList extends LitElement {
  /** Reflected open / closed state. Drives the bloom CSS + the
   * `aria-pressed` mirror on the source. */
  @property({ reflect: true, type: Boolean })
  open = false;

  /** When set, children land at a randomly-shuffled subset of the 6
   * ring positions and stagger in random order (both keyed off the
   * same permutation). Without it, children land in clockwise
   * spiral order and stagger in that same order. Mirrors the
   * ordered / unordered semantics of `<ol>` vs `<ul>`. */
  @property({ reflect: true, type: Boolean })
  unordered = false;

  /** Source element bound at slotchange — listened on for click /
   * Enter triggers and mirrored with `aria-pressed`. Owned here so
   * toggling open / close updates it without re-querying. */
  private sourceEl: HTMLElement | null = null;

  /** AbortController for source-element listeners so they tear down
   * cleanly when the source slot's assigned element changes. */
  private sourceListeners: AbortController | null = null;

  /** Cached random permutation for `unordered` mode. Set on first
   * slotchange so the shuffle is stable per-mount — opening and
   * closing repeatedly always lands children at the same random
   * positions. */
  private shuffledIndices: number[] | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.onWindowKeydown);

    // Auto-provision a drag handle in our own light DOM so this
    // works inside <hp-grid> without consumer setup. The handle
    // hangs below the source hex (CSS positions it at top: 100%)
    // and gates drag for the grid's drag-handle attribute. If the
    // consumer already slotted their own handle (or wants to opt
    // out by removing it post-mount), we don't double-insert.
    if (!this.querySelector(':scope > [slot="handle"]')) {
      const handle = document.createElement("hp-module-handle");
      handle.setAttribute("slot", "handle");
      this.appendChild(handle);
    }
    if (!this.hasAttribute("drag-handle")) {
      this.setAttribute("drag-handle", '[slot="handle"]');
    }

    // Fallback toggle handler on the host. The source slot's own
    // click listener (bound in onSourceSlotChange) handles the
    // normal path; this is a safety net for environments where
    // slotchange / shadow-DOM event retargeting doesn't deliver the
    // event to the slotted child's listener in time. Filters out
    // clicks on the drag handle so dragging doesn't double-toggle.
    this.addEventListener("click", this.onHostClick);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.onWindowKeydown);
    this.removeEventListener("click", this.onHostClick);
    this.sourceListeners?.abort();
    this.sourceListeners = null;
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("open")) {
      if (this.sourceEl) {
        if (this.open) {
          this.sourceEl.setAttribute("aria-pressed", "true");
        } else {
          this.sourceEl.removeAttribute("aria-pressed");
        }
      }
      this.dispatchEvent(
        new CustomEvent(this.open ? "hp-unfold-open" : "hp-unfold-close", {
          bubbles: true,
          composed: true,
        })
      );
    }
    // Re-tag children when `unordered` flips so the shuffle vs spiral
    // assignment reflects the new attribute on next open.
    if (changed.has("unordered")) {
      this.shuffledIndices = null;
      this.reassignRingPositions();
    }
  }

  /** Toggle handler; exposed publicly for consumers who want their
   * own trigger surface (e.g., an external utility button). */
  toggle(): void {
    this.open = !this.open;
  }

  /** Imperative close (e.g., for parent cluster choreography). */
  close(): void {
    if (this.open) {
      this.open = false;
    }
  }

  /** Host-level click fallback. If a click reached the unfold-list
   * host without being toggled by the source's own click listener
   * (slot-binding race, retargeting quirk, future event-flow
   * oddness), we still flip open here. Skips clicks that originated
   * inside the drag handle so dragging doesn't double-toggle. */
  private readonly onHostClick = (ev: MouseEvent): void => {
    const target = ev.target as Element | null;
    if (!target) {
      return;
    }
    if (target.closest('[slot="handle"]')) {
      return;
    }
    if (!target.closest('[slot="source"]')) {
      return;
    }
    this.toggle();
  };

  private readonly onWindowKeydown = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape" && this.open) {
      ev.stopPropagation();
      this.close();
      // Return focus to the source so subsequent keyboard navigation
      // resumes from the trigger, not from nowhere.
      this.sourceEl?.focus({ preventScroll: true });
    }
  };

  private readonly onSourceSlotChange = (ev: Event): void => {
    const slot = ev.target as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true });
    const nextSource = (assigned[0] as HTMLElement | undefined) ?? null;

    this.sourceListeners?.abort();
    this.sourceEl = nextSource;
    if (!nextSource) {
      return;
    }

    // Tab into the source by default if the consumer hasn't already.
    // Unfoldables are interactive primitives; keyboard reachability is
    // part of the contract.
    if (!nextSource.hasAttribute("tabindex")) {
      nextSource.setAttribute("tabindex", "0");
    }
    if (this.open) {
      nextSource.setAttribute("aria-pressed", "true");
    }

    const ctl = new AbortController();

    // Pointerdown on the source's hex polygon — claim the event so
    // the parent grid's pan-passthrough (clicking a [q][r] child
    // outside its drag-handle starts a canvas pan) doesn't swallow
    // the click. The polygon's intrinsic pointer-events means clicks
    // in the source's bbox corners (outside the hex shape) fall
    // through to the grid normally — so panning from "dead pixels"
    // around the source still works. Click on the drag-handle is
    // on a sibling element entirely, doesn't trip this listener.
    nextSource.addEventListener(
      "pointerdown",
      (e) => {
        if ((e as PointerEvent).button !== 0) {
          return;
        }
        e.stopPropagation();
      },
      { signal: ctl.signal }
    );
    nextSource.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        this.toggle();
      },
      { signal: ctl.signal }
    );
    nextSource.addEventListener(
      "keydown",
      (e) => {
        const key = (e as KeyboardEvent).key;
        if (key === "Enter" || key === " ") {
          e.preventDefault();
          this.toggle();
        }
      },
      { signal: ctl.signal }
    );
    this.sourceListeners = ctl;
  };

  /** Recompute every default-slot child's `data-unfold-index`. Called
   * on slotchange and whenever the `unordered` flip needs to rebuild
   * the assignment. */
  private reassignRingPositions(): void {
    const slot = this.shadowRoot?.querySelector<HTMLSlotElement>("slot:not([name])");
    if (!slot) {
      return;
    }
    this.applyRingPositions(slot.assignedElements({ flatten: true }));
  }

  private readonly onChildrenSlotChange = (ev: Event): void => {
    const slot = ev.target as HTMLSlotElement;
    this.applyRingPositions(slot.assignedElements({ flatten: true }));
  };

  /** Walk the first N (≤ RING_CAPACITY) slotted children and tag each
   * with `data-unfold-index`. In ordered mode the indices count up
   * in DOM order; in `unordered` mode they read from the cached
   * permutation. Anything past N has the attribute removed so the
   * `:not([data-unfold-index])` selector hides it. */
  private applyRingPositions(children: Element[]): void {
    if (this.unordered && !this.shuffledIndices) {
      this.shuffledIndices = shuffledRange(RING_CAPACITY);
    }
    const order = this.unordered
      ? (this.shuffledIndices as number[])
      : Array.from({ length: RING_CAPACITY }, (_, i) => i);

    let placed = 0;
    for (const child of children) {
      if (!(child instanceof HTMLElement)) {
        continue;
      }
      if (placed < RING_CAPACITY) {
        child.setAttribute("data-unfold-index", String(order[placed] ?? placed));
        placed++;
      } else {
        child.removeAttribute("data-unfold-index");
      }
    }
  }

  static override styles = [
    hpBase,
    css`
      :host {
        position: relative;
        display: inline-block;

        /* Step math matches hp-cluster / hp-grid so a unfold-list's
 * 6-ring shares strokes with its source AND aligns with the
 * parent grid's lattice when nested inside hp-grid. */
        --hp-col-step: calc(var(--hp-cell) - var(--hp-hex-stroke));
        --hp-row-step: calc(var(--hp-col-step) * 0.8660254);
      }

      /* Source slot is always visible at the host's origin. */
      ::slotted([slot="source"]) {
        cursor: var(--hp-cursor, pointer);
      }

      /* Drag handle — auto-provisioned in light DOM by
 * connectedCallback. Sits fully BELOW the source's hex polygon
 * (top: 100%) so its hit-area never overlaps the source. A
 * handle covering any part of the source intercepts
 * pointerdown there, the grid initiates drag with
 * preventDefault, and the toggle's click event never
 * synthesises. Keeping it outside the source guarantees the
 * full source polygon is clickable for toggle. Smaller than
 * the default 36px so the grip reads as an attached "tab"
 * rather than a sibling cell. The grid's
 * drag-handle="[slot='handle']" gates drag to this element. */
      ::slotted([slot="handle"]) {
        --hp-module-handle-size: 24px;
        position: absolute;
        left: 50%;
        top: 100%;
        translate: -50% 0;
        z-index: var(--hp-layer-hover);
      }

      /* Default-slot children — hidden at rest, positioned + revealed
 * on [open]. Position is element-relative; the host's display:
 * inline-block sizing means children at translate(0,0) sit on
 * top of the source. Hides via opacity + pointer-events rather
 * than the CSS visibility property, so the staggered close
 * transition isn't truncated — visibility would flip at its
 * own fixed delay and yank every child into the hidden state
 * ~90ms after the close starts, before the per-child stagger
 * (up to ~390ms) has played out. */
      ::slotted([data-unfold-index]) {
        position: absolute;
        left: 0;
        top: 0;
        opacity: 0;
        pointer-events: none;
        /* Propagate pointer-events: none into the child's composed
 * hp-hex polygons too. CSS pointer-events on the host
 * doesn't cascade to descendant elements that have their
 * own explicit pointer-events: auto — so invisible closed
 * children stacked over the source were swallowing clicks
 * meant for the source's polygon and breaking the "click to
 * open" path. hp-hex reads this custom property for its
 * inner / outer polygons; closed children silence both,
 * open children re-enable. */
        --hp-hex-pointer-events: none;
        transition:
          opacity var(--hp-unfold-trigger) var(--hp-ease-default),
          translate var(--hp-unfold-trigger) var(--hp-ease-default);
      }

      /* Hide any child past the first ring — extras stay slotted (so
 * we keep their content in the DOM) but render invisible until
 * a future spiral-fill pattern handles overflow into ring 2. */
      ::slotted(:not([slot="source"]):not([data-unfold-index])) {
        display: none;
      }

      /* ── Open state ──────────────────────────────────────────── */

      :host([open]) ::slotted([data-unfold-index]) {
        opacity: 1;
        pointer-events: auto;
        --hp-hex-pointer-events: auto;
      }

      /* 6-ring positions (axial neighbours of source, clockwise from
 * top-left). Translate is on the slotted child via the CSS
 * 'translate' longhand (separate from any 'transform' the atom
 * sets internally). */
      :host([open]) ::slotted([data-unfold-index="0"]) {
        translate: calc(var(--hp-col-step) * -0.5) calc(var(--hp-row-step) * -1);
      }
      :host([open]) ::slotted([data-unfold-index="1"]) {
        translate: calc(var(--hp-col-step) * 0.5) calc(var(--hp-row-step) * -1);
      }
      :host([open]) ::slotted([data-unfold-index="2"]) {
        translate: var(--hp-col-step) 0;
      }
      :host([open]) ::slotted([data-unfold-index="3"]) {
        translate: calc(var(--hp-col-step) * 0.5) var(--hp-row-step);
      }
      :host([open]) ::slotted([data-unfold-index="4"]) {
        translate: calc(var(--hp-col-step) * -0.5) var(--hp-row-step);
      }
      :host([open]) ::slotted([data-unfold-index="5"]) {
        translate: calc(var(--hp-col-step) * -1) 0;
      }

      /* Bloom stagger — each ring slot fades + slides in
 * --hp-unfold-stagger after the previous. Reverse stagger on
 * close (matches DESIGN.md: source hue swap first, then
 * children recede in reverse order). With the unordered
 * attribute, the data-unfold-index values themselves are
 * shuffled, so the stagger fires in random order without us
 * needing different delays. */
      :host([open]) ::slotted([data-unfold-index="0"]) {
        transition-delay: 0ms;
      }
      :host([open]) ::slotted([data-unfold-index="1"]) {
        transition-delay: var(--hp-unfold-stagger);
      }
      :host([open]) ::slotted([data-unfold-index="2"]) {
        transition-delay: calc(var(--hp-unfold-stagger) * 2);
      }
      :host([open]) ::slotted([data-unfold-index="3"]) {
        transition-delay: calc(var(--hp-unfold-stagger) * 3);
      }
      :host([open]) ::slotted([data-unfold-index="4"]) {
        transition-delay: calc(var(--hp-unfold-stagger) * 4);
      }
      :host([open]) ::slotted([data-unfold-index="5"]) {
        transition-delay: calc(var(--hp-unfold-stagger) * 5);
      }

      :host(:not([open])) ::slotted([data-unfold-index="0"]) {
        transition-delay: calc(var(--hp-unfold-stagger) * 5);
      }
      :host(:not([open])) ::slotted([data-unfold-index="1"]) {
        transition-delay: calc(var(--hp-unfold-stagger) * 4);
      }
      :host(:not([open])) ::slotted([data-unfold-index="2"]) {
        transition-delay: calc(var(--hp-unfold-stagger) * 3);
      }
      :host(:not([open])) ::slotted([data-unfold-index="3"]) {
        transition-delay: calc(var(--hp-unfold-stagger) * 2);
      }
      :host(:not([open])) ::slotted([data-unfold-index="4"]) {
        transition-delay: var(--hp-unfold-stagger);
      }
      :host(:not([open])) ::slotted([data-unfold-index="5"]) {
        transition-delay: 0ms;
      }

      /* Reduced motion — children appear / disappear instantly, no
 * stagger, hue swap remains (per DESIGN.md). */
      @media (prefers-reduced-motion: reduce) {
        ::slotted([data-unfold-index]) {
          transition: none !important;
          transition-delay: 0ms !important;
        }
      }
    `,
  ];

  override render() {
    return html`
      <slot name="source" @slotchange=${this.onSourceSlotChange}></slot>
      <slot name="handle"></slot>
      <slot @slotchange=${this.onChildrenSlotChange}></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-unfold-list": HpUnfoldList;
  }
}
