/** `<Flow>` para SolidJS: envuelve `<nx-flow>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/flow/index";
import type { NxFlow } from "../components/flow/flow";
import type { FlowItem, FlowItemDetail, FlowLabels, FlowOpenDetail, FlowStage, FlowStageDetail, FlowTime, FlowTone } from "../components/flow/types";

export type { NxFlow, FlowItem, FlowItemDetail, FlowLabels, FlowOpenDetail, FlowStage, FlowStageDetail, FlowTime, FlowTone };

export interface FlowProps extends Omit<JSX.HTMLAttributes<NxFlow>, "children"> {
  /** Las etapas en orden: `{id, label, note?, limit?, warn?, end?}` (minutos). */
  stages: FlowStage[];
  /** Los elementos: `{id, label, sub?, meta?, flag?, href?, times: {[etapa]: hora}}`. */
  items: FlowItem[];
  /** Los `id` que siguen a un filtro de la app; los demás se atenúan. */
  highlight?: (string | number)[] | null;
  /** El título («Flujo del día»); `""` lo quita. */
  heading?: string;
  headingLevel?: number;
  /** La hora de ahora según el servidor. */
  now?: FlowTime;
  /** El comienzo y el fin del día (el eje de la línea del día). */
  start?: FlowTime;
  end?: FlowTime;
  /** La etapa elegida. */
  stage?: string | null;
  /** El elemento elegido. */
  selected?: string | number | null;
  locale?: string;
  /** Zona horaria IANA de las horas. */
  timeZone?: string;
  labels?: Partial<FlowLabels>;
  onStage?: (e: CustomEvent<FlowStageDetail>) => void;
  onItem?: (e: CustomEvent<FlowItemDetail>) => void;
  onOpen?: (e: CustomEvent<FlowOpenDetail>) => void;
  children?: never;
}

const str = (v: unknown) => (v == null ? undefined : String(v));

export function Flow(props: FlowProps): JSX.Element {
  const [local, rest] = splitProps(props, ["stages", "items", "highlight", "heading", "headingLevel", "now", "start", "end", "stage", "selected", "locale", "timeZone", "labels", "onStage", "onItem", "onOpen", "children"]);
  return (
    <nx-flow
      {...rest}
      prop:stages={local.stages}
      prop:items={local.items}
      prop:highlight={local.highlight ?? null}
      prop:labels={local.labels}
      attr:heading={local.heading}
      attr:heading-level={str(local.headingLevel)}
      attr:now={str(local.now)}
      attr:start={str(local.start)}
      attr:end={str(local.end)}
      attr:stage={local.stage ?? undefined}
      attr:selected={str(local.selected)}
      attr:locale={local.locale}
      attr:time-zone={local.timeZone}
      on:nx-flow-stage={(e) => e.target === e.currentTarget && local.onStage?.(e)}
      on:nx-flow-item={(e) => e.target === e.currentTarget && local.onItem?.(e)}
      on:nx-flow-open={(e) => e.target === e.currentTarget && local.onOpen?.(e)}
    />
  );
}
