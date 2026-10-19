import { describe, expect, it } from "vitest";
import { dayOf } from "../src/core/days";
import { findDate, findDateSpan, normalizeIntentText } from "../src/components/intent/logic";
import {
  cleanTaskItems,
  cleanTaskLinks,
  cleanTaskRequests,
  groupTasks,
  paraKey,
  parseTask,
  plural,
  requestSummary,
  strongMatch,
  taskCounts,
  taskDueText,
  taskGroup,
  taskShortDate,
  type ParaMatch,
} from "../src/components/tasks/logic";
import { TASKS_LABELS } from "../src/components/tasks/tasks";
import type { TaskItem, TasksPerson } from "../src/components/tasks/types";

// Lunes 19 de octubre de 2026.
const TODAY = dayOf(2026, 10, 19);
const T = "2026-10-19";
const LAURA: TasksPerson = { id: "u12", name: "Laura Gómez", detail: "Analista de compras" };
const LAURA_R: TasksPerson = { id: "u14", name: "Laura Restrepo" };
const ANDRES: TasksPerson = { id: "u3", name: "Andrés Pérez" };
const parse = (text: string, o: Parameters<typeof parseTask>[1] = {}) => parseTask(text, { today: T, ...o });

describe("findDateSpan (el lector de <nx-intent>, con el lugar)", () => {
  const t = normalizeIntentText;
  const at = (text: string) => {
    const s = t(text);
    const r = findDateSpan(s, TODAY);
    return r && s.slice(r.start, r.end);
  };
  it("dice dónde está lo que leyó", () => {
    expect(at("llamar a laura mañana")).toBe("manana");
    expect(at("pasado mañana sin falta")).toBe("pasado manana");
    expect(at("hoy en la tarde")).toBe("hoy");
    expect(at("el viernes")).toBe("viernes");
    expect(at("pagar el 14 sin falta")).toBe("el 14");
    expect(at("entrega 14/10")).toBe("14/10");
    expect(at("cierre 14 de octubre de 2027")).toBe("14 de octubre de 2027");
    expect(at("corte 2026-12-28")).toBe("2026-12-28");
    expect(at("mañana por la mañana")).toBe("manana");
    expect(at("en la mañana")).toBeNull();
  });
  it("findDate sigue igual: es la misma función sin el lugar", () => {
    expect(findDate(t("31 de febrero"), TODAY)).toBeNull();
    expect(findDateSpan(t("31 de febrero"), TODAY)).toMatchObject({ day: null });
    expect(findDate(t("el jueves"), TODAY)).toBe(dayOf(2026, 10, 22));
  });
});

