// hp-toggle-group.ts — Group of toggle buttons (single or multi-select).
//
// Single mode picks one button at a
// time (like a radio group but styled as buttons); multiple mode
// allows independent toggling per button. Slotted hp-button or
// hp-cell children carry `value` attributes — the group listens
// for clicks, tracks selection in `value` (string for single mode,
// space-separated string for multi mode), and stamps
// `aria-pressed` on the matching button(s).

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

export type HpToggleGroupType = "single" | "multiple";
export type HpToggleGroupLayout = "flex" | "honeycomb";

// Pointy-top hex row step factor = √3 / 2 ≈ 0.8660254. Matches the
// constant hp-grid uses; precomputed because CSS sqrt() isn't widely
// reliable yet.
const ROW_STEP_FACTOR = 0.8660254;

/**
 * Group of toggle buttons with single or multi-select semantics.
 * Slotted children carry `value` attributes; the group tracks
 * `value` (string for single, space-separated for multiple) and
 * stamps aria-pressed on each pressed child.
 *
 * @fires change - When selection changes. detail: { value }
 *
 * @slot - hp-button or hp-cell children with `value` attributes
 */
@customElement("hp-toggle-group")
export class HpToggleGroup extends LitElement {
  /** Selection model. `single` allows one button pressed at a time
   * (toggling on a different button unpresses the previous one).
   * `multiple` allows any combination. */
  @property({ reflect: true })
  type: HpToggleGroupType = "single";

  /** Current selection. Single mode: the chosen value as a string;
   * empty string = nothing selected. Multiple mode: space-separated
   * values. */
  @property({ reflect: true })
  value = "";

  /** Layout direction — also drives the honeycomb zigzag direction
   * when `layout="honeycomb"`. */
  @property({ reflect: true })
  orientation: "horizontal" | "vertical" = "horizontal";

  /** Visual arrangement.
   *
   * - `flex` (default) — children laid out as inline-flex with a
   * standard row / column.
   * - `honeycomb` — children positioned in a hex-grid zigzag.
   * Subsequent items add to the right (orientation=horizontal)
   * or alternate bottom-right / bottom-left (orientation=vertical).
   * Each adjacent pair shares an edge with hp-grid's stroke-overlap
   * correction so the strokes coincide into a single line. */
  @property({ reflect: true })
  layout: HpToggleGroupLayout = "flex";

