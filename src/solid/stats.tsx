/** `<Stats>` para SolidJS: envuelve `<nx-stats>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/stats/index";
import type { NxStats } from "../components/stats/stats";
import type { StatItem, StatsLabels, StatsSelectDetail, StatTone } from "../components/stats/types";

export type { NxStats, StatItem, StatsLabels, StatsSelectDetail, StatTone };

export interface StatsProps extends Omit<JSX.HTMLAttributes<NxStats>, "onSelect" | "children"> {
  /** Las cifras: `{id?, label, value, format?, currency?, note?, badge?, trend?, meter?, ring?, href?, newTab?}`. */
  items: StatItem[];
  /** `row` (por defecto) o `list`. */
  layout?: "row" | "list";
  locale?: string;
  labels?: Partial<StatsLabels>;
  /** Una cifra con enlace elegida. Cancelable: `preventDefault()` y la app navega con su router. */
  onSelect?: (e: CustomEvent<StatsSelectDetail>) => void;
  children?: never;
}

export function Stats(props: StatsProps): JSX.Element {
  const [local, rest] = splitProps(props, ["items", "layout", "locale", "labels", "onSelect", "children"]);
  return (
    <nx-stats
      {...rest}
      prop:items={local.items}
      prop:labels={local.labels}
      attr:layout={local.layout}
      attr:locale={local.locale}
      on:nx-stats-select={(e) => e.target === e.currentTarget && local.onSelect?.(e)}
    />
  );
}
