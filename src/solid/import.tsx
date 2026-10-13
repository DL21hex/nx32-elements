/** `<Import>` para SolidJS: envuelve `<nx-import>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/import/index";
import type { NxImport } from "../components/import/import";
import type { ImportBatchDetail, ImportColumnInput, ImportDoneDetail, ImportErrorDetail, ImportLabels, ImportMappedDetail, ImportParsedDetail, ImportState } from "../components/import/types";

export type { NxImport, ImportBatchDetail, ImportColumnInput, ImportDoneDetail, ImportErrorDetail, ImportLabels, ImportMappedDetail, ImportParsedDetail, ImportState };

export interface ImportProps extends Omit<JSX.HTMLAttributes<NxImport>, "onError" | "children"> {
  /** Los campos de destino: `{key, label, type?, required?, unique?, options?, aliases?, min?, max?, pattern?, hint?}`. */
  columns: ImportColumnInput[];
  /** Recibe `POST {rows, offset, lines}` por lotes (con `Idempotency-Key`) y puede responder
   *  `{errors: [{row, field?, message}]}`. Sin él, solo `onDone`. */
  endpoint?: string;
  /** Plazo de cada lote, en ms (60 000). */
  timeout?: number;
  /** URL de la plantilla: «Descargar la plantilla» en el primer paso. */
  template?: string;
  /** Filas por lote (500). */
  batch?: number;
  accept?: string;
  /** Tamaño máximo del archivo: bytes o «20MB» (por defecto 20 MB). */
  maxSize?: number | string;
  /** Clave para recordar el mapeo (sin ella, el `id`). */
  memory?: string;
  locale?: string;
  labels?: Partial<ImportLabels>;
  disabled?: boolean;
  onParsed?: (e: CustomEvent<ImportParsedDetail>) => void;
  onMapped?: (e: CustomEvent<ImportMappedDetail>) => void;
  /** `{rows, skipped, mapping, fixed, headers}`: las filas ya normalizadas. */
  onDone?: (e: CustomEvent<ImportDoneDetail>) => void;
  onError?: (e: CustomEvent<ImportErrorDetail>) => void;
  /** `nx-import-batch` `{accepted, rejected, offset}`: un lote respondido (refrescar la vista). */
  onBatch?: (e: CustomEvent<ImportBatchDetail>) => void;
  /** Sin hijos: el componente pinta todo su contenido. */
  children?: never;
}

export function Import(props: ImportProps): JSX.Element {
  const [local, rest] = splitProps(props, ["columns", "endpoint", "template", "batch", "accept", "maxSize", "memory", "locale", "labels", "disabled", "onParsed", "onMapped", "onDone", "onError", "onBatch", "timeout", "children"]);
  return (
    <nx-import
      {...rest}
      prop:columns={local.columns}
      prop:labels={local.labels}
      attr:endpoint={local.endpoint}
      attr:template={local.template}
      attr:batch={local.batch === undefined ? undefined : String(local.batch)}
      attr:timeout={local.timeout === undefined ? undefined : String(local.timeout)}
      attr:accept={local.accept}
      attr:max-size={local.maxSize === undefined ? undefined : String(local.maxSize)}
      attr:memory={local.memory}
      attr:locale={local.locale}
      bool:disabled={!!local.disabled}
      on:nx-import-parsed={(e) => e.target === e.currentTarget && local.onParsed?.(e)}
      on:nx-import-mapped={(e) => e.target === e.currentTarget && local.onMapped?.(e)}
      on:nx-import-done={(e) => e.target === e.currentTarget && local.onDone?.(e)}
      on:nx-import-error={(e) => e.target === e.currentTarget && local.onError?.(e)}
      on:nx-import-batch={(e) => e.target === e.currentTarget && local.onBatch?.(e)}
    />
  );
}
