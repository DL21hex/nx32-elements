import { describe, expect, it } from "vitest";
import { nextStep, parseTime, readTime, sequenceMarks, sequences, sequenceState, stepsAround } from "../src/components/grid/time";
import { formatCell, parseInput } from "../src/components/grid/logic";
import type { GridColumn } from "../src/components/grid/types";

const at = (h: number, m: number) => () => new Date(2026, 9, 6, h, m);

describe("parseTime", () => {
  it("lee la hora como se teclea rápido", () => {
    expect(parseTime("7:30")).toBe("07:30");
    expect(parseTime("7.30")).toBe("07:30");
    expect(parseTime("7h30")).toBe("07:30");
    expect(parseTime("730")).toBe("07:30");
    expect(parseTime("0730")).toBe("07:30");
    expect(parseTime("1430")).toBe("14:30");
    expect(parseTime("7")).toBe("07:00");
    expect(parseTime("19")).toBe("19:00");
    expect(parseTime("0")).toBe("00:00");
    expect(parseTime(" 23:59 ")).toBe("23:59");
  });

  it("los minutos de un dígito son minutos, como en el servidor («7.5» es 07:05)", () => {
    expect(parseTime("7.5")).toBe("07:05");
    expect(parseTime("7:5")).toBe("07:05");
  });

  it("entiende a. m. y p. m. en sus formas", () => {
    expect(parseTime("7:30 pm")).toBe("19:30");
    expect(parseTime("7:30 p. m.")).toBe("19:30");
    expect(parseTime("7:30 P.M.")).toBe("19:30");
    expect(parseTime("730p")).toBe("19:30");
    expect(parseTime("7 am")).toBe("07:00");
    expect(parseTime("12 am")).toBe("00:00");
    expect(parseTime("12:15 pm")).toBe("12:15");
    expect(parseTime("13 pm")).toBeUndefined();
    expect(parseTime("0 am")).toBeUndefined();
  });

  it("lo que trae Excel: los segundos se ignoran", () => {
    expect(parseTime("09:30:00")).toBe("09:30");
    expect(parseTime("9:30:45 a. m.")).toBe("09:30");
  });

  it("«ahora» es la hora del reloj", () => {
    expect(parseTime("ahora", at(9, 4))).toBe("09:04");
    expect(parseTime("Ahora", at(16, 45))).toBe("16:45");
    expect(parseTime("now", at(0, 0))).toBe("00:00");
  });

  it("vacío es null; lo que no es una hora, undefined", () => {
    expect(parseTime("")).toBeNull();
    expect(parseTime("   ")).toBeNull();
    for (const bad of ["25:00", "7:60", "2400", "12345", "mañana", "7:30:00:00", "a", "pm", "+", "-x", "7:3x"]) expect(parseTime(bad), bad).toBeUndefined();
  });

  it("una columna de hora se lee y se muestra como «HH:MM»", () => {
    const c: GridColumn = { key: "h", label: "Hora", type: "time" };
    expect(parseInput("745", c)).toBe("07:45");
    expect(parseInput("", c)).toBeNull();
    expect(parseInput("99", c)).toBeUndefined();
    expect(formatCell("07:45", c)).toBe("07:45");
    expect(formatCell(null, c)).toBe("");
  });
});

describe("sequenceMarks", () => {
  const cols: GridColumn[] = [
    { key: "finca", label: "Finca" },
    { key: "a", label: "Primera caja", type: "time", sequence: "empaque" },
    { key: "b", label: "Último pallet", type: "time", sequence: "empaque" },
    { key: "c", label: "Salida", type: "time", sequence: "empaque" },
  ];
  const seqs = sequences(cols);

  it("arma un proceso por nombre, en el orden en que se declararon", () => {
    expect(seqs.map((s) => s.map((c) => c.key))).toEqual([["a", "b", "c"]]);
    // Un paso solo no es un proceso.
    expect(sequences([{ key: "x", label: "X", sequence: "solo" }])).toEqual([]);
  });

  it("un paso vacío con uno posterior registrado es «Faltante»; los del final, no", () => {
    expect([...sequenceMarks({ a: "07:00", b: null, c: "15:00" }, seqs)]).toEqual([["b", { kind: "missing" }]]);
    expect(sequenceMarks({ a: "07:00", b: null, c: null }, seqs).size).toBe(0);
    expect([...sequenceMarks({ a: "", b: "", c: "15:00" }, seqs).keys()]).toEqual(["a", "b"]);
  });

  it("un paso anterior al último paso previo con valor va marcado, con el nombre de ese paso", () => {
    expect([...sequenceMarks({ a: "07:00", b: "06:30", c: "15:00" }, seqs)]).toEqual([["b", { kind: "order", after: "Primera caja" }]]);
    // Compara con el último paso CON valor, saltando el que falta.
    expect([...sequenceMarks({ a: "07:00", b: null, c: "06:00" }, seqs)]).toEqual([
      ["b", { kind: "missing" }],
      ["c", { kind: "order", after: "Primera caja" }],
    ]);
    expect(sequenceMarks({ a: "07:00", b: "07:00", c: "15:00" }, seqs).size).toBe(0);
  });
});

