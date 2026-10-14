/**
 * `<nx-award>`: el cuadro comparativo para adjudicar una compra. Artículos en filas, proveedores en
 * columnas y, en cada celda, lo que cotizó. La recomendación (del backend) sugiere a quién darle
 * cada artículo (contorno punteado y ✦) y el comprador decide (relleno): al principio coinciden, y
 * cuando se aparta, la sugerencia sigue a la vista y la fila dice cuánto cuesta el cambio.
 *
 * Lo adjudicado son repartos: un clic en una celda le da el artículo entero a ese proveedor (hasta
 * lo que ofreció); en el detalle de la fila se reparte por cantidad entre varios, o se deja sin
 * adjudicar. Nunca se le da a nadie más de lo que ofreció ni se pasa de lo pedido.
 *
 * Con 100 artículos y 10 proveedores son 1.000 números: el componente no pide leerlos todos. Las
 * alertas (un precio atípico, una sola cotización, una oferta parcial, un proveedor con la póliza
 * vencida) marcan las filas que merecen ojo humano, y «Siguiente alerta» (o J/K) lleva de una a
 * otra. Arriba, el total, lo que cuestan los cambios frente a la sugerencia y cuántas órdenes salen;
 * abajo, lo adjudicado a cada proveedor y el motivo de la decisión.
 *
 * La recomendación no es una función en una prop (BDUI): la calcula el backend (`endpoint`, POST con
 * `{weights, excluded}` y la respuesta en NDJSON) o la app (`advice`, o respondiendo a
 * `nx-award-advise`). Mover los pesos o excluir a un proveedor la vuelve a pedir (con `endpoint` o
 * `adjustable`). Una recomendación que falla o se corta no deja nada a medias: vuelve la anterior.
 */
import { Base, boolAttr, upgrade } from "../../core/define";
import { h, safeEndpoint, emit, setAttr } from "../../core/dom";
import { glyph } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import { nxFormat, resolveLocale, type NxFormat } from "../../core/locale";
import { lineData, readLines } from "../../core/stream";
import { amountOf, buildOrders, capOf, changesOf, choiceList, choicesFromValue, cleanChoices, cleanCriteria, cleanEvent, cleanItems, cleanQuotes, cleanStrings, cleanSuppliers, contributions, fill, flagSig, gridMove, keyOf, list, milli, nextIndex, normSplits, num, parseEvent, partTotal, percents, qkey, qtyOf, sameSplits, shares, shortOf, splittable, totalOf, valueOf, type Choice } from "./logic";
import type { AwardAllocation, AwardChangeDetail, AwardChangeKind, AwardChoice, AwardCriterion, AwardEvent, AwardFilter, AwardFlag, AwardItem, AwardLabels, AwardLens, AwardNote, AwardQuote, AwardRecommendation, AwardScenario, AwardSplit, AwardSubmitDetail, AwardSupplier } from "./types";

export const AWARD_LABELS: AwardLabels = {
  table: "Cuadro comparativo de cotizaciones",
  item: "Artículo",
  awarded: "Adjudicado",
  total: "Total adjudicado",
  vsAi: "Frente a la sugerencia",
  same: "Igual",
  changeOne: "1 cambio",
  changeMany: "{n} cambios",
  orders: "Órdenes",
  supplierOne: "1 proveedor",
  supplierMany: "{n} proveedores",
  pending: "Por revisar",
  pendingOf: "de {total} alertas",
  reviewed: "todas abiertas",
  noAlerts: "sin alertas",
  next: "Siguiente alerta",
  unassigned: "{n} sin adjudicar",
  partial: "{n} con menos de lo pedido",
  lens: "Ver",
  lensPrice: "Precio unitario",
  lensTotal: "Total de la línea",
  lensLead: "Plazo",
  lensScore: "Puntaje",
  show: "Mostrar",
  filterAll: "Todos",
  filterAlerts: "Con alertas",
  filterChanged: "Cambiados",
  scenario: "Escenario",
  best: "Mejor por artículo",
  criteria: "Criterios",
  reset: "Restablecer",
  suggested: "sugerida",
  noQuote: "No cotizó",
  nobody: "Nadie cotizó",
  changed: "cambiado",
  skipped: "no se adjudica",
  short: "faltan {n}",
  offers: "Ofrece {qty}",
  pick: "Elegir a {name}",
  qtyFor: "Cantidad para {name}",
  left: "Quedan {n} sin adjudicar.",
  youChose: "Elegiste {supplier}: {delta} frente a la sugerencia.",
  youSplit: "Tu reparto: {delta} frente a la sugerencia.",
  youSkip: "No se adjudica: {delta} frente a la sugerencia.",
  youChoseFree: "Elegiste {supplier}.",
  youSplitFree: "Tu reparto.",
  reason: "Motivo del cambio",
  undo: "Volver a la sugerencia",
  skip: "No adjudicar",
  excluded: "Excluido",
  exclude: "Excluir de la sugerencia",
  include: "Volver a considerarlo",
  blocked: "No elegible",
  giveAll: "Darle todo lo que cotizó",
  gaveOne: "1 artículo pasó a {supplier}.",
  gaveAll: "{n} artículos pasaron a {supplier}.",
  bulkReason: "Consolidar en {supplier}",
  revert: "Deshacer",
  supplierStats: "{quoted} cotizados · {awarded} adjudicados · {total}",
  close: "Cerrar",
  motive: "Motivo de la decisión",
  submit: "Generar órdenes",
  submitting: "Generando…",
  busy: "Espera a que termine la recomendación.",
  needReview: "Abre las alertas pendientes antes de generar las órdenes.",
  needReason: "Falta el motivo del cambio en {name}.",
  needMotive: "Escribe el motivo de la decisión.",
  needEligible: "{supplier} no es elegible ({name}).",
  saveError: "No se pudo guardar la adjudicación.",
  advising: "Revisando las cotizaciones…",
  error: "No se pudo obtener la recomendación.",
  partialAdvice: "La recomendación se cortó antes de terminar: sigue la anterior.",
  timeout: "La recomendación tardó demasiado: sigue la anterior.",
  movedOne: "La nueva sugerencia cambió 1 artículo.",
  movedMany: "La nueva sugerencia cambió {n} artículos.",
  retry: "Reintentar",
  days: "{n} d",
  points: "{n} pts",
  quoted: "Cotizó",
  count: "{n} art.",
};

/** Los motivos que se sugieren al apartarse de la sugerencia (se puede escribir otro). */
export const AWARD_REASONS: readonly string[] = ["Proveedor habitual", "Calidad comprobada", "Consolidar en menos órdenes", "Plazo de entrega", "Garantía o soporte"];

const JSON_ATTRS = new Set(["suppliers", "items", "quotes", "criteria", "advice", "choices", "value", "excluded", "reasons", "labels"]);
const LENSES: readonly AwardLens[] = ["price", "total", "lead", "score"];
const LENS_LABEL = { price: "lensPrice", total: "lensTotal", lead: "lensLead", score: "lensScore" } as const;
const FILTERS: readonly AwardFilter[] = ["all", "alerts", "changed"];
const FILTER_LABEL = { all: "filterAll", alerts: "filterAlerts", changed: "filterChanged" } as const;
/** Espera entre el último movimiento de un peso y el pedido de la recomendación. */
const DEBOUNCE = 350;
/** Plazo por defecto de una recomendación (`timeout`, en ms): un modelo puede tardar. */
const TIMEOUT = 60_000;

const SPARK = '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/>';
const WARN = '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>';
const CHECK = '<path d="M20 6 9 17l-5-5"/>';
const UNDO = '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>';
const CLOSE = '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>';
const BAN = '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>';

type Pos = { r: string; c: number };
type RowRef = { item: AwardItem; tr: HTMLTableRowElement; th: HTMLTableCellElement; cells: HTMLTableCellElement[] };
type GroupRef = { tr: HTMLTableRowElement; th: HTMLTableCellElement; name: string; rows: RowRef[] };
type Params = { weights: Record<string, number>; excluded: string[] };
/** Una recomendación en curso. Lo que no vuelve a mandar desaparece al terminar (`done`); si falla
 *  o se corta, vuelve lo de antes (`prev`). */
type Run = {
  seq: number;
  params: Params;
  prev: { recs: Map<string, AwardRecommendation>; flags: Map<string, AwardFlag[]> };
  /** Lo adjudicado antes de esta recomendación (para saber qué movió). */
  before: Map<string, string>;
  recs: Set<string>;
  flagged: Set<string>;
  /** Lo que el comprador cambió mientras corría: no lo movió la recomendación. */
  touched: Set<string>;
  scenarios: AwardScenario[] | null;
  notes: AwardNote[];
  timer?: number;
  done?: boolean;
  failed?: boolean;
  partial?: boolean;
  late?: boolean;
};

let uid = 0;
const vh = (text: string) => h("span", { class: "nx-award__vh" }, text);
const pcts = new Map<string, Intl.NumberFormat>();
/** 0,083 → «8 %»; con `sign`, «+8,3 %». */
function pct(n: number, locale: string, sign = false): string {
  const key = `${locale}|${sign}`;
  let f = pcts.get(key);
  if (!f) pcts.set(key, (f = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: sign ? 1 : 0, signDisplay: sign ? "exceptZero" : "auto" })));
  return f.format(n).replace(/[  ]/g, " ");
}
const EMPTY: readonly AwardSplit[] = [];

export class NxAward extends Base {
  static observedAttributes = ["suppliers", "items", "quotes", "criteria", "advice", "choices", "value", "excluded", "reasons", "labels", "scenario", "endpoint", "heading", "locale", "currency", "lens", "readonly", "motive", "require-motive", "adjustable", "timeout"];

  #uid = `nx-aw${++uid}`;
  #suppliers: AwardSupplier[] = [];
  #supMap = new Map<string, AwardSupplier>();
  #items: AwardItem[] = [];
  #itemMap = new Map<string, AwardItem>();
  #quotes = new Map<string, AwardQuote>();
  #criteria: AwardCriterion[] = [];
  /** Los pesos de ahora, en porcentaje de su suma (lo que muestran los deslizadores). */
  #weights: Record<string, number> = {};
  #baseWeights: Record<string, number> = {};
  #recs = new Map<string, AwardRecommendation>();
  #flags = new Map<string, AwardFlag[]>();
  #scenarios: AwardScenario[] = [];
  #scenario = "";
  #notes: AwardNote[] = [];
  #failed = false;
  /** Los pesos y exclusiones con que se calculó la recomendación que se ve. */
  #applied: Params | null = null;
  /** Lo que decidió el comprador. Sin entrada, el artículo sigue a la sugerencia. */
  #choices = new Map<string, Choice>();
  /** `value` asignado antes que `items`: se vuelve a leer cuando llegan. */
  #valueRaw: unknown;
  #excluded = new Set<string>();
  #reasons: string[] = [...AWARD_REASONS];
  #motive = "";
  /** Las alertas ya abiertas (por su firma: si cambian, vuelven a estar por revisar). */
  #seen = new Set<string>();
  #seenSup = new Set<string>();
  /** Los artículos que la última recomendación movió (se marcan hasta el siguiente cambio). */
  #moved = new Set<string>();
  #labels = AWARD_LABELS;
  #filter: AwardFilter = "all";
  #open: string | null = null;
  #sup: string | null = null;
  /** El último proveedor abierto (al cerrar su barra, el foco vuelve a su columna). */
  #lastSup = "";
  #bulk: { supplier: string; prev: Map<string, Choice>; n: number } | null = null;
  /** La celda con el foco de la grilla (`null`: la primera fila visible). */
  #active: Pos | null = null;
  #advised = false;
  /** Hay una recomendación pedida que no terminó (se vuelve a pedir al reconectar). */
  #stale = false;
  /** Pesos asignados antes que los criterios: se aplican al llegar `criteria`. */
  #wantWeights: Record<string, number> | null = null;
  #seq = 0;
  #run: Run | null = null;
  #ctrl?: AbortController;
  #timer = 0;
  #isBusy = false;
  #submitting = false;
  #submitSeq = 0;
  #wired = false;
  #hold = false;
  #holdTimer = 0;
  #dirty = false;
  // ---- pintado
  #f?: NxFormat;
  #built = false;
  #queued = false;
  #structure = true;
  #full = false;
  #detailDirty = false;
  #dirtyRows = new Set<string>();
  /** Lo que muestra cada sección la última vez que se pintó: si no cambia, no se recrea. */
  #sigs = new Map<string, string>();
  #cellSig = new WeakMap<Element, string>();
  #detailSig = "";
  /** Los campos del detalle abierto (motivo, cantidades): se reusan al repintar (no pierden lo escrito). */
  #inputs = new Map<string, HTMLInputElement>();
  #inputsItem = "";
  /** La celda que tenía el foco antes de rehacer la tabla. */
  #refocus: Pos | null = null;
  #live?: HTMLElement;
  #rows = new Map<string, RowRef>();
  #groups: GroupRef[] = [];
  #pos = new WeakMap<Element, Pos>();
  #heads: HTMLTableCellElement[] = [];
  #corner?: HTMLTableCellElement;
  #tabEl?: HTMLElement;
  #footTotal?: HTMLElement;
  #footCells: HTMLTableCellElement[] = [];
  #detailTr?: HTMLTableRowElement;
  #title?: HTMLHeadingElement;
  #scenarioField?: HTMLElement;
  #scenarioSel?: HTMLSelectElement;
  #scenarioSig = "";
  #lensSel?: HTMLSelectElement;
  #filterBtns: HTMLButtonElement[] = [];
  #critBtn?: HTMLButtonElement;
  #crit?: HTMLElement;
  #critRows = new Map<string, { range: HTMLInputElement; out: HTMLElement }>();
  #critReset?: HTMLButtonElement;
  #sum?: { total: HTMLElement; totalSub: HTMLElement; delta: HTMLElement; deltaSub: HTMLElement; orders: HTMLElement; pending: HTMLElement; pendingSub: HTMLElement; next: HTMLButtonElement };
  #notesEl?: HTMLElement;
  #supEl?: HTMLElement;
  #table?: HTMLTableElement;
  #datalist?: HTMLDataListElement;
  #motiveBox?: HTMLElement;
  #motiveEl?: HTMLTextAreaElement;
  #msgEl?: HTMLElement;
  #submitBtn?: HTMLButtonElement;

