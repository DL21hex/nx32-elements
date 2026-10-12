/**
 * `<nx-bars>`: barras por categoría. Horizontales (una lista: diagnósticos, entidades, áreas) o
 * columnas (días de la semana, tramos de duración), simples o apiladas por serie.
 *
 * Reglas de diseño:
 * - **El nombre se lee completo y el número al lado.** En horizontal, cada renglón es nombre ·
 *   valor (· acumulado) con la barra debajo, a lo ancho; en columnas, el valor arriba y el nombre
 *   abajo. Marcas finas, extremos redondeados de 4 px y un riel suave detrás.
 * - **El orden lo pone la app.** El componente no reordena: un ranking llega ordenado, los días de
 *   la semana llegan en su orden. `limit` muestra las primeras y resume las demás («y 16 más con
 *   el 32 % del total»).
 * - **Pareto y referencia sin segundo eje.** `cumulative` agrega el % acumulado como texto (no una
 *   línea con otra escala); `reference` es una línea punteada con su nombre («parejo», «meta»).
 * - **Apiladas por serie.** `series` + `parts` en cada ítem; los colores son los de la paleta en su
 *   orden (`ramp="ordinal"` para tramos ordenados, como la antigüedad de una cartera), con leyenda.
 * - **Filtra el tablero.** Con `dimension`, cada barra es un botón con `data-nx-filter`: dentro de
 *   un `<nx-board>`, un clic filtra todo. Con `selectable` (o `dimension`), emite `nx-bars-select`.
 *   Sin ninguno de los dos, son renglones que no se tocan, y el tooltip sigue a mano.
 */
import { attrProps, Base, boolAttr, upgrade } from "../../core/define";
import { emit, h } from "../../core/dom";
import { chartValue, ChartTip, markAttrs, shareText, slotOf, tipContent, type TipRow } from "../../core/chart";
import { mergeLabels } from "../../core/labels";
import { resolveLocale } from "../../core/locale";
import { barPct, cleanBars, cleanSeries, layoutBars } from "./logic";
import type { BarItem, BarSeries, BarsLabels, BarsSelectDetail } from "./types";

export const BARS_LABELS: BarsLabels = {
  empty: "Sin datos.",
  more: "Y {n} más con el {share} del total.",
  value: "Valor",
  cumulative: "Acum.",
  share: "Del total",
  item: "{label}: {value}",
};

