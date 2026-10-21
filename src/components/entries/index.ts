import { define } from "../../core/define";
import { NxEntries } from "./entries";

define("nx-entries", NxEntries);

export { ENTRIES_LABELS, NxEntries } from "./entries";
export { cleanEntries, isSections as entriesSchemaIsSections } from "./logic";
export type { EntriesActionDetail, EntriesEditDetail, EntriesLabels, EntriesLayout, EntriesOpenDetail, EntriesRemoveDetail, EntriesSaveDetail, EntriesSchema, EntryItem, EntryNote, EntryTag, EntryTone } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-entries": NxEntries;
  }
  interface HTMLElementEventMap {
    "nx-entries-edit": CustomEvent<import("./types").EntriesEditDetail>;
    "nx-entries-open": CustomEvent<import("./types").EntriesOpenDetail>;
    "nx-entries-save": CustomEvent<import("./types").EntriesSaveDetail>;
    "nx-entries-remove": CustomEvent<import("./types").EntriesRemoveDetail>;
    "nx-entries-action": CustomEvent<import("./types").EntriesActionDetail>;
  }
}
