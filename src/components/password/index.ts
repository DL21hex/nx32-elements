import { define } from "../../core/define";
import { NxPassword } from "./password";

define("nx-password", NxPassword);

export { NxPassword, PASSWORD_LABELS } from "./password";
export { breachCount, firstUnmet, hasPersonal, isCommon, passwordBits, passwordRules, passwordStrength, PASSWORD_MIN, rangeUrl as breachRangeUrl, sha1Hex } from "./logic";
export type { RuleOptions as PasswordRuleOptions } from "./logic";
export type { PasswordChangeDetail, PasswordLabels, PasswordRule, PasswordRuleId, PasswordStrength } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-password": NxPassword;
  }
  interface HTMLElementEventMap {
    "nx-password-change": CustomEvent<import("./types").PasswordChangeDetail>;
  }
}
