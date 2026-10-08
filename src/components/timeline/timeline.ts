/**
 * `<nx-timeline>`: la cinta del tiempo de una persona o de un registro. Varios carriles sobre un
 * mismo eje de días —pagos como barras cuyo alto es el monto, vacaciones e incapacidades como
 * franjas, permisos como puntos—, con los meses, los festivos y la línea de hoy.
 *
 * Reglas de diseño:
 * - **Se lee de un vistazo, se detalla al pasar.** Cada marca dice poco en su sitio (su alto, su
 *   color, su forma); la lente dice el resto al pasar el puntero o llegar con el teclado.
 * - **Un solo Tab.** La cinta es un grupo con un punto de tabulación; las flechas pasan de una
 *   marca a otra en el orden del eje (como una barra de herramientas).
 * - **Marcas que llevan a algún lado son `<a href>` de verdad**: el router de la app las navega,
 *   Ctrl/⌘+clic abre otra pestaña. `nx-timeline-select` (cancelable) para decidir otra cosa.
 * - **Nada se mide en JavaScript.** Las posiciones van en % del ancho y el alto de cada carril es
 *   una variable CSS: cambiar el tamaño de la ventana no recalcula nada. En pantallas angostas la
 *   cinta se desplaza a lo ancho y arranca mostrando hoy.
 * - **La lente vive en la capa superior** (Popover API): ningún `overflow` de la página la recorta.
 */
import { Base, upgrade } from "../../core/define";
import { emit, h, reducedMotion, safeHref, setAttr } from "../../core/dom";
import { holidayLookup, type HolidaySource } from "../../core/holidays";
import { mergeLabels } from "../../core/labels";
import { resolveLocale } from "../../core/locale";
import { holidaysIn, layoutMarks, monthTicks, timelineRange, type TimelineMark, type TimelineRange } from "./logic";
import type { TimelineHolidays, TimelineItem, TimelineLabels, TimelineLane, TimelineLegendItem, TimelineSelectDetail } from "./types";

export const TIMELINE_LABELS: TimelineLabels = {
  region: "Línea de tiempo",
  today: "Hoy · {date}",
  holiday: "Festivo",
  hint: "Usa las flechas para pasar de una marca a otra.",
  done: "",
  upcoming: "por llegar",
  pending: "por aprobar",
  rejected: "no aprobado",
  draft: "sin enviar",
};

const MS = 864e5;
let uid = 0;

/** Formatos de fecha por locale (Intl es caro de construir). */
const dateFormats = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = dateFormats.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" });
    } catch {
      f = new Intl.DateTimeFormat("es-CO", { ...opts, timeZone: "UTC" });
    }
    dateFormats.set(key, f);
  }
  return f;
}
/** «ene», sin el punto que agregan algunos locales. */
const monthName = (locale: string, day: number) => fmt(locale, { month: "short" }).format(day * MS).replace(/\.$/, "");
/** «8 oct»: la forma corta, sin el «de» ni el punto que agregan algunos locales. */
const shortDay = (locale: string, day: number) =>
  fmt(locale, { day: "numeric", month: "short" })
    .formatToParts(day * MS)
    .map((p) => (p.type === "literal" && /^\s*de\s*$/.test(p.value) ? " " : p.type === "month" ? p.value.replace(/\.$/, "") : p.value))
    .join("");

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);

export class NxTimeline extends Base {
  static observedAttributes = ["lanes", "items", "legend", "holidays", "labels", "start", "end", "today", "heading", "heading-level", "summary", "highlight", "locale"];

  #lanes: TimelineLane[] = [];
  #items: TimelineItem[] = [];
  #legend: TimelineLegendItem[] = [];
  #holidays: TimelineHolidays = "co";
  #labels: TimelineLabels = TIMELINE_LABELS;
  #uid = `nx-tl${++uid}`;
  #root?: HTMLDivElement;
  #lens?: HTMLDivElement;
  #scroll?: HTMLDivElement;
  #marks = new Map<string, { mark: TimelineMark; el: HTMLElement }>();
  #order: string[] = [];
  #rove: string | null = null;
  #range?: TimelineRange;
  #queued = false;
  #rendered = false;
  #introduced = false;
  #abort?: AbortController;
  #lensFor: Element | null = null;
  #lensAbort?: AbortController;

  // ---------------------------------------------------------------- propiedades

