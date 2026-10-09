/** `<Grid>` para SolidJS: envuelve `<nx-grid>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/grid/index";
import type { NxGrid } from "../components/grid/grid";
import type { GridAccents, GridAction, GridActionDetail, GridChange, GridChangeSource, GridColumn, GridErrorDetail, GridExportDetail, GridFilter, GridLabels, GridLayout, GridLayoutDetail, GridMatrix, GridMatrixCell, GridMatrixLabels, GridPreset, GridRow, GridSavedView, GridSort, GridView, GridViewLabels } from "../components/grid/types";
import type { GridFilterDetail } from "./jsx";

export type { NxGrid, GridAccents, GridAction, GridActionDetail, GridChange, GridChangeSource, GridColumn, GridErrorDetail, GridExportDetail, GridFilter, GridLabels, GridLayout, GridLayoutDetail, GridMatrix, GridMatrixCell, GridMatrixLabels, GridPreset, GridRow, GridSavedView, GridSort, GridView, GridViewLabels };

export interface GridProps extends Omit<JSX.HTMLAttributes<NxGrid>, "onChange" | "onError"> {
  columns: GridColumn[];
  /** Filas en el cliente. Sin `source`, se filtra, ordena y agrega aquí. */
  rows?: GridRow[];
  /** URL de datos en el servidor (POST `{offset, limit, sort, filters}` → `GridPage`). */
  source?: string;
  /** Con `source`: si la consulta completa tiene hasta este tanto de filas, se trae una vez y se filtra en el cliente. */
  clientMax?: number;
  filters?: GridFilter[];
  sort?: GridSort | null;
  /** Buscar en la tabla: lo que dice la caja (asignarlo busca). */
  search?: string;
  /** Filtros, orden, agrupación, columnas ocultas y anchos de una vez. */
  view?: Partial<GridView>;
  /** Clave de `localStorage` para las vistas con nombre. Sin ella no hay menú de vistas. */
  viewsStorage?: string;
  /** Las vistas guardadas (asignarlas las guarda). */
  views?: GridSavedView[];
  groupBy?: string;
  rowKey?: string;
  facetsOpen?: boolean;
  /** Cómo compara lo escrito al buscar y filtrar en el navegador. Por omisión (`"fold"`), sin
   *  tildes ni mayúsculas; `"exact"`, sin mayúsculas pero con sus tildes y su ñ («pena» no
   *  encuentra «PEÑA»), la regla del servidor para datos de un ERP en mayúsculas. */
  accents?: GridAccents;
  /** La barra de desplazamiento horizontal también arriba de la tabla (solo si no cabe a lo ancho). Viene encendida: `false` la quita. */
  topScrollbar?: boolean;
  /** Atajos: tarjetas con un filtro y su conteo sobre la tabla (con `heading`, botones junto al
   *  título; con `menu`, en «Vistas» → «Seguimiento»). */
  presets?: GridPreset[];
  /** El título de la tabla, en su primera fila, con los atajos como botones a la derecha. */
  heading?: string;
  /** El nivel del título (2 por defecto; 1 si es el de la página). */
  headingLevel?: number;
  /** Acciones de fila: botones (o enlaces, con `href`) en una columna fija a la derecha. */
  actions?: GridAction[];
  /** Casillas para seleccionar filas; las acciones van como hijo con `slot="bulk"`. */
  selectable?: boolean;
  selected?: string[];
  /** Alto del área con scroll en px, o `"fill"`: el alto de su contenedor, y solo la tabla se desplaza. */
  height?: number | "fill";
  filename?: string;
  /** Formato de números, montos, fechas y orden (`es-CO`, `en-US`…). Por defecto, el `lang` de la página. */
  locale?: string;
  labels?: Partial<GridLabels & GridViewLabels & GridMatrixLabels>;
  /** La matriz: «Tabla | Matriz» en la barra. `{rows, cols, agg, value}`, o `true` para las dos
   *  primeras columnas que se puedan cruzar. */
  matrix?: GridMatrix | boolean;
  /** `"matrix"` abre la matriz (con `matrix`). */
  layout?: GridLayout;
  /** La persona pasó entre la tabla y la matriz, o cambió la matriz. */
  onLayout?: (e: CustomEvent<GridLayoutDetail>) => void;
  onFilter?: (e: CustomEvent<GridFilterDetail>) => void;
  /** Las vistas guardadas cambiaron (guardar, renombrar, borrar). */
  onViews?: (e: CustomEvent<{ views: GridSavedView[] }>) => void;
  /** Cancelable: con `preventDefault()` la edición no se aplica. */
  onChange?: (e: CustomEvent<{ changes: GridChange[]; source: GridChangeSource }>) => void;
  onColumns?: (e: CustomEvent<{ columns: GridColumn[] }>) => void;
  onSelection?: (e: CustomEvent<{ ids: string[]; count: number }>) => void;
  /** Clic en una columna `link` o Enter en una fila: el detalle (p. ej. un `<Dialog mode="panel">`).
   *  Una fila con enlace (columna `href` con dirección) lo sigue y no emite. */
  onOpen?: (e: CustomEvent<{ id: string; row: GridRow; key: string; origin: HTMLElement | null }>) => void;
  /** El botón de una acción de fila (las que son enlace no emiten). */
  onAction?: (e: CustomEvent<GridActionDetail>) => void;
  /** Con `source`: un bloque no llegó (la tabla lo vuelve a pedir más tarde). */
  onError?: (e: CustomEvent<GridErrorDetail>) => void;
  /** Cómo terminó una exportación. */
  onExport?: (e: CustomEvent<GridExportDetail>) => void;
  children?: JSX.Element;
}

