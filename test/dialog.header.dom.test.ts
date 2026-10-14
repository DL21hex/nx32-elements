// @vitest-environment happy-dom
// Cabecera de ficha de <nx-dialog>: avatar, estado, pasar de registro y el menú «Más».
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/dialog/index";
import type { NxDialog } from "../src/components/dialog/index";

afterEach(() => {
  for (const d of document.querySelectorAll<NxDialog>("nx-dialog")) d.close();
  document.body.innerHTML = "";
});

function mount(attrs = ""): NxDialog {
  document.body.innerHTML = `<nx-dialog mode="panel" heading="Laura Gómez Restrepo" ${attrs}><p>Contenido</p><input id="campo"></nx-dialog>`;
  return document.querySelector("nx-dialog")!;
}
const $ = <T extends Element = HTMLElement>(d: Element, s: string) => d.querySelector<T>(s)!;
const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
/** La cabecera de ficha es un chunk aparte (`import()`): se espera a que llegue. */
const ready = (d: NxDialog) => vi.waitFor(() => expect(d.querySelector(".nx-dialog__avatar")).not.toBeNull());

describe("<nx-dialog> como ficha", () => {
  it("sin los atributos nuevos, la cabecera queda como antes (y no trae el chunk)", async () => {
    const d = mount();
    await new Promise((r) => setTimeout(r, 20));
    expect(d.querySelector(".nx-dialog__avatar")).toBeNull();
    expect(d.querySelector("nx-badge")).toBeNull();
    expect(d.querySelector('[data-tool="prev"]')).toBeNull();
    expect($(d, ".nx-dialog__x").getAttribute("aria-label")).toBe("Cerrar");
  });

  it("avatar: iniciales de un nombre, o una imagen segura", async () => {
    const d = mount('avatar="Laura Gómez"');
    await ready(d);
    expect($(d, ".nx-dialog__avatar").textContent).toBe("LG");
    d.avatar = "https://cdn.acme.co/fotos/482.jpg";
    await vi.waitFor(() => expect(d.querySelector(".nx-dialog__avatar img")).not.toBeNull());
    expect($(d, ".nx-dialog__avatar img").getAttribute("src")).toBe("https://cdn.acme.co/fotos/482.jpg");
    d.avatar = "http://inseguro.co/x.jpg";
    await vi.waitFor(() => expect($(d, ".nx-dialog__avatar").hidden).toBe(true));
  });

  it("badge pinta el estado al lado del título, con su tono", async () => {
    const d = mount('badge="Activa" badge-tone="success"');
    await ready(d);
    const b = $(d, ".nx-dialog__trow nx-badge");
    expect(b.textContent).toBe("Activa");
    expect(b.getAttribute("tone")).toBe("success");
    expect(b.hidden).toBe(false);
  });

  it("badges: otras insignias después del estado, cada una con su tono; se rehacen al cambiar", async () => {
    const d = mount(`badge="Radicado" badge-tone="info" badges='[{"label":"Extemporánea","tone":"warning"},{"label":""}]'`);
    await ready(d);
    const pills = () => [...d.querySelectorAll(".nx-dialog__trow nx-badge")].map((b) => [b.textContent, b.getAttribute("tone")]);
    expect(pills()).toEqual([["Radicado", "info"], ["Extemporánea", "warning"]]);
    d.badges = [{ label: "Prórroga" }];
    await vi.waitFor(() => expect(pills()).toEqual([["Radicado", "info"], ["Prórroga", null]]));
    d.badges = null;
    await vi.waitFor(() => expect(pills()).toEqual([["Radicado", "info"]]));
  });

  it("badges sin badge también trae la cabecera de ficha", async () => {
    const d = mount();
    d.badges = [{ label: "Extemporánea", tone: "warning" }];
    await ready(d);
    expect($(d, ".nx-dialog__trow nx-badge:not([hidden])").textContent).toBe("Extemporánea");
  });

  it("nav: anterior y siguiente avisan con nx-dialog-nav; lo que no está, deshabilitado", async () => {
    const d = mount('nav="next"');
    void d.show();
    await ready(d);
    const prev = $<HTMLButtonElement>(d, '[data-tool="prev"]');
    const next = $<HTMLButtonElement>(d, '[data-tool="next"]');
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    expect(next.getAttribute("aria-label")).toBe("Registro siguiente");
    const spy = vi.fn();
    d.addEventListener("nx-dialog-nav", (e) => spy((e as CustomEvent).detail));
    next.click();
    expect(spy).toHaveBeenCalledWith({ dir: "next" });
  });

  it("J y K pasan de registro, salvo mientras se escribe", async () => {
    const d = mount('nav="prev next"');
    void d.show();
    await ready(d);
    const spy = vi.fn();
    d.addEventListener("nx-dialog-nav", (e) => spy((e as CustomEvent).detail.dir));
    d.focus();
    key(d, "j");
    key(d, "k");
    key($(d, "#campo"), "j");
    expect(spy.mock.calls.flat()).toEqual(["next", "prev"]);
  });

  it("actions: el menú «Más» con las destructivas al final, teclado y nx-dialog-action", async () => {
    const d = mount();
    void d.show();
    d.actions = [
      { id: "retirar", label: "Retirar empleada", danger: true },
      { id: "copiar", label: "Copiar código" },
      { id: "pagina", label: "Abrir en página completa" },
    ];
    await vi.waitFor(() => expect(d.querySelector<HTMLElement>('[data-tool="more"]')?.hidden).toBe(false));
    const more = $<HTMLButtonElement>(d, '[data-tool="more"]');
    more.click();
    const menu = $(d, '[role="menu"]');
    expect(menu.hidden).toBe(false);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    const items = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(items.map((i) => i.textContent)).toEqual(["Copiar código", "Abrir en página completa", "Retirar empleada"]);
    expect(menu.querySelector('[role="separator"]')).not.toBeNull();
    expect(document.activeElement).toBe(items[0]);
    key(items[0], "ArrowUp");
    expect(document.activeElement).toBe(items[2]);
    const spy = vi.fn();
    d.addEventListener("nx-dialog-action", (e) => spy((e as CustomEvent).detail));
    items[2].click();
    expect(spy).toHaveBeenCalledWith({ id: "retirar" });
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(more);
  });

  it("Escape cierra primero el menú, no el panel", async () => {
    const d = mount('actions=\'[{"id":"a","label":"Una"}]\'');
    void d.show();
    await ready(d);
    $<HTMLButtonElement>(d, '[data-tool="more"]').click();
    key(document.activeElement!, "Escape");
    expect($(d, '[role="menu"]').hidden).toBe(true);
    expect(d.open).toBe(true);
    key(document.activeElement!, "Escape");
    expect(d.open).toBe(false);
  });
});

