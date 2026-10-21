/**
 * `<nx-documents>`: los documentos de una persona, por tipo. La cédula, el RUT, el pasaporte, la
 * firma, el certificado bancario: se suben una vez y los trámites que los piden los toman de aquí.
 *
 * - **El estado se ve sin abrir nada.** Cada documento en su tarjeta, con su miniatura (o un dibujo
 *   del tipo) y una línea de estado con el tono de lo que pide: falta, rechazado, vencido, vence en
 *   N días, en revisión o vigente. Lo que pide atención va primero.
 * - **A dónde fue tu documento.** El detalle (un panel lateral) dice qué se leyó de él, qué se
 *   comprobó, quién lo pide y **quién lo ha usado** («Viáticos · VIA-0331 · tiquete a Bogotá»),
 *   cuándo se subió y por quién.
 * - **Subir o reemplazar en el mismo panel**: elegir o soltar el archivo (tipo y tamaño se revisan
 *   antes) y, con `handoff-endpoint`, «Usar el celular» con `<nx-handoff>`: la foto llega sola. El
 *   archivo sale en `nx-documents-file`; la app lo sube y lo lee (con `busy`) y asigna `items`: el
 *   panel muestra lo que quedó. Si vuelve rechazado, el motivo se ve ahí mismo para intentarlo otra vez.
 *
 * El contrato del lado del servidor (lo que hace que otro módulo tome el documento sin pedirlo de
 * nuevo y que el uso quede registrado) está en `INTEGRATION.md`.
 */
import { attrProps, Base, upgrade } from "../../core/define";
import { emit, h, safeHref, safeImageSrc, setAttr } from "../../core/dom";
import { glyph } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import { nxFormat, resolveLocale } from "../../core/locale";
import { acceptsFile, formatBytes } from "../capture/logic";
import { cleanDocuments, DOCUMENTS_SOON, documentState, documentsSummary, elapsed, sortDocuments, summaryText, todayISO } from "./logic";
import type { DocumentItem, DocumentsFileDetail, DocumentsLabels, DocumentsOpenDetail, DocumentsSummary, DocumentsUploadDetail } from "./types";

export const DOCUMENTS_LABELS: DocumentsLabels = {
  missing: "Falta",
  rejected: "Rechazado",
  review: "En revisión",
  expired: "Vencido",
  expiresToday: "Vence hoy",
  expiresTomorrow: "Vence mañana",
  expiresIn: "Vence en {n} días",
  validUntil: "Vigente hasta {date}",
  valid: "Vigente",
  usedIn: "Usado en {n} trámites",
  usedInOne: "Usado en 1 trámite",
  list: "Documentos",
  read: "Lo que se leyó",
  askedBy: "Lo piden",
  uses: "Quién lo ha usado",
  noUses: "Ningún trámite todavía.",
  added: "Subido el {date} por {by}.",
  addedNoBy: "Subido el {date}.",
  view: "Ver el archivo",
  close: "Cerrar",
  done: "Listo",
  replace: "Reemplazar",
  upload: "Subir",
  uploadHint: "Súbelo una vez: lo toman los trámites que lo piden.",
  replaceHint: "La versión anterior queda en el historial del documento.",
  choose: "Elige un archivo",
  drop: "o suéltalo aquí",
  limits: "PDF o imagen, hasta {max}",
  limitsAny: "Hasta {max}",
  or: "o",
  reading: "Leyendo {file}…",
  saved: "Listo: quedó guardado.",
  badType: "Ese tipo de archivo no sirve: sube un PDF o una imagen.",
  tooBig: "El archivo pasa de {max}.",
  sumMissing: "Faltan {n}",
  sumMissingOne: "Falta 1",
  sumExpiring: "{n} por vencer",
  sumExpired: "{n} vencidos",
  sumExpiredOne: "1 vencido",
  sumReview: "{n} en revisión",
  sumOk: "Todos al día",
};

const ACCEPT = ".pdf,image/*";
const MAX_SIZE = 20 * 1024 * 1024;
const UPLOAD = '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>';
const CHECK = '<path d="M20 6 9 17l-5-5"/>';
const LOCK = '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
const ALERT = '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>';
const HEART = '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>';
const SIGN = '<path d="M3 17c3-1 4-6 6-6s-1 7 2 7 3-5 5-5 1 3 3 3 2-1 2-1"/>';

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

type Dialog = HTMLElement & { show(): Promise<unknown>; close(value?: string, reason?: string): boolean; open: boolean };
type View = { mode: "detail" | "upload"; id: string; saved?: boolean; reading?: string; error?: string };

