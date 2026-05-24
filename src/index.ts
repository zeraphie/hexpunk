// index.ts — Hexpunk barrel export.
//
// Re-exports every <hp-*> element class. Importing this module also
// registers the custom elements via each element's side-effecting
// `@customElement` decorator, so consumers get tag registration for
// free.
//
// Element files live under category-named subfolders that mirror the
// taxonomy used in the showcase docs sidebar. The categorisation in
// the docs themselves comes from per-page frontmatter, not from this
// folder structure — folders are code organisation only.

export { HpAlertDialog } from "./elements/overlays/hp-alert-dialog.js";
export { HpAvatar } from "./elements/images/hp-avatar.js";
export { HpBackground } from "./elements/layout/hp-background.js";
export { HpBadge, type HpBadgeTone } from "./elements/status/hp-badge.js";
export { HpBond, type HpBondState } from "./elements/hp-bond.js";
export { HpButton } from "./elements/forms/hp-button.js";
export { HpCell, type HpCellVariant, type HpCellTone } from "./elements/primitives/hp-cell.js";
export { HpCheckbox } from "./elements/forms/hp-checkbox.js";
export { HpBanner, type HpBannerTone } from "./elements/messaging/hp-banner.js";
export { HpCode, type HpCodeHighlighter } from "./elements/primitives/hp-code.js";
export { HpCluster } from "./elements/layout/hp-cluster.js";
export { HpCollapsible } from "./elements/layout/hp-collapsible.js";
export { HpContextMenu } from "./elements/overlays/hp-context-menu.js";
export { HpCopy } from "./elements/primitives/hp-copy.js";
export { HpDemo } from "./elements/layout/hp-demo.js";
export { HpDialog } from "./elements/overlays/hp-dialog.js";
export { HpDropdownMenu, HpMenuItem } from "./elements/overlays/hp-dropdown-menu.js";
export { HpForm } from "./elements/forms/hp-form.js";
export {
  HpGrid,
  type HpGridBondEventDetail,
  type HpGridDropEventDetail,
  type HpGridTetherEventDetail,
  type HpGridMoveEventDetail,
  type HpGridPanEventDetail,
} from "./elements/layout/hp-grid/index.js";
export { HpHex } from "./elements/primitives/hp-hex.js";
export { HpHoverCard } from "./elements/overlays/hp-hover-card.js";
export { HpIcon } from "./elements/images/hp-icon.js";
export { HpLabel } from "./elements/forms/hp-label.js";
export { HpLatex, type HpLatexRenderer } from "./elements/primitives/hp-latex.js";
export { HpLink } from "./elements/navigation/hp-link.js";
export { HpLinkNode } from "./elements/hp-link-node.js";
export { HpMenubar } from "./elements/navigation/hp-menubar.js";
export { HpNavigationMenu, HpNavItem } from "./elements/navigation/hp-navigation-menu.js";
export { HpOption, HpSelect } from "./elements/forms/hp-select.js";
export { HpModuleHandle } from "./elements/unfold/hp-module-handle.js";
export { HpPixel, type HpPixelPosition, type HpPixelStates } from "./elements/images/hp-pixel.js";
export { HpPopover } from "./elements/overlays/hp-popover.js";
export { HpProgress, type HpProgressTone } from "./elements/loading/hp-progress.js";
export { HpRadio } from "./elements/forms/hp-radio.js";
export { HpRadioGroup } from "./elements/forms/hp-radio-group.js";
export { HpScrollArea, type HpScrollVisibility } from "./elements/layout/hp-scroll-area.js";
export {
  HpSeparator,
  type HpSeparatorOrientation,
  type HpSeparatorMark,
} from "./elements/layout/hp-separator.js";
export { HpSidebar, type HpSidebarVariant } from "./elements/layout/hp-sidebar.js";
export { HpSidebarGroup } from "./elements/layout/hp-sidebar-group.js";
export { HpSidebarItem } from "./elements/layout/hp-sidebar-item.js";
export { HpSlider } from "./elements/forms/hp-slider.js";
export { HpSpinner, type HpSpinnerTone } from "./elements/loading/hp-spinner.js";
export { HpTab, HpTabPanel, HpTabs } from "./elements/navigation/hp-tabs.js";
export { HpTag, type HpTagTone } from "./elements/status/hp-tag.js";
export { HpTether, type HpTetherSettleEventDetail } from "./elements/tether/hp-tether.js";
export { HpToast, type HpToastTone } from "./elements/messaging/hp-toast.js";
export { HpToggle } from "./elements/forms/hp-toggle.js";
export {
  HpToggleGroup,
  type HpToggleGroupType,
  type HpToggleGroupLayout,
} from "./elements/forms/hp-toggle-group.js";
export { HpToolbar } from "./elements/layout/hp-toolbar.js";
export { HpTooltip, type HpTooltipSide } from "./elements/overlays/hp-tooltip.js";
export { HpVisuallyHidden } from "./elements/primitives/hp-visually-hidden.js";
export { HpUnfoldList } from "./elements/unfold/hp-unfold-list.js";
export { HpUnfoldOverlay } from "./elements/unfold/hp-unfold-overlay.js";
export { HpUnfoldPage } from "./elements/unfold/hp-unfold-page.js";

// Lucide icons mirrored locally — see tools/build-icons.ts.
export * as icons from "./icons/index.js";
