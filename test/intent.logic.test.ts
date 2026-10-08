import { describe, expect, it } from "vitest";
import { dayOfISO, isoOf } from "../src/core/days";
import { findAmount, findDate, findMonth, findTime, normalizeIntentText, understand, withParams } from "../src/components/intent/logic";
import type { IntentDef } from "../src/components/intent/types";

const TODAY = dayOfISO("2026-10-08")!; // jueves
const t = normalizeIntentText;
const iso = (d: number | null) => (d === null ? null : isoOf(d));

const INTENTS: IntentDef[] = [
  {
    id: "cert",
    label: "Certificado laboral",
    keywords: ["certificado", "constancia", "carta laboral"],
    exclude: ["retencion", "ingresos y"],
    href: "/cert",
    slots: [
      {
        name: "salario",
        type: "option",
        options: [
          { value: "con", label: "con salario", keywords: ["banco", "credito", "arriendo", "con salario", "embajada"], href: "/cert/con.pdf", newTab: true },
          { value: "sin", label: "sin salario", keywords: ["sin salario"], href: "/cert/sin.pdf", newTab: true, default: true },
        ],
      },
    ],
  },
  { id: "ret", label: "Ingresos y retenciones", keywords: ["retencion", "retenciones", "renta", "ingresos y retenciones", "220"], href: "/ret" },
  { id: "vac", label: "Vacaciones", keywords: ["vacacion", "puente", "descansar"], href: "/vac", slots: [{ name: "mes", type: "month" }, { name: "desde", type: "date", label: "desde" }] },
  {
    id: "perm",
    label: "Permiso",
    keywords: ["permiso", "cita", "diligencia", "calamidad"],
    href: "/perm",
    slots: [{ name: "dia", type: "date" }, { name: "hora", type: "time", label: "a las" }],
  },
  {
    id: "pay",
    label: "Desprendible de pago",
    keywords: ["desprendible", "colilla", "pago", "nomina"],
    href: "/pagos",
    slots: [
      {
        name: "periodo",
        type: "option",
        options: [
          { value: "40", label: "Catorcena 19 · 2026", keywords: ["ultimo", "ultima", "septiembre", "catorcena 19"], href: "/pagos/40.pdf", newTab: true, default: true },
          { value: "39", label: "Catorcena 18 · 2026", keywords: ["agosto", "catorcena 18"], href: "/pagos/39.pdf", newTab: true },
        ],
      },
    ],
  },
  { id: "ces", label: "Cesantías", keywords: ["cesantia"], href: "/ces", slots: [{ name: "monto", type: "amount" }] },
];

describe("fechas, meses, horas y montos", () => {
  it("fechas relativas y escritas", () => {
    expect(iso(findDate(t("mañana"), TODAY))).toBe("2026-10-09");
    expect(iso(findDate(t("pasado mañana"), TODAY))).toBe("2026-10-10");
    expect(iso(findDate(t("hoy en la tarde"), TODAY))).toBe("2026-10-08");
    expect(findDate(t("en la mañana"), TODAY)).toBeNull();
    expect(iso(findDate(t("mañana por la mañana"), TODAY))).toBe("2026-10-09");
    expect(iso(findDate(t("el jueves"), TODAY))).toBe("2026-10-15"); // nunca hoy
    expect(iso(findDate(t("el miércoles"), TODAY))).toBe("2026-10-14");
    expect(iso(findDate(t("el 20"), TODAY))).toBe("2026-10-20");
    expect(iso(findDate(t("el 3"), TODAY))).toBe("2026-11-03");
    expect(iso(findDate(t("14 de octubre"), TODAY))).toBe("2026-10-14");
    expect(iso(findDate(t("2 de enero"), TODAY))).toBe("2027-01-02");
    expect(iso(findDate(t("5 de mayo de 2025"), TODAY))).toBe("2025-05-05");
    expect(iso(findDate(t("20/10"), TODAY))).toBe("2026-10-20");
    expect(iso(findDate(t("2026-12-28"), TODAY))).toBe("2026-12-28");
    expect(findDate(t("31 de febrero"), TODAY)).toBeNull();
    expect(findDate(t("vacaciones"), TODAY)).toBeNull();
  });
  it("meses hacia adelante o hacia atrás", () => {
    expect(findMonth(t("en diciembre"), TODAY)).toBe("2026-12");
    expect(findMonth(t("en marzo"), TODAY)).toBe("2027-03");
    expect(findMonth(t("de agosto"), TODAY, "past")).toBe("2026-08");
    expect(findMonth(t("de noviembre"), TODAY, "past")).toBe("2025-11");
    expect(findMonth(t("agosto de 2024"), TODAY)).toBe("2024-08");
    expect(findMonth(t("fin de año"), TODAY)).toBe("2026-12");
    expect(findMonth(t("mayo"), TODAY)).toBe("2027-05");
  });
  it("horas de trabajo", () => {
    expect(findTime(t("a las 3"))).toBe("15:00");
    expect(findTime(t("a las 10"))).toBe("10:00");
    expect(findTime(t("a las 7 am"))).toBe("07:00");
    expect(findTime(t("a las 2:30 p. m."))).toBe("14:30");
    expect(findTime(t("3 pm"))).toBe("15:00");
    expect(findTime(t("15:30"))).toBe("15:30");
    expect(findTime(t("en la mañana"))).toBe("08:00");
    expect(findTime(t("por la tarde"))).toBe("14:00");
    expect(findTime(t("el 14"))).toBeNull();
    expect(findTime(t("a las 25"))).toBeNull();
  });
  it("montos", () => {
    expect(findAmount(t("5 millones"))).toBe(5_000_000);
    expect(findAmount(t("2,5 millones"))).toBe(2_500_000);
    expect(findAmount(t("500 mil"))).toBe(500_000);
    expect(findAmount(t("$ 3.500.000"))).toBe(3_500_000);
    expect(findAmount(t("$3500000"))).toBe(3_500_000);
    expect(findAmount(t("3500000"))).toBe(3_500_000);
    expect(findAmount(t("catorcena 19 de 2026"))).toBeNull();
  });
});

