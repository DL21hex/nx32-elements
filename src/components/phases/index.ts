import { define } from "../../core/define";
import { NxPhases } from "./phases";

define("nx-phases", NxPhases);

export { NxPhases, PHASES_LABELS } from "./phases";
export { axisTicks, axisTotal, cleanPhases, dayEnd, dayStart, parseTicks, phaseProgress, tickPos } from "./logic";
export type { Phase, PhaseProgress, PhasesFormat, PhasesLabels } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-phases": NxPhases;
  }
}
