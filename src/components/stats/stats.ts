/**
 * `<nx-stats>`: las pocas cifras que alguien mira primero al entrar —el último pago, los días de
 * vacaciones, lo que tiene en trámite—, cada una con su nota y, si ayuda, su forma: la tendencia de
 * los últimos valores, una barra o un anillo.
 *
 * Reglas de diseño:
 * - **Pocas y con contexto.** Una cifra suelta no dice nada: cada una lleva qué es y una nota
 *   («Catorcena 19 · 2026»). La forma acompaña, no reemplaza al número.
 * - **En fila o en lista.** `layout="row"` (por defecto) reparte las tarjetas a lo ancho y se
 *   apilan cuando no caben; `layout="list"` las pone una debajo de otra en un solo recuadro.
 * - **La que lleva a algún lado es un enlace**; `nx-stats-select` (cancelable) para el router.
 */
import { Base, upgrade } from "../../core/define";
import { emit, h, safeHref, setAttr } from "../../core/dom";
import { mergeLabels } from "../../core/labels";
import { nxFormat, resolveLocale } from "../../core/locale";
import { sparkPaths } from "../../core/spark";
import type { StatItem, StatsLabels, StatsSelectDetail } from "./types";

export const STATS_LABELS: StatsLabels = { group: "Resumen" };

const SVG = "http://www.w3.org/2000/svg";
const TONES = /^(neutral|info|success|warning|danger)$/;
const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function svg(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** El valor escrito con el locale: un número con su formato; un texto, tal cual. */
export function statValue(item: StatItem, locale: string): string {
  const v = item.value;
  if (!finite(v)) return String(v ?? "");
  const f = nxFormat(locale);
  if (item.format === "money") return f.money(v, { currency: item.currency });
  if (item.format === "percent") {
    try {
      return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(v);
    } catch {
      return `${f.number(v * 100)} %`;
    }
  }
  return f.number(v);
}

export class NxStats extends Base {
  static observedAttributes = ["items", "labels", "layout", "locale"];

  #items: StatItem[] = [];
  #labels: StatsLabels = STATS_LABELS;
  #root?: HTMLDivElement;
  #queued = false;
  #abort?: AbortController;
  #byKey = new Map<string, StatItem>();

  /** Las cifras: `{id?, label, value, format?, currency?, note?, badge?, trend?, meter?, ring?, href?, newTab?}`. */
  get items(): StatItem[] {
    return this.#items;
  }
  set items(value: StatItem[] | null | undefined) {
    this.#items = asArray<StatItem>(value).filter((i) => typeof i.label === "string");
    this.#schedule();
  }
  get labels(): StatsLabels {
    return this.#labels;
  }
  set labels(value: Partial<StatsLabels> | null | undefined) {
    this.#labels = mergeLabels(STATS_LABELS, value);
    this.#schedule();
  }
  /** `row` (por defecto) o `list`. */
  get layout(): "row" | "list" {
    return this.getAttribute("layout") === "list" ? "list" : "row";
  }
  set layout(v: "row" | "list" | null | undefined) {
    setAttr(this, "layout", v);
  }
  get locale(): string | null {
    return this.getAttribute("locale");
  }
  set locale(v: string | null | undefined) {
    setAttr(this, "locale", v);
  }

  connectedCallback(): void {
    upgrade(this);
    if (!this.#root) this.#root = h("div", { class: "nx-stats__root" });
    if (this.#root.parentNode !== this) this.append(this.#root);
    this.#abort?.abort();
    this.#root.addEventListener("click", this.#onClick, { signal: (this.#abort = new AbortController()).signal });
    this.#render();
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "items" || name === "labels") {
      if (value === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        console.warn(`[nx-stats] el atributo "${name}" no es JSON válido`);
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

  #render(): void {
    const root = this.#root!;
    this.#queued = false;
    const locale = resolveLocale(this);
    this.#byKey.clear();
    root.replaceChildren();
    if (!this.#items.length) return;
    const ul = h("ul", { class: `nx-stats__list is-${this.layout}`, "aria-label": this.#labels.group });
    this.#items.forEach((it, i) => ul.append(this.#stat(it, i, locale)));
    root.append(ul);
  }

  #stat(it: StatItem, i: number, locale: string): HTMLLIElement {
    const key = typeof it.id === "string" && it.id ? it.id : `#${i}`;
    const text = h("span", { class: "nx-stats__text" });
    const top = h("span", { class: "nx-stats__label" }, it.label);
    if (it.badge && typeof it.badge.label === "string") {
      const tone = it.badge.tone && TONES.test(it.badge.tone) ? it.badge.tone : "info";
      top.append(h("span", { class: `nx-stats__badge is-${tone}` }, it.badge.label));
    }
    text.append(top, h("span", { class: "nx-stats__value" }, statValue(it, locale)));
    if (it.note) text.append(h("span", { class: "nx-stats__note" }, it.note));
    const shape = this.#shape(it);
    const href = safeHref(it.href);
    let box: HTMLElement;
    if (href) {
      this.#byKey.set(key, it);
      box = h("a", { class: "nx-stats__item", href, "data-nx-key": key, target: it.newTab ? "_blank" : null, rel: it.newTab ? "noopener" : null }, text);
    } else box = h("div", { class: "nx-stats__item" }, text);
    if (shape) box.append(shape);
    return h("li", null, box);
  }

  /** La forma que acompaña a la cifra (decorativa: el número ya lo dice). */
  #shape(it: StatItem): Element | null {
    if (it.ring && finite(it.ring.value) && finite(it.ring.max) && it.ring.max > 0) {
      const frac = Math.min(1, Math.max(0, it.ring.value / it.ring.max));
      const C = 2 * Math.PI * 18;
      const s = svg("svg", { class: "nx-stats__ring", viewBox: "0 0 44 44", "aria-hidden": "true" });
      s.append(svg("circle", { class: "nx-stats__ring-bg", cx: 22, cy: 22, r: 18 }), svg("circle", { class: "nx-stats__ring-fg", cx: 22, cy: 22, r: 18, "stroke-dasharray": `${(C * frac).toFixed(1)} ${C.toFixed(1)}` }));
      if (it.ring.text) {
        const t = svg("text", { x: 22, y: 26, "text-anchor": "middle" });
        t.textContent = it.ring.text;
        s.append(t);
      }
      return s;
    }
    if (it.meter && finite(it.meter.value) && finite(it.meter.max) && it.meter.max > 0) {
      const bar = h("span", { class: "nx-stats__meter", "aria-hidden": "true" }, h("i", null));
      (bar.firstChild as HTMLElement).style.width = `${Math.min(100, Math.max(0, (it.meter.value / it.meter.max) * 100))}%`;
      return bar;
    }
    const sp = sparkPaths(it.trend, 28);
    if (sp) {
      const s = svg("svg", { class: "nx-stats__spark", viewBox: "0 0 100 28", preserveAspectRatio: "none", "aria-hidden": "true" });
      s.append(svg("path", { class: "nx-stats__spark-area", d: sp.area }), svg("path", { class: "nx-stats__spark-line", d: sp.line, "vector-effect": "non-scaling-stroke" }));
      return s;
    }
    return null;
  }

  #onClick = (e: MouseEvent): void => {
    const a = (e.target as Element | null)?.closest?.("a[data-nx-key]") as HTMLAnchorElement | null;
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const item = this.#byKey.get(a.dataset.nxKey ?? "");
    if (!item) return;
    const detail: StatsSelectDetail = { item, href: a.getAttribute("href") ?? "" };
    if (!emit(this, "nx-stats-select", detail, true)) e.preventDefault();
  };
}
