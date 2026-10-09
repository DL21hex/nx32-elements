/**
 * La matriz de `<nx-grid>` (`matrix`, «Tabla | Matriz»): cruza dos columnas de pocos valores
 * (Área × Estado) y en cada cruce dice cuántas filas hay, o la suma o el promedio de una columna
 * numérica, con los totales de cada fila, de cada columna y el general. Se carga aparte, al pasar a
 * «Matriz».
 *
 * Ocupa el lugar de la tabla: se ve una cosa a la vez. Tocar un cruce vuelve a la tabla con los
 * filtros de esas dos columnas puestos (como chips); un encabezado o un total, con el de su
 * columna; el total general, sin ninguno de los dos. La matriz cuenta con la búsqueda y los demás
 * filtros, pero no con los de sus dos columnas: así, al volver, se ve todo y queda marcado el cruce
 * que filtra la tabla. Los cruces se calculan en la tabla (o los manda el servidor); este módulo
 * solo los pinta.
 *
 * Es una sola parada de Tab: dentro, las flechas recorren los botones (encabezados, cruces y
 * totales), Inicio y Fin van al primero y al último de la fila.
 */
import { h } from "../../core/dom";
import { glyph } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import type { NxFormat } from "../../core/locale";
import type { GridColumn, GridLabels, GridMatrix, GridMatrixCell, GridMatrixLabels } from "./types";

export const MATRIX_LABELS: GridMatrixLabels = {
  matrixRows: "Filas",
  matrixCols: "Columnas",
  matrixSwap: "Intercambiar filas y columnas",
  matrixShow: "Mostrar",
  matrixCount: "Cantidad",
  matrixSum: "Suma de {col}",
  matrixAvg: "Promedio de {col}",
  matrixTotal: "Total",
  matrixBlank: "(Sin dato)",
  matrixCell: "{row}, {col}: {value}",
  matrixNone: "ninguna",
  matrixHint: "Un cruce abre la tabla con esos dos filtros; un encabezado o un total, con el suyo.",
  matrixIgnores: "Aquí no cuentan tus filtros de {cols}: la matriz muestra todos sus valores y marca el que filtra la tabla.",
};

const SWAP = '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>';

/** La matriz con todo resuelto: los dos ejes, la medida y la columna que se suma (o ""). */
export interface MatrixConfig {
  rows: string;
  cols: string;
  agg: "count" | "sum" | "avg";
  value: string;
}

/** Lo que la tabla le da para pintar. */
export interface MatrixView {
  config: MatrixConfig;
  /** Las columnas que se pueden cruzar, en su orden. */
  axes: GridColumn[];
  /** Las columnas numéricas (para sumar o promediar). */
  measures: GridColumn[];
  /** Los cruces; `null` mientras llegan o si no llegaron. */
  cells: GridMatrixCell[] | null;
  loading: boolean;
  failed: boolean;
  /** El cruce que filtra la tabla: el valor de cada eje si su filtro es uno solo. */
  mark: { row: string | null; col: string | null };
  /** Los nombres de los ejes con filtros que la matriz no aplica. */
  ignored: string[];
}

/** Lo que la matriz necesita de la tabla. */
export interface MatrixHost {
  /** Donde se pinta (el lugar de la tabla). */
  readonly el: HTMLElement;
  readonly labels: GridLabels;
  /** Los textos tal como llegaron a `labels` (de ahí salen los de este módulo). */
  readonly labelsIn: unknown;
  readonly loc: NxFormat;
  view(): MatrixView;
  /** Otros ejes u otra medida. */
  configure(m: GridMatrix): void;
  /** Vuelve a la tabla con los filtros de ese cruce (`null`: sin filtro en ese eje). */
  drill(row: string | null, col: string | null): void;
  retry(): void;
}

/** Los valores de un eje, en orden: los declarados (`options`, aunque no tengan filas) y después
 *  los que aparecen, de más a menos filas; «sin dato» al final. */
function axisValues(col: GridColumn | undefined, cells: readonly GridMatrixCell[], side: "row" | "col", loc: NxFormat): string[] {
  const n = new Map<string, number>();
  for (const c of cells) n.set(c[side], (n.get(c[side]) ?? 0) + (c.count ?? c.value));
  const declared = (col?.options ?? []).map((o) => o.value).filter((v) => v !== "");
  const seen = new Set(declared);
  const rest = [...n.keys()].filter((v) => v !== "" && !seen.has(v)).sort((a, b) => n.get(b)! - n.get(a)! || loc.compare(a, b));
  return [...declared, ...rest, ...(n.has("") ? [""] : [])];
}

