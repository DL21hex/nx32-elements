/** `<Lanes>` para SolidJS: envuelve `<nx-lanes>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/lanes/index";
import type { NxLanes } from "../components/lanes/lanes";
import type { Lane, LaneItem, LanesChangeDetail, LanesItemDetail, LanesLabels, LanesMove, LanesPlace, LanesSpotlightDetail, LanesStageDetail, LaneStage, LaneTone } from "../components/lanes/types";

export type { NxLanes, Lane, LaneItem, LanesChangeDetail, LanesItemDetail, LanesLabels, LanesMove, LanesPlace, LanesSpotlightDetail, LanesStageDetail, LaneStage, LaneTone };

export interface LanesProps extends Omit<JSX.HTMLAttributes<NxLanes>, "children" | "onChange"> {
  /** Los carriles: `{id, label, stages: [{id, label, other?, href?}]}`. */
  lanes: Lane[];
  /** Los elementos abiertos: `{id, lane, stage, age, label?, sub?}`. */
  items: LaneItem[];
  /** Los cortes de los tramos (por defecto `[2, 5, 10]`). */
  bands?: number[] | null;
  /** Un título sobre los carriles. */
  heading?: string;
  headingLevel?: number;
  /** El carril en foco (su `id`). */
  spotlight?: string | null;
  /** Cada cuántos segundos rota el foco (0: no rota). */
  cycle?: number;
  locale?: string;
  labels?: Partial<LanesLabels>;
  onStage?: (e: CustomEvent<LanesStageDetail>) => void;
  onItem?: (e: CustomEvent<LanesItemDetail>) => void;
  onChange?: (e: CustomEvent<LanesChangeDetail>) => void;
  onSpotlight?: (e: CustomEvent<LanesSpotlightDetail>) => void;
  children?: never;
}

const str = (v: unknown) => (v == null ? undefined : String(v));

export function Lanes(props: LanesProps): JSX.Element {
  const [local, rest] = splitProps(props, ["lanes", "items", "bands", "heading", "headingLevel", "spotlight", "cycle", "locale", "labels", "onStage", "onItem", "onChange", "onSpotlight", "children"]);
  return (
    <nx-lanes
      {...rest}
      prop:lanes={local.lanes}
      prop:items={local.items}
      prop:bands={local.bands ?? null}
      prop:labels={local.labels}
      attr:heading={local.heading}
      attr:heading-level={str(local.headingLevel)}
      attr:spotlight={local.spotlight ?? undefined}
      attr:cycle={local.cycle ? String(local.cycle) : undefined}
      attr:locale={local.locale}
      on:nx-lanes-stage={(e) => e.target === e.currentTarget && local.onStage?.(e)}
      on:nx-lanes-item={(e) => e.target === e.currentTarget && local.onItem?.(e)}
      on:nx-lanes-change={(e) => e.target === e.currentTarget && local.onChange?.(e)}
      on:nx-lanes-spotlight={(e) => e.target === e.currentTarget && local.onSpotlight?.(e)}
    />
  );
}
