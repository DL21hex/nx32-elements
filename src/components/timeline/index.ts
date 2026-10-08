import { define } from "../../core/define";
import { NxTimeline } from "./timeline";

define("nx-timeline", NxTimeline);

export { NxTimeline, TIMELINE_LABELS } from "./timeline";
export { layoutMarks as timelineMarks, monthTicks as timelineMonths, timelineRange } from "./logic";
export type {
  TimelineHolidays,
  TimelineItem,
  TimelineLabels,
  TimelineLane,
  TimelineLaneKind,
  TimelineLegendItem,
  TimelineSelectDetail,
  TimelineState,
  TimelineTone,
} from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-timeline": NxTimeline;
  }
  interface HTMLElementEventMap {
    "nx-timeline-select": CustomEvent<import("./types").TimelineSelectDetail>;
  }
}
