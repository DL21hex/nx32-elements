import { define } from "../../core/define";
import { NxPageHeader } from "./page-header";

define("nx-page-header", NxPageHeader);

export { NxPageHeader, PAGE_HEADER_LABELS } from "./page-header";
export type { PageHeaderAvatarDetail, PageHeaderKpi, PageHeaderLabels, PageHeaderLink, PageHeaderTone } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-page-header": NxPageHeader;
  }
  interface HTMLElementEventMap {
    "nx-page-header-avatar": CustomEvent<import("./types").PageHeaderAvatarDetail>;
  }
}
