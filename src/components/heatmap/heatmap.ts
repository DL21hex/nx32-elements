/**
 * `<nx-heatmap>`: un mapa de calor. Filas × columnas (áreas × meses, sedes × días) con el valor
 * escrito en cada celda y su color en una escala.
 *
 * Reglas de diseño:
 * - **Es una tabla de verdad.** `<table>` con sus encabezados (`<th scope>`): el lector la recorre
 *   como cualquier tabla y el número está escrito en la celda; el color acompaña, no reemplaza.
 * - **Una sola escala.** Secuencial (de la superficie al tono fuerte, `--nx-chart-seq`) o
 *   divergente alrededor de `mid` (dos polos y un centro neutro). Nunca un arcoíris. El texto
 *   cambia a `--nx-chart-seq-ink` sobre las celdas oscuras. La leyenda dice los dos extremos.
 * - **Totales que no se suman.** La columna final es el `total` de cada fila tal como lo manda la
 *   app (una tasa del periodo no es la suma de las tasas de los meses), con su `delta` y una
 *   flecha; `polarity` dice si subir es malo (por defecto) o bueno.
 * - **Filtra el tablero.** `row-dimension` y `column-dimension`: el nombre de una fila filtra por
 *   ella, el de una columna por ella y una celda por las dos (`data-nx-filter="area:emp,mes:20"`).
 *   Con marcas, una sola parada de <kbd>Tab</kbd> y las flechas recorren la tabla (Inicio y Fin en
 *   la fila; con Ctrl, la tabla). Emite `nx-heatmap-select`.
 */
import { attrProps, Base, boolAttr, upgrade } from "../../core/define";
import { emit, h } from "../../core/dom";
import { chartValue, ChartTip, markAttrs, tipContent, type TipRow } from "../../core/chart";
import { mergeLabels } from "../../core/labels";
import { resolveLocale } from "../../core/locale";
import { cleanColumns, cleanRows, cleanValues, heatDomain, intensity, mixPct, moveCell } from "./logic";
import type { HeatColumn, HeatmapLabels, HeatmapSelectDetail, HeatRow, HeatScale } from "./types";

export const HEATMAP_LABELS: HeatmapLabels = {
  empty: "Sin datos.",
  total: "Total",
  cell: "{row}, {column}: {value}",
  noData: "Sin dato",
  scale: "Escala de color",
  points: "{n} pp",
};

