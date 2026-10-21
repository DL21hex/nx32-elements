// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/password/index";
import { breachCount, firstUnmet, hasPersonal, isCommon, passwordRules, passwordStrength, rangeUrl } from "../src/components/password/logic";
import type { NxPassword, PasswordChangeDetail } from "../src/components/password/index";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

const AVOID = ["Laura Marcela", "Gómez Restrepo", "1036482117"];

function mount(html = "<nx-password></nx-password>"): NxPassword {
  document.body.innerHTML = html;
  return document.querySelector("nx-password")!;
}
const input = (el: NxPassword) => el.querySelector<HTMLInputElement>(".nx-password__input")!;
function type(el: NxPassword, v: string): void {
  input(el).value = v;
  input(el).dispatchEvent(new Event("input", { bubbles: true }));
}
const states = (el: NxPassword) => Object.fromEntries([...el.querySelectorAll<HTMLElement>(".nx-password__rule")].map((li) => [li.dataset.rule, li.dataset.state ?? ""]));

describe("password: lógica", () => {
  it("las más usadas: iguales, con números al final, adentro o en secuencia", () => {
    expect(isCommon("123456")).toBe(true);
    expect(isCommon("Colombia2026*")).toBe(true);
    expect(isCommon("miQwerty2026")).toBe(true);
    expect(isCommon("abcd1234")).toBe(true);
    expect(isCommon("aaaaaaaa")).toBe(true);
    expect(isCommon("Contraseña")).toBe(true);
    expect(isCommon("tres cafés en la terraza de abril")).toBe(false);
    expect(isCommon("")).toBe(false);
  });
  it("datos de la persona: palabras de 3 letras o más y 5 dígitos seguidos del documento", () => {
    expect(hasPersonal("laura2026!", AVOID)).toBe(true);
    expect(hasPersonal("GOMEZ.medellin", AVOID)).toBe(true);
    expect(hasPersonal("x48211y", AVOID)).toBe(true);
    expect(hasPersonal("tres cafés en la terraza de abril", AVOID)).toBe(false);
  });
  it("el nivel: una frase larga es fuerte; una común o personal no pasa de débil", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("laura123456", AVOID)).toBe(1);
    expect(passwordStrength("Xk2!")).toBe(1);
    expect(passwordStrength("tres cafés en la terraza de abril")).toBe(4);
    expect(passwordStrength("Ventana-Roja-73")).toBeGreaterThanOrEqual(3);
  });
  it("las condiciones, en orden, con las opcionales solo si aplican", () => {
    const r = passwordRules("laura1234567", { minLength: 12, avoid: AVOID, differs: "vieja" });
    expect(r.map((x) => [x.id, x.ok])).toEqual([["length", true], ["avoid", false], ["common", false], ["differs", true]]);
    expect(firstUnmet(r)?.id).toBe("avoid");
    expect(passwordRules("", {}).map((x) => x.ok)).toEqual([false, false]);
    // La de filtraciones no se sabe mientras va: no cuenta como incumplida.
    const b = passwordRules("una frase bastante larga", { breach: null });
    expect(b.find((x) => x.id === "breach")!.ok).toBeNull();
    expect(firstUnmet(b)).toBeUndefined();
    expect(passwordRules("abc", { minLength: 8 })[0].label).toBe("8 caracteres o más");
  });
  it("el rango de k-anonimato: busca el resto del hash en la respuesta", () => {
    const body = "0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\n";
    expect(breachCount(body, "1e4c9b93f3f0682250b6cf8331b7ee68fd8")).toBe(3861493);
    expect(breachCount(body, "FFFF")).toBe(0);
    expect(rangeUrl("/api/pwned/range/", "5BAA6")).toBe("/api/pwned/range/5BAA6");
  });
});

