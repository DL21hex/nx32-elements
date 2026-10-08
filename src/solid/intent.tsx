/** `<Intent>` para SolidJS: envuelve `<nx-intent>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/intent/index";
import type { NxIntent } from "../components/intent/intent";
import type { IntentChangeDetail, IntentDef, IntentLabels, IntentMatch, IntentOption, IntentSlot, IntentSubmitDetail } from "../components/intent/types";

export type { NxIntent, IntentChangeDetail, IntentDef, IntentLabels, IntentMatch, IntentOption, IntentSlot, IntentSubmitDetail };

export interface IntentProps extends Omit<JSX.HTMLAttributes<NxIntent>, "onChange" | "onSubmit" | "children"> {
  /** Los trámites: `{id, label, keywords, exclude?, href, newTab?, icon?, slots?}`. */
  intents: IntentDef[];
  /** Frases de ejemplo bajo la caja. */
  examples?: string[];
  placeholder?: string;
  /** «Hoy» (ISO) para leer «mañana» o «el viernes». */
  today?: string;
  /** La moneda de los montos entendidos («COP»). */
  currency?: string;
  /** Una tecla que trae el foco a la caja («/»). */
  hotkey?: string;
  value?: string;
  locale?: string;
  labels?: Partial<IntentLabels>;
  /** Cambió lo entendido. */
  onChange?: (e: CustomEvent<IntentChangeDetail>) => void;
  /** Se pidió preparar. Cancelable: `preventDefault()` y la app navega con su router. */
  onSubmit?: (e: CustomEvent<IntentSubmitDetail>) => void;
  children?: never;
}

export function Intent(props: IntentProps): JSX.Element {
  const [local, rest] = splitProps(props, ["intents", "examples", "placeholder", "today", "currency", "hotkey", "value", "locale", "labels", "onChange", "onSubmit", "children"]);
  return (
    <nx-intent
      {...rest}
      prop:intents={local.intents}
      prop:examples={local.examples}
      prop:labels={local.labels}
      prop:value={local.value}
      attr:placeholder={local.placeholder}
      attr:today={local.today}
      attr:currency={local.currency}
      attr:hotkey={local.hotkey}
      attr:locale={local.locale}
      on:nx-intent-change={(e) => e.target === e.currentTarget && local.onChange?.(e)}
      on:nx-intent-submit={(e) => e.target === e.currentTarget && local.onSubmit?.(e)}
    />
  );
}
