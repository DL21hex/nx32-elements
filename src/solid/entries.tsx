/** `<Entries>` para SolidJS: envuelve `<nx-entries>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/entries/index";
import type { NxEntries } from "../components/entries/entries";
import type { EntriesActionDetail, EntriesEditDetail, EntriesLabels, EntriesLayout, EntriesOpenDetail, EntriesRemoveDetail, EntriesSaveDetail, EntriesSchema, EntryItem, EntryNote, EntryTag, EntryTone } from "../components/entries/types";

export type { NxEntries, EntriesActionDetail, EntriesEditDetail, EntriesLabels, EntriesLayout, EntriesOpenDetail, EntriesRemoveDetail, EntriesSaveDetail, EntriesSchema, EntryItem, EntryNote, EntryTag, EntryTone };

export interface EntriesProps extends Omit<JSX.HTMLAttributes<NxEntries>, "children"> {
  items: EntryItem[];
  /** El formulario del panel para agregar y editar (campos o secciones de `<Form>`). */
  schema?: EntriesSchema | null;
  /** Errores del servidor para el formulario del panel. */
  errors?: Record<string, string> | null;
  heading?: string;
  headingLevel?: number;
  /** El botón de agregar («Agregar experiencia»). */
  addLabel?: string;
  empty?: string;
  layout?: EntriesLayout;
  readonly?: boolean;
  labels?: Partial<EntriesLabels>;
  /** Cancelable: la app abre lo suyo. */
  onEdit?: (e: CustomEvent<EntriesEditDetail>) => void;
  onOpen?: (e: CustomEvent<EntriesOpenDetail>) => void;
  /** Cancelable: el panel sigue abierto mientras la app guarda. */
  onSave?: (e: CustomEvent<EntriesSaveDetail>) => void;
  onRemove?: (e: CustomEvent<EntriesRemoveDetail>) => void;
  onAction?: (e: CustomEvent<EntriesActionDetail>) => void;
  children?: never;
}

export function Entries(props: EntriesProps): JSX.Element {
  const [local, rest] = splitProps(props, ["items", "schema", "errors", "heading", "headingLevel", "addLabel", "empty", "layout", "readonly", "labels", "onEdit", "onOpen", "onSave", "onRemove", "onAction", "children"]);
  return (
    <nx-entries
      {...rest}
      prop:items={local.items}
      prop:schema={local.schema ?? null}
      prop:errors={local.errors ?? null}
      prop:labels={local.labels}
      attr:heading={local.heading}
      attr:heading-level={local.headingLevel === undefined ? undefined : String(local.headingLevel)}
      attr:add-label={local.addLabel}
      attr:empty={local.empty}
      attr:layout={local.layout}
      bool:readonly={!!local.readonly}
      on:nx-entries-edit={(e) => e.target === e.currentTarget && local.onEdit?.(e)}
      on:nx-entries-open={(e) => e.target === e.currentTarget && local.onOpen?.(e)}
      on:nx-entries-save={(e) => e.target === e.currentTarget && local.onSave?.(e)}
      on:nx-entries-remove={(e) => e.target === e.currentTarget && local.onRemove?.(e)}
      on:nx-entries-action={(e) => e.target === e.currentTarget && local.onAction?.(e)}
    />
  );
}
