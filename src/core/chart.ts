/**
 * Lo que comparten los gráficos (`nx-bars`, `nx-heatmap`, `nx-parts`, `nx-phases`, `nx-trend`…):
 * el formato de un valor, los ticks redondos, los colores por posición fija, las marcas que filtran
 * un `<nx-board>` y el tooltip.
 *
 * Reglas de los gráficos de la librería:
 * - **El color sigue a la serie, nunca a su posición en pantalla**, y no se repite: pasada la
 *   octava, «Otros» (`foldOthers`). Los colores son `--nx-chart-1…8` (tokens.css), validados para
 *   daltonismo; el estado (bien, mal) va con ícono y texto, no solo con color.
 * - **Una marca que filtra** lleva `data-nx-filter` y `data-nx-label` (`markAttrs`): dentro de un
 *   `<nx-board>`, el tablero hace el resto. Fuera, el gráfico emite su `nx-<gráfico>-select`.
 * - **El tooltip repite lo que ya dice la marca** (su `aria-label`): es una ayuda a la vista, no la
 *   única forma de leer el dato.
 */
import { h } from "./dom";
import { nxFormat } from "./locale";

export type ChartFormat = "number" | "money" | "percent";

export interface ChartValueOptions {
  format?: ChartFormat | string | null;
  currency?: string | null;
  locale: string;
  /** Corto: «8,2 M» en vez de «8.200.000». */
  short?: boolean;
  /** Decimales de un porcentaje (1 por defecto) o de un número (los que traiga, hasta 2). */
  decimals?: number | null;
}

