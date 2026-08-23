// wip-elements.ts — Registers the `wip` elements for the showcase.
//
// The library barrel exports only `done` / `experimental` elements;
// `wip` ones are visible in the showcase but not public API. The
// showcase reaches into library source here (as it already does for
// the grid and icons) so their tags still upgrade on every page.
// src/index.test.ts checks this list covers exactly the manifest's
// wip set — add or promote an element and the test walks you here.

import "../../../src/elements/forms/hp-form.ts";
import "../../../src/elements/forms/hp-label.ts";
import "../../../src/elements/forms/hp-radio-group.ts";
import "../../../src/elements/forms/hp-radio.ts";
import "../../../src/elements/forms/hp-select.ts";
import "../../../src/elements/forms/hp-slider.ts";
import "../../../src/elements/forms/hp-toggle-group.ts";
import "../../../src/elements/forms/hp-toggle.ts";
import "../../../src/elements/images/hp-avatar.ts";
import "../../../src/elements/images/hp-icon.ts";
import "../../../src/elements/layout/hp-cluster.ts";
import "../../../src/elements/layout/hp-scroll-area.ts";
import "../../../src/elements/layout/hp-toolbar.ts";
import "../../../src/elements/loading/hp-progress.ts";
import "../../../src/elements/messaging/hp-toast.ts";
import "../../../src/elements/navigation/hp-menubar.ts";
import "../../../src/elements/overlays/hp-alert-dialog.ts";
import "../../../src/elements/overlays/hp-context-menu.ts";
import "../../../src/elements/overlays/hp-dialog.ts";
import "../../../src/elements/overlays/hp-dropdown-menu.ts";
import "../../../src/elements/overlays/hp-hover-card.ts";
import "../../../src/elements/overlays/hp-popover.ts";
import "../../../src/elements/overlays/hp-tooltip.ts";
import "../../../src/elements/status/hp-badge.ts";
import "../../../src/elements/status/hp-tag.ts";
import "../../../src/elements/unfold/hp-module-handle.ts";
import "../../../src/elements/unfold/hp-unfold-list.ts";
import "../../../src/elements/unfold/hp-unfold-overlay.ts";
