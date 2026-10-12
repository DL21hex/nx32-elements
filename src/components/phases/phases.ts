/**
 * `<nx-phases>`: tramos consecutivos sobre un eje de días. Quién paga cada día de una incapacidad
 * (la empresa los dos primeros, la EPS hasta el 180, el fondo de pensiones después), las etapas de
 * un proceso con plazo.
 *
 * Reglas de diseño:
 * - **El ancho es el tiempo.** Cada tramo ocupa sus días: un tramo de 88 días es 44 veces uno de 2.
 *   Si un tramo tan corto no se alcanza a ver, igual queda con 4 px y en la lista.
 * - **Hoy se ve y lo que falta se distingue.** Con `today`, una línea vertical «hoy · día 197» y lo
 *   que va después, rayado y atenuado: la forma dice lo mismo que el color.
 * - **El eje no se pisa.** Por defecto, el día 1, el último y el comienzo de cada tramo que no quede
 *   pegado a otro; los de los extremos no se salen del borde.
 * - **Se lee sin verlo.** La barra es una imagen con un resumen («Días 1 a 2: Empresa; días 3 a 90:
 *   EPS; hoy, día 197»); con `list`, cada tramo con su rango, su regla, su valor y lo que le falta.
 * - **No filtra ni avisa.** Es una ficha: no lleva marcas ni eventos.
 */
import { chartValue, ChartTip, slotOf, tipContent } from "../../core/chart";
import { Base, boolAttr, upgrade } from "../../core/define";
import { h, setAttr } from "../../core/dom";
import { mergeLabels } from "../../core/labels";
import { resolveLocale } from "../../core/locale";
import { axisTicks, axisTotal, cleanPhases, dayEnd, dayStart, parseTicks, phaseProgress, tickPos } from "./logic";
import type { Phase, PhasesFormat, PhasesLabels } from "./types";

export const PHASES_LABELS: PhasesLabels = {
  today: "hoy · día {n}",
  todayAria: "hoy, día {n}",
  day: "día {n}",
  range: "días {from} a {to}",
  pending: "faltan {n} días",
  pendingOne: "falta 1 día",
  notStarted: "todavía no empieza",
  empty: "Sin datos.",
  group: "Tramos",
};

const FORMATS = /^(number|money|percent)$/;
const isSlot = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 8;
const fill = (t: string, map: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => (Object.hasOwn(map, k) ? map[k] : m));
const pct = (n: number) => `${+n.toFixed(4)}%`;