/** Un valor escrito con el locale. Un porcentaje llega como fracción (0,25 → «25 %»). */
export function chartValue(v: number, o: ChartValueOptions): string {
  if (!Number.isFinite(v)) return "";
  // -0 (una suma vacía en Rust, `-0.0` en el JSON) se escribiría «-0»: + 0 lo vuelve 0.
  v += 0;
  const f = nxFormat(o.locale);
  const d = typeof o.decimals === "number" && o.decimals >= 0 ? Math.min(6, Math.floor(o.decimals)) : null;
  if (o.format === "percent") {
    try {
      return new Intl.NumberFormat(f.locale, { style: "percent", minimumFractionDigits: d ?? 0, maximumFractionDigits: d ?? 1 }).format(v);
    } catch {
      return `${f.number(v * 100)} %`;
    }
  }
  if (o.format === "money") return f.money(v, { currency: o.currency ?? undefined }, !!o.short);
  if (o.short) return f.compact(v);
  if (d !== null) {
    try {
      return new Intl.NumberFormat(f.locale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
    } catch {
      return f.number(v);
    }
  }
  return f.number(v);
}

/** Una parte de un total, como porcentaje corto («38 %»). */
export function shareText(part: number, total: number, locale: string, decimals = 0): string {
  if (!total || !Number.isFinite(part)) return "";
  return chartValue(part / total, { format: "percent", locale, decimals });
}

/**
 * Ticks «redondos» para un eje: 0 / 100 / 200… El dominio se amplía hasta el tick más cercano (y a
 * cero si `zero`, como piden las barras).
 */
export function niceTicks(min: number, max: number, count = 5, zero = false): number[] {
  if (zero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min > max) [min, max] = [max, min];
  if (max === min) {
    const pad = Math.abs(max) * 0.1 || 1;
    min -= zero && min === 0 ? 0 : pad;
    max += pad;
  }
  const raw = (max - min) / Math.max(1, Math.min(count, 20));
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  const k0 = Math.floor(min / step + 1e-9);
  const k1 = Math.ceil(max / step - 1e-9);
  // Un rango que no cabe en un `number` (±1e308) o un paso que se pierde junto a valores enormes
  // (1e17 con un rango de 64: `k + 1 === k` pasado 2⁵³) no dan ticks redondos: los extremos, y ya.
  if (!Number.isFinite(step) || step <= 0 || !Number.isSafeInteger(k0) || !Number.isSafeInteger(k1) || k1 - k0 > 100) return [min + 0, max + 0];
  const ticks: number[] = [];
  // En pasos enteros y con 12 cifras, contra el ruido del punto flotante (3 × 0,2 = 0,6000…01).
  // (+ 0: un tick en -0 se escribiría «-0».)
  for (let k = k0; k <= k1; k++) ticks.push(+(k * step).toPrecision(12) + 0);
  return ticks;
}

/** El color de la posición `i` (0, 1…) de una paleta: `"1"`…`"8"`, o `"o1"`…`"o4"` en la ordinal. */
export function slotOf(i: number, ordinal = false): string {
  if (ordinal) return `o${Math.min(4, Math.max(1, i + 1))}`;
  return String(Math.min(8, Math.max(1, i + 1)));
}

/**
 * Pliega lo que pasa de `max` en un solo «Otros» (la paleta no se repite). `make` arma el ítem con
 * la suma de los plegados.
 */
export function foldOthers<T>(items: readonly T[], max: number, make: (rest: T[]) => T): T[] {
  if (items.length <= max) return [...items];
  return [...items.slice(0, max - 1), make(items.slice(max - 1))];
}

/** El par de `data-nx-filter`, con «,» y «%» codificados (ver `parseFilter` de nx-board). */
export function filterSpec(pairs: readonly (readonly [string, string])[]): string {
  const enc = (s: string) => s.replace(/%/g, "%25").replace(/,/g, "%2C");
  return pairs.map(([d, v]) => `${enc(d)}:${enc(v)}`).join(",");
}

/** Los atributos de una marca que filtra un `<nx-board>`: nada si el gráfico no tiene dimensión. */
export function markAttrs(pairs: readonly (readonly [string | null | undefined, string])[], label: string): Record<string, string> {
  const ok = pairs.filter((p): p is [string, string] => typeof p[0] === "string" && p[0].trim() !== "").map(([d, v]) => [d.trim(), v] as [string, string]);
  if (!ok.length) return {};
  return { "data-nx-filter": filterSpec(ok), "data-nx-label": label };
}

/** Un renglón del tooltip: `[slot | null, etiqueta, valor]`. */
export type TipRow = [slot: string | null, label: string, value: string];

/** El contenido de un tooltip: título, renglones y una nota al pie. */
export function tipContent(title: string, rows: readonly TipRow[] = [], foot?: string): Node[] {
  const out: Node[] = [h("p", { class: "nx-chart-tip__title" }, title)];
  for (const [slot, label, value] of rows) {
    out.push(h("div", { class: "nx-chart-tip__row" }, slot ? h("i", { class: "nx-chart-sw", "data-nx-slot": slot }) : h("i", null), h("span", null, label), h("b", null, value)));
  }
  if (foot) out.push(h("p", { class: "nx-chart-tip__foot" }, foot));
  return out;
}

/**
 * El tooltip de un gráfico. Vive dentro del componente (que tiene `position: relative`); se muestra
 * al pasar sobre un descendiente con `data-nx-tip="clave"` o al enfocarlo, con el contenido que da
 * `content(clave)`, y se esconde al salir, al perder el foco o con Escape.
 */
export class ChartTip {
  readonly el: HTMLDivElement;
  #host: HTMLElement;
  #content: (key: string) => Node[] | null;
  #current: Element | null = null;

  constructor(host: HTMLElement, content: (key: string) => Node[] | null) {
    this.#host = host;
    this.#content = content;
    this.el = h("div", { class: "nx-chart-tip", "aria-hidden": "true", hidden: true });
  }

  /** Pone los listeners (hasta que `signal` aborte) y el tooltip dentro del componente. */
  attach(signal: AbortSignal): void {
    if (this.el.parentNode !== this.#host) this.#host.append(this.el);
    const host = this.#host;
    host.addEventListener("pointerover", (e) => this.#over(e), { signal });
    host.addEventListener("pointermove", (e) => this.#current && this.#place(e.clientX, e.clientY), { signal });
    host.addEventListener("pointerleave", () => this.hide(), { signal });
    host.addEventListener("focusin", (e) => {
      const t = this.#target(e.target);
      if (!t) return this.hide();
      if (!this.#show(t)) return;
      const r = t.getBoundingClientRect();
      this.#place(r.left + r.width / 2, r.bottom);
    }, { signal });
    host.addEventListener("focusout", () => this.hide(), { signal });
    host.addEventListener("keydown", (e) => e.key === "Escape" && this.hide(), { signal });
  }

  hide(): void {
    this.#current = null;
    this.el.hidden = true;
  }

  #target(t: EventTarget | null): Element | null {
    const el = t instanceof Element ? t.closest("[data-nx-tip]") : null;
    return el && this.#host.contains(el) ? el : null;
  }

  #over(e: PointerEvent): void {
    const t = this.#target(e.target);
    if (!t) return this.hide();
    if (t === this.#current) return;
    if (this.#show(t)) this.#place(e.clientX, e.clientY);
  }

  #show(t: Element): boolean {
    const nodes = this.#content(t.getAttribute("data-nx-tip") ?? "");
    if (!nodes?.length) {
      this.hide();
      return false;
    }
    this.#current = t;
    this.el.replaceChildren(...nodes);
    this.el.hidden = false;
    return true;
  }

  /** Junto al puntero, sin salirse del ancho del componente ni del borde de abajo de la ventana. */
  #place(x: number, y: number): void {
    const host = this.#host.getBoundingClientRect();
    const w = this.el.offsetWidth, hgt = this.el.offsetHeight;
    const vh = typeof innerHeight === "number" ? innerHeight : 1e6;
    let left = x - host.left + 12;
    if (left + w > host.width) left = Math.max(0, x - host.left - w - 12);
    let top = y - host.top + 14;
    if (y + 14 + hgt > vh) top = y - host.top - hgt - 10;
    this.el.style.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`;
  }
}
