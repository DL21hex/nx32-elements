/** `<Timeline>` para SolidJS: envuelve `<nx-timeline>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/timeline/index";
import type { NxTimeline } from "../components/timeline/timeline";
import type { TimelineHolidays, TimelineItem, TimelineLabels, TimelineLane, TimelineLaneKind, TimelineLegendItem, TimelineSelectDetail, TimelineState, TimelineTone } from "../components/timeline/types";

export type { NxTimeline, TimelineHolidays, TimelineItem, TimelineLabels, TimelineLane, TimelineLaneKind, TimelineLegendItem, TimelineSelectDetail, TimelineState, TimelineTone };

export interface TimelineProps extends Omit<JSX.HTMLAttributes<NxTimeline>, "onSelect" | "children"> {
  /** Los carriles, de arriba abajo: `{id, label, kind?: "bars" | "ranges" | "points", shape?}`. */
  lanes: TimelineLane[];
  /** Las marcas: `{id?, lane, date | start/end, value?, extra?, state?, tone?, label, detail?, action?, href?, newTab?, caption?}`. */
  items: TimelineItem[];
  legend?: TimelineLegendItem[];
  /** `"co"` (por defecto), una lista de fechas o de `{date, name}`, o `null`. */
  holidays?: TimelineHolidays;
  /** Primer y último día del eje (ISO). Sin ellos, de hace 8 meses a dentro de 4. */
  start?: string;
  end?: string;
  /** «Hoy» (ISO). Sin él, la fecha local. */
  today?: string;
  heading?: string;
  headingLevel?: number;
  summary?: string;
  /** El `id` de la marca resaltada. */
  highlight?: string;
  locale?: string;
  labels?: Partial<TimelineLabels>;
  /** Una marca elegida. Cancelable: `preventDefault()` y la app navega con su router. */
  onSelect?: (e: CustomEvent<TimelineSelectDetail>) => void;
  children?: never;
}

export function Timeline(props: TimelineProps): JSX.Element {
  const [local, rest] = splitProps(props, ["lanes", "items", "legend", "holidays", "start", "end", "today", "heading", "headingLevel", "summary", "highlight", "locale", "labels", "onSelect", "children"]);
  return (
    <nx-timeline
      {...rest}
      prop:lanes={local.lanes}
      prop:items={local.items}
      prop:legend={local.legend}
      prop:holidays={local.holidays}
      prop:labels={local.labels}
      attr:start={local.start}
      attr:end={local.end}
      attr:today={local.today}
      attr:heading={local.heading}
      attr:heading-level={local.headingLevel === undefined ? undefined : String(local.headingLevel)}
      attr:summary={local.summary}
      attr:highlight={local.highlight}
      attr:locale={local.locale}
      on:nx-timeline-select={(e) => e.target === e.currentTarget && local.onSelect?.(e)}
    />
  );
}