/** Un número entero de un atributo (`null` si no es un número). */
function intAttr(el: Element, name: string): number | null {
  const v = el.getAttribute(name);
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

export class NxPhases extends Base {
  static observedAttributes = ["phases", "labels", "ticks", "total", "today", "format", "currency", "locale", "list"];

  #phases: Phase[] = [];
  #ticks: number[] = [];
  #labels: PhasesLabels = PHASES_LABELS;
  #root?: HTMLDivElement;
  #tip?: ChartTip;
  #queued = false;
  #abort?: AbortController;
  #shown: { phase: Phase; slot: string }[] = [];

  /** Los tramos: `{id?, from, to, label, note?, slot?, value?}`. Se ordenan por `from`. */
  get phases(): Phase[] {
    return this.#phases;
  }
  set phases(value: Phase[] | null | undefined) {
    this.#phases = Array.isArray(value) ? value : [];
    this.#schedule();
  }
  /** Los textos de la interfaz (`PHASES_LABELS`). */
  get labels(): PhasesLabels {
    return this.#labels;
  }
  set labels(value: Partial<PhasesLabels> | null | undefined) {
    this.#labels = mergeLabels(PHASES_LABELS, value);
    this.#schedule();
  }
  /** Los días que se marcan en el eje. Sin ellos: el 1, el último y el comienzo de cada tramo. */
  get ticks(): number[] {
    return this.#ticks;
  }
  set ticks(value: number[] | string | null | undefined) {
    this.#ticks = parseTicks(value);
    this.#schedule();
  }
  /** El último día del eje. Por defecto, el mayor `to`. */
  get total(): number | null {
    return intAttr(this, "total");
  }
  set total(v: number | null | undefined) {
    setAttr(this, "total", typeof v === "number" && Number.isFinite(v) ? String(v) : null);
  }
  /** El día de hoy en el eje (hoy cuenta como pasado). Lo que va después se pinta rayado. */
  get today(): number | null {
    return intAttr(this, "today");
  }
  set today(v: number | null | undefined) {
    setAttr(this, "today", typeof v === "number" && Number.isFinite(v) ? String(v) : null);
  }
  /** Cómo se escribe el `value` de cada tramo: `number` (por defecto), `money` o `percent`. */
  get format(): PhasesFormat {
    const f = this.getAttribute("format") ?? "";
    return FORMATS.test(f) ? (f as PhasesFormat) : "number";
  }
  set format(v: PhasesFormat | null | undefined) {
    setAttr(this, "format", v);
  }
  /** La moneda de `format="money"`. */
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
  /** Muestra la lista de tramos debajo del eje. */
  get list(): boolean {
    return boolAttr(this, "list");
  }
  set list(v: boolean | null | undefined) {
    this.toggleAttribute("list", !!v);
  }

  connectedCallback(): void {
    upgrade(this);
    if (!this.#root) this.#root = h("div", { class: "nx-phases__root" });
    if (this.#root.parentNode !== this) this.append(this.#root);
    this.#abort?.abort();
    this.#tip ??= new ChartTip(this, (key) => this.#tipFor(key));
    this.#tip.attach((this.#abort = new AbortController()).signal);
    this.#render();
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
    this.#tip?.hide();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "phases" || name === "labels") {
      if (value === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        console.warn(`[nx-phases] el atributo "${name}" no es JSON válido`);
        return;
      }
      (this as unknown as Record<string, unknown>)[name] = parsed;
      return;
    }
    if (name === "ticks") {
      this.ticks = value;
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

  #n(n: number, locale: string): string {
    return chartValue(n, { locale });
  }

  /** «días 3 a 90» (o «día 5» si es uno solo). */
  #range(p: Phase, locale: string): string {
    const L = this.#labels;
    return p.from === p.to ? fill(L.day, { n: this.#n(p.from, locale) }) : fill(L.range, { from: this.#n(p.from, locale), to: this.#n(p.to, locale) });
  }

  /** Lo que le falta a un tramo que no terminó («faltan 12 días»), o nada. */
  #status(p: Phase, locale: string): string {
    const { done, left } = phaseProgress(p, this.today);
    if (!left) return "";
    if (!done) return this.#labels.notStarted;
    return left === 1 ? this.#labels.pendingOne : fill(this.#labels.pending, { n: this.#n(left, locale) });
  }

  #render(): void {
    const root = this.#root!;
    this.#queued = false;
    this.#tip?.hide();
    const L = this.#labels;
    const locale = resolveLocale(this);
    const phases = cleanPhases(this.#phases, this.total);
    const total = axisTotal(phases, this.total);
    this.#shown = phases.map((phase, i) => ({ phase, slot: isSlot(phase.slot) ? String(phase.slot) : slotOf(i) }));
    if (!phases.length || total < 1) {
      root.replaceChildren(h("p", { class: "nx-phases__empty" }, L.empty));
      return;
    }
    const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
    const today = this.today;
    const showToday = today !== null && today >= 1 && today <= total;
    const summary = this.#shown.map(({ phase }) => `${this.#range(phase, locale)}: ${phase.label}`);
    if (showToday) summary.push(fill(L.todayAria, { n: this.#n(today, locale) }));

    const bar = h("div", { class: "nx-phases__bar", role: "img", "aria-label": cap(summary.join("; ")) });
    this.#shown.forEach(({ phase, slot }, i) => {
      const prev = phases[i - 1], next = phases[i + 1];
      const start = phase.from === 1 || !prev || prev.to < phase.from - 1;
      const end = phase.to === total || !next || next.from > phase.to + 1;
      const seg = h("span", { class: `nx-phases__seg${start ? " is-start" : ""}${end ? " is-end" : ""}`, "data-nx-slot": slot, "data-nx-tip": String(i) });
      const left = dayStart(phase.from, total), right = dayEnd(phase.to, total);
      seg.style.insetInlineStart = pct(left);
      seg.style.inlineSize = right >= 100 ? pct(right - left) : `calc(${pct(right - left)} - 2px)`;
      const { done, left: rest } = phaseProgress(phase, today);
      if (done) {
        const d = h("i", { class: "nx-phases__done" });
        d.style.flexGrow = String(done);
        seg.append(d);
      }
      if (rest) {
        const f = h("i", { class: "nx-phases__left" });
        f.style.flexGrow = String(rest);
        seg.append(f);
      }
      bar.append(seg);
    });
    if (showToday) {
      const at = dayEnd(today, total);
      const line = h("span", { class: "nx-phases__today" }, h("span", { class: `nx-phases__today-label${at < 12 ? " is-start" : at > 88 ? " is-end" : ""}` }, fill(L.today, { n: this.#n(today, locale) })));
      line.style.insetInlineStart = `calc(${pct(at)} - 1px)`;
      bar.append(line);
    }

    const axis = h("div", { class: "nx-phases__axis", "aria-hidden": "true" });
    const ticks = axisTicks(phases, total, this.#ticks.length ? this.#ticks : null);
    ticks.forEach((d, i) => {
      const cls = i === 0 ? " is-first" : i === ticks.length - 1 ? " is-last" : "";
      const t = h("span", { class: `nx-phases__tick${cls}` }, fill(L.day, { n: this.#n(d, locale) }));
      t.style.insetInlineStart = pct(tickPos(d, total));
      axis.append(t);
    });

    const chart = h("div", { class: `nx-phases__chart${showToday ? " has-today" : ""}` }, bar, axis);
    if (!this.list) {
      root.replaceChildren(chart);
      return;
    }
    const ul = h("ul", { class: "nx-phases__list", "aria-label": L.group });
    for (const { phase, slot } of this.#shown) {
      const status = this.#status(phase, locale);
      const sub = h("span", { class: "nx-phases__sub" });
      if (phase.note) sub.append(h("span", null, phase.note));
      if (status) sub.append(h("span", { class: "nx-phases__status" }, status));
      const value = typeof phase.value === "number" ? chartValue(phase.value, { format: this.format, currency: this.currency, locale }) : "";
      ul.append(
        h(
          "li",
          { class: `nx-phases__row${status ? " is-open" : ""}` },
          h("i", { class: "nx-chart-sw", "data-nx-slot": slot, "aria-hidden": "true" }),
          h("span", { class: "nx-phases__name" }, h("b", null, phase.label), h("span", { class: "nx-phases__range" }, this.#range(phase, locale))),
          value ? h("span", { class: "nx-phases__value" }, value) : null,
          sub.childNodes.length ? sub : null,
        ),
      );
    }
    root.replaceChildren(chart, ul);
  }

  #tipFor(key: string): Node[] | null {
    const s = this.#shown[Number(key)];
    if (!s) return null;
    const locale = resolveLocale(this);
    const { phase, slot } = s;
    const range = this.#range(phase, locale);
    const value = typeof phase.value === "number" ? chartValue(phase.value, { format: this.format, currency: this.currency, locale }) : "";
    const status = this.#status(phase, locale);
    const foot = [phase.note, status].filter(Boolean).join(" · ");
    return tipContent(phase.label, [[slot, range.charAt(0).toLocaleUpperCase(locale) + range.slice(1), value]], foot || undefined);
  }
}
