/** `<Tracker>` para SolidJS: envuelve `<nx-tracker>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/tracker/index";
import type { NxTracker } from "../components/tracker/tracker";
import type { TrackerAction, TrackerDays, TrackerHolidays, TrackerItem, TrackerLabels, TrackerSelectDetail, TrackerStep, TrackerTone } from "../components/tracker/types";

export type { NxTracker, TrackerAction, TrackerDays, TrackerHolidays, TrackerItem, TrackerLabels, TrackerSelectDetail, TrackerStep, TrackerTone };

export interface TrackerProps extends Omit<JSX.HTMLAttributes<NxTracker>, "onSelect" | "children"> {
  /** Las tarjetas: `{id, title, subtitle?, icon?, eyebrow?, status?, steps?, days?, href?, actions?}`. */
  items: TrackerItem[];
  /** Festivos de la tira de días: `"co"` (por defecto), una lista o `null`. */
  holidays?: TrackerHolidays;
  /** Días de la semana que se trabajan (0 domingo … 6 sábado). */
  workdays?: number[];
  /** Lo que se dice cuando no hay nada (sin él, no ocupa espacio). */
  empty?: string;
  headingLevel?: number;
  locale?: string;
  labels?: Partial<TrackerLabels>;
  /** Un enlace elegido. Cancelable: `preventDefault()` y la app navega con su router. */
  onSelect?: (e: CustomEvent<TrackerSelectDetail>) => void;
  children?: never;
}

export function Tracker(props: TrackerProps): JSX.Element {
  const [local, rest] = splitProps(props, ["items", "holidays", "workdays", "empty", "headingLevel", "locale", "labels", "onSelect", "children"]);
  return (
    <nx-tracker
      {...rest}
      prop:items={local.items}
      prop:holidays={local.holidays}
      prop:workdays={local.workdays}
      prop:labels={local.labels}
      attr:empty={local.empty}
      attr:heading-level={local.headingLevel === undefined ? undefined : String(local.headingLevel)}
      attr:locale={local.locale}
      on:nx-tracker-select={(e) => e.target === e.currentTarget && local.onSelect?.(e)}
    />
  );
}
