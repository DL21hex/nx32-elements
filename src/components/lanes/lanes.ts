/**
 * `<nx-lanes>`: lo abierto de varios procesos, un punto por elemento. Cada proceso es un carril con
 * sus bandejas en el orden del trámite, sobre un riel; cada elemento abierto es un punto parado en
 * su bandeja. El color es cuánto lleva sin moverse (los tramos de `bands`); un punto hueco espera a
 * otro (el jefe, la EPS), uno lleno espera al dueño del tablero. Pensado para un monitor en la pared.
 *
 * Reglas de diseño:
 * - **Un elemento, un punto, siempre el mismo nodo.** Con datos nuevos, el que cambió de bandeja
 *   viaja hasta la nueva (`transform`), el que llega crece en su sitio y el que se va corre hasta la
 *   punta del riel y se apaga. Los demás no se tocan. `nx-lanes-change` cuenta lo que pasó, para un
 *   registro; la primera carga con carriles y elementos no (ni cambiar los carriles).
 * - **Lo propio y lo de otros, separados.** El número del carril y lo atrasado cuentan solo lo propio;
 *   lo que espera a otro va aparte, con su círculo hueco. Lo propio en el último tramo late.
 * - **Un carril en foco.** `spotlight` lo resalta sin apagar los demás (en la pared se leen todos);
 *   `cycle` lo rota por los que tienen atrasados, y `nx-lanes-spotlight` da sus cifras para la tarjeta
 *   de al lado.
 * - **Llena lo que le den.** Con alto fijo (la pared), los carriles se reparten el alto y los puntos
 *   se ajustan para que siempre quepan dos filas; sin alto, cada carril mide lo mínimo.
 * - **Se lee sin verlo.** Cada bandeja es un botón (o un enlace) con su resumen; los puntos son una
 *   ayuda a la vista (`aria-hidden`).
 * - **Barato.** La lógica corre sin DOM; un pintado mide los carriles una vez y escribe después; solo
 *   se escriben los puntos que cambiaron; el reloj del foco se apaga con la pestaña oculta.
 */
import { chartValue, ChartTip } from "../../core/chart";
import { Base, upgrade } from "../../core/define";
import { emit, h, reducedMotion, safeHref, setAttr } from "../../core/dom";
import { mergeLabels } from "../../core/labels";
import { resolveLocale } from "../../core/locale";
import {
  bandLabels,
  cleanBands,
  cleanLanes,
  DEFAULT_BANDS,
  delayOf,
  diffPlaces,
  dotSize,
  fill,
  jamOf,
  placesOf,
  plural,
  prepare,
  rankLanes,
  slotOf,
  stackOf,
  summarize,
  toneNames,
  type LaneSummary,
  type LanesPrepared,
  type Places,
} from "./logic";
import type { Lane, LaneItem, LanesChangeDetail, LanesItemDetail, LanesLabels, LanesSpotlightDetail, LanesStageDetail } from "./types";

export const LANES_LABELS: LanesLabels = {
  heading: "Carriles",
  item: "elemento|elementos",
  unit: "día|días",
  age: "{n} d",
  oldest: "el más viejo {age}",
  calm: "al día",
  others: "{n} esperan a otro",
  bandFirst: "{from} a {to} {unit}",
  band: "{from} a {to}",
  bandLast: "Más de {n}",
  other: "Espera a otro",
  more: "+{n}",
  laneAria: "{lane}: {count} {items}",
  stageAria: "{stage}: {count} {items}",
  stageAriaLate: ", {late} con más de {n} {unit}",
  stageAriaOther: ", esperan a otro",
  tipAge: "{n} {unit} sin moverse",
  tipOther: "espera a otro",
  empty: "Sin carriles.",
};

/** Con más puntos que esto, se mueven sin transición (el navegador no anima miles a la vez). */
const ANIMATE_MAX = 1500;
/** Lo que tarda en irse un punto que salió (lo mismo que la transición del CSS). */
const LEAVE_MS = 900;
/** El foco no rota más rápido que esto. */
const CYCLE_MIN_S = 3;