export class MatrixUI {
  #host: MatrixHost;
  #L: GridMatrixLabels = MATRIX_LABELS;
  #bar: HTMLElement;
  #rowsSel: HTMLSelectElement;
  #colsSel: HTMLSelectElement;
  #showSel: HTMLSelectElement;
  #swap: HTMLButtonElement;
  #box: HTMLElement;
  #note: HTMLElement;
  /** El botón que tiene la parada de Tab dentro de la tabla («fila,columna» de la cuadrícula). */
  #at = "";
  #sig = "";

  constructor(host: MatrixHost) {
    this.#host = host;
    const sel = () => h("select", { class: "nx-grid__btn nx-grid__group", "data-nx-ephemeral": "" });
    this.#rowsSel = sel();
    this.#colsSel = sel();
    this.#showSel = sel();
    this.#swap = h("button", { type: "button", class: "nx-grid__btn nx-grid__icon" }, glyph(SWAP));
    const field = (label: string, el: HTMLElement) => h("label", { class: "nx-grid__mx-field", "data-label": label }, h("span"), el);
    this.#bar = h("div", { class: "nx-grid__mx-bar" }, field("rows", this.#rowsSel), this.#swap, field("cols", this.#colsSel), field("show", this.#showSel));
    this.#box = h("div", { class: "nx-grid__mx-scroll" });
    this.#note = h("p", { class: "nx-grid__mx-note" });
    host.el.replaceChildren(this.#bar, this.#box, this.#note);

    const set = (m: GridMatrix) => host.configure(m);
    this.#rowsSel.addEventListener("change", () => {
      const c = host.view().config;
      const v = this.#rowsSel.value;
      set({ rows: v, cols: v === c.cols ? c.rows : c.cols });
    });
    this.#colsSel.addEventListener("change", () => {
      const c = host.view().config;
      const v = this.#colsSel.value;
      set({ cols: v, rows: v === c.rows ? c.cols : c.rows });
    });
    this.#swap.addEventListener("click", () => {
      const c = host.view().config;
      set({ rows: c.cols, cols: c.rows });
    });
    this.#showSel.addEventListener("change", () => {
      const [agg, value = ""] = this.#showSel.value.split(":");
      set({ agg: agg as MatrixConfig["agg"], value });
    });
    this.#box.addEventListener("click", (e) => {
      const b = (e.target as Element).closest<HTMLButtonElement>("button[data-at]");
      if (b?.dataset.retry !== undefined) return host.retry();
      if (!b) return;
      this.#at = b.dataset.at!;
      if (b.dataset.all !== undefined) return host.drill(null, null);
      host.drill(b.dataset.row ?? null, b.dataset.col ?? null);
    });
    this.#box.addEventListener("keydown", (e) => this.#onKey(e));
  }

  paint(): void {
    const host = this.#host;
    const v = host.view();
    const L = (this.#L = mergeLabels(MATRIX_LABELS, host.labelsIn));
    const G = host.labels;
    const loc = host.loc;
    const { config: m } = v;
    // La barra: los dos ejes y la medida.
    for (const lab of this.#bar.querySelectorAll<HTMLElement>("[data-label]")) {
      const k = lab.dataset.label;
      lab.firstElementChild!.textContent = k === "rows" ? L.matrixRows : k === "cols" ? L.matrixCols : L.matrixShow;
    }
    const axisOpts = (cur: string) => v.axes.map((c) => h("option", { value: c.key, selected: c.key === cur || null }, c.label));
    this.#rowsSel.replaceChildren(...axisOpts(m.rows));
    this.#colsSel.replaceChildren(...axisOpts(m.cols));
    this.#rowsSel.value = m.rows;
    this.#colsSel.value = m.cols;
    this.#swap.setAttribute("aria-label", L.matrixSwap);
    this.#swap.title = L.matrixSwap;
    const show = m.agg === "count" ? "count" : `${m.agg}:${m.value}`;
    this.#showSel.replaceChildren(
      h("option", { value: "count" }, L.matrixCount),
      ...v.measures.flatMap((c) => [h("option", { value: `sum:${c.key}` }, fmt(L.matrixSum, { col: c.label })), h("option", { value: `avg:${c.key}` }, fmt(L.matrixAvg, { col: c.label }))]),
    );
    this.#showSel.value = show;
    this.#showSel.parentElement!.hidden = !v.measures.length;

    const focused = this.#box.contains(document.activeElement);
    // Mientras llega o si no llegó: el aviso en el lugar de la tabla.
    if (v.loading || v.failed || !v.cells) {
      this.#sig = "";
      this.#box.replaceChildren(
        h(
          "p",
          { class: "nx-grid__mx-state", role: "status" },
          v.failed ? G.loadError : G.loading,
          v.failed ? h("button", { type: "button", class: "nx-grid__btn", "data-at": "retry", "data-retry": "" }, G.retry) : null,
        ),
      );
      this.#note.hidden = true;
      return;
    }
    const sig = JSON.stringify([m, v.cells, v.mark, L, G.loading, loc.locale, v.axes.map((c) => c.key)]);
    if (sig !== this.#sig) {
      this.#sig = sig;
      this.#table(v, L);
    }
    this.#note.hidden = false;
    this.#note.textContent = v.ignored.length ? fmt(L.matrixIgnores, { cols: v.ignored.map((x) => `«${x}»`).join(", ") }) : L.matrixHint;
    if (focused) this.#focus(this.#at);
  }

  #table(v: MatrixView, L: GridMatrixLabels): void {
    const loc = this.#host.loc;
    const m = v.config;
    const cells = v.cells!;
    const rowCol = v.axes.find((c) => c.key === m.rows);
    const colCol = v.axes.find((c) => c.key === m.cols);
    const rows = axisValues(rowCol, cells, "row", loc);
    const cols = axisValues(colCol, cells, "col", loc);
    if (!rows.length || !cols.length) {
      this.#box.replaceChildren(h("p", { class: "nx-grid__mx-state" }, this.#host.labels.empty));
      return;
    }
    // Los nombres: «sin dato», la etiqueta de la opción, la que mandó el servidor, o el valor.
    const names = { row: new Map<string, string>(), col: new Map<string, string>() };
    for (const c of cells) {
      if (c.rowLabel) names.row.set(c.row, c.rowLabel);
      if (c.colLabel) names.col.set(c.col, c.colLabel);
    }
    const name = (side: "row" | "col", x: string) => (x === "" ? L.matrixBlank : ((side === "row" ? rowCol : colCol)?.options?.find((o) => o.value === x)?.label ?? names[side].get(x) ?? x));
    const at = new Map(cells.map((c) => [`${c.row}\u0000${c.col}`, c]));
    // Un total: los conteos y las sumas se suman; los promedios se ponderan por sus filas (sin
    // ellas no hay cómo: va sin total).
    const total = (list: GridMatrixCell[]): number | null => {
      if (m.agg !== "avg") return list.reduce((a, c) => a + c.value, 0);
      let n = 0;
      let s = 0;
      for (const c of list) {
        if (c.count === undefined) return null;
        n += c.count;
        s += c.value * c.count;
      }
      return n ? s / n : 0;
    };
    const measure = v.measures.find((c) => c.key === m.value);
    const inner = cells.filter((c) => rows.includes(c.row) && cols.includes(c.col));
    const max = Math.max(0, ...inner.map((c) => c.value));
    const money = m.agg !== "count" && measure?.type === "money";
    const short = money && max >= 1e6;
    const show = (n: number | null) => (n === null ? "—" : m.agg === "count" ? loc.number(n) : money ? loc.money(n, measure!, short) : loc.number(m.agg === "avg" ? Math.round(n * 10) / 10 : n));

    const mark = v.mark;
    const btn = (attrs: Record<string, string | number | boolean | null>, text: string, label?: string) =>
      h("button", { type: "button", tabindex: -1, ...attrs, ...(label ? { "aria-label": label } : {}) }, text);
    // Un total sin filas no lleva a ninguna parte: va como texto.
    const tot = (t: number | null, attrs: Record<string, string>, label: string) =>
      t ? h("td", { class: "nx-grid__mx-tot" }, btn(attrs, show(t), `${label}: ${show(t)}`)) : h("td", { class: "nx-grid__mx-tot nx-grid__mx-zero" }, show(t));
    const rowName = rowCol?.label ?? m.rows;
    const colName = colCol?.label ?? m.cols;

    const head = h(
      "tr",
      null,
      h("th", { scope: "col", class: "nx-grid__mx-corner" }, h("span", { class: "nx-sr-only" }, rowName)),
      ...cols.map((c, j) => h("th", { scope: "col" }, btn({ "data-at": `0,${j + 1}`, "data-col": c, "aria-pressed": String(mark.col === c && mark.row === null) }, name("col", c)))),
      h("th", { scope: "col", class: "nx-grid__mx-tot" }, L.matrixTotal),
    );
    const body = rows.map((r, i) => {
      const line = cols.map((c) => at.get(`${r}\u0000${c}`));
      const t = total(cells.filter((x) => x.row === r));
      return h(
        "tr",
        null,
        h("th", { scope: "row" }, btn({ "data-at": `${i + 1},0`, "data-row": r, "aria-pressed": String(mark.row === r && mark.col === null) }, name("row", r))),
        ...line.map((x, j) => {
          const label = fmt(L.matrixCell, { row: name("row", r), col: name("col", cols[j]), value: x ? show(x.value) : L.matrixNone });
          if (!x) return h("td", { class: "nx-grid__mx-zero", title: label }, h("span", { "aria-hidden": "true" }, "·"), h("span", { class: "nx-sr-only" }, label));
          const w = max > 0 ? Math.max(0, x.value) / max : 0;
          const td = h("td", null, btn({ "data-at": `${i + 1},${j + 1}`, "data-row": r, "data-col": cols[j], "aria-pressed": String(mark.row === r && mark.col === cols[j]), title: label }, show(x.value), label));
          td.style.setProperty("--_w", w.toFixed(3));
          return td;
        }),
        tot(t, { "data-at": `${i + 1},${cols.length + 1}`, "data-row": r }, `${L.matrixTotal}, ${name("row", r)}`),
      );
    });
    const foot = h(
      "tr",
      null,
      h("th", { scope: "row", class: "nx-grid__mx-tot" }, L.matrixTotal),
      ...cols.map((c, j) => {
        const t = total(cells.filter((x) => x.col === c));
        return tot(t, { "data-at": `${rows.length + 1},${j + 1}`, "data-col": c }, `${L.matrixTotal}, ${name("col", c)}`);
      }),
      h("td", { class: "nx-grid__mx-tot nx-grid__mx-all" }, btn({ "data-at": `${rows.length + 1},${cols.length + 1}`, "data-all": "" }, show(total(inner)), `${L.matrixTotal}: ${show(total(inner))}`)),
    );
    this.#box.replaceChildren(h("table", { class: "nx-grid__mx" }, h("caption", { class: "nx-sr-only" }, `${rowName} × ${colName}`), h("thead", null, head), h("tbody", null, ...body), h("tfoot", null, foot)));
    // La parada de Tab: la que tenía, la del cruce marcado o el primer cruce.
    const pressed = this.#box.querySelector<HTMLElement>('[aria-pressed="true"]');
    const keep = this.#at && this.#box.querySelector(`[data-at="${this.#at}"]`) ? this.#at : (pressed?.dataset.at ?? this.#box.querySelector<HTMLElement>("td > button")?.dataset.at ?? "0,1");
    this.#tab(keep);
  }

  #tab(key: string): HTMLElement | null {
    let target: HTMLElement | null = null;
    for (const b of this.#box.querySelectorAll<HTMLElement>("button[data-at]")) {
      const on = b.dataset.at === key;
      b.tabIndex = on ? 0 : -1;
      if (on) target = b;
    }
    if (target) this.#at = key;
    return target;
  }

  #focus(key: string): void {
    (this.#tab(key) ?? this.#box.querySelector<HTMLElement>("button[data-at]"))?.focus();
  }

  /** Flechas: al botón siguiente en esa dirección (los cruces sin filas no tienen botón: se saltan). */
  #onKey(e: KeyboardEvent): void {
    const b = (e.target as Element).closest<HTMLElement>("button[data-at]");
    if (!b || e.altKey || e.ctrlKey || e.metaKey) return;
    const [r, c] = b.dataset.at!.split(",").map(Number);
    const has = (i: number, j: number) => !!this.#box.querySelector(`[data-at="${i},${j}"]`);
    const all = [...this.#box.querySelectorAll<HTMLElement>("button[data-at]")].map((x) => x.dataset.at!.split(",").map(Number));
    const maxR = Math.max(...all.map(([i]) => i));
    const maxC = Math.max(...all.map(([, j]) => j));
    const walk = (dr: number, dc: number): string | null => {
      for (let i = r + dr, j = c + dc; i >= 0 && j >= 0 && i <= maxR && j <= maxC; i += dr, j += dc) if (has(i, j)) return `${i},${j}`;
      return null;
    };
    const row = all.filter(([i]) => i === r).map(([, j]) => j);
    const to =
      e.key === "ArrowRight" ? walk(0, 1)
      : e.key === "ArrowLeft" ? walk(0, -1)
      : e.key === "ArrowDown" ? walk(1, 0)
      : e.key === "ArrowUp" ? walk(-1, 0)
      : e.key === "Home" ? `${r},${Math.min(...row)}`
      : e.key === "End" ? `${r},${Math.max(...row)}`
      : undefined;
    if (to === undefined) return;
    e.preventDefault();
    if (to) this.#focus(to);
  }
}

const fmt = (t: string, vars: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