  /** Disable the entire group. */
  @property({ reflect: true, type: Boolean })
  disabled = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", this.type === "single" ? "radiogroup" : "group");
    }
    this.addEventListener("click", this.handleClick);
    // Stamp q / r SYNCHRONOUSLY so they exist before Lit's first
    // render — that way when render() creates <hp-grid> in the
    // shadow, hp-grid's initial slotchange sees the q / r already
    // on each child and positions them. Deferring to a microtask
    // races with hp-grid's slot-wiring and ends up with q / r
    // arriving after hp-grid has already given up.
    this.layoutItems();
    queueMicrotask(() => this.syncChildren());
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("value") || changed.has("disabled") || changed.has("type")) {
      this.syncChildren();
    }
    if (changed.has("layout") || changed.has("orientation")) {
      this.layoutItems();
    }
  }

  /** Position children in a hex-grid zigzag when layout=honeycomb,
   * or clear any previous inline positioning when reverting to
   * layout=flex. Reads --hp-cell + --hp-hex-stroke from the first
   * child's computed style so the layout adapts to whatever cell
   * size the child uses (xs / xxs / sm / …).
   *
   * Per-item placement (i-th child, 0-indexed):
   *
   * horizontal: pair = floor(i / 2), inPair = i % 2
   * x = pair * colStep + inPair * colStep / 2
   * y = inPair * rowStep
   *
   * vertical:
   * x = (i % 2) * colStep / 2
   * y = i * rowStep
   *
   * Where colStep = cell - stroke and rowStep = colStep × √3/2,
   * matching hp-grid's stroke-overlap correction (so adjacent hex
   * outlines coincide into one shared edge instead of running
   * parallel with a hairline gap). */
  private layoutItems(): void {
    const items = this.getItems();

    if (this.layout !== "honeycomb") {
      items.forEach((item) => {
        item.style.position = "";
        item.style.left = "";
        item.style.top = "";
      });
      this.style.position = "";
      this.style.display = "";
      this.style.width = "";
      this.style.height = "";
      return;
    }

    if (items.length === 0) {
      return;
    }

    const firstStyle = getComputedStyle(items[0]!);
    const cellPx = parseFloat(firstStyle.getPropertyValue("--hp-cell")) || 32;
    const strokePx = parseFloat(firstStyle.getPropertyValue("--hp-hex-stroke")) || 1.5;
    const colStep = cellPx - strokePx;
    const rowStep = colStep * ROW_STEP_FACTOR;
    const hexH = cellPx / ROW_STEP_FACTOR;

    let maxRight = 0;
    let maxBottom = 0;

    items.forEach((item, i) => {
      item.style.position = "absolute";
      let x: number;
      let y: number;
      if (this.orientation === "vertical") {
        x = (i % 2) * (colStep / 2);
        y = i * rowStep;
      } else {
        const pair = Math.floor(i / 2);
        const inPair = i % 2;
        x = pair * colStep + inPair * (colStep / 2);
        y = inPair * rowStep;
      }
      item.style.left = `${x}px`;
      item.style.top = `${y}px`;
      maxRight = Math.max(maxRight, x + cellPx);
      maxBottom = Math.max(maxBottom, y + hexH);
    });

    this.style.position = "relative";
    this.style.display = "block";
    this.style.width = `${maxRight}px`;
    this.style.height = `${maxBottom}px`;
  }

  private getItems(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(":scope > [value]"));
  }

  private currentValues(): Set<string> {
    if (this.type === "multiple") {
      return new Set(this.value.split(/\s+/).filter(Boolean));
    }
    return new Set(this.value ? [this.value] : []);
  }

  private syncChildren(): void {
    const selected = this.currentValues();
    this.getItems().forEach((item) => {
      const v = item.getAttribute("value") ?? "";
      const isSelected = selected.has(v);
      item.setAttribute("aria-pressed", isSelected ? "true" : "false");
      if (isSelected) {
        item.setAttribute("data-pressed", "");
      } else {
        item.removeAttribute("data-pressed");
      }
      if (this.disabled) {
        item.setAttribute("aria-disabled", "true");
      } else {
        // Leave individual disabled attrs intact — only manage the
        // group-wide override above.
      }
    });
  }

  private handleClick = (event: MouseEvent): void => {
    if (this.disabled) {
      return;
    }
    // `:scope` inside `closest()` resolves to the calling element
    // itself, so `:scope > [value]` never matches an ancestor — the
    // selector is logically "a child of the click target", which is
    // not what we want. Find any value-carrying ancestor instead,
    // then verify it's a direct child of the group.
    const item = (event.target as Element).closest<HTMLElement>("[value]");
    if (!item || item.parentElement !== this) {
      return;
    }
    if (item.hasAttribute("disabled")) {
      return;
    }
    const v = item.getAttribute("value") ?? "";
    if (this.type === "single") {
      this.value = this.value === v ? "" : v;
    } else {
      const set = this.currentValues();
      if (set.has(v)) {
        set.delete(v);
      } else {
        set.add(v);
      }
      this.value = Array.from(set).join(" ");
    }
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      })
    );
  };

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-flex;
        gap: var(--hp-toggle-group-gap, var(--hp-xs));
        line-height: var(--hp-typo-body-md-line-height);
      }

      :host([orientation="vertical"]) {
        flex-direction: column;
      }

      /* layout="honeycomb" hands positioning to the wrapping
 * hp-grid in the shadow DOM (set q/r per item; hp-grid does
 * the math). The host is just a positioning context. */
      :host([layout="honeycomb"]) {
        display: inline-block;
      }

      :host([disabled]) {
        opacity: 0.5;
        pointer-events: none;
      }
    `,
  ];

  override render() {
    return html`<slot
      @slotchange=${() => {
        this.syncChildren();
        this.layoutItems();
      }}
    ></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-toggle-group": HpToggleGroup;
  }
}
