import { define } from "../../core/define";
import { NxDate } from "./date";

define("nx-date", NxDate);

export { NxDate, DATE_LABELS } from "./date";
export { blockedReason as dateBlockedReason, cleanUnavailable as cleanDateUnavailable, parseDay as parseDayText, writeDay as formatDayText } from "./logic";
export type { DateChangeDetail, DateLabels, DateUnavailable, DateUnavailableDay } from "./types";

// `nx-open-change` ya está en `HTMLElementEventMap` (lo declara `<nx-sidemenu>` con el mismo `{open}`).
declare global {
  interface HTMLElementTagNameMap {
    "nx-date": NxDate;
  }
  interface HTMLElementEventMap {
    "nx-date-change": CustomEvent<import("./types").DateChangeDetail>;
  }
}
