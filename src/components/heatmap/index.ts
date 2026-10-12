import { define } from "../../core/define";
import { NxHeatmap } from "./heatmap";

define("nx-heatmap", NxHeatmap);

export { NxHeatmap, HEATMAP_LABELS } from "./heatmap";
export { cleanColumns, cleanRows, cleanValues, heatDomain, intensity, mixPct, moveCell } from "./logic";
export type { HeatDomain } from "./logic";
export type { HeatColumn, HeatmapLabels, HeatmapSelectDetail, HeatPolarity, HeatRow, HeatScale } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-heatmap": NxHeatmap;
  }
  interface HTMLElementEventMap {
    "nx-heatmap-select": CustomEvent<import("./types").HeatmapSelectDetail>;
  }
}
