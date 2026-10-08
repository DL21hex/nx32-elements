import { describe, expect, it } from "vitest";
import { colombiaHolidayList, colombiaHolidays, holidayLookup, restAround, suggestBreaks, workdaysBetween } from "../src/core/holidays";
import { colombiaHolidays as fromRecurrence } from "../src/components/recurrence/logic";
import { dayOfISO } from "../src/core/days";

describe("festivos de Colombia", () => {
  it("2026: los 19 (con la Virgen de Chiquinquirá), con su nombre y corridos al lunes", () => {
    const list = colombiaHolidayList(2026);
    expect(list).toHaveLength(19);
    expect(list.map((h) => h.date)).toEqual([
      "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15",
      "2026-06-29", "2026-07-13", "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25",
    ]);
    expect(list.find((h) => h.date === "2026-10-12")?.name).toBe("Día de la Raza");
    expect(list.find((h) => h.date === "2026-07-13")?.name).toBe("Virgen de Chiquinquirá");
    expect(colombiaHolidayList(2025).some((h) => h.name === "Virgen de Chiquinquirá")).toBe(false);
  });
  it("2027 y la API de recurrence no cambia", () => {
    expect(colombiaHolidays(2027)).toContain("2027-01-11");
    expect(colombiaHolidays(2027)).toContain("2027-03-25");
    expect(fromRecurrence(2026)).toEqual(colombiaHolidays(2026));
  });
  it("buscador: Colombia por defecto, una lista con o sin nombres, ninguno", () => {
    const co = holidayLookup();
    expect(co(dayOfISO("2026-12-25")!)).toBe("Navidad");
    expect(co(dayOfISO("2026-12-24")!)).toBeNull();
    const mine = holidayLookup(["2026-02-02", { date: "2026-02-03", name: "Día de la empresa" }, "no-es-fecha"]);
    expect(mine(dayOfISO("2026-02-02")!)).toBe("");
    expect(mine(dayOfISO("2026-02-03")!)).toBe("Día de la empresa");
    expect(holidayLookup(null)(dayOfISO("2026-12-25")!)).toBeNull();
    expect(holidayLookup(() => { throw new Error("x"); })(dayOfISO("2026-12-25")!)).toBeNull();
  });
});

describe("días hábiles", () => {
  it("cuenta de lunes a viernes sin festivos, o con sábado", () => {
    expect(workdaysBetween("2026-12-28", "2027-01-08")).toBe(9); // el 1 de enero es festivo
    expect(workdaysBetween("2026-12-28", "2027-01-08", { workdays: [1, 2, 3, 4, 5, 6] })).toBe(10); // más el sábado 2 de enero
    expect(workdaysBetween("2026-10-12", "2026-10-12")).toBe(0);
    expect(workdaysBetween("2026-10-20", "2026-10-10")).toBe(0);
    expect(workdaysBetween("x", "2026-10-10")).toBe(0);
  });
  it("el descanso se extiende a los fines de semana y festivos pegados", () => {
    expect(restAround("2026-12-28", "2027-01-08")).toEqual({ from: "2026-12-25", to: "2027-01-11", days: 18, back: "2027-01-12" });
    expect(restAround("2026-10-13", "2026-10-16")).toEqual({ from: "2026-10-10", to: "2026-10-18", days: 9, back: "2026-10-19" });
    expect(restAround("2026-10-16", "2026-10-13")).toBeNull();
  });
  it("un calendario sin días hábiles no cuelga", () => {
    expect(restAround("2026-10-13", "2026-10-16", { workdays: [7] })).not.toBeNull();
  });
});

describe("puentes", () => {
  const base = { from: "2026-10-13", to: "2027-02-28", available: 12 };
  it("primero el descanso más largo que rinde el doble, después un puente por mes", () => {
    const s = suggestBreaks(base);
    expect(s[0]).toMatchObject({ kind: "longest", start: "2026-12-28", end: "2027-01-08", workdays: 9, days: 18, from: "2026-12-25", to: "2027-01-11" });
    expect(s.slice(1).map((b) => `${b.start}/${b.end}/${b.workdays}/${b.days}`)).toEqual([
      "2026-10-13/2026-10-16/4/9",
      "2026-11-03/2026-11-06/4/9",
      "2026-12-07/2026-12-11/4/9",
    ]);
    expect(s.every((b) => b.workdays <= 12)).toBe(true);
  });
  it("sin días suficientes o con un rango inválido, nada", () => {
    expect(suggestBreaks({ ...base, available: 2 })).toEqual([]);
    expect(suggestBreaks({ ...base, from: "2027-03-01" })).toEqual([]);
    expect(suggestBreaks({ ...base, available: Number.NaN })).toEqual([]);
  });
  it("con pocos días el más largo cabe en lo disponible", () => {
    const s = suggestBreaks({ ...base, available: 4 });
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((b) => b.workdays <= 4)).toBe(true);
  });
  it("un año entero con 30 días responde rápido", () => {
    const t = performance.now();
    suggestBreaks({ from: "2026-01-01", to: "2026-12-31", available: 30 });
    expect(performance.now() - t).toBeLessThan(500);
  });
});
