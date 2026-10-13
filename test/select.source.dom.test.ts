// @vitest-environment happy-dom
//
// <nx-select source>: Enter durante la búsqueda no elige una opción de la consulta ANTERIOR. Cada
// tecla deja la lista vieja a la vista mientras llega la nueva; antes se resaltaba su primera
// opción y Enter la elegía. Ahora los resultados llevan su consulta, un Enter en espera elige la
// primera de la respuesta vigente, cerrar los olvida y cada búsqueda tiene plazo.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { NxSelect } from "../src/index";
import "../src/index";

beforeAll(() => {
  const fire = (el: HTMLElement, newState: string) => {
    for (const type of ["beforetoggle", "toggle"]) el.dispatchEvent(Object.assign(new Event(type), { newState }));
  };
  HTMLElement.prototype.showPopover = function (this: HTMLElement) {
    fire(this, "open");
  };
  HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
    fire(this, "closed");
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Un servidor lento: cada petición espera a que la prueba la conteste (o a que se cancele). */
function slowServer() {
  const pending: { q: string; reply: (list: unknown[]) => void }[] = [];
  const fetch = vi.fn((url: URL, init?: RequestInit) => {
    const q = new URL(String(url)).searchParams.get("q") ?? "";
    return new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      pending.push({ q, reply: (list) => resolve(new Response(JSON.stringify(list))) });
    });
  });
  vi.stubGlobal("fetch", fetch);
  return {
    fetch,
    /** Contesta la última petición de `q`. */
    reply(q: string, list: unknown[]) {
      const p = [...pending].reverse().find((x) => x.q === q);
      if (!p) throw new Error(`nadie pidió «${q}»`);
      p.reply(list);
    },
  };
}

function mount(attrs = ""): NxSelect {
  document.body.innerHTML = `<nx-select source="/buscar" ${attrs}></nx-select>`;
  const el = document.querySelector("nx-select")!;
  el.fields = [
    { key: "label", label: "Nombre" },
    { key: "doc", label: "Cédula", kind: "digits" },
  ];
  return el;
}
const input = (el: NxSelect) => el.querySelector<HTMLInputElement>(".nx-select__input")!;
const type = (el: NxSelect, text: string) => {
  input(el).value = text;
  input(el).dispatchEvent(new Event("input"));
};
const key = (el: NxSelect, k: string) => input(el).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const optionTexts = (el: NxSelect) => [...el.querySelectorAll(".nx-select__opt .nx-select__primary")].map((o) => o.textContent);
const highlighted = (el: NxSelect) => el.querySelector('.nx-select__opt[data-hl="true"]');

describe("<nx-select source> con un servidor lento", () => {
  it("Enter mientras llega la consulta nueva no elige la opción de la anterior: espera y elige la primera de la nueva", async () => {
    const srv = slowServer();
    const el = mount();
    el.show();
    await sleep(5);
    srv.reply("", []);
    type(el, "ana");
    await sleep(300);
    srv.reply("ana", [
      { value: "1", label: "Ana Rincón", doc: "111" },
      { value: "2", label: "Ana Pérez", doc: "222" },
    ]);
    await sleep(5);
    expect(highlighted(el)?.textContent).toContain("Ana Rincón");

    // Una tecla más: la lista vieja sigue a la vista, pero no se resalta nada de ella.
    type(el, "ana p");
    expect(optionTexts(el)).toEqual(["Ana Rincón", "Ana Pérez"]);
    expect(highlighted(el)).toBeNull();
    key(el, "ArrowDown");
    expect(highlighted(el)).toBeNull();
    key(el, "Enter");
    expect(el.value).toBe("");
    expect(el.open).toBe(true);

    // Llega la respuesta de «ana p»: el Enter que esperaba elige su primera opción.
    await sleep(300);
    srv.reply("ana p", [{ value: "2", label: "Ana Pérez", doc: "222" }]);
    await sleep(5);
    expect(el.value).toBe("2");
    expect(el.open).toBe(false);
  });

  it("un Enter en espera cuya respuesta llega vacía no elige nada", async () => {
    const srv = slowServer();
    const el = mount();
    el.show();
    await sleep(5);
    srv.reply("", [{ value: "1", label: "Ana Rincón" }]);
    await sleep(5);
    type(el, "zz");
    key(el, "Enter");
    await sleep(300);
    srv.reply("zz", []);
    await sleep(5);
    expect(el.value).toBe("");
    expect(el.open).toBe(true);
    expect(el.querySelector(".nx-select__empty")?.textContent).toBe("Sin resultados");
  });

  it("seguir escribiendo después de Enter cancela ese Enter", async () => {
    const srv = slowServer();
    const el = mount();
    el.show();
    await sleep(5);
    srv.reply("", []);
    type(el, "an");
    key(el, "Enter");
    type(el, "ana");
    await sleep(300);
    srv.reply("ana", [{ value: "1", label: "Ana Rincón" }]);
    await sleep(5);
    expect(el.value).toBe("");
    expect(highlighted(el)?.textContent).toContain("Ana Rincón");
  });

  it("una respuesta vieja que llega durante la espera entre teclas no se pinta como vigente", async () => {
    const srv = slowServer();
    const el = mount();
    el.show();
    await sleep(5);
    srv.reply("", []);
    type(el, "a");
    await sleep(300);
    // La petición de «a» sigue en camino cuando se escribe «ab»: se cancela.
    type(el, "ab");
    expect(() => srv.reply("a", [{ value: "9", label: "Andrés" }])).not.toThrow();
    await sleep(5);
    key(el, "Enter");
    expect(el.value).toBe("");
    expect(optionTexts(el)).toEqual([]);
  });

  it("no descarta resultados del servidor que no casan en el cliente (busca por campos que no ve)", async () => {
    const srv = slowServer();
    const el = mount();
    el.show();
    await sleep(5);
    srv.reply("", []);
    type(el, "rincon perez");
    await sleep(300);
    srv.reply("rincon perez", [{ value: "7", label: "Luisa Gómez" }]);
    await sleep(5);
    expect(optionTexts(el)).toEqual(["Luisa Gómez"]);
    key(el, "Enter");
    expect(el.value).toBe("7");
  });

  it("al cerrar se olvidan los resultados: al abrir no sale la lista de antes", async () => {
    const srv = slowServer();
    const el = mount();
    el.show();
    await sleep(5);
    srv.reply("", [{ value: "1", label: "Ana Rincón" }]);
    await sleep(5);
    expect(optionTexts(el)).toEqual(["Ana Rincón"]);
    el.hide();
    expect(el.querySelectorAll(".nx-select__opt").length).toBe(0);
    el.show();
    expect(optionTexts(el)).toEqual([]);
    expect(el.querySelector(".nx-select__empty")?.textContent).toBe("Buscando…");
    key(el, "Enter");
    await sleep(5);
    srv.reply("", [{ value: "3", label: "Carlos" }]);
    await sleep(5);
    // El Enter pulsado en la espera elige la primera de ESTA respuesta, no la de antes de cerrar.
    expect(el.value).toBe("3");
  });

  it("una búsqueda que no contesta vence su plazo y muestra el error", async () => {
    slowServer();
    const el = mount('timeout="40"');
    expect(el.timeout).toBe(40);
    el.show();
    await sleep(80);
    expect(el.querySelector(".nx-select__empty")?.textContent).toBe("No se pudo buscar");
    expect(el.querySelector<HTMLElement>(".nx-select__spin")!.hidden).toBe(true);
  });

  it("el plazo por defecto es de 30 s", () => {
    const el = mount();
    expect(el.timeout).toBe(30_000);
  });
});
