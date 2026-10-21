// @vitest-environment happy-dom
// `<nx-fields>` para un perfil: nota bajo el título, dato verificado, oculto con «Mostrar», cambio
// en revisión y «Falta» al leer un dato obligatorio vacío.
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/fields/index";
import type { FieldItem, FieldsActionDetail, FieldsPendingDetail, NxFields } from "../src/components/fields/index";

afterEach(() => {
  document.body.innerHTML = "";
});

const ITEMS: FieldItem[] = [
  { key: "correo", label: "Correo personal", value: "laura@gmail.com", verified: true, input: { type: "email", required: true } },
  { key: "salario", label: "Salario básico", value: 5240000, format: "money", masked: true, readonly: true },
  { key: "cuenta", label: "Cuenta", value: "Bancolombia •••• 4821", readonly: true, pending: { value: "Davivienda •••• 0937", text: "Nómina lo revisa antes del 25 oct.", action: "Cancelar solicitud" } },
  { key: "calzado", label: "Calzado", value: null, input: { type: "select", options: ["36", "37"], required: true } },
  { key: "fijo", label: "Teléfono fijo", value: "", input: { type: "tel" } },
];

function mount(attrs = ""): NxFields {
  document.body.innerHTML = `<nx-fields locale="es-CO" heading="Contacto" action="Editar" ${attrs}></nx-fields>`;
  const el = document.querySelector("nx-fields")!;
  el.items = ITEMS;
  return el;
}
const row = (el: NxFields, label: string) => [...el.querySelectorAll<HTMLElement>(".nx-fields__f")].find((r) => r.querySelector(".nx-fields__l")!.textContent!.startsWith(label))!;

describe("<nx-fields>: lo de un perfil", () => {
  it("la nota bajo el título, con candado o con información", () => {
    const el = mount('note="Lo administra Talento Humano."');
    const note = el.querySelector<HTMLElement>(".nx-fields__note")!;
    expect(note.hidden).toBe(false);
    expect(note.textContent).toBe("Lo administra Talento Humano.");
    expect(note.previousElementSibling).toBe(el.querySelector(".nx-fields__head"));
    el.removeAttribute("note");
    expect(el.querySelector<HTMLElement>(".nx-fields__note")!.hidden).toBe(true);
    el.noteIcon = "info";
    expect(el.getAttribute("note-icon")).toBe("info");
  });

  it("verificado: «✓ Verificado» junto al valor, o el texto propio", () => {
    const el = mount();
    expect(row(el, "Correo").querySelector(".nx-fields__verified")!.textContent).toBe("Verificado");
    el.items = [{ ...ITEMS[0], verified: "Con su código" }];
    expect(el.querySelector(".nx-fields__verified")!.textContent).toBe("Con su código");
  });

  it("oculto: puntos y «Mostrar»; al mostrar, el monto con el locale y «Ocultar»", () => {
    const el = mount();
    const r = row(el, "Salario");
    expect(r.querySelector(".nx-fields__masked")!.textContent).toBe("••••••••");
    expect(r.textContent).not.toContain("5.240.000");
    expect(r.querySelector(".nx-sr-only")!.textContent).toBe("Oculto");
    const b = r.querySelector<HTMLButtonElement>(".nx-fields__reveal")!;
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(b.getAttribute("aria-label")).toBe("Mostrar: Salario básico");
    b.click();
    const r2 = row(el, "Salario");
    expect(r2.textContent).toMatch(/5\.240\.000/);
    const b2 = r2.querySelector<HTMLButtonElement>(".nx-fields__reveal")!;
    expect(b2.textContent).toBe("Ocultar");
    expect(document.activeElement).toBe(b2);
    // El candado sigue: no se edita aquí.
    expect(r2.querySelector(".nx-fields__lock")).toBeTruthy();
  });

  it("en revisión: el valor nuevo debajo del de hoy, a lo ancho, y su acción avisa", () => {
    const el = mount();
    const r = row(el, "Cuenta");
    expect(r.classList.contains("is-wide")).toBe(true);
    const p = r.querySelector(".nx-fields__pending")!;
    expect(p.textContent).toContain("En revisión: Davivienda •••• 0937");
    expect(p.textContent).toContain("Nómina lo revisa antes del 25 oct.");
    const got: FieldsPendingDetail[] = [];
    el.addEventListener("nx-fields-pending", (e) => got.push(e.detail));
    p.querySelector<HTMLButtonElement>(".nx-fields__pending-act")!.click();
    expect(got).toHaveLength(1);
    expect(got[0].key).toBe("cuenta");
    expect(got[0].action).toBe("Cancelar solicitud");
  });

  it("falta: un obligatorio vacío dice «Falta» y «Agregar» avisa con su clave; uno opcional es «—»", () => {
    const el = mount();
    const r = row(el, "Calzado");
    expect(r.querySelector(".nx-fields__missing")!.textContent).toBe("Falta");
    const got: FieldsActionDetail[] = [];
    el.addEventListener("nx-fields-action", (e) => got.push(e.detail));
    r.querySelector<HTMLButtonElement>(".nx-fields__add")!.click();
    expect(got).toEqual([{ action: "Editar", key: "calzado" }]);
    expect(row(el, "Teléfono").querySelector(".nx-fields__empty")).toBeTruthy();
    // Sin acción en la cabecera no hay a dónde llevar: solo «Falta».
    el.removeAttribute("action");
    expect(row(el, "Calzado").querySelector(".nx-fields__add")).toBeNull();
  });

  it("en el resumen: oculto sí, sin el cambio en revisión", () => {
    const el = mount('variant="summary"');
    expect(row(el, "Salario").querySelector(".nx-fields__masked")).toBeTruthy();
    expect(el.querySelector(".nx-fields__pending")).toBeNull();
  });

  it("al editar, el dato oculto sigue como texto con candado y el verificado no estorba", () => {
    const el = mount();
    el.editing = true;
    expect(el.querySelector(".nx-fields__verified")).toBeNull();
    expect(el.querySelector<HTMLInputElement>('[name="correo"]')!.value).toBe("laura@gmail.com");
  });
});