export function Grid(props: GridProps): JSX.Element {
  const [local, rest] = splitProps(props, ["columns", "rows", "view", "views", "viewsStorage", "onViews", "source", "clientMax", "filters", "sort", "search", "groupBy", "rowKey", "facetsOpen", "accents", "topScrollbar", "presets", "heading", "headingLevel", "actions", "height", "filename", "locale", "labels", "matrix", "layout", "onLayout", "onFilter", "onChange", "onColumns", "selectable", "selected", "onSelection", "onOpen", "onAction", "onError", "onExport", "children"]);
  // Solo los eventos de esta tabla: no los que suben de otro componente puesto como hijo (`slot="bulk"`).
  const own = <E extends Event>(fn: ((e: E) => void) | undefined) => (e: E) => e.target === e.currentTarget && fn?.(e);
  return (
    <nx-grid
      {...rest}
      attr:row-key={local.rowKey}
      attr:accents={local.accents === "exact" ? "exact" : undefined}
      prop:columns={local.columns}
      prop:rows={local.rows}
      prop:filters={local.filters}
      prop:sort={local.sort}
      prop:search={local.search}
      prop:presets={local.presets}
      prop:actions={local.actions}
      prop:view={local.view}
      prop:views={local.views}
      attr:views-storage={local.viewsStorage}
      on:nx-grid-views={own((e) => local.onViews?.(e))}
      prop:labels={local.labels}
      prop:matrix={local.matrix}
      attr:layout={local.layout === "matrix" ? "matrix" : undefined}
      on:nx-grid-layout={own((e) => local.onLayout?.(e))}
      attr:source={local.source}
      attr:client-max={local.clientMax ? String(local.clientMax) : undefined}
      attr:group-by={local.groupBy}
      attr:height={local.height === undefined ? undefined : String(local.height)}
      attr:heading={local.heading || undefined}
      attr:heading-level={local.headingLevel === undefined ? undefined : String(local.headingLevel)}
      attr:filename={local.filename}
      attr:locale={local.locale}
      bool:facets-open={!!local.facetsOpen}
      attr:top-scrollbar={local.topScrollbar === false ? "false" : undefined}
      on:nx-grid-filter={own((e) => local.onFilter?.(e))}
      on:nx-grid-change={own((e) => local.onChange?.(e))}
      on:nx-grid-columns={own((e) => local.onColumns?.(e))}
      on:nx-grid-selection={own((e) => local.onSelection?.(e))}
      on:nx-grid-open={own((e) => local.onOpen?.(e))}
      on:nx-grid-action={own((e) => local.onAction?.(e))}
      on:nx-grid-error={own((e) => local.onError?.(e))}
      on:nx-grid-export={own((e) => local.onExport?.(e))}
      prop:selected={local.selected}
      bool:selectable={!!local.selectable}
    >
      {local.children}
      {/* Tope de los hijos: ver «Hijos» en ./index.tsx. */}
      <template />
    </nx-grid>
  );
}
