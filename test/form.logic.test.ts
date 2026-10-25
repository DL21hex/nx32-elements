import { describe, expect, it, vi } from "vitest";
import { nxFormat } from "../src/core/locale";
import { FORM_LABELS } from "../src/components/form/form";
import { acceptText, check, cleanSections, coerce, dateLimit, displayValue, effective, emailTypo, isSystem, prunedValue, shownOptions, FILE_MAX_SIZE, fileMaxSize, isEmpty, isFile, isISODate, matches, parseDateText, sameValue, todayISO, usesSearch, visibleKeys, type FieldDef } from "../src/components/form/logic";

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

  it("link: uno válido se conserva limpio; javascript:, data:, vacío o sin label se descartan con aviso; en una fila no va", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [sec] = cleanSections([
      {
        fields: [
          { key: "nota", label: "Salud Total", type: "readonly", link: { label: " Descargar formato ", href: "/assets/hcm/formato.pdf" } },
          { key: "web", label: "Web", link: { label: "Reglamento", href: "https://acme.co/reglamento" } },
          { key: "js", label: "Js", link: { label: "X", href: "javascript:alert(1)" } },
          { key: "jstab", label: "Js con tab", link: { label: "X", href: "java\tscript:alert(1)" } },
          { key: "data", label: "Data", link: { label: "X", href: "data:text/html,<b>x</b>" } },
          { key: "vacio", label: "Vacío", link: { label: "X", href: "  " } },
          { key: "sinlabel", label: "Sin label", link: { href: "/a.pdf" } },
          { key: "labelvacio", label: "Label vacío", link: { label: "  ", href: "/a.pdf" } },
          { key: "texto", label: "Texto", link: "/a.pdf" },
          { key: "nada", label: "Nada", link: null },
          { key: "filas", label: "Filas", type: "rows", link: { label: "Plantilla", href: "/p.xlsx" }, fields: [{ key: "n", label: "N", link: { label: "X", href: "/x.pdf" } }] },
        ],
      },
    ]);
    const by = Object.fromEntries(sec.fields.map((f) => [f.key, f]));
    expect(by.nota.link).toEqual({ label: "Descargar formato", href: "/assets/hcm/formato.pdf" });
    expect(by.web.link).toEqual({ label: "Reglamento", href: "https://acme.co/reglamento" });
    for (const k of ["js", "jstab", "data", "vacio", "sinlabel", "labelvacio", "texto", "nada"]) expect(by[k].link, k).toBeUndefined();
    // Descartar el enlace no descarta el campo.
    expect(sec.fields).toHaveLength(11);
    expect(by.filas.link).toEqual({ label: "Plantilla", href: "/p.xlsx" });
    expect(by.filas.subs![0].link).toBeUndefined();
    const said = warn.mock.calls.map((c) => String(c[0]));
    expect(said.filter((m) => m.startsWith("[nx-form] enlace descartado"))).toHaveLength(7);
    expect(said).toContain('[nx-form] un enlace no va dentro de una fila: el de "n" no se pinta');
    expect(said.some((m) => m.includes('"js" (href inválido)'))).toBe(true);
    expect(said.some((m) => m.includes('"sinlabel" (sin label)'))).toBe(true);
    warn.mockRestore();
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

describe("archivo (file)", () => {
  const pdf = (size = 1000, name = "soporte.pdf", type = "application/pdf") => new File([new Uint8Array(size)], name, { type });

  it("isFile reconoce un File por su forma; coerce solo acepta un File", () => {
    const f = def({ key: "soporte", type: "file" });
    const file = pdf();
    expect(isFile(file)).toBe(true);
    expect(isFile("soporte.pdf")).toBe(false);
    expect(isFile({ name: "x", size: 1, type: "" })).toBe(false);
    expect(coerce(f, file, fmt)).toBe(file);
    expect(coerce(f, "soporte.pdf", fmt)).toBeNull();
    expect(coerce(f, {}, fmt)).toBeNull();
    expect(coerce(f, null, fmt)).toBeNull();
    // Un File en un campo de texto no se vuelve texto.
    expect(coerce(def({ key: "t" }), file, fmt)).toBeNull();
    expect(sameValue(file, file)).toBe(true);
    expect(sameValue(file, pdf())).toBe(false);
    expect(isEmpty(file)).toBe(false);
    expect(displayValue(f, file, fmt, FORM_LABELS)).toBe("soporte.pdf");
    expect(displayValue(f, null, fmt, FORM_LABELS)).toBe("");
  });

  it("check: obligatorio, tipo según accept y tamaño según maxSize (20 MB por defecto)", () => {
    const f = def({ key: "soporte", type: "file", required: true, accept: ".pdf,image/*", maxSize: 2048 });
    expect(check(f, null, ctx).error).toBe("Falta este dato");
    expect(check(def({ key: "x", type: "file" }), null, ctx).error).toBe("");
    expect(check(f, pdf(), ctx).error).toBe("");
    expect(check(f, pdf(10, "foto.jpg", "image/jpeg"), ctx).error).toBe("");
    expect(check(f, pdf(10, "datos.xlsx", "application/vnd.ms-excel"), ctx).error).toBe("Ese tipo de archivo no sirve aquí: elige PDF, image/*");
    expect(check(f, pdf(4096), ctx).error).toBe("El archivo pasa de 2 KB");
    expect(fileMaxSize({})).toBe(FILE_MAX_SIZE);
    expect(FILE_MAX_SIZE).toBe(20 * 1024 * 1024);
    expect(check(def({ key: "x", type: "file" }), pdf(FILE_MAX_SIZE + 1), ctx).error).toBe("El archivo pasa de 20 MB");
    expect(acceptText(".pdf, .XML ,image/*")).toBe("PDF, XML, image/*");
  });

  it("un archivo dentro de una fila se descarta con un aviso", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = cleanSections([{ fields: [{ key: "hijos", label: "Hijos", type: "rows", fields: [{ key: "nombre", label: "Nombre" }, { key: "registro", label: "Registro civil", type: "file" }] }, { key: "soporte", label: "Soporte", type: "file" }] }]);
    expect(out[0].fields[0].subs!.map((x) => x.key)).toEqual(["nombre"]);
    expect(out[0].fields[1].type).toBe("file");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("0.31.0: variantes, opciones con condición, ocultos y avisos", () => {
  it("cleanSections limpia cases, tone y blocks (y los descarta donde no van)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [sec] = cleanSections([
      {
        fields: [
          { key: "d", label: "D", type: "date", cases: [{ when: { m: "1" }, min: "today", unavailable: { weekdays: [6, 9] }, extra: 1 }, { min: "x" }] },
          { key: "n", label: "", type: "notice", tone: "warning", blocks: true, value: "  Ojo  " },
          { key: "t", label: "T", tone: "danger", blocks: true },
          { key: "o", label: "O", type: "select", options: [{ value: "1", when: { m: "1" } }, { value: "2", when: "no" }] },
        ],
      },
    ]);
    const [d, n, t, o] = sec.fields;
    expect(d.cases).toHaveLength(1);
    expect(d.cases![0].min).toBe("today");
    expect([...d.cases![0].blocked!.weekdays]).toEqual([6]);
    expect(n).toMatchObject({ type: "notice", tone: "warning", blocks: true });
    expect(coerce(n, n.value, fmt)).toBe("Ojo");
    expect(t.tone).toBeUndefined();
    expect(t.blocks).toBeUndefined();
    expect(o.options[0].when).toEqual({ m: "1" });
    expect(o.options[1].when).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it("effective toma la primera variante que se cumple", () => {
    const d = def({ key: "d", type: "date", min: "a", hint: "h", cases: [{ when: { m: "1" }, min: "b" }, { when: { m: ["1", "2"] }, min: "c", required: true }] });
    expect(effective(d, {}).min).toBe("a");
    expect(effective(d, { m: "1" })).toMatchObject({ min: "b", hint: "h" });
    expect(effective(d, { m: "2" })).toMatchObject({ min: "c", required: true });
  });

  it("shownOptions y prunedValue", () => {
    const o = def({ key: "o", type: "checkboxes", options: [{ value: "1", when: { t: "a" } }, { value: "2" }] });
    expect(shownOptions(o, {}).map((x) => x.value)).toEqual(["2"]);
    expect(prunedValue(o, ["1", "2"], {})).toEqual(["2"]);
    expect(prunedValue(o, ["1", "2"], { t: "a" })).toBeUndefined();
    const s = def({ key: "s", type: "select", options: [{ value: "1", when: { t: "a" } }] });
    expect(prunedValue(s, "1", { t: "b" })).toBeNull();
    expect(prunedValue(s, null, { t: "b" })).toBeUndefined();
  });

  it("ocultos y avisos no se validan ni los escribe la persona", () => {
    expect(isSystem("hidden") && isSystem("notice") && isSystem("readonly")).toBe(true);
    expect(check(def({ key: "h", type: "hidden", required: true }), null, ctx).error).toBe("");
  });
});