const fill = (t: string, map: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => (Object.hasOwn(map, k) ? map[k] : m));
const num = (v: string | null): number | null => {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export class NxHeatmap extends Base {
  static {
    attrProps(this, ["format", "currency", "decimals", "locale", "min", "max", "mid", "scale", "polarity", "rowDimension", "columnDimension", "totalLabel"]);
  }
  /** `number` (por defecto), `money` o `percent` (el valor llega como fracción: 0,031 → «3,1 %»). */
  declare format: string | null;
  declare currency: string | null;
  /** Decimales de cada celda (en `percent`, 1 por defecto). */
  declare decimals: string | null;
  declare locale: string | null;
  /** El extremo débil de la escala (0, o el menor valor si hay negativos). */
  declare min: string | null;
  /** El extremo fuerte (el mayor valor): fijarlo hace comparables dos mapas. */
  declare max: string | null;
  /** El centro de una escala divergente (0). */
  declare mid: string | null;
  /** `sequential` (por defecto) o `diverging`. */
  declare scale: string | null;
  /** Si subir es malo (`up-bad`, por defecto: el ausentismo) o bueno (`up-good`). Colorea el `delta`. */
  declare polarity: string | null;
  /** La dimensión de `<nx-board>` de las filas (cada `id` es un valor). */
  declare rowDimension: string | null;
  /** La dimensión de `<nx-board>` de las columnas. */
  declare columnDimension: string | null;
  /** El encabezado de la columna de totales (labels.total si no). */
  declare totalLabel: string | null;
  static observedAttributes = ["rows", "columns", "values", "labels", "format", "currency", "decimals", "locale", "min", "max", "mid", "scale", "polarity", "row-dimension", "column-dimension", "total-label", "selectable"];

  #rows: HeatRow[] = [];
  #cols: HeatColumn[] = [];
  #raw: unknown = [];
  #values: (number | null)[][] = [];
  #labels: HeatmapLabels = HEATMAP_LABELS;
  #root?: HTMLDivElement;
  #tip?: ChartTip;
  #abort?: AbortController;
  #queued = false;
  #tips = new Map<string, Node[]>();
  /** La posición que tiene el foco (la única con `tabindex="0"`). */
  #pos: [number, number] = [0, 0];

  /** Las filas: `{id, label, note?, total?, delta?}`. */
  get rows(): HeatRow[] {
    return this.#rows;
  }
  set rows(value: HeatRow[] | null | undefined) {
    this.#rows = cleanRows(value);
    this.#schedule();
  }
  /** Las columnas: `{id, label}`. */
  get columns(): HeatColumn[] {
    return this.#cols;
  }
  set columns(value: HeatColumn[] | null | undefined) {
    this.#cols = cleanColumns(value);
    this.#schedule();
  }
  /** Los valores, fila por fila (`values[fila][columna]`); `null` es «sin dato». */
  get values(): (number | null)[][] {
    return this.#values;
  }
  set values(value: (number | null)[][] | null | undefined) {
    this.#raw = value ?? [];
    this.#schedule();
  }
  get labels(): HeatmapLabels {
    return this.#labels;
  }
  set labels(value: Partial<HeatmapLabels> | null | undefined) {
    this.#labels = mergeLabels(HEATMAP_LABELS, value);
    this.#schedule();
  }
  /** Las celdas y los encabezados se tocan y emiten `nx-heatmap-select`, aunque no haya dimensión. */
  get selectable(): boolean {
    return boolAttr(this, "selectable");
  }
  set selectable(v: boolean | null | undefined) {
    this.toggleAttribute("selectable", !!v);
  }

  connectedCallback(): void {
    upgrade(this);
    this.#root ??= h("div", { class: "nx-heatmap__root" }) as HTMLDivElement;
    if (this.#root.parentNode !== this) this.append(this.#root);
    this.#abort?.abort();
    const signal = (this.#abort = new AbortController()).signal;
    this.#tip ??= new ChartTip(this, (k) => this.#tips.get(k) ?? null);
    this.#tip.attach(signal);
    this.#root.addEventListener("click", this.#onClick, { signal });
    this.#root.addEventListener("keydown", this.#onKey, { signal });
    this.#render();
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
    this.#tip?.hide();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "rows" || name === "columns" || name === "values" || name === "labels") {
      if (value === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        console.warn(`[nx-heatmap] el atributo "${name}" no es JSON válido`);
        return;
      }
      (this as unknown as Record<string, unknown>)[name] = parsed;
      return;
    }
    this.#schedule();
  }

  #schedule(): void {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      if (!this.#queued) return;
      this.#queued = false;
      if (this.isConnected && this.#root) this.#render();
    });
  }

  #decimals(): number | null {
    const d = num(this.decimals);
    return d ?? (this.format === "percent" ? 1 : null);
  }

  #fmt(v: number): string {
    return chartValue(v, { format: this.format, currency: this.currency, locale: resolveLocale(this), decimals: this.#decimals() });
  }

  /** El valor en la celda: corto (sin el «%», que ya dice el encabezado del panel). */
  #cellText(v: number): string {
    if (this.format === "percent") return chartValue(v * 100, { locale: resolveLocale(this), decimals: this.#decimals() ?? 1 });
    return this.format === "money" ? chartValue(v, { format: "money", currency: this.currency, locale: resolveLocale(this), short: true }) : this.#fmt(v);
  }

  #delta(d: number): string {
    const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "=";
    const loc = resolveLocale(this);
    if (this.format === "percent") return `${arrow} ${fill(this.#labels.points, { n: chartValue(Math.abs(d) * 100, { locale: loc, decimals: 1 }) })}`;
    return `${arrow} ${this.#fmt(Math.abs(d))}`;
  }

  #render(): void {
    const root = this.#root!;
    this.#queued = false;
    this.#tips.clear();
    this.#tip?.hide();
    this.#values = cleanValues(this.#raw, this.#rows.length, this.#cols.length);
    const L = this.#labels;
    if (!this.#rows.length || !this.#cols.length) {
      root.replaceChildren(h("p", { class: "nx-heatmap__empty" }, L.empty));
      return;
    }
    const scale: HeatScale = this.scale === "diverging" ? "diverging" : "sequential";
    const dom = heatDomain(this.#values, scale, { min: num(this.min), max: num(this.max), mid: num(this.mid) });
    const rd = this.rowDimension?.trim() || null, cd = this.columnDimension?.trim() || null;
    const rowsLive = !!rd || this.selectable, colsLive = !!cd || this.selectable, cellsLive = !!rd || !!cd || this.selectable;
    const hasTotal = this.#rows.some((r) => r.total !== undefined || r.delta !== undefined);
    const upGood = this.polarity === "up-good";
    // El foco vuelve a una posición que exista (las filas o columnas pueden haber cambiado).
    const [pr, pc] = this.#pos;
    if (pr >= this.#rows.length || pc >= this.#cols.length) this.#pos = [0, 0];

    const head = h("tr", null, h("td", { class: "nx-heatmap__corner" }));
    this.#cols.forEach((c, j) => {
      const inner = colsLive ? h("button", { type: "button", class: "nx-heatmap__hd", "data-r": "-1", "data-c": String(j), tabindex: "-1", ...markAttrs([[cd, c.id]], c.label) }, c.label) : c.label;
      head.append(h("th", { scope: "col" }, inner));
    });
    if (hasTotal) head.append(h("th", { scope: "col", class: "nx-heatmap__totalhd" }, this.totalLabel || L.total));

    const body = h("tbody");
    this.#rows.forEach((r, i) => {
      const label = [h("span", { class: "nx-heatmap__rowname" }, r.label), r.note ? h("small", null, r.note) : null];
      const rh = rowsLive ? h("button", { type: "button", class: "nx-heatmap__rl", "data-r": String(i), "data-c": "-1", tabindex: "-1", ...markAttrs([[rd, r.id]], r.label) }, ...label) : h("span", { class: "nx-heatmap__rl" }, ...label);
      const tr = h("tr", null, h("th", { scope: "row" }, rh));
      this.#cols.forEach((c, j) => {
        const v = this.#values[i][j];
        const it = intensity(v, dom, scale);
        const text = v === null ? "—" : this.#cellText(v);
        const key = `${i}:${j}`;
        const rows: TipRow[] = [[null, c.label, v === null ? L.noData : this.#fmt(v)]];
        this.#tips.set(key, tipContent(r.label, rows, r.note));
        const aria = fill(L.cell, { row: r.label, column: c.label, value: v === null ? L.noData : this.#fmt(v) });
        const attrs: Record<string, string> = { class: "nx-heatmap__c", "data-nx-tip": key, "data-r": String(i), "data-c": String(j) };
        const cell = cellsLive
          ? h("button", { ...attrs, type: "button", tabindex: "-1", "aria-label": aria, ...markAttrs([[rd, r.id], [cd, c.id]], `${r.label} · ${c.label}`) }, text)
          : h("span", { ...attrs, "aria-label": aria }, text);
        if (it) {
          const pct = mixPct(it.t);
          cell.style.setProperty("--nx-heatmap-mix", `${pct}%`);
          if (it.side < 0) cell.dataset.neg = "";
          if (pct > 55) cell.dataset.strong = "";
        } else cell.dataset.empty = "";
        tr.append(h("td", null, cell));
      });
      if (hasTotal) {
        const td = h("td", { class: "nx-heatmap__total" });
        if (r.total !== undefined) td.append(h("b", null, this.#fmt(r.total)));
        if (r.delta !== undefined) {
          const bad = upGood ? r.delta < 0 : r.delta > 0;
          const good = upGood ? r.delta > 0 : r.delta < 0;
          td.append(h("small", { class: bad ? "is-bad" : good ? "is-good" : "" }, this.#delta(r.delta)));
        }
        tr.append(td);
      }
      body.append(tr);
    });

    const table = h("table", { class: "nx-heatmap__table" }, h("thead", null, head), body);
    const legend = h(
      "div",
      { class: "nx-heatmap__scale", role: "img", "aria-label": `${L.scale}: ${this.#fmt(dom.min)} – ${this.#fmt(dom.max)}` },
      h("span", null, this.#fmt(dom.min)),
      h("i", { class: scale === "diverging" ? "is-diverging" : "" }),
      h("span", null, this.#fmt(dom.max)),
    );
    root.replaceChildren(h("div", { class: "nx-heatmap__scroll" }, table), legend);
    if (cellsLive || rowsLive || colsLive) this.#roving(false);
  }

  /** El elemento enfocable de una posición, si existe. */
  #at(r: number, c: number): HTMLElement | null {
    return this.#root?.querySelector<HTMLElement>(`button[data-r="${r}"][data-c="${c}"]`) ?? null;
  }

  /** Deja una sola parada de Tab: la posición actual (o la primera que exista). */
  #roving(focus: boolean): void {
    const root = this.#root!;
    let el = this.#at(...this.#pos);
    if (!el) {
      el = root.querySelector<HTMLElement>("button[data-r]");
      if (el) this.#pos = [Number(el.dataset.r), Number(el.dataset.c)];
    }
    for (const b of root.querySelectorAll<HTMLElement>("button[data-r]")) b.tabIndex = b === el ? 0 : -1;
    if (focus) el?.focus();
  }

  #onKey = (e: KeyboardEvent): void => {
    const t = e.target instanceof HTMLElement && e.target.matches("button[data-r]") ? e.target : null;
    if (!t) return;
    const r = Number(t.dataset.r), c = Number(t.dataset.c);
    const next = moveCell(r, c, e.key, this.#rows.length, this.#cols.length, e.ctrlKey || e.metaKey);
    if (!next) return;
    if (!this.#at(...next)) return;
    e.preventDefault();
    this.#pos = next;
    this.#roving(true);
  };

  #onClick = (e: MouseEvent): void => {
    const b = (e.target as Element | null)?.closest?.("button[data-r]") as HTMLElement | null;
    if (!b) return;
    const r = Number(b.dataset.r), c = Number(b.dataset.c);
    this.#pos = [r, c];
    this.#roving(false);
    const detail: HeatmapSelectDetail = {
      row: r >= 0 ? this.#rows[r] ?? null : null,
      column: c >= 0 ? this.#cols[c] ?? null : null,
      value: r >= 0 && c >= 0 ? this.#values[r]?.[c] ?? null : null,
    };
    emit(this, "nx-heatmap-select", detail);
  };
}