const fill = (t: string, map: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => (Object.hasOwn(map, k) ? map[k] : m));
const num = (v: string | null): number | null => {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export class NxBars extends Base {
  static {
    attrProps(this, ["orientation", "format", "currency", "decimals", "limit", "reference", "referenceLabel", "dimension", "ramp", "max", "height", "locale"]);
  }
  /** `horizontal` (por defecto: una lista) o `vertical` (columnas). */
  declare orientation: string | null;
  /** `number` (por defecto), `money` o `percent` (el valor llega como fracción). */
  declare format: string | null;
  /** La moneda de `money` (ISO, «COP»). */
  declare currency: string | null;
  /** Decimales del valor. */
  declare decimals: string | null;
  /** Cuántas barras se ven; las demás se resumen en una línea. */
  declare limit: string | null;
  /** Una línea punteada en este valor (lo parejo, la meta). */
  declare reference: string | null;
  /** El nombre de la línea de referencia («parejo»). */
  declare referenceLabel: string | null;
  /** La dimensión de `<nx-board>` que filtran las barras (cada `id` es un valor). */
  declare dimension: string | null;
  /** Colores de las partes apiladas: `categorical` (por defecto) u `ordinal`. */
  declare ramp: string | null;
  /** El valor que llena la escala, si debe ser más que la barra más larga (dos gráficos comparables). */
  declare max: string | null;
  /** Alto de las columnas en px (`vertical`; 180 por defecto). */
  declare height: string | null;
  declare locale: string | null;
  static observedAttributes = ["items", "series", "labels", "orientation", "format", "currency", "decimals", "limit", "reference", "reference-label", "dimension", "ramp", "max", "height", "locale", "cumulative", "selectable"];

  #items: BarItem[] = [];
  #series: BarSeries[] = [];
  #labels: BarsLabels = BARS_LABELS;
  #root?: HTMLDivElement;
  #tip?: ChartTip;
  #abort?: AbortController;
  #queued = false;
  /** Lo que muestra cada tooltip, por clave. */
  #tips = new Map<string, Node[]>();
  #byId = new Map<string, BarItem>();

  /** Las barras: `{id, label, value, code?, note?, parts?, extra?}`, en el orden en que se ven. */
  get items(): BarItem[] {
    return this.#items;
  }
  set items(value: BarItem[] | null | undefined) {
    this.#items = cleanBars(value);
    this.#schedule();
  }
  /** Las series de las barras apiladas: `{id, label, slot?}` (hasta 8). */
  get series(): BarSeries[] {
    return this.#series;
  }
  set series(value: BarSeries[] | null | undefined) {
    this.#series = cleanSeries(value);
    this.#schedule();
  }
  get labels(): BarsLabels {
    return this.#labels;
  }
  set labels(value: Partial<BarsLabels> | null | undefined) {
    this.#labels = mergeLabels(BARS_LABELS, value);
    this.#schedule();
  }
  /** Agrega el % acumulado (Pareto) junto al valor. */
  get cumulative(): boolean {
    return boolAttr(this, "cumulative");
  }
  set cumulative(v: boolean | null | undefined) {
    this.toggleAttribute("cumulative", !!v);
  }
  /** Las barras se tocan (botones) y emiten `nx-bars-select`, aunque no haya `dimension`. */
  get selectable(): boolean {
    return boolAttr(this, "selectable");
  }
  set selectable(v: boolean | null | undefined) {
    this.toggleAttribute("selectable", !!v);
  }

  connectedCallback(): void {
    upgrade(this);
    this.#root ??= h("div", { class: "nx-bars__root" }) as HTMLDivElement;
    if (this.#root.parentNode !== this) this.append(this.#root);
    this.#abort?.abort();
    const signal = (this.#abort = new AbortController()).signal;
    this.#tip ??= new ChartTip(this, (k) => this.#tips.get(k) ?? null);
    this.#tip.attach(signal);
    this.#root.addEventListener("click", this.#onClick, { signal });
    this.#render();
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
    this.#tip?.hide();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "items" || name === "series" || name === "labels") {
      if (value === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        console.warn(`[nx-bars] el atributo "${name}" no es JSON válido`);
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

  #fmt(v: number, short = false): string {
    return chartValue(v, { format: this.format, currency: this.currency, locale: resolveLocale(this), decimals: num(this.decimals), short });
  }

  #slot(i: number): string {
    const s = this.#series[i];
    if (s?.slot) return String(s.slot);
    return slotOf(i, this.ramp === "ordinal");
  }

  #render(): void {
    const root = this.#root!;
    this.#queued = false;
    this.#tips.clear();
    this.#byId.clear();
    this.#tip?.hide();
    const L = this.#labels;
    if (!this.#items.length) {
      root.replaceChildren(h("p", { class: "nx-bars__empty" }, L.empty));
      return;
    }
    const lay = layoutBars(this.#items, { limit: num(this.limit), reference: num(this.reference), max: num(this.max) });
    const vertical = this.orientation === "vertical";
    const stacked = this.#series.length > 0 && lay.shown.some((it) => it.parts?.some((p) => p > 0));
    const out: Node[] = [];
    if (stacked) {
      out.push(h("ul", { class: "nx-bars__legend" }, ...this.#series.map((s, i) => h("li", null, h("i", { class: "nx-chart-sw", "data-nx-slot": this.#slot(i) }), s.label))));
    }
    out.push(vertical ? this.#columns(lay, stacked) : this.#rows(lay, stacked));
    if (lay.hidden.length) {
      const rest = lay.hidden.reduce((s, it) => s + Math.max(0, it.value), 0);
      out.push(h("p", { class: "nx-bars__more" }, fill(L.more, { n: String(lay.hidden.length), share: shareText(rest, lay.total, resolveLocale(this)) })));
    }
    root.replaceChildren(...out);
  }

  /** El botón (o el renglón quieto) de una barra, con su marca, su tooltip y su nombre accesible. */
  #mark(it: BarItem, i: number, total: number, cum: number | null, cls: string, ...children: Node[]): HTMLElement {
    const loc = resolveLocale(this);
    const value = this.#fmt(it.value);
    const share = shareText(it.value, total, loc);
    const name = it.code ? `${it.code} · ${it.label}` : it.label;
    const rows: TipRow[] = [];
    if (it.parts?.length && this.#series.length) {
      this.#series.forEach((s, k) => {
        const v = it.parts?.[k] ?? 0;
        if (v > 0) rows.push([this.#slot(k), s.label, this.#fmt(v)]);
      });
    }
    rows.push([null, this.#labels.value, value]);
    if (share) rows.push([null, this.#labels.share, share]);
    if (cum !== null) rows.push([null, this.#labels.cumulative, chartValue(cum, { format: "percent", locale: loc, decimals: 0 })]);
    const key = String(i);
    this.#tips.set(key, tipContent(name, rows, it.note));
    this.#byId.set(it.id, it);
    const aria = fill(this.#labels.item, { label: name, value, share });
    const interactive = !!this.dimension?.trim() || this.selectable;
    const attrs = { class: cls, "data-nx-tip": key, "data-nx-bar": it.id };
    return interactive
      ? h("button", { ...attrs, type: "button", "aria-label": share ? `${aria} (${share})` : aria, ...markAttrs([[this.dimension, it.id]], it.label) }, ...children)
      : // Quieta: el nombre y el valor ya se leen; el tooltip es una ayuda a la vista.
        h("div", attrs, ...children);
  }

  /** El relleno de una barra: uno solo, o las partes apiladas. */
  #bar(it: BarItem, pct: number, stacked: boolean, vertical: boolean): HTMLElement {
    const fill = h("span", { class: "nx-bars__fill", "aria-hidden": "true" });
    fill.style.setProperty(vertical ? "block-size" : "inline-size", `${pct}%`);
    if (stacked && it.parts) {
      fill.classList.add("is-stack");
      it.parts.forEach((p, k) => {
        if (!(p > 0) || k >= this.#series.length) return;
        const seg = h("i", { "data-nx-slot": this.#slot(k) });
        seg.style.flexGrow = String(p);
        fill.append(seg);
      });
    }
    return fill;
  }

  #rows(lay: ReturnType<typeof layoutBars>, stacked: boolean): HTMLElement {
    const cum = this.cumulative;
    const list = h("ol", { class: "nx-bars__list" });
    const ref = num(this.reference);
    lay.shown.forEach((it, i) => {
      const label = h("span", { class: "nx-bars__label" }, it.code ? h("span", { class: "nx-bars__code" }, it.code) : null, h("span", { class: "nx-bars__name" }, it.label));
      const value = h("span", { class: "nx-bars__value" }, this.#fmt(it.value), it.extra ? h("small", null, ` · ${it.extra}`) : null);
      const track = h("span", { class: "nx-bars__track", "aria-hidden": "true" }, this.#bar(it, barPct(it.value, lay.max), stacked, false));
      if (ref !== null) {
        const line = h("span", { class: "nx-bars__ref" });
        line.style.insetInlineStart = `${barPct(ref, lay.max)}%`;
        track.append(line);
      }
      const children: Node[] = [label, value];
      if (cum) children.push(h("span", { class: "nx-bars__cum" }, chartValue(lay.cumulative[i], { format: "percent", locale: resolveLocale(this), decimals: 0 })));
      children.push(track);
      const row = this.#mark(it, i, lay.total, cum ? lay.cumulative[i] : null, `nx-bars__row${cum ? " has-cum" : ""}`, ...children);
      list.append(h("li", null, row));
    });
    const wrap = h("div", { class: "nx-bars__h" });
    // Los encabezados solo cuando hay una columna que explicar (el acumulado).
    if (cum) wrap.append(h("div", { class: "nx-bars__head", "aria-hidden": "true" }, h("span", null), h("span", null, this.#labels.value), h("span", null, this.#labels.cumulative)));
    wrap.append(list);
    if (ref !== null && this.referenceLabel) wrap.append(h("p", { class: "nx-bars__reflabel" }, h("i", { "aria-hidden": "true" }), `${this.referenceLabel}: ${this.#fmt(ref)}`));
    return wrap;
  }

  #columns(lay: ReturnType<typeof layoutBars>, stacked: boolean): HTMLElement {
    const H = Math.max(80, num(this.height) ?? 180);
    const TOP = 18, LABEL = 22;
    const plot = h("div", { class: "nx-bars__plot" });
    plot.style.blockSize = `${H}px`;
    const cols = h("ol", { class: "nx-bars__cols" });
    cols.style.gridTemplateColumns = `repeat(${lay.shown.length}, minmax(0, 1fr))`;
    lay.shown.forEach((it, i) => {
      const stack = h("span", { class: "nx-bars__stack" }, h("span", { class: "nx-bars__colval" }, this.#fmt(it.value, true)), this.#bar(it, barPct(it.value, lay.max), stacked, true));
      const col = this.#mark(it, i, lay.total, this.cumulative ? lay.cumulative[i] : null, "nx-bars__col", stack, h("span", { class: "nx-bars__collabel" }, it.label));
      cols.append(h("li", null, col));
    });
    plot.append(cols);
    const ref = num(this.reference);
    if (ref !== null) {
      const line = h("div", { class: "nx-bars__hline", "aria-hidden": "true" }, this.referenceLabel ? h("span", null, this.referenceLabel) : null);
      line.style.insetBlockEnd = `${LABEL + ((H - TOP - LABEL) * barPct(ref, lay.max)) / 100}px`;
      plot.append(line);
    }
    return plot;
  }

  #onClick = (e: MouseEvent): void => {
    const el = (e.target as Element | null)?.closest?.("button[data-nx-bar]") as HTMLElement | null;
    if (!el) return;
    const item = this.#byId.get(el.dataset.nxBar ?? "");
    if (!item) return;
    const detail: BarsSelectDetail = { item };
    emit(this, "nx-bars-select", detail);
  };
}
