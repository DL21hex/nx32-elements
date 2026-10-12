import { define } from "../../core/define";
import { NxActions } from "./actions";

define("nx-actions", NxActions);

export { ACTIONS_LABELS, NxActions } from "./actions";
export type { ActionItem, ActionsActionDetail, ActionsLabels } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-actions": NxActions;
  }
  interface HTMLElementEventMap {
    "nx-actions-action": CustomEvent<import("./types").ActionsActionDetail>;
  }
}
