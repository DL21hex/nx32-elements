/**
 * `<nx-field>`: el campo de la casa. Envuelve un control (un `<input>`, `<select>` o `<textarea>`
 * nativo, `<nx-number>`, `<nx-select>`, `<nx-date-range>`… o un grupo de radios o casillas) y le pone
 * alrededor lo de todo campo, siempre en el mismo lugar:
 *
 * - arriba, la etiqueta (`label`), «Opcional» si se puede dejar vacío (`optional`) y, a la derecha,
 *   de dónde vino el dato (`source`: «Cédula», «REQ-118»…) hasta que la persona lo cambia;
 * - debajo, una sola línea: el error (`error`, en rojo), o un aviso que no bloquea (`warning`, en
 *   ámbar), o la ayuda (`hint`). Lo que se escribe borra el error, el aviso y el origen;
 * - en lectura (`text`), el valor como texto en lugar del control, con «—» si está vacío y candado
 *   con `locked`: la misma rejilla para leer y para editar.
 *
 * Conecta la accesibilidad sola: `<label for>` con el id del control (se lo pone si no tiene),
 * `aria-describedby` hacia el mensaje, `aria-invalid` con un error y `required`/`aria-required`. Un
 * grupo de radios o casillas se nombra como grupo (`role="group"` en el propio elemento).
 *
 * Light DOM. Los nodos del autor nunca se mueven (la hidratación de Solid sigue intacta): la
 * etiqueta va antes y el mensaje después, y CSS los ordena aunque el control llegue más tarde.
 * Dentro de `.nx-form-grid`, `span` dice cuántas de sus seis columnas ocupa.
 */
import { attrProps, Base, boolAttr, upgrade } from "../../core/define";
import { h } from "../../core/dom";
import { glyph } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import type { FieldActionDetail, FieldLabels, FieldSpan } from "./types";

export const FIELD_LABELS: FieldLabels = {
  optional: "Opcional",
  empty: "Sin dato",
  locked: "No se edita aquí",
  source: "Dato de {source}",
};

const ALERT = '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>';
const WARN = '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>';
const LOCK = '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
const SOURCE = '<path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4"/>';

/** Lo que cuenta como el control del campo (el primero, en orden de documento). */
const CONTROL = "input:not([type=hidden]), select, textarea, nx-number, nx-select, nx-date-range, nx-recurrence, nx-signature, [data-nx-control]";

let uid = 0;

export class NxField extends Base {
  static {
    attrProps(this, ["label", "hint", "error", "warning", "action", "source", "sourceDetail", "text"]);
  }
  /** La etiqueta, arriba del control. */
  declare label: string | null;
  /** La ayuda, debajo (cuando no hay error ni aviso). */
  declare hint: string | null;
  /** El error, en rojo: marca el control como inválido. Se borra cuando la persona lo cambia. */
  declare error: string | null;
  /** Un aviso que no bloquea, en ámbar («¿Quisiste decir gmail.com?»). Se borra al cambiar el valor. */
  declare warning: string | null;
  /** Un botón junto al error o al aviso («Usar gmail.com»): avisa con `nx-field-action`. */
  declare action: string | null;
  /** De dónde vino el dato («Cédula», «REQ-118»): un chip junto a la etiqueta hasta que la persona lo cambia. */
  declare source: string | null;
  /** El detalle del origen, al pasar el puntero y para el lector de pantalla («Leído de la cédula»). */
  declare sourceDetail: string | null;
  /** El campo se lee: muestra este texto en lugar del control («—» si está vacío). */
  declare text: string | null;
  static observedAttributes = ["label", "hint", "error", "warning", "action", "required", "optional", "source", "source-detail", "span", "text", "locked", "labels"];

  #uid = `nx-field${++uid}`;
  #labels: FieldLabels = FIELD_LABELS;
  #top?: HTMLDivElement;
  #label?: HTMLElement;
  #opt?: HTMLSpanElement;
  #src?: HTMLSpanElement;
  #view?: HTMLDivElement;
  #msg?: HTMLDivElement;
  #msgKey = "";
  #observer?: MutationObserver;
  #wired = new WeakSet<Element>();
  /** Los controles a los que el campo les puso `required` (los únicos a los que se lo quita). */
  #required = new WeakSet<Element>();

