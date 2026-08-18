/*
  ─ @hexpunk/core/grid ─

  The canvas grid's own entrypoint. It lives outside the root
  barrel so pixi.js can only enter a consumer's module graph
  through an import that names the grid — and even then the
  rendering engine arrives by dynamic import on first connect,
  so this module's static graph stays light.
*/
export {
  HpGrid,
  type HpGridActivateEventDetail,
  type HpGridBondEventDetail,
  type HpGridDropEventDetail,
  type HpGridMoveEventDetail,
  type HpGridTetherEventDetail,
} from "./elements/layout/hp-grid/index.js";