describe("<nx-password>", () => {
  it("el ojo muestra y oculta, con su nombre y aria-pressed", () => {
    const el = mount();
    const eye = el.querySelector<HTMLButtonElement>(".nx-password__eye")!;
    expect(input(el).type).toBe("password");
    expect(eye.getAttribute("aria-label")).toBe("Mostrar la contraseña");
    eye.click();
    expect(input(el).type).toBe("text");
    expect(eye.getAttribute("aria-pressed")).toBe("true");
    expect(eye.getAttribute("aria-label")).toBe("Ocultar la contraseña");
    eye.click();
    expect(input(el).type).toBe("password");
  });

  it("sin meter: solo el campo, para entrar", () => {
    const el = mount();
    expect(el.querySelector<HTMLElement>(".nx-password__meter")!.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>(".nx-password__rules")!.hidden).toBe(true);
    expect(input(el).autocomplete).toBe("current-password");
    expect(el.rules).toEqual([]);
  });

  it("con meter: medidor con su nivel en palabras y condiciones que se cumplen al escribir", () => {
    const el = mount(`<nx-password meter avoid='${JSON.stringify(AVOID)}'></nx-password>`);
    expect(input(el).autocomplete).toBe("new-password");
    const changes: PasswordChangeDetail[] = [];
    el.addEventListener("nx-password-change", (e) => changes.push(e.detail));
    type(el, "laura123456");
    expect(states(el)).toEqual({ length: "", avoid: "bad", common: "bad" });
    expect(el.querySelector(".nx-password__level")!.textContent).toBe("Seguridad: Débil");
    expect(changes.at(-1)!.ok).toBe(false);
    expect(JSON.stringify(changes.at(-1))).not.toContain("laura123456");
    type(el, "tres cafés en la terraza de abril");
    expect(states(el)).toEqual({ length: "ok", avoid: "ok", common: "ok" });
    expect(el.querySelector<HTMLElement>(".nx-password__meter")!.dataset.score).toBe("4");
    expect(el.querySelector(".nx-password__level")!.textContent).toBe("Seguridad: Fuerte");
    expect(changes.at(-1)!.ok).toBe(true);
    expect(el.strength).toBe(4);
    // Las condiciones describen el campo.
    expect(input(el).getAttribute("aria-describedby")).toContain(el.querySelector(".nx-password__rules")!.id);
  });

  it("avoid también como texto separado por comas", () => {
    const el = mount('<nx-password meter avoid="Laura, 1036482117"></nx-password>');
    expect(el.avoid).toEqual(["Laura", "1036482117"]);
  });

  it("differs y match comparan con el otro campo y se revisan cuando el otro cambia", () => {
    document.body.innerHTML = `
      <nx-password id="cur"></nx-password>
      <nx-password id="new" meter differs="cur" min-length="8"></nx-password>
      <nx-password id="rep" match="new"></nx-password>`;
    const [cur, nw, rep] = [...document.querySelectorAll("nx-password")] as NxPassword[];
    type(cur, "ventana roja azul");
    type(nw, "ventana roja azul");
    expect(states(nw).differs).toBe("bad");
    type(nw, "puerta verde lejana");
    expect(states(nw).differs).toBe("ok");
    type(cur, "puerta verde lejana");
    expect(states(nw).differs).toBe("bad");
    const spy = vi.fn();
    rep.addEventListener("nx-password-change", (e) => spy(e.detail.ok));
    type(rep, "puerta verde");
    expect(spy).toHaveBeenLastCalledWith(false);
    type(rep, "puerta verde lejana");
    expect(spy).toHaveBeenLastCalledWith(true);
  });

  it("filtraciones: pide solo los 5 primeros del SHA-1 al endpoint y marca la condición", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // SHA-1 de «password»: 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\n0018A45C4D1DEF81644B54AB7F969B88D65:1", { status: 200 }));
    const el = mount('<nx-password meter min-length="8" breach-endpoint="/api/pwned/range"></nx-password>');
    type(el, "password");
    expect(states(el).breach).toBe("wait");
    expect(el.querySelector('[data-rule="breach"]')!.textContent).toContain("Revisando");
    await vi.advanceTimersByTimeAsync(600);
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toBe("/api/pwned/range/5BAA6");
    expect(states(el).breach).toBe("bad");
  });

  it("un endpoint de otro origen no se usa", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const el = mount('<nx-password meter breach-endpoint="https://otro.example/range"></nx-password>');
    type(el, "una frase bastante larga de verdad");
    await new Promise((r) => setTimeout(r, 650));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(el.querySelector('[data-rule="breach"]')).toBeNull();
  });

  it("value solo por código; reset la vacía y la vuelve a ocultar", () => {
    const el = mount();
    el.value = "secreta";
    expect(input(el).value).toBe("secreta");
    expect(el.hasAttribute("value")).toBe(false);
    el.querySelector<HTMLButtonElement>(".nx-password__eye")!.click();
    el.formResetCallback();
    expect(el.value).toBe("");
    expect(input(el).type).toBe("password");
  });

  it("Mayúsculas activadas", () => {
    const el = mount();
    const e = new KeyboardEvent("keydown", { key: "A", bubbles: true });
    Object.defineProperty(e, "getModifierState", { value: (k: string) => k === "CapsLock" });
    input(el).dispatchEvent(e);
    const caps = el.querySelector<HTMLElement>(".nx-password__caps")!;
    expect(caps.hidden).toBe(false);
    expect(caps.textContent).toBe("Mayúsculas activadas");
    input(el).dispatchEvent(new FocusEvent("blur"));
    expect(caps.hidden).toBe(true);
  });
});
