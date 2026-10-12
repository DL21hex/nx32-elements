import { define } from "../../core/define";
import { NxAlerts } from "./alerts";

define("nx-alerts", NxAlerts);

export { ALERTS_LABELS, NxAlerts, ALERT_SEVERITIES, severityOf, sortAlerts } from "./alerts";
export type { AlertAction, AlertItem, AlertsActionDetail, AlertSeverity, AlertsLabels } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-alerts": NxAlerts;
  }
  interface HTMLElementEventMap {
    "nx-alerts-action": CustomEvent<import("./types").AlertsActionDetail>;
  }
}
