import { describe, expect, it } from "vitest";
import { blockedReason, cleanUnavailable, limitOf, orderOf, parseDay, patternOf, plainUnavailable, writeDay } from "../src/components/date/logic";

describe("nx-date · lo que no se puede elegir", () => {
  it("limpia fechas y días de la semana, con o sin motivo (objeto o JSON)", () => {
    const u = cleanUnavailable({ dates: ["2026-10-12", { date: "2026-12-25", label: "Navidad" }, "2026-02-30", "mañana", { label: "sin fecha" }], weekdays: [0, 6, 7, -1, 2.5] })!;
    expect([...u.dates]).toEqual([
      ["2026-10-12", ""],
      ["2026-12-25", "Navidad"],
    ]);
    expect([...u.weekdays]).toEqual([0, 6]);
    expect(cleanUnavailable('{"weekdays":[0]}')!.weekdays.has(0)).toBe(true);
  });
  it("sin nada que bloquear (o un JSON roto) es null", () => {
    expect(cleanUnavailable({ dates: [], weekdays: [] })).toBeNull();
    expect(cleanUnavailable("{roto")).toBeNull();
    expect(cleanUnavailable(null)).toBeNull();
  });
  it("dice por qué no se puede: el motivo, «» sin motivo, null si se puede", () => {
    const u = cleanUnavailable({ dates: [{ date: "2026-10-12", label: "Festivo: Día de la Raza" }, "2026-11-02"], weekdays: [0] });
    expect(blockedReason(u, "2026-10-12")).toBe("Festivo: Día de la Raza");
    expect(blockedReason(u, "2026-11-02")).toBe("");
    expect(blockedReason(u, "2026-10-25")).toBe(""); // domingo
    expect(blockedReason(u, "2026-10-26")).toBeNull(); // lunes
    expect(blockedReason(null, "2026-10-25")).toBeNull();
  });
  it("vuelve a la forma pública (para pasarla como JSON)", () => {
    expect(plainUnavailable(cleanUnavailable({ dates: [{ date: "2026-12-25", label: "Navidad" }, "2026-10-12"], weekdays: [6, 0] }))).toEqual({ dates: [{ date: "2026-12-25", label: "Navidad" }, "2026-10-12"], weekdays: [0, 6] });
  });
});

describe("nx-date · escribir una fecha", () => {
  it("lee día/mes/año como se dicta, y mes/día en inglés de EE. UU.", () => {
    expect(parseDay("25/10/2026")).toBe("2026-10-25");
    expect(parseDay("5-1-2026")).toBe("2026-01-05");
    expect(parseDay("5.1.26")).toBe("2026-01-05");
    expect(parseDay("25102026")).toBe("2026-10-25");
    expect(parseDay("2026-10-25T08:00:00")).toBe("2026-10-25");
    expect(parseDay("10/25/2026", "en-US")).toBe("2026-10-25");
  });
  it("lo que no es una fecha (o no existe) es «»", () => {
    for (const t of ["", "31/02/2026", "hoy", "25/10", "2026-13-01"]) expect(parseDay(t)).toBe("");
  });
  it("escribe en el orden del locale, con su guía", () => {
    expect(writeDay("2026-01-05")).toBe("05/01/2026");
    expect(writeDay("2026-01-05", "en-US")).toBe("01/05/2026");
    expect(writeDay("no")).toBe("");
    expect(orderOf("es-CO")).toBe("dmy");
    expect(patternOf("es-CO", { day: "d", month: "m", year: "a" })).toBe("dd/mm/aaaa");
  });
  it("un límite es ISO o «today»", () => {
    expect(limitOf("today", "2026-10-25")).toBe("2026-10-25");
    expect(limitOf("2026-01-01", "2026-10-25")).toBe("2026-01-01");
    expect(limitOf("ayer", "2026-10-25")).toBeNull();
  });
});
