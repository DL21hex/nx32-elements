// @vitest-environment happy-dom
//
// <nx-form>: lo que un campo toma de otro y lo que les faltaba a los formularios de solicitudes
// (permisos, vacaciones, asistencias): días bloqueados en una fecha (`unavailable`, con
// `<nx-date>`), selects que buscan con el valor de otro campo (`dependsOn`), selección múltiple
// (`multiple`), límites que dependen de otra fecha (`minFrom`/`maxFrom`) y un valor que sigue al de
// otro campo mientras nadie escriba el suyo (`defaultFrom`).
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/index";
import type { FormField, NxForm } from "../src/components/form/index";
import type { NxField } from "../src/components/field/index";

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const tick = () => new Promise((r) => setTimeout(r, 0));

async function mount(fields: FormField[]): Promise<NxForm> {
  document.body.innerHTML = '<nx-form locale="es-CO"></nx-form>';
  const f = document.querySelector("nx-form")!;
  f.fields = fields;
  await vi.waitFor(() => expect(customElements.get("nx-select") && customElements.get("nx-date")).toBeTruthy());
  await tick();
  return f;
}
const field = (f: NxForm, k: string) => f.querySelector<NxField>(`nx-field[data-key="${k}"]`)!;
type Sel = HTMLElement & { value: string | string[]; source: string | null; disabled: boolean; selection: { value: string; label: string }[] };
const select = (f: NxForm, k: string) => f.querySelector<Sel>(`nx-field[data-key="${k}"] nx-select`)!;
/** Lo que hace la persona al elegir de la lista (los registros llegan del servidor). */
const pickRecords = (sel: Sel, ids: string[]) => {
  sel.selection = ids.map((value) => ({ value, label: `Empresa ${value}` }));
  sel.dispatchEvent(new Event("change", { bubbles: true }));
};
const dateInput = (f: NxForm, k: string) => f.querySelector<HTMLInputElement>(`nx-field[data-key="${k}"] .nx-date__input`)!;
function typeDate(f: NxForm, k: string, text: string) {
  const i = dateInput(f, k);
  i.value = text;
  i.dispatchEvent(new Event("input", { bubbles: true }));
  i.dispatchEvent(new Event("change", { bubbles: true }));
  i.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
}

describe("<nx-form>: días bloqueados (unavailable)", () => {
  const FIELDS: FormField[] = [
    { key: "inicio", label: "Fecha de inicio", type: "date", required: true, unavailable: { dates: [{ date: "2026-10-12", label: "Festivo: Día de la Raza" }, "2026-11-02"], weekdays: [0, 6] } },
    { key: "nota", label: "Nota", type: "date" },
  ];

  it("con unavailable, el campo es <nx-date>; sin él, sigue el del navegador", async () => {
    const f = await mount(FIELDS);
    const d = f.querySelector<HTMLElement & { unavailable: unknown }>('nx-field[data-key="inicio"] nx-date')!;
    expect(d).not.toBeNull();
    expect(d.unavailable).toEqual({ dates: [{ date: "2026-10-12", label: "Festivo: Día de la Raza" }, "2026-11-02"], weekdays: [0, 6] });
    expect(f.querySelector('nx-field[data-key="nota"] input[type="date"]')).not.toBeNull();
  });

  it("un día bloqueado no pasa: con su motivo, o sin él", async () => {
    const f = await mount(FIELDS);
    typeDate(f, "inicio", "12/10/2026");
    expect(f.values.inicio).toBe("2026-10-12");
    expect(field(f, "inicio").getAttribute("error")).toBe("No se puede elegir: Festivo: Día de la Raza");
    typeDate(f, "inicio", "10/10/2026"); // sábado
    expect(field(f, "inicio").getAttribute("error")).toBe("Ese día no se puede elegir");
    typeDate(f, "inicio", "13/10/2026");
    expect(field(f, "inicio").hasAttribute("error")).toBe(false);
    expect(f.validate()).toBe(true);
  });

  it("lo escrito que no es una fecha se avisa al salir, no mientras se escribe", async () => {
    const f = await mount(FIELDS);
    const i = dateInput(f, "inicio");
    i.value = "1/1";
    i.dispatchEvent(new Event("input", { bubbles: true }));
    expect(field(f, "inicio").hasAttribute("error")).toBe(false);
    i.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    expect(field(f, "inicio").getAttribute("error")).toBe("Escribe una fecha válida");
  });

  it("values y fill llegan al calendario, y en lectura es una fecha en palabras", async () => {
    const f = await mount(FIELDS);
    f.values = { inicio: "2026-10-14" };
    expect(dateInput(f, "inicio").value).toBe("14/10/2026");
    f.mode = "read";
    expect(field(f, "inicio").getAttribute("text")).toMatch(/14/);
  });
});

