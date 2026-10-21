/**
 * `<nx-otp>`: el código de verificación en casillas, una por dígito («482 113»). Lo pide la
 * verificación en dos pasos, el cambio de un correo o de un celular y cualquier trámite que mande
 * un código por mensaje.
 *
 * - **Escribir de corrido.** Cada dígito pasa a la casilla siguiente; Retroceso en una casilla vacía
 *   borra la anterior y vuelve a ella; las flechas, Inicio y Fin se mueven entre casillas.
 * - **Pegar o dejar que el celular lo llene.** Un código pegado (también «482-113» o «482 113») se
 *   reparte solo, en la casilla que sea; el teléfono que lee el mensaje (`autocomplete=
 *   "one-time-code"`) lo pone entero en la primera y también se reparte.
 * - **Avisa una vez.** `nx-otp-complete` sale cuando se llena la última casilla, después del evento
 *   que la llenó: la app verifica ahí, y si el código no sirve, el error que pinta no lo borra el
 *   mismo `input` que acaba de pasar.
 * - **Es un control de formulario.** Con `name` va en un `<form>` (el código, solo si está
 *   completo); `required` lo exige entero. Dentro de `<nx-field>`, la etiqueta, el error y
 *   `aria-invalid` llegan solos.
 *
 * Light DOM: las casillas son `<input>` de verdad (el lector dice «Dígito 2 de 6») dentro de un
 * grupo con el nombre del campo.
 */
import { Base, boolAttr, upgrade } from "../../core/define";
import { emit, h, setAttr } from "../../core/dom";
import { mergeLabels } from "../../core/labels";
import { charsOf, cleanKind, cleanLength, firstEmpty, isComplete, joinCode, sanitize, spread } from "./logic";
import type { OtpChangeDetail, OtpCompleteDetail, OtpKind, OtpLabels } from "./types";

export const OTP_LABELS: OtpLabels = {
  digit: "Dígito {n} de {total}",
  group: "Código de verificación",
  required: "Escribe el código completo",
  incomplete: "Faltan {n}",
};

let uid = 0;

export class NxOtp extends Base {
  static formAssociated = true;
  static observedAttributes = ["value", "length", "kind", "name", "required", "disabled", "label", "labels"];

  #uid = `nx-otp${++uid}`;
  #internals: ElementInternals | null = null;
  #labels: OtpLabels = OTP_LABELS;
  #chars: string[] = charsOf("", cleanLength(null));
  /** El código que ya avisó `nx-otp-complete`: el mismo no vuelve a avisar. */
  #announced = "";
  #completeTimer = 0;
  #formDisabled = false;
  #box?: HTMLDivElement;
  #inputs: HTMLInputElement[] = [];

  constructor() {
    super();
    try {
      this.#internals = (this as HTMLElement).attachInternals?.() ?? null;
    } catch {
      this.#internals = null;
    }
  }

  // ---------------------------------------------------------------- propiedades

