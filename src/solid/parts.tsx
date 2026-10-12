/** `<Parts>` para SolidJS: envuelve `<nx-parts>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/parts/index";
import type { NxParts } from "../components/parts/parts";
import type { PartItem, PartsFormat, PartsLabels, PartsSelectDetail } from "../components/parts/types";

export type { NxParts, PartItem, PartsFormat, PartsLabels, PartsSelectDetail };

export interface PartsProps extends Omit<JSX.HTMLAttributes<NxParts>, "onSelect" | "children"> {
  /** Las partes, en el orden en que se muestran: `{id, label, value, note?, slot?}`. */
  items: PartItem[];
  /** `number` (por defecto), `money` o `percent`. */
  format?: PartsFormat;
  /** La moneda de `format="money"`. */
  currency?: string;
  locale?: string;
  /** La dimensión del tablero que filtran las partes: cada renglón es un botón. */
  dimension?: string;
  labels?: Partial<PartsLabels>;
  /** Una parte elegida (solo con `dimension`). */
  onSelect?: (e: CustomEvent<PartsSelectDetail>) => void;
  children?: never;
}

export function Parts(props: PartsProps): JSX.Element {
  const [local, rest] = splitProps(props, ["items", "format", "currency", "locale", "dimension", "labels", "onSelect", "children"]);
  return (
    <nx-parts
      {...rest}
      prop:items={local.items}
      prop:labels={local.labels}
      attr:format={local.format}
      attr:currency={local.currency}
      attr:locale={local.locale}
      attr:dimension={local.dimension || undefined}
      on:nx-parts-select={(e) => e.target === e.currentTarget && local.onSelect?.(e)}
    />
  );
}
