/**
 * `<nx-password>`: el campo de contraseña. Para entrar (la actual) y para crear una nueva, con lo
 * que ayuda a hacerla bien sin regañar.
 *
 * - **Mostrar u ocultar** con el ojo, y «Mayúsculas activadas» cuando lo están.
 * - **Con `meter`** (una contraseña nueva): un medidor de cuatro tramos con su nivel en palabras
 *   («Seguridad: Buena») y las condiciones que se van cumpliendo mientras se escribe: el largo
 *   (`min-length`, 12 por defecto), sin el nombre ni el documento de la persona (`avoid`), no ser de
 *   las más usadas y, con `breach-endpoint`, no aparecer en filtraciones conocidas. Una frase de
 *   varias palabras pasa sin símbolos raros: lo que cuenta es lo difícil de adivinar.
 * - **Filtraciones sin mandar la contraseña.** Con `breach-endpoint` (del mismo origen: la app lo
 *   pasa a Have I Been Pwned o a su propia lista) se pide `GET {endpoint}/{5 primeros del SHA-1}` y
 *   se busca el resto en la respuesta (`SUFIJO:VECES` por línea). Si no se puede revisar, no bloquea.
 * - **Confirmar y cambiar.** `match="id"` exige que sea igual a la del campo con ese id (la de
 *   «Repítela»); `differs="id"`, que sea distinta (la actual).
 * - **Es un control de formulario** (`name`, `required`, validez con su mensaje). La contraseña no
 *   va a ningún atributo, no se repone al volver con «atrás» y `nx-password-change` no la trae.
 */
import { Base, boolAttr, upgrade } from "../../core/define";
import { emit, h, safeEndpoint, setAttr } from "../../core/dom";
import { glyph } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import { breachCount, firstUnmet, passwordRules, passwordStrength, PASSWORD_MIN, rangeUrl, sha1Hex } from "./logic";
import type { PasswordChangeDetail, PasswordLabels, PasswordRule, PasswordStrength } from "./types";

export const PASSWORD_LABELS: PasswordLabels = {
  show: "Mostrar la contraseña",
  hide: "Ocultar la contraseña",
  capsLock: "Mayúsculas activadas",
  strength: "Seguridad: {level}",
  level1: "Débil",
  level2: "Regular",
  level3: "Buena",
  level4: "Fuerte",
  ruleLength: "{n} caracteres o más",
  ruleAvoid: "Sin tu nombre ni tu documento",
  ruleCommon: "No es de las más usadas",
  ruleBreach: "No aparece en filtraciones conocidas",
  ruleDiffers: "Distinta de la actual",
  checking: "Revisando…",
  unchecked: "No se pudo revisar",
  rules: "Condiciones de la contraseña",
  required: "Escribe la contraseña",
  unmet: "Todavía no cumple: {rule}",
  mismatch: "No coincide con la nueva",
};

const EYE = '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>';
const EYE_OFF = '<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="m2 2 20 20"/>';
const CHECK = '<path d="M20 6 9 17l-5-5"/>';
const DOT = '<circle cx="12" cy="12" r="4"/>';
/** Cuánto esperar a que deje de escribir antes de revisar las filtraciones. */
const BREACH_WAIT = 500;

let uid = 0;

export class NxPassword extends Base {
  static formAssociated = true;
  /** La contraseña no llega en un payload del servidor: BDUI la rechaza con un aviso. */
  static readonly localProps = ["value"];
  static observedAttributes = ["name", "required", "disabled", "readonly", "placeholder", "autocomplete", "label", "meter", "min-length", "avoid", "match", "differs", "breach-endpoint", "labels"];

