import { define } from "../../core/define";
import { NxForm } from "./form";

define("nx-form", NxForm);

export { NxForm, FORM_LABELS } from "./form";
export { check as checkFormValue, cleanSections as cleanFormSections, displayValue as formDisplayValue, emailTypo, matches as formMatches, visibleKeys as formVisibleKeys } from "./logic";
export type { FormChangeDetail, FormCondition, FormField, FormFieldType, FormFillDetail, FormLabels, FormMode, FormOption, FormRule, FormSection, FormSource, FormSubmitDetail, FormValue, FormVariant } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-form": NxForm;
  }
  interface HTMLElementEventMap {
    "nx-form-change": CustomEvent<import("./types").FormChangeDetail>;
    "nx-form-fill": CustomEvent<import("./types").FormFillDetail>;
    "nx-form-undo": CustomEvent<{ keys: string[] }>;
    "nx-form-submit": CustomEvent<import("./types").FormSubmitDetail>;
    "nx-form-cancel": CustomEvent<Record<string, never>>;
  }
}