describe("parseTask: una tarea en una línea", () => {
  it("título, fecha y urgente; lo reconocido sale del título", () => {
    expect(parse("Llamar a Laura mañana urgente")).toEqual({ title: "Llamar a Laura", due: "2026-10-20", urgent: true, people: [] });
    expect(parse("enviar el informe de ventas el viernes")).toEqual({ title: "Enviar el informe de ventas", due: "2026-10-23", urgent: false, people: [] });
    expect(parse("Urgente: pagar la nómina hoy").title).toBe("Pagar la nómina");
    expect(parse("Urgente: pagar la nómina hoy")).toMatchObject({ due: T, urgent: true });
    expect(parse("Pagar factura de Aceros, es urgente")).toMatchObject({ title: "Pagar factura de Aceros", urgent: true });
    expect(parse("revisar el contrato muy urgente")).toMatchObject({ title: "Revisar el contrato", urgent: true });
    expect(parse("Comprar tóner")).toEqual({ title: "Comprar tóner", urgent: false, people: [] });
  });

  it("fechas: hoy, mañana, pasado mañana, día de la semana, «el 14», «14/10» y «14 de octubre»", () => {
    expect(parse("cerrar caja hoy").due).toBe(T);
    expect(parse("cerrar caja pasado mañana")).toMatchObject({ title: "Cerrar caja", due: "2026-10-21" });
    expect(parse("Reunión de seguimiento el lunes")).toMatchObject({ title: "Reunión de seguimiento", due: "2026-10-26" });
    expect(parse("Pagar arriendo el 14")).toMatchObject({ title: "Pagar arriendo", due: "2026-11-14" });
    expect(parse("Pagar arriendo el 25")).toMatchObject({ due: "2026-10-25" });
    expect(parse("Renovar póliza 14/11")).toMatchObject({ title: "Renovar póliza", due: "2026-11-14" });
    expect(parse("renovar póliza el 3 de diciembre")).toMatchObject({ title: "Renovar póliza", due: "2026-12-03" });
    expect(parse("Entregar inventario para el viernes")).toMatchObject({ title: "Entregar inventario", due: "2026-10-23" });
    expect(parse("Aprobar compras antes del viernes")).toMatchObject({ title: "Aprobar compras", due: "2026-10-23" });
    // Sin tildes ni mayúsculas también.
    expect(parse("LLAMAR AL BANCO MANANA")).toMatchObject({ title: "LLAMAR AL BANCO", due: "2026-10-20" });
    // «en la mañana» no es una fecha; una que no existe tampoco.
    expect(parse("Llamar en la mañana")).toEqual({ title: "Llamar en la mañana", urgent: false, people: [] });
    expect(parse("Revisar 31/02").title).toBe("Revisar 31/02");
  });

  it("limpia lo que cuelga al final (a, para, el, la, de, del, comas) y pone la mayúscula", () => {
    expect(parse("llamar a Laura el")).toMatchObject({ title: "Llamar a Laura" });
    expect(parse("comprar café para, mañana")).toMatchObject({ title: "Comprar café", due: "2026-10-20" });
    expect(parse("revisar inventario del mañana")).toMatchObject({ title: "Revisar inventario" });
    expect(parse("  pagar   la luz ,  urgente  ")).toMatchObject({ title: "Pagar la luz", urgent: true });
    expect(parse("Llamar a Laura mañana.")).toMatchObject({ title: "Llamar a Laura" });
    expect(parse("¿llamar a Laura?").title).toBe("¿Llamar a Laura?");
    expect(parse("ñame para el almuerzo").title).toBe("Ñame para el almuerzo");
  });

  it("sin título: solo lo reconocido", () => {
    expect(parse("urgente mañana")).toEqual({ title: "", due: "2026-10-20", urgent: true, people: [] });
    expect(parse("")).toEqual({ title: "", urgent: false, people: [] });
  });

  it("lo que la persona quitó de lo entendido vuelve al título", () => {
    expect(parse("Llamar a Laura mañana urgente", { keepDate: true })).toEqual({ title: "Llamar a Laura mañana", urgent: true, people: [] });
    expect(parse("Llamar a Laura mañana urgente", { keepUrgent: true })).toEqual({ title: "Llamar a Laura urgente", due: "2026-10-20", urgent: false, people: [] });
  });

  it("@: las personas elegidas de la lista, por su texto exacto", () => {
    const d = parse("Revisar el contrato @Laura Gómez @Andrés Pérez el viernes", { people: [LAURA, ANDRES] });
    expect(d).toEqual({ title: "Revisar el contrato", due: "2026-10-23", urgent: false, people: [LAURA, ANDRES] });
    // Si el nombre ya no está entero, ya no es ella.
    expect(parse("Revisar @Laura Góm", { people: [LAURA] }).people).toEqual([]);
    // Pegado a otra palabra no cuenta (un correo).
    expect(parse("Escribir a ana@Laura Gómez", { people: [LAURA] }).people).toEqual([]);
  });

  it("«para Nombre»: pregunta, y solo con una coincidencia fuerte lo toma", () => {
    const d = parse("Enviar informe para Laura mañana");
    expect(d).toMatchObject({ title: "Enviar informe para Laura", due: "2026-10-20", ask: "laura" });
    const yes = new Map<string, ParaMatch>([["laura", { person: LAURA, used: 1 }]]);
    expect(parse("Enviar informe para Laura mañana", { resolved: yes })).toEqual({ title: "Enviar informe", due: "2026-10-20", urgent: false, people: [LAURA] });
    const no = new Map<string, ParaMatch>([["laura", null]]);
    expect(parse("Enviar informe para Laura", { resolved: no })).toEqual({ title: "Enviar informe para Laura", urgent: false, people: [] });
    // Dos palabras: la clave las lleva, y `used` dice cuántas son el nombre.
    expect(parse("Enviar informe para Laura Gómez").ask).toBe("laura gomez");
    const two = new Map<string, ParaMatch>([["laura gomez", { person: LAURA, used: 2 }]]);
    expect(parse("Enviar informe para Laura Gómez", { resolved: two }).title).toBe("Enviar informe");
    const one = new Map<string, ParaMatch>([["laura revisar", { person: LAURA, used: 1 }]]);
    expect(parse("para Laura revisar", { resolved: one })).toMatchObject({ title: "Revisar", people: [LAURA] });
    // «para el viernes», «para mi jefe», «para hoy» no preguntan.
    expect(parse("Informe para el viernes").ask).toBeUndefined();
    expect(parse("Informe para mi jefe").ask).toBeUndefined();
    expect(parse("Informe para hoy")).toMatchObject({ title: "Informe", due: T });
    expect(paraKey(["laura", "gomez"])).toBe("laura gomez");
  });

  it("el texto nunca se interpreta: un título con marcas queda tal cual", () => {
    // (Con su mayúscula: es la primera letra.)
    expect(parse("<img src=x onerror=alert(1)> mañana").title).toBe("<Img src=x onerror=alert(1)>");
  });
});

