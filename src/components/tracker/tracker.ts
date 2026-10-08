/**
 * `<nx-tracker>`: lo que una persona tiene en camino. Cada solicitud es una tarjeta con su estado
 * («Por aprobar») y los pasos de su recorrido —Enviada → Con tu jefe → Aprobada—, como el
 * seguimiento de un paquete; una sugerencia («Para ti») es una tarjeta sin pasos y con su acción.
 *
 * Reglas de diseño:
 * - **Un estado, una pastilla.** El color dice si hay que esperar (ámbar), si salió (verde) o si se
 *   cayó (rojo); los pasos dicen dónde está y quién la tiene.
 * - **Las vacaciones se ven en días.** Con `days`, una tira va del primer al último día libre (los
 *   fines de semana y festivos pegados cuentan) y marca los días que se piden: «9 que pides, 18 que
 *   descansas» se entiende sin leer.
 * - **Enlaces de verdad.** El título y las acciones son `<a href>`; `nx-tracker-select` (cancelable)
 *   para que la app navegue con su router.
 */
import { Base, upgrade } from "../../core/define";
import { dayOfISO, isoOf } from "../../core/days";
import { emit, h, safeHref, setAttr } from "../../core/dom";
import { holidayLookup, workdayTest, type HolidaySource } from "../../core/holidays";
import { icon } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import { resolveLocale } from "../../core/locale";
import type { TrackerAction, TrackerItem, TrackerLabels, TrackerSelectDetail, TrackerStep } from "./types";

export const TRACKER_LABELS: TrackerLabels = {
  daysAsked: "Días que pides",
  daysFree: "Fines de semana y festivos",
  list: "Solicitudes",
};

const MS = 864e5;
/** La tira más larga que se pinta (más días no caben en una tarjeta). */
const MAX_STRIP = 45;
const TONES = /^(neutral|info|success|warning|danger)$/;
const STATES = /^(done|current|todo|failed)$/;

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);

export class NxTracker extends Base {
  static observedAttributes = ["items", "holidays", "workdays", "labels", "empty", "heading-level", "locale"];

  #items: TrackerItem[] = [];
  #holidays: HolidaySource = "co";
  #workdays: number[] | null = null;
  #labels: TrackerLabels = TRACKER_LABELS;
  #root?: HTMLDivElement;
  #queued = false;
  #abort?: AbortController;
  #byKey = new Map<string, { item: TrackerItem; action: TrackerAction | null }>();

  // ---------------------------------------------------------------- propiedades

  /** Las tarjetas: `{id, title, subtitle?, icon?, eyebrow?, status?, steps?, days?, href?, actions?}`. */
  get items(): TrackerItem[] {
    return this.#items;
  }
  set items(value: TrackerItem[] | null | undefined) {
    this.#items = asArray<TrackerItem>(value).filter((i) => typeof i.title === "string");
    this.#schedule();
  }

  /** Festivos de la tira de días: `"co"` (por defecto), una lista o `null`. */
  get holidays(): HolidaySource {
    return this.#holidays;
  }
  set holidays(value: HolidaySource | undefined) {
    this.#holidays = value === undefined ? "co" : value;
    this.#schedule();
  }

  /** Los días de la semana que se trabajan (JS: 0 domingo … 6 sábado). Por defecto de lunes a viernes. */
  get workdays(): number[] | null {
    return this.#workdays;
  }
  set workdays(value: number[] | null | undefined) {
    this.#workdays = Array.isArray(value) ? value.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6) : null;
    this.#schedule();
  }

  get labels(): TrackerLabels {
    return this.#labels;
  }
  set labels(value: Partial<TrackerLabels> | null | undefined) {
    this.#labels = mergeLabels(TRACKER_LABELS, value);
    this.#schedule();
  }

  /** Lo que se dice cuando no hay nada. Sin él, el componente no ocupa espacio. */
  get empty(): string | null {
    return this.getAttribute("empty");
  }
  set empty(v: string | null | undefined) {
    setAttr(this, "empty", v);
  }
  /** Nivel del título de cada tarjeta (3 por defecto). */
  get headingLevel(): number {
    const n = Number(this.getAttribute("heading-level"));
    return n >= 1 && n <= 6 ? Math.floor(n) : 3;
  }
  set headingLevel(v: number | null | undefined) {
    setAttr(this, "heading-level", v == null ? null : String(v));
  }
  get locale(): string | null {
    return this.getAttribute("locale");
  }
  set locale(v: string | null | undefined) {
    setAttr(this, "locale", v);
  }

  // ---------------------------------------------------------------- ciclo de vida

