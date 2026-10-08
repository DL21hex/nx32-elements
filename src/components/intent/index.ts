import { define } from "../../core/define";
import { NxIntent } from "./intent";

define("nx-intent", NxIntent);

export { NxIntent, INTENT_LABELS } from "./intent";
export { findAmount, findDate, findMonth, findTime, understand as understandIntent, withParams } from "./logic";
export type { IntentChangeDetail, IntentDef, IntentLabels, IntentMatch, IntentOption, IntentSlot, IntentSubmitDetail } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-intent": NxIntent;
  }
  interface HTMLElementEventMap {
    "nx-intent-change": CustomEvent<import("./types").IntentChangeDetail>;
    "nx-intent-submit": CustomEvent<import("./types").IntentSubmitDetail>;
  }
}
