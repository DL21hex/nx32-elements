import { define } from "../../core/define";
import { NxStats } from "./stats";

define("nx-stats", NxStats);

export { NxStats, STATS_LABELS, statValue } from "./stats";
export type { StatItem, StatsLabels, StatsSelectDetail, StatTone } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-stats": NxStats;
  }
  interface HTMLElementEventMap {
    "nx-stats-select": CustomEvent<import("./types").StatsSelectDetail>;
  }
}