  // ---------------------------------------------------------------- propiedades

  /** Marca el control como obligatorio (`required` y `aria-required`). No pinta asterisco: lo que se
   *  puede dejar vacío se marca con `optional`. */
  get required(): boolean {
    return boolAttr(this, "required");
  }
  set required(v: boolean | null | undefined) {
    this.#bool("required", !!v);
  }

  /** «Opcional» al lado de la etiqueta. */
  get optional(): boolean {
    return boolAttr(this, "optional");
  }
  set optional(v: boolean | null | undefined) {
    this.#bool("optional", !!v);
  }

  /** En lectura (`text`), un candado: no se edita aquí. */
  get locked(): boolean {
    return boolAttr(this, "locked");
  }
  set locked(v: boolean | null | undefined) {
    this.#bool("locked", !!v);
  }

  /** Columnas que ocupa dentro de `.nx-form-grid` (1 a 6; sin él, la fila entera). */
  get span(): FieldSpan | null {
    const n = Math.round(Number(this.getAttribute("span")));
    return n >= 1 && n <= 6 ? (n as FieldSpan) : null;
  }
  set span(v: number | null | undefined) {
    const n = Math.round(Number(v));
    if (v == null || !(n >= 1 && n <= 6)) this.removeAttribute("span");
    else this.setAttribute("span", String(n));
  }

  get labels(): FieldLabels {
    return this.#labels;
  }
  set labels(v: Partial<FieldLabels> | null | undefined) {
    this.#labels = mergeLabels(FIELD_LABELS, v);
    this.#paint();
  }

  /** El control que envuelve (el primero), o `null`. */
  get control(): HTMLElement | null {
    return this.#controls()[0] ?? null;
  }

  /** Enfoca el control (el radio marcado, en un grupo). */
  focus(options?: FocusOptions): void {
    const all = this.#controls();
    const target = all.find((c) => (c as HTMLInputElement).checked) ?? all[0];
    target?.focus(options);
  }

  // ---------------------------------------------------------------- ciclo de vida

  connectedCallback(): void {
    upgrade(this);
    if (!this.#top) this.#build();
    this.#paint();
    // El control puede llegar después (el script en el <head>, un framework que lo cambia).
    this.#observer ??= new MutationObserver(() => this.#paint());
    this.#observer.observe(this, { childList: true });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => this.#paint(), { once: true });
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "labels") {
      if (value === null) this.labels = null;
      else
        try {
          this.labels = JSON.parse(value);
        } catch {
          console.warn('[nx-field] el atributo "labels" no es JSON válido');
        }
      return;
    }
    this.#paint();
  }

  // ---------------------------------------------------------------- interno

