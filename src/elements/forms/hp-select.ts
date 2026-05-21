// hp-select.ts — Custom listbox select.
//
// Trigger button shows the current value; click opens a popover
// with slotted hp-option children. Arrow keys move the focused
// option, Enter / Space activate, Escape dismisses, type-ahead
// jumps to options starting with the typed letter. Uncontrolled mode —
// internal value state, fires `change`.
//
// Authoring:
//
// <hp-select value="medium" placeholder="Choose a size">
// <hp-option value="small">small</hp-option>
// <hp-option value="medium">medium</hp-option>
// <hp-option value="large">large</hp-option>
// </hp-select>

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { onEscape, onOutsidePointer, positionFloating } from "../../lib/floating.js";
import { hpBase } from "../../styles/hp-base.js";

/**
 * Custom listbox select — trigger button + popover list of options.
 * role="combobox" on the trigger, role="listbox" on the popover,
 * role="option" on each child.
 *
 * @fires change - When the value changes via user input. detail: { value }
 * @fires hp-select-open - When the listbox opens
 * @fires hp-select-close - When the listbox closes
 *
 * @slot - hp-option children
 *
 * @csspart trigger - The trigger button
 * @csspart listbox - The popover listbox
 */
@customElement("hp-select")
export class HpSelect extends LitElement {
  /** Currently selected value. Setting programmatically activates
   * the matching option (or empty when no match). */
  @property({ reflect: true })
  value = "";

  /** Placeholder shown on the trigger when no value is selected. */
  @property()
  placeholder = "Select…";

  /** Disabled — blocks toggle and removes from tab order. */
  @property({ reflect: true, type: Boolean })
  disabled = false;

  /** Optional form name. */
  @property()
  name?: string;

  @state() private open = false;
  @state() private positionStyle = "";

