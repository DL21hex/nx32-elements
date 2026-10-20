/**
 * Galería: `<nx-tasks>`, el día de un jefe de compras. Sus tareas (una vencida que le pidió Laura,
 * dos para hoy, la semana y una hecha), lo que otros módulos esperan de él (una firma, una
 * aprobación, una lectura) y lo que él pidió (una cotización a tres personas, un acta a una).
 *
 * La API es de mentira y vive en esta pestaña (`addDemoRoute("/demo/tasks", …)`): las personas para
 * el `@` y el «para Nombre», y `POST /demo/tasks/guardar`, que contesta a los ~400 ms con un `id`
 * (o, con «El servidor rechaza el próximo cambio», con un error). La demo escucha
 * `nx-tasks-commit`, guarda y contesta con `settle(key, …)`. Las fechas se arman alrededor de hoy.
 */
import "../src/components/tasks/index";
import type { NxTasks, TaskItem, TaskLink, TaskRequest } from "../src/components/tasks/index";
import { isoOf, todayOf } from "../src/core/days";
import { addDemoRoute, type DemoOut } from "./demo-api";

const PEOPLE = [
  { id: "u12", name: "Laura Gómez", detail: "Analista de compras" },
  { id: "u14", name: "Laura Restrepo", detail: "Tesorería" },
  { id: "u3", name: "Andrés Pérez", detail: "Comprador · Planta Malambo" },
  { id: "u9", name: "Daniela Henao", detail: "Almacén" },
  { id: "u21", name: "Héctor Galeano", detail: "Mantenimiento" },
  { id: "u22", name: "Ana María Rincón", detail: "Producción" },
  { id: "u23", name: "Walber Pumarejo", detail: "Logística" },
];

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const day = (n: number) => isoOf(todayOf() + n);

function seed(): { items: TaskItem[]; links: TaskLink[]; requests: TaskRequest[] } {
  return {
    items: [
      { id: "t1", title: "Enviar el informe de cartera de septiembre", due: day(-3), by: "Laura Gómez" },
      { id: "t2", title: "Llamar a Transportes Rivera por la entrega en Cartagena", due: day(0), urgent: true },
      { id: "t3", title: "Revisar la cotización de Aceros del Caribe", due: day(0), href: "#/tasks" },
      { id: "t4", title: "Preparar la reunión de seguimiento con proveedores", due: day(1) },
      { id: "t5", title: "Renovar la póliza del camión TKR-512", due: day(4) },
      { id: "t6", title: "Inventario de fin de mes en la bodega de Itagüí", due: day(14) },
      { id: "t7", title: "Organizar el archivo de facturas" },
      { id: "t8", title: "Pagar el arriendo de la bodega", due: day(0), done: true },
    ],
    links: [
      { id: "l1", title: "Orden de compra OC-2291 · Aceros del Caribe", kind: "Firma", tone: "warning", meta: "Compras · desde ayer", action: "Firmar", href: "#/tasks" },
      { id: "l2", title: "Vacaciones de Héctor Galeano (5 días)", kind: "Aprobación", tone: "info", meta: "Talento humano · hace 2 días", action: "Revisar", href: "#/tasks" },
      { id: "l3", title: "Política de viáticos 2026", kind: "Lectura", meta: "Calidad", action: "Leer", href: "#/tasks", newTab: true },
    ],
    requests: [
      { id: "r1", title: "Cotizar 200 estibas de 120×100", due: day(-1), people: [{ name: "Laura Gómez", done: true }, { name: "Héctor Galeano", done: true }, { name: "Andrés Pérez" }], href: "#/tasks" },
      { id: "r2", title: "Firmar el acta de entrega del montacargas", people: [{ name: "Daniela Henao" }] },
      { id: "r3", title: "Actualizar los datos de contacto de los proveedores", due: day(2), people: [{ name: "Ana María Rincón", done: true }, { name: "Walber Pumarejo" }] },
    ],
  };
}

// ---------------------------------------------------------------- el servidor de mentira

let fail = false;
let seq = 100;
const reply = (out: DemoOut, body: unknown, status = 200) => {
  out.status(status);
  out.type("application/json");
  out.end(JSON.stringify(body));
};

