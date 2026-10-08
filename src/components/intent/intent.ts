/**
 * `<nx-intent>`: «¿Qué necesitas?». Una caja donde se escribe con las palabras de cada quien
 * («certificado para el banco», «permiso el viernes en la mañana», «mi último desprendible») y que,
 * mientras se escribe, dice qué entendió —el trámite y cada dato— antes de llevar a él.
 *
 * Reglas de diseño:
 * - **Dice lo que entendió antes de actuar.** Cada dato sale como un chip («Certificado laboral ·
 *   para un banco · con salario»); si no reconoce nada, lo dice y nombra lo que sí sabe hacer. El
 *   botón se apaga hasta que haya algo que preparar.
 * - **Sin modelos ni servidor.** Las palabras de cada trámite y sus opciones llegan en JSON (las arma
 *   el servidor para quien mira); fechas, meses, horas y montos los lee la librería en español.
 * - **Lleva, no ejecuta.** Al confirmar va al destino con los datos como parámetros, o al de la
 *   opción elegida (un PDF). `nx-intent-submit` es cancelable: la app navega con su router.
 * - **El teclado como atajo que no se anuncia**: `Escape` borra; con `hotkey`, esa tecla trae el foco.
 */
import { Base, boolAttr, upgrade } from "../../core/define";
import { emit, h, safeHref, setAttr } from "../../core/dom";
import { mergeLabels } from "../../core/labels";
import { resolveLocale } from "../../core/locale";
import { understand } from "./logic";
import type { IntentChangeDetail, IntentDef, IntentLabels, IntentMatch, IntentSubmitDetail } from "./types";

export const INTENT_LABELS: IntentLabels = {
  label: "¿Qué necesitas?",
  placeholder: "¿Qué necesitas? Por ejemplo: certificado para el banco",
  submit: "Preparar",
  understood: "Entendí:",
  unknown: "Eso no lo reconozco todavía. Puedo ayudarte con {list}.",
  examples: "Ejemplos",
};

const SPARK = '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1-5.1-1.9 5.1-1.9z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>';
let uid = 0;

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
const isField = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

