// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/otp/index";
import "../src/components/field/index";
import { charsOf, cleanLength, firstEmpty, isComplete, sanitize, spread } from "../src/components/otp/logic";
import type { NxOtp, OtpChangeDetail } from "../src/components/otp/index";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

const tick = () => new Promise((r) => setTimeout(r, 0));

function mount(html = "<nx-otp></nx-otp>"): NxOtp {
  document.body.innerHTML = html;
  return document.querySelector("nx-otp")!;
}
const boxes = (el: NxOtp) => [...el.querySelectorAll<HTMLInputElement>(".nx-otp__box")];
function type(input: HTMLInputElement, v: string): void {
  input.value = v;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
function key(input: HTMLInputElement, k: string): KeyboardEvent {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
  input.dispatchEvent(e);
  return e;
}

describe("otp: lógica", () => {
  it("largo de 4 a 8, 6 por defecto", () => {
    expect(cleanLength("4")).toBe(4);
    expect(cleanLength(8)).toBe(8);
    expect(cleanLength(9)).toBe(6);
    expect(cleanLength(null)).toBe(6);
    expect(cleanLength("x")).toBe(6);
  });
  it("solo dígitos (también de ancho completo); alfanumérico en mayúsculas y sin tildes", () => {
    expect(sanitize("482 113")).toBe("482113");
    expect(sanitize("482-113")).toBe("482113");
    expect(sanitize("１２３")).toBe("123");
    expect(sanitize("ab-1é", "alphanumeric")).toBe("AB1E");
    expect(sanitize(null)).toBe("");
  });
  it("reparte desde la casilla; un código entero empieza en la primera", () => {
    const empty = charsOf("", 6);
    expect(spread(empty, 2, "12")).toEqual({ chars: ["", "", "1", "2", "", ""], next: 4 });
    expect(spread(empty, 3, "482113")).toEqual({ chars: ["4", "8", "2", "1", "1", "3"], next: 5 });
    expect(spread(empty, 4, "9999")).toEqual({ chars: ["", "", "", "", "9", "9"], next: 5 });
    expect(isComplete(charsOf("123456", 6))).toBe(true);
    expect(firstEmpty(["1", "", "3"])).toBe(1);
    expect(firstEmpty(["1", "2"])).toBe(1);
  });
});

describe("<nx-otp>", () => {
  it("seis casillas con nombre, teclado numérico y un respiro en el medio", () => {
    const el = mount();
    const b = boxes(el);
    expect(b).toHaveLength(6);
    expect(b[0].getAttribute("aria-label")).toBe("Dígito 1 de 6");
    expect(b[0].getAttribute("autocomplete")).toBe("one-time-code");
    expect(b[1].getAttribute("autocomplete")).toBe("off");
    expect(b[0].inputMode).toBe("numeric");
    expect(b.map((x) => x.hasAttribute("data-split"))).toEqual([false, false, false, true, false, false]);
    expect(el.querySelector(".nx-otp__boxes")!.getAttribute("aria-label")).toBe("Código de verificación");
    el.setAttribute("length", "4");
    expect(boxes(el)).toHaveLength(4);
    expect(boxes(el).some((x) => x.hasAttribute("data-split"))).toBe(false);
  });

  it("escribir pasa a la siguiente; la última avisa nx-otp-complete una vez, después del evento", async () => {
    const el = mount();
    const changes: OtpChangeDetail[] = [];
    const done: string[] = [];
    el.addEventListener("nx-otp-change", (e) => changes.push(e.detail));
    el.addEventListener("nx-otp-complete", (e) => done.push(e.detail.value));
    "48211".split("").forEach((c, i) => type(boxes(el)[i], c));
    expect(document.activeElement).toBe(boxes(el)[5]);
    expect(el.value).toBe("48211");
    expect(el.complete).toBe(false);
    type(boxes(el)[5], "3");
    expect(changes.at(-1)).toEqual({ value: "482113", complete: true });
    // Todavía no: sale en el turno siguiente, cuando el `input` ya terminó de subir.
    expect(done).toEqual([]);
    await tick();
    expect(done).toEqual(["482113"]);
    // El mismo código no vuelve a avisar.
    type(boxes(el)[5], "3");
    await tick();
    expect(done).toEqual(["482113"]);
  });

  it("pegar o el llenado del celular se reparten; letras y guiones se ignoran", async () => {
    const el = mount();
    const b = boxes(el);
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, "clipboardData", { value: { getData: () => "Tu código es 482-113" } });
    b[2].dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    expect(el.value).toBe("482113");
    el.clear(false);
    // El celular pone el código entero en la primera casilla.
    type(boxes(el)[0], "907150");
    expect(el.value).toBe("907150");
    expect(b.map((x) => x.value)).toEqual(["9", "0", "7", "1", "5", "0"]);
  });

  it("Retroceso en una vacía borra la anterior; flechas, Inicio y Fin se mueven", () => {
    const el = mount();
    el.value = "4821";
    const b = boxes(el);
    b[4].focus();
    expect(key(b[4], "Backspace").defaultPrevented).toBe(true);
    expect(el.value).toBe("482");
    expect(document.activeElement).toBe(b[3]);
    key(b[3], "ArrowLeft");
    expect(document.activeElement).toBe(b[2]);
    key(b[2], "End");
    expect(document.activeElement).toBe(b[5]);
    key(b[5], "Home");
    expect(document.activeElement).toBe(b[0]);
    key(b[0], "Delete");
    expect(el.value).toBe("82");
    expect(b[0].value).toBe("");
  });

  it("escribir sobre una casilla llena reemplaza su dígito", () => {
    const el = mount();
    el.value = "111111";
    type(boxes(el)[2], "17");
    expect(el.value).toBe("117111");
  });

  it("solo letras y dígitos en alfanumérico", () => {
    const el = mount('<nx-otp kind="alphanumeric" length="4"></nx-otp>');
    type(boxes(el)[0], "a");
    type(boxes(el)[1], "-");
    expect(el.value).toBe("A");
    expect(boxes(el)[0].inputMode).toBe("text");
  });

  it("value por código: recorta y no avisa", () => {
    const el = mount();
    const spy = vi.fn();
    el.addEventListener("nx-otp-change", spy);
    el.value = "12345678";
    expect(el.value).toBe("123456");
    expect(spy).not.toHaveBeenCalled();
    el.setAttribute("value", "9 9");
    expect(el.value).toBe("99");
  });

  it("disabled apaga las casillas; focus() va a la primera vacía", () => {
    const el = mount();
    el.value = "12";
    el.focus();
    expect(document.activeElement).toBe(boxes(el)[2]);
    el.disabled = true;
    expect(boxes(el).every((b) => b.disabled)).toBe(true);
  });

  it("dentro de nx-field: es su control y recibe el error", async () => {
    document.body.innerHTML = '<nx-field label="Código" required><nx-otp name="code"></nx-otp></nx-field>';
    const field = document.querySelector("nx-field")!;
    const el = document.querySelector("nx-otp")!;
    await tick();
    expect(field.control).toBe(el);
    expect(el.required).toBe(true);
    field.setAttribute("error", "Ese código no coincide");
    await tick();
    expect(el.getAttribute("aria-invalid")).toBe("true");
    expect(boxes(el)[0].getAttribute("aria-invalid")).toBe("true");
  });
});
