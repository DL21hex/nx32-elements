/** `<Heatmap>` para SolidJS: envuelve `<nx-heatmap>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/heatmap/index";
import type { NxHeatmap } from "../components/heatmap/heatmap";
import type { HeatColumn, HeatmapLabels, HeatmapSelectDetail, HeatPolarity, HeatRow, HeatScale } from "../components/heatmap/types";

export type { NxHeatmap, HeatColumn, HeatmapLabels, HeatmapSelectDetail, HeatPolarity, HeatRow, HeatScale };

export interface HeatmapProps extends Omit<JSX.HTMLAttributes<NxHeatmap>, "onSelect" | "children"> {
  /** Las filas: `{id, label, note?, total?, delta?}`. */
  rows: HeatRow[];
  /** Las columnas: `{id, label}`. */
  columns: HeatColumn[];
  /** Los valores, fila por fila; `null` es «sin dato». */
  values: (number | null)[][];
  format?: "number" | "money" | "percent";
  currency?: string;
  decimals?: number;
  min?: number;
  max?: number;
  mid?: number;
  scale?: HeatScale;
  polarity?: HeatPolarity;
  /** La dimensión de `<Board>` de las filas. */
  rowDimension?: string;
  /** La dimensión de `<Board>` de las columnas. */
  columnDimension?: string;
  totalLabel?: string;
  /** Celdas y encabezados se tocan aunque no haya dimensión. */
  selectable?: boolean;
  locale?: string;
  labels?: Partial<HeatmapLabels>;
  onSelect?: (e: CustomEvent<HeatmapSelectDetail>) => void;
  children?: never;
}

const str = (v: number | string | undefined) => (v == null || v === "" ? undefined : String(v));

export function Heatmap(props: HeatmapProps): JSX.Element {
  const [local, rest] = splitProps(props, ["rows", "columns", "values", "labels", "format", "currency", "decimals", "min", "max", "mid", "scale", "polarity", "rowDimension", "columnDimension", "totalLabel", "selectable", "locale", "onSelect", "children"]);
  return (
    <nx-heatmap
      {...rest}
      prop:rows={local.rows}
      prop:columns={local.columns}
      prop:values={local.values}
      prop:labels={local.labels}
      attr:format={local.format}
      attr:currency={local.currency}
      attr:decimals={str(local.decimals)}
      attr:min={str(local.min)}
      attr:max={str(local.max)}
      attr:mid={str(local.mid)}
      attr:scale={local.scale}
      attr:polarity={local.polarity}
      attr:row-dimension={local.rowDimension || undefined}
      attr:column-dimension={local.columnDimension || undefined}
      attr:total-label={local.totalLabel || undefined}
      attr:locale={local.locale}
      bool:selectable={!!local.selectable}
      on:nx-heatmap-select={(e) => e.target === e.currentTarget && local.onSelect?.(e)}
    />
  );
}
