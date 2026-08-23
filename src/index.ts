// index.ts — Hexpunk barrel export: the public surface.
//
// Re-exports every `done` / `experimental` element class. Importing
// this module also registers those custom elements via each
// element's side-effecting `@customElement` decorator, so consumers
// get tag registration for free.
//
// `wip` elements (see `@status` in each class's JSDoc, surfaced in
// custom-elements.json) are deliberately absent: they render in the
// showcase but are not public API. src/index.test.ts pins this
// partition against the manifest — adding an element here, or
// changing its status, without updating the other fails the test.

export { HpBackground } from "./elements/layout/hp-background/index.js";
export { HpBanner, type HpBannerTone } from "./elements/messaging/hp-banner.js";
export { HpButton } from "./elements/forms/hp-button.js";
export { HpCell, type HpCellVariant, type HpCellTone } from "./elements/primitives/hp-cell.js";
export { HpCode, type HpCodeHighlighter } from "./elements/primitives/hp-code.js";
export { HpCollapsible } from "./elements/layout/hp-collapsible.js";
export { HpCopy } from "./elements/primitives/hp-copy.js";
export { HpDemo } from "./elements/layout/hp-demo.js";
export { HpHex } from "./elements/primitives/hp-hex.js";
export { HpLatex, type HpLatexRenderer } from "./elements/primitives/hp-latex.js";
export {
  HpLayout,
  type HpLayoutBondEventDetail,
  type HpLayoutMoveEventDetail,
} from "./elements/layout/hp-layout/index.js";
export { HpLink } from "./elements/navigation/hp-link.js";
export { HpLoader, type HpLoaderTiming, type HpLoaderTone } from "./elements/loading/hp-loader.js";
export { HpNavigationMenu, HpNavItem } from "./elements/navigation/hp-navigation-menu.js";
export { HpPixel, type HpPixelPosition, type HpPixelStates } from "./elements/images/hp-pixel.js";
export { HpSidebar, type HpSidebarVariant } from "./elements/layout/hp-sidebar.js";
export { HpSidebarGroup } from "./elements/layout/hp-sidebar-group.js";
export { HpSidebarItem } from "./elements/layout/hp-sidebar-item.js";
export { HpTab, HpTabPanel, HpTabs } from "./elements/navigation/hp-tabs.js";
export { HpTether, type HpTetherSettleEventDetail } from "./elements/tether/hp-tether.js";
export { HpUnfoldPage } from "./elements/unfold/hp-unfold-page.js";

// Consumer hooks + shared sequences that aren't elements.
export { setNavigate, type HpNavigate } from "./lib/navigate.js";
export {
  beginUnfoldNavigation,
  buildUnfoldOverlay,
  computePeakScale,
  unfoldSourceColor,
  UNFOLD_STORAGE_PEAK,
  UNFOLD_STORAGE_TARGET,
  UNFOLD_VIEW_TRANSITION_NAME,
} from "./elements/unfold/departure.js";

// Lucide icons mirrored locally — see tools/build-icons.ts.
export * as icons from "./icons/index.js";
