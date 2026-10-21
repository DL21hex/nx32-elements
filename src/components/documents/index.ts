import { define } from "../../core/define";
import { NxDocuments } from "./documents";

define("nx-documents", NxDocuments);

export { DOCUMENTS_LABELS, NxDocuments } from "./documents";
export { cleanDocuments, documentState, documentsSummary, DOCUMENTS_SOON, sortDocuments, stateKey as documentStateKey, summaryText as documentsSummaryText } from "./logic";
export type { DocumentField, DocumentItem, DocumentKind, DocumentsFileDetail, DocumentsLabels, DocumentsOpenDetail, DocumentState, DocumentStateKey, DocumentStatus, DocumentsSummary, DocumentsUploadDetail, DocumentTone, DocumentUse } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-documents": NxDocuments;
  }
  interface HTMLElementEventMap {
    "nx-documents-open": CustomEvent<import("./types").DocumentsOpenDetail>;
    "nx-documents-upload": CustomEvent<import("./types").DocumentsUploadDetail>;
    "nx-documents-file": CustomEvent<import("./types").DocumentsFileDetail>;
  }
}
