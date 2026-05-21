// hp-progress.ts — Determinate progress indicator.
//
// Horizontal track with a fill showing the current value as a
// percentage of (max - min).
// role="progressbar", aria-valuemin / max / now, plus an
// `indeterminate` mode that hides the value and animates a sliding
// fill ribbon instead.
//
// For indeterminate loading states without a known duration, prefer
// hp-spinner. Use hp-progress when the operation has knowable
// progress (file upload, multi-step task, download with a percentage).

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { hpBase } from "../../styles/hp-base.js";

export type HpProgressTone = "neutral" | "positive" | "warn" | "alert" | "error";

/**
 * Determinate progress indicator. role="progressbar";
 * aria-valuemin / max / now reflect state. `indeterminate` mode
 * animates a sliding ribbon when the percent isn't known.
 *
 * @csspart track - The track that the fill sits inside
 * @csspart fill - The filled portion (or sliding ribbon when indeterminate)
 */
@customElement("hp-progress")
export class HpProgress extends LitElement {
  /** Lower bound. Default 0. */
  @property({ type: Number })
  min = 0;

  /** Upper bound. Default 100. */
  @property({ type: Number })
  max = 100;

  /** Current value. Clamped to [min, max]. Ignored when
   * `indeterminate` is set. */
  @property({ type: Number, reflect: true })
  value = 0;

  /** Indeterminate mode — animates a sliding ribbon, hides the
   * numeric value from assistive tech. Use when progress is
   * knowable but a specific number isn't available. */
  @property({ reflect: true, type: Boolean })
  indeterminate = false;

  /** Semantic tone for the fill — neutral (primary), positive, warn,
   * alert, error. */
  @property({ reflect: true })
  tone: HpProgressTone = "neutral";

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "progressbar");
    }
    this.syncAria();
  }

  override updated(changed: Map<string, unknown>): void {
    if (
      changed.has("value") ||
      changed.has("min") ||
      changed.has("max") ||
      changed.has("indeterminate")
    ) {
      this.syncAria();
    }
  }

  private syncAria(): void {
    this.setAttribute("aria-valuemin", String(this.min));
    this.setAttribute("aria-valuemax", String(this.max));
    if (this.indeterminate) {
      this.removeAttribute("aria-valuenow");
    } else {
      this.setAttribute("aria-valuenow", String(this.value));
    }
  }

  static override styles = [
    hpBase,
    css`
      :host {
        display: inline-block;
        width: 200px;
        --hp-progress-fill: var(--hp-primary);
      }

      :host([tone="positive"]) {
        --hp-progress-fill: var(--hp-secondary);
      }
      :host([tone="warn"]) {
        --hp-progress-fill: var(--hp-warn);
      }
      :host([tone="alert"]) {
        --hp-progress-fill: var(--hp-alert);
      }
      :host([tone="error"]) {
        --hp-progress-fill: var(--hp-error);
      }

      .track {
        position: relative;
        width: 100%;
        height: 6px;
        background: var(--hp-outline-variant);
        /* Hex-point end caps instead of border-radius. The polygon
 * takes each end and angles it to a centre point — same
 * shape you'd get chopping a pointy-top hex down the middle
 * (here rotated 90° so the points face left + right). Cap
 * width is height / √3 so the caps land at a regular 60°
 * hex-point angle. */
        clip-path: polygon(
          0 50%,
          3.464px 0,
          calc(100% - 3.464px) 0,
          100% 50%,
          calc(100% - 3.464px) 100%,
          3.464px 100%
        );
        /* clip-path on the parent clips descendants too, so the
 * .fill picks up the hex caps without its own clip rule. */
      }

      .fill {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: var(--hp-progress-fill);
        transition: width var(--hp-duration-medium) var(--hp-ease-default);
      }

      :host([indeterminate]) .fill {
        width: 30%;
        animation: hp-progress-slide 1.4s ease-in-out infinite;
        transition: none;
      }

      @keyframes hp-progress-slide {
        0% {
          left: -30%;
        }
        100% {
          left: 100%;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        :host([indeterminate]) .fill {
          animation-duration: 5s;
        }
      }
    `,
  ];

  override render() {
    const range = this.max - this.min;
    const ratio = range === 0 ? 0 : (this.value - this.min) / range;
    const pct = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    return html`
      <div class="track" part="track">
        <div class="fill" part="fill" style=${this.indeterminate ? "" : `width: ${pct}`}></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hp-progress": HpProgress;
  }
}