  /** Los carriles, de arriba abajo: `{id, label, kind?: "bars" | "ranges" | "points", shape?}`. */
  get lanes(): TimelineLane[] {
    return this.#lanes;
  }
  set lanes(value: TimelineLane[] | null | undefined) {
    this.#lanes = asArray<TimelineLane>(value).filter((l) => typeof l.id === "string" && l.id !== "");
    this.#schedule();
  }

  /** Las marcas: `{id?, lane, date | start/end, value?, extra?, state?, tone?, label, detail?, action?, href?, caption?}`. */
  get items(): TimelineItem[] {
    return this.#items;
  }
  set items(value: TimelineItem[] | null | undefined) {
    this.#items = asArray<TimelineItem>(value);
    this.#schedule();
  }

  /** La leyenda: `{mark, label}` por cada clase de marca que haga falta explicar. */
  get legend(): TimelineLegendItem[] {
    return this.#legend;
  }
  set legend(value: TimelineLegendItem[] | null | undefined) {
    this.#legend = asArray<TimelineLegendItem>(value).filter((l) => typeof l.label === "string");
    this.#schedule();
  }

  /** `"co"` (por defecto, los de Colombia), una lista de fechas o de `{date, name}`, o `null`. */
  get holidays(): TimelineHolidays {
    return this.#holidays;
  }
  set holidays(value: TimelineHolidays | undefined) {
    this.#holidays = value === undefined ? "co" : value === null || value === "co" ? value : Array.isArray(value) ? value : "co";
    this.#schedule();
  }

  get labels(): TimelineLabels {
    return this.#labels;
  }
  set labels(value: Partial<TimelineLabels> | null | undefined) {
    this.#labels = mergeLabels(TIMELINE_LABELS, value);
    this.#schedule();
  }

  /** Primer y último día del eje (ISO). Sin ellos, de hace 8 meses a dentro de 4. */
  get start(): string | null {
    return this.getAttribute("start");
  }
  set start(v: string | null | undefined) {
    setAttr(this, "start", v);
  }
  get end(): string | null {
    return this.getAttribute("end");
  }
  set end(v: string | null | undefined) {
    setAttr(this, "end", v);
  }
  /** «Hoy» (ISO): la línea, y lo que está antes es `done` y después `upcoming`. Sin él, la fecha local. */
  get today(): string | null {
    return this.getAttribute("today");
  }
  set today(v: string | null | undefined) {
    setAttr(this, "today", v);
  }
  /** Título de la cinta (también su nombre para el lector de pantalla). */
  get heading(): string | null {
    return this.getAttribute("heading");
  }
  set heading(v: string | null | undefined) {
    setAttr(this, "heading", v);
  }
  /** Nivel del título (2 por defecto). */
  get headingLevel(): number {
    const n = Number(this.getAttribute("heading-level"));
    return n >= 1 && n <= 6 ? Math.floor(n) : 2;
  }
  set headingLevel(v: number | null | undefined) {
    setAttr(this, "heading-level", v == null ? null : String(v));
  }
  /** Una línea junto al título («$ 36.600.400 recibidos en 18 quincenas»). */
  get summary(): string | null {
    return this.getAttribute("summary");
  }
  set summary(v: string | null | undefined) {
    setAttr(this, "summary", v);
  }
  /** El `id` de la marca resaltada (la que se está viendo en otra parte de la página). */
  get highlight(): string | null {
    return this.getAttribute("highlight");
  }
  set highlight(v: string | null | undefined) {
    setAttr(this, "highlight", v);
  }
  get locale(): string | null {
    return this.getAttribute("locale");
  }
  set locale(v: string | null | undefined) {
    setAttr(this, "locale", v);
  }

  /** Enfoca la marca `id` (o la de hoy). */
  focusItem(id?: string): void {
    this.#flush();
    const key = id ?? this.#rove;
    const el = key ? this.#marks.get(key)?.el : undefined;
    el?.focus();
  }

  /** Desplaza la cinta para que se vea hoy (o el día ISO dado). */
  scrollToDay(iso?: string): void {
    this.#flush();
    const sc = this.#scroll;
    const r = this.#range;
    if (!sc || !r || sc.scrollWidth <= sc.clientWidth) return;
    const day = iso ? Math.round(Date.parse(`${iso}T00:00:00Z`) / MS) : r.today;
    if (!Number.isFinite(day)) return;
    const frac = (day - r.from + 0.5) / (r.to - r.from + 1);
    sc.scrollLeft = Math.max(0, frac * sc.scrollWidth - sc.clientWidth * 0.6);
  }