describe("strongMatch", () => {
  it("una sola persona con esa palabra entera del nombre", () => {
    expect(strongMatch(["laura"], [LAURA, ANDRES])).toEqual({ person: LAURA, used: 1 });
    expect(strongMatch(["laura", "gomez"], [LAURA, ANDRES])).toEqual({ person: LAURA, used: 2 });
    expect(strongMatch(["gomez"], [LAURA, ANDRES])).toEqual({ person: LAURA, used: 1 });
    // Una palabra a medias no es fuerte.
    expect(strongMatch(["lau"], [LAURA])).toBeNull();
  });
  it("con dos, la segunda palabra desempata; si no, nada", () => {
    expect(strongMatch(["laura"], [LAURA, LAURA_R])).toBeNull();
    expect(strongMatch(["laura", "restrepo"], [LAURA, LAURA_R])).toEqual({ person: LAURA_R, used: 2 });
    expect(strongMatch(["laura", "mañana"], [LAURA, LAURA_R])).toBeNull();
    // La misma persona dos veces en la respuesta cuenta una.
    expect(strongMatch(["laura"], [LAURA, { ...LAURA }])).toEqual({ person: LAURA, used: 1 });
    expect(strongMatch([], [LAURA])).toBeNull();
  });
});

describe("validar lo que llega", () => {
  it("tareas: id y título; fecha válida; href seguro; sin repetidos", () => {
    const items = cleanTaskItems([
      { id: 1, title: " Pagar ", due: "2026-02-31", urgent: "sí", done: true, href: "javascript:alert(1)", by: "Laura" },
      { id: "1", title: "repetida" },
      { id: "2", title: "Con fecha", due: "2026-10-23", href: "/t/2", urgent: true },
      { id: "3" },
      null,
      "x",
    ]);
    expect(items).toEqual([
      { id: "1", title: "Pagar", by: "Laura", done: true },
      { id: "2", title: "Con fecha", due: "2026-10-23", href: "/t/2", urgent: true },
    ]);
    expect(cleanTaskItems("no")).toEqual([]);
  });
  it("enlaces: sin href seguro no hay; tono conocido o nada", () => {
    expect(
      cleanTaskLinks([
        { id: "a", title: "Firma OC-2291", kind: "Firma", tone: "warning", meta: "Compras", action: "Firmar", href: "/firmas/1", newTab: true },
        { id: "b", title: "Mala", kind: "x", action: "y", href: "javascript:alert(1)" },
        { id: "c", title: "Sin tono", tone: "rojo", href: "/c" },
      ]),
    ).toEqual([
      { id: "a", title: "Firma OC-2291", kind: "Firma", tone: "warning", meta: "Compras", action: "Firmar", href: "/firmas/1", newTab: true },
      { id: "c", title: "Sin tono", kind: "", action: "", href: "/c" },
    ]);
  });
  it("lo pedido: al menos una persona", () => {
    expect(
      cleanTaskRequests([
        { id: "r1", title: "Cotizar", people: [{ name: "Laura", done: true }, { name: "" }, { name: "Andrés" }], due: "2026-10-18" },
        { id: "r2", title: "Sin nadie", people: [] },
      ]),
    ).toEqual([{ id: "r1", title: "Cotizar", due: "2026-10-18", people: [{ name: "Laura", done: true }, { name: "Andrés" }] }]);
  });
});

