/**
 * `<nx-entries>`: registros que se repiten, cada uno en pocas líneas, con agregar, editar y quitar.
 * Las personas del núcleo familiar, los trabajos anteriores, los estudios y los cursos de una hoja
 * de vida, las sesiones abiertas, las autorizaciones.
 *
 * - **Se lee de un vistazo.** La cara (las iniciales con el color de la persona, una foto o un
 *   ícono), el título y su píldora, una o dos líneas, unas etiquetas, lo que lo respalda con un
 *   visto y, si hay algo que hacer, un aviso con su botón dentro del mismo registro.
 * - **Agregar y editar en un panel** (`<nx-dialog mode="panel">` con un `<nx-form>` del `schema`):
 *   sin ir a otra página y con lo de un formulario de la librería (llenar desde un documento con
 *   `fill()`, borrador no; el aviso de cambios sin guardar al cerrar). Al enviar bien, avisa
 *   `nx-entries-save`; la app guarda y asigna `items`. Lo nuevo se ilumina un momento.
 * - **Quitar pide confirmar ahí mismo**, en el registro, diciendo qué pasa («Talento Humano
 *   tramitará su retiro de la EPS»). Sin ventana encima.
 * - **Lo que no se toca aquí** (`locked`) lleva candado y su explicación; `readonly` lo deja todo
 *   para leer (la trayectoria dentro de la empresa).
 * - Tres formas: `list` (por defecto), `cards` y `timeline` (una trayectoria, de arriba abajo).
 *
 * Sin `schema`, editar y agregar solo avisan (`nx-entries-edit`): la app abre lo suyo. Repintar no
 * tira el foco: los registros conservan su nodo por `id`.
 */
import { attrProps, Base, boolAttr, upgrade } from "../../core/define";
import { emit, h, safeImageSrc, setAttr } from "../../core/dom";
import { glyph, hasIcon, icon, initials } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import { hueOf } from "../presence/logic";
import type { FormField, FormSection, FormSubmitDetail } from "../form/types";
import { cleanEntries, cleanLayout, cleanTone, fillTitle, isSections, newIds } from "./logic";
import type { EntriesActionDetail, EntriesEditDetail, EntriesLabels, EntriesLayout, EntriesOpenDetail, EntriesRemoveDetail, EntriesSaveDetail, EntriesSchema, EntryItem } from "./types";

export const ENTRIES_LABELS: EntriesLabels = {
  add: "Agregar",
  edit: "Editar {title}",
  remove: "Quitar {title}",
  confirmRemove: "¿Quitar «{title}»?",
  confirm: "Quitar",
  cancel: "Cancelar",
  save: "Guardar",
  create: "Agregar",
  empty: "Aún no hay nada aquí.",
  locked: "No se edita aquí",
};

const PLUS = '<path d="M5 12h14"/><path d="M12 5v14"/>';
const PENCIL = '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>';
const TRASH = '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>';
const LOCK = '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
const CHECK = '<path d="M20 6 9 17l-5-5"/>';
const ALERT = '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>';
const INFO = '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>';
const URLISH = /^(?:https?:|\/|\.\.?\/|data:image\/|blob:)/i;
/** Lo que dura iluminado un registro que se acaba de agregar. */
const NEW_MS = 1600;

type Form = HTMLElement & {
  sections: FormSection[] | null;
  fields: FormField[] | null;
  values: Record<string, unknown>;
  errors: Record<string, string>;
  submit(): boolean;
  markClean?(): void;
};
type Dialog = HTMLElement & { show(): Promise<unknown>; close(value?: string, reason?: string): boolean; open: boolean };

let uid = 0;

export class NxEntries extends Base {
  static {
    attrProps(this, ["heading", "addLabel", "empty"]);
  }
  /** El título de la lista («Experiencia anterior»). */
  declare heading: string | null;
  /** El botón de agregar en la cabecera («Agregar experiencia»). Sin él, no se agrega desde aquí. */
  declare addLabel: string | null;
  /** El texto de la lista vacía (por defecto, `labels.empty`). */
  declare empty: string | null;
  static observedAttributes = ["items", "schema", "errors", "heading", "heading-level", "add-label", "empty", "layout", "readonly", "labels"];

