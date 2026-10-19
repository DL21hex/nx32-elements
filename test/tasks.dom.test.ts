// @vitest-environment happy-dom
//
// happy-dom no calcula cajas ni corre animaciones: la fila que se va (una copia con
// `nx-tasks__ghost`) se queda hasta su `setTimeout`, y por eso aquí las filas se buscan por
// `data-id`. El diseño angosto, axe y el dictado se prueban en el navegador (e2e/tasks.spec.ts).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "../src/components/tasks/index";
import type { NxTasks, TaskItem, TaskLink, TaskRequest, TasksCommitDetail, TasksOpenDetail, TasksOptionsDetail, TasksUndoDetail } from "../src/components/tasks/index";

beforeAll(() => {
  Element.prototype.scrollIntoView = function () {};
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until<T>(fn: () => T, ms = 2000): Promise<NonNullable<T>> {
  for (let t = 0; t < ms; t += 10) {
    const v = fn();
    if (v) return v as NonNullable<T>;
    await sleep(10);
  }
  throw new Error("no llegó");
}

const T = "2026-10-19"; // lunes
const ITEMS: TaskItem[] = [
  { id: "a", title: "Enviar el informe de ventas", due: "2026-10-16", by: "Laura Gómez" },
  { id: "b", title: "Revisar la cotización", due: T, href: "/t/b" },
  { id: "c", title: "Llamar al transportador", due: T, urgent: true },
  { id: "d", title: "Renovar la póliza", due: "2026-10-23" },
  { id: "e", title: "Inventario de fin de mes", due: "2026-11-10" },
  { id: "f", title: "Ordenar el archivo" },
  { id: "g", title: "Pagar el arriendo", due: "2026-10-15", done: true },
];
const LINKS: TaskLink[] = [
  { id: "l1", title: "Orden de compra OC-2291", kind: "Firma", tone: "warning", meta: "Compras · desde ayer", action: "Firmar", href: "/firmas/2291" },
  { id: "l2", title: "Vacaciones de Héctor Galeano", kind: "Aprobación", tone: "info", action: "Revisar", href: "/aprobar/7", newTab: true },
];
const REQUESTS: TaskRequest[] = [
  { id: "r1", title: "Cotizar la estiba", due: "2026-10-18", people: [{ name: "Laura Gómez", done: true }, { name: "Héctor Galeano", done: true }, { name: "Andrés Pérez" }] },
  { id: "r2", title: "Firmar el acta", people: [{ name: "Daniela Henao" }] },
  { id: "r3", title: "Cerrar inventario", people: [{ name: "Ana" }, { name: "Bea", done: true }] },
];

function mount(attrs = 'undo="60"', data: { items?: TaskItem[]; links?: TaskLink[]; requests?: TaskRequest[] } = { items: ITEMS, links: LINKS, requests: REQUESTS }): NxTasks {
  document.body.innerHTML = `<nx-tasks heading="Tu día" today="${T}" locale="es-CO" ${attrs}></nx-tasks>`;
  const el = document.querySelector("nx-tasks")!;
  if (data.items) el.items = data.items.map((t) => ({ ...t }));
  if (data.links) el.links = data.links;
  if (data.requests) el.requests = data.requests;
  return el;
}
const $ = <E extends Element = HTMLElement>(el: Element, sel: string) => el.querySelector<E & HTMLElement>(sel)!;
const row = (el: NxTasks, id: string) => el.querySelector<HTMLElement>(`.nx-tasks__row[data-id="${id}"]`);
const check = (el: NxTasks, id: string) => $<HTMLButtonElement>(row(el, id)!, ".nx-tasks__check");
const groupIds = (el: NxTasks, g: string) => [...el.querySelectorAll<HTMLElement>(`[data-group="${g}"] .nx-tasks__row[data-id]`)].map((r) => r.dataset.id ?? "");
const input = (el: NxTasks) => $<HTMLInputElement>(el, ".nx-tasks__input");
const chips = (el: NxTasks) => [...el.querySelectorAll(".nx-tasks__read .nx-tasks__chip")].map((c) => c.textContent);
const say = (el: NxTasks) => $(el, ".nx-tasks__say").textContent;
function type(el: NxTasks, text: string) {
  const i = input(el);
  i.value = text;
  i.setSelectionRange(text.length, text.length);
  i.dispatchEvent(new Event("input", { bubbles: true }));
}
const enter = (el: NxTasks) => $<HTMLFormElement>(el, "form").requestSubmit();
const key = (t: Element, k: string, o: KeyboardEventInit = {}) => t.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...o }));
function events(el: NxTasks) {
  const commits: TasksCommitDetail[] = [];
  const undos: TasksUndoDetail[] = [];
  el.addEventListener("nx-tasks-commit", (e) => commits.push(e.detail));
  el.addEventListener("nx-tasks-undo", (e) => undos.push(e.detail));
  return { commits, undos };
}