// Una ficha con un formulario editado: «siguiente» cargaba otro registro y lo escrito se perdía
// sin aviso; y como `dirty` solo se reiniciaba al abrir, cerrar la ficha siguiente (sin tocarla)
// preguntaba «¿Descartar?».
describe("pasar de registro con cambios sin guardar", () => {
  const edit = (d: NxDialog) => {
    const input = $<HTMLInputElement>(d, "#campo");
    input.value = "algo";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(d.dirty).toBe(true);
  };
  const guard = (d: NxDialog) => $(d, ".nx-dialog__guard");
  async function open(): Promise<{ d: NxDialog; dirs: string[] }> {
    const d = mount('nav="prev next"');
    void d.show();
    await ready(d);
    const dirs: string[] = [];
    d.addEventListener("nx-dialog-nav", (e) => dirs.push(e.detail.dir));
    return { d, dirs };
  }

  it("sin cambios pasa directo, con un nx-dialog-nav cancelable", async () => {
    const { d, dirs } = await open();
    let cancelable: boolean | undefined;
    d.addEventListener("nx-dialog-nav", (e) => (cancelable = e.cancelable));
    $<HTMLButtonElement>(d, '[data-tool="next"]').click();
    expect(dirs).toEqual(["next"]);
    expect(cancelable).toBe(true);
    expect(guard(d).hidden).toBe(true);
    expect(d.requestNav("prev")).toBe(true);
    expect(dirs).toEqual(["next", "prev"]);
  });

  it("con cambios pide la misma confirmación que al cerrar; «Seguir editando» no pasa", async () => {
    const { d, dirs } = await open();
    edit(d);
    $<HTMLButtonElement>(d, '[data-tool="next"]').click();
    expect(dirs).toEqual([]);
    expect(guard(d).hidden).toBe(false);
    expect(guard(d).textContent).toContain("Tienes cambios sin guardar");
    expect(document.activeElement).toBe($(d, "[data-guard='keep']"));
    $<HTMLButtonElement>(d, "[data-guard='keep']").click();
    expect(guard(d).hidden).toBe(true);
    expect(dirs).toEqual([]);
    expect(d.dirty).toBe(true);
    expect(d.open).toBe(true);
    // Escape con el aviso a la vista también es seguir editando.
    expect(d.requestNav("prev")).toBe(false);
    key(document.activeElement!, "Escape");
    expect(guard(d).hidden).toBe(true);
    expect(dirs).toEqual([]);
    expect(d.open).toBe(true);
  });

  it("con cambios, «Descartar» pasa y deja dirty en false: cerrar la ficha siguiente no pregunta", async () => {
    const { d, dirs } = await open();
    const reasons: string[] = [];
    d.addEventListener("nx-dialog-close", (e) => reasons.push(e.detail.reason));
    edit(d);
    // J / K pasan por la misma guarda.
    d.focus();
    key(d, "j");
    expect(dirs).toEqual([]);
    expect(guard(d).hidden).toBe(false);
    $<HTMLButtonElement>(d, "[data-guard='discard']").click();
    expect(dirs).toEqual(["next"]);
    expect(d.dirty).toBe(false);
    expect(guard(d).hidden).toBe(true);
    // Sigue abierto (se pasó de registro, no se cerró) y el foco vuelve al botón de pasar.
    expect(d.open).toBe(true);
    expect(reasons).toEqual([]);
    expect(document.activeElement).toBe($(d, '[data-tool="next"]'));
    $<HTMLButtonElement>(d, ".nx-dialog__x").click();
    expect(guard(d).hidden).toBe(true);
    expect(d.open).toBe(false);
    expect(reasons).toEqual(["button"]);
  });

  it("preventDefault() en nx-dialog-nav no pasa, y lo escrito sigue protegido", async () => {
    const { d, dirs } = await open();
    d.addEventListener("nx-dialog-nav", (e) => e.preventDefault());
    // Sin cambios: el evento sale, pero no pasa.
    expect(d.requestNav("next")).toBe(false);
    expect(dirs).toEqual(["next"]);
    // Con cambios y «Descartar»: la app no lo deja pasar, así que `dirty` no cambia.
    edit(d);
    $<HTMLButtonElement>(d, '[data-tool="prev"]').click();
    $<HTMLButtonElement>(d, "[data-guard='discard']").click();
    expect(dirs).toEqual(["next", "prev"]);
    expect(d.dirty).toBe(true);
    $<HTMLButtonElement>(d, ".nx-dialog__x").click();
    expect(guard(d).hidden).toBe(false);
    expect(d.open).toBe(true);
  });

  it("una guarda de cierre y una de pasar no se mezclan: la última pedida es la que decide", async () => {
    const { d, dirs } = await open();
    edit(d);
    $<HTMLButtonElement>(d, ".nx-dialog__x").click();
    expect(guard(d).hidden).toBe(false);
    $<HTMLButtonElement>(d, '[data-tool="next"]').click();
    $<HTMLButtonElement>(d, "[data-guard='discard']").click();
    expect(dirs).toEqual(["next"]);
    expect(d.open).toBe(true);
  });
});