describe("grupos, cifras y fechas", () => {
  const items: TaskItem[] = [
    { id: "a", title: "Sin fecha" },
    { id: "b", title: "Hoy normal", due: T },
    { id: "c", title: "Vencida", due: "2026-10-16" },
    { id: "d", title: "Hoy urgente", due: T, urgent: true },
    { id: "e", title: "Viernes", due: "2026-10-23" },
    { id: "f", title: "Jueves", due: "2026-10-22" },
    { id: "g", title: "Más adelante", due: "2026-10-26" },
    { id: "h", title: "Hecha", due: "2026-10-01", done: true },
    { id: "i", title: "Sin fecha urgente", urgent: true },
  ];
  it("los grupos, en orden y solo los que tienen algo", () => {
    expect(taskGroup("2026-10-18", TODAY)).toBe("late");
    expect(taskGroup(T, TODAY)).toBe("today");
    expect(taskGroup("2026-10-25", TODAY)).toBe("soon");
    expect(taskGroup("2026-10-26", TODAY)).toBe("later");
    expect(taskGroup(undefined, TODAY)).toBe("none");
    const { groups, done } = groupTasks(items, TODAY);
    expect(groups.map((g) => [g.id, g.items.map((t) => t.id)])).toEqual([
      ["late", ["c"]],
      ["today", ["d", "b"]],
      ["soon", ["f", "e"]],
      ["later", ["g"]],
      ["none", ["i", "a"]],
    ]);
    expect(done.map((t) => t.id)).toEqual(["h"]);
    expect(groupTasks([], TODAY)).toEqual({ groups: [], done: [] });
  });
  it("las cifras de la cabecera", () => {
    const requests = [
      { id: "r1", title: "x", people: [{ name: "A", done: true }] },
      { id: "r2", title: "y", people: [{ name: "A" }, { name: "B", done: true }] },
    ];
    expect(taskCounts(items, [{ id: "l", title: "l", kind: "", action: "", href: "/" }], requests, TODAY)).toEqual({ late: 1, today: 2, waiting: 1, asked: 1 });
    expect(plural(TASKS_LABELS.countLate, 1)).toBe("1 vencida");
    expect(plural(TASKS_LABELS.countLate, 3)).toBe("3 vencidas");
    expect(plural(TASKS_LABELS.countWaiting, 2)).toBe("2 te esperan");
  });
  it("el texto de la fecha", () => {
    const due = (d: string | undefined) => taskDueText(d, TODAY, "es-CO", TASKS_LABELS);
    expect(due("2026-10-16")).toEqual({ text: "venció hace 3 días", tone: "late" });
    expect(due("2026-10-18")).toEqual({ text: "venció ayer", tone: "late" });
    expect(due(T)).toEqual({ text: "vence hoy", tone: "today" });
    expect(due("2026-10-20")).toEqual({ text: "vence mañana", tone: null });
    expect(due("2026-10-23")).toEqual({ text: "vence el vie 23 oct", tone: null });
    expect(due("2027-01-05")?.text).toBe("vence el mar 5 ene 2027");
    expect(due(undefined)).toBeNull();
    expect(taskShortDate(dayOf(2026, 10, 23), TODAY, "en-US")).toBe("Fri Oct 23");
  });
  it("lo pedido: avance y quién falta", () => {
    const L = TASKS_LABELS;
    expect(requestSummary({ id: "r", title: "x", people: [{ name: "Laura Gómez", done: true }, { name: "Héctor", done: true }, { name: "Andrés Pérez" }] }, TODAY, L)).toEqual({ done: 2, total: 3, text: "2 de 3 hechas · falta Andrés Pérez", late: false });
    expect(requestSummary({ id: "r", title: "x", due: "2026-10-16", people: [{ name: "Ana" }, { name: "Bea" }, { name: "Carlos", done: true }] }, TODAY, L)).toEqual({ done: 1, total: 3, text: "1 de 3 hechas · faltan Ana y Bea", late: true });
    expect(requestSummary({ id: "r", title: "x", people: [{ name: "Ana" }, { name: "Bea" }, { name: "Carlos" }, { name: "Dora" }] }, TODAY, L).text).toBe("0 de 4 hechas · faltan Ana, Bea y 2 más");
    expect(requestSummary({ id: "r", title: "x", due: "2026-10-16", people: [{ name: "Ana", done: true }, { name: "Bea", done: true }] }, TODAY, L)).toEqual({ done: 2, total: 2, text: "2 de 2 hechas", late: false });
    expect(requestSummary({ id: "r", title: "x", people: [{ name: "Daniela Henao" }] }, TODAY, L).text).toBe("Daniela Henao · pendiente");
    expect(requestSummary({ id: "r", title: "x", people: [{ name: "Daniela Henao", done: true }] }, TODAY, L).text).toBe("Daniela Henao · hecha");
  });
});