describe("<nx-tasks>: lo que se ve", () => {
  it("cabecera con la fecha larga y solo las cifras que no son cero", () => {
    const el = mount();
    expect(el.getAttribute("role")).toBe("region");
    const h = $(el, ".nx-tasks__heading");
    expect(h.localName).toBe("h2");
    expect(h.textContent).toBe("Tu día");
    expect(el.getAttribute("aria-labelledby")).toBe(h.id);
    expect($(el, ".nx-tasks__date").textContent).toBe("lunes 19 de octubre");
    expect([...el.querySelectorAll(".nx-tasks__counts li")].map((l) => l.textContent)).toEqual(["1 vencida", "2 para hoy", "2 te esperan", "3 pedidas por ti"]);
    expect($(el, ".nx-tasks__counts").getAttribute("aria-label")).toBe("Resumen");
  });

  it("las tareas por grupo, urgentes primero, con su fecha, quién la pidió y el botón redondo", () => {
    const el = mount();
    expect([...el.querySelectorAll(".nx-tasks__gh")].map((g) => g.firstChild!.textContent)).toEqual(["Vencidas", "Hoy", "Próximos días", "Más adelante", "Sin fecha", "Te esperan en otros módulos", "Lo que pediste"]);
    expect([...el.querySelectorAll(".nx-tasks__gh")].every((g) => g.localName === "h3")).toBe(true);
    expect(groupIds(el, "late")).toEqual(["a"]);
    expect(groupIds(el, "today")).toEqual(["c", "b"]);
    expect(groupIds(el, "soon")).toEqual(["d"]);
    expect(groupIds(el, "later")).toEqual(["e"]);
    expect(groupIds(el, "none")).toEqual(["f"]);
    const a = row(el, "a")!;
    expect(a.dataset.tone).toBe("late");
    expect($(a, ".nx-tasks__due").textContent).toBe("venció hace 3 días");
    expect($(a, ".nx-tasks__due").dataset.tone).toBe("late");
    expect($(a, ".nx-tasks__by").textContent).toBe("pidió Laura Gómez");
    const btn = check(el, "a");
    expect(btn.localName).toBe("button");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.getAttribute("aria-label")).toBe("Marcar como hecha: Enviar el informe de ventas");
    expect($(row(el, "c")!, ".nx-tasks__pill").textContent).toBe("Urgente");
    expect($(row(el, "b")!, ".nx-tasks__due").dataset.tone).toBe("today");
    expect($(row(el, "b")!, "a.nx-tasks__title").getAttribute("href")).toBe("/t/b");
    expect($(row(el, "d")!, ".nx-tasks__due").textContent).toBe("vence el vie 23 oct");
    expect(row(el, "f")!.querySelector(".nx-tasks__meta")).toBeNull();
    // La hecha, plegada al final.
    const done = $<HTMLDetailsElement>(el, "details.nx-tasks__done");
    expect(done.open).toBe(false);
    expect(done.querySelector("summary")!.textContent).toBe("Hechas hoy (1)");
    expect(check(el, "g").getAttribute("aria-pressed")).toBe("true");
  });

  it("lo que esperan otros módulos y lo pedido", () => {
    const el = mount();
    const l1 = row(el, "l1")!;
    expect($(l1, ".nx-tasks__kind").textContent).toBe("Firma");
    expect($(l1, ".nx-tasks__kind").dataset.tone).toBe("warning");
    expect($(l1, ".nx-tasks__meta").textContent).toBe("Compras · desde ayer");
    const go = $<HTMLAnchorElement>(l1, "a.nx-tasks__go");
    expect(go.getAttribute("href")).toBe("/firmas/2291");
    expect(go.textContent).toBe("Firmar→");
    expect(go.getAttribute("aria-label")).toBe("Firmar: Orden de compra OC-2291");
    expect(go.hasAttribute("target")).toBe(false);
    expect(l1.querySelector(".nx-tasks__check")).toBeNull();
    expect($(row(el, "l2")!, "a.nx-tasks__go").getAttribute("target")).toBe("_blank");
    expect($(row(el, "l2")!, "a.nx-tasks__go").getAttribute("rel")).toBe("noopener noreferrer");

    const r1 = row(el, "r1")!;
    expect(r1.dataset.tone).toBe("late");
    expect($(r1, ".nx-tasks__due").textContent).toBe("venció ayer");
    expect($(r1, ".nx-tasks__who").textContent).toBe("2 de 3 hechas · falta Andrés Pérez");
    const bar = $(r1, ".nx-tasks__progress");
    expect(bar.getAttribute("role")).toBe("img");
    expect(bar.getAttribute("aria-label")).toBe("2 de 3 hechas");
    expect($(row(el, "r2")!, ".nx-tasks__who").textContent).toBe("Daniela Henao · pendiente");
    expect(row(el, "r2")!.querySelector(".nx-tasks__progress")).toBeNull();
    expect($(row(el, "r3")!, ".nx-tasks__who").textContent).toBe("1 de 2 hechas · falta Ana");
  });

  it("heading-level, pie y textos propios", () => {
    const el = mount('heading-level="3" more-href="/pendientes" more-label="Ver todos los pendientes"');
    expect($(el, ".nx-tasks__heading").localName).toBe("h3");
    expect([...el.querySelectorAll(".nx-tasks__gh")].every((g) => g.localName === "h4")).toBe(true);
    const more = $<HTMLAnchorElement>(el, ".nx-tasks__foot a");
    expect(more.getAttribute("href")).toBe("/pendientes");
    expect(more.textContent).toBe("Ver todos los pendientes");
    el.labels = { groupToday: "Para hoy", heading: "x" };
    expect([...el.querySelectorAll(".nx-tasks__gh")].map((g) => g.firstChild!.textContent)).toContain("Para hoy");
    el.removeAttribute("heading");
    expect($(el, ".nx-tasks__heading").textContent).toBe("x");
  });

  it("vacío: el campo y una línea", () => {
    const el = mount('more-href="/pendientes"', {});
    expect($(el, ".nx-tasks__empty").textContent).toBe("No tienes nada pendiente. Lo que escribas aquí queda en tu lista.");
    expect(el.querySelectorAll(".nx-tasks__group, details.nx-tasks__done")).toHaveLength(0);
    expect($(el, ".nx-tasks__counts").hidden).toBe(true);
    expect($(el, ".nx-tasks__foot").hidden).toBe(true);
    expect(input(el).getAttribute("aria-label")).toBe("¿Qué tienes que hacer?");
    expect($(el, ".nx-tasks__hint").textContent).toBe("Escribe y presiona Enter. Entiendo «mañana», «el viernes», «@nombre» y «urgente».");
  });

  it("los datos son texto y los enlaces peligrosos no se pintan; también como atributos JSON", () => {
    document.body.innerHTML = `<nx-tasks today="${T}" items='[{"id":"x","title":"<img src=x onerror=alert(1)>","href":"javascript:alert(1)"}]' links='[{"id":"l","title":"L","kind":"K","action":"Ir","href":"javascript:alert(1)"}]'></nx-tasks>`;
    const el = document.querySelector("nx-tasks")!;
    expect(row(el, "x")!.querySelector("img, a")).toBeNull();
    expect(row(el, "x")!.textContent).toContain("<img");
    expect(row(el, "l")).toBeNull();
    expect($(el, ".nx-tasks__heading").textContent).toBe("Tus pendientes");
  });
});

