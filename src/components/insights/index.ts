import { define } from "../../core/define";
import { NxInsights } from "./insights";

define("nx-insights", NxInsights);

export { emphasis, INSIGHTS_LABELS, NxInsights } from "./insights";
export type { EmphasisPart, InsightAction, InsightIcon, InsightItem, InsightsActionDetail, InsightsLabels, InsightTone } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-insights": NxInsights;
  }
  interface HTMLElementEventMap {
    "nx-insights-action": CustomEvent<import("./types").InsightsActionDetail>;
  }
}
