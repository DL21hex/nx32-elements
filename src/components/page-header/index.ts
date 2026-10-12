import { define } from "../../core/define";
import { NxPageHeader } from "./page-header";

define("nx-page-header", NxPageHeader);

export { NxPageHeader, PAGE_HEADER_LABELS } from "./page-header";
export type { PageHeaderKpi, PageHeaderLabels, PageHeaderLink, PageHeaderTone } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-page-header": NxPageHeader;
  }
}
