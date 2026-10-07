import { define } from "../../core/define";
import { NxField } from "./field";

define("nx-field", NxField);

export { NxField, FIELD_LABELS } from "./field";
export type { FieldActionDetail, FieldLabels, FieldSpan } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-field": NxField;
  }
  interface HTMLElementEventMap {
    "nx-field-action": CustomEvent<import("./types").FieldActionDetail>;
  }
}