describe("qué trámite y qué datos", () => {
  const u = (text: string) => understand(text, INTENTS, { today: "2026-10-08", locale: "es-CO", currency: "COP" });
  it("el certificado con la opción que nombra y su propio destino", () => {
    const m = u("certificado para el banco")!;
    expect(m.intent.id).toBe("cert");
    expect(m.chips).toEqual(["Certificado laboral", "con salario"]);
    expect(m.params).toEqual({ salario: "con" });
    expect(m).toMatchObject({ href: "/cert/con.pdf", newTab: true });
    expect(u("Constancia SIN salario")!.href).toBe("/cert/sin.pdf");
    expect(u("una carta laboral")!.chips).toEqual(["Certificado laboral", "sin salario"]); // la opción por defecto
  });
  it("una palabra que descarta: el certificado de ingresos y retenciones no es el laboral", () => {
    expect(u("certificado de ingresos y retenciones")!.intent.id).toBe("ret");
  });
  it("vacaciones en un mes y desde una fecha, como parámetros", () => {
    const m = u("vacaciones en diciembre")!;
    expect(m.chips).toEqual(["Vacaciones", "diciembre de 2026"]);
    expect(m.href).toBe("/vac?mes=2026-12");
    expect(u("vacaciones desde el 2 de enero")!.href).toBe("/vac?mes=2027-01&desde=2027-01-02");
  });
  it("un permiso con día y hora", () => {
    const m = u("permiso para una cita el viernes a las 3")!;
    expect(m.intent.id).toBe("perm");
    expect(m.params).toEqual({ dia: "2026-10-09", hora: "15:00" });
    expect(m.chips[1]).toMatch(/viernes 9 de octubre/);
    expect(m.chips[2]).toMatch(/^a las 3:00\s?p/);
    // «solicitar» contiene «cita» pero no como palabra: no es una cita.
    expect(u("solicitar algo")).toBeNull();
  });
  it("el desprendible elegido por mes o el último", () => {
    expect(u("mi último desprendible")!.href).toBe("/pagos/40.pdf");
    expect(u("colilla de agosto")!.href).toBe("/pagos/39.pdf");
    expect(u("desprendible")!.chips).toEqual(["Desprendible de pago", "Catorcena 19 · 2026"]);
  });
  it("montos con su moneda", () => {
    const m = u("retirar 5 millones de cesantías")!;
    expect(m.params).toEqual({ monto: "5000000" });
    expect(m.chips[1]).toMatch(/5\.000\.000/);
  });
  it("nada que entender", () => {
    expect(u("hola")).toBeNull();
    expect(u("")).toBeNull();
    expect(understand("certificado", null as never)).toBeNull();
  });
});

describe("parámetros en la URL", () => {
  it("respeta los que ya trae y el #", () => {
    expect(withParams("/a", { x: "1", y: "a b" })).toBe("/a?x=1&y=a%20b");
    expect(withParams("/a?open_drawer=nueva#arriba", { d: "2026-10-09" })).toBe("/a?open_drawer=nueva&d=2026-10-09#arriba");
    expect(withParams("/a", {})).toBe("/a");
  });
});
