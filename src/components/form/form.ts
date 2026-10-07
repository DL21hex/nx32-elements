/**
 * `<nx-form>`: un formulario entero desde un esquema JSON (secciones y campos), con aspecto de
 * formulario sobrio y lo que ahorra trabajo a quien lo llena.
 *
 * - **El esquema.** `sections` (o `fields`, para uno sin secciones): cada campo con su `key`, tipo,
 *   `required`, `hint`, `span` (de seis columnas), límites, `when` (aparece según otros campos) y,
 *   en las opciones, `fills` (lo habitual de esa opción: el cargo trae el área). Nada es una
 *   función: todo puede venir del backend.
 * - **El campo de la casa.** Cada campo es un `<nx-field>`: etiqueta arriba, «Opcional» en vez de
 *   asteriscos y una sola línea debajo (error, aviso o ayuda). Montos y números son `<nx-number>`;
 *   una lista larga (o con `search` o `source`), `<nx-select>`. Los dos se cargan solo si el esquema
 *   los usa. `rows` repite un grupo de campos por fila (los beneficiarios, las líneas).
 * - **Llenar desde afuera.** `fill(valores, origen)` llena lo que trae (la cédula, una requisición,
 *   un texto pegado), marca cada dato con su origen hasta que la persona lo cambia, nunca pisa lo
 *   que ella escribió, recorre los campos con un destello y se deshace entero (`undo()`, Ctrl+Z).
 *   `<nx-paste-fill>`, `<nx-scan>` y `<nx-doc-capture>` lo llenan así cuando lo tienen de destino.
 * - **Revisar sin estorbar.** Los errores salen al dejar el campo o al enviar, no mientras se
 *   escribe por primera vez; un aviso (un correo «@gmial.com») no bloquea y trae su arreglo a un
 *   clic. El índice dice qué le falta a cada sección y el pie, cuántos datos faltan, con «Ir al
 *   siguiente».
 * - **Borrador solo** (`draft`): se guarda en el navegador mientras se escribe y se recupera al volver.
 * - **Teclado de captura:** Enter pasa al campo siguiente, Ctrl+S envía y Ctrl+Z deshace el último
 *   llenado. **Lectura** (`mode="read"`): la misma rejilla con los valores como texto.
 *
 * Al enviar con todo bien, `nx-form-submit` lleva `values` y de dónde vino cada dato (`sources`).
 * Light DOM: lo propio va en contenedores que se ordenan con CSS; un hijo con `slot="tools"` (los
 * botones para llenar desde afuera, por ejemplo) se ve bajo el título, sin moverlo.
 */
import { attrProps, Base, boolAttr, upgrade } from "../../core/define";
import { h } from "../../core/dom";
import { glyph } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import { nxFormat, resolveLocale, type NxFormat } from "../../core/locale";
import "../field/index";
import type { NxField } from "../field/field";
import { check, cleanSections, coerce, dateLimit, displayValue, hasOptions, isEmpty, isNumeric, sameValue, todayISO, usesSearch, visibleKeys, type Check, type FieldDef, type SectionDef } from "./logic";
import type { FormChangeDetail, FormField, FormFillDetail, FormLabels, FormMode, FormOption, FormRow, FormSection, FormSource, FormSubmitDetail, FormValue, FormVariant } from "./types";

export const FORM_LABELS: FormLabels = {
  submit: "Guardar",
  cancel: "Cancelar",
  optional: "Opcional",
  empty: "Sin dato",
  locked: "No se edita aquí",
  source: "Dato de {source}",
  pick: "Elige…",
  yes: "Sí",
  no: "No",
  required: "Falta este dato",
  choose: "Elige una opción",
  check: "Marca esta casilla para seguir",
  email: "Escribe un correo como nombre@dominio.com",
  emailTypo: "¿Quisiste decir {email}?",
  emailFix: "Usar {domain}",
  url: "Escribe la dirección completa: https://…",
  tel: "Revisa el número: solo dígitos, y al menos 7",
  number: "Escribe un número",
  min: "El mínimo es {min}",
  max: "El máximo es {max}",
  date: "Escribe una fecha válida",
  dateMin: "No antes del {min}",
  dateMax: "No después del {max}",
  minLength: "Mínimo {n} caracteres",
  maxLength: "Máximo {n} caracteres",
  pattern: "Revisa el formato",
  missing: "Faltan {n} datos obligatorios",
  missingOne: "Falta 1 dato obligatorio",
  invalid: "{n} datos por corregir",
  invalidOne: "1 dato por corregir",
  ready: "Todo listo",
  next: "Ir al siguiente",
  sections: "Secciones del formulario",
  complete: "Completa",
  progress: "{done} de {total}",
  sectionMissing: "{n} por llenar",
  sectionErrors: "{n} por corregir",
  filled: "{n} datos de {source}",
  filledOne: "1 dato de {source}",
  kept: "respeté {n} que ya escribiste",
  undo: "Deshacer",
  undone: "Se deshizo el llenado de {source}",
  usual: "Lo habitual para {option}",
  draftSaving: "Guardando borrador…",
  draftSaved: "Borrador guardado · {when}",
  draftRestored: "Recuperamos tu borrador, guardado {when}.",
  startOver: "Empezar de cero",
  justNow: "hace un momento",
  secondsAgo: "hace {n} s",
  minutesAgo: "hace {n} min",
  atTime: "a las {time}",
  goTo: "Faltan {n} datos. Empieza por {label}.",
  addRow: "Agregar",
  removeRow: "Quitar {row}",
  noRows: "Ninguno todavía",
  rowsMin: "Agrega al menos {n}",
  rowsMax: "Máximo {n}",
  rowName: "{label}, fila {n}",
};

const CHECK = '<path d="M20 6 9 17l-5-5"/>';
const DOWN = '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>';
const PLUS = '<path d="M5 12h14"/><path d="M12 5v14"/>';
const TRASH = '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>';
const SVG = "http://www.w3.org/2000/svg";
const RING = 2 * Math.PI * 7;
/** Lo que dura el destello de un dato que llegó solo, y el paso entre un campo y el siguiente. */
const FLASH_MS = 1200;
const STEP_MS = 45;
/** La clave de un campo dentro de una fila: `beneficiarios[r3].nombre` (`r3` no cambia al quitar otras). */
const ROW_PATH = /^(.+)\[(r\d+)\]\.([^.[\]]+)$/;

