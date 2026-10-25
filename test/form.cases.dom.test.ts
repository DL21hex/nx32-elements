// @vitest-environment happy-dom
//
// <nx-form>: lo que les faltaba a los formularios de solicitudes después de 0.30.0 — opciones que
// se ofrecen según otro campo (`when` en la opción), valores ocultos que pone el servidor (`hidden`),
// avisos dentro del formulario (`notice`, con `blocks`) y variantes de un campo (`cases`: la fecha
// de inicio con un mínimo u otro según el motivo).
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/index";
import type { FormField, NxForm } from "../src/components/form/index";
import type { NxField } from "../src/components/field/index";

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  vi.restoreAllMocks();
});
const tick = () => new Promise((r) => setTimeout(r, 0));

async function mount(fields: FormField[], values?: Record<string, unknown>): Promise<NxForm> {
  document.body.innerHTML = '<nx-form locale="es-CO"></nx-form>';
  const f = document.querySelector("nx-form")!;
  f.fields = fields;
  if (values) f.values = values;
  await tick();
  return f;
}
const field = (f: NxForm, k: string) => f.querySelector<HTMLElement>(`[data-key="${k}"]`)!;
const nativeSelect = (f: NxForm, k: string) => f.querySelector<HTMLSelectElement>(`nx-field[data-key="${k}"] select`)!;
function choose(f: NxForm, k: string, v: string) {
  const s = nativeSelect(f, k);
  s.value = v;
  s.dispatchEvent(new Event("change", { bubbles: true }));
}
function typeIn(f: NxForm, k: string, v: string) {
  const i = f.querySelector<HTMLInputElement>(`nx-field[data-key="${k}"] input`)!;
  i.value = v;
  i.dispatchEvent(new Event("input", { bubbles: true }));
  i.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
}

describe("<nx-form>: opciones según otro campo (when en la opción)", () => {
  const FIELDS: FormField[] = [
    { key: "tipo", label: "Tipo", type: "select", required: true, options: [{ value: "1", label: "Personal" }, { value: "2", label: "Legal" }] },
    {
      key: "motivo",
      label: "Motivo",
      type: "select",
      required: true,
      options: [
        { value: "10", label: "Cita médica", when: { tipo: "1" } },
        { value: "11", label: "Diligencia", when: { tipo: "1" } },
        { value: "20", label: "Citación judicial", when: { tipo: "2" } },
        { value: "99", label: "Otro" },
      ],
    },
  ];

  it("se ofrecen las del tipo elegido (y las sin condición)", async () => {
    const f = await mount(FIELDS);
    const opts = () => [...nativeSelect(f, "motivo").options].map((o) => o.value).filter(Boolean);
    expect(opts()).toEqual(["99"]);
    choose(f, "tipo", "1");
    expect(opts()).toEqual(["10", "11", "99"]);
    choose(f, "tipo", "2");
    expect(opts()).toEqual(["20", "99"]);
  });

  it("cambiar el tipo vacía un motivo que ya no es de él, y conserva uno que sigue", async () => {
    const f = await mount(FIELDS);
    choose(f, "tipo", "1");
    choose(f, "motivo", "10");
    expect(f.values.motivo).toBe("10");
    choose(f, "tipo", "2");
    expect(f.values.motivo).toBeNull();
    choose(f, "motivo", "99");
    choose(f, "tipo", "1");
    expect(f.values.motivo).toBe("99");
  });

  it("un fill que trae los dos los respeta; cargar un registro no poda nada", async () => {
    const f = await mount(FIELDS, { tipo: "2", motivo: "10" });
    expect(f.values.motivo).toBe("10");
    f.fill({ tipo: "1", motivo: "11" });
    expect(f.values).toMatchObject({ tipo: "1", motivo: "11" });
    f.fill({ tipo: "2" });
    expect(f.values.motivo).toBeNull();
  });

  it("en un segmented, las que no se ofrecen se esconden", async () => {
    const f = await mount([
      { key: "tipo", label: "Tipo", type: "segmented", options: ["a", "b"] },
      { key: "x", label: "X", type: "radio", options: [{ value: "1", when: { tipo: "a" } }, { value: "2", when: { tipo: "b" } }] },
    ]);
    const label = (v: string) => f.querySelector<HTMLInputElement>(`nx-field[data-key="x"] input[value="${v}"]`)!.closest("label")!;
    expect(label("1").hidden && label("2").hidden).toBe(true);
    f.fill({ tipo: "a" });
    expect(label("1").hidden).toBe(false);
    expect(label("2").hidden).toBe(true);
  });
});

describe("<nx-form>: valores ocultos (hidden)", () => {
  const FIELDS: FormField[] = [
    { key: "empleado", label: "Empleado" },
    { key: "estado", label: "Estado", type: "hidden" },
    { key: "tipo", label: "Tipo", when: { estado: "ready" } },
  ];

  it("no se ve, viaja en values y sirve de condición; un fill del servidor no marca cambios", async () => {
    const f = await mount(FIELDS);
    expect(field(f, "estado").hidden).toBe(true);
    expect(field(f, "tipo").hidden).toBe(true);
    f.fill({ estado: "ready" });
    expect(field(f, "estado").hidden).toBe(true);
    expect(field(f, "tipo").hidden).toBe(false);
    expect(f.values.estado).toBe("ready");
    expect(f.dirty).toBe(false);
    expect(f.sources).toEqual({});
  });

  it("el servidor lo cambia aunque la persona haya escrito en el formulario", async () => {
    const f = await mount(FIELDS);
    typeIn(f, "empleado", "Ana");
    f.fill({ estado: "no_schedule" });
    expect(f.values.estado).toBe("no_schedule");
  });
});

