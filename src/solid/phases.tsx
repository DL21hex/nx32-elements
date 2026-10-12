/** `<Phases>` para SolidJS: envuelve `<nx-phases>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/phases/index";
import type { NxPhases } from "../components/phases/phases";
import type { Phase, PhaseProgress, PhasesFormat, PhasesLabels } from "../components/phases/types";

export type { NxPhases, Phase, PhaseProgress, PhasesFormat, PhasesLabels };

export interface PhasesProps extends Omit<JSX.HTMLAttributes<NxPhases>, "children"> {
  /** Los tramos: `{id?, from, to, label, note?, slot?, value?}`. */
  phases: Phase[];
  /** El último día del eje. Por defecto, el mayor `to`. */
  total?: number;
  /** El día de hoy en el eje: lo que va después se pinta rayado. */
  today?: number;
  /** Los días que se marcan en el eje. */
  ticks?: number[];
  /** Cómo se escribe el `value` de cada tramo: `number`, `money` o `percent`. */
  format?: PhasesFormat;
  currency?: string;
  locale?: string;
  /** Muestra la lista de tramos debajo del eje. */
  list?: boolean;
  labels?: Partial<PhasesLabels>;
  children?: never;
}

export function Phases(props: PhasesProps): JSX.Element {
  const [local, rest] = splitProps(props, ["phases", "total", "today", "ticks", "format", "currency", "locale", "list", "labels", "children"]);
  return (
    <nx-phases
      {...rest}
      prop:phases={local.phases}
      prop:ticks={local.ticks}
      prop:labels={local.labels}
      attr:total={local.total == null ? undefined : String(local.total)}
      attr:today={local.today == null ? undefined : String(local.today)}
      attr:format={local.format}
      attr:currency={local.currency}
      attr:locale={local.locale}
      bool:list={!!local.list}
    />
  );
}
