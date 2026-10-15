import { describe, expect, it } from "vitest";
import {
  bottleneck,
  busiest,
  cleanStages,
  clockText,
  dotScale,
  fmtDuration,
  hourTicks,
  minuteOfDay,
  plural,
  prepareItems,
  queueCurve,
  snapshot,
  stageAt,
  stageStats,
  toMs,
  toneOf,
} from "../src/components/flow/logic";
import { FLOW_LABELS } from "../src/components/flow/flow";
import type { FlowItem, FlowStage } from "../src/components/flow/types";

const T0 = Date.UTC(2026, 9, 14, 11, 0); // 06:00 en Bogotá
const at = (min: number) => T0 + min * 60_000;

const STAGES: FlowStage[] = [
  { id: "ruta", label: "En ruta", limit: 120 },
  { id: "finca", label: "En finca", limit: 120 },
  { id: "cierre", label: "Cerrado", limit: 60 },
  { id: "puerto", label: "Despachado", end: true },
];

const item = (id: string, times: Record<string, number | null>, extra: Partial<FlowItem> = {}): FlowItem => ({
  id,
  label: id.toUpperCase(),
  times: Object.fromEntries(Object.entries(times).map(([k, v]) => [k, v === null ? null : new Date(at(v)).toISOString()])),
  ...extra,
});

describe("flow: horas", () => {
  it("entiende ISO, milisegundos y segundos; lo demás es NaN", () => {
    expect(toMs("2026-10-14T11:00:00Z")).toBe(T0);
    expect(toMs(T0)).toBe(T0);
    expect(toMs(T0 / 1000)).toBe(T0);
    expect(toMs(String(T0 / 1000))).toBe(T0);
    expect(toMs("")).toBeNaN();
    expect(toMs(null)).toBeNaN();
    expect(toMs("ayer")).toBeNaN();
    expect(toMs(Infinity)).toBeNaN();
  });
});

describe("flow: etapas e ítems", () => {
  it("se quedan las etapas con id único y nombre; límites solo positivos", () => {
    const s = cleanStages([
      { id: "a", label: "A", limit: 30 },
      { id: "a", label: "Repetida" },
      { id: "", label: "Sin id" },
      { id: 2, label: "Dos", limit: -5, warn: 0, end: true },
      { id: "c" },
      null,
    ]);
    expect(s).toEqual([
      { id: "a", label: "A", limit: 30 },
      { id: "2", label: "Dos", end: true },
    ]);
    expect(cleanStages("nada")).toEqual([]);
  });

  it("sin ninguna hora, el ítem no se pinta; el id repetido gana el primero", () => {
    const p = prepareItems([item("a", { ruta: 0 }), item("b", {}), item("a", { ruta: 5 }), { id: "", times: {} }, null], STAGES);
    expect(p.map((x) => x.id)).toEqual(["a"]);
    expect(p[0].t[0]).toBe(at(0));
  });

  it("la etapa es la más avanzada que ya pasó, aunque falten hitos o vengan desordenados", () => {
    const [p] = prepareItems([item("a", { ruta: 0, cierre: 50, finca: 70 })], STAGES);
    expect(stageAt(p, at(-1))).toBe(-1);
    expect(stageAt(p, at(10))).toBe(0);
    expect(stageAt(p, at(55))).toBe(2);
    // La finca llegó después del cierre: el cierre sigue mandando.
    expect(stageAt(p, at(80))).toBe(2);
  });

  it("los tramos en cola terminan al llegar a la etapa final", () => {
    const [a, b] = prepareItems([item("a", { ruta: 0, finca: 30, puerto: 90 }), item("b", { ruta: 10 })], STAGES);
    expect(a.spans).toEqual([[at(0), at(90)]]);
    expect(b.spans).toEqual([[at(10), Infinity]]);
  });
});

describe("flow: tono", () => {
  it("ámbar desde el 75 % (o warn), rojo pasado el límite, gris en la final", () => {
    const s: FlowStage = { id: "x", label: "X", limit: 100 };
    expect(toneOf(s, 74)).toBe("ok");
    expect(toneOf(s, 75)).toBe("near");
    expect(toneOf(s, 100)).toBe("near");
    expect(toneOf(s, 101)).toBe("over");
    expect(toneOf({ ...s, warn: 90 }, 80)).toBe("ok");
    expect(toneOf({ ...s, warn: 90 }, 90)).toBe("near");
    expect(toneOf({ id: "y", label: "Y" }, 9999)).toBe("ok");
    expect(toneOf({ id: "z", label: "Z", end: true, limit: 1 }, 50)).toBe("done");
  });
});

