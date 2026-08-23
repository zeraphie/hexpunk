// hp-slider.ts — Hex slider: a thin light-DOM alias over the native
// range input.
//
// Renders the hex-controls.css slider pattern (hairline track, hex
// thumb). The browser owns dragging, keyboard stepping (arrows,
// PageUp/Down, Home/End), focus, and form participation. The one
// thing the element adds visually: it keeps `--hp-slider-fill`
// current so the track reads filled up to the thumb in every engine
// (Firefox would manage alone via ::-moz-range-progress).
//
//   <hp-slider name="volume" min="0" max="100" value="42">Volume</hp-slider>

import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";

/**
 * Hex slider — light-DOM alias over `<input type="range">`. Arrows
 * step by `step`, PageUp/PageDown by the browser's larger step,
 * Home/End jump to the ends — all native. `input` / `change` bubble
 * from the inner control; the host stamps `data-dirty` /
 * `data-touched`.
 *
 * @fires input - Native input, bubbled while dragging
 * @fires change - Native change, bubbled on release
 *
 * @slot - Label text, rendered inside the wrapping label
 * @status experimental
 */
@customElement("hp-slider")
export class HpSlider extends LitElement {
  /** Lower bound. */
  @property({ type: Number })
  min = 0;

  /** Upper bound. */
  @property({ type: Number })
  max = 100;

  /** Keyboard / drag granularity. */
  @property({ type: Number })
  step = 1;

  /** Current value; mirrors the inner input. */
  @property({ type: Number })
  value = 50;

  /** Disabled — out of tab order and submission. */
  @property({ type: Boolean, reflect: true })
  disabled = false;

  /** Form field name for submission. */
  @property()
  name?: string;

  private labelNodes: Node[] = [];

  /** Light DOM on purpose — hex-controls.css styles the pattern and
   * the input participates in the form. */
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    if (this.labelNodes.length === 0 && !this.querySelector(":scope > label")) {
      this.labelNodes = [...this.childNodes];
      this.replaceChildren();
    }
    super.connectedCallback();
  }

  private get input(): HTMLInputElement | null {
    return this.querySelector(":scope > label > input");
  }

  /** Fill fraction for the track, as a percentage string. */
  private get fill(): string {
    const span = this.max - this.min;
    const ratio = span > 0 ? (this.value - this.min) / span : 0;
    return `${Math.min(100, Math.max(0, ratio * 100))}%`;
  }

  private handleInput = (event: Event): void => {
    this.value = Number((event.target as HTMLInputElement).value);
    this.toggleAttribute("data-dirty", true);
  };

  private handleFocusout = (): void => {
    this.toggleAttribute("data-touched", true);
  };

  override render() {
    return html`
      <label class="hp-slider" style="--hp-slider-fill: ${this.fill}">
        ${this.labelNodes}
        <input
          type="range"
          min=${this.min}
          max=${this.max}
          step=${this.step}
          .value=${String(this.value)}
          ?disabled=${this.disabled}
          name=${ifDefined(this.name)}
          @input=${this.handleInput}
          @focusout=${this.handleFocusout}
        />
      </label>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-slider": HpSlider;
  }
}
