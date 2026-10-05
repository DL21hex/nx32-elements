// @vitest-environment happy-dom
// nxSupported(): lo que fija el mínimo de navegadores, preguntado una vez por la app.
import { afterEach, describe, expect, it, vi } from "vitest";
import { nxSupported } from "../src/core/support";

const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
const all = (t: string, v?: string) => (v === undefined ? t === "selector(:popover-open)" : v.startsWith("light-dark("));

afterEach(() => {
  vi.unstubAllGlobals();
  delete proto.showPopover;
});

describe("nxSupported", () => {
  it("un navegador al día: ok, sin nada que falte, con las versiones mínimas", () => {
    proto.showPopover = () => {};
    vi.stubGlobal("CSS", { supports: all });
    expect(nxSupported()).toEqual({ ok: true, missing: [], minimum: { chrome: 123, edge: 123, safari: 17.5, firefox: 125 } });
  });

  it("sin light-dark() (Chrome 122, Safari 17.4): falta light-dark", () => {
    proto.showPopover = () => {};
    vi.stubGlobal("CSS", { supports: (t: string, v?: string) => v === undefined && all(t) });
    expect(nxSupported()).toMatchObject({ ok: false, missing: ["light-dark"] });
  });

  it("sin Popover API (Firefox 124) o sin :popover-open: falta popover", () => {
    vi.stubGlobal("CSS", { supports: all });
    expect(nxSupported().missing).toEqual(["popover"]);
    proto.showPopover = () => {};
    vi.stubGlobal("CSS", { supports: (t: string, v?: string) => v !== undefined && all(t, v) });
    expect(nxSupported().missing).toEqual(["popover"]);
  });

  it("sin custom elements ni CSS.supports: falta todo, y no lanza", () => {
    vi.stubGlobal("customElements", undefined);
    vi.stubGlobal("CSS", undefined);
    expect(nxSupported()).toMatchObject({ ok: false, missing: ["custom-elements", "popover", "light-dark"] });
  });

  it("un CSS.supports que lanza (selector() desconocido en un motor viejo) cuenta como que falta", () => {
    proto.showPopover = () => {};
    vi.stubGlobal("CSS", {
      supports: (t: string, v?: string) => {
        if (v === undefined) throw new SyntaxError(t);
        return all(t, v);
      },
    });
    expect(nxSupported().missing).toEqual(["popover"]);
  });

  it("en el servidor (sin document) responde ok", () => {
    vi.stubGlobal("document", undefined);
    expect(nxSupported()).toMatchObject({ ok: true, missing: [] });
  });

  it("el mínimo no se puede cambiar desde la app", () => {
    expect(Object.isFrozen(nxSupported().minimum)).toBe(true);
  });
});
