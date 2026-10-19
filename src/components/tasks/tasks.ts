/**
 * `<nx-tasks>`: lo que tengo que hacer. Para cualquier empleado y casi siempre en el celular: una
 * tarea se anota en una línea («Llamar a Laura mañana, urgente»), se cierra con un toque y se
 * deshace; debajo, lo que otros módulos esperan de quien mira y lo que él les pidió a otros.
 *
 * Nada espera al servidor (como `<nx-kanban>`): crear, marcar como hecha o reabrir se ve al instante
 * y se puede deshacer mientras corre la barra de estado (o con Ctrl+Z). Cuando ese tiempo termina
 * —o el elemento sale del DOM, o la página se cierra— sale `nx-tasks-commit` con una `key`, y la app
 * contesta `settle(key, {id, href} | {error})`: lo creado toma su `id` de verdad, y un error revierte
 * ese cambio y lo dice. Marcar una tarea que todavía se está creando espera a que la creación se
 * confirme (una cola por tarea). Lo que llega otra vez por `items` no borra lo pendiente.
 *
 * Genérico: no sabe de permisos ni de BDUI. Los nodos son de luz (sin shadow DOM), y lo propio va
 * en un contenedor al final: los del autor nunca se mueven.
 */
import { Base, attrProps, boolAttr, upgrade } from "../../core/define";
import { dayOfISO, isoOf, todayOf } from "../../core/days";
import { emit, h, reducedMotion, safeEndpoint, safeHref, setAttr } from "../../core/dom";
import { glyph } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import { resolveLocale } from "../../core/locale";
import { clampDelay } from "../../core/time";
import { dateText, withParams } from "../intent/logic";
import type { ThreadPicker } from "../thread/thread-pick";
import { cleanTaskItems, cleanTaskLinks, cleanTaskRequests, fill, groupTasks, paraKey, parseTask, plural, requestSummary, taskCounts, taskDueText, taskNames, type ParaMatch, type TaskParse } from "./logic";
import type { TaskDraft, TaskGroupId, TaskItem, TaskLink, TaskRequest, TasksCommitDetail, TasksLabels, TasksOpenDetail, TasksPerson, TasksSettleResult } from "./types";

export const TASKS_LABELS: TasksLabels = {
  heading: "Tus pendientes",
  summary: "Resumen",
  countLate: "1 vencida|{n} vencidas",
  countToday: "1 para hoy|{n} para hoy",
  countWaiting: "1 te espera|{n} te esperan",
  countAsked: "1 pedida por ti|{n} pedidas por ti",
  placeholder: "¿Qué tienes que hacer?",
  add: "Agregar",
  options: "Más opciones",
  understood: "Entendí:",
  hint: "Escribe y presiona Enter. Entiendo «mañana», «el viernes», «@nombre» y «urgente».",
  needTitle: "Escribe qué tienes que hacer.",
  forMe: "Para mí",
  forPeople: "Para {names}",
  each: "una tarea para cada uno",
  noDate: "Sin fecha",
  urgent: "Urgente",
  remove: "Quitar {name}",
  and: " y ",
  moreNames: "{n} más",
  groupLate: "Vencidas",
  groupToday: "Hoy",
  groupSoon: "Próximos días",
  groupLater: "Más adelante",
  groupNone: "Sin fecha",
  doneToday: "Hechas hoy ({n})",
  markDone: "Marcar como hecha: {title}",
  dueLate: "venció hace {n} días",
  dueYesterday: "venció ayer",
  dueToday: "vence hoy",
  dueTomorrow: "vence mañana",
  dueOn: "vence el {date}",
  by: "pidió {name}",
  links: "Te esperan en otros módulos",
  requests: "Lo que pediste",
  open: "Abrir",
  progress: "{done} de {total} hechas",
  missingOne: "falta {names}",
  missingMany: "faltan {names}",
  pending: "pendiente",
  done: "hecha",
  added: "Agregada a tu día: «{title}»",
  asked: "Le pediste «{title}» a {names}",
  markedDone: "Hecha: «{title}»",
  reopened: "De vuelta en tu lista: «{title}»",
  undo: "Deshacer",
  undone: "Se deshizo: «{title}»",
  failed: "No se guardó «{title}»: {message}",
  dismiss: "Cerrar el aviso",
  empty: "No tienes nada pendiente. Lo que escribas aquí queda en tu lista.",
  more: "Ver todos",
  people: "Personas",
  listening: "Escuchando: {text}",
};

const CHECK = '<path d="M20 6 9 17l-5-5"/>';
const X = '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>';
const ARROW = '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>';
const USERS = '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>';
/** Lo que tarda en irse una fila marcada (la casilla se llena y la fila se pliega). */
const LEAVE = 420;
/** Espera entre teclas antes de preguntar por un «para Nombre». */
const PARA_DEBOUNCE = 250;
/** Lo que dura un aviso sin deshacer («Se deshizo…», o con `undo="0"`). */
const NOTE_MS = 4000;

/**
 * Un cambio optimista. `wait`: corre su tiempo de deshacer; `queued`: se acabó su tiempo pero
 * espera a que se confirme la creación de su tarea; `sent`: salió `nx-tasks-commit` y espera
 * `settle`; `kept`: confirmado, se sostiene hasta que `items` (o `requests`) lo refleje.
 */
interface Change {
  key: string;
  type: "create" | "done";
  /** La tarea (o lo pedido): en una creación, la `key` hasta que `settle` da el `id` de verdad. */
  id: string;
  phase: "wait" | "queued" | "sent" | "kept";
  title: string;
  at: number;
  /** Una creación: lo que se entendió, lo que se escribió (para devolverlo al deshacer) y lo que se ve. */
  draft?: TaskDraft;
  text?: string;
  known?: TasksPerson[];
  item?: TaskItem;
  request?: TaskRequest;
  /** Marcar o reabrir. */
  done?: boolean;
  timer?: number;
  /** Lo que le queda de tiempo (con la barra en pausa) y desde cuándo corre. */
  left?: number;
  since?: number;
}

type View = { items: TaskItem[]; requests: TaskRequest[] };
type Picker = ThreadPicker;
type PickModule = typeof import("./tasks-pick");

