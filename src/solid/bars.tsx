/** `<Bars>` para SolidJS: envuelve `<nx-bars>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/bars/index";
import type { NxBars } from "../components/bars/bars";
import type { BarItem, BarSeries, BarsLabels, BarsOrientation, BarsRamp, BarsSelectDetail } from "../components/bars/types";

export type { NxBars, BarItem, BarSeries, BarsLabels, BarsOrientation, BarsRamp, BarsSelectDetail };

export interface BarsProps extends Omit<JSX.HTMLAttributes<NxBars>, "onSelect" | "children"> {
  /** Las barras: `{id, label, value, code?, note?, parts?, extra?}`, en el orden en que se ven. */
  items: BarItem[];
  /** Las series de las barras apiladas: `{id, label, slot?}`. */
  series?: BarSeries[];
  orientation?: BarsOrientation;
  format?: "number" | "money" | "percent";
  currency?: string;
  decimals?: number;
  /** Cuántas barras se ven; las demás se resumen. */
  limit?: number;
  /** Agrega el % acumulado (Pareto). */
  cumulative?: boolean;
  /** Una línea punteada en este valor. */
  reference?: number;
  referenceLabel?: string;
  /** La dimensión de `<Board>` que filtran las barras. */
  dimension?: string;
  /** Las barras se tocan y emiten `onSelect` aunque no haya `dimension`. */
  selectable?: boolean;
  ramp?: BarsRamp;
  max?: number;
  /** Alto de las columnas en px. */
  height?: number;
  locale?: string;
  labels?: Partial<BarsLabels>;
  onSelect?: (e: CustomEvent<BarsSelectDetail>) => void;
  children?: never;
}

const str = (v: number | string | undefined) => (v == null || v === "" ? undefined : String(v));

export function Bars(props: BarsProps): JSX.Element {
  const [local, rest] = splitProps(props, ["items", "series", "labels", "orientation", "format", "currency", "decimals", "limit", "cumulative", "reference", "referenceLabel", "dimension", "selectable", "ramp", "max", "height", "locale", "onSelect", "children"]);
  return (
    <nx-bars
      {...rest}
      prop:items={local.items}
      prop:series={local.series}
      prop:labels={local.labels}
      attr:orientation={local.orientation}
      attr:format={local.format}
      attr:currency={local.currency}
      attr:decimals={str(local.decimals)}
      attr:limit={str(local.limit)}
      attr:reference={str(local.reference)}
      attr:reference-label={local.referenceLabel || undefined}
      attr:dimension={local.dimension || undefined}
      attr:ramp={local.ramp}
      attr:max={str(local.max)}
      attr:height={str(local.height)}
      attr:locale={local.locale}
      bool:cumulative={!!local.cumulative}
      bool:selectable={!!local.selectable}
      on:nx-bars-select={(e) => e.target === e.currentTarget && local.onSelect?.(e)}
    />
  );
}
