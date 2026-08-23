/*
  ─ Per-visit page scripts ─

  Layout installs Astro's client router, so the document outlives
  any one page: a page's module script runs once, while the DOM
  it wired is swapped out and back in on every navigation. Wiring
  therefore belongs to a visit, not the module — redone on
  each arrival, released on each departure.
*/

/** Releases what a visit acquired that its signal can't. */
export type Teardown = () => void;

/**
 * Wires one visit of the page. `signal` aborts when the visit ends:
 * pass it to addEventListener for automatic removal and check it
 * after any await. Return a teardown for what a signal can't
 * release — engines, watchers, timers. Return nothing when the
 * page's elements aren't present: the router fires page-load for
 * every page in the document's lifetime, not just this one.
 */
export type VisitSetup = (signal: AbortSignal) => Teardown | void;

/**
 * Run `setup` on every arrival at the calling page and its teardown
 * on every departure. Arrival is the module's own execution (post-
 * parse on a full load, after the swap under the router) and each
 * astro:page-load thereafter — the two coincide for the same
 * arrival, so a live visit is never set up twice. Departure is
 * astro:before-swap, plus pagehide for real unloads.
 */
export function onPageVisit(setup: VisitSetup): void {
  let visit: { controller: AbortController; teardown: Teardown | null } | null = null;

  const arrive = (): void => {
    if (visit) {
      return;
    }
    const controller = new AbortController();
    const teardown = setup(controller.signal);
    visit = { controller, teardown: typeof teardown === "function" ? teardown : null };
  };

  const depart = (): void => {
    if (!visit) {
      return;
    }
    const { controller, teardown } = visit;
    visit = null;
    controller.abort();
    teardown?.();
  };

  document.addEventListener("astro:page-load", arrive);
  document.addEventListener("astro:before-swap", depart);
  window.addEventListener("pagehide", depart);
  arrive();
}
