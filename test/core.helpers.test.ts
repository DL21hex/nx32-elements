// @vitest-environment happy-dom
// Los ayudantes que antes repetía cada componente (`reduced()`, `#emit`, `#attr`).
import { afterEach, describe, expect, it, vi } from "vitest";
import { emit, reducedMotion, safeHref, setAttr } from "../src/core/dom";
import { foldText, matchText } from "../src/core/text";

afterEach(() => vi.unstubAllGlobals());

describe("ayudantes del núcleo", () => {
  it("reducedMotion: lo que diga matchMedia, y false sin matchMedia (SSR)", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") }));
    expect(reducedMotion()).toBe(true);
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(reducedMotion()).toBe(false);
    vi.stubGlobal("matchMedia", undefined);
    expect(reducedMotion()).toBe(false);
  });

  it("emit: burbujea, cruza sombras y devuelve false si se canceló (solo si es cancelable)", () => {
    const parent = document.createElement("div");
    const el = parent.appendChild(document.createElement("span"));
    const seen: CustomEvent[] = [];
    parent.addEventListener("nx-x-y", (e) => {
      seen.push(e as CustomEvent);
      e.preventDefault();
    });
    expect(emit(el, "nx-x-y", { a: 1 })).toBe(true);
    expect(emit(el, "nx-x-y", { a: 2 }, true)).toBe(false);
    expect(seen.map((e) => [e.detail.a, e.bubbles, e.composed, e.cancelable])).toEqual([
      [1, true, true, false],
      [2, true, true, true],
    ]);
  });

  it("setAttr: null, undefined y \"\" quitan el atributo; lo demás va como texto", () => {
    const el = document.createElement("div");
    setAttr(el, "a", 3);
    expect(el.getAttribute("a")).toBe("3");
    setAttr(el, "a", "");
    expect(el.hasAttribute("a")).toBe(false);
    setAttr(el, "a", "x");
    setAttr(el, "a", null);
    expect(el.hasAttribute("a")).toBe(false);
    setAttr(el, "a", false);
    expect(el.getAttribute("a")).toBe("false");
  });

  it("safeHref: solo rutas relativas y http(s), mailto o tel", () => {
    expect(safeHref("java\tscript:alert(1)")).toBeUndefined();
    expect(safeHref(" /ruta ")).toBe("/ruta");
    expect(safeHref("mailto:a@b.co")).toBe("mailto:a@b.co");
  });
});

describe("matchText (tildes exactas) frente a foldText (sin tildes)", () => {
  // Peña es peña, no pena: sin mayúsculas, con tildes y ñ, en NFC.
  const has = (hay: string, q: string) => matchText(hay).includes(matchText(q));
  it("matchText: sin mayúsculas, con sus tildes y su ñ", () => {
    expect(has("PEÑA", "peña")).toBe(true);
    expect(has("Peña", "peña")).toBe(true);
    expect(has("PEÑA", "pena")).toBe(false);
    expect(has("TÉCNICO", "técnico")).toBe(true);
    expect(has("TÉCNICO", "tecnico")).toBe(false);
    expect(has("Llinás", "Llinas")).toBe(false);
  });
  it("matchText: NFC y NFD son lo mismo, y nunca quita marcas", () => {
    expect(matchText("te\u0301cnico")).toBe("técnico");
    expect(matchText("TE\u0301CNICO")).toBe(matchText("TÉCNICO"));
    expect(has("TÉCNICO", "te\u0301cnico")).toBe(true);
    expect(has("te\u0301cnico", "TÉCNICO")).toBe(true);
    expect(matchText("Ñandú")).toBe("ñandú");
    // Una letra latina en NFC conserva su posición (para resaltar).
    expect(matchText("Ana María Rincón")).toHaveLength("Ana María Rincón".length);
  });
  it("foldText sigue tolerando la tilde que falta", () => {
    expect(foldText("Mañana")).toBe("manana");
    expect(foldText("TÉCNICO")).toBe("tecnico");
  });
});