const tpl = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
const editable = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || (el.matches("input, textarea, select") && !(el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio"))));

interface RowRef {
  parent: string;
  id: string;
  sub: string;
}
interface Slot {
  /** La clave (o, en una fila, su ruta). */
  key: string;
  def: FieldDef;
  /** El `<nx-field>` (o el `<fieldset>` de un campo `rows`). */
  field: HTMLElement;
  /** El control (o el contenedor de un grupo de opciones, o la lista de filas); `null` en `readonly`. */
  ctl: HTMLElement | null;
  row?: RowRef;
}
interface Snap {
  v: Record<string, FormValue>;
  marks: Record<string, FormSource>;
  server: Record<string, string>;
  ids: [string, string[]][];
}
interface Draft {
  v: Record<string, unknown>;
  marks?: Record<string, FormSource>;
  t: number;
}
interface Stat {
  req: number;
  done: number;
  miss: number;
  err: number;
  warn: number;
  filled: number;
  total: number;
}
interface Tally {
  problems: string[];
  missing: number;
  invalid: number;
}

let uid = 0;

export class NxForm extends Base {
  static {
    attrProps(this, ["heading", "submitLabel", "cancelLabel", "draft", "currency"]);
  }
  /** El título, arriba. */
  declare heading: string | null;
  /** El texto del botón de enviar (sin él, «Guardar»). */
  declare submitLabel: string | null;
  /** Con él, un botón para cancelar al lado (`nx-form-cancel`). */
  declare cancelLabel: string | null;
  /** La clave del borrador: con ella, lo escrito se guarda en este navegador y se recupera al volver. */
  declare draft: string | null;
  /** Moneda de los montos que no traen la suya (ISO o símbolo). */
  declare currency: string | null;
  static observedAttributes = ["sections", "fields", "values", "errors", "warnings", "hints", "heading", "submit-label", "cancel-label", "draft", "mode", "variant", "index", "no-footer", "currency", "locale", "labels"];

  #uid = `nx-form${++uid}`;
  #sections: SectionDef[] = [];
  #defs = new Map<string, FieldDef>();
  /** Los campos de primer nivel, en orden. */
  #slots = new Map<string, Slot>();
  /** Los campos de las filas, por ruta. */
  #subs = new Map<string, Slot>();
  /** El id de cada fila de cada campo `rows`, en orden. */
  #rowIds = new Map<string, string[]>();
  #rowSeq = 0;
  #v: Record<string, FormValue> = {};
  /** Los valores de partida (los de `values`, o los del esquema): `reset()` vuelve a ellos. */
  #initial: Record<string, FormValue> = {};
  #given: Record<string, unknown> = {};
  #marks: Record<string, FormSource> = {};
  #touched = new Set<string>();
  #submitted = false;
  #server: Record<string, string> = {};
  #rawServer: Record<string, string> = {};
  #warnings: Record<string, string> = {};
  #hints: Record<string, string> = {};
  #labels: FormLabels = FORM_LABELS;
  #fmt: NxFormat = nxFormat();
  #last: { snap: Snap; source: FormSource } | null = null;
  #status: { text: string; restart?: boolean } | null = null;
  #problems: string[] = [];
  #lastKey = "";
  #current = "";
  #painted = false;
  // Borrador.
  #pending: Draft | null = null;
  #draftChecked = false;
  #saved = 0;
  #saving = false;
  #saveTimer = 0;
  #tick = 0;
  // Nodos propios.
  #head?: HTMLDivElement;
  #title?: HTMLHeadingElement;
  #draftEl?: HTMLParagraphElement;
  #statusEl?: HTMLParagraphElement;
  #body?: HTMLDivElement;
  #index?: HTMLElement;
  #form?: HTMLFormElement;
  #foot?: HTMLDivElement;
  #left?: HTMLParagraphElement;
  #next?: HTMLButtonElement;
  #cancelBtn?: HTMLButtonElement;
  #submitBtn?: HTMLButtonElement;
  #live?: HTMLParagraphElement;
  #io?: IntersectionObserver;

  // ---------------------------------------------------------------- propiedades

  /** Las secciones, con sus campos. El atributo acepta el mismo arreglo como JSON. */
  get sections(): FormSection[] {
    return this.#sections.map((s) => ({ id: s.id, heading: s.heading, description: s.description, fields: s.fields.map(plain) }));
  }
  set sections(v: FormSection[] | null | undefined) {
    this.#setSchema(cleanSections(v));
  }

  /** Atajo para un formulario de una sola sección, sin título de sección. */
  get fields(): FormField[] {
    return this.#sections.flatMap((s) => s.fields.map(plain));
  }
  set fields(v: FormField[] | null | undefined) {
    this.#setSchema(cleanSections(Array.isArray(v) ? [{ fields: v }] : []));
  }

  /** Los valores por clave, de los campos que se ven: texto (las fechas en ISO), número, sí/no, una
   *  lista (casillas), las filas de un `rows` o `null`. Asignarlos carga un registro: lo escrito, los
   *  orígenes y los errores vuelven a empezar. */
  get values(): Record<string, FormValue> {
    const out: Record<string, FormValue> = {};
    const vis = visibleKeys([...this.#defs.values()], this.#v);
    for (const k of this.#defs.keys()) if (vis.has(k)) out[k] = copy(this.#v[k] ?? null);
    return out;
  }
  set values(v: Record<string, unknown> | null | undefined) {
    this.#given = v && typeof v === "object" && !Array.isArray(v) ? { ...v } : {};
    this.#load();
    // Un borrador recuperado gana sobre el registro que llega después (la app lo trae del servidor).
    if (this.#pending) this.#applyDraft(this.#pending);
    this.#paint();
  }

  /** Errores del servidor por clave (`{correo: "Ya existe"}`; en una fila, `"beneficiarios.0.nombre"`).
   *  Se borran al cambiar el campo. */
  get errors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, m] of Object.entries(this.#server)) out[this.#publicKey(k)] = m;
    return out;
  }
  set errors(v: Record<string, string> | null | undefined) {
    this.#rawServer = textMap(v);
    this.#server = {};
    for (const [k, m] of Object.entries(this.#rawServer)) this.#server[this.#innerKey(k)] = m;
    this.#paint();
    const first = this.#problems.find((k) => this.#server[k]);
    if (first) this.focusField(first);
  }

  /** Avisos de la app por clave: no bloquean (`{salario: "Por encima de la banda"}`). */
  get warnings(): Record<string, string> {
    return { ...this.#warnings };
  }
  set warnings(v: Record<string, string> | null | undefined) {
    this.#warnings = textMap(v);
    this.#paint();
  }

  /** Ayudas de la app por clave, en lugar de la del esquema (`{prueba: "La quinta parte de 182 días"}`). */
  get hints(): Record<string, string> {
    return { ...this.#hints };
  }
  set hints(v: Record<string, string> | null | undefined) {
    this.#hints = textMap(v);
    this.#paint();
  }

  /** `edit` (por defecto) o `read`: la misma rejilla con los valores como texto. */
  get mode(): FormMode {
    return this.getAttribute("mode") === "read" ? "read" : "edit";
  }
  set mode(v: FormMode | null | undefined) {
    if (v == null) this.removeAttribute("mode");
    else this.setAttribute("mode", v);
  }

  /** `cards` (por defecto) o `plain` (sin tarjetas: dentro de un panel). */
  get variant(): FormVariant {
    return this.getAttribute("variant") === "plain" ? "plain" : "cards";
  }
  set variant(v: FormVariant | null | undefined) {
    if (v == null) this.removeAttribute("variant");
    else this.setAttribute("variant", v);
  }

  /** `auto` (por defecto: con tres secciones o más) o `none`. */
  get index(): "auto" | "none" {
    return this.getAttribute("index") === "none" ? "none" : "auto";
  }
  set index(v: "auto" | "none" | null | undefined) {
    if (v == null) this.removeAttribute("index");
    else this.setAttribute("index", v);
  }

  /** Sin el pie (el avance y los botones): la app pone los suyos y llama a `submit()`. */
  get noFooter(): boolean {
    return boolAttr(this, "no-footer");
  }
  set noFooter(v: boolean | null | undefined) {
    this.toggleAttribute("no-footer", !!v);
  }

  get locale(): string | null {
    return this.getAttribute("locale");
  }
  set locale(v: string | null | undefined) {
    if (v == null) this.removeAttribute("locale");
    else this.setAttribute("locale", v);
  }

  get labels(): FormLabels {
    return this.#labels;
  }
  set labels(v: Partial<FormLabels> | null | undefined) {
    this.#labels = mergeLabels(FORM_LABELS, v);
    this.#render();
  }

  /** Las claves que faltan o tienen un error, en orden (en una fila, `"beneficiarios.0.nombre"`). */
  get missing(): string[] {
    return this.#problems.map((k) => this.#publicKey(k));
  }

  /** De dónde vino cada dato que no escribió la persona (`{area: "REQ-118"}`; en una fila,
   *  `"beneficiarios.0.nombre"`). */
  get sources(): Record<string, string> {
    const out: Record<string, string> = {};
    const vis = visibleKeys([...this.#defs.values()], this.#v);
    for (const [k, m] of Object.entries(this.#marks)) {
      const s = this.#slot(k);
      if (s && vis.has(s.row?.parent ?? k)) out[this.#publicKey(k)] = m.label;
    }
    return out;
  }

  // ---------------------------------------------------------------- API

  /**
   * Llena con lo que llega de afuera. Con `source` («Cédula», o `{label, detail}`), cada dato lleva
   * su chip hasta que la persona lo cambia (`details` cambia el detalle de alguno: de qué parte del
   * texto salió), se anuncia «7 datos de Cédula» y se puede deshacer. No pisa lo que la persona
   * escribió (salvo `force`). En un campo `rows`, las filas que trae se agregan (las que ya están no
   * se repiten). Devuelve cuántos campos cambiaron.
   */
  fill(values: Record<string, unknown> | null | undefined, source?: FormSource | string | null, options: { force?: boolean; details?: Record<string, string> } = {}): number {
    if (!values || typeof values !== "object") return 0;
    const src = typeof source === "string" ? (source ? { label: source } : null) : source && typeof source.label === "string" && source.label ? { label: source.label, detail: typeof source.detail === "string" ? source.detail : undefined } : null;
    const snap = this.#snap();
    const { keys, kept, flash } = this.#apply(values, src, !!options.force, textMap(options.details));
    if (!keys.length) return 0;
    if (src) {
      this.#last = { snap, source: src };
      const L = this.#labels;
      const n = keys.length;
      this.#status = { text: (n === 1 ? tpl(L.filledOne, { source: src.label }) : tpl(L.filled, { n, source: src.label })) + (kept ? ` · ${tpl(L.kept, { n: kept })}` : "") };
      this.#announce(this.#status.text);
    }
    this.#paint();
    this.#flash(flash);
    this.#emit<FormFillDetail>("nx-form-fill", { keys, source: src });
    this.#scheduleSave();
    return keys.length;
  }

  /** Deshace el último llenado con origen. Devuelve si había algo que deshacer. */
  undo(): boolean {
    const last = this.#last;
    if (!last) return false;
    this.#last = null;
    const keys = [...this.#defs.keys()].filter((k) => !sameValue(this.#v[k], last.snap.v[k]));
    this.#restore(last.snap);
    this.#status = { text: tpl(this.#labels.undone, { source: last.source.label }) };
    this.#announce(this.#status.text);
    this.#paint();
    this.#emit("nx-form-undo", { keys });
    this.#scheduleSave();
    return true;
  }

  /** Revisa todo, muestra los errores y enfoca el primero. Devuelve si está todo bien. */
  validate(): boolean {
    this.#submitted = true;
    this.#paint();
    const first = this.#problems[0];
    if (first) {
      const s = this.#slot(first);
      const label = s?.row ? `${this.#defs.get(s.row.parent)?.label ?? ""}: ${s.def.label}` : (s?.def.label ?? "");
      this.#announce(tpl(this.#labels.goTo, { n: this.#problems.length, label }));
      this.focusField(first);
    }
    return !first;
  }

  /** Envía: si todo está bien, emite `nx-form-submit` con los valores y de dónde vino cada dato. */
  submit(): boolean {
    if (this.mode === "read" || !this.validate()) return false;
    this.#emit<FormSubmitDetail>("nx-form-submit", { values: this.values, sources: this.sources });
    return true;
  }

  /** Vuelve a los valores de partida y borra el borrador. */
  reset(): void {
    this.#pending = null;
    this.clearDraft();
    this.#load();
    this.#paint();
  }

  /** Borra el borrador guardado (llámalo cuando el servidor confirme que guardó). */
  clearDraft(): void {
    clearTimeout(this.#saveTimer);
    this.#saving = false;
    this.#saved = 0;
    const key = this.#draftKey();
    if (key)
      try {
        localStorage.removeItem(key);
      } catch {
        /* sin almacenamiento */
      }
    if (this.#status?.restart) this.#status = null;
    this.#paint();
  }

  /** Enfoca el campo de `key` (en una fila, `"beneficiarios.0.nombre"`) y lo trae a la vista. */
  focusField(key: string): void {
    const s = this.#slot(this.#innerKey(key));
    if (!s || s.field.closest("[hidden]")) return;
    s.field.scrollIntoView?.({ block: "nearest", behavior: calm() ? "auto" : "smooth" });
    if (s.def.type === "rows") (s.field.querySelector<HTMLElement>("nx-field") ?? s.field.querySelector<HTMLElement>(".nx-form__add"))?.focus({ preventScroll: true });
    else s.field.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------- ciclo de vida

  connectedCallback(): void {
    upgrade(this);
    if (!this.#head) this.#build();
    this.#render();
    clearInterval(this.#tick);
    this.#tick = window.setInterval(() => this.#paintHead(), 15000);
  }

  disconnectedCallback(): void {
    clearInterval(this.#tick);
    this.#io?.disconnect();
    // Lo que faltaba guardar no se pierde al salir.
    if (this.#saving) {
      clearTimeout(this.#saveTimer);
      this.#saveDraft();
    }
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (["sections", "fields", "values", "errors", "warnings", "hints", "labels"].includes(name)) {
      const self = this as unknown as Record<string, unknown>;
      if (value === null) return void (self[name] = null);
      try {
        self[name] = JSON.parse(value);
      } catch {
        console.warn(`[nx-form] el atributo "${name}" no es JSON válido`);
      }
      return;
    }
    if (old === value) return;
    if (name === "locale" || name === "currency") return this.#render();
    if (name === "draft") {
      this.#draftChecked = false;
      this.#checkDraft();
    }
    this.#paint();
  }

  // ---------------------------------------------------------------- construir

  #build(): void {
    const L = this.#labels;
    this.#title = h("h2", { class: "nx-form__title" });
    this.#draftEl = h("p", { class: "nx-form__draft" });
    this.#statusEl = h("p", { class: "nx-form__status" });
    this.#head = h("div", { class: "nx-form__head" }, h("div", { class: "nx-form__titles" }, this.#title, this.#draftEl), this.#statusEl);
    this.#index = h("nav", { class: "nx-form__index", "aria-label": L.sections });
    this.#form = h("form", { class: "nx-form__form", novalidate: true, autocomplete: "off" });
    this.#body = h("div", { class: "nx-form__body" }, this.#index, this.#form);
    this.#next = h("button", { type: "button", class: "nx-form__next" });
    this.#left = h("p", { class: "nx-form__left" });
    this.#cancelBtn = h("button", { type: "button", class: "nx-form__btn" });
    this.#submitBtn = h("button", { type: "button", class: "nx-form__btn nx-form__btn--primary", "aria-keyshortcuts": "Control+S" });
    this.#foot = h("div", { class: "nx-form__foot" }, h("div", { class: "nx-form__progress" }, this.#left, this.#next), h("div", { class: "nx-form__acts" }, this.#cancelBtn, this.#submitBtn));
    this.#live = h("p", { class: "nx-sr-only", "aria-live": "polite" });

    const f = this.#form;
    f.addEventListener("input", (e) => this.#onEdit(e));
    f.addEventListener("change", (e) => this.#onEdit(e));
    f.addEventListener("focusin", (e) => {
      const k = keyOf(e.target);
      if (k) this.#lastKey = k;
    });
    f.addEventListener("focusout", (e) => this.#onLeave(e));
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      this.submit();
    });
    f.addEventListener("click", (e) => {
      const b = (e.target as Element).closest?.<HTMLButtonElement>("button[data-act]");
      const box = b?.closest<HTMLElement>("fieldset[data-key]");
      const s = box && this.#slots.get(box.dataset.key!);
      if (!b || !s || this.mode === "read") return;
      if (b.dataset.act === "add-row") this.#addRow(s);
      else if (b.dataset.act === "del-row") this.#delRow(s, b.dataset.row ?? "");
    });
    f.addEventListener("nx-field-action", (e) => {
      const s = this.#slot(keyOf(e.target));
      const fix = s && this.#check(s).fix;
      if (!s || !fix) return;
      this.#byPerson(s, fix.value);
      s.field.focus();
    });
    this.addEventListener("keydown", (e) => this.#onKey(e));
    this.#next.addEventListener("click", () => this.#goNext());
    this.#cancelBtn.addEventListener("click", () => this.#emit("nx-form-cancel", {}));
    this.#submitBtn.addEventListener("click", () => this.submit());
    this.#statusEl.addEventListener("click", (e) => {
      const b = (e.target as Element).closest?.("button");
      if (b?.dataset.act === "undo") this.undo();
      else if (b?.dataset.act === "restart") this.reset();
    });
    this.#index.addEventListener("click", (e) => {
      const b = (e.target as Element).closest?.<HTMLButtonElement>("button[data-sec]");
      const sec = b && this.querySelector<HTMLElement>(`#${this.#uid}-${b.dataset.sec}`);
      if (!sec) return;
      sec.scrollIntoView?.({ block: "start", behavior: calm() ? "auto" : "smooth" });
      sec.querySelector<HTMLElement>(".nx-form__sec-title")?.focus({ preventScroll: true });
    });
  }

  #setSchema(sections: SectionDef[]): void {
    this.#sections = sections;
    this.#defs = new Map(sections.flatMap((s) => s.fields.map((f) => [f.key, f] as const)));
    this.#render();
  }

  /** Rehace la estructura (el esquema, el locale o los textos cambiaron). Los valores se conservan. */
  #render(): void {
    if (!this.isConnected || !this.#head) return;
    const L = this.#labels;
    this.#fmt = nxFormat(resolveLocale(this));
    this.#index!.setAttribute("aria-label", L.sections);
    this.#io?.disconnect();
    this.#slots.clear();
    this.#subs.clear();
    const secs = this.#sections.map((sec, i) => {
      const el = h("section", { class: "nx-form__sec", id: `${this.#uid}-${i}`, "aria-labelledby": sec.heading ? `${this.#uid}-${i}-h` : null });
      if (sec.heading || sec.description)
        el.append(
          h(
            "header",
            { class: "nx-form__sec-head" },
            sec.heading ? h("h3", { class: "nx-form__sec-title", id: `${this.#uid}-${i}-h`, tabindex: "-1" }, sec.heading) : null,
            sec.description ? h("p", { class: "nx-form__sec-desc" }, sec.description) : null,
          ),
        );
      const grid = h("div", { class: "nx-form-grid" });
      for (const def of sec.fields) {
        const s = def.type === "rows" ? this.#rowsSlot(def) : this.#slot1(def, def.key);
        this.#slots.set(def.key, s);
        grid.append(s.field);
      }
      el.append(grid);
      return el;
    });
    this.#form!.replaceChildren(...secs);
    // Los valores: los que ya había (si la clave sigue) o los de partida.
    const keep = this.#v;
    this.#initial = this.#startValues();
    this.#v = {};
    for (const k of this.#defs.keys()) this.#v[k] = k in keep ? keep[k] : copy(this.#initial[k]);
    for (const s of this.#slots.values()) this.#write(s);
    const all = [...this.#defs.values()].flatMap((d) => [d, ...(d.subs ?? [])]);
    if (all.some((d) => isNumeric(d.type))) void import("../number/index");
    if (all.some(usesSearch)) void import("../select/index");

    this.#index!.replaceChildren(
      h(
        "ol",
        null,
        ...this.#sections.map((sec, i) =>
          h("li", null, h("button", { type: "button", "data-sec": String(i) }, h("span", { class: "nx-form__ix-mark" }), h("span", { class: "nx-form__ix-t" }, sec.heading || `${i + 1}`), h("span", { class: "nx-form__ix-s" }))),
        ),
      ),
    );
    this.#watchSections(secs);

    for (const el of [this.#head!, this.#body!, this.#foot!, this.#live!]) if (el.parentNode !== this) this.append(el);
    this.#checkDraft();
    this.#paint();
    this.#painted = true;
  }

  /** Un campo: su `<nx-field>` y su control. `key` es la clave o, en una fila, la ruta. */
  #slot1(def: FieldDef, key: string, row?: RowRef): Slot {
    const L = this.#labels;
    const field = document.createElement("nx-field") as NxField;
    field.dataset.key = key;
    field.labels = { optional: L.optional, empty: L.empty, locked: L.locked, source: L.source };
    const span = Math.round(Number(def.span));
    if (span >= 1 && span <= 5) field.setAttribute("span", String(span));
    if (def.label && def.type !== "checkbox") field.setAttribute("label", def.label);
    if (def.required && def.type !== "readonly") field.setAttribute("required", "");
    else if (def.type !== "readonly" && def.type !== "checkbox") field.setAttribute("optional", "");
    const ctl = this.#control(def, key);
    if (ctl) field.append(ctl);
    return { key, def, field, ctl, row };
  }

  /** Un campo `rows`: un grupo con su leyenda, las filas y «Agregar». */
  #rowsSlot(def: FieldDef): Slot {
    const L = this.#labels;
    const id = `${this.#uid}-${def.key.replace(/[^\w-]/g, "_")}`;
    const legend = h("legend", { class: "nx-form__rows-label" }, def.label, !def.required && !(Number(def.min) > 0) ? h("span", { class: "nx-form__rows-opt" }, L.optional) : null);
    const list = h("div", { class: "nx-form__rows-list" });
    const msg = h("p", { class: "nx-form__rows-msg", id: `${id}-msg` });
    const add = h("button", { type: "button", class: "nx-form__add", "data-act": "add-row" }, glyph(PLUS), h("span", null, def.addLabel || L.addRow));
    const box = h("fieldset", { class: "nx-form__rows", "data-key": def.key, "aria-describedby": msg.id }, legend, list, msg, add);
    return { key: def.key, def, field: box, ctl: list };
  }

  #control(def: FieldDef, name: string): HTMLElement | null {
    const L = this.#labels;
    const auto = def.autocomplete || "off";
    if (usesSearch(def)) {
      const sel = document.createElement("nx-select") as unknown as HTMLElement & Record<string, unknown>;
      sel.setAttribute("name", name);
      sel.setAttribute("placeholder", def.placeholder || L.pick);
      if (def.source) sel.setAttribute("source", def.source);
      if (!def.required) sel.setAttribute("clearable", "");
      sel.fields = Array.isArray(def.search) && def.search.length ? def.search : [{ key: "label", label: def.label }];
      sel.options = def.options.map((o) => ({ ...o, label: o.label ?? o.value }));
      return sel;
    }
    switch (def.type) {
      case "readonly":
      case "rows":
        return null;
      case "textarea": {
        const rows = Math.round(Number(def.rows));
        return h("textarea", { class: "nx-input", name, rows: rows >= 1 ? rows : 3, placeholder: def.placeholder, autocomplete: auto });
      }
      case "select": {
        const sel = h("select", { class: "nx-input", name, autocomplete: auto }, h("option", { value: "" }, def.placeholder || L.pick));
        for (const o of def.options) sel.append(h("option", { value: o.value }, o.label ?? o.value));
        return sel;
      }
      case "radio":
      case "segmented":
      case "checkboxes": {
        const box = h("div", { class: def.type === "segmented" ? "nx-segmented" : "nx-choices" });
        const type = def.type === "checkboxes" ? "checkbox" : "radio";
        for (const o of def.options) {
          const input = h("input", { type, name, value: o.value });
          box.append(def.type === "segmented" ? h("label", null, input, h("span", null, o.label ?? o.value)) : h("label", { class: "nx-check" }, input, h("span", null, o.label ?? o.value)));
        }
        return box;
      }
      case "checkbox":
        return h("label", { class: "nx-check" }, h("input", { type: "checkbox", name, value: "true" }), h("span", null, def.label));
      case "number":
      case "money":
      case "percent": {
        const n = document.createElement("nx-number");
        const attrs: Record<string, string | number | undefined> = { name, format: def.type, currency: def.type === "money" ? (def.currency ?? this.currency ?? undefined) : undefined, decimals: def.decimals, min: def.min, max: def.max, placeholder: def.placeholder };
        for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== "") n.setAttribute(k, String(v));
        if (this.locale) n.setAttribute("locale", this.locale);
        return n;
      }
      default: {
        const today = todayISO();
        return h("input", {
          class: `nx-input${def.mono ? " nx-form__mono" : ""}`,
          type: def.type,
          name,
          placeholder: def.placeholder,
          autocomplete: auto,
          inputmode: def.type === "tel" ? "tel" : def.type === "email" ? "email" : def.type === "url" ? "url" : null,
          spellcheck: def.type === "email" || def.type === "url" || def.mono ? "false" : null,
          min: def.type === "date" ? dateLimit(def.min, today) : null,
          max: def.type === "date" ? dateLimit(def.max, today) : null,
        });
      }
    }
  }

  /** Los valores de partida: los de `values` o, si no, los del esquema. */
  #startValues(): Record<string, FormValue> {
    const out: Record<string, FormValue> = {};
    for (const [k, def] of this.#defs) out[k] = coerce(def, k in this.#given ? this.#given[k] : def.value, this.#fmt);
    return out;
  }

  /** Carga los valores de partida: todo vuelve a empezar. */
  #load(): void {
    this.#initial = this.#startValues();
    this.#v = {};
    for (const [k, v] of Object.entries(this.#initial)) this.#v[k] = copy(v);
    this.#rowIds.clear();
    this.#marks = {};
    this.#server = {};
    this.#rawServer = {};
    this.#touched.clear();
    this.#submitted = false;
    this.#last = null;
    this.#status = null;
    for (const s of this.#slots.values()) this.#write(s);
  }

  // ---------------------------------------------------------------- filas

  /** Los ids de las filas de `parent`, al día con sus valores (los que faltan se crean). */
  #ids(parent: string): string[] {
    const rows = this.#v[parent];
    const n = Array.isArray(rows) ? rows.length : 0;
    let ids = this.#rowIds.get(parent) ?? [];
    if (ids.length > n) ids = ids.slice(0, n);
    while (ids.length < n) ids.push(`r${++this.#rowSeq}`);
    this.#rowIds.set(parent, ids);
    return ids;
  }

  #rows(parent: string): FormRow[] {
    const v = this.#v[parent];
    if (!Array.isArray(v)) this.#v[parent] = [];
    return this.#v[parent] as FormRow[];
  }

  /** Rehace las filas de un campo `rows` (agregar, quitar, llenar, deshacer, cargar). */
  #paintRows(s: Slot): void {
    const L = this.#labels;
    const def = s.def;
    const rows = this.#rows(def.key);
    const ids = this.#ids(def.key);
    for (const [k, sub] of [...this.#subs]) if (sub.row?.parent === def.key) this.#subs.delete(k);
    const kids = rows.map((_, i) => {
      const id = ids[i];
      const name = tpl(L.rowName, { label: def.label, n: i + 1 });
      const grid = h("div", { class: "nx-form-grid" });
      for (const sub of def.subs ?? []) {
        const path = `${def.key}[${id}].${sub.key}`;
        const slot = this.#slot1(sub, path, { parent: def.key, id, sub: sub.key });
        this.#subs.set(path, slot);
        grid.append(slot.field);
      }
      const del = h("button", { type: "button", class: "nx-form__row-del", "data-act": "del-row", "data-row": id, "aria-label": tpl(L.removeRow, { row: name }), title: tpl(L.removeRow, { row: name }) }, glyph(TRASH));
      return h("div", { class: "nx-form__row", "data-row": id, role: "group", "aria-label": name }, grid, del);
    });
    s.ctl!.replaceChildren(...kids);
    for (const sub of this.#subs.values()) if (sub.row?.parent === def.key) this.#write(sub);
  }

  #addRow(s: Slot): void {
    const def = s.def;
    const max = Number(def.max);
    const rows = this.#rows(def.key);
    if (Number.isFinite(max) && max > 0 && rows.length >= max) return;
    const row: FormRow = {};
    for (const sub of def.subs ?? []) row[sub.key] = coerce(sub, sub.value, this.#fmt) as FormRow[string];
    rows.push(row);
    this.#ids(def.key);
    this.#touched.add(def.key);
    this.#changedRows(s);
    const id = this.#ids(def.key)[rows.length - 1];
    s.field.querySelector<NxField>(`.nx-form__row[data-row="${id}"] nx-field`)?.focus();
  }

  #delRow(s: Slot, id: string): void {
    const def = s.def;
    const ids = this.#ids(def.key);
    const i = ids.indexOf(id);
    if (i < 0) return;
    this.#rows(def.key).splice(i, 1);
    ids.splice(i, 1);
    const prefix = `${def.key}[${id}].`;
    for (const k of Object.keys(this.#marks)) if (k.startsWith(prefix)) delete this.#marks[k];
    for (const k of Object.keys(this.#server)) if (k.startsWith(prefix)) delete this.#server[k];
    for (const k of [...this.#touched]) if (k.startsWith(prefix)) this.#touched.delete(k);
    this.#touched.add(def.key);
    this.#changedRows(s);
    // El foco sigue en la fila que quedó en su lugar, o en «Agregar».
    const next = ids[i] ?? ids[i - 1];
    const del = next && s.field.querySelector<HTMLElement>(`.nx-form__row[data-row="${next}"] .nx-form__row-del`);
    (del || s.field.querySelector<HTMLElement>(".nx-form__add"))?.focus();
  }

  /** Se agregó o se quitó una fila: lo hizo la persona. */
  #changedRows(s: Slot): void {
    this.#pending = null;
    this.#last = null;
    delete this.#server[s.key];
    this.#paintRows(s);
    this.#paint();
    this.#emit<FormChangeDetail>("nx-form-change", { key: s.key, value: copy(this.#v[s.key] ?? null), values: this.values });
    this.#scheduleSave();
  }

  // ---------------------------------------------------------------- claves de las filas

  #slot(key: string): Slot | undefined {
    return this.#slots.get(key) ?? this.#subs.get(key);
  }

  /** `beneficiarios.0.nombre`, `beneficiarios[0].nombre` o `beneficiarios[0][nombre]` → la ruta interna. */
  #innerKey(k: string): string {
    if (this.#slot(k)) return k;
    const m = /^(.+?)(?:\.(\d+)\.|\[(\d+)\]\.|\[(\d+)\]\[)([^.[\]]+)\]?$/.exec(k);
    if (!m || this.#defs.get(m[1])?.type !== "rows") return k;
    const id = this.#ids(m[1])[Number(m[2] ?? m[3] ?? m[4])];
    return id ? `${m[1]}[${id}].${m[5]}` : k;
  }

  /** La ruta interna → `beneficiarios.0.nombre`. */
  #publicKey(k: string): string {
    const m = ROW_PATH.exec(k);
    if (!m) return k;
    return `${m[1]}.${this.#ids(m[1]).indexOf(m[2])}.${m[3]}`;
  }

  // ---------------------------------------------------------------- leer y escribir controles

  #get(s: Slot): FormValue {
    if (!s.row) return this.#v[s.key] ?? null;
    const i = this.#ids(s.row.parent).indexOf(s.row.id);
    return (i < 0 ? null : (this.#rows(s.row.parent)[i]?.[s.row.sub] ?? null)) as FormValue;
  }

  #put(s: Slot, v: FormValue): void {
    if (!s.row) {
      this.#v[s.key] = v;
      return;
    }
    const i = this.#ids(s.row.parent).indexOf(s.row.id);
    const row = this.#rows(s.row.parent)[i];
    if (row) row[s.row.sub] = v as FormRow[string];
  }

  #read(s: Slot): FormValue {
    const { def, ctl } = s;
    if (!ctl || def.type === "rows") return this.#get(s);
    if (ctl.localName === "nx-select") {
      const v = (ctl as unknown as { value: unknown }).value;
      return typeof v === "string" && v ? v : null;
    }
    switch (def.type) {
      case "number":
      case "money":
      case "percent": {
        const v = (ctl as unknown as { value: unknown }).value;
        return typeof v === "number" && Number.isFinite(v) ? v : null;
      }
      case "checkbox":
        return !!ctl.querySelector<HTMLInputElement>("input")?.checked;
      case "checkboxes":
        return [...ctl.querySelectorAll<HTMLInputElement>("input:checked")].map((i) => i.value);
      case "radio":
      case "segmented":
        return ctl.querySelector<HTMLInputElement>("input:checked")?.value ?? null;
      default: {
        const v = (ctl as HTMLInputElement).value;
        return v === "" ? null : v;
      }
    }
  }

  #write(s: Slot): void {
    const { def, ctl } = s;
    if (def.type === "rows") return this.#paintRows(s);
    const v = this.#get(s);
    if (!ctl) return;
    if (ctl.localName === "nx-select") {
      (ctl as unknown as { value: unknown }).value = v == null ? "" : String(v);
      return;
    }
    switch (def.type) {
      case "number":
      case "money":
      case "percent":
        (ctl as unknown as { value: unknown }).value = typeof v === "number" ? v : null;
        return;
      case "checkbox": {
        const i = ctl.querySelector<HTMLInputElement>("input");
        if (i) i.checked = !!v;
        return;
      }
      case "checkboxes":
      case "radio":
      case "segmented":
        for (const i of ctl.querySelectorAll<HTMLInputElement>("input")) i.checked = Array.isArray(v) ? (v as unknown[]).includes(i.value) : i.value === v;
        return;
      case "select": {
        const sel = ctl as HTMLSelectElement;
        const val = v == null ? "" : String(v);
        // Un valor que no está en la lista no se pierde.
        if (val && ![...sel.options].some((o) => o.value === val)) sel.append(h("option", { value: val }, val));
        sel.value = val;
        return;
      }
      default:
        (ctl as HTMLInputElement).value = v == null ? "" : String(v);
    }
  }

  // ---------------------------------------------------------------- lo que hace la persona

  #onEdit(e: Event): void {
    if (this.mode === "read") return;
    const s = this.#slot(keyOf(e.target));
    if (!s || s.def.type === "rows") return;
    const v = this.#read(s);
    if (sameValue(v, this.#get(s))) return;
    // Una lista, una fecha o una opción se dan por revisadas al elegir; el texto, al salir.
    const t = s.def.type;
    if (t !== "text" && t !== "textarea" && t !== "email" && t !== "tel" && t !== "url" && !isNumeric(t)) this.#touched.add(s.key);
    this.#setByPerson(s, v);
  }

  /** La persona puso este valor (escribiendo o con el arreglo de un aviso). */
  #byPerson(s: Slot, v: FormValue): void {
    this.#touched.add(s.key);
    this.#setByPerson(s, v);
    this.#write(s);
  }

  #setByPerson(s: Slot, v: FormValue): void {
    this.#put(s, v);
    delete this.#marks[s.key];
    delete this.#server[s.key];
    if (s.row) delete this.#server[s.row.parent];
    this.#pending = null;
    if (this.#last) this.#last = null;
    // Lo habitual de la opción elegida (el cargo trae el área), sin pisar lo escrito. En una fila,
    // llena los campos de esa misma fila.
    let filled: string[] = [];
    const opt = typeof v === "string" && hasOptions(s.def.type) ? s.def.options.find((o) => o.value === v) : undefined;
    if (opt?.fills) {
      const snap = this.#snap();
      filled = this.#fills(opt, new Set([s.def.key]), s.row);
      if (filled.length) {
        const src = this.#usual(opt);
        this.#last = { snap, source: src };
        this.#status = { text: filled.length === 1 ? tpl(this.#labels.filledOne, { source: src.label }) : tpl(this.#labels.filled, { n: filled.length, source: src.label }) };
      }
    }
    this.#paint();
    if (filled.length) this.#flash(filled);
    const detail: FormChangeDetail = s.row
      ? { key: s.row.parent, value: copy(this.#v[s.row.parent] ?? null), values: this.values, row: this.#ids(s.row.parent).indexOf(s.row.id), field: s.row.sub }
      : { key: s.key, value: copy(v), values: this.values };
    this.#emit<FormChangeDetail>("nx-form-change", detail);
    this.#scheduleSave();
  }

  /** Al salir de un campo: queda revisado y el texto se limpia (espacios, correo en minúsculas,
   *  «https://» si falta). */
  #onLeave(e: FocusEvent): void {
    if (this.mode === "read") return;
    const s = this.#slot(keyOf(e.target));
    if (!s || s.def.type === "rows") return;
    // Dentro del mismo campo (de un radio a otro, o dentro de un compuesto), todavía no.
    if (e.relatedTarget instanceof Node && s.field.contains(e.relatedTarget)) return;
    this.#touched.add(s.key);
    const v = this.#get(s);
    if (typeof v === "string") {
      let t = s.def.type === "textarea" ? v.trim() : v.trim().replace(/\s+/g, " ");
      if (s.def.type === "email") t = t.toLowerCase();
      if (s.def.type === "url" && t && !/^[a-z][a-z0-9+.-]*:/i.test(t) && /\.[a-z]{2,}/i.test(t)) t = `https://${t}`;
      if (t !== v) {
        this.#put(s, t || null);
        this.#write(s);
        this.#scheduleSave();
      }
    }
    this.#paint();
  }

  #onKey(e: KeyboardEvent): void {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && !e.altKey && !e.shiftKey && key === "s") {
      e.preventDefault();
      const k = keyOf(e.target);
      if (k) this.#touched.add(k);
      this.submit();
      return;
    }
    if (mod && !e.altKey && !e.shiftKey && key === "z" && this.#last && !editable(e.target)) {
      e.preventDefault();
      this.undo();
      return;
    }
    // Enter pasa al siguiente campo, como en la captura de un ERP. En el último, al botón de enviar.
    // Un select con buscador usa Enter para elegir: ahí no.
    if (e.key !== "Enter" || mod || e.shiftKey || e.altKey || e.isComposing || e.defaultPrevented || this.mode === "read") return;
    const t = e.target;
    if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement) || t.type === "submit" || t.type === "button" || t.closest("nx-select")) return;
    const k = keyOf(t);
    if (!k || !this.#form!.contains(t)) return;
    e.preventDefault();
    const list = this.#ordered().filter((s) => s.ctl && !s.field.closest("[hidden]"));
    const i = list.findIndex((s) => s.key === k);
    const next = list[i + 1];
    if (next) next.field.focus();
    else if (!this.noFooter) this.#submitBtn!.focus();
  }

  /** Los campos (también los de las filas) en el orden en que se ven. */
  #ordered(): Slot[] {
    return [...this.#form!.querySelectorAll<HTMLElement>("nx-field[data-key]")].map((f) => this.#slot(f.dataset.key!)).filter((s): s is Slot => !!s);
  }

  #goNext(): void {
    const order = this.#ordered().map((s) => s.key);
    const at = (k: string) => {
      const s = this.#slot(k);
      return s?.def.type === "rows" ? order.findIndex((x) => x.startsWith(`${k}[`)) : order.indexOf(k);
    };
    const from = order.indexOf(this.#lastKey);
    const target = this.#problems.find((k) => at(k) > from) ?? this.#problems[0];
    if (target) this.focusField(target);
  }

  // ---------------------------------------------------------------- llenar

  #snap(): Snap {
    const v: Record<string, FormValue> = {};
    for (const [k, x] of Object.entries(this.#v)) v[k] = copy(x);
    return { v, marks: { ...this.#marks }, server: { ...this.#server }, ids: [...this.#rowIds].map(([k, ids]) => [k, [...ids]]) };
  }

  #restore(snap: Snap): void {
    this.#v = snap.v;
    this.#marks = snap.marks;
    this.#server = snap.server;
    this.#rowIds = new Map(snap.ids);
    for (const s of this.#slots.values()) this.#write(s);
  }

  /** Aplica valores con un origen. Lo que la persona escribió se respeta (`kept`). Las opciones con
   *  `fills` llenan lo suyo, salvo las claves que trae este mismo llenado. En un `rows`, agrega las
   *  filas que no estaban. */
  #apply(values: Record<string, unknown>, src: FormSource | null, force: boolean, details: Record<string, string>): { keys: string[]; kept: number; flash: string[] } {
    const keys: string[] = [];
    const flash: string[] = [];
    let kept = 0;
    const explicit = new Set(Object.keys(values));
    const opts: [FieldDef, string][] = [];
    const mark = (k: string, top: string) => (src ? { label: src.label, detail: details[top] ?? src.detail } : null);
    for (const [k, raw] of Object.entries(values)) {
      const def = this.#defs.get(k);
      if (!def) continue;
      if (def.type === "rows") {
        const rows = this.#rows(k);
        const ids = this.#ids(k);
        let added = 0;
        for (const r of coerce(def, raw, this.#fmt) as FormRow[]) {
          if (rows.some((x) => sameValue([x], [r]))) continue;
          rows.push(r);
          const id = `r${++this.#rowSeq}`;
          ids.push(id);
          added++;
          for (const sub of def.subs ?? []) {
            const path = `${k}[${id}].${sub.key}`;
            const m = mark(path, k);
            if (m && !isEmpty(r[sub.key])) this.#marks[path] = m;
            flash.push(path);
          }
        }
        if (added) {
          delete this.#server[k];
          keys.push(k);
          const s = this.#slots.get(k);
          if (s) this.#paintRows(s);
        }
        continue;
      }
      const v = coerce(def, raw, this.#fmt);
      const cur = this.#v[k] ?? null;
      const typed = !force && def.type !== "readonly" && this.#touched.has(k) && !this.#marks[k] && !isEmpty(cur);
      if (sameValue(cur, v)) {
        // El mismo valor que ya estaba: si nadie lo escribió, ahora sabemos de dónde viene.
        const m = mark(k, k);
        if (m && !typed && !this.#marks[k] && !isEmpty(v)) {
          this.#marks[k] = m;
          keys.push(k);
          flash.push(k);
        }
        continue;
      }
      if (typed) {
        kept++;
        continue;
      }
      this.#v[k] = v;
      const m = mark(k, k);
      if (m) this.#marks[k] = m;
      else delete this.#marks[k];
      delete this.#server[k];
      const s = this.#slots.get(k);
      if (s) this.#write(s);
      keys.push(k);
      flash.push(k);
      if (typeof v === "string" && hasOptions(def.type)) opts.push([def, v]);
    }
    for (const [def, v] of opts) {
      const opt = def.options.find((o) => o.value === v);
      if (opt?.fills)
        for (const k of this.#fills(opt, explicit)) {
          if (!keys.includes(k)) keys.push(k);
          flash.push(k);
        }
    }
    return { keys, kept, flash };
  }

  /** Lo habitual de una opción: solo en campos vacíos o que llenó el sistema. En una fila, en los
   *  campos de esa fila. */
  #fills(opt: FormOption, skip: Set<string>, row?: RowRef): string[] {
    const src = this.#usual(opt);
    const out: string[] = [];
    for (const [k, raw] of Object.entries(opt.fills ?? {})) {
      if (skip.has(k)) continue;
      const s = row ? this.#subs.get(`${row.parent}[${row.id}].${k}`) : this.#slots.get(k);
      if (!s || s.def.type === "rows") continue;
      const cur = this.#get(s);
      if (!isEmpty(cur) && !this.#marks[s.key]) continue;
      const v = coerce(s.def, raw, this.#fmt);
      if (sameValue(cur, v)) continue;
      this.#put(s, v);
      this.#marks[s.key] = src;
      this.#write(s);
      out.push(s.key);
    }
    return out;
  }

  #usual(opt: { value: string; label?: string }): FormSource {
    const label = opt.label ?? opt.value;
    return { label, detail: tpl(this.#labels.usual, { option: label }) };
  }

  /** El destello que recorre los campos que llegaron solos, en orden. */
  #flash(keys: string[]): void {
    const order = this.#ordered().map((s) => s.key);
    const list = keys.map((k) => this.#slot(k)).filter((s): s is Slot => !!s && !s.field.closest("[hidden]") && s.def.type !== "rows");
    list.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    list[0]?.field.scrollIntoView?.({ block: "nearest", behavior: calm() ? "auto" : "smooth" });
    list.forEach((s, i) => {
      const f = s.field as HTMLElement & { _flash?: number };
      f.classList.remove("is-filled");
      void f.offsetWidth;
      f.style.setProperty("--nx-form-delay", `${i * STEP_MS}ms`);
      f.classList.add("is-filled");
      clearTimeout(f._flash);
      f._flash = window.setTimeout(() => f.classList.remove("is-filled"), FLASH_MS + i * STEP_MS);
    });
  }

  // ---------------------------------------------------------------- pintar

  #check(s: Slot): Check {
    return check(s.def, this.#get(s), { labels: this.#labels, fmt: this.#fmt, today: todayISO() });
  }

  #paint(): void {
    if (!this.#head || !this.isConnected) return;
    const read = this.mode === "read";
    const vis = visibleKeys([...this.#defs.values()], this.#v);
    const stats: Stat[] = this.#sections.map(() => ({ req: 0, done: 0, miss: 0, err: 0, warn: 0, filled: 0, total: 0 }));
    const tally: Tally = { problems: [], missing: 0, invalid: 0 };
    this.toggleAttribute("data-read", read);
    // Los errores del servidor con la ruta de una fila que todavía no existía.
    for (const [k, m] of Object.entries(this.#rawServer)) {
      const inner = this.#innerKey(k);
      if (inner !== k && !(inner in this.#server) && this.#slot(inner)) this.#server[inner] = m;
    }

    for (const def of this.#defs.values()) {
      const s = this.#slots.get(def.key);
      if (!s) continue;
      const shown = vis.has(def.key);
      if (s.field.hidden === shown) {
        s.field.hidden = !shown;
        // Lo que aparece por una condición entra con una animación corta (no al pintar la primera vez).
        if (shown && this.#painted && !read) {
          s.field.classList.remove("is-revealed");
          void s.field.offsetWidth;
          s.field.classList.add("is-revealed");
        }
      }
      if (!shown) continue;
      const st = stats[def.sec];
      if (def.type === "rows") {
        this.#paintRowsBox(s, st, tally);
        for (const sub of this.#subs.values()) if (sub.row?.parent === def.key) this.#paintField(sub, st, tally);
      } else this.#paintField(s, st, tally);
    }
    this.#problems = tally.problems;
    this.#paintIndex(stats);
    this.#paintFoot(tally.missing, tally.invalid);
    this.#paintHead();
  }

  /** Un campo: su valor, su error, su aviso, su ayuda y su origen; y lo que suma a su sección. */
  #paintField(s: Slot, st: Stat, tally: Tally): void {
    const L = this.#labels;
    const read = this.mode === "read";
    const { def } = s;
    const f = s.field;
    const v = this.#get(s);
    const c = this.#check(s);
    const empty = isEmpty(v);
    const seen = this.#touched.has(s.key) || this.#submitted;
    const server = this.#server[s.key] ?? "";
    if (def.type !== "readonly") {
      st.total++;
      if (!empty) st.filled++;
    }
    if (def.required && def.type !== "readonly") {
      st.req++;
      if (!empty && !c.error && !server) st.done++;
    }
    if (c.error || server) {
      tally.problems.push(s.key);
      if (empty && !server) {
        tally.missing++;
        if (seen) st.miss++;
      } else {
        tally.invalid++;
        if (seen || server) st.err++;
      }
    }

    set(f, "label", def.type !== "checkbox" || read ? def.label : null);
    if (read || def.type === "readonly") {
      // Un select que busca en el servidor sabe el texto de lo elegido; el esquema no.
      const chosen = s.ctl?.localName === "nx-select" ? (s.ctl as unknown as { selection?: { label?: unknown }[] }).selection?.[0]?.label : undefined;
      set(f, "text", typeof chosen === "string" && chosen ? chosen : displayValue(def, v, this.#fmt, L, this.currency ?? undefined));
      set(f, "locked", def.type === "readonly" && !read ? "" : null);
      for (const a of ["error", "warning", "action", "source", "source-detail"]) set(f, a, null);
      set(f, "hint", read ? null : (this.#hints[s.key] ?? def.hint ?? null));
      return;
    }
    set(f, "text", null);
    set(f, "locked", null);
    const error = server || (seen ? c.error : "");
    const appWarn = this.#warnings[s.key] ?? "";
    const ownWarn = !error && c.warning && (seen || !!this.#marks[s.key]) ? c.warning : "";
    const warning = error ? "" : appWarn || ownWarn;
    if (warning) st.warn++;
    set(f, "error", error || null);
    set(f, "warning", warning || null);
    set(f, "action", warning && warning === ownWarn && c.fix ? c.fix.label : null);
    set(f, "hint", this.#hints[s.key] ?? def.hint ?? null);
    const m = this.#marks[s.key];
    set(f, "source", m?.label ?? null);
    set(f, "source-detail", m?.detail ?? null);
  }

  /** El grupo de un `rows`: cuántas filas, su error (al menos una, como máximo tantas) o su ayuda. */
  #paintRowsBox(s: Slot, st: Stat, tally: Tally): void {
    const L = this.#labels;
    const { def } = s;
    const rows = this.#rows(def.key);
    const c = this.#check(s);
    const seen = this.#touched.has(s.key) || this.#submitted;
    const server = this.#server[s.key] ?? "";
    const required = def.required || Number(def.min) > 0;
    st.total++;
    if (rows.length) st.filled++;
    if (required) {
      st.req++;
      if (!c.error && !server) st.done++;
    }
    if (c.error || server) {
      tally.problems.push(s.key);
      if (!rows.length && !server) {
        tally.missing++;
        if (seen) st.miss++;
      } else {
        tally.invalid++;
        if (seen || server) st.err++;
      }
    }
    const read = this.mode === "read";
    const error = read ? "" : server || (seen ? c.error : "");
    const msg = s.field.querySelector<HTMLElement>(".nx-form__rows-msg")!;
    const text = error || (rows.length ? (read ? "" : (this.#hints[s.key] ?? def.hint ?? "")) : read ? L.empty : (this.#hints[s.key] ?? def.hint ?? L.noRows));
    if (msg.textContent !== text) msg.textContent = text;
    msg.hidden = !text;
    msg.dataset.tone = error ? "err" : "";
    s.field.toggleAttribute("data-invalid", !!error);
    const max = Number(def.max);
    s.field.querySelector<HTMLButtonElement>(".nx-form__add")!.hidden = read || (Number.isFinite(max) && max > 0 && rows.length >= max);
  }

  #paintIndex(stats: Stat[]): void {
    const L = this.#labels;
    const show = this.index !== "none" && this.#sections.length >= 3;
    this.#index!.hidden = !show;
    this.toggleAttribute("data-index", show);
    if (!show) return;
    this.#sections.forEach((sec, i) => {
      const b = this.#index!.querySelector<HTMLButtonElement>(`button[data-sec="${i}"]`);
      if (!b) return;
      const st = stats[i];
      let text: string;
      let tone = "";
      let mark: Node;
      let key: string;
      if (st.err || st.miss) {
        text = st.err ? tpl(L.sectionErrors, { n: st.err }) : tpl(L.sectionMissing, { n: st.miss });
        if (st.err && st.miss) text += ` · ${tpl(L.sectionMissing, { n: st.miss })}`;
        tone = "err";
        key = "err";
        mark = h("span", { class: "nx-form__dot is-err" }, "!");
      } else if (st.req ? st.done === st.req : st.total > 0 && st.filled === st.total) {
        text = L.complete;
        tone = st.warn ? "warn" : "ok";
        key = "ok";
        mark = h("span", { class: "nx-form__dot is-ok" }, glyph(CHECK));
      } else {
        const done = st.req ? st.done : st.filled;
        const total = st.req ? st.req : st.total;
        text = tpl(L.progress, { done, total });
        key = `p${done}/${total}/${!st.req}`;
        mark = ring(total ? done / total : 0, !st.req);
      }
      const box = b.querySelector<HTMLElement>(".nx-form__ix-mark")!;
      if (box.dataset.k !== key) {
        box.dataset.k = key;
        box.replaceChildren(mark);
      }
      const sub = b.querySelector<HTMLElement>(".nx-form__ix-s")!;
      sub.textContent = text;
      sub.dataset.tone = tone;
      b.setAttribute("aria-label", `${sec.heading || i + 1}: ${text}`);
    });
  }

  #paintFoot(missing: number, invalid: number): void {
    const L = this.#labels;
    this.#foot!.hidden = this.noFooter || this.mode === "read";
    let text: string;
    let tone: string;
    if (missing) {
      text = missing === 1 ? L.missingOne : tpl(L.missing, { n: missing });
      tone = "todo";
    } else if (invalid) {
      text = invalid === 1 ? L.invalidOne : tpl(L.invalid, { n: invalid });
      tone = "err";
    } else {
      text = L.ready;
      tone = "ok";
    }
    if (this.#left!.textContent !== text || this.#left!.dataset.tone !== tone) {
      this.#left!.dataset.tone = tone;
      this.#left!.replaceChildren(tone === "ok" ? glyph(CHECK) : "", text);
    }
    this.#next!.hidden = !this.#problems.length;
    if (this.#next!.dataset.l !== L.next) {
      this.#next!.dataset.l = L.next;
      this.#next!.replaceChildren(L.next, glyph(DOWN));
    }
    const cancel = this.cancelLabel ?? "";
    this.#cancelBtn!.textContent = cancel;
    this.#cancelBtn!.hidden = !cancel;
    this.#submitBtn!.textContent = this.submitLabel || L.submit;
  }

  #paintHead(): void {
    if (!this.#head) return;
    const L = this.#labels;
    const heading = this.heading ?? "";
    this.#title!.textContent = heading;
    this.#title!.hidden = !heading;
    let draft = "";
    if (this.#draftKey() && this.mode === "edit") draft = this.#saving ? L.draftSaving : this.#saved > 0 ? tpl(L.draftSaved, { when: this.#ago(this.#saved) }) : "";
    this.#draftEl!.textContent = draft;
    this.#draftEl!.hidden = !draft;
    this.#draftEl!.dataset.state = this.#saving ? "saving" : "saved";
    const st = this.mode === "edit" ? this.#status : null;
    const key = st ? `${st.text}\u0000${!!this.#last}\u0000${!!st.restart}` : "";
    if (this.#statusEl!.dataset.k !== key) {
      this.#statusEl!.dataset.k = key;
      this.#statusEl!.replaceChildren();
      if (st) {
        this.#statusEl!.append(h("span", null, st.text));
        if (this.#last) this.#statusEl!.append(h("button", { type: "button", "data-act": "undo" }, L.undo));
        else if (st.restart) this.#statusEl!.append(h("button", { type: "button", "data-act": "restart" }, L.startOver));
      }
    }
    this.#statusEl!.hidden = !st;
    this.#head.hidden = !heading && !draft && !st;
  }

  /** El índice marca la sección que se está viendo. */
  #watchSections(secs: HTMLElement[]): void {
    if (typeof IntersectionObserver === "undefined" || secs.length < 3) return;
    const seen = new Map<Element, boolean>();
    this.#io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) seen.set(en.target, en.isIntersecting);
        const first = secs.findIndex((s) => seen.get(s));
        if (first < 0) return;
        this.#current = String(first);
        for (const b of this.#index!.querySelectorAll("button[data-sec]")) {
          if (b.getAttribute("data-sec") === this.#current) b.setAttribute("aria-current", "true");
          else b.removeAttribute("aria-current");
        }
      },
      { rootMargin: "-10% 0px -55% 0px" },
    );
    for (const s of secs) this.#io.observe(s);
  }

  // ---------------------------------------------------------------- borrador

  #draftKey(): string {
    const d = this.draft?.trim();
    return d ? `nx-form:${d}` : "";
  }

  /** Busca el borrador una vez, cuando ya hay esquema. */
  #checkDraft(): void {
    if (this.#draftChecked || !this.#defs.size || !this.isConnected) return;
    const key = this.#draftKey();
    if (!key) return;
    this.#draftChecked = true;
    let d: Draft | null = null;
    try {
      d = JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      d = null;
    }
    if (!d || typeof d !== "object" || !d.v || typeof d.v !== "object") return;
    this.#pending = d;
    this.#applyDraft(d);
  }

  #applyDraft(d: Draft): void {
    let any = false;
    for (const [k, raw] of Object.entries(d.v)) {
      const def = this.#defs.get(k);
      if (!def || def.type === "readonly") continue;
      const v = coerce(def, raw, this.#fmt);
      if (sameValue(v, this.#v[k])) continue;
      this.#v[k] = v;
      if (def.type === "rows") this.#rowIds.delete(k);
      any = true;
    }
    for (const [k, m] of Object.entries(d.marks ?? {})) if (this.#defs.has(k) && m && typeof m.label === "string") this.#marks[k] = { label: m.label, detail: typeof m.detail === "string" ? m.detail : undefined };
    if (!any) return;
    for (const s of this.#slots.values()) this.#write(s);
    this.#saved = typeof d.t === "number" ? d.t : Date.now();
    this.#status = { text: tpl(this.#labels.draftRestored, { when: this.#ago(this.#saved) }), restart: true };
  }

  #scheduleSave(): void {
    if (!this.#draftKey() || this.mode !== "edit") return;
    clearTimeout(this.#saveTimer);
    this.#saving = true;
    this.#paintHead();
    this.#saveTimer = window.setTimeout(() => this.#saveDraft(), 600);
  }

  #saveDraft(): void {
    this.#saving = false;
    const key = this.#draftKey();
    if (!key) return;
    // Solo lo que cambió frente al registro: al volver, se aplica encima del que traiga la app.
    const v: Record<string, FormValue> = {};
    for (const k of this.#defs.keys()) if (!sameValue(this.#v[k], this.#initial[k])) v[k] = this.#v[k] ?? null;
    try {
      if (Object.keys(v).length) {
        const t = Date.now();
        // Los orígenes de primer nivel (los de una fila cuelgan de un id que no vuelve).
        const marks: Record<string, FormSource> = {};
        for (const [k, m] of Object.entries(this.#marks)) if (k in v) marks[k] = m;
        localStorage.setItem(key, JSON.stringify({ v, marks, t } satisfies Draft));
        this.#saved = t;
      } else {
        localStorage.removeItem(key);
        this.#saved = 0;
      }
    } catch {
      this.#saved = 0;
    }
    this.#paintHead();
  }

  #ago(t: number): string {
    const L = this.#labels;
    const s = (Date.now() - t) / 1000;
    if (s < 10) return L.justNow;
    if (s < 60) return tpl(L.secondsAgo, { n: Math.floor(s) });
    if (s < 3600) return tpl(L.minutesAgo, { n: Math.floor(s / 60) });
    let time = "";
    try {
      time = new Intl.DateTimeFormat(this.#fmt.locale, { hour: "numeric", minute: "2-digit" }).format(t);
    } catch {
      time = new Date(t).toLocaleTimeString();
    }
    return tpl(L.atTime, { time });
  }

  // ---------------------------------------------------------------- utilidades

  #announce(text: string): void {
    const live = this.#live!;
    live.textContent = "";
    setTimeout(() => (live.textContent = text), 30);
  }

  #emit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

/** Un campo limpio, como se publicó en el esquema (sin lo interno). */
function plain(def: FieldDef): FormField {
  const { sec: _sec, subs, ...rest } = def;
  return subs ? { ...rest, fields: subs.map(plain) } : rest;
}

/** Una copia que no comparte listas ni filas. */
function copy(v: FormValue): FormValue {
  if (!Array.isArray(v)) return v;
  return (v as unknown[]).map((x) => (x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, Array.isArray(y) ? [...y] : y])) : x)) as FormValue;
}

/** La clave del campo donde ocurrió algo. */
function keyOf(t: EventTarget | null): string {
  return (t instanceof Element && t.closest<HTMLElement>("nx-field[data-key]")?.dataset.key) || "";
}

/** Un mapa de textos por clave como llega (JSON, `null`): solo los textos no vacíos. */
function textMap(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) for (const [k, m] of Object.entries(v)) if (typeof m === "string" && m) out[k] = m;
  return out;
}

/** Pone un atributo solo si cambió (cada cambio repinta el campo). */
function set(el: Element, name: string, v: string | null): void {
  if (v === null) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
  } else if (el.getAttribute(name) !== v) el.setAttribute(name, v);
}

function calm(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** El avance de una sección: un anillo (punteado si no tiene obligatorios). */
function ring(p: number, optional: boolean): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("class", `nx-form__ring${optional ? " is-opt" : ""}`);
  svg.setAttribute("aria-hidden", "true");
  const circle = (cls: string) => {
    const c = document.createElementNS(SVG, "circle");
    c.setAttribute("cx", "9");
    c.setAttribute("cy", "9");
    c.setAttribute("r", "7");
    c.setAttribute("class", cls);
    return c;
  };
  svg.append(circle("nx-form__ring-track"));
  if (p > 0) {
    const arc = circle("nx-form__ring-arc");
    arc.setAttribute("stroke-dasharray", `${(p * RING).toFixed(2)} ${RING.toFixed(2)}`);
    arc.setAttribute("transform", "rotate(-90 9 9)");
    svg.append(arc);
  }
  return svg;
}