describe("<nx-form>: límites y valor desde otra fecha (minFrom, defaultFrom)", () => {
  const FIELDS: FormField[] = [
    { key: "inicio", label: "Desde", type: "date", required: true },
    { key: "fin", label: "Hasta", type: "date", required: true, minFrom: "inicio", defaultFrom: "inicio" },
  ];

  it("«hasta» empieza igual que «desde» y lo sigue mientras nadie lo cambie", async () => {
    const f = await mount(FIELDS);
    const ini = f.querySelector<HTMLInputElement>('nx-field[data-key="inicio"] input')!;
    const fin = f.querySelector<HTMLInputElement>('nx-field[data-key="fin"] input')!;
    const set = (el: HTMLInputElement, v: string) => {
      el.value = v;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    set(ini, "2026-10-14");
    expect(f.values.fin).toBe("2026-10-14");
    expect(fin.min).toBe("2026-10-14");
    set(ini, "2026-10-16");
    expect(f.values.fin).toBe("2026-10-16");
    set(fin, "2026-10-20");
    set(ini, "2026-10-17");
    expect(f.values.fin).toBe("2026-10-20");
  });

  it("no antes de la otra fecha: el error dice desde cuándo", async () => {
    const f = await mount(FIELDS);
    f.values = { inicio: "2026-10-14", fin: "2026-10-10" };
    expect(f.validate()).toBe(false);
    expect(field(f, "fin").getAttribute("error")).toMatch(/^No antes del /);
  });
});

describe("<nx-form>: selects dependientes (dependsOn)", () => {
  const FIELDS: FormField[] = [
    { key: "empresa", label: "Empresa", type: "select", options: [{ value: "1", label: "Crear" }, { value: "2", label: "Banasan" }] },
    { key: "tipo", label: "Tipo", type: "select", required: true, source: "/permisos/tipos", dependsOn: ["empresa"] },
    { key: "motivo", label: "Motivo", type: "select", source: "/permisos/motivos?activos=1", dependsOn: ["empresa", "tipo"] },
  ];

  it("apagado y con «Primero elige…» mientras falta el padre; luego busca con su valor", async () => {
    const f = await mount(FIELDS);
    const tipo = select(f, "tipo");
    expect(tipo.disabled).toBe(true);
    expect(tipo.getAttribute("placeholder")).toBe("Primero elige empresa");
    expect(select(f, "motivo").getAttribute("placeholder")).toBe("Primero elige empresa, tipo");
    const emp = f.querySelector<HTMLSelectElement>('nx-field[data-key="empresa"] select')!;
    emp.value = "2";
    emp.dispatchEvent(new Event("change", { bubbles: true }));
    expect(tipo.disabled).toBe(false);
    expect(tipo.source).toBe("/permisos/tipos?empresa=2");
    expect(select(f, "motivo").disabled).toBe(true);
    pickRecords(tipo, ["7"]);
    expect(select(f, "motivo").source).toBe("/permisos/motivos?activos=1&empresa=2&tipo=7");
  });

  it("la búsqueda lleva el valor del padre", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify([{ value: "7", label: "Calamidad" }])));
    vi.stubGlobal("fetch", fetch);
    const f = await mount(FIELDS);
    f.values = { empresa: "1" };
    await tick();
    const tipo = select(f, "tipo") as Sel & { show(): void };
    const pop = tipo.querySelector<HTMLElement>("[popover]")!;
    pop.showPopover = () => pop.dispatchEvent(Object.assign(new Event("beforetoggle"), { newState: "open" }));
    tipo.show();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    const url = new URL(String((fetch.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe("/permisos/tipos");
    expect(url.searchParams.get("empresa")).toBe("1");
    expect(url.searchParams.get("q")).toBe("");
  });

  it("cambiar el padre vacía a los hijos (en cadena), y un fill que trae al hijo lo respeta", async () => {
    const f = await mount(FIELDS);
    f.values = { empresa: "1", tipo: "7", motivo: "3" };
    const emp = f.querySelector<HTMLSelectElement>('nx-field[data-key="empresa"] select')!;
    emp.value = "2";
    emp.dispatchEvent(new Event("change", { bubbles: true }));
    expect(f.values.tipo).toBeNull();
    expect(f.values.motivo).toBeNull();
    expect(select(f, "tipo").value).toBe("");
    f.fill({ empresa: "1", tipo: "9" });
    expect(f.values.tipo).toBe("9");
    // La empresa la eligió la persona: el fill de arriba no la pisó. Forzado, sí, y el tipo se va.
    expect(f.values.empresa).toBe("2");
    f.fill({ empresa: "1" }, null, { force: true });
    expect(f.values.tipo).toBeNull();
  });

  it("values no vacía nada: carga un registro entero tal cual", async () => {
    const f = await mount(FIELDS);
    f.values = { empresa: "1", tipo: "7", motivo: "3" };
    expect(f.values).toMatchObject({ empresa: "1", tipo: "7", motivo: "3" });
  });

  it("dependsOn sin source se ignora (con un aviso)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = await mount([{ key: "a", label: "A", type: "select", options: ["x"] }, { key: "b", label: "B", type: "select", options: ["y"], dependsOn: ["a"] }]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dependsOn de "b" necesita source'));
    expect(f.fields[1].dependsOn).toBeUndefined();
  });
});