  #uid = `nx-pw${++uid}`;
  #internals: ElementInternals | null = null;
  #labels: PasswordLabels = PASSWORD_LABELS;
  #avoid: string[] = [];
  #formDisabled = false;
  #built = false;
  #field?: HTMLDivElement;
  #input?: HTMLInputElement;
  #eye?: HTMLButtonElement;
  #caps?: HTMLParagraphElement;
  #meter?: HTMLDivElement;
  #level?: HTMLSpanElement;
  #list?: HTMLUListElement;
  /** La revisión de filtraciones: el resultado de la contraseña de ahora (`null`: no se sabe). */
  #breach: { pw: string; found: boolean | null } | null = null;
  #breachTimer = 0;
  #abort?: AbortController;
  /** Para revalidar cuando cambia el campo de `match` o `differs`. */
  #onOther = (e: Event) => {
    const ids = [this.getAttribute("match"), this.getAttribute("differs")].filter(Boolean) as string[];
    if (!ids.length) return;
    for (let n = e.target instanceof Element ? e.target : null; n; n = n.parentElement) if (ids.includes(n.id)) return void this.#update(false);
  };

  constructor() {
    super();
    try {
      this.#internals = (this as HTMLElement).attachInternals?.() ?? null;
    } catch {
      this.#internals = null;
    }
  }

  // ---------------------------------------------------------------- propiedades

  /** La contraseña escrita. Solo por código: nunca va a un atributo. */
  get value(): string {
    return this.#input?.value ?? "";
  }
  set value(v: string | null | undefined) {
    if (!this.#built) this.#build();
    this.#input!.value = v == null ? "" : String(v);
    this.#update(false);
  }
  get name(): string {
    return this.getAttribute("name") ?? "";
  }
  set name(v: string | null | undefined) {
    setAttr(this, "name", v);
  }
  get required(): boolean {
    return boolAttr(this, "required");
  }
  set required(v: boolean) {
    this.toggleAttribute("required", !!v);
  }
  get disabled(): boolean {
    return boolAttr(this, "disabled");
  }
  set disabled(v: boolean) {
    this.toggleAttribute("disabled", !!v);
  }
  get readonly(): boolean {
    return boolAttr(this, "readonly");
  }
  set readonly(v: boolean) {
    this.toggleAttribute("readonly", !!v);
  }
  get placeholder(): string {
    return this.getAttribute("placeholder") ?? "";
  }
  set placeholder(v: string | null | undefined) {
    setAttr(this, "placeholder", v);
  }
  /** `current-password` (por defecto) o `new-password` (por defecto con `meter`). */
  get autocomplete(): string {
    return this.getAttribute("autocomplete") || (this.meter ? "new-password" : "current-password");
  }
  set autocomplete(v: string | null | undefined) {
    setAttr(this, "autocomplete", v);
  }
  /** Nombre accesible si no hay un `<label>` que lo nombre. */
  get label(): string {
    return this.getAttribute("label") ?? "";
  }
  set label(v: string | null | undefined) {
    setAttr(this, "label", v);
  }
  /** Una contraseña nueva: el medidor y las condiciones. */
  get meter(): boolean {
    return boolAttr(this, "meter");
  }
  set meter(v: boolean) {
    this.toggleAttribute("meter", !!v);
  }
  /** El largo mínimo con `meter` (12 por defecto). */
  get minLength(): number {
    const n = Math.round(Number(this.getAttribute("min-length")));
    return n >= 1 ? n : PASSWORD_MIN;
  }
  set minLength(v: number | null | undefined) {
    setAttr(this, "min-length", v);
  }
  /** Lo que no puede llevar: el nombre, los apellidos, el documento. El atributo es JSON o texto
   *  separado por comas. */
  get avoid(): string[] {
    return [...this.#avoid];
  }
  set avoid(v: string[] | string | null | undefined) {
    this.#avoid = Array.isArray(v) ? v.map(String).filter((s) => s.trim()) : typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
    this.#update(false);
  }
  /** El id del campo que tiene que repetir (la confirmación). */
  get match(): string | null {
    return this.getAttribute("match");
  }
  set match(v: string | null | undefined) {
    setAttr(this, "match", v);
  }
  /** El id del campo del que tiene que ser distinta (la contraseña actual). */
  get differs(): string | null {
    return this.getAttribute("differs");
  }
  set differs(v: string | null | undefined) {
    setAttr(this, "differs", v);
  }
  /** Revisión de filtraciones por k-anonimato, del mismo origen (o de `allowOrigins`). */
  get breachEndpoint(): string | null {
    return this.getAttribute("breach-endpoint");
  }
  set breachEndpoint(v: string | null | undefined) {
    setAttr(this, "breach-endpoint", v);
  }
  get labels(): PasswordLabels {
    return this.#labels;
  }
  set labels(v: Partial<PasswordLabels> | null | undefined) {
    this.#labels = mergeLabels(PASSWORD_LABELS, v);
    this.#update(false);
  }
  /** Las condiciones y si se cumplen (vacío sin `meter`). */
  get rules(): PasswordRule[] {
    return this.meter ? this.#rules() : [];
  }
  /** 0 (vacía) a 4. */
  get strength(): PasswordStrength {
    return passwordStrength(this.value, this.#avoid);
  }
  get form(): HTMLFormElement | null {
    return this.#internals?.form ?? null;
  }
  get validity(): ValidityState | undefined {
    return this.#internals?.validity;
  }
  get validationMessage(): string {
    return this.#internals?.validationMessage ?? "";
  }
  checkValidity(): boolean {
    return this.#internals?.checkValidity() ?? true;
  }
  reportValidity(): boolean {
    return this.#internals?.reportValidity() ?? true;
  }
  focus(options?: FocusOptions): void {
    this.#input?.focus(options);
  }
  select(): void {
    this.#input?.select();
  }

  // ---------------------------------------------------------------- ciclo de vida

  connectedCallback(): void {
    upgrade(this);
    if (!this.#built) this.#build();
    for (const el of [this.#field!, this.#caps!, this.#meter!, this.#list!]) if (el.parentNode !== this) this.append(el);
    document.addEventListener("input", this.#onOther, true);
    this.#update(false);
    queueMicrotask(() => this.#name());
  }

  disconnectedCallback(): void {
    document.removeEventListener("input", this.#onOther, true);
    clearTimeout(this.#breachTimer);
    this.#abort?.abort();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "labels" || name === "avoid") {
      if (value === null) return void (name === "labels" ? (this.labels = null) : (this.avoid = null));
      if (name === "avoid" && !value.trim().startsWith("[")) return void (this.avoid = value);
      try {
        (this as unknown as Record<string, unknown>)[name] = JSON.parse(value);
      } catch {
        console.warn(`[nx-password] el atributo "${name}" no es JSON válido`);
      }
      return;
    }
    if (name === "breach-endpoint") this.#breach = null;
    if (name === "label") this.#name();
    this.#update(false);
  }

  formResetCallback(): void {
    if (this.#input) this.#input.value = "";
    this.#show(false);
    this.#update(false);
  }
  formDisabledCallback(disabled: boolean): void {
    this.#formDisabled = disabled;
    this.#update(false);
  }
  formStateRestoreCallback(): void {
    /* Una contraseña no se repone al volver con «atrás». */
  }

  // ---------------------------------------------------------------- interno

  #build(): void {
    this.#built = true;
    const id = this.#uid;
    this.#input = h("input", { type: "password", class: "nx-password__input", id: `${id}-i`, spellcheck: "false", autocapitalize: "off", autocorrect: "off" });
    this.#eye = h("button", { type: "button", class: "nx-password__eye", "aria-pressed": "false", "aria-controls": `${id}-i` }, glyph(EYE));
    this.#field = h("div", { class: "nx-password__field" }, this.#input, this.#eye);
    this.#caps = h("p", { class: "nx-password__caps", id: `${id}-caps`, hidden: true });
    this.#level = h("span", { class: "nx-password__level" });
    this.#meter = h("div", { class: "nx-password__meter", hidden: true }, h("span", { class: "nx-password__bars", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i")), this.#level);
    this.#list = h("ul", { class: "nx-password__rules", id: `${id}-rules`, hidden: true });
    this.#input.addEventListener("input", () => this.#update(true));
    this.#input.addEventListener("keydown", (e) => this.#capsLock(e));
    this.#input.addEventListener("keyup", (e) => this.#capsLock(e));
    this.#input.addEventListener("blur", () => (this.#caps!.hidden = true));
    this.#eye.addEventListener("click", () => {
      this.#show(this.#input!.type === "password");
      this.#input!.focus();
    });
  }

  #show(on: boolean): void {
    if (!this.#input || !this.#eye) return;
    this.#input.type = on ? "text" : "password";
    this.#eye.setAttribute("aria-pressed", String(on));
    this.#eye.setAttribute("aria-label", on ? this.#labels.hide : this.#labels.show);
    this.#eye.title = on ? this.#labels.hide : this.#labels.show;
    this.#eye.replaceChildren(glyph(on ? EYE_OFF : EYE));
  }

  #capsLock(e: KeyboardEvent): void {
    const on = typeof e.getModifierState === "function" && e.getModifierState("CapsLock");
    this.#caps!.textContent = this.#labels.capsLock;
    this.#caps!.hidden = !on;
  }

  #other(attr: "match" | "differs"): string | null {
    const id = this.getAttribute(attr);
    if (!id) return null;
    const el = (this.getRootNode() as Document | ShadowRoot).getElementById?.(id) as (HTMLElement & { value?: unknown }) | null;
    return el && typeof el.value === "string" ? el.value : null;
  }

  #rules(): PasswordRule[] {
    const L = this.#labels;
    const pw = this.value;
    const endpoint = this.breachEndpoint ? safeEndpoint(this.breachEndpoint) : undefined;
    let breach: boolean | null | undefined;
    if (endpoint) breach = this.#breach && this.#breach.pw === pw && this.#breach.found !== null ? !this.#breach.found : null;
    return passwordRules(pw, {
      minLength: this.minLength,
      avoid: this.#avoid,
      breach,
      differs: this.getAttribute("differs") ? this.#other("differs") : undefined,
      labels: { length: L.ruleLength, avoid: L.ruleAvoid, common: L.ruleCommon, breach: L.ruleBreach, differs: L.ruleDiffers },
    });
  }

  /** Todo lo que depende de la contraseña: el medidor, las condiciones, la validez y el aviso. */
  #update(typed: boolean): void {
    if (!this.#built) return;
    const L = this.#labels;
    const input = this.#input!;
    const pw = input.value;
    input.disabled = this.disabled || this.#formDisabled;
    input.readOnly = this.readonly;
    input.placeholder = this.placeholder;
    input.autocomplete = this.autocomplete as AutoFill;
    input.toggleAttribute("aria-required", this.required);
    this.#eye!.disabled = input.disabled;
    const shown = input.type === "text";
    this.#eye!.setAttribute("aria-label", shown ? L.hide : L.show);
    this.#eye!.title = shown ? L.hide : L.show;
    this.#field!.toggleAttribute("data-disabled", input.disabled);

    const meter = this.meter;
    const rules = meter ? this.#rules() : [];
    const strength = passwordStrength(pw, this.#avoid);
    this.#meter!.hidden = !meter;
    this.#list!.hidden = !meter;
    if (meter) {
      this.#meter!.dataset.score = String(strength);
      this.#level!.textContent = strength ? L.strength.replace("{level}", L[`level${strength}` as "level1"]) : "";
      this.#list!.setAttribute("aria-label", L.rules);
      this.#list!.replaceChildren(
        ...rules.map((r) => {
          const pending = r.ok === null && !!pw;
          // El largo no es un error mientras se escribe: se va cumpliendo. Las demás sí avisan en rojo.
          const state = r.ok === true ? "ok" : r.ok === false && pw && r.id !== "length" ? "bad" : pending ? "wait" : "";
          const note = r.id === "breach" && pending ? (this.#breach?.pw === pw && this.#breach.found === null ? L.unchecked : L.checking) : "";
          return h("li", { class: "nx-password__rule", "data-state": state || null, "data-rule": r.id }, glyph(r.ok === true ? CHECK : DOT), h("span", null, r.label), note ? h("span", { class: "nx-password__note" }, ` · ${note}`) : null);
        }),
      );
    }
    const describedBy = [meter ? this.#list!.id : "", this.#caps!.id].filter(Boolean).join(" ");
    const own = (input.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((id) => id && !id.startsWith(`${this.#uid}-`));
    input.setAttribute("aria-describedby", [...own, describedBy].join(" ").trim());

    const mismatch = !!this.getAttribute("match") && !!pw && pw !== (this.#other("match") ?? "");
    this.#sync(pw, rules, mismatch);
    if (typed && meter && pw) this.#scheduleBreach(pw);
    if (typed || this.#breach?.pw === pw) {
      const detail: PasswordChangeDetail = { strength, ok: !mismatch && !firstUnmet(rules), rules };
      emit(this, "nx-password-change", detail);
    }
  }

  #sync(pw: string, rules: PasswordRule[], mismatch: boolean): void {
    const i = this.#internals;
    if (!i) return;
    const L = this.#labels;
    try {
      // El estado vacío: el navegador no la guarda para reponerla.
      i.setFormValue(pw || null, "");
      const unmet = firstUnmet(rules);
      if (!pw && this.required) i.setValidity({ valueMissing: true }, L.required, this.#input);
      else if (pw && unmet) i.setValidity({ customError: true }, L.unmet.replace("{rule}", unmet.label.charAt(0).toLowerCase() + unmet.label.slice(1)), this.#input);
      else if (mismatch) i.setValidity({ customError: true }, L.mismatch, this.#input);
      else i.setValidity({});
    } catch {
      /* happy-dom y navegadores sin form-associated */
    }
  }

  #scheduleBreach(pw: string): void {
    const endpoint = this.breachEndpoint ? safeEndpoint(this.breachEndpoint) : undefined;
    if (!endpoint) return;
    clearTimeout(this.#breachTimer);
    this.#abort?.abort();
    this.#breachTimer = window.setTimeout(() => void this.#checkBreach(endpoint, pw), BREACH_WAIT);
  }

  async #checkBreach(endpoint: string, pw: string): Promise<void> {
    const ctrl = new AbortController();
    this.#abort = ctrl;
    let found: boolean | null = null;
    try {
      const hash = await sha1Hex(pw);
      if (hash) {
        const res = await fetch(rangeUrl(endpoint, hash.slice(0, 5)), { signal: ctrl.signal, credentials: "same-origin", headers: { "Add-Padding": "true" } });
        if (res.ok) found = breachCount(await res.text(), hash.slice(5)) > 0;
      }
    } catch {
      if (ctrl.signal.aborted) return;
      found = null;
    }
    if (ctrl.signal.aborted || this.value !== pw) return;
    this.#breach = { pw, found };
    this.#update(false);
  }

  #name(): void {
    const input = this.#input;
    if (!input) return;
    if (this.label) {
      input.setAttribute("aria-label", this.label);
      input.removeAttribute("aria-labelledby");
      return;
    }
    input.removeAttribute("aria-label");
    let ids: string[] = [];
    try {
      ids = Array.from(this.#internals?.labels ?? [], (l, i) => ((l as HTMLElement).id ||= `${this.#uid}-label${i}`));
    } catch {
      /* sin `internals.labels` */
    }
    if (ids.length) input.setAttribute("aria-labelledby", ids.join(" "));
    else input.removeAttribute("aria-labelledby");
  }
}