// Al importar el módulo (como las demás demos con API).
addDemoRoute("/demo/tasks", async (req, out) => {
  const path = req.url.pathname.slice(req.url.pathname.indexOf("/demo/tasks") + "/demo/tasks".length);
  if (path === "/personas") {
    await sleep(120);
    const q = fold(req.url.searchParams.get("q") ?? "");
    return reply(out, { items: PEOPLE.filter((p) => fold(`${p.name} ${p.detail}`).includes(q)).slice(0, 6) });
  }
  if (path === "/guardar" && req.method === "POST") {
    await sleep(400);
    if (fail) {
      fail = false;
      document.querySelector('[data-sim="tasks-reject"]')?.setAttribute("aria-checked", "false");
      return reply(out, { message: "El servidor rechazó el cambio (ejemplo)" }, 422);
    }
    const body = JSON.parse(req.body || "{}") as { type?: string };
    return reply(out, body.type === "create" ? { id: `srv-${++seq}`, href: "#/tasks" } : { ok: true });
  }
  reply(out, { message: "No existe" }, 404);
});

/** Monta la demo: los datos, guardar cada cambio y contestar con `settle`, el registro de eventos. */
export function mountTasksDemo(root: HTMLElement): void {
  const el = root.querySelector<NxTasks>("#tasks-demo")!;
  const empty = root.querySelector<NxTasks>("#tasks-empty")!;
  const form = root.querySelector<NxTasks>("#tasks-form")!;
  const fill = () => {
    const s = seed();
    el.items = s.items;
    el.links = s.links;
    el.requests = s.requests;
    form.items = s.items.slice(0, 3);
  };
  fill();
  root.querySelector("#tasks-reset")?.addEventListener("click", fill);

  const log = root.querySelector<HTMLOListElement>("#tasks-log")!;
  const add = (text: string) => {
    const li = document.createElement("li");
    li.textContent = text;
    log.prepend(li);
    while (log.children.length > 8) log.lastElementChild!.remove();
  };
  for (const t of [el, empty, form]) {
    t.addEventListener("nx-tasks-commit", async (e) => {
      const d = e.detail;
      add(d.type === "create" ? `nx-tasks-commit → crear «${d.title}»${d.due ? `, vence ${d.due}` : ""}${d.urgent ? ", urgente" : ""}${d.people.length ? `, para ${d.people.map((p) => p.name).join(" y ")}` : ""}` : `nx-tasks-commit → ${d.done ? "hecha" : "reabierta"} ${d.id}`);
      const res = await fetch("/demo/tasks/guardar", { method: "POST", body: JSON.stringify(d), headers: { "Content-Type": "application/json" } });
      const body = (await res.json()) as { id?: string; href?: string; message?: string };
      const result = res.ok ? { id: body.id, href: body.href } : { error: body.message ?? `HTTP ${res.status}` };
      t.settle(d.key, result);
      add(`settle("${d.key.slice(0, 8)}…", ${JSON.stringify(result)})`);
    });
    t.addEventListener("nx-tasks-undo", (e) => add(`nx-tasks-undo → ${e.detail.type}: no se envía nada`));
    t.addEventListener("nx-tasks-open", (e) => {
      e.preventDefault();
      add(`nx-tasks-open → ${e.detail.kind}: «${e.detail.item.title}» (la app navegaría)`);
    });
    t.addEventListener("nx-tasks-options", (e) => {
      e.preventDefault();
      add(`nx-tasks-options → ${JSON.stringify(e.detail.draft)} (la app abriría el formulario completo)`);
    });
  }

  const sw = root.querySelector<HTMLButtonElement>('[data-sim="tasks-reject"]')!;
  sw.addEventListener("click", () => {
    fail = sw.getAttribute("aria-checked") !== "true";
    sw.setAttribute("aria-checked", String(fail));
  });
  // Escritorio o celular: el mismo componente en 390 px.
  const stage = root.querySelector<HTMLElement>(".tasks-stage")!;
  for (const b of root.querySelectorAll<HTMLButtonElement>("[data-width]")) {
    b.addEventListener("click", () => {
      stage.dataset.width = b.dataset.width!;
      for (const o of root.querySelectorAll("[data-width]")) o.setAttribute("aria-pressed", String(o === b));
    });
  }
}
