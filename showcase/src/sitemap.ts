// sitemap.ts — Hardcoded site map for the showcase nav. Each entry
// is either a leaf with a `path` + `title`, or a branch with nested
// `children`. Branches render as section headers in the side nav.
//
// Components are grouped by the seven-category taxonomy (hex core,
// typography, forms, feedback, layout, navigation, overlays); the
// folder structure under showcase/src/pages/components/ matches.
// Native HTML elements file into the same categories, labelled by
// bare tag (`<details>`) so native-ness is visible in the sidebar.
// Within a category: native entries first, then hp-* components,
// each set alphabetical.

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
  {
    title: "Getting Started",
    children: [
      { path: "/getting-started/install", title: "Install" },
      { path: "/getting-started/concepts", title: "Concepts" },
    ],
  },
  {
    title: "Components",
    children: [
      {
        title: "Hex Core",
        children: [
          { path: "/components/hex-core/hp-background", title: "hp-background" },
          { path: "/components/hex-core/hp-cell", title: "hp-cell" },
          { path: "/components/hex-core/hp-cluster", title: "hp-cluster" },
          { path: "/components/hex-core/hp-grid", title: "hp-grid" },
          { path: "/components/hex-core/hp-hex", title: "hp-hex" },
          { path: "/components/hex-core/hp-layout", title: "hp-layout" },
          { path: "/components/hex-core/hp-pixel", title: "hp-pixel" },
          { path: "/components/hex-core/hp-tether", title: "hp-tether" },
        ],
      },
      {
        title: "Typography",
        children: [
          { path: "/components/typography/text", title: "HTML text" },
          { path: "/components/typography/hp-code", title: "hp-code" },
          { path: "/components/typography/hp-copy", title: "hp-copy" },
          { path: "/components/typography/hp-latex", title: "hp-latex" },
          { path: "/components/typography/hp-link", title: "hp-link" },
        ],
      },
      {
        title: "Forms",
        children: [
          { path: "/components/forms/fields", title: "form fields" },
          { path: "/components/forms/hp-button", title: "hp-button" },
          { path: "/components/forms/hp-checkbox", title: "hp-checkbox" },
          { path: "/components/forms/hp-form", title: "hp-form" },
          { path: "/components/forms/hp-radio", title: "hp-radio" },
          { path: "/components/forms/hp-select", title: "hp-select" },
          { path: "/components/forms/hp-slider", title: "hp-slider" },
          { path: "/components/forms/hp-toggle", title: "hp-toggle" },
        ],
      },
      {
        title: "Feedback",
        children: [
          { path: "/components/feedback/progress", title: "<progress>" },
          { path: "/components/feedback/hp-badge", title: "hp-badge" },
          { path: "/components/feedback/hp-banner", title: "hp-banner" },
          { path: "/components/feedback/hp-loader", title: "hp-loader" },
          { path: "/components/feedback/hp-toast", title: "hp-toast" },
        ],
      },
      {
        title: "Layout",
        children: [
          { path: "/components/layout/details", title: "<details>" },
          { path: "/components/layout/hr", title: "<hr>" },
          { path: "/components/layout/table", title: "<table>" },
          { path: "/components/layout/hp-collapsible", title: "hp-collapsible" },
          { path: "/components/layout/hp-demo", title: "hp-demo" },
          { path: "/components/layout/hp-scroll-area", title: "hp-scroll-area" },
          { path: "/components/layout/hp-toolbar", title: "hp-toolbar" },
        ],
      },
      {
        title: "Navigation",
        children: [
          { path: "/components/navigation/hp-menubar", title: "hp-menubar" },
          { path: "/components/navigation/hp-navigation-menu", title: "hp-navigation-menu" },
          { path: "/components/navigation/hp-sidebar", title: "hp-sidebar" },
          { path: "/components/navigation/hp-tabs", title: "hp-tabs" },
          { path: "/components/navigation/hp-unfold-page", title: "hp-unfold-page" },
        ],
      },
      {
        title: "Overlays",
        children: [
          { path: "/components/overlays/dialog", title: "<dialog>" },
          { path: "/components/overlays/hp-dialog", title: "hp-dialog" },
          { path: "/components/overlays/hp-dropdown-menu", title: "hp-dropdown-menu" },
          { path: "/components/overlays/hp-module-handle", title: "hp-module-handle" },
          { path: "/components/overlays/hp-popover", title: "hp-popover" },
          { path: "/components/overlays/hp-tooltip", title: "hp-tooltip" },
          { path: "/components/overlays/hp-unfold-list", title: "hp-unfold-list" },
          { path: "/components/overlays/hp-unfold-overlay", title: "hp-unfold-overlay" },
        ],
      },
    ],
  },
  { path: "/palette", title: "Palette" },
  { path: "/animations", title: "Animations" },
  { path: "/changelog", title: "Releases" },
];
