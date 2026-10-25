/** `<DateInput>` para SolidJS: envuelve `<nx-date>`. Se llama así para no tapar el `Date` global. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/date/index";
import type { NxDate } from "../components/date/date";
import type { DateChangeDetail, DateLabels, DateUnavailable, DateUnavailableDay } from "../components/date/types";
import type { OpenChangeDetail } from "../components/sidemenu/types";

export type { NxDate, DateChangeDetail, DateLabels, DateUnavailable, DateUnavailableDay };

export interface DateInputProps extends Omit<JSX.HTMLAttributes<NxDate>, "onChange" | "children"> {
  /** ISO («2026-10-25») o `""`. */
  value?: string | null;
  min?: string;
  max?: string;
  today?: string;
  /** Lo que no se puede elegir: fechas (ISO o `{date, label}`) y días de la semana (0 domingo … 6 sábado). */
  unavailable?: DateUnavailable;
  /** Primer día de la semana, 1 (lunes) … 7 (domingo). */
  weekStart?: number;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Nombre accesible del campo. */
  label?: string;
  locale?: string;
  labels?: Partial<DateLabels>;
  onChange?: (e: CustomEvent<DateChangeDetail>) => void;
  onOpenChange?: (e: CustomEvent<OpenChangeDetail>) => void;
  children?: never;
}

export function DateInput(props: DateInputProps): JSX.Element {
  const [local, rest] = splitProps(props, ["value", "min", "max", "today", "unavailable", "weekStart", "name", "required", "disabled", "placeholder", "label", "locale", "labels", "onChange", "onOpenChange", "children"]);
  return (
    <nx-date
      {...rest}
      prop:value={local.value}
      prop:unavailable={local.unavailable}
      prop:labels={local.labels}
      attr:min={local.min}
      attr:max={local.max}
      attr:today={local.today}
      attr:week-start={local.weekStart === undefined ? undefined : String(local.weekStart)}
      attr:name={local.name}
      attr:placeholder={local.placeholder}
      attr:label={local.label}
      attr:locale={local.locale}
      bool:required={!!local.required}
      bool:disabled={!!local.disabled}
      on:nx-date-change={(e) => e.target === e.currentTarget && local.onChange?.(e)}
      on:nx-open-change={(e) => e.target === e.currentTarget && local.onOpenChange?.(e)}
    />
  );
}