  // ---------------------------------------------------------------- ciclo de vida

  connectedCallback(): void {
    upgrade(this);
    if (!this.#root) this.#root = h("div", { class: "nx-timeline__root" });
    if (this.#root.parentNode !== this) this.append(this.#root);
    this.#abort?.abort();
    const signal = (this.#abort = new AbortController()).signal;
    const root = this.#root;
    root.addEventListener("pointerover", this.#onOver, { signal });
    root.addEventListener("pointerout", this.#onOut, { signal });
    root.addEventListener("focusin", this.#onFocusIn, { signal });
    root.addEventListener("focusout", this.#onFocusOut, { signal });
    root.addEventListener("click", this.#onClick, { signal });
    root.addEventListener("keydown", this.#onKey, { signal });
    this.#rendered = false;
    this.#render();
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
    this.#hideLens();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "lanes" || name === "items" || name === "legend" || name === "holidays" || name === "labels") {
      if (value === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        // `holidays="co"` es texto, no JSON.
        if (name === "holidays" && value.trim() === "co") return void (this.holidays = "co");
        console.warn(`[nx-timeline] el atributo "${name}" no es JSON válido`);
        return;
      }
      (this as unknown as Record<string, unknown>)[name] = parsed;
      return;
    }
    this.#schedule();
  }

  // ---------------------------------------------------------------- estado interno

  #schedule(): void {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => this.#flush());
  }

  #flush(): void {
    if (!this.#queued && this.#rendered) return;
    this.#queued = false;
    if (this.isConnected && this.#root) this.#render();
  }

  // ---------------------------------------------------------------- render

  #render(): void {
    const root = this.#root!;
    this.#queued = false;
    this.#hideLens();
    const first = !this.#rendered;
    this.#rendered = true;
    const L = this.#labels;
    const locale = resolveLocale(this);
    const r = (this.#range = timelineRange(this.start, this.end, this.today));
    const lanes = this.#lanes;
    const marks = layoutMarks(lanes, this.#items, r);
    const ticks = monthTicks(r);

    // El foco, para devolverlo si estaba en una marca.
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active && root.contains(active) ? active.dataset.nxKey ?? null : null;
    const scrollLeft = this.#scroll?.scrollLeft ?? 0;

    root.replaceChildren();
    const headingId = `${this.#uid}-h`;
    const hintId = `${this.#uid}-hint`;

    // ---- cabecera: título, resumen y leyenda
    const heading = this.heading;
    const summary = this.summary;
    if (heading || summary || this.#legend.length) {
      const head = h("div", { class: "nx-timeline__head" });
      if (heading) head.append(h(`h${this.headingLevel}` as "h2", { class: "nx-timeline__title", id: headingId }, heading));
      if (summary) head.append(h("p", { class: "nx-timeline__summary" }, summary));
      if (this.#legend.length) {
        const ul = h("ul", { class: "nx-timeline__legend" });
        for (const l of this.#legend) ul.append(h("li", null, h("span", { class: `nx-timeline__swatch nx-timeline__swatch--${l.mark}`, "aria-hidden": "true" }), l.label));
        head.append(ul);
      }
      root.append(head);
    }

    // ---- carriles: alto de cada uno (variable CSS por clase) y sus rótulos
    const rowsTpl = [...lanes.map((l) => `var(--nx-timeline-${l.kind === "bars" ? "bars" : l.kind === "points" ? "points" : "ranges"})`), "var(--nx-timeline-axis)"].join(" ");
    const body = h("div", { class: "nx-timeline__body" });
    body.style.setProperty("--nx-timeline-rows", rowsTpl);
    const labelsCol = h("div", { class: "nx-timeline__labels", "aria-hidden": "true" });
    for (const l of lanes) labelsCol.append(h("span", { class: `nx-timeline__lane-label nx-timeline__lane-label--${l.kind ?? "ranges"}` }, l.label));
    labelsCol.append(h("span", null));

    const scroll = (this.#scroll = h("div", { class: "nx-timeline__scroll" }));
    const track = h("div", {
      class: "nx-timeline__track",
      role: "group",
      "aria-labelledby": heading ? headingId : null,
      "aria-label": heading ? null : L.region,
      "aria-describedby": marks.length ? hintId : null,
    });
    track.style.setProperty("--nx-timeline-months", String(Math.max(1, ticks.length)));

    // ---- la rejilla: meses, pasado, ejes, festivos y hoy (decorativa)
    const grid = h("div", { class: "nx-timeline__grid", "aria-hidden": "true" });
    ticks.forEach((t, i) => {
      const col = h("div", { class: `nx-timeline__month${i % 2 ? " is-alt" : ""}` });
      col.style.left = `${t.left}%`;
      col.style.width = `${t.width}%`;
      grid.append(col);
    });
    const todayIn = r.today >= r.from && r.today <= r.to;
    const todayX = ((r.today - r.from + 0.5) / (r.to - r.from + 1)) * 100;
    if (r.today > r.from) {
      const past = h("div", { class: "nx-timeline__past" });
      past.style.width = `${Math.min(100, todayIn ? ((r.today - r.from) / (r.to - r.from + 1)) * 100 : 100)}%`;
      grid.append(past);
    }
    // Rayas entre carriles: una por carril, en su borde de abajo (la rejilla de la pista las ubica).
    const lines = h("div", { class: "nx-timeline__lines" });
    for (let i = 0; i < lanes.length; i++) lines.append(h("span", null));
    grid.append(lines);
    const axis = h("div", { class: "nx-timeline__axis" });
    const todayDate = shortDay(locale, r.today);
    ticks.forEach((t) => {
      // El mes de hoy cede su rótulo a la pastilla de hoy (si no, se pisan).
      const isTodayMonth = todayIn && r.today >= t.day && r.today - t.day < 31 && t.left + t.width > todayX;
      if (isTodayMonth && todayX - t.left < 6) return;
      const lbl = h("span", { class: "nx-timeline__month-label" }, monthName(locale, t.day));
      if (t.withYear) lbl.append(" ", h("b", null, String(t.year)));
      lbl.style.left = `${t.left}%`;
      axis.append(lbl);
    });
    const lookup = holidayLookup(this.#holidays as HolidaySource);
    for (const hd of holidaysIn(r, lookup)) {
      const tick = h("span", { class: "nx-timeline__holiday", "data-nx-holiday": String(hd.day), "data-nx-name": hd.name });
      tick.style.left = `${((hd.day - r.from + 0.5) / (r.to - r.from + 1)) * 100}%`;
      axis.append(tick);
    }
    if (todayIn) {
      const line = h("div", { class: "nx-timeline__today" });
      line.style.left = `${todayX}%`;
      grid.append(line);
      const pill = h("span", { class: "nx-timeline__today-pill" }, L.today.replace("{date}", todayDate));
      pill.style.left = `${todayX}%`;
      axis.append(pill);
    }
    grid.append(axis);
    track.append(grid);

    // ---- las marcas, en el carril que les toca
    const laneEls = lanes.map((l) => h("div", { class: `nx-timeline__lane nx-timeline__lane--${l.kind ?? "ranges"}${l.shape === "diamond" ? " is-diamond" : ""}` }));
    const highlight = this.highlight;
    this.#marks.clear();
    for (const m of marks) {
      const el = this.#markEl(m, highlight);
      laneEls[m.lane].append(el);
      this.#marks.set(m.key, { mark: m, el });
    }
    track.append(...laneEls);
    if (marks.length) track.append(h("span", { class: "nx-timeline__sr", id: hintId }, L.hint));
    scroll.append(track);
    body.append(labelsCol, scroll);
    root.append(body);
    if (!this.#lens) {
      this.#lens = h("div", { class: "nx-timeline__lens", "aria-hidden": "true", hidden: true });
      if ("popover" in HTMLElement.prototype) this.#lens.setAttribute("popover", "manual");
    }
    root.append(this.#lens);

    // ---- un solo punto de tabulación: el que tenía el foco, el resaltado, o el de hoy
    this.#order = marks.map((m) => m.key);
    const pick =
      (focusKey && this.#marks.has(focusKey) && focusKey) ||
      (this.#rove && this.#marks.has(this.#rove) && this.#rove) ||
      marks.find((m) => highlight && m.item.id === highlight)?.key ||
      marks.find((m) => m.b >= r.today)?.key ||
      marks[marks.length - 1]?.key ||
      null;
    this.#rove = pick;
    if (pick) this.#marks.get(pick)!.el.tabIndex = 0;
    if (focusKey && pick === focusKey) this.#marks.get(pick)!.el.focus({ preventScroll: true });

    if (first) {
      // Arranca mostrando hoy (solo la primera vez: después se respeta lo que la persona movió).
      requestAnimationFrame(() => this.scrollToDay());
      if (!this.#introduced && marks.length) {
        this.#introduced = true;
        this.#intro();
      }
    } else {
      scroll.scrollLeft = scrollLeft;
    }
  }

  #markEl(m: TimelineMark, highlight: string | null): HTMLElement {
    const it = m.item;
    const href = safeHref(it.href);
    const L = this.#labels;
    const stateText = m.state === "pending" || m.state === "rejected" || m.state === "draft" || m.state === "upcoming" ? L[m.state] : L.done;
    const name = [it.label, ...(Array.isArray(it.detail) ? it.detail : []), stateText].filter((s) => typeof s === "string" && s.trim()).join(". ");
    const tone = it.tone && /^(neutral|info|success|warning|danger)$/.test(it.tone) ? ` is-tone-${it.tone}` : "";
    const cls = `nx-timeline__mark nx-timeline__mark--${m.kind === "bars" ? "bar" : m.kind === "points" ? "point" : "range"} is-${m.state}${tone}${highlight && it.id === highlight ? " is-highlight" : ""}`;
    const el = href
      ? h("a", { class: cls, href, "aria-label": name, target: it.newTab ? "_blank" : null, rel: it.newTab ? "noopener" : null })
      : h("button", { class: cls, type: "button", "aria-label": name });
    el.dataset.nxKey = m.key;
    el.tabIndex = -1;
    el.style.left = `${m.x}%`;
    if (m.kind === "bars") {
      el.style.setProperty("--h", String(Math.round(m.h * 1000) / 10));
      const bar = h("span", { class: "nx-timeline__bar" });
      if (m.extra > 0.005) {
        const x = h("span", { class: "nx-timeline__bar-extra" });
        x.style.height = `${Math.round(m.extra * 1000) / 10}%`;
        bar.append(x);
      }
      el.append(bar);
    } else if (m.kind === "ranges") {
      el.style.width = `${m.w}%`;
      el.style.setProperty("--row", String(m.row));
      el.style.setProperty("--rows", String(m.rows));
    } else {
      el.append(h("span", { class: "nx-timeline__dot" }));
    }
    if (typeof it.caption === "string" && it.caption.trim()) el.append(h("span", { class: "nx-timeline__caption", "aria-hidden": "true" }, it.caption));
    return el;
  }

  /** La entrada: las barras crecen, las franjas se extienden y los puntos aparecen, de izquierda a derecha. */
  #intro(): void {
    if (reducedMotion()) return;
    for (const { mark, el } of this.#marks.values()) {
      const target = (mark.kind === "bars" ? el.querySelector(".nx-timeline__bar") : mark.kind === "points" ? el.querySelector(".nx-timeline__dot") : el) as HTMLElement | null;
      if (!target || typeof target.animate !== "function") continue;
      const from = mark.kind === "bars" ? "scaleY(0)" : mark.kind === "ranges" ? "scaleX(0)" : "scale(0)";
      target.animate([{ transform: from, opacity: mark.kind === "ranges" ? 0 : 1 }, { transform: "none", opacity: 1 }], {
        duration: mark.kind === "points" ? 360 : 520,
        delay: 80 + mark.x * 7,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        fill: "backwards",
      });
    }
  }

  // ---------------------------------------------------------------- la lente

  #showLens(target: HTMLElement): void {
    const lens = this.#lens;
    if (!lens) return;
    let title = "";
    let lines: string[] = [];
    let action = "";
    const holiday = target.dataset.nxHoliday;
    if (holiday !== undefined) {
      const locale = resolveLocale(this);
      title = target.dataset.nxName || this.#labels.holiday;
      lines = [fmt(locale, { weekday: "long", day: "numeric", month: "long" }).format(Number(holiday) * MS), this.#labels.holiday];
      if (!target.dataset.nxName) lines.pop();
    } else {
      const entry = this.#marks.get(target.dataset.nxKey ?? "");
      if (!entry) return;
      const it = entry.mark.item;
      title = it.label;
      lines = Array.isArray(it.detail) ? it.detail.filter((s) => typeof s === "string") : [];
      action = (it.href && typeof it.action === "string" && it.action) || "";
    }
    lens.replaceChildren(h("p", { class: "nx-timeline__lens-title" }, title));
    for (const line of lines) lens.append(h("p", { class: "nx-timeline__lens-line" }, line));
    if (action) lens.append(h("p", { class: "nx-timeline__lens-action" }, action));
    lens.hidden = false;
    if (typeof lens.showPopover === "function" && !lens.matches(":popover-open")) {
      try {
        lens.showPopover();
      } catch {
        /* ya abierto o fuera del documento */
      }
    }
    this.#lensFor = target;
    this.#placeLens(target);
    if (!this.#lensAbort) {
      const signal = (this.#lensAbort = new AbortController()).signal;
      // La lente es fija a la ventana: al desplazar algo, se va (vuelve al pasar otra vez).
      addEventListener("scroll", () => this.#hideLens(), { capture: true, passive: true, signal });
      addEventListener("resize", () => this.#hideLens(), { passive: true, signal });
    }
  }

  #placeLens(target: HTMLElement): void {
    const lens = this.#lens!;
    const r = target.getBoundingClientRect();
    const w = lens.offsetWidth;
    const hh = lens.offsetHeight;
    const vw = document.documentElement.clientWidth || innerWidth;
    const left = Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2));
    let top = r.top - hh - 8;
    if (top < 8) top = r.bottom + 8;
    lens.style.left = `${Math.round(left)}px`;
    lens.style.top = `${Math.round(top)}px`;
  }

  #hideLens(): void {
    this.#lensAbort?.abort();
    this.#lensAbort = undefined;
    this.#lensFor = null;
    const lens = this.#lens;
    if (!lens) return;
    if (typeof lens.hidePopover === "function" && lens.matches?.(":popover-open")) {
      try {
        lens.hidePopover();
      } catch {
        /* nada */
      }
    }
    lens.hidden = true;
  }

  // ---------------------------------------------------------------- eventos

  #targetOf(e: Event): HTMLElement | null {
    const t = e.target as Element | null;
    return (t?.closest?.(".nx-timeline__mark, .nx-timeline__holiday") as HTMLElement | null) ?? null;
  }

  #onOver = (e: PointerEvent): void => {
    const t = this.#targetOf(e);
    if (t && t !== this.#lensFor) this.#showLens(t);
  };

  #onOut = (e: PointerEvent): void => {
    const t = this.#targetOf(e);
    if (!t || t.contains(e.relatedTarget as Node | null)) return;
    // Si el foco del teclado está en esa marca, la lente se queda.
    if (document.activeElement === t) return;
    this.#hideLens();
  };

  #onFocusIn = (e: FocusEvent): void => {
    const t = (e.target as Element | null)?.closest?.(".nx-timeline__mark") as HTMLElement | null;
    if (!t) return;
    const key = t.dataset.nxKey ?? null;
    if (key && key !== this.#rove) {
      const prev = this.#rove ? this.#marks.get(this.#rove)?.el : undefined;
      if (prev) prev.tabIndex = -1;
      t.tabIndex = 0;
      this.#rove = key;
    }
    this.#showLens(t);
  };

  #onFocusOut = (e: FocusEvent): void => {
    if (!this.#root?.contains(e.relatedTarget as Node | null)) this.#hideLens();
  };

  #onClick = (e: MouseEvent): void => {
    const t = (e.target as Element | null)?.closest?.(".nx-timeline__mark") as HTMLElement | null;
    if (!t) return;
    const entry = this.#marks.get(t.dataset.nxKey ?? "");
    if (!entry) return;
    // Un clic con modificador (otra pestaña, otra ventana) es del navegador.
    if (t instanceof HTMLAnchorElement && (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0)) return;
    const detail: TimelineSelectDetail = { item: entry.mark.item, href: t instanceof HTMLAnchorElement ? t.getAttribute("href") : null, newTab: t.getAttribute("target") === "_blank" };
    if (!emit(this, "nx-timeline-select", detail, true)) e.preventDefault();
    this.#hideLens();
  };

  #onKey = (e: KeyboardEvent): void => {
    const t = (e.target as Element | null)?.closest?.(".nx-timeline__mark") as HTMLElement | null;
    if (!t) return;
    if (e.key === "Escape") {
      if (this.#lensFor) {
        e.stopPropagation();
        this.#hideLens();
      }
      return;
    }
    const i = this.#order.indexOf(t.dataset.nxKey ?? "");
    if (i < 0) return;
    const last = this.#order.length - 1;
    const j =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? Math.min(last, i + 1)
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? Math.max(0, i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : -1;
    if (j < 0) return;
    e.preventDefault();
    const next = this.#marks.get(this.#order[j])?.el;
    if (!next) return;
    next.focus();
    next.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };
}
