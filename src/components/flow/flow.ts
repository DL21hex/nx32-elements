/**
 * `<nx-flow>`: el flujo de un día, un punto por elemento. Cada viaje (o caso) es un punto que avanza
 * por las etapas sobre un riel; su color dice cuánto lleva en la etapa contra el límite. Arriba, una
 * frase dice dónde se atasca; abajo, la línea del día deja mirar cualquier hora o repetirlo.
 *
 * Reglas de diseño:
 * - **Un elemento, un punto, siempre el mismo nodo.** Cuando un elemento cambia de etapa, su punto
 *   viaja (`transform`) hasta la nueva: el movimiento se ve. Con datos nuevos (un refresco cada 45 s)
 *   solo se tocan los puntos que cambiaron.
 * - **El color es el tiempo en la etapa, no la etapa.** Gris azulado a tiempo, ámbar desde el 75 %
 *   del límite (o `warn`), rojo pasado el límite, gris claro en la etapa final. Los que más llevan van
 *   primero (arriba a la izquierda). Un aviso propio del elemento (`flag`) es un anillo rojo.
 * - **Lo que importa, dicho.** La etapa con más elementos pasados del límite lleva «Se acumula aquí»
 *   y la frase de arriba lo cuenta con su entrada y salida de la última hora.
 * - **Mirar sin cambiar la hora de nadie.** La línea del día (la curva de la cola) mueve los puntos
 *   a cualquier hora; «Repetir el día» la recorre en ~20 s. Los datos nuevos no la interrumpen.
 * - **Se lee sin verlo.** Cada etapa es un botón con su resumen («En finca: 54 viajes, 31 pasan del
 *   límite de 2 h, mediana 2 h 25 min»); los puntos son una ayuda a la vista (su lista va en la app).
 * - **Barato.** La lógica corre sin DOM; un pintado mide una vez y escribe después; la curva se
 *   calcula con un barrido, no un flujo por muestra; el reloj se apaga fuera de la página.
 */
import { chartValue, ChartTip } from "../../core/chart";
import { Base, upgrade } from "../../core/define";
import { emit, h, reducedMotion, safeHref, setAttr } from "../../core/dom";
import { mergeLabels } from "../../core/labels";
import { resolveLocale } from "../../core/locale";
import {
  bottleneck,
  busiest,
  cleanStages,
  clockText,
  colsFor,
  dotScale,
  fill,
  fmtDuration,
  hourTicks,
  MINUTE,
  plural,
  prepareItems,
  queueCurve,
  snapshot,
  stageAt,
  stageStats,
  toMs,
  toneOf,
  type FlowPrepared,
  type FlowRow,
  type FlowSnapshot,
} from "./logic";
import type { FlowItem, FlowItemDetail, FlowLabels, FlowOpenDetail, FlowStage, FlowStageDetail, FlowTime } from "./types";

export const FLOW_LABELS: FlowLabels = {
  heading: "Flujo",
  live: "En vivo",
  viewing: "Viendo las {time}",
  backToNow: "Volver a ahora",
  replay: "Repetir el día",
  pause: "Pausar",
  now: "ahora",
  ago: "hace {d}",
  dayEnd: "fin del día",
  queue: "en cola",
  ended: "terminados",
  item: "elemento|elementos",
  of: "de {n}",
  delta: "{sign}{n} en 1 h",
  rate: "{n}/h",
  rateTitle: "{n} salieron de «{stage}» en la última hora",
  median: "mediana {d}",
  limit: "límite {d}",
  last: "el último a las {time}",
  none: "ninguno todavía",
  neckTag: "Se acumula aquí",
  neck: "Se acumula en {stage}: {count} {items}, {over} {carry} más de {limit}.",
  carry: "lleva|llevan",
  flow: "En la última hora entraron {in} y salieron {out}.",
  flowOut: "En la última hora salieron {out}.",
  allOk: "Todo va a tiempo: {count} {items} en cola, ninguno pasó su límite.",
  busiest: "{count} {items} en cola. La etapa más llena es {stage}, con {top}.",
  calm: "No hay nada en cola.",
  empty: "Sin etapas.",
  tipAge: "lleva {d} de {limit}",
  tipAgeFree: "lleva {d}",
  tipOver: "pasó el límite",
  tipEnded: "terminó a las {time}",
  cellNow: "lleva {d}",
  open: "Abrir",
  close: "Cerrar",
  legendOk: "A tiempo",
  legendNear: "Cerca del límite",
  legendOver: "Pasó el límite",
  legendEnded: "Terminado",
  legendFlag: "Con aviso",
  legendNote: "Cada punto es un {item}.",
  stageAria: "{stage}: {count} {items}",
  stageAriaOf: "{stage}: {shown} de {count} {items}",
  stageAriaOver: ", {over} {pass} del límite de {limit}",
  pass: "pasa|pasan",
  stageAriaMedian: ", mediana {d}",
  timeAria: "Hora del día",
  more: "+{n}",
  minutes: "{n} min",
  hours: "{h} h",
  hoursMinutes: "{h} h {m} min",
  days: "{d} d {h} h",
};

/** Cuánto dura «Repetir el día», recorra lo que recorra. */
const REPLAY_MS = 20_000;
/** Cada cuánto se repinta mientras se repite (los puntos se mueven con su transición entre pasos). */
const REPLAY_STEP_MS = 90;
/** Cada cuánto avanza el reloj en vivo (lo que llevan y los colores). */
const TICK_MS = 30_000;
/** El alto máximo de los puntos de una etapa en columnas; en filas (angosto), el tope de filas. */
const WELL_MAX = 132;
const WELL_ROWS_NARROW = 8;
/** Bajo este ancho, las etapas se apilan (lo mismo que el `@container` del CSS). */
const NARROW = 760;
/** Con más puntos que esto, se mueven sin transición (el navegador no anima miles a la vez). */
const ANIMATE_MAX = 1500;
const CURVE_SAMPLES = 240;

