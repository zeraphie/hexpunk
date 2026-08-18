// navigate.ts — Library-wide navigation delegate.
//
// Every hexpunk element that navigates (hp-unfold-page, hp-nav-item,
// …) routes through hpNavigate. The default is a full document
// navigation; a consumer with a client-side router registers its own
// function ONCE via setNavigate and every element follows it —
// navigations become same-document, module state and custom-element
// definitions survive, and the router's own transitions drive the
// animation keyframes.

/** Navigation delegate signature — receives the `href` the element
 * was activated with. */
export type HpNavigate = (href: string) => void;

let delegate: HpNavigate | null = null;

/** Register a navigation delegate for every navigating hexpunk
 * element. Pass null to restore the default full-document
 * navigation (`window.location.href`). */
export function setNavigate(fn: HpNavigate | null): void {
  delegate = fn;
}

/** Navigate via the registered delegate, or the default full
 * document navigation when none is registered. */
export function hpNavigate(href: string): void {
  if (delegate) {
    delegate(href);
  } else {
    window.location.href = href;
  }
}
