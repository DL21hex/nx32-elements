/** `<Documents>` para SolidJS: envuelve `<nx-documents>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/documents/index";
import type { NxDocuments } from "../components/documents/documents";
import type { DocumentField, DocumentItem, DocumentKind, DocumentsFileDetail, DocumentsLabels, DocumentsOpenDetail, DocumentStatus, DocumentsSummary, DocumentsUploadDetail, DocumentUse } from "../components/documents/types";

export type { NxDocuments, DocumentField, DocumentItem, DocumentKind, DocumentsFileDetail, DocumentsLabels, DocumentsOpenDetail, DocumentStatus, DocumentsSummary, DocumentsUploadDetail, DocumentUse };

export interface DocumentsProps extends Omit<JSX.HTMLAttributes<NxDocuments>, "children"> {
  items: DocumentItem[];
  /** La fecha de hoy (ISO) para los vencimientos. */
  today?: string;
  /** Desde cuántos días antes de vencer se avisa (60). */
  soon?: number;
  accept?: string;
  /** En bytes (20 MB). */
  maxSize?: number;
  /** «Usar el celular» en la subida (`<nx-handoff>`). */
  handoffEndpoint?: string;
  /** El documento que la app está subiendo. */
  busy?: string | null;
  order?: "status" | "none";
  locale?: string;
  labels?: Partial<DocumentsLabels>;
  /** Cancelable: la app abre lo suyo. */
  onOpen?: (e: CustomEvent<DocumentsOpenDetail>) => void;
  onUpload?: (e: CustomEvent<DocumentsUploadDetail>) => void;
  /** El archivo que sirve: súbelo y asigna `items`. */
  onFile?: (e: CustomEvent<DocumentsFileDetail>) => void;
  children?: never;
}

export function Documents(props: DocumentsProps): JSX.Element {
  const [local, rest] = splitProps(props, ["items", "today", "soon", "accept", "maxSize", "handoffEndpoint", "busy", "order", "locale", "labels", "onOpen", "onUpload", "onFile", "children"]);
  const str = (n: number | undefined) => (n === undefined ? undefined : String(n));
  return (
    <nx-documents
      {...rest}
      prop:items={local.items}
      prop:labels={local.labels}
      attr:today={local.today}
      attr:soon={str(local.soon)}
      attr:accept={local.accept}
      attr:max-size={str(local.maxSize)}
      attr:handoff-endpoint={local.handoffEndpoint}
      attr:busy={local.busy ?? undefined}
      attr:order={local.order === "none" ? "none" : undefined}
      attr:locale={local.locale}
      on:nx-documents-open={(e) => e.target === e.currentTarget && local.onOpen?.(e)}
      on:nx-documents-upload={(e) => e.target === e.currentTarget && local.onUpload?.(e)}
      on:nx-documents-file={(e) => e.target === e.currentTarget && local.onFile?.(e)}
    />
  );
}