let uid = 0;
let seq = 0;
const newKey = () => `t${Date.now().toString(36)}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const upper = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);
const hEl = (level: number, attrs: Record<string, string>, ...kids: (Node | string)[]) => {
  const el = document.createElement(`h${Math.min(6, Math.max(1, level))}`);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...kids);
  return el;
};

export class NxTasks extends Base {
  static {
    attrProps(this, ["heading", "today", "peopleSource", "optionsHref", "moreHref", "moreLabel", "locale"]);
  }
  /** El título («Tu día»). Sin él, `labels.heading`. */
  declare heading: string | null;
  /** «Hoy», `YYYY-MM-DD` (la fecha local si no se da): decide los grupos y lo vencido. */
  declare today: string | null;
  /** `?q=` → `[{id, name, detail?, avatar?}]` (o `{items: […]}`): a quién se le puede pedir algo. */
  declare peopleSource: string | null;
  /** La pantalla con todos los campos («Más opciones»), con lo escrito como parámetros. */
  declare optionsHref: string | null;
  /** «Ver todos los pendientes»: el enlace del pie (`more-label`, o `labels.more`). */
  declare moreHref: string | null;
  declare moreLabel: string | null;
  declare locale: string | null;
  static observedAttributes = ["items", "links", "requests", "labels", "heading", "heading-level", "today", "people-source", "options-href", "more-href", "more-label", "voice", "undo", "locale"];

  #uid = `nx-tasks${++uid}`;
  #items: TaskItem[] = [];
  #links: TaskLink[] = [];
  #requests: TaskRequest[] = [];
  #labels: TasksLabels = TASKS_LABELS;
  #changes: Change[] = [];
  /** Las personas elegidas con «@» para lo que se está escribiendo. */
  #known: TasksPerson[] = [];
  /** Lo que respondió `people-source` a cada «para Nombre». */
  #resolved = new Map<string, ParaMatch>();
  #keepDate = false;
  #keepUrgent = false;
  #draft: TaskParse = { title: "", urgent: false, people: [] };
  /** El aviso de la barra: el cambio que se puede deshacer, o un error, o una nota. */
  #note: { text: string; change?: Change; error?: boolean; timer?: number } | null = null;
  #paused = 0;
  #voiceSays = "";
  #needTitle = false;
  #built = false;
  #live = false;
  #picker?: Picker;
  #pickerP?: Promise<Picker | null>;
  #paraTimer = 0;
  #paraAsk?: AbortController;
  #voiceOn = false;
  // Nodos
  #root!: HTMLElement;
  #head!: HTMLElement;
  #title!: HTMLElement;
  #date!: HTMLElement;
  #counts!: HTMLUListElement;
  #form!: HTMLFormElement;
  #input!: HTMLInputElement;
  #field!: HTMLElement;
  #voice!: HTMLElement;
  #add!: HTMLButtonElement;
  #read!: HTMLElement;
  #hint!: HTMLElement;
  #opts!: HTMLAnchorElement;
  #body!: HTMLElement;
  #doneBox!: HTMLDetailsElement;
  #bar!: HTMLElement;
  #say!: HTMLElement;
  #undoBtn!: HTMLButtonElement;
  #closeBtn!: HTMLButtonElement;
  #foot!: HTMLElement;
  #groups = new Map<string, { root: HTMLElement; list: HTMLUListElement }>();
  #rows = new Map<string, { el: HTMLLIElement; sig: string }>();

  // ---------------------------------------------------------------- propiedades

  /** Las tareas como se ven ahora (con lo creado, marcado o reabierto que todavía no confirma el servidor). */
  get items(): TaskItem[] {
    return this.#view().items;
  }
  set items(v: TaskItem[] | null | undefined) {
    this.#items = cleanTaskItems(v);
    this.#reconcile();
    this.#paint();
  }
  /** Lo que otros módulos esperan: `{id, title, kind, tone?, meta?, action, href, newTab?}`. */
  get links(): TaskLink[] {
    return [...this.#links];
  }
  set links(v: TaskLink[] | null | undefined) {
    this.#links = cleanTaskLinks(v);
    this.#paint();
  }
  /** Lo que se pidió a otros, como se ve ahora: `{id, title, due?, people: [{name, done?}], href?}`. */
  get requests(): TaskRequest[] {
    return this.#view().requests;
  }
  set requests(v: TaskRequest[] | null | undefined) {
    this.#requests = cleanTaskRequests(v);
    this.#reconcile();
    this.#paint();
  }
  get labels(): TasksLabels {
    return this.#labels;
  }
  set labels(v: Partial<TasksLabels> | null | undefined) {
    this.#labels = mergeLabels(TASKS_LABELS, v);
    this.#rows.clear();
    this.#paintStatic();
    this.#paint();
    this.#paintRead();
  }
  /** El nivel del título (2); las secciones van un nivel abajo. */
  get headingLevel(): number {
    const n = Math.round(Number(this.getAttribute("heading-level")));
    return n >= 1 && n <= 5 ? n : 2;
  }
  set headingLevel(v: number | null | undefined) {
    setAttr(this, "heading-level", v == null ? null : String(v));
  }
  /** Milisegundos para deshacer (7000). `0`: cada cambio sale al instante, sin «Deshacer». */
  get undo(): number {
    const n = Number(this.getAttribute("undo"));
    return this.hasAttribute("undo") && Number.isFinite(n) && n >= 0 ? clampDelay(n) : 7000;
  }
  set undo(v: number | null | undefined) {
    setAttr(this, "undo", v == null ? null : String(v));
  }
  /** Botón de dictado (`<nx-voice>`, que se carga solo y no aparece si el navegador no puede). */
  get voice(): boolean {
    return boolAttr(this, "voice");
  }
  set voice(v: boolean) {
    this.toggleAttribute("voice", !!v);
  }

  /**
   * La respuesta de la app a un `nx-tasks-commit`: `{id?, href?}` si se guardó (lo creado toma ese
   * `id`, y lo que esperaba por él sale), o `{error}` si no (el cambio se revierte y el mensaje se
   * ve en la barra). `false` si no hay un cambio enviado con esa `key`.
   */
  settle(key: string, result?: TasksSettleResult | null): boolean {
    const c = this.#changes.find((x) => x.key === String(key));
    if (!c || c.phase !== "sent") return false;
    const error = result && typeof (result as { error?: unknown }).error === "string" ? (result as { error: string }).error : null;
    if (error !== null) {
      // Lo creado se va, con lo que se le haya hecho después.
      for (const x of [...this.#changes]) if (x === c || (c.type === "create" && x.id === c.id)) this.#drop(x);
      this.#show({ text: fill(this.#labels.failed, { title: c.title, message: error.trim() || "—" }), error: true });
    } else {
      if (c.type === "create") {
        const r = (result ?? {}) as { id?: unknown; href?: unknown };
        const id = typeof r.id === "number" && Number.isFinite(r.id) ? String(r.id) : typeof r.id === "string" && r.id.trim() ? r.id.trim() : c.id;
        const href = safeHref(r.href);
        const old = c.id;
        for (const x of this.#changes) if (x.id === old) x.id = id;
        if (c.item) c.item = { ...c.item, id, ...(href ? { href } : {}) };
        if (c.request) c.request = { ...c.request, id, ...(href ? { href } : {}) };
        this.#rows.delete(old);
      }
      c.phase = "kept";
      // Lo que esperaba a esta creación sale ahora, en orden.
      if (c.type === "create") for (const x of [...this.#changes]) if (x.phase === "queued" && x.id === c.id) this.#commit(x);
    }
    this.#reconcile();
    this.#paint();
    return true;
  }

  // ---------------------------------------------------------------- ciclo de vida

  connectedCallback(): void {
    upgrade(this);
    if (!this.#built) this.#build();
    this.#live = true;
    addEventListener("pagehide", this.#onHide);
    this.#paintStatic();
    this.#paint();
    this.#paintRead();
    this.#wireVoice();
  }

  disconnectedCallback(): void {
    this.#live = false;
    removeEventListener("pagehide", this.#onHide);
    // Lo que esperaba su tiempo de deshacer sale ya: un «Deshacer» después no tendría dónde volver.
    this.#flush();
    this.#picker?.close();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "items" || name === "links" || name === "requests" || name === "labels") {
      if (value === null) return;
      try {
        (this as unknown as Record<string, unknown>)[name] = JSON.parse(value);
      } catch {
        console.warn(`[nx-tasks] el atributo "${name}" no es JSON válido`);
      }
      return;
    }
    if (!this.#built) return;
    if (name === "voice") this.#wireVoice();
    if (name === "today" || name === "locale") this.#rows.clear();
    this.#paintStatic();
    this.#paint();
    this.#paintRead();
  }

  #onHide = (): void => this.#flush();

  // ---------------------------------------------------------------- armado

  #build(): void {
    this.#built = true;
    this.setAttribute("role", "region");
    const id = this.#uid;
    this.#title = hEl(2, { class: "nx-tasks__heading", id: `${id}-h` });
    this.#date = h("p", { class: "nx-tasks__date" });
    this.#counts = h("ul", { class: "nx-tasks__counts" });
    this.#head = h("header", { class: "nx-tasks__head" }, h("div", { class: "nx-tasks__titles" }, this.#title, this.#date), this.#counts);

    this.#input = h("input", { type: "text", id: `${id}-in`, class: "nx-tasks__input", autocomplete: "off", enterkeyhint: "done", maxlength: 300, "aria-autocomplete": "list", "aria-describedby": `${id}-hint` });
    this.#field = h("div", { class: "nx-tasks__field" }, this.#input);
    this.#voice = h("span", { class: "nx-tasks__voice", hidden: true });
    this.#add = h("button", { type: "submit", class: "nx-tasks__add" });
    this.#read = h("div", { class: "nx-tasks__read" });
    this.#hint = h("p", { class: "nx-tasks__hint", id: `${id}-hint` });
    this.#opts = h("a", { class: "nx-tasks__opts", hidden: true });
    this.#form = h(
      "form",
      { class: "nx-tasks__capture", novalidate: true },
      h("div", { class: "nx-tasks__entry" }, this.#field, h("div", { class: "nx-tasks__btns" }, this.#voice, this.#add)),
      h("div", { class: "nx-tasks__under" }, this.#read, this.#hint, this.#opts),
    );

    this.#body = h("div", { class: "nx-tasks__body" });
    this.#doneBox = h("details", { class: "nx-tasks__done" }, h("summary", null));
    this.#say = h("span", { class: "nx-tasks__say", role: "status" });
    this.#undoBtn = h("button", { type: "button", class: "nx-tasks__undo", hidden: true });
    this.#closeBtn = h("button", { type: "button", class: "nx-tasks__close", hidden: true }, glyph(X));
    this.#bar = h("div", { class: "nx-tasks__bar" }, h("span", { class: "nx-tasks__clock", "aria-hidden": "true" }), this.#say, this.#undoBtn, this.#closeBtn);
    this.#foot = h("p", { class: "nx-tasks__foot", hidden: true });
    this.#root = h("div", { class: "nx-tasks" }, this.#head, this.#form, this.#body, this.#foot, this.#bar);
    this.append(this.#root);

    this.#form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.#create();
    });
    this.#input.addEventListener("input", () => this.#typed());
    this.#input.addEventListener("focus", () => this.#withPicker(() => {}));
    this.addEventListener("keydown", (e) => this.#key(e));
    this.addEventListener("click", (e) => this.#click(e));
    this.addEventListener("focusout", (e) => this.#picker?.blur(e.target));
    this.#undoBtn.addEventListener("click", () => this.#note?.change && this.#undoChange(this.#note.change));
    this.#closeBtn.addEventListener("click", () => this.#show(null));
    // La barra se detiene mientras se la mira o se la recorre con el teclado.
    const pause = (on: boolean, bit: number) => this.#pause(on ? this.#paused | bit : this.#paused & ~bit);
    this.#bar.addEventListener("pointerenter", () => pause(true, 1));
    this.#bar.addEventListener("pointerleave", () => pause(false, 1));
    this.#bar.addEventListener("focusin", () => pause(true, 2));
    this.#bar.addEventListener("focusout", (e) => !this.#bar.contains(e.relatedTarget as Node) && pause(false, 2));
    // Lo que dice el dictado mientras se habla (el botón no lo muestra: `layout="button"`).
    this.addEventListener("nx-voice-partial", (e) => this.#voiceText((e as CustomEvent<{ text: string }>).detail.text));
    this.addEventListener("nx-voice-error", (e) => this.#voiceText("", (e as CustomEvent<{ message: string }>).detail.message));
    this.addEventListener("nx-voice-end", () => this.#voiceText(""));
  }

  /** Lo que no cambia con los datos: título, campo, botones, enlaces. */
  #paintStatic(): void {
    if (!this.#built) return;
    const L = this.#labels;
    const level = this.headingLevel;
    if (this.#title.localName !== `h${level}`) {
      const t = hEl(level, { class: "nx-tasks__heading", id: `${this.#uid}-h` });
      this.#title.replaceWith(t);
      this.#title = t;
    }
    this.#title.textContent = this.heading || L.heading;
    this.setAttribute("aria-labelledby", this.#title.id);
    this.#date.textContent = dateText(this.#today(), this.#locale());
    this.#input.placeholder = L.placeholder;
    this.#input.setAttribute("aria-label", L.placeholder);
    this.#add.textContent = L.add;
    this.#hint.textContent = L.hint;
    this.#opts.textContent = L.options;
    this.#opts.hidden = !safeHref(this.optionsHref);
    this.#undoBtn.textContent = L.undo;
    this.#closeBtn.setAttribute("aria-label", L.dismiss);
  }

  #today(): number {
    return todayOf(this.today);
  }
  #locale(): string {
    return resolveLocale(this);
  }

  // ---------------------------------------------------------------- el estado que se ve

  /** Lo que llegó, con los cambios encima: lo creado primero (lo último arriba) y cada «hecha» en orden. */
  #view(): View {
    const created = this.#changes.filter((c) => c.type === "create");
    const items = [...created.filter((c) => c.item).reverse().map((c) => ({ ...c.item! })), ...this.#items.map((t) => ({ ...t }))];
    const byId = new Map(items.map((t) => [t.id, t]));
    for (const c of this.#changes) {
      const t = c.type === "done" ? byId.get(c.id) : undefined;
      if (!t) continue;
      if (c.done) t.done = true;
      else delete t.done;
    }
    const requests = [...created.filter((c) => c.request).reverse().map((c) => ({ ...c.request!, people: c.request!.people.map((p) => ({ ...p })) })), ...this.#requests];
    return { items, requests };
  }

  /** Suelta lo confirmado que ya se ve en lo que llegó (o que ya no aplica). */
  #reconcile(): void {
    const items = new Map(this.#items.map((t) => [t.id, t]));
    const reqs = new Set(this.#requests.map((r) => r.id));
    const later = new Set<string>();
    const keep: Change[] = [];
    for (let i = this.#changes.length - 1; i >= 0; i--) {
      const c = this.#changes[i];
      let ok = true;
      if (c.phase === "kept") {
        if (c.type === "create") ok = c.item ? !items.has(c.id) : !reqs.has(c.id);
        else if (later.has(c.id)) ok = false;
        else {
          const t = items.get(c.id);
          ok = t ? !!t.done !== !!c.done : this.#changes.some((x) => x.type === "create" && x.id === c.id);
        }
      }
      if (c.type === "done") later.add(c.id);
      if (ok) keep.push(c);
    }
    this.#changes = keep.reverse();
  }

  // ---------------------------------------------------------------- pintado

  #paint(): void {
    if (!this.#built) return;
    const L = this.#labels;
    const locale = this.#locale();
    const today = this.#today();
    const view = this.#view();
    const { groups, done } = groupTasks(view.items, today);
    const counts = taskCounts(view.items, this.#links, view.requests, today);
    const empty = !view.items.length && !this.#links.length && !view.requests.length;
    const sub = Math.min(6, this.headingLevel + 1);

    // Cabecera: solo las cifras que no son cero.
    const chips: [string, string, number][] = [
      ["late", L.countLate, counts.late],
      ["today", L.countToday, counts.today],
      ["waiting", L.countWaiting, counts.waiting],
      ["asked", L.countAsked, counts.asked],
    ];
    this.#counts.replaceChildren(...chips.filter((c) => c[2] > 0).map(([k, t, n]) => h("li", { "data-k": k }, plural(t, n))));
    this.#counts.hidden = !this.#counts.children.length;
    this.#counts.setAttribute("aria-label", L.summary);

    const a = document.activeElement as HTMLElement | null;
    const keep = a && this.#body.contains(a) ? a : null;
    const blocks: HTMLElement[] = [];
    const glabel: Record<TaskGroupId, string> = { late: L.groupLate, today: L.groupToday, soon: L.groupSoon, later: L.groupLater, none: L.groupNone };
    for (const g of groups) blocks.push(this.#group(`g-${g.id}`, sub, glabel[g.id], g.items.length, g.items.map((t) => this.#taskRow(t, today, locale)), g.id));
    // Las hechas: las que se marcaron aquí primero (la última arriba).
    if (done.length) {
      const at = new Map(this.#changes.filter((c) => c.type === "done" && c.done).map((c) => [c.id, c.at]));
      done.sort((x, y) => (at.get(y.id) ?? 0) - (at.get(x.id) ?? 0));
      const sum = this.#doneBox.firstElementChild as HTMLElement;
      sum.textContent = fill(L.doneToday, { n: done.length });
      let list = this.#doneBox.querySelector<HTMLUListElement>(":scope > ul");
      if (!list) this.#doneBox.append((list = h("ul", { class: "nx-tasks__list" })));
      this.#place(list, done.map((t) => this.#taskRow(t, today, locale)));
      blocks.push(this.#doneBox);
    }
    if (this.#links.length) blocks.push(this.#group("links", sub, L.links, this.#links.length, this.#links.map((l) => this.#linkRow(l)), "links"));
    if (view.requests.length) blocks.push(this.#group("requests", sub, L.requests, view.requests.length, view.requests.map((r) => this.#requestRow(r, today, locale)), "requests"));
    if (empty) blocks.push(h("p", { class: "nx-tasks__empty" }, L.empty));
    const have = [...this.#body.children];
    if (blocks.length !== have.length || blocks.some((b, i) => b !== have[i])) this.#body.replaceChildren(...blocks);
    for (const k of [...this.#groups.keys()]) if (!this.#groups.get(k)!.root.isConnected) this.#groups.delete(k);
    for (const k of [...this.#rows.keys()]) if (!this.#rows.get(k)!.el.isConnected) this.#rows.delete(k);
    if (keep && keep.isConnected && document.activeElement !== keep) keep.focus({ preventScroll: true });

    // Pie.
    const more = safeHref(this.moreHref);
    this.#foot.hidden = !more || empty;
    if (more) {
      const link = this.#foot.firstElementChild as HTMLAnchorElement | null;
      const el = link ?? h("a", { class: "nx-tasks__more" });
      el.href = more;
      el.textContent = this.moreLabel || L.more;
      if (!link) this.#foot.append(el);
    }
  }

  /** Un grupo (o sección) con su título y su lista; el nodo se conserva entre pintados. */
  #group(key: string, level: number, label: string, n: number, rows: HTMLLIElement[], kind: string): HTMLElement {
    let g = this.#groups.get(key);
    const hid = `${this.#uid}-${key}`;
    if (!g || g.root.firstElementChild!.localName !== `h${level}`) {
      const list = h("ul", { class: "nx-tasks__list", "aria-labelledby": hid });
      g = { root: h("div", { class: "nx-tasks__group", "data-group": kind }, hEl(level, { class: "nx-tasks__gh", id: hid }), list), list };
      this.#groups.set(key, g);
    }
    const head = g.root.firstElementChild as HTMLElement;
    head.replaceChildren(label, " ", h("span", { class: "nx-tasks__n" }, String(n)));
    this.#place(g.list, rows);
    return g.root;
  }

  /** Pone las filas en su lista, moviendo las que ya existen (sin perder el foco). */
  #place(list: HTMLElement, rows: HTMLElement[]): void {
    const have = [...list.children].filter((c) => !c.classList.contains("nx-tasks__ghost"));
    if (rows.length === have.length && rows.every((r, i) => r === have[i])) return;
    const ghosts = [...list.querySelectorAll(":scope > .nx-tasks__ghost")];
    list.replaceChildren(...rows);
    // Una fila que se está yendo sigue en su lugar hasta terminar.
    for (const g of ghosts) {
      const i = Number((g as HTMLElement).dataset.at);
      list.insertBefore(g, list.children[i] ?? null);
    }
  }

  #row(key: string, sig: string, make: () => HTMLLIElement): HTMLLIElement {
    const r = this.#rows.get(key);
    if (r && r.sig === sig) return r.el;
    const el = make();
    this.#rows.set(key, { el, sig });
    return el;
  }

  #taskRow(t: TaskItem, today: number, locale: string): HTMLLIElement {
    const L = this.#labels;
    const pending = this.#changes.some((c) => c.type === "create" && c.id === t.id && c.phase !== "kept");
    const sig = JSON.stringify([t, today, locale, pending]);
    return this.#row(`t:${t.id}`, sig, () => {
      const due = taskDueText(t.due, today, locale, L);
      const href = safeHref(t.href);
      const meta: (Node | string)[] = [];
      if (due && !t.done) meta.push(h("span", { class: "nx-tasks__due", "data-tone": due.tone }, due.text));
      else if (due) meta.push(h("span", { class: "nx-tasks__due" }, due.text));
      if (t.by) meta.push(h("span", { class: "nx-tasks__by" }, fill(L.by, { name: t.by })));
      return h(
        "li",
        { class: "nx-tasks__row", "data-id": t.id, "data-done": t.done || null, "data-tone": !t.done && due?.tone === "late" ? "late" : null, "data-pending": pending || null },
        h("button", { type: "button", class: "nx-tasks__check", "aria-pressed": String(!!t.done), "aria-label": fill(L.markDone, { title: t.title }) }, glyph(CHECK)),
        h(
          "div",
          { class: "nx-tasks__main" },
          href ? h("a", { class: "nx-tasks__title", href }, t.title) : h("span", { class: "nx-tasks__title" }, t.title),
          meta.length ? h("span", { class: "nx-tasks__meta" }, ...meta) : null,
        ),
        t.urgent && !t.done ? h("span", { class: "nx-tasks__pill", "data-tone": "warning" }, L.urgent) : null,
      );
    });
  }

  #linkRow(l: TaskLink): HTMLLIElement {
    const L = this.#labels;
    return this.#row(`l:${l.id}`, JSON.stringify([l, L.open]), () => {
      const action = l.action || L.open;
      return h(
        "li",
        { class: "nx-tasks__row nx-tasks__row--link", "data-id": l.id },
        h("span", { class: "nx-tasks__lead", "data-tone": l.tone ?? "neutral" }, glyph(ARROW)),
        h(
          "div",
          { class: "nx-tasks__main" },
          h("span", { class: "nx-tasks__line" }, l.kind ? h("span", { class: "nx-tasks__kind", "data-tone": l.tone ?? "neutral" }, l.kind) : null, h("span", { class: "nx-tasks__title" }, l.title)),
          l.meta ? h("span", { class: "nx-tasks__meta" }, l.meta) : null,
        ),
        h("a", { class: "nx-tasks__go", href: l.href, "aria-label": `${action}: ${l.title}`, target: l.newTab ? "_blank" : null, rel: l.newTab ? "noopener noreferrer" : null }, action, h("span", { "aria-hidden": "true" }, "→")),
      );
    });
  }

  #requestRow(r: TaskRequest, today: number, locale: string): HTMLLIElement {
    const L = this.#labels;
    const pending = this.#changes.some((c) => c.type === "create" && c.id === r.id && c.phase !== "kept");
    return this.#row(`r:${r.id}`, JSON.stringify([r, today, locale, pending]), () => {
      const s = requestSummary(r, today, L);
      const due = taskDueText(r.due, today, locale, L);
      const href = safeHref(r.href);
      const meta: (Node | string)[] = [];
      if (due) meta.push(h("span", { class: "nx-tasks__due", "data-tone": s.late ? "late" : s.done < s.total ? due.tone : null }, due.text));
      meta.push(h("span", { class: "nx-tasks__who" }, s.text));
      const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
      return h(
        "li",
        { class: "nx-tasks__row nx-tasks__row--request", "data-id": r.id, "data-tone": s.late ? "late" : null, "data-pending": pending || null, "data-all": s.done === s.total || null },
        h("span", { class: "nx-tasks__lead" }, glyph(USERS)),
        h(
          "div",
          { class: "nx-tasks__main" },
          href ? h("a", { class: "nx-tasks__title", href }, r.title) : h("span", { class: "nx-tasks__title" }, r.title),
          h("span", { class: "nx-tasks__meta" }, ...meta),
          s.total > 1 ? h("span", { class: "nx-tasks__progress", role: "img", "aria-label": fill(L.progress, { done: s.done, total: s.total }), style: `--p:${pct}%` }, h("span", null)) : null,
        ),
      );
    });
  }

  // ---------------------------------------------------------------- lo que se escribe

  #typed(): void {
    this.#needTitle = false;
    this.#voiceSays = "";
    this.#paintRead();
    this.#withPicker((p) => p.input(this.#input));
  }

  /** Lee lo escrito y pinta «Entendí:» (o la pista). */
  #paintRead(): void {
    if (!this.#built) return;
    const L = this.#labels;
    const text = this.#input.value;
    // Las personas del «@» cuyo nombre ya no está en el texto se olvidan.
    this.#known = this.#known.filter((p) => text.includes(`@${p.name}`));
    if (!text.trim()) this.#keepDate = this.#keepUrgent = false;
    const d = (this.#draft = parseTask(text, { today: this.#today(), people: this.#known, resolved: this.#resolved, keepDate: this.#keepDate, keepUrgent: this.#keepUrgent, locale: this.#locale() }));
    if (d.ask) this.#askPara(d.ask);
    // «Más opciones» lleva lo escrito.
    const opt = safeHref(this.optionsHref);
    if (opt) this.#opts.href = text.trim() ? withParams(opt, this.#params(d)) : opt;
    const say = this.#voiceSays;
    if (say) {
      this.#read.replaceChildren(h("span", { class: "nx-tasks__listen" }, say));
      this.#read.hidden = false;
      this.#hint.hidden = true;
      return;
    }
    const show = !!text.trim();
    this.#read.hidden = !show && !this.#needTitle;
    this.#hint.hidden = show || this.#needTitle;
    if (!show) {
      this.#read.replaceChildren(this.#needTitle ? h("span", { class: "nx-tasks__need" }, L.needTitle) : "");
      return;
    }
    const chip = (kind: string, label: string | Node, remove?: { name: string; act: string; value?: string }) =>
      h(
        "span",
        { class: "nx-tasks__chip", "data-kind": kind },
        label,
        remove ? h("button", { type: "button", class: "nx-tasks__x", "data-act": remove.act, "data-value": remove.value ?? null, "aria-label": fill(L.remove, { name: remove.name }) }, glyph(X)) : null,
      );
    const parts: (Node | string)[] = [h("span", { class: "nx-tasks__k" }, L.understood)];
    if (d.title) parts.push(chip("title", d.title));
    else parts.push(h("span", { class: "nx-tasks__need" }, L.needTitle));
    if (d.people.length) {
      const [pre, post = ""] = L.forPeople.split("{names}");
      const who = h("span", { class: "nx-tasks__for" }, pre);
      d.people.forEach((p, i) => {
        if (i) who.append(i === d.people.length - 1 ? L.and : ", ");
        who.append(chip("person", p.name, { name: p.name, act: "person", value: p.id }));
      });
      if (post) who.append(post);
      if (d.people.length > 1) who.append(h("span", { class: "nx-tasks__each" }, ` · ${L.each}`));
      parts.push(who);
    } else parts.push(chip("me", L.forMe));
    const due = taskDueText(d.due, this.#today(), this.#locale(), L);
    parts.push(due ? chip("due", upper(due.text), { name: upper(due.text), act: "date" }) : chip("none", L.noDate));
    if (d.urgent) parts.push(chip("urgent", L.urgent, { name: L.urgent, act: "urgent" }));
    this.#read.replaceChildren(...parts);
  }

  #params(d: TaskDraft): Record<string, string> {
    return { title: d.title, due: d.due ?? "", urgent: d.urgent ? "1" : "", people: d.people.map((p) => p.id).join(",") };
  }

  /** «para Laura»: se le pregunta a `people-source` (una vez por nombre). */
  #askPara(key: string): void {
    const src = safeEndpoint(this.peopleSource);
    if (!src || this.#resolved.has(key)) return;
    clearTimeout(this.#paraTimer);
    this.#paraAsk?.abort();
    this.#paraTimer = window.setTimeout(() => {
      const ac = (this.#paraAsk = new AbortController());
      void import("./tasks-pick")
        .then((m: PickModule) => m.findPara(src, key.split(" "), ac.signal))
        .then(
          (hit) => {
            if (ac.signal.aborted) return;
            this.#resolved.set(key, hit);
            if (this.#resolved.size > 200) this.#resolved.delete(this.#resolved.keys().next().value!);
            this.#paintRead();
          },
          () => {
            // Sin respuesta: se deja el texto como está (y no se vuelve a preguntar por ese nombre).
            if (!ac.signal.aborted) this.#resolved.set(key, null);
          },
        );
    }, PARA_DEBOUNCE);
  }

  #withPicker(fn: (p: Picker) => void): void {
    if (!safeEndpoint(this.peopleSource)) return;
    if (this.#picker) return fn(this.#picker);
    this.#pickerP ??= import("./tasks-pick").then(
      (m: PickModule) =>
        (this.#picker = m.tasksPicker({
          el: this,
          uid: `${this.#uid}-p`,
          source: () => this.peopleSource,
          label: () => this.#labels.people,
          picked: (_input, person) => {
            if (!this.#known.some((k) => k.id === person.id)) this.#known.push(person);
            this.#paintRead();
          },
        })),
      () => ((this.#pickerP = undefined), null),
    );
    void this.#pickerP.then((p) => p && this.#live && fn(p));
  }

  /** Lo que dice el dictado mientras se habla, o su error. */
  #voiceText(text: string, error?: string): void {
    this.#voiceSays = error ?? (text ? fill(this.#labels.listening, { text }) : "");
    this.#paintRead();
  }

  #wireVoice(): void {
    if (!this.#built) return;
    const want = this.voice && this.#live;
    this.#voice.hidden = !want;
    if (!want || this.#voiceOn) return;
    this.#voiceOn = true;
    void import("../voice/index").then(
      () => {
        if (this.#voice.firstElementChild) return;
        const v = document.createElement("nx-voice");
        v.setAttribute("for", this.#input.id);
        v.setAttribute("layout", "button");
        if (this.locale) v.setAttribute("locale", this.locale);
        this.#voice.append(v);
      },
      () => (this.#voiceOn = false),
    );
  }

  // ---------------------------------------------------------------- crear

  #create(): void {
    const text = this.#input.value;
    if (!text.trim()) return;
    this.#paintRead();
    const d = this.#draft;
    if (!d.title) {
      this.#needTitle = true;
      this.#paintRead();
      return;
    }
    const L = this.#labels;
    const key = newKey();
    const c: Change = { key, type: "create", id: key, phase: "wait", title: d.title, at: Date.now(), draft: { ...d, people: [...d.people] }, text, known: [...this.#known] };
    delete (c.draft as TaskParse).ask;
    if (!c.draft!.due) delete c.draft!.due;
    let message: string;
    if (d.people.length) {
      c.request = { id: key, title: d.title, people: d.people.map((p) => ({ name: p.name })), ...(d.due ? { due: d.due } : {}) };
      message = fill(L.asked, { title: d.title, names: taskNames(d.people.map((p) => p.name), L.and, L.moreNames) });
    } else {
      c.item = { id: key, title: d.title, ...(d.due ? { due: d.due } : {}), ...(d.urgent ? { urgent: true } : {}) };
      message = fill(L.added, { title: d.title });
    }
    this.#clearDraft();
    this.#start(c, message);
    // La fila nueva se asoma (una vez: moverla después no repite la animación).
    const row = this.#rows.get(`${c.item ? "t" : "r"}:${key}`)?.el;
    if (row && !reducedMotion()) {
      row.classList.add("nx-tasks__new");
      row.addEventListener("animationend", () => row.classList.remove("nx-tasks__new"), { once: true });
    }
  }

  #clearDraft(): void {
    this.#input.value = "";
    this.#known = [];
    this.#keepDate = this.#keepUrgent = false;
    this.#needTitle = false;
    this.#voiceSays = "";
    this.#picker?.close();
    this.#paintRead();
  }

  // ---------------------------------------------------------------- marcar

  /** Marca o reabre. Tocar otra vez una que todavía corre su tiempo lo deshace. */
  #toggle(id: string): boolean {
    const t = this.#view().items.find((x) => x.id === id);
    if (!t) return false;
    const prev = this.#changes.find((c) => c.type === "done" && c.id === id && c.phase === "wait");
    if (prev) {
      this.#undoChange(prev);
      return true;
    }
    const done = !t.done;
    const L = this.#labels;
    this.#start({ key: newKey(), type: "done", id, phase: "wait", title: t.title, at: Date.now(), done }, fill(done ? L.markedDone : L.reopened, { title: t.title }));
    return true;
  }

  // ---------------------------------------------------------------- el tiempo de deshacer

  /** Un cambio nuevo: lo anterior que esperaba sale ya (la barra es una sola), y este corre su tiempo. */
  #start(c: Change, message: string): void {
    for (const p of [...this.#changes]) if (p.phase === "wait") this.#commit(p);
    this.#changes.push(c);
    const ms = this.undo;
    if (ms) {
      c.left = ms;
      this.#show({ text: message, change: c });
      this.#run(c);
    } else {
      this.#show({ text: message });
      this.#commit(c);
    }
    this.#paint();
  }

  #run(c: Change): void {
    clearTimeout(c.timer);
    if (c.phase !== "wait" || this.#paused) return;
    c.since = Date.now();
    c.timer = window.setTimeout(() => {
      this.#commit(c);
      this.#paint();
    }, c.left ?? this.undo);
  }

  /** La barra en pausa (se la mira o tiene el foco): el tiempo deja de correr. */
  #pause(bits: number): void {
    const was = !!this.#paused;
    this.#paused = bits;
    const c = this.#note?.change;
    this.#bar.toggleAttribute("data-paused", !!bits);
    if (!c || c.phase !== "wait" || was === !!bits) return;
    if (bits) {
      clearTimeout(c.timer);
      c.left = Math.max(0, (c.left ?? this.undo) - (Date.now() - (c.since ?? Date.now())));
    } else this.#run(c);
  }

  /**
   * Un cambio que ya no se puede deshacer sale como `nx-tasks-commit`. Si es de una tarea que todavía
   * se está creando, espera a que esa creación se confirme (`settle`), salvo con `force` (la página se
   * va): entonces sale con el `id` provisional, que es la `key` de la creación.
   */
  #commit(c: Change, force = false): void {
    clearTimeout(c.timer);
    if (c.phase !== "wait" && c.phase !== "queued") return;
    if (c.type === "done" && !force && this.#changes.some((x) => x.type === "create" && x.id === c.id && x.phase !== "kept")) {
      c.phase = "queued";
    } else {
      c.phase = "sent";
      const detail: TasksCommitDetail =
        c.type === "create" ? { key: c.key, type: "create", title: c.draft!.title, ...(c.draft!.due ? { due: c.draft!.due } : {}), urgent: c.draft!.urgent, people: c.draft!.people.map((p) => ({ ...p })) } : { key: c.key, type: "done", id: c.id, done: !!c.done };
      emit(this, "nx-tasks-commit", detail);
    }
    if (this.#note?.change === c) this.#show(null);
  }

  /** Todo lo que espera sale ya (desconectado o la página se cierra). */
  #flush(): void {
    for (const c of [...this.#changes]) if (c.phase === "wait" || c.phase === "queued") this.#commit(c, true);
    if (this.#note && !this.#note.error) this.#show(null);
  }

  #undoChange(c: Change): void {
    if (c.phase !== "wait") return;
    // Con el foco en la barra, «Deshacer» se esconde: el foco va a lo que volvió.
    const fromBar = this.#bar.contains(document.activeElement);
    this.#drop(c);
    emit(this, "nx-tasks-undo", { key: c.key, type: c.type });
    // Lo escrito vuelve al campo (si está vacío): deshacer no pierde nada.
    if (c.type === "create" && c.text && !this.#input.value) {
      this.#input.value = c.text;
      this.#known = [...(c.known ?? [])];
      this.#paintRead();
    }
    this.#show({ text: fill(this.#labels.undone, { title: c.title }) });
    this.#paint();
    if (fromBar) {
      const back = c.type === "done" ? this.#rows.get(`t:${c.id}`)?.el.querySelector<HTMLElement>(".nx-tasks__check") : null;
      (back?.isConnected ? back : this.#input).focus();
    }
  }

  #drop(c: Change): void {
    clearTimeout(c.timer);
    this.#changes = this.#changes.filter((x) => x !== c);
    this.#rows.delete(`t:${c.id}`);
    this.#rows.delete(`r:${c.id}`);
    if (this.#note?.change === c) this.#show(null);
  }

  /** La barra de estado: el último cambio con «Deshacer», un error (hasta cerrarlo o el próximo
   *  cambio) o una nota que se va sola. `null` la vacía. */
  #show(n: { text: string; change?: Change; error?: boolean } | null): void {
    clearTimeout(this.#note?.timer);
    this.#note = n;
    if (!this.#built) return;
    this.#say.textContent = n?.text ?? "";
    this.#bar.toggleAttribute("data-open", !!n);
    this.#bar.toggleAttribute("data-error", !!n?.error);
    this.#undoBtn.hidden = !n?.change;
    this.#closeBtn.hidden = !n?.error;
    // La raya que se acorta mientras corre el tiempo de deshacer (se reinicia con cada aviso).
    const clock = this.#bar.firstElementChild as HTMLElement;
    const fresh = clock.cloneNode() as HTMLElement;
    fresh.hidden = !n?.change;
    if (n?.change) fresh.style.setProperty("--nx-tasks-undo", `${this.undo}ms`);
    clock.replaceWith(fresh);
    if (n && !n.change && !n.error) {
      const note = n as { timer?: number };
      note.timer = window.setTimeout(() => this.#note === n && this.#show(null), NOTE_MS);
    }
  }

  // ---------------------------------------------------------------- teclado y clic

  #key(e: KeyboardEvent): void {
    if (e.defaultPrevented) return;
    const t = e.target as HTMLElement;
    if (t === this.#input && this.#picker?.key(e, this.#input)) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") {
      // En el campo con texto, Ctrl+Z es del campo.
      if (t === this.#input && this.#input.value) return;
      const last = [...this.#changes].reverse().find((c) => c.phase === "wait");
      if (!last) return;
      e.preventDefault();
      this.#undoChange(last);
      return;
    }
    if (t === this.#input && e.key === "Escape" && (this.#input.value || this.#voiceSays)) {
      e.preventDefault();
      this.#clearDraft();
    }
  }

  #click(e: MouseEvent): void {
    const t = e.target as Element;
    const x = t.closest<HTMLButtonElement>(".nx-tasks__x");
    if (x && this.#read.contains(x)) return this.#unread(x.dataset.act!, x.dataset.value);
    const check = t.closest<HTMLButtonElement>(".nx-tasks__check");
    if (check && this.#body.contains(check)) return this.#onCheck(check);
    const a = t.closest<HTMLAnchorElement>("a");
    if (!a || !this.contains(a)) return;
    if (a === this.#opts) {
      if (!emit(this, "nx-tasks-options", { draft: this.#draftDetail() }, true)) e.preventDefault();
      return;
    }
    const row = a.closest<HTMLElement>(".nx-tasks__row");
    if (!row || !this.#body.contains(row)) return;
    const id = row.dataset.id!;
    const view = this.#view();
    const detail: TasksOpenDetail | null = row.classList.contains("nx-tasks__row--link")
      ? (() => {
          const item = this.#links.find((l) => l.id === id);
          return item ? { kind: "link" as const, item } : null;
        })()
      : row.classList.contains("nx-tasks__row--request")
        ? (() => {
            const item = view.requests.find((r) => r.id === id);
            return item ? { kind: "request" as const, item } : null;
          })()
        : (() => {
            const item = view.items.find((r) => r.id === id);
            return item ? { kind: "task" as const, item } : null;
          })();
    if (detail && !emit(this, "nx-tasks-open", detail, true)) e.preventDefault();
  }

  #draftDetail(): TaskDraft {
    const d = this.#draft;
    return { title: d.title, ...(d.due ? { due: d.due } : {}), urgent: d.urgent, people: d.people.map((p) => ({ ...p })) };
  }

  /** Quitar algo de lo entendido: una persona deja de serlo (su nombre queda como texto), la fecha y
   *  «urgente» vuelven al título. */
  #unread(act: string, value?: string): void {
    if (act === "date") this.#keepDate = true;
    else if (act === "urgent") this.#keepUrgent = true;
    else if (act === "person" && value) {
      const p = this.#known.find((k) => k.id === value);
      if (p) {
        this.#known = this.#known.filter((k) => k !== p);
        this.#input.value = this.#input.value.split(`@${p.name}`).join(p.name);
      } else {
        // Un «para Nombre»: ya no se lee como persona.
        for (const [k, v] of this.#resolved) if (v?.person.id === value) this.#resolved.set(k, null);
      }
    }
    this.#paintRead();
    this.#input.focus();
  }

  /** El botón redondo: marca (o reabre) y la fila se va con una animación corta; el foco pasa a la
   *  siguiente casilla (o a la que se reabrió). */
  #onCheck(btn: HTMLButtonElement): void {
    const row = btn.closest<HTMLLIElement>(".nx-tasks__row");
    const id = row?.dataset.id;
    if (!row || !id) return;
    const checks = () => [...this.#body.querySelectorAll<HTMLButtonElement>(".nx-tasks__row:not(.nx-tasks__ghost) .nx-tasks__check")].filter((c) => !c.closest("details:not([open])"));
    const before = checks().indexOf(btn);
    const focused = document.activeElement === btn;
    const reopening = btn.getAttribute("aria-pressed") === "true";
    const list = row.parentElement;
    const at = list ? [...list.children].indexOf(row) : -1;
    const ghost = list && !reducedMotion() && typeof row.animate === "function" ? (row.cloneNode(true) as HTMLLIElement) : null;
    if (!this.#toggle(id)) return;
    if (ghost && list!.isConnected && !row.isConnected) {
      // La fila ya está en su nuevo lugar; en el viejo queda una copia que se pliega.
      ghost.classList.add("nx-tasks__ghost");
      ghost.removeAttribute("data-id");
      ghost.setAttribute("aria-hidden", "true");
      ghost.inert = true;
      ghost.dataset.at = String(at);
      ghost.toggleAttribute("data-done", !reopening);
      ghost.querySelector(".nx-tasks__check")?.setAttribute("aria-pressed", String(!reopening));
      list!.insertBefore(ghost, list!.children[at] ?? null);
      const hgt = ghost.offsetHeight;
      const end = () => ghost.remove();
      const anim = ghost.animate(
        [
          { opacity: 1, blockSize: `${hgt}px` },
          { opacity: 1, blockSize: `${hgt}px`, offset: 0.4 },
          { opacity: 0, blockSize: "0px", paddingBlock: "0px", marginBlock: "0px" },
        ],
        { duration: LEAVE, easing: "cubic-bezier(0.2,0.8,0.2,1)" },
      );
      anim.onfinish = end;
      setTimeout(end, LEAVE + 80);
    }
    if (!focused) return;
    // El foco: a la que se reabrió, o a la que quedó en el lugar de la marcada.
    const now = checks();
    const back = reopening ? this.#rows.get(`t:${id}`)?.el.querySelector<HTMLButtonElement>(".nx-tasks__check") : null;
    const next = back?.isConnected ? back : now[Math.min(before, now.length - 1)];
    if (next) next.focus({ preventScroll: false });
    else (this.#doneBox.isConnected ? (this.#doneBox.firstElementChild as HTMLElement) : this.#input).focus();
  }
}