describe("flow: la foto", () => {
  const items = prepareItems(
    [
      item("a", { ruta: 0, finca: 30 }),
      item("b", { ruta: 10, finca: 20 }),
      item("c", { ruta: 0, finca: 40, cierre: 200 }),
      item("d", { ruta: 0, finca: 10, cierre: 20, puerto: 150 }),
      item("e", { ruta: 400 }),
    ],
    STAGES,
  );

  it("agrupa por etapa, el que más lleva primero, y suma cola y terminados", () => {
    const snap = snapshot(items, STAGES, at(180));
    expect(snap.groups.map((g) => g.map((r) => r.p.id))).toEqual([[], ["b", "a", "c"], [], ["d"]]);
    expect(snap.groups[1].map((r) => r.age)).toEqual([160, 150, 140]);
    expect(snap.groups[1].map((r) => r.tone)).toEqual(["over", "over", "over"]);
    expect(snap.queue).toBe(3);
    expect(snap.ended).toBe(1);
    expect(snap.where.has("e")).toBe(false);
  });

  it("cuenta cuántos entraron en la última hora a cada etapa y cuántos había antes", () => {
    const snap = snapshot(items, STAGES, at(210));
    // En la última hora (150, 210] entró c al cierre (a los 200); d llegó al puerto justo a los 150, fuera.
    expect(snap.rate).toEqual([0, 1, 0, 0]);
    expect(snapshot(items, STAGES, at(200)).rate).toEqual([0, 1, 1, 0]);
    expect(snap.before).toEqual([0, 3, 0, 1]);
  });

  it("dónde se atasca: más vencidos y, a igualdad, más llena", () => {
    const snap = snapshot(items, STAGES, at(180));
    expect(bottleneck(snap, STAGES)).toBe(1);
    expect(busiest(snap, STAGES)).toBe(1);
    const calm = snapshot(items, STAGES, at(35));
    expect(bottleneck(calm, STAGES)).toBe(-1);
    expect(stageStats(snap.groups[1])).toEqual({ count: 3, over: 3, near: 0, median: 150 });
    expect(stageStats([]).median).toBeNull();
  });
});

describe("flow: curva de la cola", () => {
  it("cuenta lo que está en cola en cada muestra, sin recalcular la foto", () => {
    const items = prepareItems([item("a", { ruta: 0, puerto: 60 }), item("b", { ruta: 30 })], STAGES);
    expect(queueCurve(items, at(0), at(90), 4)).toEqual([1, 2, 1, 1]);
    expect(queueCurve(items, at(10), at(10), 4)).toEqual([]);
  });

  it("coincide con la foto en cada muestra", () => {
    const rnd = (() => {
      let s = 7;
      return () => ((s = (s * 16807) % 2147483647) / 2147483647);
    })();
    const raw: FlowItem[] = [];
    for (let i = 0; i < 300; i++) {
      const t0 = Math.floor(rnd() * 600);
      const times: Record<string, number | null> = { ruta: t0 };
      if (rnd() < 0.8) times.finca = t0 + Math.floor(rnd() * 120);
      if (rnd() < 0.6) times.cierre = t0 + 60 + Math.floor(rnd() * 200);
      if (rnd() < 0.4) times.puerto = t0 + 200 + Math.floor(rnd() * 300);
      raw.push(item(`i${i}`, times));
    }
    const items = prepareItems(raw, STAGES);
    const curve = queueCurve(items, at(0), at(1000), 21);
    curve.forEach((q, k) => expect(q).toBe(snapshot(items, STAGES, at(k * 50)).queue));
  });
});

describe("flow: puntos", () => {
  it("el punto más grande con el que cabe la etapa más llena", () => {
    expect(dotScale(54, 135, 132)).toMatchObject({ pitch: 13, size: 10, cols: 10, rows: 6 });
    expect(dotScale(300, 135, 132).pitch).toBeLessThan(13);
    const tiny = dotScale(5000, 100, 60);
    expect(tiny.size).toBe(4);
    expect((tiny.rows - 1) * tiny.pitch + tiny.size).toBeLessThanOrEqual(60);
    expect(dotScale(3, 0, 132).cols).toBe(1);
  });
});