describe("<nx-tasks>: capturar en una línea", () => {
  it("lee mientras se escribe: «Entendí:» con el título, para quién, la fecha y urgente", () => {
    const el = mount();
    expect($(el, ".nx-tasks__read").hidden).toBe(true);
    type(el, "Llamar a Laura mañana urgente");
    expect($(el, ".nx-tasks__hint").hidden).toBe(true);
    expect($(el, ".nx-tasks__k").textContent).toBe("Entendí:");
    expect(chips(el)).toEqual(["Llamar a Laura", "Para mí", "Vence mañana", "Urgente"]);
    type(el, "Renovar póliza el viernes");
    expect(chips(el)).toEqual(["Renovar póliza", "Para mí", "Vence el vie 23 oct"]);
    type(el, "Ordenar el archivo");
    expect(chips(el)).toEqual(["Ordenar el archivo", "Para mí", "Sin fecha"]);
    // Escape borra lo escrito.
    key(input(el), "Escape");
    expect(input(el).value).toBe("");
    expect($(el, ".nx-tasks__hint").hidden).toBe(false);
  });

  it("quitar la fecha o «urgente» de lo entendido los devuelve al título", () => {
    const el = mount();
    type(el, "Llamar a Laura mañana urgente");
    $<HTMLButtonElement>(el, '.nx-tasks__x[data-act="date"]').click();
    expect(chips(el)).toEqual(["Llamar a Laura mañana", "Para mí", "Sin fecha", "Urgente"]);
    expect($(el, '.nx-tasks__x[data-act="urgent"]').getAttribute("aria-label")).toBe("Quitar Urgente");
    $<HTMLButtonElement>(el, '.nx-tasks__x[data-act="urgent"]').click();
    expect(chips(el)).toEqual(["Llamar a Laura mañana urgente", "Para mí", "Sin fecha"]);
    expect(document.activeElement).toBe(input(el));
  });

  it("Enter agrega al instante; el cambio sale cuando termina el tiempo de deshacer", async () => {
    vi.useFakeTimers();
    const el = mount('undo="5000"');
    const ev = events(el);
    type(el, "Llamar a Laura mañana urgente");
    enter(el);
    expect(input(el).value).toBe("");
    const id = groupIds(el, "soon")[0];
    expect(row(el, id)!.textContent).toContain("Llamar a Laura");
    expect(row(el, id)!.hasAttribute("data-pending")).toBe(true);
    expect(el.items[0]).toEqual({ id, title: "Llamar a Laura", due: "2026-10-20", urgent: true });
    expect(say(el)).toBe("Agregada a tu día: «Llamar a Laura»");
    expect($(el, ".nx-tasks__say").getAttribute("role")).toBe("status");
    expect($(el, ".nx-tasks__undo").hidden).toBe(false);
    expect(ev.commits).toEqual([]);
    vi.advanceTimersByTime(4999);
    expect(ev.commits).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(ev.commits).toEqual([{ key: id, type: "create", title: "Llamar a Laura", due: "2026-10-20", urgent: true, people: [] }]);
    expect($(el, ".nx-tasks__bar").hasAttribute("data-open")).toBe(false);
    // settle: toma el id de verdad; marcarla después sale con ese id.
    expect(el.settle(id, { id: "srv-1", href: "/t/srv-1" })).toBe(true);
    expect(el.settle(id, { id: "otra" })).toBe(false);
    expect(row(el, "srv-1")!.hasAttribute("data-pending")).toBe(false);
    expect($(row(el, "srv-1")!, "a.nx-tasks__title").getAttribute("href")).toBe("/t/srv-1");
    check(el, "srv-1").click();
    vi.advanceTimersByTime(5000);
    expect(ev.commits[1]).toMatchObject({ type: "done", id: "srv-1", done: true });
  });

  it("sin título no agrega: lo dice", () => {
    const el = mount();
    const ev = events(el);
    type(el, "urgente mañana");
    enter(el);
    expect(input(el).value).toBe("urgente mañana");
    expect($(el, ".nx-tasks__need").textContent).toBe("Escribe qué tienes que hacer.");
    expect(ev.commits).toEqual([]);
    expect(el.items).toHaveLength(ITEMS.length);
  });

  it("«Deshacer» quita lo creado, no envía nada y devuelve lo escrito al campo", async () => {
    const el = mount('undo="60"');
    const ev = events(el);
    type(el, "Comprar tóner el viernes");
    enter(el);
    const id = groupIds(el, "soon").find((x) => x !== "d")!;
    $<HTMLButtonElement>(el, ".nx-tasks__undo").click();
    expect(row(el, id)).toBeNull();
    expect(ev.undos).toEqual([{ key: id, type: "create" }]);
    expect(input(el).value).toBe("Comprar tóner el viernes");
    expect(say(el)).toBe("Se deshizo: «Comprar tóner»");
    await sleep(100);
    expect(ev.commits).toEqual([]);
  });

  it("undo=0: sale de una vez, sin «Deshacer»", () => {
    const el = mount('undo="0"');
    const ev = events(el);
    type(el, "Ordenar facturas");
    enter(el);
    expect(ev.commits).toHaveLength(1);
    expect(say(el)).toBe("Agregada a tu día: «Ordenar facturas»");
    expect($(el, ".nx-tasks__undo").hidden).toBe(true);
  });

  it("«Más opciones» lleva el borrador (cancelable) y la URL con lo escrito", () => {
    const el = mount('options-href="/pendientes/nueva"');
    const got: TasksOptionsDetail[] = [];
    el.addEventListener("nx-tasks-options", (e) => (got.push(e.detail), e.preventDefault()));
    type(el, "Llamar a Laura mañana urgente");
    const a = $<HTMLAnchorElement>(el, ".nx-tasks__opts");
    expect(a.hidden).toBe(false);
    expect(a.textContent).toBe("Más opciones");
    expect(a.getAttribute("href")).toBe("/pendientes/nueva?title=Llamar%20a%20Laura&due=2026-10-20&urgent=1");
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    a.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(got).toEqual([{ draft: { title: "Llamar a Laura", due: "2026-10-20", urgent: true, people: [] } }]);
  });
});

