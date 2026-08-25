// hp-hextrack.ts — Silhouette-riding browse overlay.
//
// The osu-song-select move for a dived page: an overlay rail at the
// host's right edge where the current category's items ride a
// HEXAGON silhouette — the flat focal run is the vertical left edge
// of a pointy-top hexagon whose body sits off-screen right, so items
// recede up-right / down-right past the 60° vertex breaks. The rail
// idles as a translucent HINT; pointer or keys bring it to FOCUS,
// which scrims the page behind (the page itself is the preview).
// Scrolling scrubs with momentum and a magnetic focal; the focal
// item reveals its subheadings in place — the difficulties pattern.

import { LitElement, css, html, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

export interface HpHextrackItem {
  id: string;
  label: string;
  sub?: string;
  /** Inert row — listed but not activatable (future slots etc). */
  ghost?: boolean;
  /** Subheadings revealed when the item is focal. */
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

/** Length of the flat focal run (px) — the silhouette's vertical
 * edge; breaks at ±half into the receding edges. */
const EDGE = 216;
/** Item spacing along the path at rest. */
const SPACING = 62;
/** Extra path length the focal expansion inserts per subheading. */
const SUB_PUSH = 30;
/** Receding-edge direction past a break: 30° from horizontal, the
 * honest continuation of a pointy-top hexagon's left edge. */
const RECEDE_X = 0.866;
const RECEDE_Y = 0.5;

/**
 * Overlay browse rail — category items ride a hexagon silhouette at
 * the host's right edge. `hint` state peeks translucently over the
 * page; pointer or arrow keys raise `focus`, which dims the page
 * behind (the page is the preview). Wheel / arrows scrub with a
 * magnetic focal; the focal item expands its subheadings in place.
 *
 * @fires hp-hextrack-state - Hint / focus flips. detail: { state }
 * @fires hp-hextrack-focus - The magnetic focal settled on an item. detail: { id }
 * @fires hp-hextrack-activate - The focal item was chosen. detail: { id }
 * @fires hp-hextrack-sub - A subheading of the focal item was chosen. detail: { id, sub, index }
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

  /** Overlay state. `hint` peeks at the edge; `focus` slides in and
   * scrims the page. Reflected so consumers can force either. */
  @property({ reflect: true })
  state: "hint" | "focus" = "hint";

  private focusPos = 0;
  private vel = 0;
  private snapTarget: number | null = null;
  private frame = 0;
  private lastSettled = -1;
  private subIndex = 0;
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

      /* The rail is a vertically-centred band, not a full-height
         column: its hover area matches what the silhouette visibly
         occupies, so chrome above and below it (and the pointer's
         way out) stays reachable. */
      .rail {
        position: absolute;
        top: calc(50% - 230px);
        right: 0;
        height: 460px;
        width: var(--hp-hextrack-width);
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

      /* The silhouette's visible edge — vertical focal run with the
         receding directions dashed past the breaks. */
      .edge {
        position: absolute;
        left: 54px;
        top: calc(50% - 108px);
        height: 216px;
        border-left: 1.5px dashed var(--hp-secondary);
        opacity: 0.5;
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

      .row {
        position: absolute;
        left: 0;
        top: 0;
        width: 320px;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        background: color-mix(in srgb, var(--hp-surface-container) 92%, transparent);
        border: 1px solid var(--hp-outline-variant);
        transform-origin: left center;
        transition: border-color 160ms ease;
        cursor: pointer;
      }
      .row[data-ghost] {
        opacity: 0.5;
        cursor: default;
      }
      .row[data-focal] {
        border-color: var(--hp-primary-bright);
        background: color-mix(in srgb, var(--hp-surface-container-high) 96%, transparent);
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
      .meta {
        min-width: 0;
      }
      .name {
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sub {
        font-size: 0.62rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--hp-on-surface-variant);
      }
      .row[data-focal] .sub {
        color: var(--hp-secondary);
      }

      .kids {
        position: absolute;
        left: 88px;
        top: 0;
        width: 286px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        opacity: 0;
        transition: opacity 200ms ease 120ms;
        pointer-events: none;
      }
      .kids[data-on] {
        opacity: 1;
        pointer-events: auto;
      }
      .kid {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 10px;
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        background: color-mix(in srgb, var(--hp-surface-container-low) 92%, transparent);
        border: 1px solid var(--hp-outline-faint);
        color: var(--hp-on-surface-variant);
        cursor: pointer;
      }
      .kid[data-active] {
        border-color: var(--hp-secondary);
        color: var(--hp-on-surface);
      }
      .kid[data-active]::before {
        content: "▸";
        color: var(--hp-secondary);
      }

      .help {
        position: absolute;
        right: 16px;
        bottom: 14px;
        font-size: 0.62rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--hp-on-surface-variant);
        opacity: 0;
        transition: opacity 200ms ease;
        pointer-events: none;
      }
      :host([state="focus"]) .help {
        opacity: 0.65;
      }

      @media (prefers-reduced-motion: reduce) {
        .rail,
        .scrim,
        .kids {
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
      this.subIndex = 0;
    }
  }

  override updated(changed: PropertyValues<this>): void {
    if (changed.has("state") && changed.get("state") !== undefined) {
      this.emit("hp-hextrack-state", { state: this.state });
    }
    this.layoutRows();
  }

  /** Public scrub — used by consumers wiring their own inputs. */
  scrubTo(id: string): void {
    const idx = this.items.findIndex((item) => item.id === id);
    if (idx >= 0) {
      this.snapTarget = idx;
      this.wake();
    }
  }

  private emit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  private focalIndex(): number {
    return Math.max(0, Math.min(this.items.length - 1, Math.round(this.focusPos)));
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
      // Arrows raise the rail from its hint — the keyboard entry the
      // hover path can't provide.
      event.preventDefault();
      if (this.state === "hint") {
        this.state = "focus";
      }
      this.snapTarget = Math.max(
        0,
        Math.min(this.items.length - 1, this.focalIndex() + (event.key === "ArrowDown" ? 1 : -1))
      );
      this.wake();
      return;
    }
    if (this.state !== "focus") {
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const subs = this.items[this.focalIndex()]?.subs ?? [];
      if (subs.length) {
        this.subIndex = Math.max(
          0,
          Math.min(subs.length - 1, this.subIndex + (event.key === "ArrowRight" ? 1 : -1))
        );
        this.layoutRows();
      }
      return;
    }
    if (event.key === "Enter") {
      this.activateFocal();
    }
  };

  private activateFocal(): void {
    const item = this.items[this.focalIndex()];
    if (!item || item.ghost) {
      return;
    }
    this.emit<HpHextrackActivateDetail>("hp-hextrack-activate", { id: item.id });
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
      // Magnetic focal: settle on the nearest whole slot.
      const nearest = this.focalIndex();
      if (Math.abs(nearest - this.focusPos) > 0.003) {
        this.focusPos += (nearest - this.focusPos) * 0.18;
        moving = true;
      } else {
        this.focusPos = nearest;
      }
    }
    this.focusPos = Math.max(-0.4, Math.min(this.items.length - 0.6, this.focusPos));
    this.layoutRows();
    if (moving) {
      this.frame = requestAnimationFrame(this.tick);
    } else {
      const settled = this.focalIndex();
      if (settled !== this.lastSettled) {
        this.lastSettled = settled;
        this.subIndex = 0;
        const item = this.items[settled];
        if (item) {
          this.emit("hp-hextrack-focus", { id: item.id });
        }
        // The kid list belongs to the settled item — re-render it.
        this.requestUpdate();
      }
    }
  };

  /** Position along the silhouette for a path offset, in RAIL
   * coordinates (the rail is a centred band, not the full host).
   * The focal run is vertical; past ±EDGE/2 the path breaks 60° and
   * recedes toward the hexagon's off-screen body. */
  private pathPos(s: number): [number, number] {
    const cy = 230;
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
    const focalIdx = this.focalIndex();
    const focal = this.items[focalIdx];
    const settled = Math.abs(this.focusPos - focalIdx) < 0.12;
    rows.forEach((row, i) => {
      const rel = i - this.focusPos;
      const kidCount = focal?.subs?.length ?? 0;
      const push = i > focalIdx ? (settled ? kidCount * SUB_PUSH : 0) : 0;
      const s = rel * SPACING + push + (rel > 0 ? 14 : rel < 0 ? -14 : 0);
      const [x, y] = this.pathPos(s);
      const dist = Math.min(1, Math.abs(rel) / 3.2);
      row.style.transform = `translate(${x}px, ${y - 20}px) scale(${(1 - dist * 0.34).toFixed(3)})`;
      row.style.opacity = String(1 - dist * 0.55);
      row.style.zIndex = i === focalIdx ? "2" : "1";
      if (i === focalIdx && settled) {
        row.setAttribute("data-focal", "");
      } else {
        row.removeAttribute("data-focal");
      }
    });
    const kids = this.renderRoot.querySelector<HTMLElement>(".kids");
    if (kids) {
      if (settled && (focal?.subs?.length ?? 0) > 0 && !focal?.ghost) {
        const [x, y] = this.pathPos(0);
        kids.style.transform = `translate(${x - 54}px, ${y + 22}px)`;
        kids.setAttribute("data-on", "");
      } else {
        kids.removeAttribute("data-on");
      }
      kids.querySelectorAll<HTMLElement>(".kid").forEach((kid, k) => {
        if (k === this.subIndex) {
          kid.setAttribute("data-active", "");
        } else {
          kid.removeAttribute("data-active");
        }
      });
    }
  }

  private onRowClick(index: number): void {
    const item = this.items[index];
    if (!item || item.ghost) {
      return;
    }
    if (this.state === "hint") {
      this.state = "focus";
      return;
    }
    if (index === this.focalIndex()) {
      this.activateFocal();
    } else {
      this.snapTarget = index;
      this.wake();
    }
  }

  private onKidClick(index: number): void {
    const item = this.items[this.focalIndex()];
    const sub = item?.subs?.[index];
    if (!item || sub === undefined) {
      return;
    }
    this.subIndex = index;
    this.layoutRows();
    this.emit<HpHextrackSubDetail>("hp-hextrack-sub", { id: item.id, sub, index });
  }

  protected override firstUpdated(): void {
    this.layoutRows();
  }

  override render() {
    const focal = this.items[this.focalIndex()];
    return html`
      <div class="scrim" @click=${() => (this.state = "hint")}></div>
      <div
        class="rail"
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
        ${this.items.map(
          (item, i) => html`
            <div class="row" ?data-ghost=${item.ghost} @click=${() => this.onRowClick(i)}>
              <div class="chip"></div>
              <div class="meta">
                <div class="name">${item.label}</div>
                <div class="sub">${item.sub ?? ""}</div>
              </div>
            </div>
          `
        )}
        <div class="kids">
          ${(focal?.subs ?? []).map(
            (sub, k) => html`<div class="kid" @click=${() => this.onKidClick(k)}>${sub}</div>`
          )}
        </div>
        <div class="help">↑↓ browse · ←→ sections · ↵ open · esc away</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-hextrack": HpHextrack;
  }
}
