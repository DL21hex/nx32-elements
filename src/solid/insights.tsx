/** `<Insights>` para SolidJS: envuelve `<nx-insights>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/insights/index";
import type { NxInsights } from "../components/insights/insights";
import type { EmphasisPart, InsightAction, InsightIcon, InsightItem, InsightsActionDetail, InsightsLabels, InsightTone } from "../components/insights/types";

export type { EmphasisPart, InsightAction, InsightIcon, InsightItem, InsightsActionDetail, InsightsLabels, InsightTone, NxInsights };

export interface InsightsProps extends Omit<JSX.HTMLAttributes<NxInsights>, "onAction" | "children"> {
  /** Las frases: `{id, text, tone?, icon?, action?: {label, href?, newTab?, filter?}}`; `**así**` resalta. */
  items: InsightItem[];
  /** El texto sin frases (por defecto «Sin hallazgos con estos filtros.»). */
  empty?: string;
  labels?: Partial<InsightsLabels>;
  /** Se tocó una acción. Cancelable: `preventDefault()` y el enlace no navega ni el tablero filtra. */
  onAction?: (e: CustomEvent<InsightsActionDetail>) => void;
  children?: never;
}

export function Insights(props: InsightsProps): JSX.Element {
  const [local, rest] = splitProps(props, ["items", "empty", "labels", "onAction", "children"]);
  return (
    <nx-insights
      {...rest}
      prop:items={local.items}
      prop:labels={local.labels}
      attr:empty={local.empty}
      on:nx-insights-action={(e) => e.target === e.currentTarget && local.onAction?.(e)}
    />
  );
}
