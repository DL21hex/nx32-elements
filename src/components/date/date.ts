/**
 * `<nx-date>`: una fecha, con los días que no se pueden elegir a la vista. Es el campo de fecha de
 * siempre (se escribe «25/10/2026» y se pasa al siguiente) más un calendario de un mes donde los
 * festivos, los días que la jornada no incluye y lo que queda fuera de `min`/`max` salen tachados,
 * con su motivo («Festivo: Día de la Raza») al pasar por encima o al llegar con el teclado. El
 * `<input type=date>` del navegador solo sabe de mínimo y máximo: no puede apagar un sábado.
 *
 * El valor es ISO («2026-10-25») o `""`. Lo escrito que no es una fecha queda en `text` (el valor
 * se vacía y la validez lo dice). Participa en un <form> nativo (`name`), con `required` y su
 * validez: falta, no es una fecha, fuera de rango o un día bloqueado.
 */
import { attrProps, Base, boolAttr, upgrade } from "../../core/define";
import { addMonths, dayOf, dayOfISO, isoOf, startOfWeek, todayOf, ymd } from "../../core/days";
import { emit, h, setAttr } from "../../core/dom";
import { glyph } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import { resolveLocale } from "../../core/locale";
import { dayLabel, monthGrid, monthTitle, weekdays, weekStartOf } from "../date-range/logic";
import { blockedReason, cleanUnavailable, limitOf, parseDay, patternOf, plainUnavailable, writeDay, type Unavailable } from "./logic";
import type { DateChangeDetail, DateLabels, DateUnavailable } from "./types";

export const DATE_LABELS: DateLabels = {
  day: "d",
  month: "m",
  year: "a",
  open: "Abrir calendario",
  dialog: "Elegir fecha",
  prevMonth: "Mes anterior",
  nextMonth: "Mes siguiente",
  today: "hoy",
  unavailable: "Ese día no se puede elegir",
  outOfRange: "Queda fuera de las fechas permitidas",
  invalid: "Escribe una fecha válida",
};

const CAL = '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>';
const PREV = '<path d="m15 18-6-6 6-6"/>';
const NEXT = '<path d="m9 18 6-6-6-6"/>';

let uid = 0;

export class NxDate extends Base {
  static formAssociated = true;
  static {
    attrProps(this, ["locale", "placeholder", "label"]);
  }
  declare locale: string | null;
  /** Sin él, la guía del formato («dd/mm/aaaa»). */
  declare placeholder: string | null;
  /** Nombre para el lector, si no hay un `<label>`. */
  declare label: string | null;
  static observedAttributes = ["value", "min", "max", "today", "unavailable", "week-start", "name", "required", "disabled", "placeholder", "labels", "label", "locale"];

  #uid = `nx-date${++uid}`;
  #value = "";
  #text = "";
  /** El valor lo puso alguien (o la prop `value`): el atributo ya no lo pisa. */
  #dirty = false;
  #blocked: Unavailable | null = null;
  #labels: DateLabels = DATE_LABELS;
  #internals: ElementInternals | null = null;
  #built = false;
  #isOpen = false;
  /** El mes a la vista: año × 12 + (mes − 1). */
  #view = 0;
  #focus = 0;
  #input?: HTMLInputElement;
  #btn?: HTMLButtonElement;
  #pop?: HTMLDivElement;
  #title?: HTMLParagraphElement;
  #grid?: HTMLDivElement;
  #note?: HTMLParagraphElement;
  #track?: () => void;

  constructor() {
    super();
    try {
      this.#internals = (this as HTMLElement).attachInternals?.() ?? null;
    } catch {
      this.#internals = null;
    }
  }

  // ---------------------------------------------------------------- propiedades

