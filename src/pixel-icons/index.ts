// pixel-icons — Built-in pixel-art state sets.
//
// Each icon is a named record of same-length HpPixelPosition arrays.
// The registry keys are the values `<hp-pixel type="…">` accepts;
// explicit `.states` still wins over `type` for consumer-supplied
// art.

import type { HpPixelStates } from "../elements/images/hp-pixel.js";
import { expandable } from "./expandable.js";
import { menu } from "./menu.js";

export { expandable, menu };

export const pixelIcons: Record<string, HpPixelStates> = {
  menu,
  expandable,
};
