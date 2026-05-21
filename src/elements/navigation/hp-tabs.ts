// hp-tabs.ts — Tabbed content container.
//
//
// <hp-tab> renders each tab trigger; <hp-tab-panel> renders the
// content. Selection is by value — tabs and panels carry matching
// `value` attributes. Arrow keys cycle tabs in their orientation,
// Home / End jump to first / last, roving tabindex over the tabs.
// The tab list exposes role="tablist", individual tabs role="tab",
// panels role="tabpanel" with aria-labelledby linking them to
// their tab.

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

/**
 * Tabbed content container. Slotted hp-tab children render the tab
 * list; hp-tab-panel children render the panels. Arrow keys cycle
 * tabs; Home / End jump; roving tabindex. `route="hash"` syncs value
 * to URL hash.
 *
 * @fires change - When the active tab changes. detail: { value }
 *
 * @slot tab - hp-tab children for the tablist (auto-slotted)
 * @slot - hp-tab-panel children for the panels
 *
 * @csspart list - The tablist row / column
 * @csspart panels - The panels container
 */
@customElement("hp-tabs")
export class HpTabs extends LitElement {
  /** Selected tab value. Setting this activates the matching tab
   * and shows the matching panel. Default = first tab's value. */
  @property({ reflect: true })
  value = "";

  /** Tab list orientation. Horizontal arrows = Left / Right;
   * vertical = Up / Down. */
  @property({ reflect: true })
  orientation: "horizontal" | "vertical" = "horizontal";

  /** Sync value with the URL.
   *
   * - `"hash"`: reads / writes `location.hash`. Simple but collides
   * with any other consumer of the hash (e.g. heading anchors in
   * panel content, in-page TOC links). Best for standalone pages
   * where the hash is yours alone.
   * - `"query"`: reads / writes a search param (default `tab`, set
   * via `query-param` attribute). Leaves the hash free for in-page
   * anchors. Best for docs pages where panels contain headings
   * with their own slug anchors. */
  @property({ reflect: true })
  route?: "hash" | "query";

  /** Search-param name used when `route="query"`. Defaults to `tab`. */
  @property({ reflect: true, attribute: "query-param" })
  queryParam = "tab";

