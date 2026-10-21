// @vitest-environment happy-dom
// `<nx-form>` con contraseñas (`password`) y códigos (`otp`): validan como el control, nunca van al
// borrador, no se llenan desde afuera y no se muestran al leer.
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/form/index";
import "../src/components/otp/index";
import "../src/components/password/index";
import { check, cleanSections, displayValue } from "../src/components/form/logic";
import { FORM_LABELS } from "../src/components/form/form";
import { nxFormat } from "../src/core/locale";
import type { FormField, NxForm } from "../src/components/form/index";
import type { NxField } from "../src/components/field/index";
import type { NxOtp } from "../src/components/otp/index";
import type { NxPassword } from "../src/components/password/index";

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const tick = () => new Promise((r) => setTimeout(r, 0));

const FIELDS: FormField[] = [
  { key: "actual", label: "Contraseña actual", type: "password", required: true },
  { key: "nueva", label: "Contraseña nueva", type: "password", required: true, meter: true, avoid: ["Laura", "1036482117"], differs: "actual" },
  { key: "repite", label: "Repítela", type: "password", required: true, match: "nueva" },
  { key: "codigo", label: "Código del celular", type: "otp", required: true },
  { key: "nota", label: "Nota" },
];

async function mount(attrs = ""): Promise<NxForm> {
  document.body.innerHTML = `<nx-form locale="es-CO" ${attrs}></nx-form>`;
  const f = document.querySelector("nx-form")!;
  f.fields = FIELDS;
  await tick();
  return f;
}
const field = (f: NxForm, k: string) => f.querySelector<NxField>(`nx-field[data-key="${k}"]`)!;
const pw = (f: NxForm, k: string) => f.querySelector<NxPassword>(`nx-field[data-key="${k}"] nx-password`)!;
function typePw(el: NxPassword, v: string): void {
  const i = el.querySelector<HTMLInputElement>("input")!;
  i.value = v;
  i.dispatchEvent(new Event("input", { bubbles: true }));
}
function typeOtp(el: NxOtp, v: string): void {
  v.split("").forEach((c, n) => {
    const i = el.querySelectorAll<HTMLInputElement>(".nx-otp__box")[n];
    i.value = c;
    i.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("nx-form: password y otp en la lógica", () => {
  const fmt = nxFormat("es-CO");
  const ctx = { labels: FORM_LABELS, fmt, today: "2026-10-21" };
  const [defs] = [cleanSections([{ fields: FIELDS }])[0].fields];
  const def = (k: string) => defs.find((d) => d.key === k)!;

  it("una contraseña nueva con meter: débil, igual a la actual o sin coincidir", () => {
    expect(check(def("nueva"), "laura123456", ctx).error).toBe("Todavía no cumple las condiciones de abajo");
    expect(check(def("nueva"), "tres cafés en la terraza", { ...ctx, values: { actual: "tres cafés en la terraza" } }).error).toBe("Tiene que ser distinta de la actual");
    expect(check(def("nueva"), "tres cafés en la terraza", { ...ctx, values: { actual: "otra" } }).error).toBe("");
    expect(check(def("repite"), "abc", { ...ctx, values: { nueva: "abd" } }).error).toBe("No coincide con la nueva");
    // La contraseña no se recorta: un espacio al final cuenta.
    expect(check(def("repite"), "abc ", { ...ctx, values: { nueva: "abc" } }).error).toBe("No coincide con la nueva");
  });

  it("un código a medias pide los 6 dígitos; maxLength cambia cuántos", () => {
    expect(check(def("codigo"), "482", ctx).error).toBe("Escribe los 6 dígitos");
    expect(check(def("codigo"), "482113", ctx).error).toBe("");
    const four = cleanSections([{ fields: [{ key: "c", label: "C", type: "otp", maxLength: 4 }] }])[0].fields[0];
    expect(check(four, "48", ctx).error).toBe("Escribe los 4 dígitos");
  });

  it("al leer, nunca se muestran", () => {
    expect(displayValue(def("actual"), "secreta", fmt, FORM_LABELS)).toBe("••••••••");
    expect(displayValue(def("codigo"), "482113", fmt, FORM_LABELS)).toBe("••••••••");
    expect(displayValue(def("actual"), null, fmt, FORM_LABELS)).toBe("");
  });

  it("no van dentro de filas", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = cleanSections([{ fields: [{ key: "filas", label: "Filas", type: "rows", fields: [{ key: "n", label: "N" }, { key: "p", label: "P", type: "password" }] }] }]);
    expect(s[0].fields[0].subs!.map((x) => x.key)).toEqual(["n"]);
    expect(warn).toHaveBeenCalled();
  });
});

describe("nx-form: password y otp en el DOM", () => {
  it("pinta nx-password y nx-otp; match y differs apuntan al control del otro campo", async () => {
    const f = await mount();
    const nueva = pw(f, "nueva");
    expect(nueva.meter).toBe(true);
    expect(nueva.getAttribute("autocomplete")).toBeNull();
    expect(nueva.autocomplete).toBe("new-password");
    expect(nueva.avoid).toEqual(["Laura", "1036482117"]);
    expect(nueva.getAttribute("differs")).toBe(pw(f, "actual").id);
    expect(pw(f, "repite").getAttribute("match")).toBe(nueva.id);
    expect(field(f, "codigo").querySelector("nx-otp")!.getAttribute("length")).toBe("6");
    expect(field(f, "codigo").control!.localName).toBe("nx-otp");
  });

  it("enviar valida contra el control y manda las contraseñas en values", async () => {
    const f = await mount();
    const sent: Record<string, unknown>[] = [];
    f.addEventListener("nx-form-submit", (e) => sent.push(e.detail.values));
    typePw(pw(f, "actual"), "vieja clave");
    typePw(pw(f, "nueva"), "laura123456");
    typePw(pw(f, "repite"), "otra");
    typeOtp(f.querySelector("nx-otp")!, "482");
    expect(f.submit()).toBe(false);
    expect(field(f, "nueva").getAttribute("error")).toBe("Todavía no cumple las condiciones de abajo");
    expect(field(f, "repite").getAttribute("error")).toBe("No coincide con la nueva");
    expect(field(f, "codigo").getAttribute("error")).toBe("Escribe los 6 dígitos");
    typePw(pw(f, "nueva"), "tres cafés en la terraza de abril");
    typePw(pw(f, "repite"), "tres cafés en la terraza de abril");
    typeOtp(f.querySelector("nx-otp")!, "482113");
    expect(f.submit()).toBe(true);
    expect(sent[0]).toMatchObject({ actual: "vieja clave", nueva: "tres cafés en la terraza de abril", codigo: "482113" });
  });

  it("al salir del campo no se recorta la contraseña", async () => {
    const f = await mount();
    typePw(pw(f, "actual"), "  con espacios  ");
    pw(f, "actual").querySelector("input")!.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await tick();
    expect(f.values.actual).toBe("  con espacios  ");
  });

  it("el borrador nunca guarda contraseñas ni códigos", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = await mount('draft="clave"');
    typePw(pw(f, "actual"), "vieja clave");
    typeOtp(f.querySelector("nx-otp")!, "482113");
    const nota = f.querySelector<HTMLInputElement>('nx-field[data-key="nota"] input')!;
    nota.value = "hola";
    nota.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(700);
    const saved = JSON.parse(localStorage.getItem("nx-form:clave")!);
    expect(saved.v).toEqual({ nota: "hola" });
  });

  it("fill() no llena contraseñas ni códigos; values sí (la app)", async () => {
    const f = await mount();
    f.fill({ actual: "de un documento", codigo: "123456", nota: "Leída" }, "Cédula");
    expect(f.values.actual).toBeNull();
    expect(f.values.codigo).toBeNull();
    expect(f.values.nota).toBe("Leída");
    f.values = { actual: "puesta por la app" };
    expect(pw(f, "actual").value).toBe("puesta por la app");
  });

  it("en lectura se ven puntos, no la contraseña", async () => {
    const f = await mount();
    f.values = { actual: "secreta", codigo: "482113" };
    f.mode = "read";
    expect(field(f, "actual").getAttribute("text")).toBe("••••••••");
    expect(field(f, "codigo").getAttribute("text")).toBe("••••••••");
  });
});