function list(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export class NxIntent extends Base {
  static observedAttributes = ["intents", "examples", "labels", "placeholder", "today", "currency", "hotkey", "locale", "value"];

  #intents: IntentDef[] = [];
  #examples: string[] = [];
  #labels: IntentLabels = INTENT_LABELS;
  #uid = `nx-in${++uid}`;
  #root?: HTMLDivElement;
  #input?: HTMLInputElement;
  #button?: HTMLButtonElement;
  #read?: HTMLParagraphElement;
  #try?: HTMLDivElement;
  #match: IntentMatch | null = null;
  #shown = "";
  #abort?: AbortController;

  // ---------------------------------------------------------------- propiedades

  /** Los trámites: `{id, label, keywords, exclude?, href, newTab?, icon?, slots?}`. */
  get intents(): IntentDef[] {
    return this.#intents;
  }
  set intents(value: IntentDef[] | null | undefined) {
    this.#intents = asArray<IntentDef>(value).filter((i) => typeof i.id === "string" && typeof i.label === "string" && Array.isArray(i.keywords));
    this.#read_();
    this.#paintExamples();
  }

  /** Frases de ejemplo bajo la caja; tocar una la escribe y la prepara. */
  get examples(): string[] {
    return this.#examples;
  }
  set examples(value: string[] | null | undefined) {
    this.#examples = Array.isArray(value) ? value.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
    this.#paintExamples();
  }

  get labels(): IntentLabels {
    return this.#labels;
  }
  set labels(value: Partial<IntentLabels> | null | undefined) {
    this.#labels = mergeLabels(INTENT_LABELS, value);
    this.#build();
  }

  get placeholder(): string | null {
    return this.getAttribute("placeholder");
  }
  set placeholder(v: string | null | undefined) {
    setAttr(this, "placeholder", v);
  }
  /** «Hoy» (ISO) para leer «mañana» o «el viernes». Sin él, la fecha local. */
  get today(): string | null {
    return this.getAttribute("today");
  }
  set today(v: string | null | undefined) {
    setAttr(this, "today", v);
  }
  /** La moneda de los montos entendidos («COP»). Sin ella, un número. */
  get currency(): string | null {
    return this.getAttribute("currency");
  }
  set currency(v: string | null | undefined) {
    setAttr(this, "currency", v);
  }
  /** Una tecla que trae el foco a la caja desde cualquier parte («/»). Sin ella, ninguna. */
  get hotkey(): string | null {
    return this.getAttribute("hotkey");
  }
  set hotkey(v: string | null | undefined) {
    setAttr(this, "hotkey", v);
  }
  get locale(): string | null {
    return this.getAttribute("locale");
  }
  set locale(v: string | null | undefined) {
    setAttr(this, "locale", v);
  }
  /** Lo escrito. */
  get value(): string {
    return this.#input?.value ?? this.getAttribute("value") ?? "";
  }
  set value(v: string | null | undefined) {
    const text = String(v ?? "");
    if (this.#input) this.#input.value = text;
    else setAttr(this, "value", text);
    this.#read_();
  }
  /** Lo que se entendió de lo escrito, o `null`. */
  get match(): IntentMatch | null {
    return this.#match;
  }

  /** Enfoca la caja. */
  focus(options?: FocusOptions): void {
    this.#input?.focus(options);
  }
  /** Borra lo escrito. */
  clear(): void {
    this.value = "";
  }
  /** Prepara lo escrito (como el botón). Devuelve si había algo que preparar. */
  submit(): boolean {
    return this.#submit();
  }

  // ---------------------------------------------------------------- ciclo de vida

  connectedCallback(): void {
    upgrade(this);
    if (!this.#root) this.#build();
    else if (this.#root.parentNode !== this) this.append(this.#root);
    this.#abort?.abort();
    const signal = (this.#abort = new AbortController()).signal;
    document.addEventListener("keydown", this.#onHotkey, { signal });
    this.#read_();
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "intents" || name === "examples" || name === "labels") {
      if (value === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        console.warn(`[nx-intent] el atributo "${name}" no es JSON válido`);
        return;
      }
      (this as unknown as Record<string, unknown>)[name] = parsed;
      return;
    }
    if (name === "placeholder" && this.#input) this.#input.placeholder = value || this.#labels.placeholder;
    else if (name === "value" && this.#input && value !== null && this.#input.value !== value) this.#input.value = value;
    if (name === "today" || name === "currency" || name === "locale" || name === "value") this.#read_();
  }

  // ---------------------------------------------------------------- render

  #build(): void {
    const L = this.#labels;
    const prev = this.#input?.value ?? this.getAttribute("value") ?? "";
    const readId = `${this.#uid}-read`;
    const inputId = `${this.#uid}-q`;
    const spark = h("span", { class: "nx-intent__spark", "aria-hidden": "true" });
    spark.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${SPARK}</svg>`;
    const input = (this.#input = h("input", {
      class: "nx-intent__input",
      id: inputId,
      type: "text",
      autocomplete: "off",
      enterkeyhint: "go",
      spellcheck: "false",
      placeholder: this.placeholder || L.placeholder,
      "aria-describedby": readId,
    }));
    input.value = prev;
    const button = (this.#button = h("button", { class: "nx-intent__go", type: "submit", disabled: true }, L.submit));
    const form = h("form", { class: "nx-intent__box", role: "search", novalidate: true }, spark, h("label", { class: "nx-intent__sr", for: inputId }, L.label), input, button);
    this.#read = h("p", { class: "nx-intent__read", id: readId, "aria-live": "polite" });
    this.#try = h("div", { class: "nx-intent__examples", role: "group", "aria-label": L.examples });
    const root = h("div", { class: "nx-intent__root" }, form, this.#read, this.#try);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.#submit();
    });
    input.addEventListener("input", () => this.#read_());
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && input.value) {
        e.stopPropagation();
        e.preventDefault();
        this.value = "";
      }
    });
    this.#try.addEventListener("click", (e) => {
      const b = (e.target as Element | null)?.closest?.("button[data-nx-example]") as HTMLButtonElement | null;
      if (!b) return;
      this.value = b.dataset.nxExample ?? "";
      if (this.#match) this.#submit();
      else input.focus();
    });
    this.#root?.remove();
    this.#root = root;
    if (this.isConnected) this.append(root);
    this.#shown = "";
    this.#paintExamples();
    this.#read_();
  }

  #paintExamples(): void {
    const box = this.#try;
    if (!box) return;
    box.replaceChildren(...this.#examples.map((x) => h("button", { type: "button", class: "nx-intent__example", "data-nx-example": x }, x)));
    box.hidden = !this.#examples.length;
  }

  /** Lee lo escrito y dice qué entendió (solo repinta si cambió lo entendido). */
  #read_(): void {
    const read = this.#read;
    if (!read || !this.#input) return;
    const text = this.#input.value;
    const match = understand(text, this.#intents, { today: this.today, locale: resolveLocale(this), currency: this.currency });
    const before = this.#match;
    this.#match = match;
    this.#button!.disabled = !match;
    const blank = text.trim().length < 2;
    const sig = blank ? "" : match ? `ok|${match.chips.join("|")}` : "none";
    if (sig !== this.#shown) {
      const old = new Set(this.#shown.startsWith("ok|") ? this.#shown.slice(3).split("|") : []);
      this.#shown = sig;
      read.replaceChildren();
      read.classList.toggle("is-unknown", sig === "none");
      if (match) {
        read.append(h("span", { class: "nx-intent__understood" }, this.#labels.understood));
        for (const c of match.chips) {
          const chip = h("span", { class: `nx-intent__chip${old.has(c) ? "" : " is-new"}` }, c);
          read.append(chip);
        }
      } else if (sig === "none") {
        const names = [...new Set(this.#intents.map((i) => i.label.toLowerCase()))];
        read.append(this.#labels.unknown.replace("{list}", list(names)));
      }
    }
    if ((before?.href ?? null) !== (match?.href ?? null) || before?.intent.id !== match?.intent.id) {
      emit(this, "nx-intent-change", { text, match } satisfies IntentChangeDetail);
    }
  }

  #submit(): boolean {
    const m = this.#match;
    if (!m) return false;
    const href = safeHref(m.href);
    if (!href) return false;
    const detail: IntentSubmitDetail = { text: this.value, id: m.intent.id, intent: m.intent, params: m.params, href, newTab: m.newTab };
    if (!emit(this, "nx-intent-submit", detail, true)) return true;
    if (m.newTab) window.open(href, "_blank", "noopener");
    else location.assign(href);
    return true;
  }

  #onHotkey = (e: KeyboardEvent): void => {
    const key = this.hotkey;
    if (!key || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.key !== key) return;
    if (isField(e.composedPath?.()[0] ?? e.target) || boolAttr(this, "disabled")) return;
    e.preventDefault();
    this.#input?.focus();
  };
}
