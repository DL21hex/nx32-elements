// @vitest-environment happy-dom
//
// Lo que hace <nx-form> sin que la persona lo pida no le mueve nada: un `fill()` sin origen (la app
// recalculando mientras se escribe) destellaba y desplazaba la vista con `scrollIntoView` suave, y
// sostener Ctrl+S enviaba una vez por cada repetición de la tecla.
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/form/index";
import type { NxForm } from "../src/components/form/index";

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});
const tick = () => new Promise((r) => setTimeout(r, 0));

async function mount(): Promise<NxForm> {
  document.body.innerHTML = '<nx-form locale="es-CO"></nx-form>';
  const f = document.querySelector("nx-form")!;
  f.fields = [
    { key: "nombre", label: "Nombre", required: true },
    { key: "apellido", label: "Apellido" },
    { key: "dias", label: "Días de prueba", type: "readonly" },
  ];
  await tick();
  return f;
}
const field = (f: NxForm, k: string) => f.querySelector<HTMLElement>(`nx-field[data-key="${k}"]`)!;

describe("<nx-form>: fill() sin origen", () => {
  it("no destella ni desplaza la vista; con origen, sí", async () => {
    const f = await mount();
    const scroll = vi.fn();
    for (const k of ["nombre", "apellido", "dias"]) field(f, k).scrollIntoView = scroll;
    const nombre = f.querySelector<HTMLInputElement>('[name="nombre"]')!;
    nombre.focus();
    expect(f.fill({ dias: "36", apellido: "Ortiz" })).toBe(2);
    expect(f.values).toMatchObject({ apellido: "Ortiz", dias: "36" });
    expect(field(f, "dias").classList.contains("is-filled")).toBe(false);
    expect(field(f, "apellido").classList.contains("is-filled")).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(nombre);
    // La persona trayendo datos (con origen) sí recorre los campos.
    f.fill({ apellido: "Ortiz Medina" }, "Cédula");
    expect(field(f, "apellido").classList.contains("is-filled")).toBe(true);
    expect(scroll).toHaveBeenCalledTimes(1);
  });
});

describe("<nx-form>: Ctrl+S sostenido", () => {
  it("envía una vez; las repeticiones de la tecla no envían, pero tampoco abren «Guardar como»", async () => {
    const f = await mount();
    f.fill({ nombre: "Ana" });
    const sent: unknown[] = [];
    f.addEventListener("nx-form-submit", (e) => sent.push((e as CustomEvent).detail));
    const nombre = f.querySelector<HTMLInputElement>('[name="nombre"]')!;
    const press = (repeat: boolean) => {
      const e = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, repeat, bubbles: true, cancelable: true });
      nombre.dispatchEvent(e);
      return e;
    };
    expect(press(false).defaultPrevented).toBe(true);
    const held = [press(true), press(true), press(true)];
    expect(sent).toHaveLength(1);
    expect(held.every((e) => e.defaultPrevented)).toBe(true);
    // Soltar y volver a pulsar sí envía otra vez.
    press(false);
    expect(sent).toHaveLength(2);
  });
});
