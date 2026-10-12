/**
 * `<nx-parts>`: las partes de un todo. Una barra al 100 % con cada parte y, debajo, la lista con su
 * monto, su regla y su porcentaje: quién paga una incapacidad (empresa, EPS, ARL, fondo de
 * pensiones), en qué se va un presupuesto.
 *
 * Reglas de diseño:
 * - **La lista es la que se lee.** La barra da la proporción de un vistazo y es decorativa para el
 *   lector de pantalla (`aria-hidden`); cada renglón dice nombre, monto, regla y porcentaje.
 * - **El orden es el que llega.** La app sabe si va por tamaño o por un orden propio (quién paga
 *   primero); el componente no reordena. El color es el `slot` de cada parte o su posición.
 * - **Ocho como mucho.** Desde la octava, las que sobran se pliegan en «Otros» con el color atenuado:
 *   la paleta no se repite.
 * - **Una parte chica se sigue viendo** (3 px como mínimo) y una en cero no ocupa la barra, pero
 *   queda en la lista con su 0 %.
 * - **Con `dimension`, filtra.** Cada renglón es un botón y cada parte de la barra lleva la marca
 *   (`data-nx-filter`): dentro de un `<nx-board>`, el tablero hace el resto. Además emite
 *   `nx-parts-select`. «Otros» no filtra: no es un valor.
 */
import { chartValue, ChartTip, markAttrs, shareText, tipContent } from "../../core/chart";
import { Base, upgrade } from "../../core/define";
import { emit, h, setAttr } from "../../core/dom";
import { mergeLabels } from "../../core/labels";
import { resolveLocale } from "../../core/locale";
import { shownParts } from "./logic";
import type { PartItem, PartsFormat, PartsLabels, PartsSelectDetail, ShownPart } from "./types";

export const PARTS_LABELS: PartsLabels = {
  group: "Partes",
  empty: "Sin datos.",
  other: "Otros",
  value: "Valor",
  share: "Parte",
};

const FORMATS = /^(number|money|percent)$/;

export class NxParts extends Base {
  static observedAttributes = ["items", "labels", "format", "currency", "locale", "dimension"];

  #items: PartItem[] = [];
  #labels: PartsLabels = PARTS_LABELS;
  #root?: HTMLDivElement;
  #tip?: ChartTip;
  #queued = false;
  #abort?: AbortController;
  #shown: ShownPart[] = [];
  #total = 0;

  /** Las partes, en el orden en que se muestran: `{id, label, value, note?, slot?}`. */
  get items(): PartItem[] {
    return this.#items;
  }
  set items(value: PartItem[] | null | undefined) {
    this.#items = Array.isArray(value) ? value : [];
    this.#schedule();
  }
  /** Los textos de la interfaz (`PARTS_LABELS`). */
  get labels(): PartsLabels {
    return this.#labels;
  }
  set labels(value: Partial<PartsLabels> | null | undefined) {
    this.#labels = mergeLabels(PARTS_LABELS, value);
    this.#schedule();
  }
  /** Cómo se escriben los montos: `number` (por defecto), `money` o `percent` (fracciones). */
  get format(): PartsFormat {
    const f = this.getAttribute("format") ?? "";
    return FORMATS.test(f) ? (f as PartsFormat) : "number";
  }
  set format(v: PartsFormat | null | undefined) {
    setAttr(this, "format", v);
  }
  /** La moneda de `format="money"` (`COP` por defecto del locale). */
  get currency(): string | null {
    return this.getAttribute("currency");
  }
  set currency(v: string | null | undefined) {
    setAttr(this, "currency", v);
  }
  get locale(): string | null {
    return this.getAttribute("locale");
  }
  set locale(v: string | null | undefined) {
    setAttr(this, "locale", v);
  }
  /** La dimensión del tablero que filtran las partes (`data-nx-filter="dimension:id"`). */
  get dimension(): string | null {
    return this.getAttribute("dimension");
  }
  set dimension(v: string | null | undefined) {
    setAttr(this, "dimension", v);
  }

  connectedCallback(): void {
    upgrade(this);
    if (!this.#root) this.#root = h("div", { class: "nx-parts__root" });
    if (this.#root.parentNode !== this) this.append(this.#root);
    this.#abort?.abort();
    const signal = (this.#abort = new AbortController()).signal;
    this.#tip ??= new ChartTip(this, (key) => this.#tipFor(key));
    this.#tip.attach(signal);
    this.#root.addEventListener("click", this.#onClick, { signal });
    this.#render();
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
    this.#tip?.hide();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "items" || name === "labels") {
      if (value === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        console.warn(`[nx-parts] el atributo "${name}" no es JSON válido`);
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

  #value(v: number, locale: string): string {
    return chartValue(v, { format: this.format, currency: this.currency, locale });
  }

  #render(): void {
    const root = this.#root!;
    this.#queued = false;
    this.#tip?.hide();
    const L = this.#labels;
    const locale = resolveLocale(this);
    const { parts, total } = shownParts(this.#items, L.other);
    this.#shown = parts;
    this.#total = total;
    if (!(total > 0)) {
      root.replaceChildren(h("p", { class: "nx-parts__empty" }, L.empty));
      return;
    }
    const dim = this.dimension;
    const bar = h("div", { class: "nx-parts__bar", "aria-hidden": "true" });
    const list = h("ul", { class: "nx-parts__list", "aria-label": L.group });
    parts.forEach((p, i) => {
      const key = String(i);
      const marks = dim && !p.others ? markAttrs([[dim, p.item.id]], p.item.label) : {};
      if (p.item.value > 0) {
        const seg = h("span", { class: "nx-parts__seg", "data-nx-slot": p.slot, "data-nx-tip": key, "data-nx-key": marks["data-nx-filter"] ? key : null, ...marks });
        seg.style.flexGrow = String(p.item.value / total);
        bar.append(seg);
      }
      const amount = this.#value(p.item.value, locale);
      const kids = [
        h("i", { class: "nx-chart-sw", "data-nx-slot": p.slot, "aria-hidden": "true" }),
        h("span", { class: "nx-parts__name" }, p.item.label),
        h("span", { class: "nx-parts__amount" }, amount),
      ];
      const note = p.others ? p.others.map((o) => o.label).join(", ") : p.item.note;
      if (note) kids.push(h("span", { class: "nx-parts__note" }, note));
      kids.push(h("span", { class: "nx-parts__share" }, shareText(p.item.value, total, locale)));
      const row = marks["data-nx-filter"]
        ? h("button", { type: "button", class: "nx-parts__row", "data-nx-key": key, ...marks }, ...kids)
        : h("div", { class: "nx-parts__row" }, ...kids);
      list.append(h("li", null, row));
    });
    root.replaceChildren(bar, list);
  }

  #tipFor(key: string): Node[] | null {
    const p = this.#shown[Number(key)];
    if (!p) return null;
    const locale = resolveLocale(this);
    const note = p.others ? p.others.map((o) => o.label).join(", ") : p.item.note;
    return tipContent(
      p.item.label,
      [
        [p.slot, this.#labels.value, this.#value(p.item.value, locale)],
        [null, this.#labels.share, shareText(p.item.value, this.#total, locale, 1)],
      ],
      note || undefined,
    );
  }

  #onClick = (e: MouseEvent): void => {
    const el = (e.target as Element | null)?.closest?.("[data-nx-key]") as HTMLElement | null;
    if (!el || !this.#root?.contains(el)) return;
    const p = this.#shown[Number(el.dataset.nxKey)];
    if (!p || p.others) return;
    const detail: PartsSelectDetail = { item: p.item };
    emit(this, "nx-parts-select", detail);
  };
}
