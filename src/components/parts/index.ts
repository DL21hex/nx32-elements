import { define } from "../../core/define";
import { NxParts } from "./parts";

define("nx-parts", NxParts);

export { NxParts, PARTS_LABELS } from "./parts";
export { MAX_PARTS, shownParts } from "./logic";
export type { PartItem, PartsFormat, PartsLabels, PartsSelectDetail, ShownPart } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-parts": NxParts;
  }
  interface HTMLElementEventMap {
    "nx-parts-select": CustomEvent<import("./types").PartsSelectDetail>;
  }
}