describe("<nx-tasks>: dictar", () => {
  it("con `voice`, un <nx-voice> para el campo (solo el botón); lo que oye se ve en «Entendí»", async () => {
    expect(mount().querySelector("nx-voice")).toBeNull();
    const el = mount("voice");
    const v = await until(() => el.querySelector("nx-voice"));
    expect(v.getAttribute("for")).toBe(input(el).id);
    expect(v.getAttribute("layout")).toBe("button");
    v.dispatchEvent(new CustomEvent("nx-voice-partial", { bubbles: true, detail: { text: "llamar a laura" } }));
    expect($(el, ".nx-tasks__listen").textContent).toBe("Escuchando: llamar a laura");
    v.dispatchEvent(new CustomEvent("nx-voice-end", { bubbles: true, detail: { text: "", canceled: false } }));
    expect(el.querySelector(".nx-tasks__listen")).toBeNull();
    v.dispatchEvent(new CustomEvent("nx-voice-error", { bubbles: true, detail: { code: "no-speech", message: "No te entendí, intenta de nuevo." } }));
    expect($(el, ".nx-tasks__listen").textContent).toBe("No te entendí, intenta de nuevo.");
    // Lo dictado llega al campo con un `input` (con su punto final): se lee como lo escrito.
    type(el, "Llamar a Laura mañana.");
    expect(chips(el)).toEqual(["Llamar a Laura", "Para mí", "Vence mañana"]);
  });
});

