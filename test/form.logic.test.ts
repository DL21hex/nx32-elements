import { describe, expect, it, vi } from "vitest";
import { nxFormat } from "../src/core/locale";
import { FORM_LABELS } from "../src/components/form/form";
import { check, cleanSections, coerce, dateLimit, displayValue, emailTypo, isEmpty, isISODate, matches, parseDateText, sameValue, todayISO, usesSearch, visibleKeys, type FieldDef } from "../src/components/form/logic";

const fmt = nxFormat("es-CO");
const ctx = { labels: FORM_LABELS, fmt, today: "2026-10-07" };
const def = (f: Partial<FieldDef> & { key: string }): FieldDef => ({ label: f.key, type: "text", options: [], sec: 0, ...f }) as FieldDef;

describe("cleanSections", () => {
  it("limpia el esquema: opciones, tipos desconocidos, claves repetidas y campos sin label", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = cleanSections([
      {
        heading: "Contrato",
        fields: [
          { key: "cargo", label: "Cargo", type: "select", options: ["Soldador", { value: "aux", label: "Auxiliar", fills: { area: "Logística" } }, null, 3] },
          { key: "cargo", label: "Repetido" },
          { key: "x", label: "X", type: "submit" },
          { label: "Sin clave" },
          { key: "y" },
        ],
      },
      { heading: "Vacía", fields: [] },
      "basura",
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("s1");
    expect(out[0].fields.map((f) => f.key)).toEqual(["cargo", "x"]);
    expect(out[0].fields[0].options).toEqual([{ value: "Soldador" }, { value: "aux", label: "Auxiliar", fills: { area: "Logística" } }, { value: "3" }]);
    expect(out[0].fields[1].type).toBe("text");
    expect(warn).toHaveBeenCalledTimes(4);
    warn.mockRestore();
  });

  it("nada que no sea un arreglo da cero secciones", () => {
    expect(cleanSections(null)).toEqual([]);
    expect(cleanSections({ fields: [] })).toEqual([]);
  });
});

describe("condiciones", () => {
  it("valor, lista, not, filled y casillas", () => {
    const v = { tipo: "Término fijo", n: 3, ok: true, tags: ["a", "b"], vacio: null };
    expect(matches({ tipo: "Término fijo" }, v)).toBe(true);
    expect(matches({ tipo: ["Indefinido", "Término fijo"] }, v)).toBe(true);
    expect(matches({ tipo: { not: "Término fijo" } }, v)).toBe(false);
    expect(matches({ n: "3", ok: "true" }, v)).toBe(true);
    expect(matches({ vacio: { filled: false }, tipo: { filled: true } }, v)).toBe(true);
    expect(matches({ tags: "b" }, v)).toBe(true);
    expect(matches({ tags: "c" }, v)).toBe(false);
    expect(matches(undefined, v)).toBe(true);
  });

  it("un campo oculto cuenta como vacío para los que dependen de él", () => {
    const fields = [def({ key: "tipo" }), def({ key: "fin", when: { tipo: "fijo" } }), def({ key: "motivo", when: { fin: { filled: true } } })];
    expect([...visibleKeys(fields, { tipo: "fijo", fin: "2027-04-12", motivo: null })]).toEqual(["tipo", "fin", "motivo"]);
    expect([...visibleKeys(fields, { tipo: "indefinido", fin: "2027-04-12", motivo: null })]).toEqual(["tipo"]);
  });
});

describe("check", () => {
  it("obligatorio según el tipo", () => {
    expect(check(def({ key: "a", required: true }), "  ", ctx).error).toBe(FORM_LABELS.required);
    expect(check(def({ key: "a", required: true, type: "select" }), null, ctx).error).toBe(FORM_LABELS.choose);
    expect(check(def({ key: "a", required: true, type: "checkbox" }), false, ctx).error).toBe(FORM_LABELS.check);
    expect(check(def({ key: "a", required: true, type: "checkboxes" }), [], ctx).error).toBe(FORM_LABELS.choose);
    expect(check(def({ key: "a" }), null, ctx).error).toBe("");
  });

  it("correo: formato y dominio mal escrito con su arreglo", () => {
    const f = def({ key: "c", type: "email" });
    expect(check(f, "andres@", ctx).error).toBe(FORM_LABELS.email);
    const c = check(f, "andres.ortiz@gmial.com", ctx);
    expect(c.error).toBe("");
    expect(c.warning).toBe("¿Quisiste decir andres.ortiz@gmail.com?");
    expect(c.fix).toEqual({ label: "Usar gmail.com", value: "andres.ortiz@gmail.com" });
    expect(check(f, "laura@acme.co", ctx).warning).toBe("");
    expect(emailTypo("x@HOTMIAL.com")).toBe("x@hotmail.com");
  });

  it("teléfono, web, longitud y patrón", () => {
    expect(check(def({ key: "t", type: "tel" }), "300 123 4567", ctx).error).toBe("");
    expect(check(def({ key: "t", type: "tel" }), "12345", ctx).error).toBe(FORM_LABELS.tel);
    expect(check(def({ key: "t", type: "tel" }), "300 abc", ctx).error).toBe(FORM_LABELS.tel);
    expect(check(def({ key: "u", type: "url" }), "https://acme.co", ctx).error).toBe("");
    expect(check(def({ key: "u", type: "url" }), "javascript:alert(1)", ctx).error).toBe(FORM_LABELS.url);
    expect(check(def({ key: "n", minLength: 3 }), "ab", ctx).error).toBe("Mínimo 3 caracteres");
    expect(check(def({ key: "n", maxLength: 2 }), "abc", ctx).error).toBe("Máximo 2 caracteres");
    expect(check(def({ key: "nit", pattern: "\\d{9}-\\d", patternMessage: "NIT con dígito: 900123456-7" }), "900123456", ctx).error).toBe("NIT con dígito: 900123456-7");
    expect(check(def({ key: "nit", pattern: "\\d{9}-\\d" }), "900123456-7", ctx).error).toBe("");
    // Un patrón inválido no rompe nada.
    expect(check(def({ key: "p", pattern: "(" }), "x", ctx).error).toBe("");
  });

  it("números y montos con sus límites en el formato del locale", () => {
    const sal = def({ key: "s", type: "money", min: 1000000, currency: "COP" });
    expect(check(sal, 900000, ctx).error).toMatch(/^El mínimo es \$\s?1\.000\.000$/);
    expect(check(def({ key: "p", type: "percent", max: 0.5 }), 0.6, ctx).error).toBe("El máximo es 50 %");
    expect(check(def({ key: "n", type: "number" }), "x" as never, ctx).error).toBe(FORM_LABELS.number);
  });

  it("fechas: válidas, con límites y «today»", () => {
    const nac = def({ key: "f", type: "date", max: "today" });
    expect(check(nac, "2026-02-30", ctx).error).toBe(FORM_LABELS.date);
    expect(check(nac, "2026-10-08", ctx).error).toMatch(/^No después del 7 oct\.? 2026$/);
    expect(check(nac, "1992-06-18", ctx).error).toBe("");
    expect(check(def({ key: "f", type: "date", min: "2026-10-01" }), "2026-09-30", ctx).error).toMatch(/^No antes del 1 oct\.? 2026$/);
    expect(dateLimit("today", "2026-10-07")).toBe("2026-10-07");
    expect(dateLimit("mañana", "2026-10-07")).toBeNull();
    expect(isISODate("2026-10-07")).toBe(true);
    expect(isISODate("07/10/2026")).toBe(false);
    expect(todayISO(new Date(2026, 9, 7, 22, 30))).toBe("2026-10-07");
  });
});

describe("valores", () => {
  it("coerce lleva cada valor al tipo del campo", () => {
    expect(coerce(def({ key: "a", type: "money" }), "2.100.000", fmt)).toBe(2100000);
    expect(coerce(def({ key: "a", type: "number" }), "1.5", fmt)).toBe(1.5);
    expect(coerce(def({ key: "a", type: "checkbox" }), "true", fmt)).toBe(true);
    expect(coerce(def({ key: "a", type: "checkbox" }), null, fmt)).toBe(false);
    expect(coerce(def({ key: "a", type: "checkboxes" }), "x", fmt)).toEqual(["x"]);
    expect(coerce(def({ key: "a", type: "date" }), "2026-10-13T00:00:00Z", fmt)).toBe("2026-10-13");
    expect(coerce(def({ key: "a" }), 42, fmt)).toBe("42");
    expect(coerce(def({ key: "a" }), "", fmt)).toBeNull();
  });

  it("displayValue: montos, porcentajes, fechas, opciones y sí/no", () => {
    const opts = [{ value: "fijo", label: "Término fijo" }];
    expect(displayValue(def({ key: "a", type: "money" }), 2100000, fmt, FORM_LABELS, "COP")).toMatch(/^\$\s?2\.100\.000$/);
    expect(displayValue(def({ key: "a", type: "percent" }), 0.19, fmt, FORM_LABELS)).toBe("19 %");
    expect(displayValue(def({ key: "a", type: "date" }), "2026-10-13", fmt, FORM_LABELS)).toMatch(/^13 oct\.? 2026$/);
    expect(displayValue(def({ key: "a", type: "segmented", options: opts }), "fijo", fmt, FORM_LABELS)).toBe("Término fijo");
    expect(displayValue(def({ key: "a", type: "checkboxes", options: opts }), ["fijo", "otro"], fmt, FORM_LABELS)).toBe("Término fijo, otro");
    expect(displayValue(def({ key: "a", type: "checkbox" }), false, fmt, FORM_LABELS)).toBe("No");
    expect(displayValue(def({ key: "a" }), null, fmt, FORM_LABELS)).toBe("");
  });

  it("isEmpty y sameValue", () => {
    expect([null, "", "  ", false, []].every(isEmpty)).toBe(true);
    expect([0, "x", true, ["a"]].some(isEmpty)).toBe(false);
    expect(sameValue(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameValue(["a"], "a")).toBe(false);
    expect(sameValue(null, undefined)).toBe(true);
  });
});

describe("filas, buscador y fechas de documento", () => {
  it("cleanSections limpia los campos de cada fila (sin filas adentro) y descarta un rows vacío", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [sec] = cleanSections([{ fields: [{ key: "b", label: "B", type: "rows", fields: [{ key: "n", label: "N" }, { key: "x", label: "X", type: "rows" }] }, { key: "v", label: "V", type: "rows", fields: [] }] }]);
    expect(sec.fields.map((f) => f.key)).toEqual(["b"]);
    expect(sec.fields[0].subs!.map((f) => [f.key, f.type])).toEqual([["n", "text"], ["x", "text"]]);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("coerce, check y sameValue con filas", () => {
    const [sec] = cleanSections([{ fields: [{ key: "b", label: "B", type: "rows", required: true, max: 2, fields: [{ key: "n", label: "N" }, { key: "f", label: "F", type: "date" }] }] }]);
    const b = sec.fields[0];
    expect(coerce(b, [{ n: "Ana", f: "03/05/2019", otro: 1 }, "basura"], fmt)).toEqual([{ n: "Ana", f: "2019-05-03" }]);
    expect(coerce(b, null, fmt)).toEqual([]);
    expect(check(b, [], ctx).error).toBe("Agrega al menos 1");
    expect(check(b, [{}, {}, {}] as never, ctx).error).toBe("Máximo 2");
    expect(sameValue([{ n: "a" }], [{ n: "a" }])).toBe(true);
    expect(sameValue([{ n: "a" }], [{ n: "b" }])).toBe(false);
  });

  it("parseDateText: día/mes/año (mes/día en en-US) e ISO con hora", () => {
    expect(parseDateText("12/10/2026")).toBe("2026-10-12");
    expect(parseDateText("1.2.2026")).toBe("2026-02-01");
    expect(parseDateText("12/10/2026", "en-US")).toBe("2026-12-10");
    expect(parseDateText("2026-10-12T05:00:00Z")).toBe("2026-10-12");
    expect(parseDateText("31/02/2026")).toBe("31/02/2026");
    expect(parseDateText("mañana")).toBe("mañana");
  });

  it("usesSearch: lo pide, busca en el servidor o tiene más de 12 opciones", () => {
    const sel = (extra: Partial<FieldDef>) => def({ key: "s", type: "select", ...extra });
    expect(usesSearch(sel({ options: [{ value: "a" }] }))).toBe(false);
    expect(usesSearch(sel({ search: true }))).toBe(true);
    expect(usesSearch(sel({ source: "/ciudades" }))).toBe(true);
    expect(usesSearch(sel({ options: Array.from({ length: 13 }, (_, i) => ({ value: String(i) })) }))).toBe(true);
    expect(usesSearch(def({ key: "t", search: true }))).toBe(false);
  });
});