describe("<nx-form>: selección múltiple (multiple)", () => {
  const FIELDS: FormField[] = [
    { key: "empresas", label: "Empresas", type: "select", multiple: true, required: true, source: "/empresas" },
    { key: "areas", label: "Áreas", type: "select", multiple: true, options: [{ value: "a", label: "Producción" }, { value: "b", label: "Logística" }] },
  ];

  it("siempre con nx-select multiple; el valor es una lista y vacía cuenta como faltante", async () => {
    const f = await mount(FIELDS);
    const emp = select(f, "empresas");
    expect(emp.hasAttribute("multiple")).toBe(true);
    expect(select(f, "areas").hasAttribute("multiple")).toBe(true);
    expect(f.values.empresas).toEqual([]);
    expect(f.missing).toContain("empresas");
    pickRecords(emp, ["1", "2"]);
    expect(f.values.empresas).toEqual(["1", "2"]);
    expect(f.missing).not.toContain("empresas");
  });

  it("acepta la lista o «1,2» de afuera, y en lectura nombra todas", async () => {
    const f = await mount(FIELDS);
    f.values = { empresas: "1,2", areas: ["a", "b"] };
    expect(f.values.empresas).toEqual(["1", "2"]);
    expect(select(f, "areas").value).toEqual(["a", "b"]);
    f.mode = "read";
    expect(field(f, "areas").getAttribute("text")).toBe("Producción, Logística");
  });

  it("un select de varios como padre viaja separado por comas", async () => {
    const f = await mount([...FIELDS, { key: "sedes", label: "Sedes", type: "select", multiple: true, source: "/sedes", dependsOn: ["empresas"] }]);
    pickRecords(select(f, "empresas"), ["1", "2"]);
    expect(select(f, "sedes").source).toBe("/sedes?empresas=1%2C2");
  });
});