let uid = 0;

export class NxDocuments extends Base {
  static {
    attrProps(this, ["today", "accept", "handoffEndpoint", "busy"]);
  }
  /** La fecha de hoy (ISO) para los vencimientos. Sin ella, la del equipo. */
  declare today: string | null;
  /** Los archivos que sirven, con la sintaxis de `<input accept>` (por defecto PDF e imágenes). */
  declare accept: string | null;
  /** Con él, «Usar el celular» (`<nx-handoff>`) en el panel para subir: del mismo origen. */
  declare handoffEndpoint: string | null;
  /** El documento que la app está subiendo y leyendo (su `id`): el panel muestra que espera. */
  declare busy: string | null;
  static observedAttributes = ["items", "today", "soon", "accept", "max-size", "handoff-endpoint", "busy", "order", "locale", "labels"];

  #uid = `nx-docs${++uid}`;
  #items: DocumentItem[] = [];
  #labels: DocumentsLabels = DOCUMENTS_LABELS;
  #list?: HTMLUListElement;
  #dialog?: Dialog;
  #body?: HTMLDivElement;
  #foot?: HTMLDivElement;
  #view: View | null = null;
  #queued = false;

  // ---------------------------------------------------------------- propiedades

  /** Los documentos: `{id, name, status?, kind?, thumbnail?, detail?, reason?, expires?, issued?,
   *  askedBy?, uses?, fields?, checks?, addedAt?, addedBy?, note?, href?, replaceable?}`. */
  get items(): DocumentItem[] {
    return this.#items;
  }
  set items(v: DocumentItem[] | null | undefined) {
    this.#items = cleanDocuments(v);
    this.#settle();
    this.#schedule();
  }
  /** Desde cuántos días antes de vencer se avisa (60 por defecto). */
  get soon(): number {
    const n = Math.round(Number(this.getAttribute("soon")));
    return n >= 0 && this.getAttribute("soon") !== null && this.getAttribute("soon") !== "" ? n : DOCUMENTS_SOON;
  }
  set soon(v: number | null | undefined) {
    setAttr(this, "soon", v);
  }
  /** El tamaño máximo de un archivo, en bytes (20 MB por defecto). */
  get maxSize(): number {
    const n = Number(this.getAttribute("max-size"));
    return n > 0 ? n : MAX_SIZE;
  }
  set maxSize(v: number | null | undefined) {
    setAttr(this, "max-size", v);
  }
  /** `status` (por defecto): lo que pide atención primero. `none`: el orden en que llegan. */
  get order(): "status" | "none" {
    return this.getAttribute("order") === "none" ? "none" : "status";
  }
  set order(v: "status" | "none" | null | undefined) {
    setAttr(this, "order", v === "status" ? null : v);
  }
  get locale(): string {
    return resolveLocale(this);
  }
  set locale(v: string | null | undefined) {
    setAttr(this, "locale", v);
  }
  get labels(): DocumentsLabels {
    return this.#labels;
  }
  set labels(v: Partial<DocumentsLabels> | null | undefined) {
    this.#labels = mergeLabels(DOCUMENTS_LABELS, v);
    this.#schedule();
  }
  /** Cuántos faltan, vencieron, están por vencer o en revisión (para el estado de una pestaña). */
  get summary(): DocumentsSummary {
    return documentsSummary(this.#items, this.#today(), this.soon);
  }
  /** El mismo resumen en palabras: «Faltan 2 · 1 por vencer», o «Todos al día». */
  get summaryText(): string {
    return summaryText(this.summary, this.#labels);
  }

  // ---------------------------------------------------------------- API

  /** Abre el detalle de un documento (o, si falta, el panel para subirlo). */
  open(id: string): boolean {
    const item = this.#items.find((d) => d.id === id);
    if (!item) return false;
    if (item.status === "missing" || item.status === "rejected") return this.upload(id);
    if (!emit(this, "nx-documents-open", { id, item } satisfies DocumentsOpenDetail, true)) return false;
    void this.#show({ mode: "detail", id });
    return true;
  }
  /** Abre el panel para subir o reemplazar un documento. */
  upload(id: string): boolean {
    const item = this.#items.find((d) => d.id === id);
    if (!item || item.replaceable === false && item.status !== "missing") return false;
    if (!emit(this, "nx-documents-upload", { id, item } satisfies DocumentsUploadDetail, true)) return false;
    void this.#show({ mode: "upload", id });
    return true;
  }
  close(): void {
    this.#dialog?.close(undefined, "api");
  }

  // ---------------------------------------------------------------- ciclo de vida

  connectedCallback(): void {
    upgrade(this);
    if (!this.#list) {
      this.#list = h("ul", { class: "nx-documents__list", role: "list" });
      this.#list.addEventListener("click", (e) => {
        const b = (e.target as Element).closest?.<HTMLElement>(".nx-documents__card");
        if (b?.dataset.id) this.open(b.dataset.id);
      });
    }
    if (this.#list.parentNode !== this) this.prepend(this.#list);
    this.#render();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "items" || name === "labels") {
      if (value === null) return void ((this as unknown as Record<string, unknown>)[name] = null);
      try {
        (this as unknown as Record<string, unknown>)[name] = JSON.parse(value);
      } catch {
        console.warn(`[nx-documents] el atributo "${name}" no es JSON válido`);
      }
      return;
    }
    if (name === "busy" && value === null) this.#settle();
    this.#schedule();
  }

