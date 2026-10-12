import { define } from "../../core/define";
import { NxBars } from "./bars";

define("nx-bars", NxBars);

export { NxBars, BARS_LABELS } from "./bars";
export { barPct, cleanBars, layoutBars } from "./logic";
export type { BarsLayout } from "./logic";
export type { BarItem, BarSeries, BarsLabels, BarsOrientation, BarsRamp, BarsSelectDetail } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-bars": NxBars;
  }
  interface HTMLElementEventMap {
    "nx-bars-select": CustomEvent<import("./types").BarsSelectDetail>;
  }
}
