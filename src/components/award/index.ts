import { define } from "../../core/define";
import { NxAward } from "./award";

define("nx-award", NxAward);

export { NxAward, AWARD_LABELS, AWARD_REASONS } from "./award";
export { buildOrders as awardOrders, changesOf as awardChanges, choicesFromValue as awardChoicesFrom, gridMove as awardGridMove, normSplits as awardNormSplits, parseEvent as parseAwardEvent, shares as awardShares, totalOf as awardTotal } from "./logic";
export type { AwardAdviseDetail, AwardAllocation, AwardChange, AwardChangeDetail, AwardChangeKind, AwardChoice, AwardCriterion, AwardEvent, AwardFilter, AwardFlag, AwardItem, AwardLabels, AwardLens, AwardNote, AwardOrder, AwardOrderLine, AwardQuote, AwardRank, AwardRecommendation, AwardScenario, AwardSplit, AwardSubmitDetail, AwardSupplier, AwardTone } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-award": NxAward;
  }
  interface HTMLElementEventMap {
    "nx-award-advise": CustomEvent<import("./types").AwardAdviseDetail>;
    "nx-award-change": CustomEvent<import("./types").AwardChangeDetail>;
    "nx-award-submit": CustomEvent<import("./types").AwardSubmitDetail>;
  }
}
