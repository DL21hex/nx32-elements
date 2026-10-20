import { define } from "../../core/define";
import { NxLanes } from "./lanes";

define("nx-lanes", NxLanes);

export { LANES_LABELS, NxLanes } from "./lanes";
export { bandLabels, bandOf, cleanBands, cleanLanes, DEFAULT_BANDS, diffPlaces, dotSize, jamOf, placesOf, prepare, rankLanes, slotOf, stackOf, summarize, toneNames } from "./logic";
export type { LaneRow, LanesPrepared, LaneSummary, Places, Stack, StationSummary } from "./logic";
export type { Lane, LaneItem, LanesChangeDetail, LanesItemDetail, LanesLabels, LanesMove, LanesPlace, LanesSpotlightDetail, LanesStageDetail, LaneStage, LaneTone } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-lanes": NxLanes;
  }
  interface HTMLElementEventMap {
    "nx-lanes-stage": CustomEvent<import("./types").LanesStageDetail>;
    "nx-lanes-item": CustomEvent<import("./types").LanesItemDetail>;
    "nx-lanes-change": CustomEvent<import("./types").LanesChangeDetail>;
    "nx-lanes-spotlight": CustomEvent<import("./types").LanesSpotlightDetail>;
  }
}