describe("flow: textos", () => {
  it("duraciones cortas, en horas y en días", () => {
    expect(fmtDuration(0, FLOW_LABELS)).toBe("0 min");
    expect(fmtDuration(45, FLOW_LABELS)).toBe("45 min");
    expect(fmtDuration(120, FLOW_LABELS)).toBe("2 h");
    expect(fmtDuration(145, FLOW_LABELS)).toBe("2 h 25 min");
    expect(fmtDuration(60 * 50 + 10, FLOW_LABELS)).toBe("2 d 2 h");
    expect(fmtDuration(NaN, FLOW_LABELS)).toBe("0 min");
  });

  it("singular y plural", () => {
    expect(plural("viaje|viajes", 1)).toBe("viaje");
    expect(plural("viaje|viajes", 0)).toBe("viajes");
    expect(plural("km", 3)).toBe("km");
  });

  it("horas en la zona pedida, con la fecha si es de otro día", () => {
    expect(clockText(T0, "es-CO", "America/Bogota")).toBe("06:00");
    expect(clockText(T0 - 9 * 3_600_000, "es-CO", "America/Bogota", T0)).toMatch(/^13\/10 21:00$/);
    expect(minuteOfDay(T0, "America/Bogota")).toBe(360);
    // Una zona que no existe no rompe: usa la del equipo.
    expect(() => clockText(T0, "es-CO", "Marte/Olympus")).not.toThrow();
  });

  it("marcas de hora en punto, sin pegarse a los bordes", () => {
    const day = Date.UTC(2026, 9, 14, 5, 0); // 00:00 en Bogotá
    const ticks = hourTicks(day, day + 15 * 3_600_000, "America/Bogota");
    expect(ticks.map((t) => clockText(t, "es-CO", "America/Bogota"))).toEqual(["03:00", "06:00", "09:00", "12:00"]);
    const short = hourTicks(at(10), at(190), "America/Bogota");
    expect(short.map((t) => clockText(t, "es-CO", "America/Bogota"))).toEqual(["07:00", "08:00", "09:00"]);
    expect(hourTicks(at(5), at(5))).toEqual([]);
  });
});

describe("flow: salidas con hitos saltados", () => {
  it("quien pasa de la finca al cierre sin inspección sale de la finca, no de la inspección", () => {
    const stages: FlowStage[] = [
      { id: "finca", label: "Finca" },
      { id: "ext", label: "Insp. externa" },
      { id: "cierre", label: "Cierre" },
    ];
    const items = prepareItems([item("a", { finca: 0, cierre: 30 }), item("b", { finca: 10, ext: 20 })], stages);
    expect(items[0].steps).toEqual([[at(0), -1, 0], [at(30), 0, 2]]);
    const snap = snapshot(items, stages, at(40));
    expect(snap.rate).toEqual([2, 0, 0]);
    expect(snap.entered).toEqual([2, 1, 1]);
  });
});

describe("flow: lo que encontró la revisión", () => {
  it("una hora implausible no es una hora (centinelas, nanosegundos, fuera de Date)", () => {
    expect(toMs(0)).toBeNaN();
    expect(toMs("0001-01-01T00:00:00Z")).toBeNaN();
    expect(toMs(1.76e18)).toBeNaN();
    expect(toMs(-9e15)).toBeNaN();
    expect(toMs("1999-12-31T23:59:59Z")).toBeNaN();
    expect(toMs("2026-10-14T11:00:00Z")).toBe(T0);
  });

  it("una ISO sin desfase se lee en la zona del componente, no en la del equipo", () => {
    expect(toMs("2026-10-14T06:00:00", "America/Bogota")).toBe(T0);
    expect(toMs("2026-10-14 06:00", "America/Bogota")).toBe(T0);
    expect(toMs("2026-10-14T06:00:00", "Etc/GMT+5")).toBe(T0);
    // Con desfase manda el desfase.
    expect(toMs("2026-10-14T11:00:00Z", "America/Bogota")).toBe(T0);
  });

  it("warn sin limit avisa en ámbar (nunca rojo)", () => {
    expect(toneOf({ id: "w", label: "W", warn: 30 }, 45)).toBe("near");
    expect(toneOf({ id: "w", label: "W", warn: 30 }, 10)).toBe("ok");
  });

  it("flag: el texto, true sin texto, o nada", () => {
    const p = prepareItems(
      [item("a", { ruta: 0 }, { flag: "No" }), item("b", { ruta: 0 }, { flag: true }), item("c", { ruta: 0 }, { flag: "  " })],
      STAGES,
    );
    expect(p.map((x) => x.flag)).toEqual(["No", "", null]);
  });

  it("las marcas de hora siguen la hora de pared en el día del cambio de hora", () => {
    const day = Date.UTC(2026, 10, 1, 4, 0); // 00:00 en Nueva York; a las 02:00 vuelve a la 01:00
    const ticks = hourTicks(day, day + 25 * 3_600_000, "America/New_York");
    expect(ticks.map((t) => clockText(t, "es-CO", "America/New_York"))).toEqual(["03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"]);
  });
});
