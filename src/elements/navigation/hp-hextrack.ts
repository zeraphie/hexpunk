// hp-hextrack.ts — Silhouette-riding browse/select overlay.
//
// The osu-song-select move as a select primitive: items ride a
// HEXAGON silhouette — the flat focal run is the vertical left edge
// of a pointy-top hexagon whose body sits off-screen right, so rows
// recede up-right / down-right past the 60° vertex breaks. Rows are
// CONTIGUOUS (no gaps, osu-style) and the rail sizes to the list.
//
// Interaction contract:
// - wheel scrubs with momentum; a magnetic focal settles the list
// - hovering a row once motion has SETTLED previews its subheadings
//   in place (the difficulties pattern); the focal row's subs show
//   when nothing is previewed
// - clicking a row SELECTS it: the track auto-scrolls it to the
//   focal, then fires `hp-hextrack-activate` — click is always
//   selection, never mere scrubbing
// - `loop` makes the list endless (wraps); without it the ends clamp
//
// The rail idles as a translucent HINT at the host's right edge;
// pointer or arrow keys raise FOCUS, which scrims the page behind
// (the page itself is the preview). Esc folds back to hint.

import { LitElement, css, html, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

export interface HpHextrackItem {
  id: string;
  label: string;
  sub?: string;
  /** Inert row — listed but not selectable (future slots etc). */
  ghost?: boolean;
  /** Subheadings revealed on focal / hover preview. */
  subs?: string[];
}

export interface HpHextrackActivateDetail {
  id: string;
}
export interface HpHextrackSubDetail {
  id: string;
  sub: string;
  index: number;
}

/** Contiguous row pitch (px) — rows touch, osu-style. */
const ROW_H = 46;
/** Per-subheading height the expansion inserts into the flow. */
const KID_H = 26;
/** Length of the flat focal run — the silhouette's vertical edge. */
const EDGE = 216;
/** Receding-edge direction past a break: 30° from horizontal, the
 * honest continuation of a pointy-top hexagon's left edge. */
const RECEDE_X = 0.866;
const RECEDE_Y = 0.5;
/** Rows beyond this relative distance are hidden. */
const VISIBLE_SPAN = 6;

/**
 * Overlay browse/select rail — items ride a hexagon silhouette at
 * the host's right edge in contiguous rows. Wheel scrubs with a
 * magnetic focal; once settled, hovering a row previews its
 * subheadings in place; clicking a row selects it — the track
 * auto-scrolls it focal, then fires the activation. `loop` wraps
 * the list endlessly. `hint` state peeks over the page; pointer or
 * arrow keys raise `focus`, which dims the page behind.
 *
 * @fires hp-hextrack-state - Hint / focus flips. detail: { state }
 * @fires hp-hextrack-focus - The magnetic focal settled on an item. detail: { id }
 * @fires hp-hextrack-activate - An item was selected (click / Enter), after the auto-scroll lands. detail: { id }
 * @fires hp-hextrack-sub - A subheading was chosen. detail: { id, sub, index } — id is the row the subs belong to
 *
 * @cssproperty --hp-hextrack-width - Rail width (default 380px)
 * @status wip
 */
@customElement("hp-hextrack")
export class HpHextrack extends LitElement {
  /** The rows, in track order. Data-driven for now; a slotted-item
   * form is a later decision. */
  @property({ attribute: false })
  items: HpHextrackItem[] = [];

  /** Id of the item the track should hold focal — typically the
   * page the consumer just dived into. Setting it re-centres. */
  @property()
  focal = "";

  /** Endless mode: the list wraps around instead of clamping. */
  @property({ reflect: true, type: Boolean })
  loop = false;

  /** Overlay state. `hint` peeks at the edge; `focus` slides in and
   * scrims the page. Reflected so consumers can force either. */
  @property({ reflect: true })
  state: "hint" | "focus" = "hint";

  private focusPos = 0;
  private vel = 0;
  private snapTarget: number | null = null;
  private frame = 0;
  private lastSettled = -1;
  private settled = false;
  private previewIndex: number | null = null;
  private renderedExpand = -1;
  private pendingActivate: string | null = null;
  private railH = 460;
  private readonly reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  static override styles = [
    hpBase,
    css`
      :host {
        position: absolute;
        inset: 0;
        display: block;
        pointer-events: none;
        --hp-hextrack-width: 380px;
      }
      :host([hidden]) {
        display: none;
      }

      .scrim {
        position: absolute;
        inset: 0;
        background: color-mix(in srgb, var(--hp-surface-container-lowest) 62%, transparent);
        opacity: 0;
        transition: opacity 260ms ease;
        pointer-events: none;
      }
      :host([state="focus"]) .scrim {
        opacity: 1;
        pointer-events: auto;
      }

      /* The rail is a vertically-centred band sized to the list, so
         its hover area matches what the silhouette occupies and the
         chrome around it stays reachable. */
      .rail {
        position: absolute;
        right: 0;
        width: var(--hp-hextrack-width);
        /* hp-base zeroes line-height on atom hosts and it inherits
           into the shadow — a zero line box under .name's
           overflow:hidden clips every title to nothing. Restore
           normal text flow for the whole rail. */
        line-height: 1.45;
        pointer-events: auto;
        transform: translateX(calc(var(--hp-hextrack-width) - 85px));
        opacity: 0.55;
        transition:
          transform 280ms cubic-bezier(0.25, 1, 0.4, 1),
          opacity 220ms ease;
      }
      :host([state="focus"]) .rail {
        transform: translateX(0);
        opacity: 1;
      }

      .edge {
        position: absolute;
        left: 54px;
        top: calc(50% - 108px);
        height: 216px;
        border-left: 1.5px dashed var(--hp-secondary);
        opacity: 0.35;
        pointer-events: none;
      }
      .edge::before,
      .edge::after {
        content: "";
        position: absolute;
        left: -1.5px;
        width: 130px;
        border-top: 1.5px dashed var(--hp-secondary);
        transform-origin: 0 0;
      }
      .edge::before {
        top: 0;
        transform: rotate(-30deg);
      }
      .edge::after {
        bottom: 0;
        transform: rotate(30deg);
      }

      /* Contiguous osu-style rows: fixed pitch, shared edges, no
         gaps. Physics writes transforms directly while scrubbing;
         once settled the container transitions them, so preview
         expansion pushes rows smoothly. */
      /* The row's BOX is the group's bounding box — face plus
         expanded subitems — so one boundary carries the hover. The
         box itself paints nothing; the face and kids keep their own
         looks. */
      .row {
        position: absolute;
        left: 0;
        top: 0;
        width: 320px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        transform-origin: left center;
        cursor: pointer;
      }
      .items[data-settled] .row {
        transition:
          transform 220ms cubic-bezier(0.3, 0.9, 0.3, 1),
          opacity 220ms ease;
      }
      .row[data-ghost] {
        opacity: 0.5;
        cursor: default;
      }
      /* PSO2-style plate: an angled panel with a chamfered cut at
         each end, a bright top edge line, and a darker prow zone
         holding the hex chip — painted with layered gradients so
         the edges follow the clip. Plates sit with a small gap in
         the ROW_H pitch, each its own piece of chrome. */
      .face {
        height: ${ROW_H - 6}px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 16px 0 12px;
        clip-path: polygon(
          0 0,
          calc(100% - 16px) 0,
          100% 16px,
          100% 100%,
          18px 100%,
          0 calc(100% - 18px)
        );
        background:
          linear-gradient(
            to bottom,
            color-mix(in srgb, var(--hp-primary) 55%, transparent) 0,
            color-mix(in srgb, var(--hp-primary) 55%, transparent) 1.5px,
            transparent 1.5px
          ),
          linear-gradient(
            105deg,
            color-mix(in srgb, var(--hp-primary-container) 40%, var(--hp-surface-container-low)) 0
              52px,
            color-mix(in srgb, var(--hp-surface-container) 96%, transparent) 52px
          );
      }
      .row[data-focal] .face {
        background:
          linear-gradient(
            to bottom,
            var(--hp-primary-bright) 0,
            var(--hp-primary-bright) 2px,
            transparent 2px
          ),
          linear-gradient(
            105deg,
            color-mix(in srgb, var(--hp-primary) 42%, var(--hp-surface-container-high)) 0 52px,
            color-mix(in srgb, var(--hp-surface-container-high) 97%, transparent) 52px
          );
        filter: drop-shadow(0 0 6px color-mix(in srgb, var(--hp-primary-bright) 45%, transparent));
      }
      .row[data-preview]:not([data-focal]) .face {
        background:
          linear-gradient(
            to bottom,
            var(--hp-secondary) 0,
            var(--hp-secondary) 1.5px,
            transparent 1.5px
          ),
          linear-gradient(
            105deg,
            color-mix(in srgb, var(--hp-secondary-container) 45%, var(--hp-surface-container-low)) 0
              52px,
            color-mix(in srgb, var(--hp-surface-container) 96%, transparent) 52px
          );
      }
      .row[data-ghost] .face {
        background: color-mix(in srgb, var(--hp-surface-container-low) 80%, transparent);
      }
      .chip {
        flex: none;
        width: 22px;
        height: 25.4px;
        clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
        background: var(--hp-outline-variant);
        position: relative;
      }
      .chip::after {
        content: "";
        position: absolute;
        inset: 1.5px;
        clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
        background: var(--hp-surface-container-lowest);
      }
      .row[data-focal] .chip {
        background: var(--hp-primary-bright);
      }
      .row[data-preview]:not([data-focal]) .chip {
        background: var(--hp-secondary);
      }
      .meta {
        min-width: 0;
      }
      /* Titles carry the list — every row must answer "which one is
         this" at a glance. The category sub is context, shown only
         on the row under inspection (focal or hover preview). */
      .name {
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sub {
        display: none;
        font-size: 0.62rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--hp-on-surface-variant);
      }
      .row[data-focal] .sub,
      .row[data-preview] .sub {
        display: block;
      }
      .row[data-focal] .sub {
        color: var(--hp-secondary);
      }

      /* Subheadings: smaller plates hanging off the prow line, a
         chamfer on the trailing corner, edge lighting on hover. */
      .kids {
        display: none;
        flex-direction: column;
        margin: 2px 0 4px 30px;
      }
      .row[data-expand] .kids {
        display: flex;
      }
      .kid {
        display: flex;
        align-items: center;
        gap: 8px;
        height: ${KID_H - 3}px;
        box-sizing: border-box;
        margin-bottom: 3px;
        padding: 0 12px;
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        clip-path: polygon(0 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%);
        background:
          linear-gradient(
            to bottom,
            color-mix(in srgb, var(--hp-outline) 50%, transparent) 0,
            color-mix(in srgb, var(--hp-outline) 50%, transparent) 1px,
            transparent 1px
          ),
          color-mix(in srgb, var(--hp-surface-container-low) 94%, transparent);
        color: var(--hp-on-surface-variant);
        cursor: pointer;
      }
      .kid:hover {
        color: var(--hp-on-surface);
        background:
          linear-gradient(
            to bottom,
            var(--hp-secondary) 0,
            var(--hp-secondary) 1.5px,
            transparent 1.5px
          ),
          color-mix(in srgb, var(--hp-surface-container) 96%, transparent);
        filter: drop-shadow(0 0 4px color-mix(in srgb, var(--hp-secondary) 40%, transparent));
      }
      .kid::before {
        content: "▸";
        color: var(--hp-secondary);
        opacity: 0;
      }
      .kid:hover::before {
        opacity: 1;
      }

      .help {
        position: absolute;
        right: 16px;
        bottom: -26px;
        font-size: 0.62rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--hp-on-surface-variant);
        opacity: 0;
        transition: opacity 200ms ease;
        pointer-events: none;
        white-space: nowrap;
      }
      :host([state="focus"]) .help {
        opacity: 0.65;
      }

      @media (prefers-reduced-motion: reduce) {
        .rail,
        .scrim,
        .kids,
        .items[data-settled] .row {
          transition: none;
        }
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.onKeydown);
    window.addEventListener("wheel", this.onWheel, { capture: true, passive: false });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.onKeydown);
    window.removeEventListener("wheel", this.onWheel, { capture: true });
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("items") || changed.has("focal")) {
      const idx = this.items.findIndex((item) => item.id === this.focal);
      this.focusPos = Math.max(0, idx);
      this.vel = 0;
      this.snapTarget = null;
      this.lastSettled = -1;
      this.previewIndex = null;
      this.pendingActivate = null;
      // A freshly-positioned track IS settled: hover previews and
      // focal clicks must work before any physics has run.
      this.settled = true;
      // The rail sizes to the list: enough for the visible span of
      // contiguous rows plus expansion headroom, within reason.
      const wanted = Math.min(this.items.length, VISIBLE_SPAN * 2) * ROW_H + 5 * KID_H + 40;
      this.railH = Math.max(220, Math.min(520, wanted));
    }
  }

  override updated(changed: PropertyValues<this>): void {
    if (changed.has("state") && changed.get("state") !== undefined) {
      this.emit("hp-hextrack-state", { state: this.state });
    }
    this.layoutRows();
  }

  /** Public scrub — consumers wiring their own inputs. */
  scrubTo(id: string): void {
    const idx = this.items.findIndex((item) => item.id === id);
    if (idx >= 0) {
      this.snapTarget = this.targetFor(idx);
      this.wake();
    }
  }

  private emit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  /** Nearest whole slot for the current position, clamped or
   * wrapped per mode. */
  private nearestIndex(): number {
    const n = this.items.length;
    if (n === 0) {
      return 0;
    }
    if (this.loop) {
      return ((Math.round(this.focusPos) % n) + n) % n;
    }
    return Math.max(0, Math.min(n - 1, Math.round(this.focusPos)));
  }

  /** Continuous focusPos target that reaches item `idx` the short
   * way round (loop) or directly (finite). */
  private targetFor(idx: number): number {
    if (!this.loop) {
      return idx;
    }
    const n = this.items.length;
    let rel = (((idx - this.focusPos) % n) + n) % n;
    if (rel > n / 2) {
      rel -= n;
    }
    return this.focusPos + rel;
  }

  /** Relative slot of item `i` against the live position — shortest
   * way round in loop mode. */
  private relOf(i: number): number {
    const n = this.items.length;
    let rel = i - this.focusPos;
    if (this.loop && n > 0) {
      rel = ((rel % n) + n) % n;
      if (rel > n / 2) {
        rel -= n;
      }
    }
    return rel;
  }

  private expandIndex(): number {
    if (!this.settled) {
      return -1;
    }
    const idx = this.previewIndex ?? this.nearestIndex();
    const item = this.items[idx];
    return item && !item.ghost && (item.subs?.length ?? 0) > 0 ? idx : -1;
  }

  private readonly onWheel = (event: WheelEvent): void => {
    if (this.state !== "focus") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const notch = event.deltaMode === 1 ? 1 : Math.min(3, Math.abs(event.deltaY) / 100);
    this.vel += Math.sign(event.deltaY) * 0.16 * notch;
    this.snapTarget = null;
    this.pendingActivate = null;
    this.previewIndex = null;
    this.wake();
  };

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      if (this.state === "focus") {
        event.stopPropagation();
        this.state = "hint";
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (this.state === "hint") {
        this.state = "focus";
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      const base = this.snapTarget ?? this.focusPos;
      const raw = Math.round(base) + step;
      this.snapTarget = this.loop ? raw : Math.max(0, Math.min(this.items.length - 1, raw));
      this.pendingActivate = null;
      this.previewIndex = null;
      this.wake();
      return;
    }
    if (this.state !== "focus") {
      return;
    }
    if (event.key === "Enter") {
      this.select(this.nearestIndex());
    }
  };

  /** Selection: auto-scroll the item focal, then activate. Click IS
   * selection — on the focal it fires at once; elsewhere the
   * magnetic scroll carries it in first. */
  private select(idx: number): void {
    const item = this.items[idx];
    if (!item || item.ghost) {
      return;
    }
    if (this.state === "hint") {
      this.state = "focus";
      return;
    }
    this.previewIndex = null;
    if (idx === this.nearestIndex() && this.settled) {
      this.emit<HpHextrackActivateDetail>("hp-hextrack-activate", { id: item.id });
      return;
    }
    this.pendingActivate = item.id;
    this.snapTarget = this.targetFor(idx);
    this.wake();
  }

  private wake(): void {
    if (!this.frame) {
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  private readonly tick = (): void => {
    this.frame = 0;
    let moving = false;
    if (this.snapTarget !== null) {
      const delta = this.snapTarget - this.focusPos;
      if (Math.abs(delta) < 0.005 || this.reduced) {
        this.focusPos = this.snapTarget;
        this.snapTarget = null;
      } else {
        this.focusPos += delta * 0.18;
        moving = true;
      }
    } else if (Math.abs(this.vel) > 0.002) {
      this.focusPos += this.vel;
      this.vel *= 0.9;
      moving = true;
    } else {
      const nearest = this.loop ? Math.round(this.focusPos) : this.nearestIndex();
      if (Math.abs(nearest - this.focusPos) > 0.003) {
        this.focusPos += (nearest - this.focusPos) * 0.18;
        moving = true;
      } else {
        this.focusPos = nearest;
      }
    }
    if (!this.loop) {
      this.focusPos = Math.max(-0.4, Math.min(this.items.length - 0.6, this.focusPos));
    }
    this.settled = !moving && this.snapTarget === null;
    this.layoutRows();
    if (moving) {
      this.frame = requestAnimationFrame(this.tick);
    } else {
      const settledIdx = this.nearestIndex();
      if (settledIdx !== this.lastSettled) {
        this.lastSettled = settledIdx;
        const item = this.items[settledIdx];
        if (item) {
          this.emit("hp-hextrack-focus", { id: item.id });
        }
      }
      if (this.pendingActivate !== null) {
        const item = this.items[settledIdx];
        if (item && item.id === this.pendingActivate) {
          this.pendingActivate = null;
          this.emit<HpHextrackActivateDetail>("hp-hextrack-activate", { id: item.id });
        } else {
          this.pendingActivate = null;
        }
      }
      // Expansion may differ once settled — re-render kids if the
      // owner changed.
      if (this.expandIndex() !== this.renderedExpand) {
        this.requestUpdate();
      }
    }
  };

  /** Position along the silhouette for a path offset, in RAIL
   * coordinates. The focal run is vertical; past ±EDGE/2 the path
   * breaks 60° and recedes toward the hexagon's off-screen body. */
  private pathPos(s: number): [number, number] {
    const cy = this.railH / 2;
    const half = EDGE / 2;
    if (Math.abs(s) <= half) {
      return [54, cy + s];
    }
    const t = Math.abs(s) - half;
    const x = 54 + t * RECEDE_X;
    const y = s > 0 ? cy + half + t * RECEDE_Y : cy - half - t * RECEDE_Y;
    return [x, y];
  }

  /** Geometry pass — positions are physics-driven, so they ride
   * inline transforms the way grid cells ride --hp-x / --hp-y. */
  private layoutRows(): void {
    const rows = this.renderRoot.querySelectorAll<HTMLElement>(".row");
    const itemsEl = this.renderRoot.querySelector<HTMLElement>(".items");
    if (itemsEl) {
      if (this.settled) {
        itemsEl.setAttribute("data-settled", "");
      } else {
        itemsEl.removeAttribute("data-settled");
      }
    }
    const focalIdx = this.nearestIndex();
    const expandIdx = this.expandIndex();
    const expandItem = expandIdx >= 0 ? this.items[expandIdx] : undefined;
    const expandRel = expandIdx >= 0 ? this.relOf(expandIdx) : null;
    /* The owner row is scaled by distance; its kids ride the SCALED
     * bottom edge at the same scale, so row and subitems form one
     * seamless hover region with no crack between them. */
    const ownerScale = expandRel !== null ? 1 - Math.min(1, Math.abs(expandRel) / 4.2) * 0.18 : 1;
    const kidsH = (expandItem?.subs?.length ?? 0) * KID_H * ownerScale;

    rows.forEach((row, i) => {
      const rel = this.relOf(i);
      if (Math.abs(rel) > VISIBLE_SPAN) {
        row.style.opacity = "0";
        row.style.pointerEvents = "none";
        return;
      }
      row.style.pointerEvents = "";
      const push = expandRel !== null && rel > expandRel + 0.01 ? kidsH : 0;
      const s = rel * ROW_H + push;
      const [x, y] = this.pathPos(s);
      const dist = Math.min(1, Math.abs(rel) / 4.2);
      const focalPop = i === focalIdx && this.settled ? -10 : 0;
      row.style.transform = `translate(${x + focalPop}px, ${y - ROW_H / 2}px) scale(${(1 - dist * 0.18).toFixed(3)})`;
      row.style.opacity = String(1 - dist * 0.45);
      row.style.zIndex = i === expandIdx ? "3" : i === focalIdx ? "2" : "1";
      if (i === focalIdx && this.settled) {
        row.setAttribute("data-focal", "");
      } else {
        row.removeAttribute("data-focal");
      }
      if (i === expandIdx && expandIdx !== focalIdx) {
        row.setAttribute("data-preview", "");
      } else {
        row.removeAttribute("data-preview");
      }
    });
  }

  /** The row element IS the hover region: its box contains the
   * face and the expanded subitems, so one rectangle carries the
   * whole group and leave only fires at its true boundary. */
  private onRowEnter(i: number): void {
    if (this.settled && this.state === "focus" && !this.items[i]?.ghost) {
      if (this.previewIndex !== i) {
        this.previewIndex = i;
        this.requestUpdate();
      }
    }
  }
  private onRowLeave(i: number): void {
    if (this.previewIndex === i) {
      this.previewIndex = null;
      this.requestUpdate();
    }
  }

  private onKidClick(owner: number, index: number): void {
    const item = this.items[owner];
    const sub = item?.subs?.[index];
    if (!item || sub === undefined) {
      return;
    }
    this.emit<HpHextrackSubDetail>("hp-hextrack-sub", { id: item.id, sub, index });
  }

  protected override firstUpdated(): void {
    this.layoutRows();
  }

  override render() {
    const expandIdx = this.expandIndex();
    this.renderedExpand = expandIdx;
    return html`
      <div class="scrim" @click=${() => (this.state = "hint")}></div>
      <div
        class="rail"
        style="top: calc(50% - ${this.railH / 2}px); height: ${this.railH}px;"
        @pointerenter=${() => {
          if (this.state === "hint") {
            this.state = "focus";
          }
        }}
        @pointerleave=${() => {
          if (this.state === "focus") {
            this.state = "hint";
          }
        }}
      >
        <div class="edge" aria-hidden="true"></div>
        <div class="items">
          ${this.items.map(
            (item, i) => html`
              <div
                class="row"
                ?data-ghost=${item.ghost}
                ?data-expand=${i === expandIdx}
                @click=${() => this.select(i)}
                @pointerenter=${() => this.onRowEnter(i)}
                @pointerleave=${() => this.onRowLeave(i)}
              >
                <div class="face">
                  <div class="chip"></div>
                  <div class="meta">
                    <div class="name">${item.label}</div>
                    <div class="sub">${item.sub ?? ""}</div>
                  </div>
                </div>
                <div class="kids">
                  ${(item.subs ?? []).map(
                    (sub, k) =>
                      html`<div
                        class="kid"
                        @click=${(event: Event) => {
                          event.stopPropagation();
                          this.onKidClick(i, k);
                        }}
                      >
                        ${sub}
                      </div>`
                  )}
                </div>
              </div>
            `
          )}
        </div>
        <div class="help">↑↓ browse · ↵ open · click selects · esc away</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-hextrack": HpHextrack;
  }
}
