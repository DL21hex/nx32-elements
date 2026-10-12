/** `<Alerts>` para SolidJS: envuelve `<nx-alerts>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/alerts/index";
import type { NxAlerts } from "../components/alerts/alerts";
import type { AlertAction, AlertItem, AlertsActionDetail, AlertSeverity, AlertsLabels } from "../components/alerts/types";

export type { AlertAction, AlertItem, AlertsActionDetail, AlertSeverity, AlertsLabels, NxAlerts };

export interface AlertsProps extends Omit<JSX.HTMLAttributes<NxAlerts>, "onAction" | "children"> {
  /** Los asuntos: `{id, severity, title, text?, meta?, action?: {label, href?, newTab?, filter?}}`. */
  items: AlertItem[];
  /** `severity` (por defecto: de la más grave a la menos) o `none` (tal como llegan). */
  sort?: "severity" | "none";
  /** Cuántos se ven antes de «Ver {n} más» (6 por defecto). */
  limit?: number;
  /** El texto sin asuntos (por defecto «Nada pendiente.»). */
  empty?: string;
  labels?: Partial<AlertsLabels>;
  /** Se tocó una acción. Cancelable: `preventDefault()` y el enlace no navega ni el tablero filtra. */
  onAction?: (e: CustomEvent<AlertsActionDetail>) => void;
  children?: never;
}

export function Alerts(props: AlertsProps): JSX.Element {
  const [local, rest] = splitProps(props, ["items", "sort", "limit", "empty", "labels", "onAction", "children"]);
  return (
    <nx-alerts
      {...rest}
      prop:items={local.items}
      prop:labels={local.labels}
      attr:sort={local.sort}
      attr:limit={local.limit === undefined ? undefined : String(local.limit)}
      attr:empty={local.empty}
      on:nx-alerts-action={(e) => e.target === e.currentTarget && local.onAction?.(e)}
    />
  );
}