/** Escriben solo si cambió: un refresco con los mismos datos no toca el DOM. */
const setText = (el: Node, v: string) => {
  if (el.textContent !== v) el.textContent = v;
};
const setAttrIf = (el: Element, name: string, v: string) => {
  if (el.getAttribute(name) !== v) el.setAttribute(name, v);
};
const setHidden = (el: HTMLElement, v: boolean) => {
  if (el.hidden !== v) el.hidden = v;
};
const setVar = (el: HTMLElement, name: string, v: string) => {
  if (el.style.getPropertyValue(name) !== v) el.style.setProperty(name, v);
};

interface StationRefs {
  box: HTMLDivElement;
  hit: HTMLButtonElement;
  line: HTMLSpanElement | null;
  rate: HTMLSpanElement | null;
  label: HTMLSpanElement;
  num: HTMLElement;
  of: HTMLSpanElement;
  delta: HTMLSpanElement;
  meta: HTMLSpanElement;
  tag: HTMLSpanElement;
  well: HTMLSpanElement;
  more: HTMLSpanElement;
  cell: HTMLSpanElement;
}

interface DotState {
  el: HTMLElement;
  x: number;
  y: number;
  cls: string;
}

export class NxFlow extends Base {
  static observedAttributes = ["stages", "items", "labels", "highlight", "heading", "heading-level", "now", "start", "end", "stage", "selected", "locale", "time-zone"];

  #stagesIn: FlowStage[] = [];
  #itemsIn: FlowItem[] = [];
  #focusIn: string[] | null = null;
  #labels: FlowLabels = FLOW_LABELS;

  #stages: FlowStage[] = [];
  #items: FlowPrepared[] = [];
  #byId = new Map<string, FlowPrepared>();
  #focus: Set<string> | null = null;
  #dirtyItems = true;

  /** Diferencia entre el `now` del servidor y el reloj de este navegador. */
  #skew = 0;
  /** La hora que se está mirando; `null` = la de ahora (o el fin del día). */
  #at: number | null = null;
  #snap: FlowSnapshot | null = null;
  #curve: { from: number; to: number; key: string } | null = null;

  #root?: HTMLDivElement;
  #heading?: HTMLElement;
  #livePill?: HTMLSpanElement;
  #liveText?: HTMLSpanElement;
  #backBtn?: HTMLButtonElement;
  #insight?: HTMLParagraphElement;
  #queueNum?: HTMLElement;
  #queueLbl?: HTMLSpanElement;
  #endedBox?: HTMLDivElement;
  #endedNum?: HTMLElement;
  #endedLbl?: HTMLSpanElement;
  #stationsEl?: HTMLDivElement;
  #dotsEl?: HTMLDivElement;
  #stations: StationRefs[] = [];
  #stationsKey = "";
  #trip?: HTMLDivElement;
  #timeBar?: HTMLDivElement;
  #playBtn?: HTMLButtonElement;
  #range?: HTMLInputElement;
  #area?: SVGPathElement;
  #stroke?: SVGPathElement;
  #cursor?: HTMLSpanElement;
  #hours?: HTMLDivElement;
  #clock?: HTMLElement;
  #clockSub?: HTMLSpanElement;
  #legend?: HTMLDivElement;
  #empty?: HTMLParagraphElement;

  #dots = new Map<string, DotState>();
  #tip?: ChartTip;
  #abort?: AbortController;
  #ro?: ResizeObserver;
  #queued = false;
  #layoutFrame = 0;
  #instantFrame = 0;
  #timer: ReturnType<typeof setInterval> | null = null;
  #playFrame = 0;
  #playing = false;
  #painted = false;
  #roWidth = -1;
  /** «Repetir el día» iba cuando se desconectó (la app mueve el elemento): sigue al volver. */
  #resume = false;
  #tripKey = "";

  // ---------------------------------------------------------------- props

  /** Las etapas en orden: `{id, label, note?, limit?, warn?, end?}` (`limit` y `warn` en minutos). */
  get stages(): FlowStage[] {
    return this.#stagesIn;
  }
  set stages(v: FlowStage[] | null | undefined) {
    this.#stagesIn = Array.isArray(v) ? v : [];
    this.#stages = cleanStages(this.#stagesIn);
    this.#dirtyItems = true;
    this.#schedule();
  }
  /** Los elementos: `{id, label, sub?, meta?, flag?, href?, times: {[etapa]: hora}}`. */
  get items(): FlowItem[] {
    return this.#itemsIn;
  }
  set items(v: FlowItem[] | null | undefined) {
    this.#itemsIn = Array.isArray(v) ? v : [];
    this.#dirtyItems = true;
    this.#schedule();
  }
  /**
   * Los `id` que siguen a un filtro o una búsqueda de la app: los demás se atenúan y cada etapa dice
   * «12 de 54». `null`: todos. (No se llama `focus` para no tapar `HTMLElement.focus()`.)
   */
  get highlight(): string[] | null {
    return this.#focusIn;
  }
  set highlight(v: (string | number)[] | null | undefined) {
    this.#focusIn = Array.isArray(v) ? v.map(String) : null;
    this.#focus = this.#focusIn ? new Set(this.#focusIn) : null;
    this.#schedule();
  }
  /** Los textos de la interfaz (`FLOW_LABELS`). */
  get labels(): FlowLabels {
    return this.#labels;
  }
  set labels(v: Partial<FlowLabels> | null | undefined) {
    this.#labels = mergeLabels(FLOW_LABELS, v);
    this.#stationsKey = "";
    this.#schedule();
  }
  /** El título («Flujo del día»). Vacío: sin título. */
  get heading(): string | null {
    return this.getAttribute("heading");
  }
  set heading(v: string | null | undefined) {
    if (v == null) this.removeAttribute("heading");
    else this.setAttribute("heading", String(v));
  }
  /** El nivel del título (2 por defecto). */
  get headingLevel(): number {
    const n = Number(this.getAttribute("heading-level"));
    return Number.isInteger(n) && n >= 1 && n <= 6 ? n : 2;
  }
  set headingLevel(v: number | null | undefined) {
    setAttr(this, "heading-level", typeof v === "number" && Number.isFinite(v) ? String(v) : null);
  }
  /** La hora de ahora según el servidor (para no depender del reloj del equipo). Sigue corriendo sola. */
  get now(): string | null {
    return this.getAttribute("now");
  }
  set now(v: FlowTime | null | undefined) {
    setAttr(this, "now", v == null ? null : String(v));
  }
  /** El comienzo del eje (el día a las 00:00). Por defecto, la hora en punto antes del primer dato. */
  get start(): string | null {
    return this.getAttribute("start");
  }
  set start(v: FlowTime | null | undefined) {
    setAttr(this, "start", v == null ? null : String(v));
  }
  /** El fin del día. Si ya pasó, el flujo se queda en esa hora y no está «en vivo». */
  get end(): string | null {
    return this.getAttribute("end");
  }
  set end(v: FlowTime | null | undefined) {
    setAttr(this, "end", v == null ? null : String(v));
  }
  /** La etapa elegida (su `id`). */
  get stage(): string | null {
    return this.getAttribute("stage");
  }
  set stage(v: string | null | undefined) {
    setAttr(this, "stage", v);
  }
  /** El elemento elegido (su `id`): sus horas aparecen bajo cada etapa. */
  get selected(): string | null {
    return this.getAttribute("selected");
  }
  set selected(v: string | number | null | undefined) {
    setAttr(this, "selected", v == null ? null : String(v));
  }
  get locale(): string | null {
    return this.getAttribute("locale");
  }
  set locale(v: string | null | undefined) {
    setAttr(this, "locale", v);
  }
  /** La zona horaria de las horas (IANA, «America/Bogota»). Por defecto, la del equipo. */
  get timeZone(): string | null {
    return this.getAttribute("time-zone");
  }
  set timeZone(v: string | null | undefined) {
    setAttr(this, "time-zone", v);
  }