  #uid = `nx-ent${++uid}`;
  #items: EntryItem[] = [];
  #schema: EntriesSchema | null = null;
  #errors: Record<string, string> = {};
  #labels: EntriesLabels = ENTRIES_LABELS;
  #head?: HTMLDivElement;
  #title?: HTMLHeadingElement;
  #addBtn?: HTMLButtonElement;
  #list?: HTMLUListElement;
  #emptyEl?: HTMLParagraphElement;
  #nodes = new Map<string, HTMLLIElement>();
  /** El registro que pide confirmar que se quita. */
  #confirming: string | null = null;
  #fresh = new Set<string>();
  #freshTimer = 0;
  #queued = false;
  #dialog?: Dialog;
  #form?: Form;
  #editing: { id: string | null } | null = null;
  /** El registro del último panel (para devolverle el foco al cerrar, aunque se haya repintado). */
  #lastEdited: string | null = null;

  // ---------------------------------------------------------------- propiedades

  /** Los registros: `{id, title, meta?, detail?, avatar?, icon?, badge?, tags?, proof?, note?, locked?, removable?, removeText?, values?}`. */
  get items(): EntryItem[] {
    return this.#items;
  }
  set items(v: EntryItem[] | null | undefined) {
    const before = this.#items;
    this.#items = cleanEntries(v);
    // Lo que llegó nuevo (después de agregar) se ilumina; la primera carga no.
    if (before.length || this.#editing) {
      for (const id of newIds(before, this.#items)) this.#fresh.add(id);
      clearTimeout(this.#freshTimer);
      if (this.#fresh.size) this.#freshTimer = window.setTimeout(() => this.#unfresh(), NEW_MS);
    }
    if (this.#confirming && !this.#items.some((x) => x.id === this.#confirming)) this.#confirming = null;
    this.#schedule();
  }
  /** El formulario del panel: campos o secciones de `<nx-form>`. Sin él, agregar y editar solo avisan. */
  get schema(): EntriesSchema | null {
    return this.#schema;
  }
  set schema(v: EntriesSchema | null | undefined) {
    this.#schema = Array.isArray(v) && v.length ? v : null;
    if (this.#form) this.#applySchema();
    this.#schedule();
  }
  /** Los errores del servidor para el formulario del panel (`{documento: "Ya está registrado"}`). */
  get errors(): Record<string, string> {
    return { ...this.#errors };
  }
  set errors(v: Record<string, string> | null | undefined) {
    this.#errors = {};
    if (v && typeof v === "object") for (const [k, m] of Object.entries(v)) if (typeof m === "string" && m) this.#errors[k] = m;
    if (this.#form) this.#form.errors = this.#errors;
  }
  /** El nivel del título (2 a 6; 3 por defecto). */
  get headingLevel(): number {
    const n = Math.round(Number(this.getAttribute("heading-level")));
    return n >= 2 && n <= 6 ? n : 3;
  }
  set headingLevel(v: number | null | undefined) {
    setAttr(this, "heading-level", v);
  }
  get layout(): EntriesLayout {
    return cleanLayout(this.getAttribute("layout"));
  }
  set layout(v: EntriesLayout | null | undefined) {
    setAttr(this, "layout", v === "list" ? null : v);
  }
  /** Solo para leer: sin agregar, editar ni quitar. */
  get readonly(): boolean {
    return boolAttr(this, "readonly");
  }
  set readonly(v: boolean) {
    this.toggleAttribute("readonly", !!v);
  }
  get labels(): EntriesLabels {
    return this.#labels;
  }
  set labels(v: Partial<EntriesLabels> | null | undefined) {
    this.#labels = mergeLabels(ENTRIES_LABELS, v);
    this.#schedule();
  }
  /** El formulario del panel mientras está abierto (para `fill()`), o `null`. */
  get form(): HTMLElement | null {
    return this.#dialog?.open ? (this.#form ?? null) : null;
  }

  // ---------------------------------------------------------------- API

  /** Agrega (`null`) o edita un registro, como sus botones: avisa `nx-entries-edit` y, si hay
   *  `schema` y nadie lo canceló, abre el panel. Devuelve si lo abrió. */
  edit(id: string | null = null): boolean {
    const item = id === null ? null : (this.#items.find((x) => x.id === id) ?? null);
    if (id !== null && !item) return false;
    if (!emit(this, "nx-entries-edit", { id, item } satisfies EntriesEditDetail, true) || !this.#schema) return false;
    void this.#open(id, item);
    return true;
  }
  /** Cierra el panel sin preguntar (la app ya guardó). */
  close(): void {
    this.#dialog?.close(undefined, "form");
  }

  // ---------------------------------------------------------------- ciclo de vida

  connectedCallback(): void {
    upgrade(this);
    if (!this.#list) this.#build();
    for (const el of [this.#head!, this.#list!, this.#emptyEl!]) if (el.parentNode !== this) this.append(el);
    this.#render();
  }

  disconnectedCallback(): void {
    clearTimeout(this.#freshTimer);
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "items" || name === "schema" || name === "errors" || name === "labels") {
      if (value === null) return void ((this as unknown as Record<string, unknown>)[name] = null);
      try {
        (this as unknown as Record<string, unknown>)[name] = JSON.parse(value);
      } catch {
        console.warn(`[nx-entries] el atributo "${name}" no es JSON válido`);
      }
      return;
    }
    this.#schedule();
  }

  // ---------------------------------------------------------------- pintar

  #build(): void {
    this.#title = h("h3", { class: "nx-entries__title", id: `${this.#uid}-t` });
    this.#addBtn = h("button", { type: "button", class: "nx-entries__add", "data-act": "add" }, glyph(PLUS), h("span"));
    this.#head = h("div", { class: "nx-entries__head" }, this.#title, this.#addBtn);
    this.#list = h("ul", { class: "nx-entries__list", role: "list" });
    this.#emptyEl = h("p", { class: "nx-entries__empty" });
    this.addEventListener("click", (e) => this.#onClick(e));
    this.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.#confirming && (e.target as Element).closest?.(".nx-entries__confirm")) {
        e.preventDefault();
        this.#cancelRemove();
      }
    });
  }

  #schedule(): void {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      this.#queued = false;
      if (this.isConnected && this.#list) this.#render();
    });
  }

  #canEdit(item: EntryItem): boolean {
    return !this.readonly && !item.locked;
  }

  #render(): void {
    this.#queued = false;
    const L = this.#labels;
    const list = this.#list!;
    const heading = (this.heading ?? "").trim();
    const add = this.readonly ? "" : (this.addLabel ?? "").trim();
    // El título con el nivel pedido (se rehace solo si cambia).
    const tag = `h${this.headingLevel}`;
    if (this.#title!.localName !== tag) {
      const t = h(tag as "h3", { class: "nx-entries__title", id: `${this.#uid}-t` });
      this.#title!.replaceWith(t);
      this.#title = t;
    }
    this.#title!.textContent = heading;
    this.#title!.hidden = !heading;
    this.#addBtn!.querySelector("span")!.textContent = add;
    this.#addBtn!.hidden = !add;
    this.#head!.hidden = !heading && !add;
    this.dataset.layout = this.layout;
    if (heading) list.setAttribute("aria-labelledby", this.#title!.id);
    else list.removeAttribute("aria-labelledby");

    // El foco: el botón que lo tenía, por registro y acción.
    const active = document.activeElement;
    let focus: { id: string; act: string } | null = null;
    if (active instanceof HTMLElement && list.contains(active)) {
      const li = active.closest<HTMLElement>(".nx-entries__item");
      if (li?.dataset.id && active.dataset.act) focus = { id: li.dataset.id, act: active.dataset.act };
    }

    const keep = new Set<string>();
    this.#items.forEach((item, i) => {
      keep.add(item.id);
      let li = this.#nodes.get(item.id);
      if (!li) {
        li = h("li", { class: "nx-entries__item", "data-id": item.id });
        this.#nodes.set(item.id, li);
      }
      li.replaceChildren(...this.#row(item, L));
      li.classList.toggle("is-new", this.#fresh.has(item.id));
      li.classList.toggle("is-confirming", this.#confirming === item.id);
      li.classList.toggle("is-locked", !!item.locked);
      if (list.children[i] !== li) list.insertBefore(li, list.children[i] ?? null);
    });
    for (const [id, li] of this.#nodes)
      if (!keep.has(id)) {
        li.remove();
        this.#nodes.delete(id);
      }
    list.hidden = !this.#items.length;
    this.#emptyEl!.textContent = (this.empty ?? "").trim() || L.empty;
    this.#emptyEl!.hidden = !!this.#items.length;

    if (focus) {
      const li = this.#nodes.get(focus.id);
      // Al confirmar, el foco va a «Cancelar»; al volver, al botón de quitar.
      const want = this.#confirming === focus.id ? '[data-act="remove-no"]' : `[data-act="${focus.act}"]`;
      (li?.querySelector<HTMLElement>(want) ?? li?.querySelector<HTMLElement>('[data-act="remove"]'))?.focus();
    }
  }

  /** El contenido de un registro. */
  #row(item: EntryItem, L: EntriesLabels): Node[] {
    const out: Node[] = [];
    const lead = this.#lead(item);
    if (lead) out.push(lead);
    const body = h("div", { class: "nx-entries__body" });
    const title = h("p", { class: "nx-entries__name" }, h("span", null, item.title));
    if (item.badge) title.append(h("span", { class: "nx-entries__badge", "data-tone": cleanTone(item.badgeTone) }, item.badge));
    body.append(title);
    if (item.meta) body.append(h("p", { class: "nx-entries__meta" }, item.meta));
    if (item.detail || item.proof) {
      body.append(h("p", { class: "nx-entries__detail" }, item.detail ? h("span", null, item.detail) : null, item.proof ? h("span", { class: "nx-entries__proof" }, glyph(CHECK), item.proof) : null));
    }
    if (item.tags?.length) {
      body.append(
        h(
          "ul",
          { class: "nx-entries__tags", role: "list" },
          ...item.tags.map((t) => {
            const tag = typeof t === "string" ? { label: t } : t;
            return h("li", { class: "nx-entries__tag" }, tag.icon && hasIcon(tag.icon) ? icon(tag.icon) : null, tag.label);
          }),
        ),
      );
    }
    if (item.note) {
      const tone = cleanTone(item.note.tone, "warning");
      body.append(
        h(
          "div",
          { class: "nx-entries__note", "data-tone": tone, role: tone === "danger" ? "alert" : null },
          glyph(tone === "info" || tone === "success" ? INFO : ALERT),
          h("p", null, item.note.text),
          item.note.action ? h("button", { type: "button", class: "nx-entries__note-act", "data-act": "note" }, item.note.action) : null,
        ),
      );
    }
    out.push(body);
    const acts = h("div", { class: "nx-entries__acts" });
    if (item.locked) {
      const why = typeof item.locked === "string" ? item.locked : L.locked;
      const lock = glyph(LOCK, "nx-entries__lock");
      lock.removeAttribute("aria-hidden");
      lock.setAttribute("role", "img");
      lock.setAttribute("aria-label", why);
      lock.title = why;
      acts.append(lock);
    } else if (!this.readonly && this.#confirming !== item.id) {
      acts.append(h("button", { type: "button", class: "nx-entries__btn", "data-act": "edit", "aria-label": fillTitle(L.edit, item.title), title: fillTitle(L.edit, item.title) }, glyph(PENCIL)));
      if (item.removable !== false) acts.append(h("button", { type: "button", class: "nx-entries__btn", "data-act": "remove", "aria-label": fillTitle(L.remove, item.title), title: fillTitle(L.remove, item.title) }, glyph(TRASH)));
    }
    out.push(acts);
    if (this.#confirming === item.id) {
      out.push(
        h(
          "div",
          { class: "nx-entries__confirm", role: "group", "aria-label": fillTitle(L.confirmRemove, item.title) },
          h("p", null, h("strong", null, fillTitle(L.confirmRemove, item.title)), item.removeText ? ` ${item.removeText}` : ""),
          h("button", { type: "button", class: "nx-entries__cbtn", "data-act": "remove-no" }, L.cancel),
          h("button", { type: "button", class: "nx-entries__cbtn is-danger", "data-act": "remove-yes" }, L.confirm),
        ),
      );
    }
    return out;
  }

  /** La cara: foto, iniciales con el color de la persona o un ícono. En la línea de tiempo, un punto. */
  #lead(item: EntryItem): HTMLElement | null {
    if (this.layout === "timeline") return h("span", { class: "nx-entries__dot", "aria-hidden": "true" });
    const av = item.avatar ?? "";
    if (av) {
      const src = URLISH.test(av) ? safeImageSrc(av) : undefined;
      if (src) return h("span", { class: "nx-entries__face", "aria-hidden": "true" }, h("img", { src, alt: "", referrerpolicy: "no-referrer" }));
      if (!URLISH.test(av)) {
        const face = h("span", { class: "nx-entries__face", "aria-hidden": "true" }, initials(av));
        face.style.setProperty("--_h", String(hueOf(av)));
        return face;
      }
    }
    if (item.icon && hasIcon(item.icon)) return h("span", { class: "nx-entries__icon", "aria-hidden": "true" }, icon(item.icon));
    return null;
  }

  #unfresh(): void {
    this.#fresh.clear();
    for (const li of this.#nodes.values()) li.classList.remove("is-new");
  }

  // ---------------------------------------------------------------- lo que hace la persona

  #onClick(e: MouseEvent): void {
    const b = (e.target as Element).closest?.<HTMLElement>("[data-act]");
    // Lo del panel (el formulario y su pie) no es de la lista.
    if (!b || !this.contains(b) || this.#dialog?.contains(b) || (b as HTMLButtonElement).disabled) return;
    const act = b.dataset.act;
    if (act === "add") return void this.edit(null);
    const li = b.closest<HTMLElement>(".nx-entries__item");
    const item = li && this.#items.find((x) => x.id === li.dataset.id);
    if (!item) return;
    switch (act) {
      case "edit":
        if (this.#canEdit(item)) this.edit(item.id);
        return;
      case "remove":
        if (!this.#canEdit(item) || item.removable === false) return;
        this.#confirming = item.id;
        this.#render();
        this.#nodes.get(item.id)?.querySelector<HTMLElement>('[data-act="remove-no"]')?.focus();
        return;
      case "remove-no":
        return this.#cancelRemove();
      case "remove-yes": {
        this.#confirming = null;
        if (emit(this, "nx-entries-remove", { id: item.id, item } satisfies EntriesRemoveDetail, true)) {
          const i = this.#items.indexOf(item);
          this.#items = this.#items.filter((x) => x !== item);
          this.#render();
          // El foco no se pierde: al registro que quedó en su lugar, o a agregar.
          const next = this.#items[Math.min(i, this.#items.length - 1)];
          const to = next ? this.#nodes.get(next.id)?.querySelector<HTMLElement>("[data-act]") : this.#addBtn && !this.#addBtn.hidden ? this.#addBtn : null;
          to?.focus();
        } else this.#render();
        return;
      }
      case "note":
        if (item.note?.action) emit(this, "nx-entries-action", { id: item.id, action: item.note.action, item } satisfies EntriesActionDetail);
        return;
    }
  }

  #cancelRemove(): void {
    const id = this.#confirming;
    this.#confirming = null;
    this.#render();
    if (id) this.#nodes.get(id)?.querySelector<HTMLElement>('[data-act="remove"]')?.focus();
  }

  // ---------------------------------------------------------------- el panel

  async #open(id: string | null, item: EntryItem | null): Promise<void> {
    await Promise.all([import("../dialog/index"), import("../form/index"), import("../button/index")]);
    if (!this.isConnected) return;
    const L = this.#labels;
    if (!this.#dialog) {
      this.#form = document.createElement("nx-form") as Form;
      this.#form.setAttribute("variant", "plain");
      this.#form.setAttribute("index", "none");
      this.#form.setAttribute("no-footer", "");
      this.#form.addEventListener("nx-form-submit", (e) => this.#onSubmit(e as CustomEvent<FormSubmitDetail>));
      const cancel = h("nx-button", { variant: "secondary", "data-act": "panel-cancel", "log-mode": "none" });
      const save = h("nx-button", { variant: "primary", "data-act": "panel-save", "log-mode": "none" });
      cancel.addEventListener("click", () => this.#dialog?.close(undefined, "button"));
      save.addEventListener("click", () => this.#form?.submit());
      const foot = h("div", { slot: "footer", class: "nx-entries__foot" }, cancel, save);
      this.#dialog = document.createElement("nx-dialog") as Dialog;
      this.#dialog.setAttribute("mode", "panel");
      this.#dialog.append(this.#form, foot);
      this.#dialog.addEventListener("nx-dialog-close", (e) => {
        if (e.target === this.#dialog) this.#editing = null;
      });
      // El diálogo devuelve el foco a quien lo abrió; si la app repintó la lista mientras tanto (guardó
      // en su servidor y asignó `items`), ese botón ya no está: va al del mismo registro, o a agregar.
      this.#dialog.addEventListener("nx-open-change", (e) => {
        if (e.target !== this.#dialog || (e as CustomEvent<{ open: boolean }>).detail.open) return;
        const a = document.activeElement;
        // Ya está en la página (no en el panel que se cierra): el diálogo lo devolvió bien.
        if (a && a !== document.body && a.isConnected && !this.#dialog?.contains(a)) return;
        const li = this.#lastEdited ? this.#nodes.get(this.#lastEdited) : undefined;
        const to = li?.querySelector<HTMLElement>('[data-act="edit"]') ?? li?.querySelector<HTMLElement>("[data-act]") ?? (this.#addBtn && !this.#addBtn.hidden ? this.#addBtn : null);
        to?.focus({ preventScroll: true });
      });
      this.append(this.#dialog);
    }
    this.#editing = { id };
    this.#lastEdited = id;
    this.#applySchema();
    const form = this.#form!;
    form.values = { ...(item?.values ?? {}) };
    form.errors = this.#errors = {};
    form.markClean?.();
    const d = this.#dialog;
    d.setAttribute("heading", item ? item.title : (this.addLabel ?? "").trim() || L.add);
    setAttr(d, "description", (this.heading ?? "").trim() || null);
    d.querySelector('[data-act="panel-cancel"]')!.setAttribute("label", L.cancel);
    d.querySelector('[data-act="panel-save"]')!.setAttribute("label", item ? L.save : L.create);
    void d.show();
    emit(this, "nx-entries-open", { id, form } satisfies EntriesOpenDetail);
  }

  #applySchema(): void {
    const form = this.#form!;
    const s = this.#schema;
    if (isSections(s)) form.sections = s as FormSection[];
    else form.fields = (s as FormField[] | null) ?? [];
  }

  #onSubmit(e: CustomEvent<FormSubmitDetail>): void {
    e.stopPropagation();
    const ed = this.#editing;
    if (!ed) return;
    const item = ed.id === null ? null : (this.#items.find((x) => x.id === ed.id) ?? null);
    const detail: EntriesSaveDetail = { id: ed.id, item, values: e.detail.values, sources: e.detail.sources };
    if (emit(this, "nx-entries-save", detail, true)) this.close();
  }
}