  /** ISO («2026-10-25») o `""`. Asignar un texto que no es ISO lo deja escrito (y el valor, vacío). */
  get value(): string {
    return this.#value;
  }
  set value(v: string | null | undefined) {
    if (v === undefined) return;
    this.#dirty = true;
    this.#setText(v ?? "", true);
  }
  /** Lo que dice la caja, tal cual (una fecha a medio escribir, o una que no existe). */
  get text(): string {
    return this.#text;
  }
  get min(): string | null {
    return this.getAttribute("min");
  }
  set min(v: string | null) {
    setAttr(this, "min", v);
  }
  get max(): string | null {
    return this.getAttribute("max");
  }
  set max(v: string | null) {
    setAttr(this, "max", v);
  }
  /** «Hoy» (ISO) para marcarlo y para `min`/`max` = «today»; sin él, la fecha del equipo. */
  get today(): string {
    return isoOf(todayOf(this.getAttribute("today")));
  }
  set today(v: string | null) {
    setAttr(this, "today", v);
  }
  /** Lo que no se puede elegir: `{dates, weekdays}` (ver `DateUnavailable`). El atributo, en JSON. */
  get unavailable(): DateUnavailable | undefined {
    return plainUnavailable(this.#blocked);
  }
  set unavailable(v: DateUnavailable | string | null | undefined) {
    if (v === undefined) return;
    this.#blocked = cleanUnavailable(v);
    this.#sync();
    if (this.#isOpen) this.#renderCal();
  }
  /** Primer día de la semana, 1 (lunes) … 7 (domingo). Por defecto, el del locale. */
  get weekStart(): number {
    const n = Number(this.getAttribute("week-start"));
    return Number.isInteger(n) && n >= 1 && n <= 7 ? n : weekStartOf(resolveLocale(this));
  }
  set weekStart(v: number) {
    setAttr(this, "week-start", String(v));
  }
  get name(): string {
    return this.getAttribute("name") ?? "";
  }
  set name(v: string) {
    setAttr(this, "name", v);
  }
  get required(): boolean {
    return boolAttr(this, "required");
  }
  set required(v: boolean) {
    this.toggleAttribute("required", !!v);
  }
  get disabled(): boolean {
    return boolAttr(this, "disabled");
  }
  set disabled(v: boolean) {
    this.toggleAttribute("disabled", !!v);
  }
  get labels(): DateLabels {
    return this.#labels;
  }
  set labels(v: Partial<DateLabels> | null | undefined) {
    this.#labels = mergeLabels(DATE_LABELS, v);
    this.#paint();
  }
  get open(): boolean {
    return this.#isOpen;
  }
  /** Por qué no sirve el valor (falta, fuera de rango, un día bloqueado), o `""`. */
  get validationMessage(): string {
    return this.#problem();
  }

  show(): void {
    if (this.disabled || !this.#pop || this.#isOpen) return;
    this.#pop.showPopover();
  }
  hide(): void {
    if (this.#isOpen) this.#pop!.hidePopover();
  }
  focus(options?: FocusOptions): void {
    this.#input?.focus(options);
  }

  // ---------------------------------------------------------------- ciclo de vida

  connectedCallback(): void {
    upgrade(this);
    if (!this.#built) this.#build();
    if (!this.#dirty) this.#setText(this.getAttribute("value") ?? "", false);
    this.#paint();
    // Un <label for> que viene después en el documento ya existe en el siguiente turno.
    queueMicrotask(() => this.#paint());
  }

  disconnectedCallback(): void {
    this.#track?.();
    if (this.#isOpen) {
      this.#isOpen = false;
      this.#btn?.setAttribute("aria-expanded", "false");
    }
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "labels") {
      try {
        this.labels = value === null ? null : JSON.parse(value);
      } catch {
        console.warn('[nx-date] el atributo "labels" no es JSON válido');
      }
      return;
    }
    if (name === "unavailable") {
      this.unavailable = value;
      return;
    }
    if (name === "value") {
      if (!this.#dirty) this.#setText(value ?? "", false);
      return;
    }
    if (name === "disabled" && value !== null) this.hide();
    this.#sync();
    this.#paint();
    if (this.#isOpen) this.#renderCal();
  }

  formResetCallback(): void {
    this.#dirty = false;
    this.#setText(this.getAttribute("value") ?? "", false);
  }

  formDisabledCallback(disabled: boolean): void {
    if (disabled) this.hide();
    if (this.#input) this.#input.disabled = disabled || this.disabled;
    if (this.#btn) this.#btn.disabled = disabled || this.disabled;
  }

  // ---------------------------------------------------------------- interno

  #locale(): string {
    return resolveLocale(this);
  }
  #bounds(): [number, number] {
    const t = this.today;
    return [dayOfISO(limitOf(this.min, t)) ?? -Infinity, dayOfISO(limitOf(this.max, t)) ?? Infinity];
  }
  /** Un día que se puede elegir: dentro de `min`/`max` y no bloqueado. */
  #ok(day: number): boolean {
    const [lo, hi] = this.#bounds();
    return day >= lo && day <= hi && blockedReason(this.#blocked, isoOf(day)) === null;
  }
  /** Por qué no se puede elegir el día, o `""`. */
  #why(day: number): string {
    const [lo, hi] = this.#bounds();
    if (day < lo || day > hi) return this.#labels.outOfRange;
    const r = blockedReason(this.#blocked, isoOf(day));
    return r === null ? "" : r || this.#labels.unavailable;
  }
  #problem(): string {
    if (!this.#value) return this.#text.trim() ? this.#labels.invalid : "";
    return this.#why(dayOfISO(this.#value)!);
  }

  /** Lo escrito (o asignado) → texto y valor. `pretty` lo reescribe en el formato del locale. */
  #setText(raw: string, pretty: boolean): void {
    const iso = parseDay(raw, this.#locale());
    this.#value = iso;
    this.#text = iso && (pretty || dayOfISO(raw.trim()) !== null) ? writeDay(iso, this.#locale()) : raw;
    if (this.#input && this.#input.value !== this.#text) this.#input.value = this.#text;
    this.#sync();
  }

  #sync(): void {
    const i = this.#internals;
    if (!i) return;
    try {
      i.setFormValue(this.#value || null);
      const why = this.#problem();
      if (this.required && !this.#value && !this.#text.trim()) i.setValidity({ valueMissing: true }, this.#labels.invalid, this.#input);
      else if (!why) i.setValidity({});
      else if (!this.#value) i.setValidity({ badInput: true }, why, this.#input);
      else {
        const [lo, hi] = this.#bounds();
        const d = dayOfISO(this.#value)!;
        i.setValidity(d < lo ? { rangeUnderflow: true } : d > hi ? { rangeOverflow: true } : { customError: true }, why, this.#input);
      }
    } catch {
      /* happy-dom y navegadores sin form-associated */
    }
  }

  #commit(iso: string): void {
    const was = this.#value;
    this.#dirty = true;
    this.#setText(iso, true);
    if (this.#value === was) return;
    emit(this, "nx-date-change", { value: this.#value } satisfies DateChangeDetail);
    // Y el `input`/`change` de cualquier control: `<nx-form>`, `<nx-field>` y un framework lo leen así.
    this.dispatchEvent(new Event("input", { bubbles: true }));
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  #build(): void {
    this.#built = true;
    const popId = `${this.#uid}-pop`;
    const titleId = `${this.#uid}-t`;
    this.#input = h("input", { type: "text", class: "nx-date__input", inputmode: "numeric", autocomplete: "off", spellcheck: "false", enterkeyhint: "next" });
    this.#btn = h("button", { type: "button", class: "nx-date__btn", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": popId }, glyph(CAL));
    this.#title = h("p", { class: "nx-date__title", id: titleId, "aria-live": "polite" });
    this.#grid = h("div", { class: "nx-date__grid", role: "grid", "aria-labelledby": titleId });
    this.#note = h("p", { class: "nx-date__note", "aria-live": "polite" });
    const nav = (dir: -1 | 1) => h("button", { type: "button", class: "nx-date__nav", "data-nav": dir }, glyph(dir < 0 ? PREV : NEXT));
    this.#pop = h("div", { id: popId, class: "nx-date__pop", popover: "auto", role: "dialog" }, h("div", { class: "nx-date__head" }, nav(-1), this.#title, nav(1)), this.#grid, this.#note);
    this.append(h("div", { class: "nx-date__box" }, this.#input, this.#btn), this.#pop);

    const input = this.#input;
    // Un clic en su <label> llega al elemento: el foco va a la caja.
    this.addEventListener("click", (e) => e.target === this && input.focus());
    input.addEventListener("input", () => {
      // Mientras se escribe, el valor sigue a lo escrito (el `input` nativo ya burbujea).
      this.#dirty = true;
      this.#setText(input.value, false);
    });
    input.addEventListener("change", (e) => {
      // Al salir: en el formato del locale, y un solo `change` con el valor ya leído.
      this.#setText(input.value, true);
      e.stopPropagation();
      this.dispatchEvent(new Event("change", { bubbles: true }));
      emit(this, "nx-date-change", { value: this.#value } satisfies DateChangeDetail);
    });
    input.addEventListener("keydown", (e) => {
      // Alt+↓ abre el calendario (como un <select>); ↓ también, con la caja vacía.
      if (e.key === "ArrowDown" && (e.altKey || !input.value)) {
        e.preventDefault();
        this.show();
      }
    });
    let wasOpen = false;
    this.#btn.addEventListener("pointerdown", () => (wasOpen = this.#isOpen));
    this.#btn.addEventListener("click", () => {
      if (this.#isOpen) this.hide();
      else if (!wasOpen) this.show();
      wasOpen = false;
    });

    const pop = this.#pop;
    pop.addEventListener("beforetoggle", (e) => {
      this.#isOpen = (e as ToggleEvent).newState === "open";
      if (!this.#isOpen) return;
      const start = dayOfISO(this.#value) ?? todayOf(this.today);
      const [lo, hi] = this.#bounds();
      this.#focus = Math.min(Math.max(start, lo), hi);
      // Sin fecha, el foco va al primer día que se puede elegir (hoy puede ser domingo o festivo).
      if (!this.#value) {
        let d = this.#focus;
        while (d < this.#focus + 62 && d <= hi && !this.#ok(d)) d++;
        if (this.#ok(d)) this.#focus = d;
      }
      const [y, m] = ymd(this.#focus);
      this.#view = y * 12 + m - 1;
      this.#renderCal();
      this.#place();
      requestAnimationFrame(() => this.#place());
      this.#startTracking();
    });
    pop.addEventListener("toggle", (e) => {
      const open = (e as ToggleEvent).newState === "open";
      this.#btn!.setAttribute("aria-expanded", String(open));
      if (open) this.#focusDay();
      else if (!this.#isOpen) {
        this.#track?.();
        const a = document.activeElement;
        if (!a || a === document.body || pop.contains(a)) input.focus();
      }
      if (open === this.#isOpen) emit(this, "nx-open-change", { open });
    });
    pop.addEventListener("focusout", (e) => {
      const to = e.relatedTarget as Node | null;
      if (to && !pop.contains(to) && to !== this.#btn) this.hide();
    });
    pop.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      this.hide();
      input.focus();
    });
    pop.addEventListener("click", (e) => {
      const t = e.target as Element;
      const nav = t.closest<HTMLElement>("[data-nav]");
      if (nav) {
        const dir = Number(nav.dataset.nav);
        this.#view += dir;
        this.#focus = addMonths(this.#focus, dir);
        this.#renderCal();
        return;
      }
      const cell = t.closest<HTMLElement>("[data-day]");
      if (cell) this.#pick(Number(cell.dataset.day));
    });
    this.#grid.addEventListener("pointerover", (e) => {
      const cell = (e.target as Element).closest<HTMLElement>("[data-day]");
      if (cell) this.#explain(Number(cell.dataset.day));
    });
    this.#grid.addEventListener("pointerleave", () => this.#explain(this.#focus));
    this.#grid.addEventListener("keydown", (e) => this.#gridKey(e));
  }

  #pick(day: number): void {
    this.#focus = day;
    if (!this.#ok(day)) {
      // Se queda abierto y dice por qué: un clic en un festivo no es un error que haya que adivinar.
      this.#paintCells();
      this.#explain(day);
      this.#note!.classList.remove("is-shake");
      void this.#note!.offsetWidth;
      this.#note!.classList.add("is-shake");
      return;
    }
    this.#commit(isoOf(day));
    this.hide();
    this.#input!.focus();
  }

  /** Teclado del calendario (patrón «grid» de WAI-ARIA para fechas). */
  #gridKey(e: KeyboardEvent): void {
    const d = this.#focus;
    const k = e.key;
    const sow = startOfWeek(d, this.weekStart);
    const step: Record<string, number> = { ArrowLeft: d - 1, ArrowRight: d + 1, ArrowUp: d - 7, ArrowDown: d + 7, Home: sow, End: sow + 6 };
    if (k === "PageUp" || k === "PageDown") step[k] = addMonths(d, (k === "PageUp" ? -1 : 1) * (e.shiftKey ? 12 : 1));
    if (k === "Enter" || k === " ") {
      e.preventDefault();
      this.#pick(d);
    } else if (k in step) {
      e.preventDefault();
      this.#moveTo(step[k]);
    }
  }

  #moveTo(day: number): void {
    this.#focus = day;
    const [y, m] = ymd(day);
    const idx = y * 12 + m - 1;
    if (idx !== this.#view) {
      this.#view = idx;
      this.#renderCal();
    } else this.#paintCells();
    this.#focusDay();
  }

  #focusDay(): void {
    this.#grid!.querySelector<HTMLElement>(`[data-day="${this.#focus}"]`)?.focus();
    this.#explain(this.#focus);
  }

  /** La nota de abajo: por qué no se puede elegir el día enfocado o señalado (vacía si se puede). */
  #explain(day: number): void {
    const why = this.#why(day);
    this.#note!.textContent = why ? `${dayLabel(day, this.#locale())}: ${why}` : "";
  }

  #renderCal(): void {
    const loc = this.#locale();
    const ws = this.weekStart;
    const y = Math.floor(this.#view / 12);
    const m = (this.#view % 12) + 1;
    const T = todayOf(this.today);
    const L = this.#labels;
    this.#title!.textContent = monthTitle(y, m, loc);
    const cells = monthGrid(y, m, ws);
    const rows: HTMLElement[] = [h("div", { role: "row", class: "nx-date__row" }, ...weekdays(loc, ws).map((w) => h("span", { role: "columnheader", class: "nx-date__wd", title: w.long, "aria-label": w.long }, w.short)))];
    for (let i = 0; i < cells.length; i += 7)
      rows.push(
        h(
          "div",
          { role: "row", class: "nx-date__row" },
          ...cells.slice(i, i + 7).map((d) => {
            if (d === null) return h("span", { role: "gridcell", class: "nx-date__blank" });
            const why = this.#why(d);
            return h(
              "span",
              { role: "gridcell", class: "nx-date__day", "data-day": d, tabindex: "-1", title: why || null, "aria-label": dayLabel(d, loc) + (d === T ? `, ${L.today}` : "") + (why ? `, ${why}` : ""), "aria-current": d === T ? "date" : null, "aria-disabled": why ? "true" : null },
              String(ymd(d)[2]),
            );
          }),
        ),
      );
    this.#grid!.replaceChildren(...rows);
    const [lo, hi] = this.#bounds();
    const first = dayOf(y, m, 1);
    const last = addMonths(first, 1) - 1;
    (this.#pop!.querySelector("[data-nav='-1']") as HTMLButtonElement).disabled = first <= lo;
    (this.#pop!.querySelector("[data-nav='1']") as HTMLButtonElement).disabled = last >= hi;
    this.#paintCells();
  }

  /** Lo elegido y el foco, sin reconstruir. */
  #paintCells(): void {
    const sel = dayOfISO(this.#value);
    let tab: HTMLElement | null = null;
    const cells = this.#grid!.querySelectorAll<HTMLElement>("[data-day]");
    for (const el of cells) {
      const d = Number(el.dataset.day);
      el.setAttribute("aria-selected", String(d === sel));
      el.tabIndex = -1;
      if (d === this.#focus) tab = el;
    }
    (tab ?? cells[0])?.setAttribute("tabindex", "0");
  }

  #paint(): void {
    if (!this.#built) return;
    const L = this.#labels;
    const input = this.#input!;
    const off = this.disabled;
    input.disabled = off;
    this.#btn!.disabled = off;
    input.placeholder = this.placeholder ?? patternOf(this.#locale(), L);
    // El nombre: `label`, o el <label for> del elemento (es él el etiquetable, no la caja de adentro).
    let label = this.label ?? "";
    let ids: string[] = [];
    if (!label) {
      try {
        ids = Array.from(this.#internals?.labels ?? [], (l, i) => ((l as HTMLElement).id ||= `${this.#uid}-l${i}`));
      } catch {
        /* sin `internals.labels` */
      }
      label = ids.map((id) => document.getElementById(id)?.textContent?.trim() ?? "").filter(Boolean).join(" ");
    }
    setAttr(input, "aria-label", ids.length ? null : label);
    setAttr(input, "aria-labelledby", ids.join(" "));
    this.#btn!.setAttribute("aria-label", label ? `${L.open}: ${label}` : L.open);
    this.#pop!.setAttribute("aria-label", L.dialog);
    for (const b of this.#pop!.querySelectorAll<HTMLElement>("[data-nav]")) b.setAttribute("aria-label", b.dataset.nav === "-1" ? L.prevMonth : L.nextMonth);
  }

  /** Debajo de la caja, alineado a su borde; arriba si abajo no cabe. */
  #place(): void {
    const pop = this.#pop!;
    const r = this.#input!.parentElement!.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const left = Math.min(Math.max(8, r.left), vw - pop.offsetWidth - 8);
    const ph = pop.offsetHeight;
    const below = vh - r.bottom - 6;
    const top = ph > below && r.top > below ? Math.max(8, r.top - 6 - ph) : r.bottom + 6;
    Object.assign(pop.style, { left: `${Math.max(8, left)}px`, top: `${top}px` });
  }

  #startTracking(): void {
    this.#track?.();
    let raf = 0;
    const onMove = (e: Event) => {
      if (e.target instanceof Node && this.#pop!.contains(e.target)) return;
      if (!raf) raf = requestAnimationFrame(() => ((raf = 0), this.#place()));
    };
    addEventListener("scroll", onMove, { capture: true, passive: true });
    addEventListener("resize", onMove, { passive: true });
    this.#track = () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", onMove, { capture: true });
      removeEventListener("resize", onMove);
      this.#track = undefined;
    };
  }
}