describe("<nx-tasks>: marcar, deshacer y la cola", () => {
  it("marcar es instantáneo; va a «Hechas hoy», sale al final del tiempo y se reabre con el mismo botón", async () => {
    vi.useFakeTimers();
    const el = mount('undo="1000"');
    const ev = events(el);
    check(el, "b").focus();
    check(el, "b").click();
    expect(groupIds(el, "today")).toEqual(["c"]);
    expect(row(el, "b")!.closest("details")).toBeTruthy();
    expect(check(el, "b").getAttribute("aria-pressed")).toBe("true");
    expect($(el, "details.nx-tasks__done summary").textContent).toBe("Hechas hoy (2)");
    // La recién marcada va primero.
    expect([...el.querySelectorAll("details .nx-tasks__row[data-id]")].map((r) => (r as HTMLElement).dataset.id)).toEqual(["b", "g"]);
    expect(say(el)).toBe("Hecha: «Revisar la cotización»");
    // El foco pasa a la casilla que quedó en su lugar.
    expect(document.activeElement).toBe(check(el, "d"));
    expect([...el.querySelectorAll(".nx-tasks__counts li")].map((l) => l.textContent)).toContain("1 para hoy");
    vi.advanceTimersByTime(1000);
    expect(ev.commits).toEqual([{ key: expect.any(String), type: "done", id: "b", done: true }]);
    // Reabrir.
    $<HTMLDetailsElement>(el, "details.nx-tasks__done").open = true;
    check(el, "b").focus();
    check(el, "b").click();
    expect(groupIds(el, "today")).toEqual(["c", "b"]);
    expect(say(el)).toBe("De vuelta en tu lista: «Revisar la cotización»");
    expect(document.activeElement).toBe(check(el, "b"));
    vi.advanceTimersByTime(1000);
    expect(ev.commits[1]).toMatchObject({ type: "done", id: "b", done: false });
  });

  it("Ctrl+Z deshace lo último que todavía corre su tiempo (no lo escrito en el campo)", async () => {
    const el = mount('undo="5000"');
    const ev = events(el);
    check(el, "d").click();
    expect(row(el, "d")!.closest("details")).toBeTruthy();
    // En el campo con texto, Ctrl+Z es del campo.
    type(el, "algo");
    expect(key(input(el), "z", { ctrlKey: true })).toBe(true);
    expect(row(el, "d")!.closest("details")).toBeTruthy();
    type(el, "");
    expect(key(input(el), "z", { ctrlKey: true })).toBe(false);
    expect(groupIds(el, "soon")).toEqual(["d"]);
    expect(ev.undos).toEqual([{ key: expect.any(String), type: "done" }]);
    expect(key(el, "z", { metaKey: true })).toBe(true); // ya no hay nada que deshacer
    expect(ev.commits).toEqual([]);
  });

  it("un error de settle revierte el cambio y lo dice, sin «Deshacer»", () => {
    vi.useFakeTimers();
    const el = mount('undo="500"');
    const ev = events(el);
    check(el, "c").click();
    vi.advanceTimersByTime(500);
    const key0 = ev.commits[0].key;
    expect(row(el, "c")!.closest("details")).toBeTruthy();
    expect(el.settle(key0, { error: "Sin conexión con el servidor" })).toBe(true);
    expect(groupIds(el, "today")).toEqual(["c", "b"]);
    expect(say(el)).toBe("No se guardó «Llamar al transportador»: Sin conexión con el servidor");
    expect($(el, ".nx-tasks__bar").hasAttribute("data-error")).toBe(true);
    expect($(el, ".nx-tasks__undo").hidden).toBe(true);
    const close = $<HTMLButtonElement>(el, ".nx-tasks__close");
    expect(close.hidden).toBe(false);
    expect(close.getAttribute("aria-label")).toBe("Cerrar el aviso");
    // No se va sola.
    vi.advanceTimersByTime(20000);
    expect(say(el)).toContain("No se guardó");
    close.click();
    expect(say(el)).toBe("");
    // Una creación que falla se va.
    type(el, "Comprar estibas");
    enter(el);
    vi.advanceTimersByTime(500);
    const k = ev.commits[1].key;
    expect(el.items.some((t) => t.title === "Comprar estibas")).toBe(true);
    el.settle(k, { error: "No hay presupuesto" });
    expect(el.items.some((t) => t.title === "Comprar estibas")).toBe(false);
    expect(say(el)).toBe("No se guardó «Comprar estibas»: No hay presupuesto");
  });

  it("marcar una que todavía se crea: la creación sale ya y la marca espera a que se confirme", () => {
    vi.useFakeTimers();
    const el = mount('undo="1000"');
    const ev = events(el);
    type(el, "Revisar el contrato");
    enter(el);
    const temp = groupIds(el, "none")[0];
    expect(ev.commits).toEqual([]);
    check(el, temp).click();
    // La creación sale de una vez (su «Deshacer» ya no aplica: ahora es el de la marca).
    expect(ev.commits).toEqual([{ key: temp, type: "create", title: "Revisar el contrato", urgent: false, people: [] }]);
    expect(say(el)).toBe("Hecha: «Revisar el contrato»");
    vi.advanceTimersByTime(1000);
    // La marca terminó su tiempo pero espera a la creación.
    expect(ev.commits).toHaveLength(1);
    el.settle(temp, { id: "srv-9" });
    expect(ev.commits[1]).toEqual({ key: expect.any(String), type: "done", id: "srv-9", done: true });
    expect(el.items.find((t) => t.id === "srv-9")).toMatchObject({ done: true });
  });

  it("lo que llega otra vez por `items` no borra lo pendiente; lo confirmado se suelta cuando llega", () => {
    vi.useFakeTimers();
    const el = mount('undo="1000"');
    const ev = events(el);
    type(el, "Llamar a Héctor");
    enter(el);
    const temp = groupIds(el, "none")[0];
    check(el, "a").click();
    // La app vuelve a pintar con lo de antes (un sondeo): lo nuevo y la marca siguen.
    el.items = ITEMS.map((t) => ({ ...t }));
    expect(row(el, temp)).toBeTruthy();
    expect(row(el, "a")!.closest("details")).toBeTruthy();
    // Y lo escrito en el campo tampoco se pierde.
    type(el, "a medio escribir");
    el.items = ITEMS.map((t) => ({ ...t }));
    expect(input(el).value).toBe("a medio escribir");
    vi.advanceTimersByTime(1000);
    const [create, done] = ev.commits;
    el.settle(create.key, { id: "srv-1" });
    el.settle(done.key, {});
    // Llega lo viejo otra vez (sin la nueva, con «a» sin hacer): lo confirmado se sostiene.
    el.items = ITEMS.map((t) => ({ ...t }));
    expect(el.items.filter((t) => t.title === "Llamar a Héctor")).toHaveLength(1);
    expect(el.items.find((t) => t.id === "a")?.done).toBe(true);
    // Llega con todo: sin duplicados.
    el.items = [{ id: "srv-1", title: "Llamar a Héctor" }, ...ITEMS.map((t) => (t.id === "a" ? { ...t, done: true } : { ...t }))];
    expect(el.items.filter((t) => t.title === "Llamar a Héctor")).toHaveLength(1);
    expect(el.querySelectorAll('.nx-tasks__row[data-id="srv-1"]')).toHaveLength(1);
    // Y después, lo que diga la app manda.
    el.items = ITEMS.map((t) => ({ ...t }));
    expect(el.items.find((t) => t.id === "a")?.done).toBeUndefined();
  });

  it("al salir del DOM (o cerrar la página) lo pendiente sale ya", () => {
    const el = mount('undo="60000"');
    const ev = events(el);
    type(el, "Revisar nómina");
    enter(el);
    check(el, "d").click();
    // La creación salió al marcar «d»; la marca, al desconectar.
    expect(ev.commits.map((c) => c.type)).toEqual(["create"]);
    el.remove();
    expect(ev.commits.map((c) => c.type)).toEqual(["create", "done"]);
    // pagehide hace lo mismo.
    const el2 = mount('undo="60000"');
    const ev2 = events(el2);
    check(el2, "c").click();
    dispatchEvent(new Event("pagehide"));
    expect(ev2.commits).toEqual([{ key: expect.any(String), type: "done", id: "c", done: true }]);
  });

  it("al salir, una marca sobre algo que todavía se crea sale con el id provisional (la key de la creación)", () => {
    const el = mount('undo="60000"');
    const ev = events(el);
    type(el, "Archivar facturas");
    enter(el);
    const temp = groupIds(el, "none")[0];
    check(el, temp).click();
    el.remove();
    expect(ev.commits).toEqual([
      { key: temp, type: "create", title: "Archivar facturas", urgent: false, people: [] },
      { key: expect.any(String), type: "done", id: temp, done: true },
    ]);
  });

  it("abrir una tarea, algo de otro módulo o lo pedido emite nx-tasks-open (cancelable)", () => {
    const el = mount();
    const got: TasksOpenDetail[] = [];
    el.addEventListener("nx-tasks-open", (e) => {
      got.push(e.detail);
      e.preventDefault();
    });
    const click = (a: Element) => {
      const e = new MouseEvent("click", { bubbles: true, cancelable: true });
      a.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(click($(row(el, "b")!, "a.nx-tasks__title"))).toBe(true);
    expect(click($(row(el, "l1")!, "a.nx-tasks__go"))).toBe(true);
    el.requests = [{ ...REQUESTS[1], href: "/pedidos/r2" }];
    expect(click($(row(el, "r2")!, "a.nx-tasks__title"))).toBe(true);
    expect(got.map((d) => [d.kind, d.item.id])).toEqual([
      ["task", "b"],
      ["link", "l1"],
      ["request", "r2"],
    ]);
  });
});

describe("<nx-tasks>: personas", () => {
  const PEOPLE = [
    { id: "u12", name: "Laura Gómez", detail: "Analista de compras" },
    { id: "u14", name: "Laura Restrepo", detail: "Tesorería" },
    { id: "u3", name: "Andrés Pérez", detail: "Comprador" },
    { id: "u9", name: "Daniela Henao" },
  ];
  function server() {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      const q = new URL(url, "http://localhost/").searchParams.get("q") ?? "";
      asked.push(q);
      const f = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      return new Response(JSON.stringify({ items: PEOPLE.filter((p) => f(p.name).includes(f(q))) }), { headers: { "Content-Type": "application/json" } });
    });
    return asked;
  }

  it("@ abre la lista (teclado), elegir pone a la persona y crear le pide la tarea", async () => {
    const asked = server();
    const el = mount('undo="60" people-source="/api/personas"');
    const ev = events(el);
    input(el).focus();
    type(el, "Revisar el contrato @and");
    const list = await until(() => el.querySelector<HTMLElement>('.nx-tasks__pick[role="listbox"]:not([hidden])'));
    expect(asked).toContain("and");
    expect(list.getAttribute("aria-label")).toBe("Personas");
    expect(input(el).getAttribute("aria-controls")).toBe(list.id);
    expect(input(el).getAttribute("aria-activedescendant")).toBe(list.querySelector('[aria-selected="true"]')!.id);
    expect(list.textContent).toContain("Andrés Pérez");
    key(input(el), "Enter");
    expect(input(el).value).toBe("Revisar el contrato @Andrés Pérez ");
    expect(list.hidden).toBe(true);
    // Enter eligió: no agregó.
    expect(el.requests).toHaveLength(REQUESTS.length);
    expect(chips(el)).toEqual(["Revisar el contrato", "Andrés Pérez", "Sin fecha"]);
    expect($(el, ".nx-tasks__for").textContent).toBe("Para Andrés Pérez");
    // Otra persona, con el mouse.
    type(el, "Revisar el contrato @Andrés Pérez @dan");
    const opt = await until(() => [...el.querySelectorAll<HTMLElement>(".nx-tasks__pick [role=option]")].find((o) => o.textContent!.includes("Daniela")));
    opt.click();
    type(el, `${input(el).value}mañana`);
    expect($(el, ".nx-tasks__for").textContent).toBe("Para Andrés Pérez y Daniela Henao · una tarea para cada uno");
    expect(chips(el)).toEqual(["Revisar el contrato", "Andrés Pérez", "Daniela Henao", "Vence mañana"]);
    enter(el);
    expect(say(el)).toBe("Le pediste «Revisar el contrato» a Andrés Pérez y Daniela Henao");
    const req = el.requests[0];
    expect(req).toMatchObject({ title: "Revisar el contrato", due: "2026-10-20", people: [{ name: "Andrés Pérez" }, { name: "Daniela Henao" }] });
    expect($(row(el, req.id)!, ".nx-tasks__who").textContent).toBe("0 de 2 hechas · faltan Andrés Pérez y Daniela Henao");
    // Ninguna tarea propia nueva.
    expect(el.items).toHaveLength(ITEMS.length);
    await until(() => ev.commits.length);
    expect(ev.commits[0]).toEqual({
      key: req.id,
      type: "create",
      title: "Revisar el contrato",
      due: "2026-10-20",
      urgent: false,
      people: [
        { id: "u3", name: "Andrés Pérez", detail: "Comprador" },
        { id: "u9", name: "Daniela Henao" },
      ],
    });
  });

  it("quitar a una persona de lo entendido deja su nombre como texto", async () => {
    server();
    const el = mount('people-source="/api/personas"');
    input(el).focus();
    type(el, "Llamar a @dani");
    await until(() => el.querySelector(".nx-tasks__pick [role=option]"));
    key(input(el), "Enter");
    expect(chips(el)).toEqual(["Llamar", "Daniela Henao", "Sin fecha"]);
    $<HTMLButtonElement>(el, '.nx-tasks__x[data-act="person"]').click();
    expect(input(el).value).toBe("Llamar a Daniela Henao ");
    expect(chips(el)).toEqual(["Llamar a Daniela Henao", "Para mí", "Sin fecha"]);
  });

  it("«para Nombre» con una sola coincidencia fuerte es esa persona; con dos, queda el texto", async () => {
    const asked = server();
    const el = mount('people-source="/api/personas"');
    type(el, "Enviar el acta para Daniela mañana");
    await until(() => $(el, ".nx-tasks__for"));
    expect(asked).toEqual(["daniela"]);
    expect(chips(el)).toEqual(["Enviar el acta", "Daniela Henao", "Vence mañana"]);
    type(el, "Enviar el acta para Laura");
    await until(() => asked.includes("laura"));
    await sleep(20);
    expect(chips(el)).toEqual(["Enviar el acta para Laura", "Para mí", "Sin fecha"]);
    type(el, "Enviar el acta para Laura Restrepo");
    await until(() => el.querySelector(".nx-tasks__for"));
    expect(chips(el)).toEqual(["Enviar el acta", "Laura Restrepo", "Sin fecha"]);
    // Ya se sabía: no se vuelve a preguntar.
    const n = asked.length;
    type(el, "Enviar el acta para Daniela");
    await sleep(300);
    expect(asked).toHaveLength(n);
    expect(chips(el)).toEqual(["Enviar el acta", "Daniela Henao", "Sin fecha"]);
  });

  it("sin people-source no se pregunta nada", async () => {
    const asked = server();
    const el = mount();
    input(el).focus();
    type(el, "Enviar el acta para Daniela @dan");
    await sleep(350);
    expect(asked).toEqual([]);
    expect(el.querySelector(".nx-tasks__pick")).toBeNull();
  });
});
