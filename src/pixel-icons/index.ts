// pixel-icons — Built-in pixel-art state sets.
//
// Each icon is a named record of same-length HpPixelPosition arrays,
// optionally with a bundled palette (the arrow morphs fade their
// parked corner pixels to transparent). The registry keys are the
// values `<hp-pixel type="…">` accepts; explicit `.states` /
// `.palette` still win over `type` for consumer-supplied art.

import type { HpPixelStates } from "../elements/images/hp-pixel.js";
import { dropside, palette as dropsidePalette } from "./dropside.js";
import { expandable, palette as expandablePalette } from "./expandable.js";
import { menu } from "./menu.js";

export { dropside, expandable, menu };

export interface PixelIcon {
  states: HpPixelStates;
  palette?: string[];
}

export const pixelIcons: Record<string, PixelIcon> = {
  menu: { states: menu },
  expandable: { states: expandable, palette: expandablePalette },
  dropside: { states: dropside, palette: dropsidePalette },
};