  override connectedCallback(): void {
    super.connectedCallback();
    // Read the URL synchronously — must happen BEFORE Lit's first
    // update cycle, otherwise the initial `value` attribute (the
    // SSR default) survives long enough for updated() to call
    // writeHash / writeQuery and overwrite the URL with the default.
    // Then applyFrom* in a later microtask would read the (now
    // overwritten) URL and pick up the default again.
    if (this.route === "hash") {
      this.applyFromHash();
    } else if (this.route === "query") {
      this.applyFromQuery();
    }
    this.ensureDefault();
    this.syncTabs();
    this.addEventListener("hp-tab-select", this.handleTabSelect as EventListener);
    this.addEventListener("keydown", this.handleKeyDown);
    if (this.route === "hash") {
      window.addEventListener("hashchange", this.handleHashChange);
    } else if (this.route === "query") {
      window.addEventListener("popstate", this.handlePopState);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("hashchange", this.handleHashChange);
    window.removeEventListener("popstate", this.handlePopState);
  }

  /** Only adopt a URL value if a tab with that value actually exists.
   * Heading anchors and other in-page hashes shouldn't blow the
   * active tab away. */
  private hasTabValue(v: string): boolean {
    return this.getTabs().some((t) => t.getAttribute("value") === v);
  }

  private applyFromHash(): void {
    const hash = window.location.hash.slice(1);
    if (hash && this.hasTabValue(hash)) {
      this.value = hash;
    }
  }

  private applyFromQuery(): void {
    const params = new URLSearchParams(window.location.search);
    const v = params.get(this.queryParam);
    if (v && this.hasTabValue(v)) {
      this.value = v;
    }
  }

  private handleHashChange = (): void => {
    if (this.route !== "hash") {
      return;
    }
    this.applyFromHash();
  };

  private handlePopState = (): void => {
    if (this.route !== "query") {
      return;
    }
    this.applyFromQuery();
  };

  private dispatchChange(value: string): void {
    this.dispatchEvent(
      new CustomEvent("hp-tabs-change", {
        bubbles: true,
        composed: true,
        detail: { value },
      })
    );
  }

  private writeHash(value: string): void {
    if (this.route !== "hash") {
      return;
    }
    const newHash = value ? `#${value}` : "";
    if (window.location.hash === newHash) {
      return;
    }
    const oldURL = window.location.href;
    const target = `${window.location.pathname}${window.location.search}${newHash}`;
    window.history.replaceState(null, "", target);
    // Manually fire hashchange so consumers that hook into URL
    // changes still get notified — replaceState by itself doesn't
    // trigger one.
    window.dispatchEvent(
      new HashChangeEvent("hashchange", {
        oldURL,
        newURL: window.location.href,
      })
    );
  }

  private writeQuery(value: string): void {
    if (this.route !== "query") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set(this.queryParam, value);
    } else {
      params.delete(this.queryParam);
    }
    const q = params.toString();
    const target = `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`;
    if (target === `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      return;
    }
    window.history.replaceState(null, "", target);
  }

  /** Direct-child lookups only — using querySelectorAll would
   * traverse into nested hp-tabs (e.g., a hp-tabs example inside the
   * ComponentDocs hp-tabs), and bubbled hp-tab-select events from
   * the inner instance would then cause the outer to mark inner
   * tabs as active, hide all outer panels, and slide its indicator
   * off-page. Scoping to immediate children keeps each instance
   * managing its own state. */
  private getTabs(): HTMLElement[] {
    return Array.from(this.children).filter(
      (el): el is HTMLElement => el.tagName.toLowerCase() === "hp-tab"
    );
  }

  private getPanels(): HTMLElement[] {
    return Array.from(this.children).filter(
      (el): el is HTMLElement => el.tagName.toLowerCase() === "hp-tab-panel"
    );
  }

  private ensureDefault(): void {
    if (this.value) {
      return;
    }
    const first = this.getTabs().find((t) => !t.hasAttribute("disabled"));
    if (first) {
      this.value = first.getAttribute("value") ?? "";
    }
  }

  private syncTabs(): void {
    const tabs = this.getTabs();
    const panels = this.getPanels();
    tabs.forEach((tab) => {
      const v = tab.getAttribute("value") ?? "";
      const active = v === this.value;
      if (active) {
        tab.setAttribute("active", "");
      } else {
        tab.removeAttribute("active");
      }
    });
    panels.forEach((panel) => {
      const v = panel.getAttribute("value") ?? "";
      if (v === this.value) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "");
      }
    });
  }

  private handleTabSelect = (event: CustomEvent<{ value: string }>): void => {
    // Only act on events originating from our own direct hp-tab
    // children — bubbled events from a nested hp-tabs would otherwise
    // hijack this instance's state.
    const source = event.composedPath()[0] as HTMLElement | undefined;
    if (!source || !this.getTabs().includes(source)) {
      return;
    }
    this.value = event.detail.value;
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      })
    );
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement;
    if (target.tagName.toLowerCase() !== "hp-tab") {
      return;
    }
    const tabs = this.getTabs().filter((t) => !t.hasAttribute("disabled"));
    if (tabs.length === 0) {
      return;
    }
    const idx = tabs.indexOf(target);
    if (idx === -1) {
      return;
    }

    const horizontal = this.orientation === "horizontal";
    const forward = horizontal ? "ArrowRight" : "ArrowDown";
    const backward = horizontal ? "ArrowLeft" : "ArrowUp";

    let nextIdx: number | null = null;
    if (event.key === forward) {
      nextIdx = idx >= tabs.length - 1 ? 0 : idx + 1;
    } else if (event.key === backward) {
      nextIdx = idx <= 0 ? tabs.length - 1 : idx - 1;
    } else if (event.key === "Home") {
      nextIdx = 0;
    } else if (event.key === "End") {
      nextIdx = tabs.length - 1;
    }

    if (nextIdx === null) {
      return;
    }
    event.preventDefault();
    const next = tabs[nextIdx];
    if (!next) {
      return;
    }
    next.focus();
    this.value = next.getAttribute("value") ?? "";
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      })
    );
  };

  /** Recompute the active-tab indicator position so the underline
   * slides under whichever tab is currently active. Called after
   * every selection change and on initial render. */
  private updateIndicator(): void {
    const list = this.renderRoot.querySelector<HTMLElement>(".list");
    if (!list) {
      return;
    }
    const active = this.getTabs().find((t) => t.hasAttribute("active"));
    if (!active) {
      list.style.setProperty("--hp-tab-indicator-width", "0px");
      return;
    }
    const tabRect = active.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    if (this.orientation === "vertical") {
      list.style.setProperty("--hp-tab-indicator-offset", `${tabRect.top - listRect.top}px`);
      list.style.setProperty("--hp-tab-indicator-width", `${tabRect.height}px`);
    } else {
      list.style.setProperty("--hp-tab-indicator-offset", `${tabRect.left - listRect.left}px`);
      list.style.setProperty("--hp-tab-indicator-width", `${tabRect.width}px`);
    }
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: block;
      }

      :host([orientation="vertical"]) .container {
        display: flex;
        flex-direction: row;
      }

      .list {
        position: relative;
        display: flex;
        gap: var(--hp-md);
        border-bottom: 1px solid var(--hp-outline-faint);
        margin: 0 0 var(--hp-lg);
        --hp-tab-indicator-offset: 0;
        --hp-tab-indicator-width: 0;
      }

      :host([orientation="vertical"]) .list {
        flex-direction: column;
        border-bottom: none;
        border-right: 1px solid var(--hp-outline-faint);
        margin: 0 var(--hp-lg) 0 0;
      }

      /* Sliding underline that follows the active tab. CSS custom
 * properties (--hp-tab-indicator-offset / -width) are written
 * by updateIndicator(); transition handles the slide between
 * positions. */
      .list::after {
        content: "";
        position: absolute;
        background: var(--hp-primary);
        transition:
          left var(--hp-duration-medium) var(--hp-ease-default),
          top var(--hp-duration-medium) var(--hp-ease-default),
          width var(--hp-duration-medium) var(--hp-ease-default),
          height var(--hp-duration-medium) var(--hp-ease-default);
      }

      :host([orientation="horizontal"]) .list::after {
        bottom: -1px;
        left: var(--hp-tab-indicator-offset);
        width: var(--hp-tab-indicator-width);
        height: 2px;
      }

      :host([orientation="vertical"]) .list::after {
        right: -1px;
        top: var(--hp-tab-indicator-offset);
        height: var(--hp-tab-indicator-width);
        width: 2px;
      }

      @media (prefers-reduced-motion: reduce) {
        .list::after {
          transition: none;
        }
      }
    `,
  ];

  override render() {
    return html`
      <div class="container">
        <div class="list" part="list" role="tablist" aria-orientation=${this.orientation}>
          <slot name="tab" @slotchange=${() => this.handleSlotChange()}></slot>
        </div>
        <div class="panels" part="panels">
          <slot @slotchange=${() => this.handleSlotChange()}></slot>
        </div>
      </div>
    `;
  }

  private handleSlotChange(): void {
    this.syncTabs();
    // Wait for layout to settle before measuring offsets.
    requestAnimationFrame(() => this.updateIndicator());
  }

  override firstUpdated(): void {
    requestAnimationFrame(() => this.updateIndicator());
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("value") || changed.has("orientation")) {
      this.syncTabs();
      requestAnimationFrame(() => this.updateIndicator());
    }
    if (changed.has("value")) {
      if (this.route === "hash") {
        this.writeHash(this.value);
      } else if (this.route === "query") {
        this.writeQuery(this.value);
      }
      this.dispatchChange(this.value);
    }
  }
}