const setText = (el: Node, v: string) => {
  if (el.textContent !== v) el.textContent = v;
};
const setAttrIf = (el: Element, name: string, v: string) => {
  if (el.getAttribute(name) !== v) el.setAttribute(name, v);
};
const setHidden = (el: HTMLElement, v: boolean) => {
  if (el.hidden !== v) el.hidden = v;
};

interface StationRefs {
  hit: HTMLElement;
  label: HTMLSpanElement;
  more: HTMLSpanElement;
}

interface LaneRefs {
  box: HTMLDivElement;
  others: HTMLSpanElement;
  count: HTMLSpanElement;
  oldest: HTMLSpanElement;
  track: HTMLDivElement;
  dots: HTMLDivElement;
  stations: StationRefs[];
}

interface DotState {
  el: HTMLElement;
  li: number;
  x: number;
  y: number;
  cls: string;
}

export class NxLanes extends Base {
  static observedAttributes = ["lanes", "items", "bands", "labels", "heading", "heading-level", "spotlight", "cycle", "locale"];

  #lanesIn: Lane[] = [];
  #itemsIn: LaneItem[] = [];
  #bandsIn: number[] | null = null;
  #labels: LanesLabels = LANES_LABELS;

  #lanes: Lane[] = [];
  #bands: number[] = [...DEFAULT_BANDS];
  #prep: LanesPrepared = { rows: [], groups: [] };
  #sums: LaneSummary[] = [];
  /** Cambiaron los carriles o los tramos: `#lanes`, `#bands`, `#prep` y `#sums` se rehacen juntos en el pintado. */
  #dirtyLanes = true;
  #dirtyItems = true;
  /** Ya llegaron `items` alguna vez: antes no hay una carga contra la cual comparar. */
  #hasItems = false;
  /** Dónde estaba cada elemento en la carga anterior (`null` antes de la primera con carriles y elementos). */
  #places: Places | null = null;
  #spotKey = "";
  /** El carril del último `nx-lanes-spotlight` (`undefined`: no se ha emitido ninguno). */
  #spotLast: string | null | undefined = undefined;

  #root?: HTMLDivElement;
  #heading?: HTMLElement;
  #legend?: HTMLDivElement;
  #list?: HTMLDivElement;
  #empty?: HTMLParagraphElement;
  #rows: LaneRefs[] = [];
  #rowsKey = "";

  #dots = new Map<string, DotState>();
  #leaving = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  #tip?: ChartTip;
  #abort?: AbortController;
  #ro?: ResizeObserver;
  #roSize = "";
  #queued = false;
  #layoutFrame = 0;
  #instantFrame = 0;
  #painted = false;
  #cycleTimer: ReturnType<typeof setInterval> | null = null;
  #cycleEvery = 0;

  // ---------------------------------------------------------------- props