  private triggerEl: HTMLElement | null = null;
  private disposeOutside: (() => void) | null = null;
  private disposeEscape: (() => void) | null = null;
  private typeBuffer = "";
  private typeBufferTimer: number | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("hp-option-select", this.handleOptionSelect as EventListener);
    this.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("resize", this.handleViewportChange);
    window.addEventListener("scroll", this.handleViewportChange, true);
    queueMicrotask(() => this.syncOptions());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.handleViewportChange);
    window.removeEventListener("scroll", this.handleViewportChange, true);
    this.disposeOutside?.();
    this.disposeEscape?.();
    if (this.typeBufferTimer !== null) {
      window.clearTimeout(this.typeBufferTimer);
    }
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("value")) {
      this.syncOptions();
    }
  }

  private getOptions(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(":scope > hp-option"));
  }

  private syncOptions(): void {
    const options = this.getOptions();
    options.forEach((opt) => {
      const v = opt.getAttribute("value") ?? "";
      const selected = v === this.value;
      opt.setAttribute("aria-selected", selected ? "true" : "false");
      if (selected) {
        opt.setAttribute("selected", "");
      } else {
        opt.removeAttribute("selected");
      }
    });
  }

  private selectedLabel(): string {
    const opt = this.getOptions().find((o) => o.getAttribute("value") === this.value);
    return opt ? (opt.textContent ?? "").trim() : "";
  }

  private handleTriggerClick = (): void => {
    if (this.disabled) {
      return;
    }
    this.toggle();
  };

  private handleOptionSelect = (event: CustomEvent<{ value: string }>): void => {
    this.value = event.detail.value;
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      })
    );
    this.close();
  };

  private handleViewportChange = (): void => {
    if (this.open) {
      this.reposition();
    }
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled) {
      return;
    }
    if (!this.open) {
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "ArrowDown" ||
        event.key === "ArrowUp"
      ) {
        event.preventDefault();
        this.show();
      }
      return;
    }
    const options = this.getOptions().filter((o) => !o.hasAttribute("disabled"));
    if (options.length === 0) {
      return;
    }
    const focused = (document.activeElement as HTMLElement) ?? null;
    const idx = focused ? options.indexOf(focused) : -1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      options[idx >= options.length - 1 ? 0 : idx + 1]?.focus();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      options[idx <= 0 ? options.length - 1 : idx - 1]?.focus();
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      options[0]?.focus();
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      options[options.length - 1]?.focus();
      return;
    }
    if (event.key === "Tab") {
      this.close();
      return;
    }
    // Type-ahead — jump to the next option whose label starts with
    // the typed sequence. Buffer resets after 500ms of silence.
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (this.typeBufferTimer !== null) {
        window.clearTimeout(this.typeBufferTimer);
      }
      this.typeBuffer += event.key.toLowerCase();
      this.typeBufferTimer = window.setTimeout(() => {
        this.typeBuffer = "";
        this.typeBufferTimer = null;
      }, 500);
      const match = options.find((o) =>
        (o.textContent ?? "").trim().toLowerCase().startsWith(this.typeBuffer)
      );
      match?.focus();
    }
  };

  /** Open the listbox. */
  public show(): void {
    if (this.disabled || this.open) {
      return;
    }
    this.open = true;
    this.disposeOutside = onOutsidePointer(this, () => this.close());
    this.disposeEscape = onEscape(() => this.close());
    this.dispatchEvent(new CustomEvent("hp-select-open", { bubbles: true, composed: true }));
    requestAnimationFrame(() => {
      this.reposition();
      // Focus the selected option (or the first if nothing selected).
      const options = this.getOptions().filter((o) => !o.hasAttribute("disabled"));
      const focused = options.find((o) => o.getAttribute("value") === this.value);
      (focused ?? options[0])?.focus();
    });
  }

  /** Close the listbox. */
  public close(): void {
    if (!this.open) {
      return;
    }
    this.open = false;
    this.disposeOutside?.();
    this.disposeOutside = null;
    this.disposeEscape?.();
    this.disposeEscape = null;
    this.dispatchEvent(new CustomEvent("hp-select-close", { bubbles: true, composed: true }));
    this.triggerEl?.focus();
  }

  /** Toggle open / closed. */
  public toggle(): void {
    if (this.open) {
      this.close();
    } else {
      this.show();
    }
  }

  private reposition(): void {
    if (!this.triggerEl) {
      return;
    }
    const listbox = this.renderRoot.querySelector<HTMLElement>(".listbox");
    if (!listbox) {
      return;
    }
    const anchorRect = this.triggerEl.getBoundingClientRect();
    const floatingRect = listbox.getBoundingClientRect();
    const result = positionFloating(
      anchorRect,
      { width: floatingRect.width, height: floatingRect.height },
      { width: window.innerWidth, height: window.innerHeight },
      { side: "bottom", align: "start", offset: 4 }
    );
    this.positionStyle = `left: ${result.x}px; top: ${result.y}px; min-width: ${anchorRect.width}px;`;
  }

  override firstUpdated(): void {
    this.triggerEl = this.renderRoot.querySelector<HTMLElement>(".trigger");
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
        line-height: var(--hp-typo-body-md-line-height);
      }

      .trigger {
        display: inline-flex;
        align-items: center;
        gap: var(--hp-sm);
        padding: var(--hp-xs) var(--hp-sm);
        background: var(--hp-surface-container);
        border: 1px solid var(--hp-outline-variant);
        color: var(--hp-on-surface);
        font: inherit;
        cursor: pointer;
        min-width: 160px;
        text-align: left;
        transition: border-color var(--hp-duration-fast) var(--hp-ease-default);
      }

      .trigger:hover:not([disabled]),
      .trigger:focus-visible:not([disabled]) {
        border-color: var(--hp-secondary);
        outline: none;
      }

      .trigger:focus-visible:not([disabled]) {
        outline: 2px solid var(--hp-focus-ring);
        outline-offset: 2px;
      }

      .trigger[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .trigger .label {
        flex: 1 1 auto;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .trigger .placeholder {
        color: var(--hp-on-surface-variant);
      }

      .trigger .chevron {
        flex: 0 0 auto;
        width: 12px;
        height: 12px;
        color: var(--hp-on-surface-variant);
      }

      .listbox {
        position: fixed;
        z-index: var(--hp-layer-toast, 80);
        background: var(--hp-surface-container-high);
        color: var(--hp-on-surface);
        border: 1px solid var(--hp-outline-variant);
        padding: var(--hp-xs) 0;
        max-height: 280px;
        overflow-y: auto;
        font-size: var(--hp-typo-body-sm-font-size);
        line-height: var(--hp-typo-body-sm-line-height);
      }
    `,
  ];

  override render() {
    const label = this.selectedLabel();
    return html`
      <button
        class="trigger"
        type="button"
        part="trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded=${this.open ? "true" : "false"}
        ?disabled=${this.disabled}
        @click=${this.handleTriggerClick}
      >
        <span class=${`label ${label ? "" : "placeholder"}`}> ${label || this.placeholder} </span>
        <svg class="chevron" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M3 4.5 L6 7.5 L9 4.5"
            stroke="currentColor"
            stroke-width="1.5"
            fill="none"
            stroke-linecap="square"
          ></path>
        </svg>
      </button>
      <div
        class="listbox"
        part="listbox"
        role="listbox"
        ?hidden=${!this.open}
        style=${this.positionStyle}
      >
        <slot @slotchange=${() => this.syncOptions()}></slot>
      </div>
    `;
  }
}

/**
 * Single option inside hp-select. role="option"; Enter / Space
 * activate; emits hp-option-select.
 *
 * @fires hp-option-select - When activated. detail: { value }
 *
 * @slot - Option label
 */
@customElement("hp-option")
export class HpOption extends LitElement {
  /** Value emitted to the parent hp-select. */
  @property()
  value = "";

  /** Selected — auto-set by parent hp-select. */
  @property({ reflect: true, type: Boolean })
  selected = false;

  /** Disabled — blocks activation. */
  @property({ reflect: true, type: Boolean })
  disabled = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "option");
    }
    this.syncTabindex();
    this.addEventListener("click", this.handleClick);
    this.addEventListener("keydown", this.handleKeyDown);
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("disabled")) {
      this.syncTabindex();
    }
  }

  private syncTabindex(): void {
    this.setAttribute("tabindex", this.disabled ? "-1" : "0");
    if (this.disabled) {
      this.setAttribute("aria-disabled", "true");
    } else {
      this.removeAttribute("aria-disabled");
    }
  }

  private handleClick = (event: MouseEvent): void => {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    this.emitSelect();
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.emitSelect();
    }
  };

  private emitSelect(): void {
    this.dispatchEvent(
      new CustomEvent("hp-option-select", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      })
    );
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: block;
        padding: var(--hp-xs) var(--hp-md);
        cursor: pointer;
        line-height: var(--hp-typo-body-sm-line-height);
        color: var(--hp-on-surface);
        transition: background var(--hp-duration-fast) var(--hp-ease-default);
        user-select: none;
      }

      :host(:hover),
      :host(:focus-visible) {
        background: var(--hp-surface-container-highest);
        outline: none;
      }

      :host(:focus-visible) {
        color: var(--hp-primary);
      }

      :host([selected]) {
        color: var(--hp-primary);
      }

      :host([disabled]) {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ];

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-select": HpSelect;
    "hp-option": HpOption;
  }
}
