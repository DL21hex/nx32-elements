import { define } from "../../core/define";
import { NxFlow } from "./flow";

define("nx-flow", NxFlow);

export { FLOW_LABELS, flowStageOf, NxFlow } from "./flow";
export { bottleneck, busiest, cleanStages, clockText, dotScale, fmtDuration, hourTicks, prepareItems, queueCurve, snapshot, stageAt, stageStats, toMs, toneOf } from "./logic";
export type { DotScale, FlowPrepared, FlowRow, FlowSnapshot } from "./logic";
export type { FlowItem, FlowItemDetail, FlowLabels, FlowOpenDetail, FlowStage, FlowStageDetail, FlowTime, FlowTone } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-flow": NxFlow;
  }
  interface HTMLElementEventMap {
    "nx-flow-stage": CustomEvent<import("./types").FlowStageDetail>;
    "nx-flow-item": CustomEvent<import("./types").FlowItemDetail>;
    "nx-flow-open": CustomEvent<import("./types").FlowOpenDetail>;
  }
}
