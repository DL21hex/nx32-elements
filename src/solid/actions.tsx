/** `<Actions>` para SolidJS: envuelve `<nx-actions>`. Por qué `prop:` y `attr:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/actions/index";
import type { NxActions } from "../components/actions/actions";
import type { ActionItem, ActionsActionDetail, ActionsLabels } from "../components/actions/types";

export type { ActionItem, ActionsActionDetail, ActionsLabels, NxActions };

export interface ActionsProps extends Omit<JSX.HTMLAttributes<NxActions>, "onAction" | "children"> {
  /** Las acciones: `{id, label, description?, icon?, danger?, disabled?, href?, newTab?, download?}`. */
  items: ActionItem[];
  /** La acción que está corriendo (su `id`): espera, y las demás se apagan hasta que termine. */
  busy?: string | null;
  labels?: Partial<ActionsLabels>;
  /** Se pulsó un botón (los enlaces no emiten). */
  onAction?: (e: CustomEvent<ActionsActionDetail>) => void;
  children?: never;
}

export function Actions(props: ActionsProps): JSX.Element {
  const [local, rest] = splitProps(props, ["items", "busy", "labels", "onAction", "children"]);
  return (
    <nx-actions
      {...rest}
      prop:items={local.items}
      prop:labels={local.labels}
      attr:busy={local.busy || undefined}
      on:nx-actions-action={(e) => e.target === e.currentTarget && local.onAction?.(e)}
    />
  );
}
