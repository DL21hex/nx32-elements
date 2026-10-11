import { define } from "../../core/define";
import { NxPageHeader } from "./page-header";

define("nx-page-header", NxPageHeader);

export { NxPageHeader } from "./page-header";

declare global {
  interface HTMLElementTagNameMap {
    "nx-page-header": NxPageHeader;
  }
}