  // ---------------------------------------------------------------- propiedades

  /** Los proveedores `{id, name, detail?, alert?, blocked?}`, en el orden de las columnas. */
  get suppliers(): AwardSupplier[] {
    return this.#suppliers;
  }
  set suppliers(v: unknown) {
    this.#suppliers = cleanSuppliers(v);
    this.#supMap = new Map(this.#suppliers.map((s) => [s.id, s]));
    this.#restructure();
  }
  /** Los artículos `{id, name, qty?, qtyText?, unit?, code?, group?}`, en el orden de las filas. */
  get items(): AwardItem[] {
    return this.#items;
  }
  set items(v: unknown) {
    this.#items = cleanItems(v);
    this.#itemMap = new Map(this.#items.map((i) => [i.id, i]));
    if (this.#valueRaw !== undefined) this.#choices = cleanChoices(choicesFromValue(this.#valueRaw, this.#items));
    this.#restructure();
  }
  /** Las cotizaciones `{item, supplier, price, offered?, leadTime?, original?, note?}`. `price` es el unitario comparable. */
  get quotes(): AwardQuote[] {
    return [...this.#quotes.values()];
  }
  set quotes(v: unknown) {
    this.#quotes = cleanQuotes(v);
    this.#restructure();
  }
  /** Los criterios `{id, label, weight}`: la leyenda del puntaje y los deslizadores de «Criterios». */
  get criteria(): AwardCriterion[] {
    return this.#criteria;
  }
  set criteria(v: unknown) {
    this.#criteria = cleanCriteria(v);
    this.#baseWeights = percents(this.#criteria, {});
    this.#weights = { ...this.#baseWeights };
    if (this.#wantWeights) {
      const want = this.#wantWeights;
      this.#wantWeights = null;
      this.#weights = this.#mergeWeights(want);
    }
    this.#buildCrit();
    this.#detailDirty = true;
    this.#queue();
  }
  /** Los pesos de ahora `{criterio: peso}` (los de los deslizadores, 0–100; cuentan sobre su suma).
   *  Todos juntos se asignan en cualquier escala (0,6/0,4 o 600/200); unos pocos, en la de los
   *  deslizadores. Si cambian, se vuelve a pedir la recomendación. */
  get weights(): Record<string, number> {
    return { ...this.#weights };
  }
  set weights(v: Record<string, number> | null | undefined) {
    if (!this.#criteria.length) {
      this.#wantWeights = v ? { ...v } : null;
      return;
    }
    if (!v) return;
    const next = this.#mergeWeights(v);
    if (this.#criteria.every((c) => next[c.id] === this.#weights[c.id])) return;
    this.#weights = next;
    this.#paintCrit();
    this.#detailDirty = true;
    this.#request(0);
  }
  /** La recomendación como eventos del protocolo (`recommend`, `flag`, `scenario`, `note`), sin
   *  servidor. Reemplaza la anterior; leerla devuelve la de ahora (para guardarla). */
  get advice(): AwardEvent[] {
    return [
      ...[...this.#recs.values()].map((r) => ({ type: "recommend" as const, ...r })),
      ...[...this.#flags.values()].flat().map((f) => ({ type: "flag" as const, ...f })),
      ...this.#scenarios.map((s) => ({ type: "scenario" as const, ...s })),
      { type: "done" as const },
    ];
  }
  set advice(v: unknown) {
    // `undefined` (un framework que asigna la prop vacía) no borra nada; `[]` sí.
    if (v === null || v === undefined) return;
    clearTimeout(this.#timer);
    this.#timer = 0;
    this.#dropRun();
    this.#applyAll((this.#run = this.#newRun()), list(v));
  }
  /** Lo que decidió el comprador `[{item, allocations: [{supplier, qty?}], reason?}]` (`[]`: no se
   *  adjudica). Para guardar y retomar un borrador; los artículos sin elección siguen a la sugerencia. */
  get choices(): AwardChoice[] {
    return choiceList(this.#choices);
  }
  set choices(v: unknown) {
    const next = cleanChoices(v);
    // Las mismas (una app que devuelve `choices` en cada cambio): no se borra «Deshacer» ni `dirty`.
    if (JSON.stringify(choiceList(next)) === JSON.stringify(this.choices)) return;
    this.#choices = next;
    this.#valueRaw = undefined;
    this.#bulk = null;
    this.#dirty = false;
    this.#repaint();
  }
  /** Lo adjudicado `[{item, supplier, qty?}]`: lo elegido, o la sugerencia. Asignarlo fija todo tal
   *  cual (lo que no aparece no se adjudica): una adjudicación cerrada, en `readonly`. */
  get value(): AwardAllocation[] {
    return valueOf(this.#items, (id) => this.#allocOf(id), this.#quotes);
  }
  set value(v: unknown) {
    if (v === null || v === undefined) return;
    const next = cleanChoices(choicesFromValue(v, this.#items));
    if (this.#items.length && JSON.stringify(choiceList(next)) === JSON.stringify(this.choices)) return;
    this.#valueRaw = v;
    this.#choices = next;
    this.#bulk = null;
    this.#dirty = false;
    this.#repaint();
  }
  /** Los proveedores que no entran en la sugerencia (ids). */
  get excluded(): string[] {
    return [...this.#excluded];
  }
  set excluded(v: unknown) {
    const next = new Set(cleanStrings(v));
    const changed = next.size !== this.#excluded.size || [...next].some((x) => !this.#excluded.has(x));
    if (!changed) return;
    this.#excluded = next;
    this.#repaint();
    this.#request(0);
  }
  /** Los motivos que se sugieren al apartarse de la sugerencia. */
  get reasons(): string[] {
    return this.#reasons;
  }
  set reasons(v: unknown) {
    this.#reasons = v === null || v === undefined ? [...AWARD_REASONS] : cleanStrings(v);
    this.#paintReasons();
  }
  get labels(): AwardLabels {
    return this.#labels;
  }
  set labels(v: Partial<AwardLabels> | string | null | undefined) {
    this.#labels = mergeLabels(AWARD_LABELS, v);
    if (this.#built) this.#build();
  }
  /** El motivo de la decisión (toda la adjudicación; máximo 500 caracteres). */
  get motive(): string {
    return this.#motive;
  }
  set motive(v: string | null | undefined) {
    this.#motive = (v ?? "").slice(0, 500);
    if (this.#motiveEl && document.activeElement !== this.#motiveEl) this.#motiveEl.value = this.#motive;
    this.#queue();
  }
  /** El escenario aplicado (`""`: lo mejor por artículo). Cambia la sugerencia de los artículos que toca. */
  get scenario(): string {
    return this.#scenario;
  }
  set scenario(v: string | null | undefined) {
    this.#setScenario(v ?? "", false);
  }
  /** Qué filas se ven: `all`, `alerts` (con alertas) o `changed` (apartadas de la sugerencia). */
  get filter(): AwardFilter {
    return this.#filter;
  }
  set filter(v: AwardFilter) {
    if (!FILTERS.includes(v) || v === this.#filter) return;
    this.#filter = v;
    this.#repaint();
  }
  /** Lo que muestran las celdas: `price` (por defecto), `total`, `lead` o `score`. */
  get lens(): AwardLens {
    const v = this.getAttribute("lens") as AwardLens;
    return LENSES.includes(v) ? v : "price";
  }
  set lens(v: AwardLens) {
    this.#attr("lens", v);
  }
  /** URL de la recomendación: `POST {weights, excluded}` → NDJSON. Sin ella, `nx-award-advise`.
   *  Solo del mismo origen (o uno de `allowOrigins`); otra se ignora, como si no hubiera. */
  get endpoint(): string {
    return this.getAttribute("endpoint") ?? "";
  }
  set endpoint(v: string) {
    this.#attr("endpoint", v);
  }
  /** Sin `endpoint`, la app responde `nx-award-advise` cada vez: se muestran los pesos y
   *  «Excluir de la sugerencia». Sin esto (ni `endpoint`), la recomendación es fija. */
  get adjustable(): boolean {
    return boolAttr(this, "adjustable");
  }
  set adjustable(v: boolean) {
    this.toggleAttribute("adjustable", !!v);
  }
  /** Plazo de una recomendación, en ms (por defecto 60 000). Si se vence, sigue la anterior. */
  get timeout(): number {
    const n = Number(this.getAttribute("timeout"));
    return Number.isFinite(n) && n > 0 ? n : TIMEOUT;
  }
  set timeout(v: number) {
    this.#attr("timeout", v ? String(v) : null);
  }
  get heading(): string {
    return this.getAttribute("heading") ?? "";
  }
  set heading(v: string) {
    this.#attr("heading", v);
  }
  /** Idioma de números y montos («es-CO», «en-US»); sin él, el `lang` más cercano. */
  get locale(): string | null {
    return this.getAttribute("locale");
  }
  set locale(v: string | null | undefined) {
    this.#attr("locale", v);
  }
  /** Moneda de los precios: código ISO («COP») o símbolo («$»). */
  get currency(): string {
    return this.getAttribute("currency") ?? "";
  }
  set currency(v: string) {
    this.#attr("currency", v);
  }
  /** Solo lectura: una adjudicación cerrada se consulta, no se cambia (y no se pide recomendación). */
  get readonly(): boolean {
    return boolAttr(this, "readonly");
  }
  set readonly(v: boolean) {
    this.toggleAttribute("readonly", !!v);
  }
  /** Apartarse de la sugerencia pide motivo: «Generar órdenes» lleva al que falta. */
  get requireReason(): boolean {
    return boolAttr(this, "require-reason");
  }
  set requireReason(v: boolean) {
    this.toggleAttribute("require-reason", !!v);
  }
  /** Las alertas se abren antes de generar las órdenes: «Generar órdenes» lleva a la siguiente. */
  get requireReview(): boolean {
    return boolAttr(this, "require-review");
  }
  set requireReview(v: boolean) {
    this.toggleAttribute("require-review", !!v);
  }
  /** El motivo de la decisión es obligatorio para generar las órdenes. */
  get requireMotive(): boolean {
    return boolAttr(this, "require-motive");
  }
  set requireMotive(v: boolean) {
    this.toggleAttribute("require-motive", !!v);
  }
  /** Hay cambios del comprador sin guardar (se apaga al asignar `choices`/`value`, al terminar bien
   *  un `wait()` del envío, o con `dirty = false`). */
  get dirty(): boolean {
    return this.#dirty;
  }
  set dirty(v: boolean) {
    this.#dirty = !!v;
  }
  /** La app está guardando (después de `wait()` en `nx-award-submit`). */
  get submitting(): boolean {
    return this.#submitting;
  }

  /** Abre el detalle de un artículo (o lo cierra, con `null`). */
  open(item: string | null): void {
    this.#setOpen(item && this.#itemMap.has(item) ? item : null);
  }
  /** Abre la siguiente alerta por revisar (o, si ya se vieron todas, la siguiente) y la enfoca. */
  next(dir: 1 | -1 = 1): void {
    const order = [...this.#rows.keys()];
    const from = order.indexOf(this.#open ?? this.#active?.r ?? "");
    let i = nextIndex(order.length, from, dir, (k) => this.#pending(order[k]));
    if (i < 0) i = nextIndex(order.length, from, dir, (k) => this.#hasAlert(order[k]));
    if (i >= 0) this.#reveal(order[i]);
  }
  /** Vuelve a pedir la recomendación ya. */
  refresh(): void {
    this.#request(0);
  }
  /** Genera las órdenes (`nx-award-submit`). Antes lleva a lo que falta (un proveedor no elegible,
   *  un motivo, una alerta) y devuelve `false`; también mientras llega una recomendación o se guarda. */
  submit(): boolean {
    const L = this.#labels;
    if (this.readonly || this.#submitting) return false;
    // Con una recomendación en camino, las órdenes saldrían de la anterior.
    if (this.#isBusy) {
      this.#say(L.busy);
      return false;
    }
    for (const it of this.#items) {
      const bad = this.#allocOf(it.id).find((s) => this.#supMap.get(s.supplier)?.blocked);
      if (bad) {
        this.#say(fill(L.needEligible, { supplier: this.#name(bad.supplier), name: it.name }));
        this.#reveal(it.id);
        return false;
      }
    }
    const changes = this.#changes();
    if (this.requireReason) {
      const miss = changes.find((c) => !c.reason?.trim());
      if (miss) {
        this.#say(fill(L.needReason, { name: this.#itemMap.get(miss.item)!.name }));
        this.#reveal(miss.item, "reason");
        return false;
      }
    }
    const pending = this.#items.filter((i) => this.#pending(i.id)).length;
    if (pending && this.requireReview) {
      this.#say(L.needReview);
      this.next(1);
      return false;
    }
    const motive = this.#motive.trim();
    if (this.requireMotive && !motive) {
      this.#say(L.needMotive);
      this.#motiveEl?.focus();
      return false;
    }
    const value = this.value;
    const { orders, total, unassigned, partial } = buildOrders(this.#items, this.#suppliers, (id) => this.#allocOf(id), this.#quotes);
    const applied = this.#applied ?? { weights: this.weights, excluded: this.excluded };
    // Con precios y total: la misma asignación con otras cotizaciones es otra adjudicación.
    const key = keyOf(JSON.stringify([orders, total, motive, changes.map((c) => [c.item, c.reason ?? ""]), this.#scenario]));
    const seq = ++this.#submitSeq;
    let work: Promise<unknown> | undefined;
    this.#say("");
    this.#emit<AwardSubmitDetail>("nx-award-submit", {
      value,
      orders,
      changes,
      followed: !changes.length,
      total,
      unassigned,
      partial,
      motive,
      scenario: this.#scenario,
      weights: { ...applied.weights },
      excluded: [...applied.excluded],
      pending,
      key,
      wait: (p: Promise<unknown>) => {
        if (work || seq !== this.#submitSeq) return;
        work = Promise.resolve(p);
        this.#setSubmitting(true);
        work.then(
          () => {
            if (seq !== this.#submitSeq) return;
            this.#dirty = false;
            this.#setSubmitting(false);
          },
          (err: unknown) => {
            if (seq !== this.#submitSeq) return;
            this.#setSubmitting(false);
            const m = err instanceof Error ? err.message : typeof err === "string" ? err : "";
            this.#say(m.trim() || L.saveError);
          },
        );
      },
    });
    return true;
  }

  // ---------------------------------------------------------------- ciclo de vida

  connectedCallback(): void {
    upgrade(this);
    if (!this.#wired) {
      this.#wired = true;
      this.addEventListener("pointerdown", (e) => this.#holdDetail(e), true);
      for (const t of ["pointerup", "pointercancel"]) this.addEventListener(t, () => this.#release(0), true);
    }
    if (!this.#built) this.#build();
    if ((!this.#advised || this.#stale) && !this.#timer && !this.#ctrl) this.#request(0);
  }

  disconnectedCallback(): void {
    // Lo que estaba en camino se suelta (y se vuelve a pedir al reconectar: `#stale`).
    if (this.#run && !this.#run.done) this.#stale = true;
    this.#dropRun();
    clearTimeout(this.#timer);
    this.#timer = 0;
    clearTimeout(this.#holdTimer);
    this.#hold = false;
    this.#busy(false);
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (old === value) return;
    if (JSON_ATTRS.has(name)) {
      try {
        (this as unknown as Record<string, unknown>)[name] = value === null ? null : JSON.parse(value);
      } catch {
        console.warn(`[nx-award] el atributo "${name}" no es JSON válido`);
      }
    } else if (name === "endpoint") this.#request(0);
    else if (name === "scenario") this.scenario = value;
    else if (name === "motive") this.motive = value;
    else if (name === "readonly" || name === "heading" || name === "adjustable") {
      if (this.#built) this.#build();
    } else if (name !== "timeout") {
      this.#f = undefined;
      if (name === "locale") this.#paintCrit();
      this.#repaint();
    }
  }

  // ---------------------------------------------------------------- interno

  #attr(name: string, v: string | null | undefined): void {
    setAttr(this, name, v);
  }
  /** El formato del locale (se guarda mientras dura un pintado: resolverlo recorre el árbol). */
  get #fmt(): NxFormat {
    return this.#f ?? nxFormat(resolveLocale(this));
  }
  #emit<T>(name: string, detail: T, cancelable = false): boolean {
    return emit(this, name, detail, cancelable);
  }
  /** Un monto: completo, o con `short` compacto desde el millón («$4,42 M»). */
  #money(n: number, short = false): string {
    const big = short && Math.abs(n) >= 1e6;
    return this.#fmt.money(big ? Number(n.toPrecision(3)) : n, { currency: this.currency || undefined }, big);
  }
  #signed(n: number, short = false): string {
    return `${n > 0 ? "+" : n < 0 ? "−" : ""}${this.#money(Math.abs(n), short)}`;
  }
  #num(n: number): string {
    return this.#fmt.number(n);
  }
  #qtyText(it: AwardItem, n: number | undefined = it.qty): string {
    if (n === undefined) return it.qtyText ?? "";
    return `${this.#num(n)}${it.unit ? ` ${it.unit}` : ""}`;
  }
  #name(id: string): string {
    return this.#supMap.get(id)?.name ?? id;
  }
  /** Un aviso junto a «Generar órdenes», también para el lector de pantalla (región siempre presente). */
  #say(text: string): void {
    if (this.#msgEl) this.#msgEl.textContent = text;
    this.#announce(text);
  }
  #announce(text: string): void {
    if (this.#live) this.#live.textContent = text;
  }
  #locked(): boolean {
    return this.readonly || this.#submitting;
  }
  #canAdvise(): boolean {
    return !this.#locked() && (!!safeEndpoint(this.endpoint) || this.adjustable);
  }
  /** Pesos nuevos sobre los de ahora. Un juego completo se lee en cualquier escala relativa
   *  (0,6/0,4 o 600/200) y queda en porcentaje de su suma; uno parcial, en la escala de los
   *  deslizadores (0–100), como si se moviera cada uno. */
  #mergeWeights(v: Record<string, number>): Record<string, number> {
    const given = new Map<string, number>();
    for (const c of this.#criteria) {
      const n = num(v[c.id]);
      if (n !== undefined && n >= 0) given.set(c.id, n);
    }
    if (given.size === this.#criteria.length) return percents(this.#criteria, Object.fromEntries(given));
    return Object.fromEntries(this.#criteria.map((c) => [c.id, given.has(c.id) ? Math.min(100, Math.round(given.get(c.id)!)) : (this.#weights[c.id] ?? this.#baseWeights[c.id] ?? 0)]));
  }

  // ---------------------------------------------------------------- estado

  #okSup = (sid: string): boolean => !this.#supMap.get(sid)?.blocked;

  /** La sugerencia sin escenario: la de la recomendación, solo con quien cotizó y es elegible. */
  #baseRec(id: string): readonly AwardSplit[] {
    const it = this.#itemMap.get(id);
    const r = this.#recs.get(id);
    return it && r?.allocations.length ? normSplits(it, r.allocations, this.#quotes, this.#okSup) : EMPTY;
  }
  /** La sugerencia de un artículo: la del escenario aplicado (entero a uno), o la de la recomendación. */
  #recOf(id: string): readonly AwardSplit[] {
    const it = this.#itemMap.get(id);
    const pick = this.#scenario ? this.#scenarios.find((s) => s.id === this.#scenario)?.picks[id] : undefined;
    if (it && pick && this.#quotes.has(qkey(id, pick)) && this.#okSup(pick)) return normSplits(it, [{ supplier: pick }], this.#quotes);
    return this.#baseRec(id);
  }
  /** Lo que eligió el comprador (con lo que se puede comprar), o `null` si sigue a la sugerencia. */
  #ownOf(id: string): AwardSplit[] | null {
    const c = this.#choices.get(id);
    const it = this.#itemMap.get(id);
    if (!c || !it) return null;
    const own = normSplits(it, c.allocations, this.#quotes);
    // Elegía a alguien cuya cotización ya no está: vuelve a la sugerencia (no a «no se adjudica»).
    return c.allocations.length && !own.length ? null : own;
  }
  /** Lo adjudicado: lo elegido o, sin elección, la sugerencia. */
  #allocOf(id: string): readonly AwardSplit[] {
    return this.#ownOf(id) ?? this.#recOf(id);
  }
  /** ¿El comprador se apartó de la sugerencia? (Sin sugerencia, la elección es libre.) */
  #changed(id: string): boolean {
    const own = this.#ownOf(id);
    const r = this.#recOf(id);
    return !!own && r.length > 0 && !sameSplits(this.#itemMap.get(id)!, own, r, this.#quotes);
  }
  #changes() {
    return changesOf(this.#items, this.#choices, (i) => this.#recOf(i), this.#quotes, (i) => this.#ownOf(i) ?? []);
  }
  /** Los proveedores con alerta a los que se les da algo del artículo. */
  #supAlerts(id: string): AwardSupplier[] {
    const out: AwardSupplier[] = [];
    for (const s of this.#allocOf(id)) {
      const sup = this.#supMap.get(s.supplier);
      if (sup?.alert) out.push(sup);
    }
    return out;
  }
  #hasAlert(id: string): boolean {
    return !!this.#flags.get(id)?.length || this.#supAlerts(id).length > 0;
  }
  #pending(id: string): boolean {
    const f = this.#flags.get(id);
    if (f?.length && !this.#seen.has(flagSig(id, f))) return true;
    return this.#supAlerts(id).some((s) => !this.#seenSup.has(`${s.id}\n${s.alert}`));
  }
  #markSeen(id: string): void {
    const f = this.#flags.get(id);
    if (f?.length) this.#seen.add(flagSig(id, f));
    for (const s of this.#supAlerts(id)) this.#seenSup.add(`${s.id}\n${s.alert}`);
  }
  #matches(id: string): boolean {
    return this.#filter === "all" || (this.#filter === "alerts" ? this.#hasAlert(id) : this.#changed(id));
  }
  /** La firma de lo adjudicado en cada artículo (para saber qué movió una recomendación). */
  #snapshot(): Map<string, string> {
    return new Map(this.#items.map((it) => [it.id, JSON.stringify(valueOf([it], (i) => this.#allocOf(i), this.#quotes))]));
  }

  /** Cambia la elección de un artículo: un reparto, o `null` para volver a la sugerencia. */
  #setChoice(id: string, splits: AwardSplit[] | null, kind: AwardChangeKind, reason?: string): boolean {
    const it = this.#itemMap.get(id);
    if (!it || this.#locked()) return false;
    const before = JSON.stringify(this.#allocOf(id));
    const had = this.#choices.get(id);
    if (splits === null) {
      if (!had) return false;
      this.#choices.delete(id);
    } else {
      const next = normSplits(it, splits, this.#quotes, this.#okSup);
      // Lo mismo que sugiere la recomendación: sigue a la sugerencia (si cambia, la sigue). Salvo
      // «no adjudicar» sin sugerencia: queda dicho, por si después llega una.
      const rec = this.#recOf(id);
      if (sameSplits(it, next, rec, this.#quotes) && (rec.length || next.length)) {
        if (!had) return false;
        this.#choices.delete(id);
      } else {
        if (had && sameSplits(it, next, this.#ownOf(id) ?? [], this.#quotes)) return false;
        this.#choices.set(id, { allocations: next, reason: reason ?? had?.reason });
      }
    }
    this.#bulk = null;
    this.#say("");
    this.#clearMoved();
    this.#dirtyRows.add(id);
    this.#detailDirty = true;
    // Con motivo obligatorio, apartarse abre el detalle: ahí está el campo.
    if (this.requireReason && this.#changed(id) && this.#open !== id) this.#setOpen(id);
    this.#queue();
    if (before !== JSON.stringify(this.#allocOf(id)) || kind === "undo") this.#changedBy(kind, id, [id]);
    return true;
  }
  /** El artículo entero a un proveedor (hasta lo que ofreció). */
  #pick(id: string, sid: string): void {
    if (!this.#quotes.has(qkey(id, sid)) || !this.#okSup(sid)) return;
    this.#setChoice(id, [{ supplier: sid }], "pick");
  }
  /** La cantidad de un proveedor en el reparto (0 lo quita). Lo que se escribe gana, hasta lo que
   *  ofreció; si pasa de lo pedido, ceden los demás (los de más a la derecha primero). */
  #setQty(id: string, sid: string, qty: number): void {
    const it = this.#itemMap.get(id);
    if (!it) return;
    const col = new Map(this.#suppliers.map((s, i) => [s.id, i]));
    const rest = this.#allocOf(id)
      .filter((s) => s.supplier !== sid)
      .map((s) => ({ supplier: s.supplier, qty: qtyOf(it, s, this.#quotes.get(qkey(id, s.supplier))) }));
    const fit = normSplits(it, qty > 0 ? [{ supplier: sid, qty }, ...rest] : rest, this.#quotes, this.#okSup);
    // En el orden de las columnas (ya caben: el orden no cambia las cantidades).
    this.#setChoice(id, fit.sort((x, y) => (col.get(x.supplier) ?? 0) - (col.get(y.supplier) ?? 0)), "split");
  }

  /** Avisa un cambio: `nx-award-change` con el estado completo y, si fue del comprador, un `change`
   *  nativo (lo cuentan `<nx-dialog>` y los formularios como cambio sin guardar). */
  #changedBy(kind: AwardChangeKind, item: string | null, items: string[]): void {
    const user = kind !== "advice";
    if (user) {
      if (this.#run && !this.#run.done) for (const id of items) this.#run.touched.add(id);
      this.#dirty = true;
      // Lo que se asignó en `value` ya no se vuelve a leer si llegan otros `items`.
      this.#valueRaw = undefined;
    }
    this.#emit<AwardChangeDetail>("nx-award-change", { kind, item, items, value: this.value, choices: this.choices, weights: this.weights, excluded: this.excluded, scenario: this.#scenario, motive: this.#motive });
    if (user) this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  #setOpen(id: string | null): void {
    if (this.#open) this.#dirtyRows.add(this.#open);
    this.#open = id;
    if (id) {
      this.#markSeen(id);
      this.#dirtyRows.add(id);
    }
    this.#detailDirty = true;
    this.#queue();
  }

  /** Muestra y abre un artículo (quitando el filtro si lo esconde) y enfoca su fila o un control del detalle. */
  #reveal(id: string, focus?: string): void {
    if (!this.#matches(id)) {
      this.#filter = "all";
      this.#full = true;
    }
    this.#setOpen(id);
    this.#flushNow();
    const el = focus ? [...(this.#detailTr?.querySelectorAll<HTMLElement>("[data-f]") ?? [])].find((x) => x.dataset.f === focus) : undefined;
    if (el) el.focus();
    else this.#focus(id, 0);
  }

  #setScenario(id: string, user: boolean): void {
    if (id === this.#scenario || (user && this.#locked())) return;
    const before = this.#snapshot();
    this.#scenario = id;
    this.#clearMoved();
    this.#repaint();
    if (user) this.#changedBy("scenario", null, this.#diff(before));
  }
  #diff(before: Map<string, string>): string[] {
    const now = this.#snapshot();
    return this.#items.filter((it) => before.get(it.id) !== now.get(it.id)).map((it) => it.id);
  }

  #toggleSup(id: string | null): void {
    this.#sup = id === this.#sup ? null : id;
    if (id && this.#sup === id) {
      const s = this.#supMap.get(id);
      if (s?.alert) this.#seenSup.add(`${s.id}\n${s.alert}`);
      this.#full = true;
    }
    this.#queue();
  }

  #toggleExclude(id: string): void {
    if (!this.#canAdvise()) return;
    if (!this.#excluded.delete(id)) this.#excluded.add(id);
    this.#repaint();
    this.#request(0);
    this.#changedBy("exclude", null, []);
  }

  /** Le adjudica al proveedor todo lo que cotizó (con un motivo en bloque) y deja deshacerlo. */
  #giveAll(sid: string): void {
    if (this.#locked() || !this.#okSup(sid)) return;
    const prev = new Map([...this.#choices].map(([k, v]) => [k, { ...v, allocations: v.allocations.map((s) => ({ ...s })) }]));
    const reason = fill(this.#labels.bulkReason, { supplier: this.#name(sid) });
    const moved: string[] = [];
    for (const it of this.#items) {
      if (!this.#quotes.has(qkey(it.id, sid))) continue;
      const next = normSplits(it, [{ supplier: sid }], this.#quotes);
      if (sameSplits(it, next, this.#allocOf(it.id), this.#quotes)) continue;
      if (sameSplits(it, next, this.#recOf(it.id), this.#quotes)) this.#choices.delete(it.id);
      else this.#choices.set(it.id, { allocations: next, reason });
      moved.push(it.id);
    }
    if (!moved.length) return;
    this.#bulk = { supplier: sid, prev, n: moved.length };
    this.#clearMoved();
    this.#repaint();
    this.#announce(fill(moved.length === 1 ? this.#labels.gaveOne : this.#labels.gaveAll, { n: moved.length, supplier: this.#name(sid) }));
    this.#changedBy("bulk", null, moved);
  }

  #revert(): void {
    if (!this.#bulk || this.#locked()) return;
    const before = this.#snapshot();
    this.#choices = this.#bulk.prev;
    this.#bulk = null;
    this.#repaint();
    this.#changedBy("revert", null, this.#diff(before));
  }

  #setSubmitting(on: boolean): void {
    if (this.#submitting === on) return;
    this.#submitting = on;
    this.toggleAttribute("data-submitting", on);
    this.#repaint();
    // Lo que se pidió mientras se guardaba (pesos o exclusiones asignados), ahora.
    if (!on && this.#stale && !this.#timer && !this.#ctrl) this.#request(0);
  }

  #holdDetail(e: Event): void {
    if (!this.#detailTr?.contains(e.target as Node)) return;
    this.#hold = true;
    // Si el puntero se suelta fuera del componente, igual se suelta.
    this.#release(1500);
  }
  #release(delay: number): void {
    if (!this.#hold) return;
    clearTimeout(this.#holdTimer);
    this.#holdTimer = window.setTimeout(() => {
      this.#hold = false;
      if (this.#detailDirty) this.#queue();
    }, delay);
  }

  #clearMoved(): void {
    if (!this.#moved.size) return;
    for (const id of this.#moved) this.#dirtyRows.add(id);
    this.#moved.clear();
  }

  // ---------------------------------------------------------------- recomendación

  #newRun(): Run {
    return {
      seq: ++this.#seq,
      params: { weights: this.weights, excluded: this.excluded },
      prev: { recs: new Map(this.#recs), flags: new Map(this.#flags) },
      before: this.#snapshot(),
      recs: new Set(),
      flagged: new Set(),
      touched: new Set(),
      scenarios: null,
      notes: [],
    };
  }

  /** Suelta una recomendación que no terminó: lo que alcanzó a aplicar se deshace (si no, la
   *  siguiente que falle «volvería» a esa mitad). */
  #dropRun(): void {
    const run = this.#run;
    this.#ctrl?.abort();
    this.#ctrl = undefined;
    if (!run || run.done) return;
    run.done = true;
    clearTimeout(run.timer);
    this.#recs = run.prev.recs;
    this.#flags = run.prev.flags;
    this.#full = true;
    this.#queue();
  }

  /** Pide la recomendación después de `delay` ms (cancela lo anterior). En `readonly`, nunca;
   *  mientras se guarda, al terminar. */
  #request(delay: number): void {
    if (this.readonly) return;
    this.#stale = true;
    this.#clearMoved();
    if (!this.isConnected || !this.#built || this.#submitting) return;
    clearTimeout(this.#timer);
    this.#busy(true);
    this.#timer = window.setTimeout(() => {
      this.#timer = 0;
      void this.#advise();
    }, delay);
  }

  #busy(on: boolean): void {
    if (this.#isBusy === on) return;
    this.#isBusy = on;
    this.toggleAttribute("data-busy", on);
    this.#table?.setAttribute("aria-busy", String(on));
    this.#queue();
  }

  async #advise(): Promise<void> {
    this.#dropRun();
    const run = (this.#run = this.#newRun());
    const { weights, excluded } = run.params;
    const url = safeEndpoint(this.endpoint);
    if (!url) {
      let answered = false;
      const respond = (evs: unknown[]) => {
        if (answered) return;
        answered = true;
        this.#applyAll(run, Array.isArray(evs) ? evs : []);
      };
      const free = this.#emit("nx-award-advise", { weights, excluded, respond }, true);
      if (answered || run.seq !== this.#seq) return;
      // Nadie recomienda: no se queda «revisando». Si la app responde después, tiene un plazo.
      if (free) {
        run.done = true;
        if (!this.#timer) {
          this.#stale = false;
          this.#busy(false);
        }
      } else
        run.timer = window.setTimeout(() => {
          if (run.done || run.seq !== this.#seq) return;
          run.failed = run.late = true;
          this.#finish(run);
        }, this.timeout);
      return;
    }
    const ctrl = (this.#ctrl = new AbortController());
    run.timer = window.setTimeout(() => {
      run.late = true;
      ctrl.abort();
    }, this.timeout);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/x-ndjson, text/event-stream", "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ weights, excluded }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await readLines(res, (line) => {
        // Otra recomendación tomó su lugar (o terminó con `done`): se suelta la conexión.
        if (ctrl.signal.aborted || run.done) return false;
        const ev = parseEvent(lineData(line));
        if (ev) this.#apply(run, ev);
        if (run.done) return false;
      });
      // Cerró sin `done` (un proxy, un servidor que se cayó): no es toda la verdad.
      if (!run.done) run.partial = true;
    } catch {
      if (ctrl.signal.aborted && !run.late) return;
      run.failed = true;
    }
    if (!ctrl.signal.aborted || run.late) this.#finish(run);
  }

  #applyAll(run: Run, evs: unknown[]): void {
    for (const x of evs) {
      const ev = cleanEvent(x);
      if (ev) this.#apply(run, ev);
    }
    this.#finish(run);
  }

  #apply(run: Run, ev: AwardEvent): void {
    if (run.seq !== this.#seq || run.done) return;
    switch (ev.type) {
      case "recommend": {
        const { type: _, ...r } = ev;
        run.recs.add(r.item);
        this.#recs.set(r.item, r);
        this.#dirtyRows.add(r.item);
        break;
      }
      case "flag": {
        const { type: _, ...f } = ev;
        // La primera alerta de un artículo en esta recomendación reemplaza las que tenía.
        if (!run.flagged.has(f.item)) run.flagged.add(f.item), this.#flags.set(f.item, []);
        this.#flags.get(f.item)!.push(f);
        // Quien tiene el artículo abierto la está viendo.
        if (f.item === this.#open) this.#markSeen(f.item);
        this.#dirtyRows.add(f.item);
        break;
      }
      case "scenario": {
        const { type: _, ...s } = ev;
        // Se aplican al terminar: a medias, la tabla mezclaría filas del escenario con filas de la IA.
        (run.scenarios ??= []).push(s);
        break;
      }
      case "note":
        run.notes.push({ message: ev.message, tone: ev.tone });
        break;
      case "error":
        run.notes.push({ message: ev.message, tone: "danger" });
        run.failed = true;
        break;
      case "done":
        return this.#finish(run);
    }
    if (this.#open && this.#dirtyRows.has(this.#open)) this.#detailDirty = true;
    this.#queue();
  }

  #finish(run: Run): void {
    if (run.done || run.seq !== this.#seq) return;
    run.done = true;
    clearTimeout(run.timer);
    this.#ctrl = undefined;
    const L = this.#labels;
    const wasAdvised = this.#advised;
    if (run.failed || run.partial) {
      // Nada a medias: vuelve la recomendación anterior, con los pesos y exclusiones que la dieron.
      this.#recs = run.prev.recs;
      this.#flags = run.prev.flags;
      // Si el comprador ya movió otra cosa (un pedido nuevo en espera), eso no se toca.
      const same = !this.#timer && JSON.stringify([this.#weights, [...this.#excluded].sort()]) === JSON.stringify([run.params.weights, [...run.params.excluded].sort()]);
      if (this.#applied && same) {
        this.#weights = { ...this.#applied.weights };
        this.#excluded = new Set(this.#applied.excluded);
        this.#paintCrit();
      }
      const why = run.late ? L.timeout : run.partial && !run.failed ? L.partialAdvice : run.notes.some((n) => n.tone === "danger") ? "" : L.error;
      this.#notes = why ? [...run.notes, { message: why, tone: "danger" }] : run.notes;
      this.#failed = true;
    } else {
      // Una recomendación completa es toda la verdad: lo que no volvió a mandar, ya no va.
      for (const id of [...this.#recs.keys()]) if (!run.recs.has(id)) this.#recs.delete(id);
      for (const id of [...this.#flags.keys()]) if (!run.flagged.has(id)) this.#flags.delete(id);
      this.#scenarios = run.scenarios ?? [];
      // El escenario elegido ya no existe: vuelve a lo mejor por artículo.
      if (this.#scenario && !this.#scenarios.some((x) => x.id === this.#scenario)) this.#scenario = "";
      this.#applied = run.params;
      this.#advised = true;
      this.#notes = run.notes;
      this.#failed = false;
    }
    if (this.#open) this.#markSeen(this.#open);
    this.#full = true;
    if (!this.#timer) {
      this.#stale = false;
      this.#busy(false);
    }
    const now = this.#snapshot();
    const moved = this.#items.filter((it) => !run.touched.has(it.id) && run.before.get(it.id) !== now.get(it.id)).map((it) => it.id);
    if (moved.length && wasAdvised) {
      this.#moved = new Set(moved);
      this.#announce(fill(moved.length === 1 ? L.movedOne : L.movedMany, { n: moved.length }));
    }
    this.#queue();
    if (moved.length) this.#changedBy("advice", moved.length === 1 ? moved[0] : null, moved);
  }

  // ---------------------------------------------------------------- pintado

  #restructure(): void {
    this.#structure = true;
    this.#queue();
  }
  #repaint(): void {
    this.#full = true;
    this.#queue();
  }
  /** Varios cambios seguidos (un trozo del stream, una ráfaga de clics) se pintan una sola vez. */
  #queue(): void {
    if (this.#queued || !this.#built) return;
    this.#queued = true;
    queueMicrotask(() => {
      if (!this.#queued) return;
      this.#queued = false;
      this.#flush();
    });
  }
  #flushNow(): void {
    this.#queued = false;
    this.#flush();
  }

  #flush(): void {
    if (!this.#built) return;
    this.#f = nxFormat(resolveLocale(this));
    try {
      this.#paint();
    } finally {
      this.#f = undefined;
    }
  }
  #paint(): void {
    const a = document.activeElement as HTMLElement | null;
    const was = this.#refocus ?? (a && this.#pos.get(a)) ?? null;
    this.#refocus = null;
    if (this.#structure) {
      this.#structure = false;
      this.#buildTable();
      this.#detailDirty = true;
    } else if (this.#full) {
      for (const ref of this.#rows.values()) this.#paintRow(ref);
      this.#detailDirty = true;
    } else
      for (const id of this.#dirtyRows) {
        const ref = this.#rows.get(id);
        if (ref) this.#paintRow(ref);
      }
    this.#full = false;
    this.#dirtyRows.clear();
    this.#paintHeads();
    this.#paintGroups();
    this.#paintFoot();
    this.#paintSummary();
    this.#paintTools();
    this.#paintSubmit();
    this.#keepFocus(this.#notesEl, () => this.#paintNotes(), () => this.#notesEl!.focus());
    this.#keepFocus(this.#supEl, () => this.#paintSup(), () => {
      if (!(this.#sup && this.#focusKey("sup:all"))) this.#focus("", 1 + this.#suppliers.findIndex((s) => s.id === this.#lastSup));
    });
    // Con un clic en curso dentro del detalle, se repinta al terminar (si no, el botón que se
    // pulsa desaparece entre el `pointerdown` y el `click`: el `change` de un campo lo repinta).
    if (this.#detailDirty && !this.#hold) {
      this.#detailDirty = false;
      const id = this.#open;
      this.#keepFocus(this.#detailTr, () => this.#paintDetail(), () => id && this.#focusNear({ r: id, c: 0 }));
    }
    this.#syncTab();
    // La celda con el foco se rehízo o quedó oculta (filtro): el foco pasa a la más cercana.
    if (was && (!a?.isConnected || !this.contains(a) || a.closest("tr")?.hidden)) this.#focusNear(was);
  }

  /** Pinta una sección solo si cambió lo que muestra (`sig`). */
  #once(key: string, sig: string, paint: () => void): void {
    if (this.#sigs.get(key) === sig) return;
    this.#sigs.set(key, sig);
    paint();
  }
  #focusKey(key: string): boolean {
    const el = [...this.querySelectorAll<HTMLElement>("[data-f]")].find((x) => x.dataset.f === key);
    el?.focus();
    return !!el;
  }

  /** Repinta y devuelve el foco (y el cursor de un campo) al control con la misma `data-f`. */
  #keepFocus(box: HTMLElement | undefined, paint: () => void, fallback?: () => void): void {
    const a = document.activeElement as HTMLElement | null;
    const inside = !!(a && box?.contains(a));
    const key = inside ? a!.dataset.f : undefined;
    const sel = inside && a instanceof HTMLInputElement ? [a.selectionStart, a.selectionEnd] : null;
    paint();
    if (!inside) return;
    if (a!.isConnected && this.contains(a)) {
      // El mismo campo, movido a un detalle nuevo: sacarlo del DOM le quitó el foco.
      if (document.activeElement !== a) {
        a!.focus();
        if (sel && a instanceof HTMLInputElement && sel[0] !== null) a.setSelectionRange(sel[0], sel[1]);
      }
      return;
    }
    const el = key ? [...this.querySelectorAll<HTMLElement>("[data-f]")].find((x) => x.dataset.f === key) : undefined;
    if (!el || el.closest("[hidden]") || (el as HTMLButtonElement).disabled) return fallback?.();
    el.focus();
    if (sel && el instanceof HTMLInputElement && sel[0] !== null) el.setSelectionRange(sel[0], sel[1]);
  }

  #build(): void {
    this.#refocus = this.#pos.get(document.activeElement as Element) ?? this.#refocus;
    this.#built = true;
    this.#sigs.clear();
    this.#detailSig = "";
    this.#inputs.clear();
    this.#inputsItem = "";
    const L = this.#labels;
    const id = this.#uid;
    const ro = this.readonly;
    this.#title = h("h2", { class: "nx-award__title", id: `${id}-t` }, this.heading);
    this.#title.hidden = !this.heading;
    this.#scenarioSel = h("select", { class: "nx-award__select" });
    this.#scenarioSel.addEventListener("change", () => this.#setScenario(this.#scenarioSel!.value, true));
    this.#scenarioField = h("label", { class: "nx-award__field" }, h("span", null, L.scenario), this.#scenarioSel);
    this.#scenarioSig = "";
    // Ver y filtrar no es cambiar datos: `data-nx-ephemeral` (no cuenta como cambio sin guardar).
    this.#lensSel = h("select", { class: "nx-award__select", "data-nx-ephemeral": "" }, ...LENSES.map((k) => h("option", { value: k }, L[LENS_LABEL[k]])));
    this.#lensSel.addEventListener("change", () => (this.lens = this.#lensSel!.value as AwardLens));
    this.#filterBtns = FILTERS.map((k) => {
      const b = h("button", { type: "button", class: "nx-award__segbtn", "aria-pressed": "false" });
      b.addEventListener("click", () => (this.filter = k));
      return b;
    });
    this.#critBtn = h("button", { type: "button", class: "nx-award__btn", "aria-expanded": "false", "aria-controls": `${id}-crit` }, L.criteria);
    this.#critBtn.addEventListener("click", () => {
      this.#crit!.hidden = !this.#crit!.hidden;
      this.#critBtn!.setAttribute("aria-expanded", String(!this.#crit!.hidden));
    });
    this.#crit = h("div", { class: "nx-award__crit", id: `${id}-crit`, role: "group", "aria-label": L.criteria });
    this.#crit.hidden = true;
    const s = {
      total: h("span"),
      totalSub: h("small"),
      delta: h("span"),
      deltaSub: h("small"),
      orders: h("span"),
      pending: h("span"),
      pendingSub: h("small"),
      next: h("button", { type: "button", class: "nx-award__next" }, L.next),
    };
    s.next.addEventListener("click", () => this.next(1));
    this.#sum = s;
    const stat = (label: string, ...kids: Node[]) => h("div", null, h("dt", null, label), h("dd", null, ...kids));
    this.#notesEl = h("div", { class: "nx-award__notes", role: "status", tabindex: "-1" });
    this.#live = h("span", { class: "nx-award__vh", role: "status" });
    this.#supEl = h("div", { class: "nx-award__sup", id: `${id}-sup` });
    this.#supEl.hidden = true;
    this.#table = h("table", { class: "nx-award__table", role: "grid", "aria-labelledby": this.heading ? `${id}-t` : null, "aria-label": this.heading ? null : L.table, "aria-readonly": ro ? "true" : null, "aria-multiselectable": "true", "aria-busy": String(this.#isBusy) });
    this.#table.addEventListener("click", (e) => this.#onClick(e));
    this.#table.addEventListener("keydown", (e) => this.#onKey(e));
    this.#table.addEventListener("focusin", (e) => {
      const p = this.#pos.get(e.target as Element);
      if (p) (this.#active = p), this.#setTab(e.target as HTMLElement);
    });
    this.#datalist = h("datalist", { id: `${id}-r` });
    this.#motiveEl = h("textarea", { class: "nx-award__mtext", id: `${id}-m`, rows: "2", maxlength: "500", "data-f": "motive" });
    this.#motiveEl.value = this.#motive;
    this.#motiveEl.readOnly = ro;
    this.#motiveEl.addEventListener("input", () => (this.#motive = this.#motiveEl!.value.slice(0, 500)));
    this.#motiveEl.addEventListener("change", () => {
      this.#say("");
      this.#changedBy("motive", null, []);
    });
    this.#motiveBox = h("div", { class: "nx-award__motive" }, h("label", { for: `${id}-m` }, L.motive), this.#motiveEl);
    this.#msgEl = h("p", { class: "nx-award__msg" });
    this.#submitBtn = h("button", { type: "button", class: "nx-award__btn nx-award__btn--primary" }, L.submit);
    this.#submitBtn.addEventListener("click", () => this.submit());
    this.#submitBtn.hidden = ro;
    this.replaceChildren(
      h(
        "div",
        { class: "nx-award__head" },
        this.#title,
        h("div", { class: "nx-award__tools" }, this.#scenarioField, h("label", { class: "nx-award__field" }, h("span", null, L.lens), this.#lensSel), h("div", { class: "nx-award__seg", role: "group", "aria-label": L.show, "data-nx-ephemeral": "" }, ...this.#filterBtns), this.#critBtn),
      ),
      this.#crit,
      h("dl", { class: "nx-award__sum" }, stat(L.total, s.total, s.totalSub), stat(L.vsAi, s.delta, s.deltaSub), stat(L.orders, s.orders), stat(L.pending, s.pending, s.pendingSub, s.next)),
      this.#notesEl,
      this.#supEl,
      h("div", { class: "nx-award__scroll" }, this.#table),
      h("div", { class: "nx-award__foot" }, this.#motiveBox, h("div", { class: "nx-award__send" }, this.#msgEl, this.#submitBtn)),
      this.#datalist,
      this.#live,
    );
    this.#buildCrit();
    this.#paintReasons();
    this.#tabEl = undefined;
    this.#structure = true;
    this.#queue();
  }

  // ---------------------------------------------------------------- tabla

  #buildTable(): void {
    const L = this.#labels;
    const n = this.#suppliers.length;
    this.#rows.clear();
    this.#groups = [];
    this.#detailTr = undefined;
    this.#detailSig = "";
    for (const k of ["heads", "groups", "foot"]) this.#sigs.delete(k);
    this.#pos = new WeakMap();
    this.#cellSig = new WeakMap();
    this.#table!.style.setProperty("--n", String(n));
    this.#corner = h("th", { scope: "col", class: "nx-award__corner", tabindex: "-1" }, L.item);
    this.#pos.set(this.#corner, { r: "", c: 0 });
    this.#heads = this.#suppliers.map((s, j) => {
      const th = h("th", { scope: "col", class: "nx-award__shead", tabindex: "-1", "aria-controls": `${this.#uid}-sup`, "data-supplier": s.id });
      this.#pos.set(th, { r: "", c: j + 1 });
      return th;
    });
    const names = [...new Set(this.#items.map((i) => i.group ?? ""))];
    const grouped = names.some(Boolean);
    const bodies = names.map((name) => {
      const tb = h("tbody");
      let g: GroupRef | undefined;
      if (grouped) {
        const th = h("th", { colspan: n + 1, scope: "rowgroup" });
        g = { name, rows: [], th, tr: h("tr", { class: "nx-award__group" }, th) };
        this.#groups.push(g);
        tb.append(g.tr);
      }
      for (const it of this.#items) {
        if ((it.group ?? "") !== name) continue;
        const th = h("th", { scope: "row", class: "nx-award__item", tabindex: "-1", "aria-expanded": "false" });
        const cells = this.#suppliers.map(() => h("td", { class: "nx-award__cell", tabindex: "-1" }));
        const ref: RowRef = { item: it, tr: h("tr", { class: "nx-award__row", "data-item": it.id }, th, ...cells), th, cells };
        this.#pos.set(th, { r: it.id, c: 0 });
        cells.forEach((td, j) => this.#pos.set(td, { r: it.id, c: j + 1 }));
        this.#rows.set(it.id, ref);
        g?.rows.push(ref);
        tb.append(ref.tr);
      }
      return tb;
    });
    this.#footTotal = h("span", { class: "nx-award__ftotal" });
    this.#footCells = this.#suppliers.map(() => h("td"));
    this.#table!.replaceChildren(
      h("colgroup", null, h("col", { class: "nx-award__c0" }), ...this.#suppliers.map(() => h("col"))),
      h("thead", null, h("tr", null, this.#corner, ...this.#heads)),
      ...bodies,
      h("tfoot", null, h("tr", null, h("th", { scope: "row" }, h("span", null, L.awarded), this.#footTotal), ...this.#footCells)),
    );
    this.#tabEl = undefined;
    for (const ref of this.#rows.values()) this.#paintRow(ref);
  }

  #cellText(it: AwardItem, q: AwardQuote): string {
    switch (this.lens) {
      case "total":
        return this.#money(partTotal(it, { supplier: q.supplier }, q), true);
      case "lead":
        return q.leadTime === undefined ? "—" : fill(this.#labels.days, { n: this.#num(q.leadTime) });
      case "score": {
        const r = this.#recs.get(it.id)?.ranking.find((x) => x.supplier === q.supplier);
        return r ? this.#num(Math.round(r.score)) : "—";
      }
      default:
        return this.#num(q.price);
    }
  }

  #paintRow(ref: RowRef): void {
    const L = this.#labels;
    const { item, th, tr, cells } = ref;
    const id = item.id;
    const rec = this.#recOf(id);
    const recSet = new Set(rec.map((s) => s.supplier));
    const own = this.#ownOf(id);
    const alloc = own ?? rec;
    const chosen = new Map(alloc.map((s) => [s.supplier, qtyOf(item, s, this.#quotes.get(qkey(id, s.supplier)))]));
    const changed = this.#changed(id);
    const flags = this.#flags.get(id) ?? [];
    const sups = this.#supAlerts(id);
    const alerts = flags.length + sups.length;
    const open = this.#open === id;
    const quoted = this.#suppliers.some((s) => this.#quotes.has(qkey(id, s.id)));
    const short = shortOf(item, alloc, this.#quotes);
    const split = alloc.length > 1 || short > 0;
    tr.hidden = !this.#matches(id);
    tr.toggleAttribute("data-changed", changed);
    tr.toggleAttribute("data-open", open);
    tr.toggleAttribute("data-moved", this.#moved.has(id));
    th.setAttribute("aria-expanded", String(open));
    th.title = item.name;
    const delta = changed ? amountOf(item, alloc, this.#quotes) - amountOf(item, rec, this.#quotes) : 0;
    const sub: (Node | string)[] = [this.#qtyText(item) || "—"];
    if (alloc.length) sub.push(` · ${this.#money(amountOf(item, alloc, this.#quotes), true)}`);
    else if (own) sub.push(h("span", { class: "nx-award__chg" }, ` · ${L.skipped}`));
    else if (!quoted) sub.push(` · ${L.nobody}`);
    if (short > 0) sub.push(h("span", { class: "nx-award__short" }, ` · ${fill(L.short, { n: this.#num(short) })}`));
    if (changed && alloc.length) sub.push(h("span", { class: "nx-award__chg", "data-tone": delta > 0 ? "up" : delta < 0 ? "down" : "" }, ` · ${delta ? this.#signed(delta, true) : L.changed}`), delta ? vh(`, ${L.changed}`) : "");
    th.replaceChildren(
      h("span", { class: "nx-award__iname" }, alerts ? glyph(WARN, this.#pending(id) ? "nx-award__warn" : "nx-award__warn is-seen") : "", h("span", { class: "nx-award__itext" }, item.name), glyph("chevron", "nx-award__chev")),
      h("span", { class: "nx-award__isub" }, ...sub),
      alerts ? vh(`. ${[...flags.map((f) => f.message), ...sups.map((s) => `${s.name}: ${s.alert}`)].join(". ")}`) : "",
    );
    const lens = this.lens;
    this.#suppliers.forEach((s, j) => {
      const cell = cells[j];
      const quote = this.#quotes.get(qkey(id, s.id));
      const isRec = !!quote && recSet.has(s.id);
      const isChosen = !!quote && chosen.has(s.id);
      const flag = flags.find((f) => f.supplier === s.id);
      const blocked = !!s.blocked;
      const excluded = this.#excluded.has(s.id);
      const cq = isChosen && split ? chosen.get(s.id) : undefined;
      const part = quote?.offered !== undefined && item.qty !== undefined && quote.offered < item.qty ? quote.offered : undefined;
      const text = quote ? this.#cellText(item, quote) : "—";
      // Una celda que no cambió no se rehace (con 1.000 celdas, un filtro no recrea 5.000 nodos).
      const sig = [text, isRec, isChosen, flag?.tone, flag?.message, blocked, excluded, cq, part, lens, L.noQuote, L.suggested, L.blocked].join("|");
      if (this.#cellSig.get(cell) === sig) return;
      this.#cellSig.set(cell, sig);
      cell.toggleAttribute("data-rec", isRec);
      cell.toggleAttribute("data-chosen", isChosen);
      cell.toggleAttribute("data-none", !quote);
      cell.toggleAttribute("data-excluded", excluded);
      cell.toggleAttribute("data-blocked", blocked && !!quote);
      if (flag) cell.dataset.tone = flag.tone;
      else delete cell.dataset.tone;
      cell.setAttribute("aria-selected", String(isChosen));
      if (quote && !blocked) cell.removeAttribute("aria-disabled");
      else cell.setAttribute("aria-disabled", "true");
      cell.title = blocked && quote ? `${L.blocked}: ${s.blocked}` : (flag?.message ?? (quote?.original ? `${L.quoted}: ${quote.original}` : ""));
      const small = cq !== undefined ? this.#qtyText(item, cq) : part !== undefined ? `≤ ${this.#num(part)}` : "";
      cell.replaceChildren(
        flag ? glyph(WARN, "nx-award__cwarn") : "",
        quote ? h("span", { class: "nx-award__v" }, text) : h("span", { class: "nx-award__v", "aria-hidden": "true" }, "—"),
        small ? h("small", { class: "nx-award__q", "aria-hidden": "true" }, small) : "",
        isRec ? glyph(SPARK, "nx-award__spark") : "",
        quote ? "" : vh(L.noQuote),
        cq !== undefined ? vh(`, ${this.#qtyText(item, cq)}`) : part !== undefined ? vh(`. ${fill(L.offers, { qty: this.#qtyText(item, part) })}`) : "",
        isRec ? vh(`, ${L.suggested}`) : "",
        blocked && quote ? vh(`. ${L.blocked}: ${s.blocked}`) : "",
        flag ? vh(`. ${flag.message}`) : "",
      );
    });
  }

  #paintHeads(): void {
    const L = this.#labels;
    const sig = JSON.stringify([this.#suppliers, [...this.#excluded], this.#sup, L.excluded, L.blocked, this.#heads.length]);
    this.#once("heads", sig, () => this.#suppliers.forEach((s, j) => {
      const th = this.#heads[j];
      if (!th) return;
      const ex = this.#excluded.has(s.id);
      th.toggleAttribute("data-excluded", ex);
      th.toggleAttribute("data-blocked", !!s.blocked);
      th.setAttribute("aria-expanded", String(this.#sup === s.id));
      th.title = [s.blocked && `${L.blocked}: ${s.blocked}`, s.alert].filter(Boolean).join(" · ");
      th.replaceChildren(
        h("span", { class: "nx-award__sname" }, s.blocked ? glyph(BAN, "nx-award__ban") : s.alert ? glyph(WARN, "nx-award__warn") : "", h("span", null, s.name)),
        h("span", { class: "nx-award__sdetail" }, s.blocked ? L.blocked : ex ? L.excluded : (s.detail ?? "")),
        s.blocked ? vh(`. ${L.blocked}: ${s.blocked}`) : "",
        s.alert ? vh(`. ${s.alert}`) : "",
      );
    }));
  }

  #paintGroups(): void {
    const L = this.#labels;
    const view = this.#groups.map((g) => {
      let sub = 0;
      for (const r of g.rows) sub += amountOf(r.item, this.#allocOf(r.item.id), this.#quotes);
      return [g.rows.some((r) => !r.tr.hidden), ` · ${fill(L.count, { n: g.rows.length })} · ${this.#money(sub, true)}`] as const;
    });
    this.#once("groups", JSON.stringify(view), () =>
      this.#groups.forEach((g, i) => {
        g.tr.hidden = !view[i][0];
        g.th.replaceChildren(h("span", null, g.name || "—", h("small", null, view[i][1])));
      }),
    );
  }

  #paintFoot(): void {
    const L = this.#labels;
    const by = new Map<string, { n: number; t: number }>();
    let total = 0;
    for (const it of this.#items)
      for (const s of this.#allocOf(it.id)) {
        const t = partTotal(it, s, this.#quotes.get(qkey(it.id, s.supplier)));
        const o = by.get(s.supplier) ?? { n: 0, t: 0 };
        o.n++;
        o.t += t;
        by.set(s.supplier, o);
        total += t;
      }
    const view = this.#suppliers.map((s) => {
      const o = by.get(s.id);
      return o ? [fill(L.count, { n: o.n }), this.#money(o.t, true), this.#money(o.t)] : null;
    });
    this.#once("foot", JSON.stringify([this.#money(total, true), view]), () => {
      if (this.#footTotal) {
        this.#footTotal.textContent = this.#money(total, true);
        this.#footTotal.title = this.#money(total);
      }
      view.forEach((v, j) => this.#footCells[j]?.replaceChildren(...(v ? [h("span", null, v[0]), h("small", { title: v[2] }, v[1])] : [h("small", null, "—")])));
    });
  }

  #paintSummary(): void {
    const s = this.#sum!;
    const L = this.#labels;
    const alloc = (id: string) => this.#allocOf(id);
    const { total, suppliers } = totalOf(this.#items, alloc, this.#quotes);
    const { unassigned, partial } = buildOrders(this.#items, this.#suppliers, alloc, this.#quotes);
    // El total exacto: es la cifra que el comprador firma.
    s.total.textContent = this.#money(total);
    s.totalSub.textContent = [unassigned.length && fill(L.unassigned, { n: unassigned.length }), partial.length && fill(L.partial, { n: partial.length })].filter(Boolean).join(" · ");
    const ch = this.#changes();
    const d = ch.reduce((a, c) => a + c.delta, 0);
    s.delta.textContent = ch.length ? this.#signed(d) : L.same;
    s.delta.dataset.tone = ch.length && d ? (d > 0 ? "up" : "down") : "";
    s.deltaSub.textContent = ch.length ? fill(ch.length === 1 ? L.changeOne : L.changeMany, { n: ch.length }) : "";
    s.orders.textContent = fill(suppliers === 1 ? L.supplierOne : L.supplierMany, { n: suppliers });
    let alerts = 0;
    let pending = 0;
    for (const it of this.#items) {
      if (!this.#hasAlert(it.id)) continue;
      alerts++;
      if (this.#pending(it.id)) pending++;
    }
    s.pending.textContent = String(pending);
    s.pending.dataset.tone = pending ? "warn" : "";
    s.pendingSub.textContent = !alerts ? L.noAlerts : pending ? fill(L.pendingOf, { total: alerts }) : L.reviewed;
    s.next.hidden = !alerts;
  }

  #paintTools(): void {
    const L = this.#labels;
    this.#title!.textContent = this.heading;
    this.#title!.hidden = !this.heading;
    // Escenarios: cada uno con cuántas órdenes da y lo que cuesta frente a lo mejor por artículo.
    const field = this.#scenarioField!;
    field.hidden = !this.#scenarios.length;
    this.#scenarioSel!.disabled = this.#locked();
    if (this.#scenarios.length) {
      const base = (id: string) => this.#baseRec(id);
      const bt = totalOf(this.#items, base, this.#quotes);
      const texts = [
        `${L.best} · ${fill(bt.suppliers === 1 ? L.supplierOne : L.supplierMany, { n: bt.suppliers })}`,
        ...this.#scenarios.map((sc) => {
          const v = (id: string) => {
            const p = sc.picks[id];
            const it = this.#itemMap.get(id)!;
            return p && this.#quotes.has(qkey(id, p)) && this.#okSup(p) ? normSplits(it, [{ supplier: p }], this.#quotes) : base(id);
          };
          const t = totalOf(this.#items, v, this.#quotes);
          const d = bt.total ? (t.total - bt.total) / bt.total : 0;
          return `${sc.label} · ${fill(t.suppliers === 1 ? L.supplierOne : L.supplierMany, { n: t.suppliers })}${Math.abs(d) >= 0.0005 ? ` · ${pct(d, this.#fmt.locale, true)}` : ""}`;
        }),
      ];
      // Solo se recrean las opciones si cambian: recrearlas cierra la lista abierta.
      const sig = JSON.stringify(texts);
      if (sig !== this.#scenarioSig) {
        this.#scenarioSig = sig;
        this.#scenarioSel!.replaceChildren(...texts.map((t, i) => h("option", { value: i ? this.#scenarios[i - 1].id : "" }, t)));
      }
      this.#scenarioSel!.value = this.#scenarios.some((s) => s.id === this.#scenario) ? this.#scenario : "";
    }
    const quotes = [...this.#quotes.values()];
    const lens = this.lens;
    for (const opt of this.#lensSel!.options) opt.hidden = (opt.value === "lead" && !quotes.some((q) => q.leadTime !== undefined)) || (opt.value === "score" && ![...this.#recs.values()].some((r) => r.ranking.length));
    this.#lensSel!.value = lens;
    let alerts = 0;
    let changed = 0;
    for (const it of this.#items) {
      if (this.#hasAlert(it.id)) alerts++;
      if (this.#changed(it.id)) changed++;
    }
    const counts = { all: this.#items.length, alerts, changed };
    this.#filterBtns.forEach((b, i) => {
      const k = FILTERS[i];
      b.setAttribute("aria-pressed", String(this.#filter === k));
      const sig = `${L[FILTER_LABEL[k]]}|${counts[k]}`;
      if (b.dataset.sig === sig) return;
      b.dataset.sig = sig;
      b.replaceChildren(L[FILTER_LABEL[k]], h("span", { class: "nx-award__n" }, this.#num(counts[k])));
    });
    const crit = !!this.#criteria.length && this.#canAdvise();
    this.#critBtn!.hidden = !crit;
    if (!crit) this.#crit!.hidden = true;
  }

  #paintSubmit(): void {
    const L = this.#labels;
    const btn = this.#submitBtn!;
    btn.disabled = this.#submitting;
    btn.textContent = this.#submitting ? L.submitting : L.submit;
    btn.setAttribute("aria-busy", String(this.#submitting));
    const ro = this.readonly;
    this.#motiveEl!.readOnly = ro || this.#submitting;
    this.#motiveEl!.required = this.requireMotive;
    this.#motiveBox!.hidden = ro && !this.#motive.trim();
    for (const { range } of this.#critRows.values()) range.disabled = this.#locked();
    if (document.activeElement !== this.#motiveEl && this.#motiveEl!.value !== this.#motive) this.#motiveEl!.value = this.#motive;
  }

  #paintNotes(): void {
    const L = this.#labels;
    // El aviso de «revisando» es un nodo que persiste mientras dura: su pulso no se reinicia.
    this.#once("notes", JSON.stringify([this.#isBusy, this.#failed, this.#notes, L.advising, L.retry]), () => this.#notesNow());
  }
  #notesNow(): void {
    const L = this.#labels;
    const out: HTMLElement[] = [];
    if (this.#isBusy) out.push(h("p", { class: "nx-award__note", "data-tone": "busy" }, glyph(SPARK), h("span", null, L.advising)));
    for (const n of this.#notes) {
      const p = h("p", { class: "nx-award__note", "data-tone": n.tone }, n.tone === "neutral" ? "" : glyph(WARN), h("span", null, n.message));
      if (n.tone === "danger" && this.#failed && !this.#isBusy && !this.readonly) {
        const retry = h("button", { type: "button", class: "nx-award__next", "data-f": "retry" }, L.retry);
        retry.addEventListener("click", () => this.refresh());
        p.append(retry);
      }
      out.push(p);
    }
    this.#notesEl!.replaceChildren(...out);
  }

  #paintSup(): void {
    const el = this.#supEl!;
    const s = this.#suppliers.find((x) => x.id === this.#sup);
    if (!s)
      return this.#once("sup", "", () => {
        el.hidden = true;
        el.replaceChildren();
      });
    this.#lastSup = s.id;
    const L = this.#labels;
    const locked = this.#locked();
    const quoted = this.#items.filter((i) => this.#quotes.has(qkey(i.id, s.id)));
    let awarded = 0;
    let total = 0;
    for (const it of this.#items) {
      const part = this.#allocOf(it.id).find((x) => x.supplier === s.id);
      if (!part) continue;
      awarded++;
      total += partTotal(it, part, this.#quotes.get(qkey(it.id, s.id)));
    }
    const ex = this.#excluded.has(s.id);
    const can = this.#canAdvise();
    const btn = (text: string, key: string, run: () => void, g?: string) => {
      const b = h("button", { type: "button", class: g ? "nx-award__x" : "nx-award__btn", "data-f": `sup:${key}`, "aria-label": g ? text : null, title: g ? text : null }, g ? glyph(g) : text);
      b.addEventListener("click", run);
      return b;
    };
    const sig = JSON.stringify([s, quoted.length, awarded, this.#money(total, true), ex, locked, can, this.#bulk?.supplier, this.#bulk?.n, L]);
    this.#once("sup", sig, () => {
      el.hidden = false;
      el.replaceChildren(
        h("strong", null, s.name),
        s.detail ? h("span", null, s.detail) : "",
        h("span", null, fill(L.supplierStats, { quoted: quoted.length, awarded, total: this.#money(total, true) })),
        s.blocked ? h("span", { class: "nx-award__supalert", "data-tone": "danger" }, glyph(BAN), `${L.blocked}: ${s.blocked}`) : "",
        s.alert ? h("span", { class: "nx-award__supalert" }, glyph(WARN), s.alert) : "",
        h(
          "span",
          { class: "nx-award__supacts" },
          !can ? "" : btn(ex ? L.include : L.exclude, "ex", () => this.#toggleExclude(s.id)),
          locked || s.blocked || !quoted.length ? "" : btn(L.giveAll, "all", () => this.#giveAll(s.id)),
          btn(L.close, "close", () => this.#toggleSup(null), CLOSE),
        ),
        this.#bulk?.supplier === s.id && !locked ? h("p", { class: "nx-award__bulk" }, fill(this.#bulk.n === 1 ? L.gaveOne : L.gaveAll, { n: this.#bulk.n, supplier: s.name }), btn(L.revert, "rev", () => this.#revert())) : "",
      );
    });
  }

  #paintDetail(): void {
    const ref = this.#open ? this.#rows.get(this.#open) : undefined;
    const id = ref && !ref.tr.hidden ? ref.item.id : "";
    if (id !== this.#inputsItem) {
      this.#inputs.clear();
      this.#inputsItem = id;
    }
    // Lo que muestra el detalle: si no cambió (una recomendación que no lo toca), no se recrea.
    const sig = id ? JSON.stringify([id, this.#recs.get(id), this.#flags.get(id), this.#recOf(id), this.#ownOf(id), this.#supAlerts(id).map((s) => s.id), this.#weights, this.#criteria, [...this.#excluded], this.#locked(), this.#canAdvise(), this.currency, this.#fmt.locale, this.#labels]) : "";
    if (sig && sig === this.#detailSig && this.#detailTr?.isConnected && this.#detailTr.previousElementSibling === ref!.tr) {
      // El motivo pudo cambiar por fuera (`choices`): el campo, si no se está escribiendo.
      const r = this.#inputs.get("reason");
      if (r && document.activeElement !== r) r.value = this.#choices.get(id)?.reason ?? "";
      return;
    }
    this.#detailSig = sig;
    this.#detailTr?.remove();
    this.#detailTr = undefined;
    if (!ref || !id) return;
    this.#detailTr = h("tr", { class: "nx-award__drow" }, h("td", { colspan: this.#suppliers.length + 1 }, this.#detail(ref.item)));
    ref.tr.after(this.#detailTr);
  }

  /** Un campo del detalle que se reusa mientras sea el mismo artículo: lo escrito no se pierde. */
  #input(key: string, make: () => HTMLInputElement, value: string): HTMLInputElement {
    let el = this.#inputs.get(key);
    if (!el) this.#inputs.set(key, (el = make()));
    if (document.activeElement !== el) el.value = value;
    return el;
  }

  #detail(it: AwardItem): HTMLElement {
    const L = this.#labels;
    const id = it.id;
    const locked = this.#locked();
    const rec = this.#recs.get(id);
    const r = this.#recOf(id);
    const own = this.#ownOf(id);
    const alloc = own ?? r;
    const mine = new Map(alloc.map((s) => [s.supplier, qtyOf(it, s, this.#quotes.get(qkey(id, s.supplier)))]));
    const recSet = new Set(r.map((s) => s.supplier));
    const flags = this.#flags.get(id) ?? [];
    const share = shares(this.#criteria, this.#weights);
    const rank = new Map((rec?.ranking ?? []).map((x, i) => [x.supplier, i]));
    const can = splittable(it) && !locked;
    const quoted = this.#suppliers
      .filter((s) => this.#quotes.has(qkey(id, s.id)))
      .sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9) || this.#quotes.get(qkey(id, a.id))!.price - this.#quotes.get(qkey(id, b.id))!.price);
    const parts: (Node | string)[] = [h("p", { class: "nx-award__dhead" }, h("strong", null, it.name), h("span", null, [it.code, this.#qtyText(it)].filter(Boolean).join(" · ")))];
    const alerts = [...flags.map((f) => ({ tone: f.tone, text: f.supplier ? `${this.#name(f.supplier)}: ${f.message}` : f.message })), ...this.#supAlerts(id).map((s) => ({ tone: "warning" as const, text: `${s.name}: ${s.alert}` }))];
    if (alerts.length) parts.push(h("ul", { class: "nx-award__flags" }, ...alerts.map((f) => h("li", { "data-tone": f.tone }, glyph(WARN), h("span", null, f.text)))));
    if (rec?.reason) parts.push(h("p", { class: "nx-award__ai" }, glyph(SPARK), h("span", null, rec.reason)));
    const bars = !!rec?.ranking.some((x) => contributions(x, this.#criteria, share));
    if (bars) parts.push(h("ul", { class: "nx-award__legend" }, ...this.#criteria.map((cr, k) => h("li", null, h("i", { "data-k": Math.min(k, 4) }), `${cr.label} ${pct(share[cr.id], this.#fmt.locale)}`))));
    const lines = quoted.map((s) => {
      const q = this.#quotes.get(qkey(id, s.id))!;
      const rk = rec?.ranking.find((x) => x.supplier === s.id);
      const isRec = recSet.has(s.id);
      const isChosen = mine.has(s.id);
      const blocked = !!s.blocked;
      const pick = h(
        "button",
        { type: "button", class: "nx-award__pick", "aria-pressed": String(isChosen), "data-f": `pick:${s.id}`, disabled: locked || blocked, "aria-label": `${fill(L.pick, { name: s.name })}${isRec ? `, ${L.suggested}` : ""}` },
        isChosen ? glyph(CHECK) : isRec ? glyph(SPARK, "nx-award__spark") : h("i"),
        h("span", null, s.name),
      );
      pick.addEventListener("click", () => this.#pick(id, s.id));
      const bar = h("span", { class: "nx-award__bar", "aria-hidden": "true" });
      if (rk) {
        const segs = contributions(rk, this.#criteria, share) ?? [Math.max(0, Math.min(100, rk.score))];
        segs.forEach((w, k) => {
          const seg = h("span", { "data-k": Math.min(k, 4) });
          seg.style.inlineSize = `${Math.round(w * 100) / 100}%`;
          bar.append(seg);
        });
      }
      const flag = flags.find((f) => f.supplier === s.id);
      const lead = q.leadTime === undefined ? "" : ` · ${fill(L.days, { n: this.#num(q.leadTime) })}`;
      const partial = q.offered !== undefined && it.qty !== undefined && q.offered < it.qty;
      const sub = [blocked && `${L.blocked}: ${s.blocked}`, partial && fill(L.offers, { qty: this.#qtyText(it, q.offered) }), q.original && `${L.quoted}: ${q.original}`, q.note, flag?.message, this.#excluded.has(s.id) && L.excluded].filter(Boolean).join(" · ");
      let qtyEl: HTMLElement | string = "";
      if (can && !blocked) {
        const f = `qty:${s.id}`;
        const shown = mine.get(s.id);
        const input = this.#input(
          f,
          () => {
            const el = h("input", { class: "nx-award__qty", inputmode: "decimal", autocomplete: "off", "data-f": f, "aria-label": fill(L.qtyFor, { name: s.name }) });
            const commit = () => {
              const raw = el.value.trim();
              const n = raw ? this.#fmt.parse(raw) : 0;
              const had = this.#allocOf(id).find((x) => x.supplier === s.id);
              const cur = had ? qtyOf(it, had, q) ?? 0 : 0;
              if (n === null || n < 0 || milli(n) === cur) {
                el.value = cur ? this.#num(cur) : "";
                return;
              }
              this.#setQty(id, s.id, milli(n));
              // Lo que quedó (con el tope de lo ofrecido y de lo que falta), a la vista.
              const now = this.#allocOf(id).find((x) => x.supplier === s.id);
              const v = now ? qtyOf(it, now, q) ?? 0 : 0;
              el.value = v ? this.#num(v) : "";
            };
            el.addEventListener("change", commit);
            el.addEventListener("keydown", (e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              commit();
            });
            return el;
          },
          shown ? this.#num(shown) : "",
        );
        input.placeholder = this.#num(capOf(it, q) ?? 0);
        qtyEl = h("span", { class: "nx-award__qtybox" }, input, it.unit ? h("small", null, it.unit) : "");
      } else if (splittable(it) && mine.has(s.id)) qtyEl = h("span", { class: "nx-award__qtybox" }, this.#qtyText(it, mine.get(s.id)));
      return h(
        "li",
        { "data-rec": isRec, "data-chosen": isChosen, "data-tone": flag?.tone, "data-blocked": blocked },
        pick,
        bar,
        h("span", { class: "nx-award__score" }, rk ? fill(L.points, { n: this.#num(Math.round(rk.score)) }) : ""),
        h("span", { class: "nx-award__price" }, `${this.#money(q.price)}${lead}`, h("small", null, this.#money(partTotal(it, { supplier: s.id }, q), true))),
        qtyEl,
        sub ? h("span", { class: "nx-award__sub" }, sub) : "",
      );
    });
    parts.push(lines.length ? h("ol", { class: `nx-award__rank${splittable(it) ? " nx-award__rank--qty" : ""}` }, ...lines) : h("p", { class: "nx-award__empty" }, L.nobody));
    const short = shortOf(it, alloc, this.#quotes);
    if (short > 0) parts.push(h("p", { class: "nx-award__left" }, fill(L.left, { n: this.#qtyText(it, short) })));
    const choice = this.#choices.get(id);
    const acts: (Node | string)[] = [];
    if (!locked && alloc.length) {
      const skip = h("button", { type: "button", class: "nx-award__btn", "data-f": "skip" }, glyph(BAN), L.skip);
      skip.addEventListener("click", () => this.#setChoice(id, [], "skip"));
      acts.push(skip);
    }
    const deviates = !!own && !!choice && !sameSplits(it, own, r, this.#quotes);
    if (deviates) {
      const d = r.length ? amountOf(it, own, this.#quotes) - amountOf(it, r, this.#quotes) : 0;
      const single = own.length === 1 && shortOf(it, own, this.#quotes) === 0;
      const tpl = r.length ? (!own.length ? L.youSkip : single ? L.youChose : L.youSplit) : single ? L.youChoseFree : L.youSplitFree;
      const [a, b = ""] = fill(tpl, { supplier: own[0] ? this.#name(own[0].supplier) : "" }).split("{delta}");
      const input = this.#input(
        "reason",
        () => {
          const el = h("input", { class: "nx-award__reason", list: `${this.#uid}-r`, "aria-label": L.reason, placeholder: L.reason, "data-f": "reason", maxlength: "200", autocomplete: "off" });
          el.addEventListener("input", () => {
            const ch = this.#choices.get(id);
            if (ch) ch.reason = el.value || undefined;
          });
          el.addEventListener("change", () => {
            this.#bulk = null;
            this.#say("");
            this.#queue();
            this.#changedBy("reason", id, []);
          });
          return el;
        },
        choice.reason ?? "",
      );
      input.readOnly = locked;
      const undo = r.length && !locked ? h("button", { type: "button", class: "nx-award__btn", "data-f": "undo" }, glyph(UNDO), L.undo) : "";
      if (undo) undo.addEventListener("click", () => this.#setChoice(id, null, "undo"));
      parts.push(h("div", { class: "nx-award__change" }, h("p", null, a, r.length ? h("span", { "data-tone": d > 0 ? "up" : d < 0 ? "down" : "" }, this.#signed(d)) : "", b), input, undo, ...acts));
    } else if (acts.length) parts.push(h("div", { class: "nx-award__change nx-award__change--plain" }, ...acts));
    return h("div", { class: "nx-award__detail" }, ...parts);
  }

  // ---------------------------------------------------------------- criterios y motivos

  #buildCrit(): void {
    if (!this.#built) return;
    const L = this.#labels;
    this.#critRows.clear();
    const reset = h("button", { type: "button", class: "nx-award__btn" }, L.reset);
    reset.addEventListener("click", () => {
      if (!this.#canAdvise()) return;
      this.#critRows.values().next().value?.range.focus();
      this.#weights = { ...this.#baseWeights };
      this.#paintCrit();
      this.#detailDirty = true;
      this.#request(0);
      this.#changedBy("weights", null, []);
    });
    this.#critReset = reset;
    this.#crit!.replaceChildren(
      ...this.#criteria.flatMap((c, k) => {
        const rid = `${this.#uid}-w${k}`;
        const range = h("input", { type: "range", id: rid, class: "nx-award__range", min: "0", max: "100", step: "1", disabled: this.readonly });
        const out = h("output", { class: "nx-award__share", for: rid });
        range.addEventListener("input", () => {
          this.#weights[c.id] = Number(range.value);
          this.#paintCrit();
          this.#detailDirty = true;
          this.#queue();
          this.#request(DEBOUNCE);
        });
        range.addEventListener("change", () => this.#changedBy("weights", null, []));
        this.#critRows.set(c.id, { range, out });
        return [h("label", { for: rid }, h("i", { "data-k": Math.min(k, 4) }), c.label), range, out];
      }),
      h("div", { class: "nx-award__cfoot" }, reset),
    );
    this.#paintCrit();
  }

  #paintCrit(): void {
    const sh = shares(this.#criteria, this.#weights);
    const locale = this.#fmt.locale;
    for (const [id, row] of this.#critRows) {
      const text = pct(sh[id], locale);
      row.range.value = String(this.#weights[id] ?? 0);
      row.range.setAttribute("aria-valuetext", text);
      row.out.textContent = text;
    }
    if (this.#critReset) this.#critReset.hidden = this.#criteria.every((c) => this.#weights[c.id] === this.#baseWeights[c.id]);
  }

  #paintReasons(): void {
    this.#datalist?.replaceChildren(...this.#reasons.map((r) => h("option", { value: r })));
  }

  // ---------------------------------------------------------------- teclado y foco

  #cellEl(r: string, c: number): HTMLElement | undefined {
    if (!r) return c ? this.#heads[c - 1] : this.#corner;
    const ref = this.#rows.get(r);
    return ref && (c ? ref.cells[c - 1] : ref.th);
  }
  #visible(): string[] {
    return [...this.#rows.values()].filter((r) => !r.tr.hidden).map((r) => r.item.id);
  }
  #setTab(el: HTMLElement): void {
    if (this.#tabEl === el) return;
    if (this.#tabEl) this.#tabEl.tabIndex = -1;
    el.tabIndex = 0;
    this.#tabEl = el;
  }
  /** Una sola celda en el orden de tabulación (la activa, o la primera fila visible). */
  #syncTab(): void {
    let el = this.#active && this.#cellEl(this.#active.r, this.#active.c);
    if (!el || el.closest("tr")?.hidden) {
      this.#active = null;
      el = this.#cellEl(this.#visible()[0] ?? "", 0);
    }
    if (el) this.#setTab(el);
  }
  /** Enfoca la celda, o la de la fila visible más cercana (la suya se ocultó o ya no existe). */
  #focusNear(p: Pos): void {
    const c = Math.min(p.c, this.#suppliers.length);
    if (!p.r) return this.#focus("", c);
    const order = [...this.#rows.keys()];
    const shown = (id: string | undefined) => id !== undefined && !this.#rows.get(id)!.tr.hidden;
    const i = order.indexOf(p.r);
    let r = shown(p.r) ? p.r : undefined;
    for (let k = 1; !r && i >= 0 && k < order.length; k++) r = [order[i + k], order[i - k]].find(shown);
    r ??= this.#visible()[0];
    this.#focus(r ?? "", r ? c : 0);
  }
  #focus(r: string, c: number): void {
    const el = this.#cellEl(r, c);
    if (!el) return;
    this.#active = { r, c };
    this.#setTab(el);
    el.focus();
  }

  #activate(p: Pos): void {
    if (!p.r) {
      if (p.c) this.#toggleSup(this.#suppliers[p.c - 1].id);
      return;
    }
    if (!p.c) return this.#setOpen(this.#open === p.r ? null : p.r);
    this.#pick(p.r, this.#suppliers[p.c - 1].id);
  }

  #onClick(e: MouseEvent): void {
    const cell = (e.target as Element).closest?.("th, td");
    const p = cell && this.#pos.get(cell);
    if (p) this.#activate(p);
  }

  #onKey(e: KeyboardEvent): void {
    const p = this.#pos.get(e.target as Element);
    if (e.key === "Escape" && this.#open && (p?.r === this.#open || this.#detailTr?.contains(e.target as Node))) {
      e.preventDefault();
      e.stopPropagation();
      const id = this.#open;
      this.#setOpen(null);
      this.#flushNow();
      return this.#focus(id, 0);
    }
    if (!p || e.altKey) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      return this.#activate(p);
    }
    if (p.r && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      this.#setChoice(p.r, null, "undo");
      return;
    }
    if (!e.ctrlKey && !e.metaKey && (e.key === "j" || e.key === "k")) {
      e.preventDefault();
      return this.next(e.key === "j" ? 1 : -1);
    }
    const rows = ["", ...this.#visible()];
    const m = gridMove(e.key, rows.indexOf(p.r), p.c, rows.length, this.#suppliers.length + 1, e.ctrlKey || e.metaKey);
    if (!m) return;
    e.preventDefault();
    this.#focus(rows[m[0]], m[1]);
  }
}