  /** El código escrito hasta ahora (sin espacios ni guiones). */
  get value(): string {
    return joinCode(this.#chars);
  }
  set value(v: string | number | null | undefined) {
    this.#chars = charsOf(v ?? "", this.length, this.kind);
    this.#announced = this.complete ? this.value : "";
    this.#paint();
  }
  /** Están todas las casillas llenas. */
  get complete(): boolean {
    return isComplete(this.#chars);
  }
  /** Cuántas casillas: de 4 a 8 (6 por defecto). */
  get length(): number {
    return cleanLength(this.getAttribute("length"));
  }
  set length(v: number | null | undefined) {
    setAttr(this, "length", v);
  }
  /** `numeric` (por defecto) o `alphanumeric`. */
  get kind(): OtpKind {
    return cleanKind(this.getAttribute("kind"));
  }
  set kind(v: OtpKind | null | undefined) {
    setAttr(this, "kind", v);
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
  /** El nombre del grupo para el lector, si no hay un `<label>` que lo nombre. */
  get label(): string {
    return this.getAttribute("label") ?? "";
  }
  set label(v: string | null | undefined) {
    setAttr(this, "label", v);
  }
  get labels(): OtpLabels {
    return this.#labels;
  }
  set labels(v: Partial<OtpLabels> | null | undefined) {
    this.#labels = mergeLabels(OTP_LABELS, v);
    this.#paint();
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

  /** Enfoca la primera casilla vacía (o la última). */
  focus(options?: FocusOptions): void {
    this.#inputs[firstEmpty(this.#chars)]?.focus(options);
  }
  /** Vacía el código (después de un código que no sirvió) y vuelve a la primera casilla. */
  clear(focus = true): void {
    this.#chars = charsOf("", this.length, this.kind);
    this.#announced = "";
    this.#paint();
    this.#changed();
    if (focus) this.#inputs[0]?.focus();
  }

  // ---------------------------------------------------------------- ciclo de vida

  connectedCallback(): void {
    upgrade(this);
    if (!this.#box) this.#build();
    if (this.#box!.parentNode !== this) this.append(this.#box!);
    this.#paint();
    queueMicrotask(() => this.#name());
  }

  disconnectedCallback(): void {
    clearTimeout(this.#completeTimer);
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "labels") {
      if (value === null) this.labels = null;
      else
        try {
          this.labels = JSON.parse(value);
        } catch {
          console.warn('[nx-otp] el atributo "labels" no es JSON válido');
        }
      return;
    }
    if (name === "value") return void (this.value = value);
    if (name === "length" || name === "kind") this.#chars = charsOf(this.value, this.length, this.kind);
    this.#paint();
  }

  formResetCallback(): void {
    this.clear(false);
  }
  formDisabledCallback(disabled: boolean): void {
    this.#formDisabled = disabled;
    this.#paint();
  }
  formStateRestoreCallback(): void {
    /* Un código vence: no se repone al volver con «atrás». */
  }

  // ---------------------------------------------------------------- interno

  #build(): void {
    this.#box = h("div", { class: "nx-otp__boxes", role: "group" });
    this.#box.addEventListener("input", (e) => this.#onInput(e));
    this.#box.addEventListener("keydown", (e) => this.#onKey(e));
    this.#box.addEventListener("paste", (e) => this.#onPaste(e));
    this.#box.addEventListener("focusin", (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement) queueMicrotask(() => t.select());
    });
  }

  /** Las casillas: se crean o quitan solo las que sobran (cambia `length`). */
  #paint(): void {
    const box = this.#box;
    if (!box) return;
    const n = this.#chars.length;
    const L = this.#labels;
    while (this.#inputs.length > n) this.#inputs.pop()!.remove();
    while (this.#inputs.length < n) {
      const i = this.#inputs.length;
      const input = h("input", {
        type: "text",
        class: "nx-otp__box",
        autocomplete: i === 0 ? "one-time-code" : "off",
        autocorrect: "off",
        spellcheck: "false",
        enterkeyhint: "done",
        "data-i": String(i),
      });
      this.#inputs.push(input);
      box.append(input);
    }
    const alpha = this.kind === "alphanumeric";
    const off = this.disabled || this.#formDisabled;
    this.#inputs.forEach((input, i) => {
      if (input.value !== this.#chars[i]) input.value = this.#chars[i];
      input.inputMode = alpha ? "text" : "numeric";
      setAttr(input, "pattern", alpha ? null : "[0-9]*");
      setAttr(input, "autocapitalize", alpha ? "characters" : null);
      input.setAttribute("aria-label", L.digit.replace("{n}", String(i + 1)).replace("{total}", String(n)));
      input.disabled = off;
      // El corte del medio (3 + 3): solo con 6 u 8 casillas.
      input.toggleAttribute("data-split", n >= 6 && n % 2 === 0 && i === n / 2);
    });
    this.toggleAttribute("data-complete", this.complete);
    this.#name();
    this.#sync();
  }

  /** El nombre del grupo: `label`, el `<label>` asociado o el de por defecto. */
  #name(): void {
    const box = this.#box;
    if (!box) return;
    let ids: string[] = [];
    try {
      ids = Array.from(this.#internals?.labels ?? [], (l, i) => ((l as HTMLElement).id ||= `${this.#uid}-label${i}`));
    } catch {
      /* sin `internals.labels` */
    }
    if (!this.label && ids.length) {
      box.setAttribute("aria-labelledby", ids.join(" "));
      box.removeAttribute("aria-label");
    } else {
      box.removeAttribute("aria-labelledby");
      box.setAttribute("aria-label", this.label || this.#labels.group);
    }
  }

  #sync(): void {
    const i = this.#internals;
    if (!i) return;
    const n = this.#chars.filter((c) => !c).length;
    try {
      i.setFormValue(n === 0 ? this.value : null, "");
      const anchor = this.#inputs[firstEmpty(this.#chars)];
      if (n === 0) i.setValidity({});
      else if (n === this.#chars.length && !this.required) i.setValidity({});
      else if (n === this.#chars.length) i.setValidity({ valueMissing: true }, this.#labels.required, anchor);
      else i.setValidity({ tooShort: true }, this.#labels.incomplete.replace("{n}", String(n)), anchor);
    } catch {
      /* happy-dom y navegadores sin form-associated */
    }
  }

  #index(t: EventTarget | null): number {
    return t instanceof HTMLInputElement && this.#inputs.includes(t) ? this.#inputs.indexOf(t) : -1;
  }

  #onInput(e: Event): void {
    const i = this.#index(e.target);
    if (i < 0) return;
    const input = this.#inputs[i];
    const raw = sanitize(input.value, this.kind);
    let next = i;
    const old = this.#chars[i];
    if (raw.length === 2 && old && raw.includes(old)) {
      // Se escribió al lado del que había (el cursor no lo tenía seleccionado): gana el nuevo.
      this.#chars[i] = raw[0] === old ? raw[1] : raw[0];
      if (i < this.#chars.length - 1) next = i + 1;
    } else if (raw.length > 1) {
      // Pegado o llenado por el celular: se reparte.
      const r = spread(this.#chars, i, raw, this.kind);
      this.#chars = r.chars;
      next = r.next;
    } else {
      // Lo nuevo es el último que se escribió (la casilla tenía uno y se escribió otro encima).
      this.#chars[i] = raw.slice(-1);
      if (raw && i < this.#chars.length - 1) next = i + 1;
    }
    this.#paint();
    if (next !== i) this.#inputs[next].focus();
    this.#changed();
  }

  #onKey(e: KeyboardEvent): void {
    const i = this.#index(e.target);
    if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    const last = this.#chars.length - 1;
    const rtl = getComputedStyle(this).direction === "rtl";
    const go = (to: number) => {
      e.preventDefault();
      this.#inputs[Math.max(0, Math.min(last, to))].focus();
    };
    switch (e.key) {
      case "Backspace":
        if (this.#chars[i]) return; // el navegador borra; `input` lo registra
        if (i > 0) {
          e.preventDefault();
          this.#chars[i - 1] = "";
          this.#paint();
          this.#inputs[i - 1].focus();
          this.#changed();
        }
        return;
      case "Delete":
        if (!this.#chars[i]) return;
        e.preventDefault();
        this.#chars[i] = "";
        this.#paint();
        this.#changed();
        return;
      case "ArrowLeft":
        return go(rtl ? i + 1 : i - 1);
      case "ArrowRight":
        return go(rtl ? i - 1 : i + 1);
      case "Home":
        return go(0);
      case "End":
        return go(last);
    }
  }

  #onPaste(e: ClipboardEvent): void {
    const i = this.#index(e.target);
    const text = e.clipboardData?.getData("text") ?? "";
    if (i < 0 || !sanitize(text, this.kind)) return;
    e.preventDefault();
    const r = spread(this.#chars, i, text, this.kind);
    this.#chars = r.chars;
    this.#paint();
    this.#inputs[r.next].focus();
    this.#changed();
  }

  /** Avisa el cambio y, si quedó completo, `nx-otp-complete` después de este evento. */
  #changed(): void {
    const value = this.value;
    const complete = this.complete;
    emit(this, "nx-otp-change", { value, complete } satisfies OtpChangeDetail);
    clearTimeout(this.#completeTimer);
    if (!complete) {
      this.#announced = "";
      return;
    }
    if (value === this.#announced) return;
    this.#completeTimer = window.setTimeout(() => {
      if (!this.isConnected || !this.complete || this.value !== value || this.#announced === value) return;
      this.#announced = value;
      emit(this, "nx-otp-complete", { value } satisfies OtpCompleteDetail);
    }, 0);
  }
}