  #bool(name: string, v: boolean): void {
    if (v) this.setAttribute(name, "");
    else this.removeAttribute(name);
  }

  #build(): void {
    this.#top = h("div", { class: "nx-field__top" });
    this.#opt = h("span", { class: "nx-field__opt" });
    this.#src = h("span", { class: "nx-field__src", id: `${this.#uid}-src` });
    this.#view = h("div", { class: "nx-field__text" });
    this.#msg = h("div", { class: "nx-field__msg", id: `${this.#uid}-msg` });
    // Lo que la persona cambia deja de ser del sistema: se van el error, el aviso y el origen.
    const own = (e: Event) => {
      const t = e.target as Node;
      if (t === this || this.#top!.contains(t) || this.#view!.contains(t) || this.#msg!.contains(t)) return;
      for (const a of ["error", "warning", "action", "source", "source-detail"]) if (this.hasAttribute(a)) this.removeAttribute(a);
    };
    this.addEventListener("input", own);
    this.addEventListener("change", own);
    this.#msg.addEventListener("click", (e) => {
      if (!(e.target as Element).closest?.(".nx-field__act")) return;
      const detail: FieldActionDetail = { action: this.getAttribute("action") ?? "" };
      this.dispatchEvent(new CustomEvent("nx-field-action", { detail, bubbles: true, composed: true }));
    });
  }

  /** Los controles del autor (todos los radios o casillas de un grupo; si no, uno). */
  #controls(): HTMLElement[] {
    const mine = (el: Element) => this.#top?.contains(el) || this.#view?.contains(el) || this.#msg?.contains(el);
    const first = [...this.querySelectorAll<HTMLElement>(CONTROL)].find((el) => !mine(el) && !el.parentElement?.closest("nx-number, nx-select, nx-date-range, nx-recurrence, nx-signature"));
    if (!first) return [];
    if (first instanceof HTMLInputElement && (first.type === "radio" || first.type === "checkbox")) {
      const group = [...this.querySelectorAll<HTMLInputElement>(`input[type="${first.type}"]`)].filter((el) => !mine(el));
      if (group.length > 1 || first.type === "radio") return group;
    }
    return [first];
  }

  #paint(): void {
    if (!this.#top || !this.isConnected) return;
    const L = this.#labels;
    const controls = this.#controls();
    const group = controls.length > 1 || (controls[0] instanceof HTMLInputElement && controls[0].type === "radio");
    const label = this.getAttribute("label") ?? "";
    const reading = this.hasAttribute("text");

    // Etiqueta: <label for> para un control; un texto con id para un grupo (el elemento es el grupo).
    const tag = group || reading || !controls[0] ? "span" : "label";
    if (this.#label?.tagName.toLowerCase() !== tag) {
      this.#label?.remove();
      this.#label = h(tag, { class: "nx-field__label", id: `${this.#uid}-label` });
    }
    if (this.#label.textContent !== label) this.#label.textContent = label;
    this.#label.hidden = !label;
    const main = controls[0];
    if (main && !main.id) main.id = `${this.#uid}-c`;
    if (tag === "label" && main) this.#label.setAttribute("for", main.id);
    else this.#label.removeAttribute("for");
    if (group && label) {
      this.setAttribute("role", (controls[0] as HTMLInputElement).type === "radio" ? "radiogroup" : "group");
      this.setAttribute("aria-labelledby", this.#label.id);
    } else if (this.getAttribute("aria-labelledby") === this.#label.id) {
      this.removeAttribute("role");
      this.removeAttribute("aria-labelledby");
    }

    this.#opt!.textContent = L.optional;
    this.#opt!.hidden = !this.optional || reading;
    const src = this.getAttribute("source");
    this.#src!.hidden = !src || reading;
    if (src) {
      const detail = this.getAttribute("source-detail") || L.source.replace("{source}", src);
      const key = `${src}\u0000${detail}`;
      if (this.#src!.dataset.k !== key) {
        this.#src!.dataset.k = key;
        this.#src!.replaceChildren(glyph(SOURCE), src, h("span", { class: "nx-sr-only" }, `. ${detail}`));
        this.#src!.title = detail;
      }
    }
    for (const el of [this.#label, this.#opt!, this.#src!]) if (el.parentNode !== this.#top) this.#top!.append(el);

    // Lectura: el valor en lugar del control.
    this.#view!.hidden = !reading;
    if (reading) {
      const text = this.getAttribute("text") ?? "";
      const key = `${text}\u0000${this.locked}`;
      if (this.#view!.dataset.k !== key) {
        this.#view!.dataset.k = key;
        const kids: (Node | string)[] = text ? [text] : [h("span", { class: "nx-field__empty", "aria-hidden": "true" }, "—"), h("span", { class: "nx-sr-only" }, L.empty)];
        if (this.locked) {
          const lock = glyph(LOCK, "nx-field__lock");
          lock.removeAttribute("aria-hidden");
          lock.setAttribute("role", "img");
          lock.setAttribute("aria-label", L.locked);
          lock.title = L.locked;
          kids.push(lock);
        }
        this.#view!.replaceChildren(...kids);
      }
    }

    // Una sola línea debajo: error, o aviso, o ayuda.
    const error = this.getAttribute("error") ?? "";
    const warning = this.getAttribute("warning") ?? "";
    const hint = this.getAttribute("hint") ?? "";
    const kind = reading ? "" : error ? "err" : warning ? "warn" : hint ? "hint" : "";
    const text = kind === "err" ? error : kind === "warn" ? warning : hint;
    const action = kind === "err" || kind === "warn" ? (this.getAttribute("action") ?? "") : "";
    const key = `${kind}\u0000${text}\u0000${action}`;
    if (this.#msgKey !== key) {
      this.#msgKey = key;
      if (!kind) this.#msg!.replaceChildren();
      else if (kind === "hint") this.#msg!.replaceChildren(h("p", { class: "nx-field__hint" }, text));
      else {
        const body = h("span", { class: "nx-field__say" }, h("span", null, text), action ? h("button", { type: "button", class: "nx-field__act" }, action) : null);
        this.#msg!.replaceChildren(h("p", { class: kind === "err" ? "nx-field__err" : "nx-field__warn" }, glyph(kind === "err" ? ALERT : WARN), body));
      }
    }
    this.toggleAttribute("data-invalid", !!error && !reading);
    this.toggleAttribute("data-warning", !error && !!warning && !reading);

    // Accesibilidad del control (o de cada uno, en un grupo).
    for (const c of controls) this.#wire(c, !!error && !reading, group);

    // Lo propio va primero y al final; si el control llegó después, se reacomoda (CSS ya lo ordena).
    if (this.firstChild !== this.#top) this.prepend(this.#top);
    for (const el of [this.#view!, this.#msg!]) if (el.parentNode !== this) this.append(el);
    if (this.lastChild !== this.#msg) this.append(this.#view!, this.#msg!);
  }

  /** `aria-describedby`, `aria-invalid` y `required` en el control y en lo que de verdad recibe el
   *  foco (el `<input>` de adentro de `<nx-number>`, cuando ya se pintó). */
  #wire(c: HTMLElement, invalid: boolean, group: boolean): void {
    const ids = [this.#msg!.id, this.getAttribute("source") && !this.hasAttribute("text") ? this.#src!.id : ""].filter(Boolean);
    const targets = [c];
    if (c.localName.includes("-")) {
      const inner = c.querySelector<HTMLElement>("input:not([type=hidden]), textarea, [role=combobox], button");
      if (inner) targets.push(inner);
      else if (!this.#wired.has(c) && typeof customElements !== "undefined") {
        // Su <input> aparece cuando el elemento se define (puede cargarse aparte).
        this.#wired.add(c);
        void customElements.whenDefined(c.localName).then(() => queueMicrotask(() => this.#paint()));
      }
    }
    for (const t of targets) {
      const own = (t.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((id) => id && !id.startsWith(`${this.#uid}-`));
      const by = [...own, ...ids].join(" ");
      if (t.getAttribute("aria-describedby") !== by) t.setAttribute("aria-describedby", by);
      if (invalid) t.setAttribute("aria-invalid", "true");
      else if (t.getAttribute("aria-invalid") === "true") t.removeAttribute("aria-invalid");
    }
    // `required` nativo, salvo en un grupo de casillas (obligaría a marcarlas todas). Solo se quita
    // el que puso el campo.
    const req = this.required && !(group && (c as HTMLInputElement).type === "checkbox");
    const has = "required" in c ? !!(c as HTMLInputElement).required : c.hasAttribute("required");
    if (req && !has) {
      setRequired(c, true);
      this.#required.add(c);
    } else if (!req && has && this.#required.has(c)) {
      setRequired(c, false);
      this.#required.delete(c);
    }
    if (this.required && !group) c.setAttribute("aria-required", "true");
    else if (c.getAttribute("aria-required") === "true") c.removeAttribute("aria-required");
    if (this.required && this.getAttribute("role") === "radiogroup") this.setAttribute("aria-required", "true");
    else this.removeAttribute("aria-required");
  }
}

function setRequired(c: HTMLElement, v: boolean): void {
  if ("required" in c) (c as HTMLInputElement).required = v;
  else c.toggleAttribute("required", v);
}
