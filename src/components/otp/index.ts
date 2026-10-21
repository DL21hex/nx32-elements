import { define } from "../../core/define";
import { NxOtp } from "./otp";

define("nx-otp", NxOtp);

export { NxOtp, OTP_LABELS } from "./otp";
export { charsOf as otpChars, cleanLength as otpLength, isComplete as otpComplete, sanitize as sanitizeOtp, spread as spreadOtp, OTP_DEFAULT, OTP_MAX, OTP_MIN } from "./logic";
export type { OtpChangeDetail, OtpCompleteDetail, OtpKind, OtpLabels } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-otp": NxOtp;
  }
  interface HTMLElementEventMap {
    "nx-otp-change": CustomEvent<import("./types").OtpChangeDetail>;
    "nx-otp-complete": CustomEvent<import("./types").OtpCompleteDetail>;
  }
}