describe("readTime: la hora en su proceso", () => {
  const prev = (value: string, label = "Primer pallet") => ({ value, label });
  const now = at(14, 35);

  it("sin a. m./p. m., la que encaja después del paso anterior: «2» después de las 06:31 son las 14:00", () => {
    expect(readTime("2", { prev: prev("06:31"), now })).toEqual({ kind: "ok", value: "14:00", how: "afternoon" });
    // El error de producción: «150» entre las 06:44 y las 14:02 son las 13:50, no la 01:50.
    expect(readTime("150", { prev: prev("06:44"), next: prev("14:02", "Último pallet"), now })).toEqual({ kind: "ok", value: "13:50", how: "afternoon" });
    expect(readTime("7:30", { prev: prev("06:31"), now })).toEqual({ kind: "ok", value: "07:30", how: "typed" });
    // Sin paso anterior, tal cual.
    expect(readTime("6", { now })).toEqual({ kind: "ok", value: "06:00", how: "typed" });
  });

  it("con cero adelante, 12 o más, o con a. m./p. m., no se adivina: va como se escribió, con el aviso", () => {
    expect(readTime("0130", { prev: prev("06:31"), now })).toEqual({ kind: "ok", value: "01:30", how: "typed", warn: "beforePrev" });
    expect(readTime("1:30 am", { prev: prev("06:31"), now })).toMatchObject({ value: "01:30", warn: "beforePrev" });
    expect(readTime("13", { prev: prev("06:31"), now })).toEqual({ kind: "ok", value: "13:00", how: "typed" });
  });

  it("una hora que ya pasó es mejor que una que no ha llegado; si solo la de la tarde encaja, esa (más tarde que ahora)", () => {
    // 3:00 queda antes de las 14:00; las 15:00 encajan aunque no han llegado.
    expect(readTime("3", { prev: prev("14:00"), now })).toEqual({ kind: "ok", value: "15:00", how: "afternoon", warn: "future" });
    // Sin contexto, una hora futura no se pasa a la tarde (sería más futura).
    expect(readTime("8", { now: at(5, 0) })).toEqual({ kind: "ok", value: "08:00", how: "typed", warn: "future" });
  });

  it("«+20» suma al paso anterior; «-10» y «hace 10» restan a ahora", () => {
    expect(readTime("+20", { prev: prev("14:00"), now })).toEqual({ kind: "ok", value: "14:20", how: "after", minutes: 20 });
    expect(readTime("+1:30", { prev: prev("06:31"), now })).toMatchObject({ value: "08:01", minutes: 90 });
    expect(readTime("+1h", { prev: prev("06:31"), now })).toMatchObject({ value: "07:31", minutes: 60 });
    expect(readTime("+20", { now })).toEqual({ kind: "bad", why: "noPrev" });
    expect(readTime("-10", { now })).toEqual({ kind: "ok", value: "14:25", how: "ago", minutes: 10 });
    expect(readTime("hace 10 min", { now })).toMatchObject({ value: "14:25", how: "ago" });
    expect(readTime("-20", { now: at(0, 5) })).toEqual({ kind: "bad", why: "unknown" });
  });

  it("mientras se escribe una palabra o un signo no es un error; «ahora» es la hora del reloj", () => {
    for (const t of ["a", "aho", "+", "-", "hace", "y"]) expect(readTime(t, { now }), t).toEqual({ kind: "partial" });
    expect(readTime("ahora", { now })).toEqual({ kind: "ok", value: "14:35", how: "now" });
    expect(readTime("  ", { now })).toEqual({ kind: "empty" });
    expect(readTime("25:00", { now })).toEqual({ kind: "bad", why: "unknown" });
  });

  it("parseInput usa el paso anterior y el siguiente", () => {
    const c: GridColumn = { key: "h", label: "Hora", type: "time" };
    expect(parseInput("2", c, undefined, now, { prev: prev("06:31") })).toBe("14:00");
    expect(parseInput("+20", c, undefined, now, { prev: prev("06:31") })).toBe("06:51");
  });
});

describe("cómo va un proceso", () => {
  const steps: GridColumn[] = [
    { key: "a", label: "Primera caja", type: "time", sequence: "empaque" },
    { key: "b", label: "Último pallet", type: "time", sequence: "empaque" },
    { key: "c", label: "Salida", type: "time", sequence: "empaque" },
  ];

  it("sin empezar, en curso, terminado o por revisar", () => {
    expect(sequenceState({ a: null, b: null, c: null }, steps)).toBe("idle");
    expect(sequenceState({ a: "07:00", b: null, c: null }, steps)).toBe("live");
    expect(sequenceState({ a: "07:00", b: "08:00", c: "09:00" }, steps)).toBe("done");
    expect(sequenceState({ a: "07:00", b: null, c: "09:00" }, steps)).toBe("review");
    expect(sequenceState({ a: "07:00", b: "06:00", c: null }, steps)).toBe("review");
  });

  it("el paso que sigue es el primero vacío después del último con valor", () => {
    expect(nextStep({ a: null, b: null, c: null }, steps)?.key).toBe("a");
    expect(nextStep({ a: "07:00", b: null, c: null }, steps)?.key).toBe("b");
    expect(nextStep({ a: null, b: "08:00", c: null }, steps)?.key).toBe("c");
    expect(nextStep({ a: "07:00", b: "08:00", c: "09:00" }, steps)).toBeNull();
  });

  it("los pasos vecinos con hora, saltando los vacíos; lo pegado antes cuenta", () => {
    expect(stepsAround({ a: "07:00", b: null, c: "09:00" }, steps, steps[1])).toEqual({ prev: { value: "07:00", label: "Primera caja" }, next: { value: "09:00", label: "Salida" } });
    expect(stepsAround({ a: null, b: null, c: null }, steps, steps[2], { a: "06:00" })).toEqual({ prev: { value: "06:00", label: "Primera caja" }, next: null });
  });

  it("la columna `timeline` dibuja el proceso: no es un paso", () => {
    expect(sequences([...steps, { key: "avance", label: "Avance", type: "timeline", sequence: "empaque" }]).map((s) => s.map((c) => c.key))).toEqual([["a", "b", "c"]]);
  });
});