  /** La hora que se está mirando (ms), o `null` si es la de ahora. */
  get at(): number | null {
    return this.#at;
  }

  // ---------------------------------------------------------------- ciclo de vida

  connectedCallback(): void {
    upgrade(this);
    this.#build();
    if (this.#root!.parentNode !== this) this.append(this.#root!);
    this.#abort?.abort();
    const signal = (this.#abort = new AbortController()).signal;
    this.#tip ??= new ChartTip(this, (key) => this.#tipFor(key));
    this.#tip.attach(signal);
    this.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || this.selected === null) return;
      // Suelta el elemento y nada más: que no cierre también el diálogo que lo contiene.
      e.preventDefault();
      e.stopPropagation();
      this.#pickItem(null);
    }, { signal });
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        this.#syncTimer();
        // Al volver a la pestaña, lo que lleva cada uno cambió mientras no se veía.
        if (!document.hidden) this.#tick();
      }, { signal });
    }
    if (typeof ResizeObserver === "function") {
      // Solo el ancho importa: el alto lo pone el propio pintado (reaccionar a él sería un vaivén).
      this.#ro ??= new ResizeObserver((entries) => {
        const w = Math.round(entries[entries.length - 1]?.contentRect.width ?? 0);
        if (w === this.#roWidth) return;
        this.#roWidth = w;
        this.#layoutSoon();
      });
      this.#ro.observe(this.#stationsEl!);
    }
    this.#render();
    if (this.#resume) {
      this.#resume = false;
      this.#startPlay();
    }
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
    this.#ro?.disconnect();
    this.#roWidth = -1;
    this.#tip?.hide();
    this.#resume = this.#playing;
    this.#stopPlay();
    this.#clearTimer();
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.#layoutFrame);
      cancelAnimationFrame(this.#instantFrame);
    }
    this.#layoutFrame = this.#instantFrame = 0;
    // Sin el cuadro que la quitaba, la colocación instantánea quedaría pegada.
    this.#root?.classList.remove("is-instant");
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (old === value) return;
    if (name === "stages" || name === "items" || name === "labels" || name === "highlight") {
      if (value === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        console.warn(`[nx-flow] el atributo "${name}" no es JSON válido`);
        return;
      }
      (this as unknown as Record<string, unknown>)[name] = parsed;
      return;
    }
    if (name === "now" || name === "time-zone") {
      const now = toMs(this.now, this.timeZone ?? undefined);
      this.#skew = Number.isNaN(now) ? 0 : now - Date.now();
    }
    if (name === "time-zone") this.#dirtyItems = true;
    if (name === "start" || name === "end" || name === "now") this.#curve = null;
    if (name === "labels" || name === "heading-level" || name === "locale" || name === "time-zone") this.#stationsKey = "";
    this.#schedule();
  }

  // ---------------------------------------------------------------- reloj y eje

  /** Ahora, con el reloj del servidor si llegó `now`. */
  #clockNow(): number {
    return Date.now() + this.#skew;
  }
  #endMs(): number | null {
    const v = toMs(this.end, this.timeZone ?? undefined);
    return Number.isNaN(v) ? null : v;
  }
  /** El día sigue: no hay `end` o todavía no llega. */
  #liveDay(): boolean {
    const end = this.#endMs();
    return end === null || this.#clockNow() < end;
  }
  /** El eje de la línea del día: del comienzo a ahora (o al fin del día, si ya pasó). */
  #axis(): { from: number; to: number } | null {
    const now = this.#clockNow();
    const end = this.#endMs();
    const to = end === null ? now : Math.min(end, now);
    let from = toMs(this.start, this.timeZone ?? undefined);
    if (Number.isNaN(from)) {
      let first = Infinity;
      for (const p of this.#items) if (p.first < first) first = p.first;
      if (!Number.isFinite(first)) return null;
      from = Math.floor(first / (60 * MINUTE)) * 60 * MINUTE;
    }
    return to - from >= MINUTE ? { from, to } : null;
  }
  /** La hora que se pinta. */
  #viewAt(axis = this.#axis()): number {
    const live = axis ? axis.to : this.#clockNow();
    if (this.#at === null) return live;
    return axis ? Math.min(axis.to, Math.max(axis.from, this.#at)) : this.#at;
  }

  #syncTimer(): void {
    const want = this.isConnected && this.#liveDay() && !(typeof document !== "undefined" && document.hidden);
    if (want && !this.#timer) this.#timer = setInterval(() => this.#tick(), TICK_MS);
    else if (!want) this.#clearTimer();
  }
  #clearTimer(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
  }
  #tick(): void {
    if (!this.isConnected) return this.#clearTimer();
    this.#curve = null;
    this.#schedule();
  }

  // ---------------------------------------------------------------- pintado

  #schedule(): void {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      if (!this.#queued) return;
      this.#queued = false;
      if (this.isConnected && this.#root) this.#render();
    });
  }

  #layoutSoon(): void {
    if (this.#layoutFrame || typeof requestAnimationFrame !== "function") return;
    this.#layoutFrame = requestAnimationFrame(() => {
      this.#layoutFrame = 0;
      if (!this.isConnected || !this.#snap) return;
      this.#instant();
      this.#layoutDots();
    });
  }

  /** Los puntos van a su sitio sin viajar (al cargar, al cambiar el ancho). */
  #instant(): void {
    const root = this.#root;
    if (!root) return;
    root.classList.add("is-instant");
    if (typeof requestAnimationFrame !== "function") return;
    cancelAnimationFrame(this.#instantFrame);
    // Dos cuadros: el primero pinta las posiciones nuevas sin transición; el segundo la devuelve.
    this.#instantFrame = requestAnimationFrame(() => {
      this.#instantFrame = requestAnimationFrame(() => {
        this.#instantFrame = 0;
        root.classList.remove("is-instant");
      });
    });
  }

  #build(): void {
    if (this.#root) return;
    const L = this.#labels;
    this.#heading = h("h2", { class: "nx-flow__heading" });
    this.#liveText = h("span", null);
    this.#backBtn = h("button", { type: "button", class: "nx-flow__back", hidden: true });
    this.#backBtn.addEventListener("click", () => this.#goLive());
    this.#livePill = h("span", { class: "nx-flow__live" }, h("i", { "aria-hidden": "true" }), this.#liveText, this.#backBtn);
    this.#insight = h("p", { class: "nx-flow__insight" });
    this.#queueNum = h("b", null, "0");
    this.#queueLbl = h("span", null, L.queue);
    this.#endedNum = h("b", null, "0");
    this.#endedLbl = h("span", null, L.ended);
    this.#endedBox = h("div", { class: "nx-flow__total" }, this.#endedNum, this.#endedLbl);
    const top = h(
      "div",
      { class: "nx-flow__top" },
      h("div", { class: "nx-flow__say" }, h("div", { class: "nx-flow__head" }, this.#heading, this.#livePill), this.#insight),
      h("div", { class: "nx-flow__totals" }, h("div", { class: "nx-flow__total" }, this.#queueNum, this.#queueLbl), this.#endedBox),
    );
    this.#dotsEl = h("div", { class: "nx-flow__dots", "aria-hidden": "true" });
    this.#dotsEl.addEventListener("click", (e) => {
      const dot = e.target instanceof Element ? e.target.closest<HTMLElement>(".nx-flow__dot") : null;
      const id = dot?.getAttribute("data-nx-tip");
      if (id) this.#pickItem(this.selected === id ? null : id);
    });
    this.#stationsEl = h("div", { class: "nx-flow__stations", role: "group" }, this.#dotsEl);
    this.#trip = h("div", { class: "nx-flow__trip", hidden: true });
    // Un solo oyente para «Abrir» y «Cerrar», aunque la franja se rehaga.
    this.#trip.addEventListener("click", (e) => {
      const act = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-act]")?.dataset.act : undefined;
      const id = this.selected;
      if (!act || id === null) return;
      if (act === "close") return this.#pickItem(null);
      const p = this.#byId.get(id);
      if (act === "open" && p) emit(this, "nx-flow-open", { id: p.id, item: p.item } satisfies FlowOpenDetail);
    });

    this.#playBtn = h("button", { type: "button", class: "nx-flow__play" });
    this.#playBtn.addEventListener("click", () => (this.#playing ? this.#pausePlay() : this.#startPlay()));
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 1000 40");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "nx-flow__curve");
    this.#area = document.createElementNS(NS, "path");
    this.#area.setAttribute("class", "nx-flow__area");
    this.#stroke = document.createElementNS(NS, "path");
    this.#stroke.setAttribute("class", "nx-flow__stroke");
    svg.append(this.#area, this.#stroke);
    this.#cursor = h("span", { class: "nx-flow__cursor", "aria-hidden": "true" });
    this.#range = h("input", { type: "range", class: "nx-flow__range", min: "0", max: "1", step: "1", value: "1" });
    this.#range.addEventListener("input", () => this.#scrub());
    this.#hours = h("div", { class: "nx-flow__hours", "aria-hidden": "true" });
    this.#clock = h("b", null);
    this.#clockSub = h("span", null);
    this.#timeBar = h(
      "div",
      { class: "nx-flow__time" },
      this.#playBtn,
      h("div", { class: "nx-flow__scrub" }, svg, this.#cursor, this.#range, this.#hours),
      h("div", { class: "nx-flow__clock", "aria-hidden": "true" }, this.#clock, this.#clockSub),
    );
    this.#legend = h("div", { class: "nx-flow__legend" });
    this.#empty = h("p", { class: "nx-flow__empty", hidden: true });
    this.#root = h("div", { class: "nx-flow__root is-instant" }, top, this.#stationsEl, this.#trip, this.#timeBar, this.#legend, this.#empty);
  }

  /** Las etapas como nodos fijos: se rehacen solo si cambian las etapas o los textos. */
  #buildStations(locale: string): void {
    const L = this.#labels;
    const key = JSON.stringify([this.#stages, locale, L.item]);
    if (key === this.#stationsKey) return;
    this.#stationsKey = key;
    for (const s of this.#stations) s.box.remove();
    const n = this.#stages.length;
    this.#stations = this.#stages.map((stage, i) => {
      const hit = h("button", { type: "button", class: "nx-flow__hit", "aria-pressed": "false" });
      hit.addEventListener("click", () => this.#pickStage(this.stage === stage.id ? null : stage.id));
      const rate = i + 1 < n ? h("span", { class: "nx-flow__rate" }) : null;
      // Las rayas que corren son su propio nodo: se mueven con `transform` (sin repintar todo el día).
      const line = rate ? h("span", { class: "nx-flow__line" }, h("i", { class: "nx-flow__dash" }), rate) : null;
      const node = h("span", { class: "nx-flow__node" }, chartValue(i + 1, { locale }));
      const label = h("span", { class: "nx-flow__label" }, stage.label);
      const num = h("b", null, "0");
      const of = h("span", { class: "nx-flow__of" });
      const delta = h("span", { class: "nx-flow__delta" });
      const tag = h("span", { class: "nx-flow__tag", hidden: true }, L.neckTag);
      const meta = h("span", { class: "nx-flow__meta" });
      const more = h("span", { class: "nx-flow__more", hidden: true });
      const well = h("span", { class: "nx-flow__well" }, more);
      const cell = h("span", { class: "nx-flow__cell", hidden: true });
      const box = h(
        "div",
        { class: `nx-flow__st${stage.end ? " is-end" : ""}`, "data-stage": stage.id },
        hit,
        h("span", { class: "nx-flow__rail", "aria-hidden": "true" }, node, line),
        h("span", { class: "nx-flow__label-box", "aria-hidden": "true" }, label),
        h("span", { class: "nx-flow__num", "aria-hidden": "true" }, num, of, delta),
        h("span", { class: "nx-flow__meta-box", "aria-hidden": "true" }, meta, tag),
        well,
        cell,
      );
      well.setAttribute("aria-hidden", "true");
      this.#stationsEl!.insertBefore(box, this.#dotsEl!);
      return { box, hit, line, rate, label, num, of, delta, meta, tag, well, more, cell };
    });
    this.#stationsEl!.style.setProperty("--nx-flow-n", String(Math.max(1, n)));
  }

  #render(): void {
    this.#queued = false;
    const root = this.#root;
    if (!root) return;
    const L = this.#labels;
    const locale = resolveLocale(this);
    const tz = this.timeZone ?? undefined;
    if (this.#dirtyItems) {
      this.#items = prepareItems(this.#itemsIn, this.#stages, tz);
      this.#byId = new Map(this.#items.map((p) => [p.id, p]));
      this.#dirtyItems = false;
      this.#curve = null;
    }

    const hasStages = this.#stages.length > 0;
    setHidden(this.#empty!, hasStages);
    setText(this.#empty!, L.empty);
    root.classList.toggle("is-empty", !hasStages);
    this.#buildStations(locale);

    // Título.
    const heading = this.heading;
    const tag = `H${this.headingLevel}`;
    if (this.#heading!.tagName !== tag) {
      const next = h(`h${this.headingLevel}` as "h2", { class: "nx-flow__heading" });
      this.#heading!.replaceWith(next);
      this.#heading = next;
    }
    setText(this.#heading!, heading ?? L.heading);
    setHidden(this.#heading!, heading === "");
    setAttrIf(this.#stationsEl!, "aria-label", heading || L.heading);

    const axis = this.#axis();
    const at = this.#viewAt(axis);
    const snap = (this.#snap = snapshot(this.#items, this.#stages, at));
    const items = (n: number) => plural(L.item, n);
    const dur = (m: number) => fmtDuration(m, L);
    const num = (n: number) => chartValue(n, { locale });

    // Etapas.
    const neck = bottleneck(snap, this.#stages);
    const focus = this.#focus;
    this.#stages.forEach((stage, i) => {
      const s = this.#stations[i];
      const g = snap.groups[i];
      const st = stageStats(g);
      const shown = focus ? g.reduce((a, r) => a + (focus.has(r.p.id) ? 1 : 0), 0) : st.count;
      setText(s.num, num(shown));
      s.num.classList.toggle("is-zero", shown === 0);
      setText(s.of, focus ? fill(L.of, { n: num(st.count) }) : "");
      const d = st.count - snap.before[i];
      setText(s.delta, focus || d === 0 ? "" : fill(L.delta, { sign: d > 0 ? "+" : "−", n: num(Math.abs(d)) }));
      let meta: string;
      if (stage.end) {
        const last = g.length ? Math.max(...g.map((r) => r.enter)) : NaN;
        meta = g.length ? fill(L.last, { time: clockText(last, locale, tz, at) }) : L.none;
      } else if (st.count && st.median !== null) meta = fill(L.median, { d: dur(st.median) });
      else meta = stage.note ?? (stage.limit ? fill(L.limit, { d: dur(stage.limit) }) : "");
      setText(s.meta, meta);
      setHidden(s.tag, i !== neck);
      s.box.classList.toggle("is-neck", i === neck);
      const on = this.stage === stage.id;
      s.box.classList.toggle("is-on", on);
      setAttrIf(s.hit, "aria-pressed", String(on));
      let aria = focus
        ? fill(L.stageAriaOf, { stage: stage.label, shown: num(shown), count: num(st.count), items: items(st.count) })
        : fill(L.stageAria, { stage: stage.label, count: num(st.count), items: items(st.count) });
      if (!stage.end && st.over && stage.limit) aria += fill(L.stageAriaOver, { over: num(st.over), pass: plural(L.pass, st.over), limit: dur(stage.limit) });
      if (!stage.end && st.count && st.median !== null) aria += fill(L.stageAriaMedian, { d: dur(st.median) });
      setAttrIf(s.hit, "aria-label", aria);
      if (s.line && s.rate) {
        const r = snap.rate[i];
        setText(s.rate, fill(L.rate, { n: num(r) }));
        setAttrIf(s.line, "title", fill(L.rateTitle, { n: num(r), stage: stage.label }));
        s.line.classList.toggle("is-flowing", r > 0);
        setVar(s.line, "--nx-flow-speed", `${Math.max(0.5, 4 - r * 0.35).toFixed(2)}s`);
      }
    });

    // La frase y los totales.
    setText(this.#insight!, this.#sentence(snap, neck, locale));
    setText(this.#queueNum!, num(snap.queue));
    setText(this.#queueLbl!, L.queue);
    setHidden(this.#endedBox!, !this.#stages.some((s) => s.end));
    setText(this.#endedNum!, num(snap.ended));
    setText(this.#endedLbl!, L.ended);

    this.#paintTime(axis, at, locale, tz);
    this.#paintLegend();
    this.#paintTrip(snap, at, locale, tz);
    this.#layoutDots();
    if (!this.#painted) {
      this.#painted = true;
      this.#instant();
    }
    this.#syncTimer();
  }

  #sentence(snap: FlowSnapshot, neck: number, locale: string): string {
    const L = this.#labels;
    const num = (n: number) => chartValue(n, { locale });
    const items = (n: number) => plural(L.item, n);
    if (!this.#stages.length) return "";
    if (neck >= 0) {
      const g = snap.groups[neck];
      const over = g.reduce((a, r) => a + (r.tone === "over" ? 1 : 0), 0);
      const head = fill(L.neck, { stage: this.#stages[neck].label, count: num(g.length), items: items(g.length), over: num(over), carry: plural(L.carry, over), limit: fmtDuration(this.#stages[neck].limit ?? 0, L) });
      const out = num(snap.rate[neck]);
      const tail = neck > 0 ? fill(L.flow, { in: num(snap.entered[neck]), out }) : fill(L.flowOut, { out });
      return `${head} ${tail}`;
    }
    if (!snap.queue) return L.calm;
    if (this.#stages.some((s) => !s.end && s.limit)) return fill(L.allOk, { count: num(snap.queue), items: items(snap.queue) });
    const top = busiest(snap, this.#stages);
    return fill(L.busiest, { count: num(snap.queue), items: items(snap.queue), stage: this.#stages[top]?.label ?? "", top: num(snap.groups[top]?.length ?? 0) });
  }

  #paintTime(axis: { from: number; to: number } | null, at: number, locale: string, tz: string | undefined): void {
    const L = this.#labels;
    const liveDay = this.#liveDay();
    const live = this.#at === null && liveDay;
    const viewing = this.#at !== null;
    const pill = this.#livePill!;
    setHidden(pill, !live && !viewing);
    pill.classList.toggle("is-past", viewing);
    setText(this.#liveText!, viewing ? fill(L.viewing, { time: clockText(at, locale, tz) }) : L.live);
    setHidden(this.#backBtn!, !viewing);
    setText(this.#backBtn!, L.backToNow);

    const bar = this.#timeBar!;
    setHidden(bar, !axis);
    if (!axis) return;
    const span = axis.to - axis.from;
    const minutes = Math.max(1, Math.round(span / MINUTE));
    const value = Math.round((at - axis.from) / MINUTE);
    const range = this.#range!;
    if (range.max !== String(minutes)) range.max = String(minutes);
    const next = String(Math.min(minutes, Math.max(0, value)));
    if ((document.activeElement !== range || !viewing) && range.value !== next) range.value = next;
    setAttrIf(range, "aria-label", L.timeAria);
    setAttrIf(range, "aria-valuetext", clockText(at, locale, tz));
    const left = `${(Math.min(1, Math.max(0, (at - axis.from) / span)) * 100).toFixed(3)}%`;
    if (this.#cursor!.style.insetInlineStart !== left) this.#cursor!.style.insetInlineStart = left;
    setText(this.#clock!, clockText(at, locale, tz));
    setText(this.#clockSub!, viewing ? fill(L.ago, { d: fmtDuration((axis.to - at) / MINUTE, L) }) : liveDay ? L.now : L.dayEnd);
    // El texto dice qué hace el botón («Pausar» / «Repetir el día»); sin `aria-pressed`, que diría lo mismo dos veces.
    setText(this.#playBtn!, this.#playing ? L.pause : L.replay);
    this.#playBtn!.classList.toggle("is-playing", this.#playing);

    // La curva, por minuto: en vivo `to` crece en cada pintado, y rehacerla 11 veces por segundo
    // mientras se repite no cambia nada que se vea.
    const key = `${axis.from}|${Math.floor(axis.to / MINUTE)}|${tz}|${locale}|${this.#items.length}`;
    if (this.#curve?.key === key) return;
    this.#curve = { ...axis, key };
    const pts = queueCurve(this.#items, axis.from, axis.to, CURVE_SAMPLES);
    const max = Math.max(1, ...pts);
    const step = 1000 / Math.max(1, pts.length - 1);
    let d = "";
    pts.forEach((q, k) => {
      d += `${k ? "L" : "M"}${(k * step).toFixed(1)},${(38 - (q / max) * 34).toFixed(1)}`;
    });
    this.#stroke!.setAttribute("d", d);
    this.#area!.setAttribute("d", d ? `${d}L1000,40L0,40Z` : "");
    this.#hours!.replaceChildren(
      ...hourTicks(axis.from, axis.to, tz).map((t) => {
        const el = h("span", null, clockText(t, locale, tz));
        el.style.insetInlineStart = `${(((t - axis.from) / span) * 100).toFixed(3)}%`;
        return el;
      }),
    );
  }

  #paintLegend(): void {
    const L = this.#labels;
    const limits = this.#stages.some((s) => !s.end && s.limit);
    const flags = this.#items.some((p) => p.flag !== null);
    const key = `${limits}|${flags}|${this.#stages.some((s) => s.end)}|${JSON.stringify(L)}`;
    if (this.#legend!.dataset.key === key) return;
    this.#legend!.dataset.key = key;
    const sw = (cls: string, text: string) => h("span", null, h("i", { class: `nx-flow__sw ${cls}`, "aria-hidden": "true" }), text);
    const parts: (Node | null)[] = [
      sw("is-ok", L.legendOk),
      limits ? sw("is-near", L.legendNear) : null,
      limits ? sw("is-over", L.legendOver) : null,
      this.#stages.some((s) => s.end) ? sw("is-done", L.legendEnded) : null,
      flags ? sw("is-flag", L.legendFlag) : null,
      h("span", { class: "nx-flow__note" }, fill(L.legendNote, { item: plural(L.item, 1) })),
    ];
    this.#legend!.replaceChildren(...parts.filter((n): n is Node => n !== null));
  }

  /** El elemento elegido: una franja con quién es y sus horas bajo cada etapa. */
  #paintTrip(snap: FlowSnapshot, at: number, locale: string, tz: string | undefined): void {
    const L = this.#labels;
    const id = this.selected;
    const row = id === null ? undefined : snap.where.get(id);
    const trip = this.#trip!;
    if (!row) {
      if (this.#tripKey) {
        this.#tripKey = "";
        trip.hidden = true;
        trip.replaceChildren();
        for (const s of this.#stations) {
          s.cell.hidden = true;
          s.cell.replaceChildren();
          delete s.cell.dataset.key;
        }
      }
      return;
    }
    // La franja se arma solo cuando cambia lo que dice: rehacerla en cada pintado (11 por segundo
    // al repetir) perdía clics a medias y hacía que el lector volviera a anunciar el botón.
    const it = row.p.item;
    const href = safeHref(it.href) ?? "";
    const key = JSON.stringify([row.p.id, it.label, it.sub, it.meta, row.p.flag, href, this.#stages[row.s].label, L.open, L.close]);
    if (key !== this.#tripKey) {
      this.#tripKey = key;
      const restore = trip.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.act : undefined;
      const open = href
        ? h("a", { class: "nx-flow__open", href }, L.open)
        : h("button", { type: "button", class: "nx-flow__open", "data-act": "open" }, L.open);
      const close = h("button", { type: "button", class: "nx-flow__close", "data-act": "close" }, L.close);
      const parts: (Node | null)[] = [
        h("b", { class: "nx-flow__trip-label" }, it.label),
        it.sub ? h("span", null, it.sub) : null,
        it.meta ? h("span", { class: "nx-flow__trip-meta" }, it.meta) : null,
        row.p.flag ? h("span", { class: "nx-flow__trip-flag" }, row.p.flag) : null,
        h("span", { class: "nx-flow__trip-stage" }, this.#stages[row.s].label),
        h("span", { class: "nx-flow__trip-actions" }, open, close),
      ];
      trip.replaceChildren(...parts.filter((n): n is Node => n !== null));
      if (restore) trip.querySelector<HTMLElement>(`[data-act="${restore}"]`)?.focus();
    }
    setHidden(trip, false);

    const t = row.p.t;
    this.#stages.forEach((stage, i) => {
      const cell = this.#stations[i].cell;
      setHidden(cell, false);
      cell.classList.toggle("is-now", i === row.s && !stage.end);
      // Lo mismo con cada celda: se rehace solo si cambia lo que dice.
      const ck = `${t.join(",")}|${row.s}|${i === row.s ? row.age : ""}|${t[i] > at}|${L.cellNow}|${tz}|${locale}`;
      if (cell.dataset.key === ck) return;
      cell.dataset.key = ck;
      if (Number.isNaN(t[i]) || t[i] > at || i > row.s) {
        cell.replaceChildren("—");
        return;
      }
      const time = h("b", null, clockText(t[i], locale, tz, at));
      if (stage.end) {
        cell.replaceChildren(time);
        return;
      }
      let next = NaN;
      for (let j = i + 1; j < t.length; j++) {
        if (t[j] <= at && t[j] >= t[i]) {
          next = t[j];
          break;
        }
      }
      const spent = i === row.s ? row.age : Number.isNaN(next) ? NaN : Math.floor((next - t[i]) / MINUTE);
      if (Number.isNaN(spent)) {
        cell.replaceChildren(time);
        return;
      }
      const tone = toneOf(stage, spent);
      const d = h("span", { class: `nx-flow__spent is-${tone}` }, fmtDuration(spent, L));
      if (i !== row.s) {
        cell.replaceChildren(time, d);
        return;
      }
      const [pre, post = ""] = L.cellNow.split("{d}");
      cell.replaceChildren(time, pre, d, post);
    });
  }

  /** Mide las etapas una vez y mueve cada punto a su sitio; solo escribe lo que cambió. */
  #layoutDots(): void {
    const snap = this.#snap;
    const box = this.#stationsEl;
    if (!snap || !box || !this.#stations.length) {
      for (const d of this.#dots.values()) d.el.remove();
      this.#dots.clear();
      return;
    }
    const narrow = box.clientWidth > 0 && box.clientWidth <= NARROW;
    this.#root!.classList.toggle("is-narrow", narrow);
    const width = this.#stations[0].well.clientWidth || 120;
    let maxActive = 1;
    this.#stages.forEach((s, i) => {
      if (!s.end) maxActive = Math.max(maxActive, snap.groups[i].length);
    });
    const scale = narrow ? dotScale(maxActive, width, WELL_ROWS_NARROW * 13) : dotScale(maxActive, width, WELL_MAX);
    const { pitch, size } = scale;
    const rowsFor = (n: number, w: number) => Math.max(1, Math.ceil(n / colsFor(w, pitch, size)));
    const capRows = narrow ? Math.max(1, Math.floor((WELL_ROWS_NARROW * 13 - size) / pitch) + 1) : scale.rows;
    // Leer los anchos antes de escribir un solo alto (en angosto cada etapa tiene el suyo).
    const widths = narrow ? this.#stations.map((s) => s.well.clientWidth || width) : null;
    // Escribir: el alto de cada etapa.
    const sharedRows = Math.max(2, Math.min(capRows, Math.max(...snap.groups.map((g, i) => (this.#stages[i].end ? 0 : rowsFor(g.length, width))))));
    this.#stations.forEach((s, i) => {
      const rows = widths ? Math.min(capRows, rowsFor(snap.groups[i].length, widths[i])) : sharedRows;
      const height = `${(rows - 1) * pitch + size}px`;
      if (s.well.style.height !== height) s.well.style.height = height;
      s.box.classList.toggle("is-vacant", snap.groups[i].length === 0);
    });
    setVar(this.#dotsEl!, "--nx-flow-dot", `${size}px`);
    // Leer: dónde quedó cada etapa (una sola vez).
    const origin = box.getBoundingClientRect();
    const wells = this.#stations.map((s, i) => {
      const r = s.well.getBoundingClientRect();
      const cols = colsFor(r.width || width, pitch, size);
      const rows = narrow ? Math.min(capRows, rowsFor(snap.groups[i].length, r.width || width)) : sharedRows;
      return { x: r.left - origin.left, y: r.top - origin.top, cols, cap: cols * rows };
    });
    // Escribir: cada punto.
    const focus = this.#focus;
    const ring = !!focus && focus.size <= 12;
    const selected = this.selected;
    const seen = new Set<string>();
    snap.groups.forEach((group, i) => {
      const w = wells[i];
      const more = this.#stations[i].more;
      const extra = group.length - w.cap;
      setHidden(more, extra <= 0);
      if (extra > 0) setText(more, fill(this.#labels.more, { n: chartValue(extra, { locale: resolveLocale(this) }) }));
      // Con un filtro de la app, los que lo siguen van primero: si la etapa no cabe, lo que se
      // esconde en «+N» son los atenuados, no los que se están buscando.
      const g = focus && extra > 0 ? [...group.filter((r) => focus.has(r.p.id)), ...group.filter((r) => !focus.has(r.p.id))] : group;
      g.forEach((r, k) => {
        seen.add(r.p.id);
        const hiddenDot = k >= w.cap;
        const kk = hiddenDot ? w.cap - 1 : k;
        const x = Math.round(w.x + (kk % w.cols) * pitch);
        const y = Math.round(w.y + Math.floor(kk / w.cols) * pitch);
        let cls = `nx-flow__dot is-${r.tone}`;
        if (r.p.flag !== null) cls += " is-flag";
        if (focus && !focus.has(r.p.id)) cls += " is-dim";
        else if (ring) cls += " is-focus";
        if (selected === r.p.id) cls += " is-sel";
        if (hiddenDot) cls += " is-over-cap";
        this.#place(r.p.id, x, y, cls);
      });
    });
    // Los que todavía no empiezan: esperan invisibles a la izquierda de la primera etapa.
    const first = wells[0];
    for (const p of this.#items) {
      if (seen.has(p.id)) continue;
      this.#place(p.id, Math.round(first.x - 24), Math.round(first.y), "nx-flow__dot is-ghost");
    }
    for (const [id, d] of this.#dots) {
      if (!this.#byId.has(id)) {
        d.el.remove();
        this.#dots.delete(id);
      }
    }
    this.#root!.classList.toggle("is-crowded", this.#dots.size > ANIMATE_MAX || reducedMotion());
  }

  #place(id: string, x: number, y: number, cls: string): void {
    let d = this.#dots.get(id);
    if (!d) {
      const el = h("i", { class: cls, "data-nx-tip": id });
      el.style.transform = `translate(${x}px,${y}px)`;
      this.#dotsEl!.append(el);
      this.#dots.set(id, { el, x, y, cls });
      return;
    }
    if (d.x !== x || d.y !== y) {
      d.el.style.transform = `translate(${x}px,${y}px)`;
      d.x = x;
      d.y = y;
    }
    if (d.cls !== cls) {
      d.el.className = cls;
      d.cls = cls;
    }
  }

  #tipFor(id: string): Node[] | null {
    const row = this.#snap?.where.get(id);
    if (!row) return null;
    const L = this.#labels;
    const locale = resolveLocale(this);
    const tz = this.timeZone ?? undefined;
    const stage = this.#stages[row.s];
    const it = row.p.item;
    const out: Node[] = [h("p", { class: "nx-chart-tip__title nx-flow__tip-label" }, it.label)];
    const sub = [it.sub, it.meta].filter(Boolean).join(" · ");
    if (sub) out.push(h("p", { class: "nx-flow__tip-sub" }, sub));
    let age: string;
    if (stage.end) age = fill(L.tipEnded, { time: clockText(row.enter, locale, tz, this.#snap!.at) });
    else if (stage.limit) age = fill(L.tipAge, { d: fmtDuration(row.age, L), limit: fmtDuration(stage.limit, L) }) + (row.tone === "over" ? ` · ${L.tipOver}` : "");
    else age = fill(L.tipAgeFree, { d: fmtDuration(row.age, L) });
    out.push(h("p", { class: "nx-flow__tip-stage" }, h("b", null, stage.label), h("span", null, age)));
    if (row.p.flag) out.push(h("p", { class: "nx-flow__tip-flag" }, row.p.flag));
    return out;
  }

  // ---------------------------------------------------------------- acciones

  #pickStage(id: string | null): void {
    this.stage = id;
    emit(this, "nx-flow-stage", { stage: id } satisfies FlowStageDetail);
  }

  #pickItem(id: string | null): void {
    this.selected = id;
    const item = id === null ? null : (this.#byId.get(id)?.item ?? null);
    emit(this, "nx-flow-item", { id, item } satisfies FlowItemDetail);
  }

  #scrub(): void {
    const axis = this.#axis();
    if (!axis) return;
    this.#stopPlay();
    const v = Number(this.#range!.value);
    const max = Number(this.#range!.max);
    this.#at = v >= max ? null : axis.from + v * MINUTE;
    this.#root!.classList.add("is-scrubbing");
    this.#render();
  }

  #goLive(): void {
    this.#stopPlay();
    this.#at = null;
    this.#root?.classList.remove("is-scrubbing");
    this.#render();
  }

  #startPlay(): void {
    const axis = this.#axis();
    if (!axis || typeof requestAnimationFrame !== "function") return;
    const at = this.#viewAt(axis);
    this.#at = at >= axis.to - MINUTE ? axis.from : at;
    this.#playing = true;
    this.#root!.classList.remove("is-scrubbing");
    this.#root!.classList.add("is-playing");
    const speed = (axis.to - axis.from) / REPLAY_MS;
    let last = performance.now();
    let painted = 0;
    const step = (now: number) => {
      if (!this.#playing || !this.isConnected) return;
      const ax = this.#axis();
      if (!ax) return this.#stopPlay();
      this.#at = Math.min(ax.to, (this.#at ?? ax.from) + (now - last) * speed);
      last = now;
      if (this.#at >= ax.to) {
        this.#at = null;
        this.#stopPlay();
        this.#render();
        return;
      }
      if (now - painted >= REPLAY_STEP_MS) {
        painted = now;
        this.#render();
      }
      this.#playFrame = requestAnimationFrame(step);
    };
    this.#render();
    this.#playFrame = requestAnimationFrame(step);
  }

  #pausePlay(): void {
    this.#stopPlay();
    this.#render();
  }

  #stopPlay(): void {
    this.#playing = false;
    if (this.#playFrame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.#playFrame);
    this.#playFrame = 0;
    this.#root?.classList.remove("is-playing");
  }

  /** Vuelve a la hora de ahora (o al fin del día). */
  live(): void {
    this.#goLive();
  }
}

/** La etapa de un elemento a la hora `at` (para quien arma la lista de al lado con el mismo criterio). */
export function flowStageOf(item: FlowItem, stages: FlowStage[], at: number = Date.now()): string | null {
  const clean = cleanStages(stages);
  const [p] = prepareItems([item], clean);
  if (!p) return null;
  const s = stageAt(p, at);
  return s < 0 ? null : clean[s].id;
}