  /** Los carriles: `{id, label, stages: [{id, label, other?, href?}]}`, en el orden en que se pintan. */
  get lanes(): Lane[] {
    return this.#lanesIn;
  }
  set lanes(v: Lane[] | null | undefined) {
    this.#lanesIn = Array.isArray(v) ? v : [];
    this.#dirtyLanes = true;
    this.#schedule();
  }
  /** Los elementos abiertos: `{id, lane, stage, age, label?, sub?}` (`age` en la unidad de `labels.unit`). */
  get items(): LaneItem[] {
    return this.#itemsIn;
  }
  set items(v: LaneItem[] | null | undefined) {
    this.#itemsIn = Array.isArray(v) ? v : [];
    this.#dirtyItems = true;
    this.#hasItems = true;
    this.#schedule();
  }
  /** Los cortes de los tramos, de menor a mayor (a lo sumo tres; por defecto `[2, 5, 10]`). */
  get bands(): number[] {
    return this.#bandsIn ?? [...DEFAULT_BANDS];
  }
  set bands(v: number[] | null | undefined) {
    this.#bandsIn = Array.isArray(v) ? v : null;
    this.#dirtyLanes = true;
    this.#schedule();
  }
  /** Los textos de la interfaz (`LANES_LABELS`). */
  get labels(): LanesLabels {
    return this.#labels;
  }
  set labels(v: Partial<LanesLabels> | null | undefined) {
    this.#labels = mergeLabels(LANES_LABELS, v);
    this.#schedule();
  }
  /** Un título sobre los carriles. Sin él, solo la leyenda. */
  get heading(): string | null {
    return this.getAttribute("heading");
  }
  set heading(v: string | null | undefined) {
    setAttr(this, "heading", v);
  }
  /** El nivel del título (2 por defecto). */
  get headingLevel(): number {
    const n = Number(this.getAttribute("heading-level"));
    return Number.isInteger(n) && n >= 1 && n <= 6 ? n : 2;
  }
  set headingLevel(v: number | null | undefined) {
    setAttr(this, "heading-level", typeof v === "number" && Number.isFinite(v) ? String(v) : null);
  }
  /** El carril en foco (su `id`). Con `cycle`, lo pone el componente. */
  get spotlight(): string | null {
    return this.getAttribute("spotlight");
  }
  set spotlight(v: string | null | undefined) {
    setAttr(this, "spotlight", v);
  }
  /** Cada cuántos segundos pasa el foco al siguiente carril con atrasados (0 o sin él: no rota; mínimo 3). */
  get cycle(): number {
    const n = Number(this.getAttribute("cycle"));
    return Number.isFinite(n) && n > 0 ? Math.max(CYCLE_MIN_S, n) : 0;
  }
  set cycle(v: number | null | undefined) {
    setAttr(this, "cycle", typeof v === "number" && Number.isFinite(v) && v > 0 ? String(v) : null);
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
    this.#build();
    if (this.#root!.parentNode !== this) this.append(this.#root!);
    this.#abort?.abort();
    const signal = (this.#abort = new AbortController()).signal;
    this.#tip ??= new ChartTip(this, (key) => this.#tipFor(key));
    this.#tip.attach(signal);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => this.#syncCycle(), { signal });
    if (typeof ResizeObserver === "function") {
      // Los carriles miden lo que el CSS les da (no lo que pinta el componente): reaccionar al alto no hace vaivén.
      this.#ro ??= new ResizeObserver((entries) => {
        const r = entries[entries.length - 1]?.contentRect;
        const size = r ? `${Math.round(r.width)}x${Math.round(r.height)}` : "";
        if (size === this.#roSize) return;
        this.#roSize = size;
        this.#layoutSoon();
      });
      this.#ro.observe(this.#list!);
    }
    this.#render();
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
    this.#ro?.disconnect();
    this.#roSize = "";
    this.#tip?.hide();
    this.#stopCycle();
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.#layoutFrame);
      cancelAnimationFrame(this.#instantFrame);
    }
    this.#layoutFrame = this.#instantFrame = 0;
    this.#root?.classList.remove("is-instant");
    // Lo que se estaba yendo se va ya: sin el temporizador quedaría para siempre.
    for (const [el, t] of this.#leaving) {
      clearTimeout(t);
      el.remove();
    }
    this.#leaving.clear();
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (old === value) return;
    if (name === "lanes" || name === "items" || name === "bands" || name === "labels") {
      if (value === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        console.warn(`[nx-lanes] el atributo "${name}" no es JSON válido`);
        return;
      }
      (this as unknown as Record<string, unknown>)[name] = parsed;
      return;
    }
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
      if (!this.isConnected) return;
      this.#instant();
      this.#layoutDots(false);
    });
  }

  /** Los puntos van a su sitio sin viajar (al cargar, al cambiar el tamaño). */
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
    this.#heading = h("h2", { class: "nx-lanes__heading" });
    this.#legend = h("div", { class: "nx-lanes__legend" });
    this.#list = h("div", { class: "nx-lanes__list", role: "group" });
    this.#list.addEventListener("click", (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const dot = t?.closest<HTMLElement>(".nx-lanes__dot");
      const id = dot?.getAttribute("data-nx-tip");
      if (id) {
        const row = this.#prep.rows.find((r) => r.id === id);
        if (row) emit(this, "nx-lanes-item", { id, item: row.item } satisfies LanesItemDetail);
        return;
      }
      const st = t?.closest<HTMLElement>("button.nx-lanes__st");
      if (st?.dataset.lane && st.dataset.stage) emit(this, "nx-lanes-stage", { lane: st.dataset.lane, stage: st.dataset.stage } satisfies LanesStageDetail);
    });
    this.#empty = h("p", { class: "nx-lanes__empty", hidden: true });
    this.#root = h(
      "div",
      { class: "nx-lanes__root is-instant" },
      h("div", { class: "nx-lanes__top" }, this.#heading, this.#legend),
      this.#list,
      this.#empty,
    );
  }

  /** Los carriles y sus bandejas como nodos fijos: se rehacen solo si cambian los carriles o los textos. */
  #buildRows(): boolean {
    const key = JSON.stringify(this.#lanes);
    if (key === this.#rowsKey) return false;
    this.#rowsKey = key;
    // Los puntos viven dentro de cada carril: al rehacerlos, se vuelven a crear en su sitio.
    for (const d of this.#dots.values()) d.el.remove();
    this.#dots.clear();
    for (const r of this.#rows) r.box.remove();
    this.#rows = this.#lanes.map((lane) => {
      const others = h("span", { class: "nx-lanes__others", hidden: true });
      const count = h("span", { class: "nx-lanes__count" }, "0");
      const oldest = h("span", { class: "nx-lanes__oldest" });
      const head = h(
        "div",
        { class: "nx-lanes__head", "aria-hidden": "true" },
        h("div", { class: "nx-lanes__name" }, h("b", null, lane.label), others),
        h("div", { class: "nx-lanes__num" }, count, oldest),
      );
      const n = lane.stages.length;
      const stations = lane.stages.map((stage, i) => {
        const href = safeHref(stage.href);
        const attrs = { class: `nx-lanes__st${stage.other ? " is-other" : ""}`, "data-lane": lane.id, "data-stage": stage.id };
        const hit = href ? h("a", { ...attrs, href }) : h("button", { ...attrs, type: "button" });
        hit.style.insetInlineStart = `${(i / n) * 100}%`;
        hit.style.inlineSize = `${100 / n}%`;
        const label = h("span", { class: "nx-lanes__label" }, stage.label);
        hit.append(h("span", { class: "nx-lanes__node", "aria-hidden": "true" }), label);
        const more = h("span", { class: "nx-lanes__more", "aria-hidden": "true", hidden: true });
        return { hit, label, more };
      });
      const dots = h("div", { class: "nx-lanes__dots", "aria-hidden": "true" }, ...stations.map((s) => s.more));
      const track = h("div", { class: "nx-lanes__track" }, h("span", { class: "nx-lanes__rail", "aria-hidden": "true" }), ...stations.map((s) => s.hit), dots);
      track.style.setProperty("--nx-lanes-n", String(n));
      const box = h("div", { class: "nx-lanes__lane", role: "group", "data-lane": lane.id }, head, h("div", { class: "nx-lanes__scroll" }, track));
      this.#list!.append(box);
      return { box, others, count, oldest, track, dots, stations };
    });
    return true;
  }

  #render(): void {
    this.#queued = false;
    const root = this.#root;
    if (!root) return;
    const L = this.#labels;
    const locale = resolveLocale(this);
    const num = (n: number) => chartValue(n, { locale });
    const ageText = (a: number) => fill(L.age, { n: num(Math.floor(a)) });

    let change: LanesChangeDetail | null = null;
    /** La primera carga con carriles y elementos: los puntos se ponen en su sitio, sin crecer. */
    let first = false;
    if (this.#dirtyLanes || this.#dirtyItems) {
      if (this.#dirtyLanes) {
        this.#lanes = cleanLanes(this.#lanesIn);
        this.#bands = cleanBands(this.#bandsIn ?? undefined);
      }
      this.#prep = prepare(this.#itemsIn, this.#lanes, this.#bands);
      this.#sums = summarize(this.#prep, this.#lanes, this.#bands);
      const places = placesOf(this.#prep, this.#lanes);
      if (!this.#hasItems || !this.#lanes.length) this.#places = null;
      else if (!this.#places) {
        this.#places = places;
        first = true;
      } else {
        // Solo `items` cuenta lo que pasó: cambiar los carriles no mueve, cierra ni abre nada.
        if (this.#dirtyItems) change = diffPlaces(this.#places, places);
        this.#places = places;
      }
      this.#dirtyLanes = this.#dirtyItems = false;
    }

    const has = this.#lanes.length > 0;
    setHidden(this.#empty!, has);
    setText(this.#empty!, L.empty);
    root.classList.toggle("is-empty", !has);
    const rebuilt = this.#buildRows();

    // Título.
    const heading = this.heading;
    const tag = `H${this.headingLevel}`;
    if (this.#heading!.tagName !== tag) {
      const next = h(`h${this.headingLevel}` as "h2", { class: "nx-lanes__heading" });
      this.#heading!.replaceWith(next);
      this.#heading = next;
    }
    setText(this.#heading!, heading ?? "");
    setHidden(this.#heading!, !heading);
    setAttrIf(this.#list!, "aria-label", heading || L.heading);
    this.#paintLegend(num);

    // Carriles.
    const bands = this.#bands;
    const lateFrom = bands.length ? bands[bands.length - 1] : null;
    const spot = this.spotlight;
    const unit = (n: number) => plural(L.unit, n);
    this.#lanes.forEach((lane, li) => {
      const r = this.#rows[li];
      const s = this.#sums[li];
      if (!r || !s) return;
      setText(r.count, num(s.own));
      setHidden(r.others, s.other === 0);
      setText(r.others, num(s.other));
      setAttrIf(r.others, "title", fill(L.others, { n: num(s.other) }));
      setText(r.oldest, s.oldest ? fill(L.oldest, { age: ageText(s.oldest.age) }) : L.calm);
      r.oldest.classList.toggle("is-late", lateFrom !== null && !!s.oldest && s.oldest.band === bands.length);
      r.box.classList.toggle("is-spot", spot === lane.id);
      setAttrIf(r.box, "aria-label", fill(L.laneAria, { lane: lane.label, count: num(s.own), items: plural(L.item, s.own) }));
      lane.stages.forEach((stage, si) => {
        const st = r.stations[si];
        const ss = s.stations[si];
        st.hit.classList.toggle("is-late", !stage.other && ss.late > 0);
        let aria = fill(L.stageAria, { stage: stage.label, count: num(ss.count), items: plural(L.item, ss.count) });
        if (stage.other) aria += L.stageAriaOther;
        else if (ss.late && lateFrom !== null) aria += fill(L.stageAriaLate, { late: num(ss.late), n: num(lateFrom), unit: unit(lateFrom) });
        setAttrIf(st.hit, "aria-label", aria);
      });
    });

    // Con los carriles recién hechos o la primera carga, los puntos se ponen en su sitio sin crecer ni viajar.
    this.#layoutDots(!rebuilt && !first);
    if (!this.#painted || rebuilt || first) {
      this.#painted = true;
      this.#instant();
    }
    if (change && (change.moved.length || change.added.length || change.removed.length)) emit(this, "nx-lanes-change", change);
    this.#syncCycle();
    this.#emitSpotlight();
  }

  #paintLegend(num: (n: number) => string): void {
    const L = this.#labels;
    const bands = this.#bands;
    const others = this.#lanes.some((l) => l.stages.some((s) => s.other));
    const key = JSON.stringify([bands, others, L.bandFirst, L.band, L.bandLast, L.unit, L.other, resolveLocale(this)]);
    if (this.#legend!.dataset.key === key) return;
    this.#legend!.dataset.key = key;
    const tones = toneNames(bands);
    const texts = bandLabels(bands, L, num);
    const parts: Node[] = texts.map((t, i) => h("span", null, h("i", { class: `nx-lanes__sw is-${tones[i]}`, "aria-hidden": "true" }), t));
    if (others) parts.push(h("span", null, h("i", { class: "nx-lanes__sw is-other", "aria-hidden": "true" }), L.other));
    this.#legend!.replaceChildren(...parts);
  }

  /** Mide cada carril una vez y mueve cada punto a su sitio; solo escribe lo que cambió. */
  #layoutDots(animate: boolean): void {
    const rows = this.#rows;
    if (!rows.length) return;
    // Leer: el tamaño de cada carril.
    const sizes = rows.map((r) => ({ w: r.track.clientWidth, h: r.track.clientHeight }));
    const first = sizes.find((s) => s.w > 0 && s.h > 0) ?? { w: 0, h: 0 };
    const size = dotSize(first.w || 880, first.h || 76);
    const tones = toneNames(this.#bands);
    // Las bandejas van con `inset-inline-start`; los puntos, con `translate` físico: en RTL se espeja la x.
    const rtl = typeof getComputedStyle === "function" && getComputedStyle(this.#list!).direction === "rtl";
    const crowded = this.#prep.rows.length > ANIMATE_MAX || reducedMotion();
    const moving = animate && this.#painted && !crowded;
    this.#list!.style.setProperty("--nx-lanes-dot", `${size}px`);
    this.#root!.classList.toggle("is-crowded", crowded);
    // Escribir: cada punto y cada «+N».
    const seen = new Set<string>();
    /** Al salir, el punto va hasta la punta de su riel y se apaga (no pasa del carril). */
    const ends: number[] = [];
    this.#lanes.forEach((lane, li) => {
      const r = rows[li];
      const box = sizes[li];
      const w = box.w || first.w || 880;
      const st = stackOf(w, box.h || first.h || 76, lane.stages.length, size);
      const px = (cx: number) => (rtl ? w - cx : cx);
      ends[li] = Math.round(px(w - size / 2 - 2) - size / 2);
      lane.stages.forEach((stage, si) => {
        const g = this.#prep.groups[li]?.[si] ?? [];
        const more = r.stations[si].more;
        const extra = g.length - st.cap;
        setHidden(more, extra <= 0);
        if (extra > 0) {
          setText(more, fill(this.#labels.more, { n: chartValue(extra, { locale: resolveLocale(this) }) }));
          const c = Math.min(st.cols, g.length);
          const center = st.sw * (si + 0.5);
          // Después de la pila si cabe; si no (la última bandeja), antes, para no salirse del carril.
          const after = center + (c / 2) * st.gap + 4;
          const fits = after + 30 <= w;
          const at = fits ? after : center - (c / 2) * st.gap - 4;
          const y = Math.round(st.railY - 4 - size - (st.rows - 1) * st.gap);
          more.style.transform = `translate(${Math.round(px(at))}px,${y}px)${fits === rtl ? " translateX(-100%)" : ""}`;
        }
        g.forEach((row, k) => {
          seen.add(row.id);
          const { x, y } = slotOf(st, si, k, g.length, size);
          let cls = `nx-lanes__dot is-${tones[row.band]}`;
          if (stage.other) cls += " is-other";
          else if (tones[row.band] === "late" && this.#bands.length) cls += " is-pulse";
          if (k >= st.cap) cls += " is-over-cap";
          this.#place(row.id, li, Math.round(px(x) - size / 2), Math.round(y - size / 2), cls, moving);
        });
      });
    });
    // Lo que ya no está: sale por la punta de su riel y se borra.
    for (const [id, d] of this.#dots) {
      if (seen.has(id)) continue;
      this.#dots.delete(id);
      this.#leave(d, ends[d.li] ?? d.x, moving);
    }
  }

  #place(id: string, li: number, x: number, y: number, cls: string, animate: boolean): void {
    const layer = this.#rows[li].dots;
    let d = this.#dots.get(id);
    if (d && d.li !== li) {
      // Cambió de carril (una corrección): no es un paso del trámite, aparece en el nuevo.
      d.el.remove();
      this.#dots.delete(id);
      d = undefined;
    }
    if (!d) {
      const el = h("i", { class: cls, "data-nx-tip": id });
      el.style.transform = `translate(${x}px,${y}px)`;
      el.style.setProperty("--nx-lanes-delay", `${delayOf(id)}s`);
      layer.append(el);
      this.#dots.set(id, { el, li, x, y, cls });
      if (animate) this.#born(el);
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

  /** Un punto que llega: crece en su sitio (no cruza el carril desde una esquina). */
  #born(el: HTMLElement): void {
    if (typeof requestAnimationFrame !== "function") return;
    el.classList.add("is-born");
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("is-born")));
  }

  #leave(d: DotState, x: number, animate: boolean): void {
    if (!animate) {
      d.el.remove();
      return;
    }
    d.el.removeAttribute("data-nx-tip");
    d.el.classList.add("is-leaving");
    d.el.style.transform = `translate(${x}px,${d.y}px)`;
    const t = setTimeout(() => {
      this.#leaving.delete(d.el);
      d.el.remove();
    }, LEAVE_MS);
    this.#leaving.set(d.el, t);
  }

  #tipFor(id: string): Node[] | null {
    const row = this.#prep.rows.find((r) => r.id === id);
    if (!row) return null;
    const L = this.#labels;
    const locale = resolveLocale(this);
    const lane = this.#lanes[row.li];
    const stage = lane.stages[row.si];
    const it = row.item;
    const n = Math.floor(row.age);
    const out: Node[] = [h("p", { class: "nx-chart-tip__title" }, it.label ?? `#${row.id}`)];
    if (it.sub) out.push(h("p", { class: "nx-lanes__tip-sub" }, it.sub));
    out.push(h("p", { class: "nx-lanes__tip-stage" }, h("b", null, `${lane.label} · ${stage.label}`)));
    out.push(h("p", { class: "nx-lanes__tip-age" }, fill(L.tipAge, { n: chartValue(n, { locale }), unit: plural(L.unit, n) }) + (row.other ? ` · ${L.tipOther}` : "")));
    return out;
  }

  // ---------------------------------------------------------------- foco

  /** Usa `#lanes` y `#sums` del último pintado (siempre del mismo): nunca los de un setter a medias. */
  #syncCycle(): void {
    const every = this.cycle;
    const want = this.isConnected && every > 0 && this.#lanes.length > 0 && !(typeof document !== "undefined" && document.hidden);
    if (!want) return this.#stopCycle();
    if (!this.#cycleTimer || this.#cycleEvery !== every) {
      this.#stopCycle();
      this.#cycleEvery = every;
      this.#cycleTimer = setInterval(() => this.#advance(), every * 1000);
    }
    // Sin foco todavía, o en un carril que ya no lo merece (o ya no está): el primero, ya.
    const ranked = rankLanes(this.#sums);
    const cur = this.spotlight;
    if (ranked.some((i) => this.#lanes[i].id === cur)) return;
    const next = ranked.length ? this.#lanes[ranked[0]].id : null;
    if (next !== cur) this.spotlight = next;
  }

  #stopCycle(): void {
    if (this.#cycleTimer) clearInterval(this.#cycleTimer);
    this.#cycleTimer = null;
    this.#cycleEvery = 0;
  }

  /** El siguiente carril que vale la pena mirar (o ninguno si todos están al día). */
  #advance(): void {
    if (!this.isConnected) return this.#stopCycle();
    const ranked = rankLanes(this.#sums);
    if (!ranked.length) {
      this.spotlight = null;
      return;
    }
    const at = ranked.findIndex((i) => this.#lanes[i].id === this.spotlight);
    this.spotlight = this.#lanes[ranked[(at + 1) % ranked.length]].id;
  }

  /** Avisa las cifras del carril en foco cuando cambia el carril o lo que dice. */
  #emitSpotlight(): void {
    const id = this.spotlight;
    const li = id === null ? -1 : this.#lanes.findIndex((l) => l.id === id);
    const ranked = rankLanes(this.#sums);
    let detail: LanesSpotlightDetail;
    if (li < 0) {
      detail = { lane: null, label: "", index: 0, total: ranked.length, own: 0, other: 0, late: 0, tones: [], oldest: null, jam: null };
    } else {
      const lane = this.#lanes[li];
      const s = this.#sums[li];
      const o = s.oldest;
      const j = jamOf(s, lane);
      detail = {
        lane: lane.id,
        label: lane.label,
        index: ranked.indexOf(li) + 1,
        total: ranked.length,
        own: s.own,
        other: s.other,
        late: s.late,
        tones: [...s.tones],
        oldest: o ? { id: o.id, age: o.age, stage: lane.stages[o.si].id, stageLabel: lane.stages[o.si].label } : null,
        jam: j < 0 ? null : { stage: lane.stages[j].id, label: lane.stages[j].label, late: s.stations[j].late, count: s.stations[j].count },
      };
    }
    const key = JSON.stringify(detail);
    if (key === this.#spotKey) return;
    this.#spotKey = key;
    // Sin foco no hay cifras que contar: solo se avisa al soltar uno.
    if (detail.lane === null && (this.#spotLast === undefined || this.#spotLast === null)) return;
    this.#spotLast = detail.lane;
    emit(this, "nx-lanes-spotlight", detail);
  }
}
