// sitemap.ts — Hardcoded site map for the showcase nav. Each entry
// is either a leaf with a `path` + `title`, or a branch with nested
// `children`. Branches render as section headers in the side nav.
//
// Components are grouped by taxonomy (forms, status, loading, layout,
// images, navigation, overlays, messaging, primitives, tether, unfold,
// deprecated). The folder structure under showcase/src/pages/components/
// and src/elements/ matches these groupings.

export interface SitemapLeaf {
  path: string;
  title: string;
}

export interface SitemapBranch {
  title: string;
  children: SitemapNode[];
}

export type SitemapNode = SitemapLeaf | SitemapBranch;

export function isLeaf(node: SitemapNode): node is SitemapLeaf {
  return "path" in node;
}

export const SITEMAP: SitemapNode[] = [
  { path: "/", title: "Home" },
  {
    title: "Getting Started",
    children: [
      { path: "/getting-started/install", title: "Install" },
      { path: "/getting-started/concepts", title: "Concepts" },
      { path: "/getting-started/elements", title: "Elements" },
      { path: "/getting-started/prose", title: "Prose" },
    ],
  },
  {
    title: "Components",
    children: [
      {
        title: "Primitives",
        children: [
          { path: "/components/primitives/hp-cell", title: "hp-cell" },
          { path: "/components/primitives/hp-code", title: "hp-code" },
          { path: "/components/primitives/hp-hex", title: "hp-hex" },
          { path: "/components/primitives/hp-latex", title: "hp-latex" },
          { path: "/components/primitives/hp-visually-hidden", title: "hp-visually-hidden" },
        ],
      },
      {
        title: "Forms",
        children: [
          { path: "/components/forms/hp-button", title: "hp-button" },
          { path: "/components/forms/hp-checkbox", title: "hp-checkbox" },
          { path: "/components/forms/hp-form", title: "hp-form" },
          { path: "/components/forms/hp-label", title: "hp-label" },
          { path: "/components/forms/hp-radio", title: "hp-radio" },
          { path: "/components/forms/hp-select", title: "hp-select" },
          { path: "/components/forms/hp-slider", title: "hp-slider" },
          { path: "/components/forms/hp-toggle", title: "hp-toggle" },
          { path: "/components/forms/hp-toggle-group", title: "hp-toggle-group" },
        ],
      },
      {
        title: "Status",
        children: [
          { path: "/components/status/hp-badge", title: "hp-badge" },
          { path: "/components/status/hp-tag", title: "hp-tag" },
        ],
      },
      {
        title: "Loading",
        children: [
          { path: "/components/loading/hp-progress", title: "hp-progress" },
          { path: "/components/loading/hp-spinner", title: "hp-spinner" },
        ],
      },
      {
        title: "Layout",
        children: [
          { path: "/components/layout/hp-background", title: "hp-background" },
          { path: "/components/layout/hp-cluster", title: "hp-cluster" },
          { path: "/components/layout/hp-collapsible", title: "hp-collapsible" },
          { path: "/components/layout/hp-demo", title: "hp-demo" },
          { path: "/components/layout/hp-grid", title: "hp-grid" },
          { path: "/components/layout/hp-scroll-area", title: "hp-scroll-area" },
          { path: "/components/layout/hp-separator", title: "hp-separator" },
          { path: "/components/layout/hp-sidebar", title: "hp-sidebar" },
          { path: "/components/layout/hp-toolbar", title: "hp-toolbar" },
        ],
      },
      {
        title: "Images",
        children: [
          { path: "/components/images/hp-avatar", title: "hp-avatar" },
          { path: "/components/images/hp-icon", title: "hp-icon" },
          { path: "/components/images/hp-pixel", title: "hp-pixel" },
        ],
      },
      {
        title: "Navigation",
        children: [
          { path: "/components/navigation/hp-link", title: "hp-link" },
          { path: "/components/navigation/hp-menubar", title: "hp-menubar" },
          { path: "/components/navigation/hp-navigation-menu", title: "hp-navigation-menu" },
          { path: "/components/navigation/hp-tabs", title: "hp-tabs" },
        ],
      },
      {
        title: "Overlays",
        children: [
          { path: "/components/overlays/hp-alert-dialog", title: "hp-alert-dialog" },
          { path: "/components/overlays/hp-context-menu", title: "hp-context-menu" },
          { path: "/components/overlays/hp-dialog", title: "hp-dialog" },
          { path: "/components/overlays/hp-dropdown-menu", title: "hp-dropdown-menu" },
          { path: "/components/overlays/hp-hover-card", title: "hp-hover-card" },
          { path: "/components/overlays/hp-popover", title: "hp-popover" },
          { path: "/components/overlays/hp-tooltip", title: "hp-tooltip" },
        ],
      },
      {
        title: "Messaging",
        children: [
          { path: "/components/messaging/hp-banner", title: "hp-banner" },
          { path: "/components/messaging/hp-toast", title: "hp-toast" },
        ],
      },
      {
        title: "Tether",
        children: [{ path: "/components/tether/hp-tether", title: "hp-tether" }],
      },
      {
        title: "Unfold",
        children: [
          { path: "/components/unfold/hp-module-handle", title: "hp-module-handle" },
          { path: "/components/unfold/hp-unfold-list", title: "hp-unfold-list" },
          { path: "/components/unfold/hp-unfold-overlay", title: "hp-unfold-overlay" },
          { path: "/components/unfold/hp-unfold-page", title: "hp-unfold-page" },
        ],
      },
      {
        title: "Deprecated",
        children: [
          { path: "/components/deprecated/hp-bond", title: "hp-bond" },
          { path: "/components/deprecated/hp-link-node", title: "hp-link-node" },
        ],
      },
    ],
  },
  { path: "/palette", title: "Palette" },
  { path: "/animations", title: "Animations" },
  { path: "/changelog", title: "Releases" },
];
