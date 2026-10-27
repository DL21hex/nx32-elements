// @vitest-environment happy-dom
//
// <nx-select source> con un valor que no puede resolver: antes se quedaba con la selección vieja
// (`selection = [A]; value = "B"` seguía diciendo A, con `value === "A"`), contra lo que dice el
// README. Ahora la selección es lo que se conoce del valor pedido (vacía si nada) y el valor
// pendiente se resuelve cuando llega su registro.
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
  document.body.innerHTML = "";
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shown = (el: NxSelect) => el.querySelector(".nx-select__field")!.textContent!.trim();

describe("<nx-select source>: un valor que todavía no se conoce", () => {
  it("no deja a la vista la selección anterior: queda vacío y pendiente", () => {
    document.body.innerHTML = '<nx-select source="/x" placeholder="Elige…"></nx-select>';
    const el = document.querySelector<NxSelect>("nx-select")!;
    el.selection = [{ value: "A", label: "Pedro" }];
    expect(el.value).toBe("A");
    el.value = "B";
    expect(el.value).toBe("");
    expect(el.selection).toEqual([]);
    expect(shown(el)).toBe("Elige…");
  });

  it("el valor pendiente se resuelve cuando su registro llega en una búsqueda", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ value: "B", label: "Beatriz" }]))));
    document.body.innerHTML = '<nx-select source="/x"></nx-select>';
    const el = document.querySelector<NxSelect>("nx-select")!;
    el.selection = [{ value: "A", label: "Pedro" }];
    el.value = "B";
    el.show();
    await sleep(10);
    expect(el.value).toBe("B");
    expect(el.selection).toEqual([{ value: "B", label: "Beatriz" }]);
  });

  it("con multiple, se queda lo que se conoce y espera el resto", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ value: "B", label: "Beatriz" }]))));
    document.body.innerHTML = '<nx-select source="/x" multiple></nx-select>';
    const el = document.querySelector<NxSelect>("nx-select")!;
    el.selection = [
      { value: "A", label: "Pedro" },
      { value: "C", label: "Carla" },
    ];
    el.value = ["C", "B"];
    expect(el.value).toEqual(["C"]);
    el.show();
    await sleep(10);
    expect(el.value).toEqual(["C", "B"]);
  });
});
