import { define } from "../../core/define";
import { NxTracker } from "./tracker";

define("nx-tracker", NxTracker);

export { NxTracker, TRACKER_LABELS } from "./tracker";
export type { TrackerAction, TrackerDays, TrackerHolidays, TrackerItem, TrackerLabels, TrackerSelectDetail, TrackerStep, TrackerTone } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-tracker": NxTracker;
  }
  interface HTMLElementEventMap {
    "nx-tracker-select": CustomEvent<import("./types").TrackerSelectDetail>;
  }
}