  connectedCallback(): void {
    upgrade(this);
    if (!this.#root) this.#root = h("div", { class: "nx-tracker__root" });
    if (this.#root.parentNode !== this) this.append(this.#root);
    this.#abort?.abort();
    this.#root.addEventListener("click", this.#onClick, { signal: (this.#abort = new AbortController()).signal });
    this.#render();
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "items" || name === "holidays" || name === "workdays" || name === "labels") {
      if (value === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        if (name === "holidays" && value.trim() === "co") return void (this.holidays = "co");
        console.warn(`[nx-tracker] el atributo "${name}" no es JSON válido`);
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

  // ---------------------------------------------------------------- render

  #render(): void {
    const root = this.#root!;
    this.#queued = false;
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active && root.contains(active) ? active.dataset.nxKey ?? null : null;
    this.#byKey.clear();
    root.replaceChildren();
    const items = this.#items;
    if (!items.length) {
      const empty = this.empty;
      if (empty) root.append(h("p", { class: "nx-tracker__empty" }, empty));
      this.toggleAttribute("data-empty", true);
      return;
    }
    this.removeAttribute("data-empty");
    const ul = h("ul", { class: "nx-tracker__list", "aria-label": this.#labels.list });
    items.forEach((it, i) => ul.append(this.#card(it, i)));
    root.append(ul);
    if (focusKey) [...root.querySelectorAll<HTMLElement>("[data-nx-key]")].find((el) => el.dataset.nxKey === focusKey)?.focus({ preventScroll: true });
  }

  #link(key: string, item: TrackerItem, action: TrackerAction | null, href: string, cls: string, text: string, newTab = false): HTMLElement {
    this.#byKey.set(key, { item, action });
    const a = h("a", { class: cls, href, "data-nx-key": key, target: newTab ? "_blank" : null, rel: newTab ? "noopener" : null }, text);
    return a;
  }

  #card(it: TrackerItem, i: number): HTMLLIElement {
    const id = typeof it.id === "string" && it.id ? it.id : `#${i}`;
    const head = h("div", { class: "nx-tracker__head" });
    if (it.icon) head.append(h("span", { class: "nx-tracker__icon", "aria-hidden": "true" }, icon(it.icon)));
    const titles = h("div", { class: "nx-tracker__titles" });
    if (it.eyebrow) titles.append(h("p", { class: "nx-tracker__eyebrow" }, it.eyebrow));
    const href = safeHref(it.href);
    const hTag = `h${this.headingLevel}` as "h3";
    titles.append(h(hTag, { class: "nx-tracker__title" }, href ? this.#link(`${id}|title`, it, null, href, "nx-tracker__title-link", it.title) : it.title));
    if (it.subtitle) titles.append(h("p", { class: "nx-tracker__subtitle" }, it.subtitle));
    head.append(titles);
    if (it.status && typeof it.status.label === "string") {
      const tone = it.status.tone && TONES.test(it.status.tone) ? it.status.tone : "neutral";
      head.append(h("span", { class: `nx-tracker__status is-${tone}` }, it.status.label));
    }
    const card = h("li", { class: `nx-tracker__card${it.eyebrow ? " is-suggestion" : ""}` }, head);

    const steps = asArray<TrackerStep>(it.steps).filter((s) => typeof s.label === "string");
    if (steps.length) {
      const ol = h("ol", { class: "nx-tracker__steps" });
      ol.style.setProperty("--n", String(steps.length));
      for (const s of steps) {
        const state = STATES.test(s.state) ? s.state : "todo";
        const li = h("li", { class: `nx-tracker__step is-${state}`, "aria-current": state === "current" ? "step" : null }, h("span", { class: "nx-tracker__step-label" }, s.label));
        if (s.detail) li.append(h("span", { class: "nx-tracker__step-detail" }, s.detail));
        ol.append(li);
      }
      card.append(ol);
    }

    if (it.days) {
      const strip = this.#strip(it.days.start, it.days.end);
      if (strip) card.append(strip);
    }

    const actions = asArray<TrackerAction>(it.actions).filter((a) => typeof a.label === "string" && safeHref(a.href));
    if (actions.length) {
      const bar = h("div", { class: "nx-tracker__actions" });
      actions.forEach((a, j) => bar.append(this.#link(`${id}|${j}`, it, a, safeHref(a.href)!, `nx-tracker__action${a.primary ? " is-primary" : ""}`, a.label, !!a.newTab)));
      card.append(bar);
    }
    return card;
  }

  /** La tira de días: del primer al último día libre, con los que se piden marcados. */
  #strip(start: string, end: string): HTMLElement | null {
    const s = dayOfISO(start);
    const e = dayOfISO(end);
    if (s === null || e === null || e < s || e - s > MAX_STRIP) return null;
    const works = workdayTest({ holidays: this.#holidays, workdays: this.#workdays ?? undefined });
    const isHoliday = holidayLookup(this.#holidays);
    let a = s;
    let b = e;
    for (let i = 0; i < 10 && !works(a - 1); i++) a--;
    for (let i = 0; i < 10 && !works(b + 1); i++) b++;
    if (b - a + 1 > MAX_STRIP) return null;
    const locale = resolveLocale(this);
    let fmt: Intl.DateTimeFormat;
    try {
      fmt = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    } catch {
      fmt = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    }
    const strip = h("div", { class: "nx-tracker__strip", "aria-hidden": "true" });
    strip.style.setProperty("--n", String(b - a + 1));
    for (let d = a; d <= b; d++) {
      const asked = d >= s && d <= e && works(d);
      const name = isHoliday(d);
      const cell = h("span", { class: `nx-tracker__day${asked ? " is-asked" : ""}${name !== null ? " is-holiday" : ""}`, title: `${fmt.format(d * MS)}${name ? ` · ${name}` : ""}` }, String(Number(isoOf(d).slice(8))));
      strip.append(cell);
    }
    const L = this.#labels;
    const legend = h(
      "p",
      { class: "nx-tracker__legend", "aria-hidden": "true" },
      h("span", null, h("i", { class: "is-asked" }), L.daysAsked),
      h("span", null, h("i", null), L.daysFree),
    );
    return h("div", { class: "nx-tracker__days" }, strip, legend);
  }

  // ---------------------------------------------------------------- eventos

  #onClick = (e: MouseEvent): void => {
    const a = (e.target as Element | null)?.closest?.("a[data-nx-key]") as HTMLAnchorElement | null;
    if (!a) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const entry = this.#byKey.get(a.dataset.nxKey ?? "");
    if (!entry) return;
    const detail: TrackerSelectDetail = { item: entry.item, action: entry.action, href: a.getAttribute("href") ?? "" };
    if (!emit(this, "nx-tracker-select", detail, true)) e.preventDefault();
  };
}
