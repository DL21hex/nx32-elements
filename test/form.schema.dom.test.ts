// @vitest-environment happy-dom
//
// Reasignar `sections` en <nx-form> lo rehacía todo y el foco caía en <body>: nx32 lo reasigna cada
// vez que recarga el registro (con el mismo esquema, o con una ayuda distinta). Ahora el mismo
// esquema no rehace nada y, si cambia, el foco (y la selección del texto) vuelve al campo con la
// misma clave o ruta, si sigue.
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/form/index";
import type { FormField, FormSection, NxForm } from "../src/components/form/index";

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});
const tick = () => new Promise((r) => setTimeout(r, 0));

const schema = (hint: string): FormSection[] => [
  {
    heading: "Solicitud",
    fields: [
      { key: "nombre", label: "Nombre" },
      { key: "dias", label: "Días", type: "number", hint },
      { key: "tipo", label: "Tipo", type: "radio", options: ["Vacaciones", "Permiso", "Licencia"] },
      { key: "hijos", label: "Hijos", type: "rows", fields: [{ key: "nombre", label: "Nombre" }] },
    ],
  },
];
async function mount(): Promise<NxForm> {
  document.body.innerHTML = '<nx-form locale="es-CO"></nx-form>';
  const f = document.querySelector("nx-form")!;
  f.sections = schema("Le quedan 12");
  f.values = { nombre: "Ana", dias: 3, hijos: [{ nombre: "Sofía" }, { nombre: "Tomás" }] };
  await tick();
  return f;
}
const input = (f: NxForm, k: string) => f.querySelector<HTMLInputElement>(`nx-field[data-key="${k}"] input`)!;
function write(el: HTMLInputElement, v: string) {
  el.value = v;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("<nx-form>: reasignar el esquema", () => {
  it("el mismo esquema otra vez no rehace nada: los nodos y el foco se quedan", async () => {
    const f = await mount();
    const nombre = input(f, "nombre");
    const section = f.querySelector(".nx-form__sec");
    nombre.focus();
    write(nombre, "Ana M");
    f.sections = schema("Le quedan 12");
    expect(input(f, "nombre")).toBe(nombre);
    expect(f.querySelector(".nx-form__sec")).toBe(section);
    expect(document.activeElement).toBe(nombre);
    expect(f.values.nombre).toBe("Ana M");
    // También como atributo (JSON), y con `fields` para uno sin secciones.
    f.setAttribute("sections", JSON.stringify(schema("Le quedan 12")));
    expect(input(f, "nombre")).toBe(nombre);
    const plain = (hint: string): FormField[] => [{ key: "x", label: "X", hint }];
    f.fields = plain("a");
    const x = input(f, "x");
    f.fields = plain("a");
    expect(input(f, "x")).toBe(x);
    f.fields = plain("b");
    expect(input(f, "x")).not.toBe(x);
  });

  it("si cambia, rehace y el foco vuelve al mismo campo, con lo escrito y la selección del texto", async () => {
    const f = await mount();
    const nombre = input(f, "nombre");
    nombre.focus();
    write(nombre, "Ana María");
    nombre.setSelectionRange(2, 5);
    f.sections = schema("Le quedan 9");
    const now = input(f, "nombre");
    expect(now).not.toBe(nombre);
    expect(nombre.isConnected).toBe(false);
    expect(document.activeElement).toBe(now);
    expect(now.value).toBe("Ana María");
    expect([now.selectionStart, now.selectionEnd]).toEqual([2, 5]);
    expect(f.querySelector('nx-field[data-key="dias"]')!.getAttribute("hint")).toBe("Le quedan 9");
  });

  it("en un grupo de opciones vuelve a la misma opción; en una fila, a la misma fila", async () => {
    const f = await mount();
    const radios = () => [...f.querySelectorAll<HTMLInputElement>('nx-field[data-key="tipo"] input')];
    radios()[1].focus();
    f.sections = schema("Le quedan 9");
    expect(document.activeElement).toBe(radios()[1]);
    const second = () => f.querySelectorAll<HTMLInputElement>('.nx-form__row [name$=".nombre"]')[1];
    second().focus();
    const old = second();
    f.sections = schema("Le quedan 7");
    expect(second()).not.toBe(old);
    expect(document.activeElement).toBe(second());
    expect(second().value).toBe("Tomás");
  });

  it("si el campo ya no está, el foco no se inventa otro lugar", async () => {
    const f = await mount();
    input(f, "nombre").focus();
    f.sections = [{ heading: "Solicitud", fields: [{ key: "dias", label: "Días", type: "number" }] }];
    expect(f.querySelector('nx-field[data-key="nombre"]')).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });
});
