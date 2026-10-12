/** `<Board>` y `<BoardPanel>` para SolidJS: envuelven `<nx-board>` y `<nx-board-panel>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/board/index";
import type { NxBoard } from "../components/board/board";
import type { NxBoardPanel } from "../components/board/panel";
import type { BoardChangeDetail, BoardDimension, BoardFilters, BoardLabels } from "../components/board/types";

export type { NxBoard, NxBoardPanel, BoardChangeDetail, BoardDimension, BoardFilters, BoardLabels };

export interface BoardProps extends Omit<JSX.HTMLAttributes<NxBoard>, "onChange"> {
  /** Lo elegido, por dimensión: `{tipo: ["AT"]}`. Asignarlo no avisa. */
  filters?: BoardFilters;
  /** Las dimensiones: `{id, label?, values?, sensitive?}`. */
  dimensions?: BoardDimension[];
  /** Quien mira no ve datos sensibles por persona. */
  restricted?: boolean;
  labels?: Partial<BoardLabels>;
  /** Cambiaron los filtros (un clic en una marca o en un chip, `toggle()` o `clear()`). */
  onChange?: (e: CustomEvent<BoardChangeDetail>) => void;
  /** Los paneles (`<BoardPanel>`) y, si hace falta, un hijo con `slot="filters"`. */
  children?: JSX.Element;
}

export function Board(props: BoardProps): JSX.Element {
  const [local, rest] = splitProps(props, ["filters", "dimensions", "restricted", "labels", "onChange", "children"]);
  return (
    <nx-board
      {...rest}
      prop:filters={local.filters}
      prop:dimensions={local.dimensions}
      prop:labels={local.labels}
      bool:restricted={!!local.restricted}
      on:nx-board-change={(e) => e.target === e.currentTarget && local.onChange?.(e)}
    >
      {local.children}
      {/* Tope de los hijos: ver «Hijos» en ./index.tsx. */}
      <template />
    </nx-board>
  );
}

export interface BoardPanelProps extends JSX.HTMLAttributes<NxBoardPanel> {
  /** Columnas que ocupa, de 1 a 12. */
  span?: number;
  /** El título del panel: un `<h2>`. */
  heading?: string;
  /** Una línea bajo el título. */
  subheading?: string;
  /** La dimensión del panel (o varias, separadas por espacio): la que sus marcas filtran. */
  dimension?: string;
  /** `plain`: sin borde ni fondo. */
  variant?: "plain";
  /** Muestra datos de personas: se reserva con un filtro sensible y el tablero `restricted`. */
  personal?: boolean;
  /** Sus datos están llegando. */
  busy?: boolean;
  /** El contenido y, si hace falta, un hijo con `slot="actions"` (sus controles). */
  children?: JSX.Element;
}

export function BoardPanel(props: BoardPanelProps): JSX.Element {
  const [local, rest] = splitProps(props, ["span", "heading", "subheading", "dimension", "variant", "personal", "busy", "children"]);
  return (
    <nx-board-panel
      {...rest}
      attr:span={local.span == null ? undefined : String(local.span)}
      attr:heading={local.heading || undefined}
      attr:subheading={local.subheading || undefined}
      attr:dimension={local.dimension || undefined}
      attr:variant={local.variant || undefined}
      bool:personal={!!local.personal}
      bool:busy={!!local.busy}
    >
      {local.children}
      {/* Tope de los hijos: ver «Hijos» en ./index.tsx. */}
      <template />
    </nx-board-panel>
  );
}
