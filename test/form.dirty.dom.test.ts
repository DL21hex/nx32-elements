// @vitest-environment happy-dom
//
// `dirty` por formulario: <nx-form> dice si lo que se ve difiere de lo último que cargó la app
// (`values`, un `fill()` sin origen), y <nx-dialog> lo suma a su propia marca, también el de una
// pestaña oculta: guardar una pestaña (que recarga sus valores y pone `dialog.dirty = false`) no deja
// sin aviso a otra con cambios. Y el cierre se puede cancelar desde la app antes del aviso.
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/form/index";
import "../src/components/dialog/index";
import type { NxForm } from "../src/components/form/index";
import type { NxDialog } from "../src/components/dialog/index";

afterEach(() => {
  for (const d of document.querySelectorAll<NxDialog>("nx-dialog")) d.close();
  document.body.innerHTML = "";
  localStorage.clear();
  vi.restoreAllMocks();
});
const tick = () => new Promise((r) => setTimeout(r, 0));

const FIELDS = [
  { key: "nombre", label: "Nombre" },
  { key: "celular", label: "Celular", type: "tel" as const },
  { key: "area", label: "Área", type: "readonly" as const },
];
const input = (f: NxForm, k: string) => f.querySelector<HTMLInputElement>(`nx-field[data-key="${k}"] [name="${k}"]`)!;
function type(el: HTMLInputElement, v: string) {
  el.value = v;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function form(html = "<nx-form></nx-form>"): Promise<NxForm> {
  document.body.innerHTML = html;
  const f = document.querySelector("nx-form")!;
  f.fields = FIELDS;
  f.values = { nombre: "Ana", celular: "3001234567", area: "Producción" };
  await tick();
  return f;
}

describe("<nx-form> dirty", () => {
  it("escribir lo marca; volver a lo cargado lo quita; nx-form-dirty avisa cada cambio", async () => {
    const f = await form();
    const seen: boolean[] = [];
    f.addEventListener("nx-form-dirty", (e) => seen.push(e.detail.dirty));
    expect(f.dirty).toBe(false);
    type(input(f, "nombre"), "Ana María");
    expect(f.dirty).toBe(true);
    expect(f.hasAttribute("data-dirty")).toBe(true);
    type(input(f, "nombre"), "Ana Marí");
    type(input(f, "nombre"), "Ana");
    expect(f.dirty).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it("asignar values es cargar: lo que había escrito deja de contar", async () => {
    const f = await form();
    type(input(f, "celular"), "3109998877");
    expect(f.dirty).toBe(true);
    f.values = { nombre: "Ana", celular: "3109998877" };
    expect(f.dirty).toBe(false);
  });

  it("un fill() sin origen (un recálculo de la app) es cargar; uno con origen (pegado) cuenta como cambio", async () => {
    const f = await form();
    f.fill({ celular: "3005556677" }, null, { force: true });
    expect(f.values.celular).toBe("3005556677");
    expect(f.dirty).toBe(false);
    f.fill({ nombre: "Beatriz" }, "Texto pegado", { force: true });
    expect(f.dirty).toBe(true);
  });

  it("un fill() sin origen que no entra (lo escribió la persona) sigue contando", async () => {
    const f = await form();
    type(input(f, "nombre"), "Carla");
    input(f, "nombre").dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    f.fill({ nombre: "Otra" }, null);
    expect(f.values.nombre).toBe("Carla");
    expect(f.dirty).toBe(true);
  });

  it("markClean() da lo que se ve por cargado sin tocar los valores", async () => {
    const f = await form();
    type(input(f, "nombre"), "Dora");
    f.markClean();
    expect(f.dirty).toBe(false);
    expect(f.values.nombre).toBe("Dora");
    type(input(f, "nombre"), "Ana");
    expect(f.dirty).toBe(true);
  });

  it("sin borrador no corre ningún reloj; con borrador sí", async () => {
    const spy = vi.spyOn(window, "setInterval");
    await form();
    expect(spy).not.toHaveBeenCalled();
    document.body.innerHTML = "";
    await form('<nx-form draft="alta-empleado"></nx-form>');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toBe(15000);
  });
});

describe("<nx-dialog> con formularios", () => {
  async function ficha(): Promise<{ d: NxDialog; a: NxForm; b: NxForm }> {
    document.body.innerHTML = `<nx-dialog mode="panel" heading="Ficha"><section id="ta"><nx-form id="a"></nx-form></section><section id="tb" hidden><nx-form id="b"></nx-form></section></nx-dialog>`;
    const d = document.querySelector("nx-dialog")!;
    const [a, b] = [...d.querySelectorAll("nx-form")];
    for (const f of [a, b]) {
      f.fields = FIELDS;
      f.values = { nombre: "Ana", celular: "3001234567" };
    }
    void d.show();
    await tick();
    return { d, a, b };
  }
  const guard = (d: NxDialog) => d.querySelector<HTMLElement>(".nx-dialog__guard")!;

  it("el dirty efectivo es la marca propia O algún formulario, también el de una pestaña oculta", async () => {
    const { d, a, b } = await ficha();
    expect(d.dirty).toBe(false);
    type(input(b, "nombre"), "Beatriz");
    expect(d.dirty).toBe(true);
    // Escribir y borrar en un formulario no deja la marca propia puesta.
    type(input(b, "nombre"), "Ana");
    expect(d.dirty).toBe(false);
    // Guardar la pestaña A (la app recarga sus valores y pone dirty = false) no limpia la B.
    type(input(a, "nombre"), "Alba");
    type(input(b, "celular"), "3110000000");
    a.values = { nombre: "Alba", celular: "3001234567" };
    d.dirty = false;
    expect(a.dirty).toBe(false);
    expect(d.dirty).toBe(true);
    d.querySelector<HTMLButtonElement>(".nx-dialog__x")!.click();
    expect(guard(d).hidden).toBe(false);
    expect(d.open).toBe(true);
  });

  it("dirty = false solo quita la marca propia", async () => {
    const { d, b } = await ficha();
    d.dirty = true;
    type(input(b, "nombre"), "Beatriz");
    d.dirty = false;
    expect(d.dirty).toBe(true);
  });

  it("«Descartar» cierra y al abrir otra vez todo empieza limpio", async () => {
    const { d, b } = await ficha();
    type(input(b, "nombre"), "Beatriz");
    d.querySelector<HTMLButtonElement>(".nx-dialog__x")!.click();
    d.querySelector<HTMLButtonElement>("[data-guard='discard']")!.click();
    expect(d.open).toBe(false);
    expect(d.dirty).toBe(false);
    void d.show();
    await tick();
    expect(b.dirty).toBe(false);
    d.querySelector<HTMLButtonElement>(".nx-dialog__x")!.click();
    expect(d.open).toBe(false);
  });

  it("pasar de registro con un formulario editado pregunta; al pasar, los formularios quedan limpios", async () => {
    const { d, b } = await ficha();
    d.nav = "prev next";
    await vi.waitFor(() => expect(d.querySelector('[data-tool="next"]')).not.toBeNull());
    type(input(b, "nombre"), "Beatriz");
    expect(d.requestNav("next")).toBe(false);
    expect(guard(d).hidden).toBe(false);
    d.querySelector<HTMLButtonElement>("[data-guard='discard']")!.click();
    expect(b.dirty).toBe(false);
    expect(d.dirty).toBe(false);
  });

  it("nx-dialog-beforeclose (cancelable) llega antes del aviso: la app puede negarse mientras guarda", async () => {
    const { d, b } = await ficha();
    let saving = true;
    const reasons: string[] = [];
    d.addEventListener("nx-dialog-beforeclose", (e) => {
      reasons.push(e.detail.reason);
      if (saving) e.preventDefault();
    });
    type(input(b, "nombre"), "Beatriz");
    d.querySelector<HTMLButtonElement>(".nx-dialog__x")!.click();
    expect(d.open).toBe(true);
    expect(guard(d).hidden).toBe(true);
    expect(d.close()).toBe(false);
    expect(reasons).toEqual(["button", "api"]);
    saving = false;
    // Ya sin guardar: con cambios, el aviso; «Descartar» no vuelve a preguntar a la app.
    d.querySelector<HTMLButtonElement>(".nx-dialog__x")!.click();
    expect(guard(d).hidden).toBe(false);
    d.querySelector<HTMLButtonElement>("[data-guard='discard']")!.click();
    expect(d.open).toBe(false);
    expect(reasons).toEqual(["button", "api", "button"]);
  });
});

describe("<nx-dialog> vuelve inert el fondo", () => {
  it("los hermanos del diálogo y de sus ancestros, no los avisos; al cerrar vuelven", async () => {
    document.body.innerHTML = `<header id="h"><button id="abrir">Abrir</button></header><main id="m"><div id="lado">x</div><div id="envoltura"><nx-dialog heading="D"><input></nx-dialog></div></main><nx-toaster></nx-toaster><aside id="ya" inert></aside>`;
    const d = document.querySelector("nx-dialog")!;
    void d.show();
    await tick();
    expect(document.getElementById("h")!.hasAttribute("inert")).toBe(true);
    expect(document.getElementById("lado")!.hasAttribute("inert")).toBe(true);
    expect(document.getElementById("m")!.hasAttribute("inert")).toBe(false);
    expect(document.getElementById("envoltura")!.hasAttribute("inert")).toBe(false);
    expect(document.querySelector("nx-toaster")!.hasAttribute("inert")).toBe(false);
    d.close();
    expect(document.getElementById("h")!.hasAttribute("inert")).toBe(false);
    expect(document.getElementById("lado")!.hasAttribute("inert")).toBe(false);
    // Lo que ya era inert por la app sigue así.
    expect(document.getElementById("ya")!.hasAttribute("inert")).toBe(true);
  });

  it("apilados: el de abajo queda inert mientras el de arriba está abierto", async () => {
    document.body.innerHTML = `<nx-dialog id="a" mode="panel" heading="A"><input></nx-dialog><nx-dialog id="b" mode="panel" heading="B"><input></nx-dialog>`;
    const [a, b] = [...document.querySelectorAll("nx-dialog")];
    void a.show();
    await tick();
    void b.show();
    await tick();
    expect(a.hasAttribute("inert")).toBe(true);
    b.close();
    expect(a.hasAttribute("inert")).toBe(false);
  });
});