  // ---------------------------------------------------------------- pintar

  #today(): string {
    const t = (this.today ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : todayISO();
  }
  #fmt() {
    return nxFormat(resolveLocale(this));
  }

  #schedule(): void {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      this.#queued = false;
      if (!this.isConnected) return;
      this.#render();
      if (this.#dialog?.open && this.#view) this.#paintPanel();
    });
  }

  #render(): void {
    const list = this.#list;
    if (!list) return;
    const L = this.#labels;
    const today = this.#today();
    const fmt = this.#fmt();
    const items = this.order === "none" ? this.#items : sortDocuments(this.#items, today, this.soon);
    list.setAttribute("aria-label", L.list);
    // El foco: la tarjeta que lo tenía (por `id`).
    const focused = (document.activeElement as HTMLElement | null)?.closest?.<HTMLElement>(".nx-documents__card")?.dataset.id;
    list.replaceChildren(
      ...items.map((d) => {
        const st = documentState(d, today, L, (s) => fmt.date(s), this.soon);
        const uses = d.uses?.length ?? 0;
        const meta = st.key === "missing" || st.key === "rejected" ? (d.reason ?? "") : uses ? (uses === 1 ? L.usedInOne : fill(L.usedIn, { n: uses })) : (d.detail ?? (st.key === "review" ? (d.reason ?? "") : ""));
        const card = h(
          "button",
          { type: "button", class: "nx-documents__card", "data-id": d.id, "data-state": st.key, "aria-describedby": `${this.#uid}-${d.id}-s` },
          h("span", { class: "nx-documents__thumb" }, this.#thumb(d, st.key === "missing")),
          h(
            "span",
            { class: "nx-documents__body" },
            h("span", { class: "nx-documents__name" }, d.name),
            h("span", { class: "nx-documents__state", "data-tone": st.tone, id: `${this.#uid}-${d.id}-s` }, h("span", { class: "nx-documents__dot", "aria-hidden": "true" }), st.label),
            meta ? h("span", { class: "nx-documents__meta" }, meta) : null,
          ),
        );
        if (this.busy === d.id) card.setAttribute("aria-busy", "true");
        return h("li", null, card);
      }),
    );
    if (focused) [...list.querySelectorAll<HTMLElement>(".nx-documents__card")].find((c) => c.dataset.id === focused)?.focus();
  }

  /** La miniatura: la imagen, o un dibujo del tipo; si falta, la flecha de subir. */
  #thumb(d: DocumentItem, missing: boolean, big = false): HTMLElement {
    if (missing) return h("span", { class: "nx-documents__up", "aria-hidden": "true" }, glyph(UPLOAD));
    const src = d.thumbnail ? safeImageSrc(d.thumbnail) : undefined;
    if (src) return h("img", { class: "nx-documents__img", src, alt: "", referrerpolicy: "no-referrer", loading: "lazy" });
    const kind = d.kind ?? "page";
    const paper = h("span", { class: `nx-documents__paper${big ? " is-big" : ""}`, "data-kind": kind, "aria-hidden": "true" }, h("i"));
    if (kind === "medical") paper.append(glyph(HEART));
    if (kind === "signature") paper.append(glyph(SIGN));
    return paper;
  }

  // ---------------------------------------------------------------- el panel

  async #show(view: View): Promise<void> {
    await import("../dialog/index");
    if (!this.isConnected) return;
    if (!this.#dialog) {
      this.#body = h("div", { class: "nx-documents__panel" });
      this.#foot = h("div", { slot: "footer", class: "nx-documents__foot" });
      this.#dialog = document.createElement("nx-dialog") as Dialog;
      this.#dialog.setAttribute("mode", "panel");
      this.#dialog.append(this.#body, this.#foot);
      this.#dialog.addEventListener("click", (e) => this.#onPanelClick(e));
      this.#dialog.addEventListener("change", (e) => this.#onFile(e));
      this.#dialog.addEventListener("nx-dialog-close", (e) => {
        if (e.target === this.#dialog) this.#view = null;
      });
      this.append(this.#dialog);
    }
    this.#view = view;
    this.#paintPanel();
    if (!this.#dialog.open) void this.#dialog.show();
  }

  /** La app terminó de subir (asignó `items` o quitó `busy`): el panel muestra cómo quedó. */
  #settle(): void {
    const v = this.#view;
    if (!v?.reading || this.busy === v.id) return;
    const item = this.#items.find((d) => d.id === v.id);
    if (!item) return;
    if (item.status === "rejected") this.#view = { mode: "upload", id: v.id, error: item.reason || this.#labels.rejected };
    else if (item.status !== "missing") this.#view = { mode: "detail", id: v.id, saved: true };
  }

  #paintPanel(): void {
    const v = this.#view;
    const d = v && this.#items.find((x) => x.id === v.id);
    if (!v || !d || !this.#dialog) return;
    const L = this.#labels;
    const dlg = this.#dialog;
    dlg.setAttribute("heading", d.name);
    if (v.mode === "detail") this.#paintDetail(d, v);
    else this.#paintUpload(d, v);
    const desc = v.mode === "upload" ? (d.status === "missing" || d.status === "rejected" ? L.upload : L.replace) : documentState(d, this.#today(), L, (s) => this.#fmt().date(s), this.soon).label;
    dlg.setAttribute("description", desc);
  }

  #paintDetail(d: DocumentItem, v: View): void {
    const L = this.#labels;
    const today = this.#today();
    const fmt = this.#fmt();
    const st = documentState(d, today, L, (s) => fmt.date(s), this.soon);
    const parts: (Node | null)[] = [];
    if (v.saved) parts.push(h("p", { class: "nx-documents__saved", role: "status" }, glyph(CHECK), L.saved));
    parts.push(h("div", { class: "nx-documents__preview" }, this.#thumb(d, false, true)));
    const frac = elapsed(d, today);
    if (frac !== null) {
      parts.push(
        h(
          "div",
          { class: "nx-documents__vig", "data-tone": st.tone },
          h("span", { class: "nx-documents__vig-bar", role: "img", "aria-label": st.label }, h("i", { style: `inline-size:${(frac * 100).toFixed(1)}%` })),
          h("span", null, `${fmt.date(d.issued!)} – ${fmt.date(d.expires!)} · ${st.label}`),
        ),
      );
    }
    if (d.note) parts.push(h("p", { class: "nx-documents__note" }, glyph(LOCK), h("span", null, d.note)));
    if (d.status === "review" && d.reason) parts.push(h("p", { class: "nx-documents__note" }, glyph(ALERT), h("span", null, d.reason)));
    if (d.fields?.length) {
      parts.push(
        h(
          "section",
          { class: "nx-documents__sec" },
          h("h3", null, L.read),
          h("dl", { class: "nx-documents__fields" }, ...d.fields.map((f) => h("div", null, h("dt", null, f.label), h("dd", null, f.value)))),
        ),
      );
    }
    if (d.checks?.length) parts.push(h("ul", { class: "nx-documents__checks", role: "list" }, ...d.checks.map((c) => h("li", null, glyph(CHECK), c))));
    if (d.askedBy?.length) parts.push(h("section", { class: "nx-documents__sec" }, h("h3", null, L.askedBy), h("ul", { class: "nx-documents__chips", role: "list" }, ...d.askedBy.map((a) => h("li", null, a)))));
    parts.push(
      h(
        "section",
        { class: "nx-documents__sec" },
        h("h3", null, L.uses),
        d.uses?.length
          ? h("ul", { class: "nx-documents__uses", role: "list" }, ...d.uses.map((u) => h("li", null, h("time", { datetime: u.at }, fmt.date(u.at)), h("span", null, h("strong", null, u.by), u.purpose ? ` · ${u.purpose}` : ""))))
          : h("p", { class: "nx-documents__none" }, L.noUses),
      ),
    );
    if (d.addedAt) parts.push(h("p", { class: "nx-documents__added" }, d.addedBy ? fill(L.added, { date: fmt.date(d.addedAt), by: d.addedBy }) : fill(L.addedNoBy, { date: fmt.date(d.addedAt) })));
    this.#body!.replaceChildren(...parts.filter((p): p is Node => !!p));

    const href = safeHref(d.href);
    this.#foot!.replaceChildren(
      ...(href ? [h("a", { class: "nx-documents__link", href, target: "_blank", rel: "noopener noreferrer" }, L.view)] : []),
      h("span", { class: "nx-documents__grow" }),
      h("button", { type: "button", class: "nx-documents__btn", "data-act": "close" }, v.saved ? L.done : L.close),
      ...(d.replaceable !== false && !v.saved ? [h("button", { type: "button", class: "nx-documents__btn is-primary", "data-act": "replace" }, L.replace)] : []),
    );
  }

  #paintUpload(d: DocumentItem, v: View): void {
    const L = this.#labels;
    const fmt = this.#fmt();
    const id = `${this.#uid}-file`;
    const accept = (this.accept ?? "").trim() || ACCEPT;
    const busy = this.busy === d.id || !!v.reading;
    const missing = d.status === "missing" || d.status === "rejected";
    const max = formatBytes(this.maxSize, fmt.locale);
    const parts: (Node | null)[] = [h("p", { class: "nx-documents__hint" }, missing ? (d.reason && d.status === "missing" ? `${d.reason}. ${L.uploadHint}` : L.uploadHint) : L.replaceHint)];
    if (busy) {
      parts.push(h("div", { class: "nx-documents__busy", role: "status" }, h("span", { class: "nx-documents__bar", "aria-hidden": "true" }, h("i")), h("p", null, fill(L.reading, { file: v.reading ?? d.name }))));
    } else {
      parts.push(
        h(
          "label",
          { class: "nx-documents__drop", for: id },
          h("input", { type: "file", id, class: "nx-documents__input", accept, "aria-describedby": `${id}-lim${v.error ? ` ${id}-err` : ""}` }),
          h("span", { class: "nx-documents__up", "aria-hidden": "true" }, glyph(UPLOAD)),
          h("span", null, h("strong", null, L.choose), ` ${L.drop}`, h("br"), h("span", { class: "nx-documents__lim", id: `${id}-lim` }, fill(accept === ACCEPT ? L.limits : L.limitsAny, { max }))),
        ),
      );
      if (v.error) parts.push(h("p", { class: "nx-documents__error", id: `${id}-err`, role: "alert" }, glyph(ALERT), v.error));
      const endpoint = (this.handoffEndpoint ?? "").trim();
      if (endpoint) {
        void import("../handoff/index");
        const ho = h("nx-handoff", { endpoint, kind: "photo", for: id, accept });
        parts.push(h("p", { class: "nx-documents__or" }, h("span", null, L.or)), ho);
      }
    }
    this.#body!.replaceChildren(...parts.filter((p): p is Node => !!p));
    this.#foot!.replaceChildren(h("span", { class: "nx-documents__grow" }), h("button", { type: "button", class: "nx-documents__btn", "data-act": "close" }, L.close));
  }

  #onPanelClick(e: MouseEvent): void {
    const b = (e.target as Element).closest?.<HTMLElement>("[data-act]");
    if (!b || !this.#dialog?.contains(b) || !this.#view) return;
    if (b.dataset.act === "close") this.#dialog.close(undefined, "button");
    else if (b.dataset.act === "replace") this.upload(this.#view.id);
  }

  /** Un archivo elegido (o el que llegó del celular al `<input>`): se revisa y sale a la app. */
  #onFile(e: Event): void {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.classList.contains("nx-documents__input")) return;
    const v = this.#view;
    const file = input.files?.[0];
    const item = v && this.#items.find((d) => d.id === v.id);
    if (!v || !file || !item) return;
    const L = this.#labels;
    const accept = (this.accept ?? "").trim() || ACCEPT;
    let error = "";
    if (!acceptsFile(accept, file.name, file.type)) error = L.badType;
    else if (file.size > this.maxSize) error = fill(L.tooBig, { max: formatBytes(this.maxSize, this.#fmt().locale) });
    if (error) {
      this.#view = { mode: "upload", id: v.id, error };
      this.#paintPanel();
      this.#dialog?.querySelector<HTMLElement>(".nx-documents__input")?.focus();
      return;
    }
    if (!emit(this, "nx-documents-file", { id: v.id, item, file } satisfies DocumentsFileDetail, true)) return;
    this.#view = { mode: "upload", id: v.id, reading: file.name };
    this.#paintPanel();
  }
}