describe("<nx-form>: avisos (notice)", () => {
  const FIELDS: FormField[] = [
    { key: "motivo", label: "Motivo", options: ["a", "b"], type: "select" },
    { key: "pago", label: "Remuneración", type: "notice", value: "Remunerado", when: { motivo: "a" } },
    { key: "duracion", label: "Duración", type: "notice", tone: "success" },
    { key: "sin", label: "Sin motivos", type: "notice", tone: "danger", value: "Tu empresa no tiene motivos configurados.", blocks: true, when: { motivo: "b" } },
  ];

  it("se ve con su texto y su tono; vacío, no se ve; no sale en values", async () => {
    const f = await mount(FIELDS);
    expect(field(f, "pago").hidden).toBe(true);
    choose(f, "motivo", "a");
    expect(field(f, "pago").hidden).toBe(false);
    expect(field(f, "pago").textContent).toContain("Remuneración");
    expect(field(f, "pago").textContent).toContain("Remunerado");
    expect(field(f, "duracion").hidden).toBe(true);
    expect(field(f, "duracion").dataset.tone).toBe("success");
    expect(Object.keys(f.values)).toEqual(["motivo"]);
  });

  it("la app cambia su texto con fill() sin marcar cambios", async () => {
    const f = await mount(FIELDS);
    f.fill({ duracion: "2,5 horas" });
    expect(field(f, "duracion").hidden).toBe(false);
    expect(field(f, "duracion").textContent).toContain("2,5 horas");
    expect(f.dirty).toBe(false);
    f.fill({ duracion: "" });
    expect(field(f, "duracion").hidden).toBe(true);
  });

  it("con blocks, mientras se ve no deja enviar y se enfoca", async () => {
    const f = await mount(FIELDS);
    const sent = vi.fn();
    f.addEventListener("nx-form-submit", sent);
    choose(f, "motivo", "b");
    expect(f.submit()).toBe(false);
    expect(sent).not.toHaveBeenCalled();
    expect(f.missing).toEqual(["sin"]);
    expect(document.activeElement).toBe(field(f, "sin"));
    choose(f, "motivo", "a");
    expect(f.submit()).toBe(true);
  });
});

describe("<nx-form>: variantes (cases)", () => {
  const FIELDS: FormField[] = [
    { key: "motivo", label: "Motivo", type: "select", options: ["con", "sin"] },
    {
      key: "inicio",
      label: "Inicio",
      type: "date",
      min: "2026-10-26",
      hint: "Desde hoy",
      cases: [{ when: { motivo: "con" }, min: "2026-10-29", hint: "Con tres días de anticipación", required: true }],
    },
  ];

  it("la primera que se cumple cambia el mínimo, la ayuda y si es obligatorio", async () => {
    const f = await mount(FIELDS);
    const input = () => f.querySelector<HTMLInputElement>('nx-field[data-key="inicio"] input')!;
    const nx = () => field(f, "inicio") as NxField;
    expect(nx().getAttribute("hint")).toBe("Desde hoy");
    choose(f, "motivo", "con");
    expect(input().getAttribute("min")).toBe("2026-10-29");
    expect(nx().getAttribute("hint")).toBe("Con tres días de anticipación");
    expect(nx().hasAttribute("required")).toBe(true);
    expect(f.submit()).toBe(false);
    expect(f.missing).toEqual(["inicio"]);
    typeIn(f, "inicio", "2026-10-27");
    expect(f.validate()).toBe(false);
    choose(f, "motivo", "sin");
    expect(input().getAttribute("min")).toBe("2026-10-26");
    expect(nx().hasAttribute("required")).toBe(false);
    expect(f.validate()).toBe(true);
  });

  it("en una fecha con calendario, la variante cambia los días bloqueados", async () => {
    const f = await mount([
      { key: "motivo", label: "Motivo", type: "select", options: ["habiles", "calendario"] },
      { key: "inicio", label: "Inicio", type: "date", unavailable: { weekdays: [0] }, cases: [{ when: { motivo: "habiles" }, unavailable: { weekdays: [0, 6] } }] },
    ]);
    await vi.waitFor(() => expect(customElements.get("nx-date")).toBeTruthy());
    const d = () => f.querySelector<HTMLElement>('nx-field[data-key="inicio"] nx-date')!;
    expect(JSON.parse(d().getAttribute("unavailable")!)).toEqual({ dates: [], weekdays: [0] });
    choose(f, "motivo", "habiles");
    expect(JSON.parse(d().getAttribute("unavailable")!)).toEqual({ dates: [], weekdays: [0, 6] });
  });

  it("el esquema se devuelve en su forma pública", async () => {
    const f = await mount([{ key: "d", label: "D", type: "date", cases: [{ when: { x: "1" }, unavailable: { weekdays: [6] } }] }]);
    expect(f.fields[0].cases).toEqual([{ when: { x: "1" }, unavailable: { dates: [], weekdays: [6] } }]);
  });
});