/**
 * Single tab inside hp-tabs. role="tab"; auto-slotted into the
 * tablist via slot="tab" in connectedCallback.
 *
 * @fires hp-tab-select - When this tab is clicked. detail: { value }
 *
 * @slot - Tab label
 */
@customElement("hp-tab")
export class HpTab extends LitElement {
  @property() value = "";
  @property({ reflect: true, type: Boolean }) active = false;
  @property({ reflect: true, type: Boolean }) disabled = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "tab");
    }
    if (!this.hasAttribute("slot")) {
      this.setAttribute("slot", "tab");
    }
    this.syncAria();
    this.addEventListener("click", this.handleClick);
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has("active") || changed.has("disabled")) {
      this.syncAria();
    }
  }

  private syncAria(): void {
    this.setAttribute("aria-selected", this.active ? "true" : "false");
    if (this.disabled) {
      this.setAttribute("aria-disabled", "true");
      this.setAttribute("tabindex", "-1");
    } else {
      this.removeAttribute("aria-disabled");
      this.setAttribute("tabindex", this.active ? "0" : "-1");
    }
  }

  private handleClick = (): void => {
    if (this.disabled || this.active) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent("hp-tab-select", {
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
        display: inline-block;
        padding: var(--hp-sm) 0;
        cursor: pointer;
        font-family: var(--hp-typo-label-md-font-family);
        font-size: var(--hp-typo-label-md-font-size);
        font-weight: var(--hp-typo-label-md-font-weight);
        line-height: var(--hp-typo-label-md-line-height);
        letter-spacing: var(--hp-typo-label-md-letter-spacing);
        text-transform: uppercase;
        color: var(--hp-on-surface-variant);
        transition: color var(--hp-duration-fast) var(--hp-ease-default);
        white-space: nowrap;
      }

      :host(:hover) {
        color: var(--hp-secondary);
      }

      :host([active]) {
        color: var(--hp-primary);
      }

      :host([disabled]) {
        opacity: 0.4;
        cursor: not-allowed;
      }

      :host(:focus-visible) {
        outline: 2px solid var(--hp-focus-ring);
        outline-offset: 2px;
      }
    `,
  ];

  override render() {
    return html`<slot></slot>`;
  }
}

/**
 * Panel body inside hp-tabs. role="tabpanel"; visibility driven by
 * the parent hp-tabs via the `hidden` attribute.
 *
 * @slot - Panel content
 */
@customElement("hp-tab-panel")
export class HpTabPanel extends LitElement {
  @property() value = "";

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "tabpanel");
    }
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: block;
        /* Override hpBase line-height: 0 — panels contain real text. */
        line-height: var(--hp-typo-body-md-line-height);
      }

      :host([hidden]) {
        display: none;
      }
    `,
  ];

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-tabs": HpTabs;
    "hp-tab": HpTab;
    "hp-tab-panel": HpTabPanel;
  }
}
