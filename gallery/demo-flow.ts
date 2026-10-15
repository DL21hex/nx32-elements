/**
 * Demo de `<nx-flow>`: 120 viajes de contenedores de un día de ejemplo (14 de octubre de 2026, con
 * semilla), por las ocho etapas de MSC. La inspección externa atiende de a uno: ahí se forma la cola.
 * El reloj de la demo arranca a las 15:10 y corre un minuto cada 3 s; «Buscar» atenúa con `highlight`.
 */
import "../src/components/flow/index";
import type { FlowItem, FlowStage, NxFlow } from "../src/components/flow/index";

const STAGES: FlowStage[] = [
  { id: "ruta", label: "En ruta a finca", note: "salieron, no han ingresado", limit: 120 },
  { id: "finca", label: "En finca, pend. insp. externa", limit: 120 },
  { id: "ext", label: "Insp. externa, pend. interna", limit: 45 },
  { id: "int", label: "Insp. interna, pend. cierre", limit: 60 },
  { id: "cierre", label: "Cerrado, pend. salida", limit: 60 },
  { id: "salida", label: "Saliendo finca → patio", limit: 120 },
  { id: "patio", label: "En patio", limit: 300 },
  { id: "puerto", label: "Despachado a puerto", end: true },
];

// 00:00 del 14-oct-2026 en Bogotá (UTC−5).
const DAY = Date.UTC(2026, 9, 14, 5, 0);

function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function trips(): { id: string; label: string; sub: string; meta: string; flag?: string; t: number[] }[] {
  const R = rng(20261014);
  const rnd = (a: number, b: number) => a + R() * (b - a);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(R() * xs.length)];
  const PREFIX = ["MSCU", "MEDU", "SZLU", "TGHU", "CAIU", "FSCU", "TRIU"];
  const FARMS = ["Ágape", "La Esperanza", "Zungo", "El Retiro", "Santa Rosa", "Guacamayal", "La Rita", "Tucurinca", "Orihueca"];
  const OPS = ["Agrovid", "DVS", "PIN"];
  const NAMES = ["Wilmer Ospino", "Luis Fontalvo", "Dairo Cantillo", "Éder Polo", "Yesid Barrios", "Rafael Mier", "Hernán Daza", "Óscar Rangel"];
  const L3 = "ABCDEFGHJKLMNPRSTUVWXYZ";
  const out: { id: string; label: string; sub: string; meta: string; flag?: string; t: number[] }[] = [];
  for (let i = 0; i < 120; i++) {
    const start = R() < 0.62 ? rnd(270, 620) : rnd(620, 1050);
    out.push({
      id: String(84000 + i),
      label: pick(PREFIX) + String(Math.floor(rnd(1000000, 9999999))),
      sub: `${pick([...L3])}${pick([...L3])}${pick([...L3])}${Math.floor(rnd(100, 999))} · ${pick(NAMES)}`,
      meta: `${pick(FARMS)} · ${pick(OPS)}`,
      flag: R() < 0.05 ? "Inspección con un «No»" : undefined,
      t: [start],
    });
  }
  for (const x of out) x.t[1] = x.t[0] + rnd(35, 100);
  let free = 390;
  for (const x of [...out].sort((a, b) => a.t[1] - b.t[1])) {
    const s = Math.max(x.t[1] + rnd(12, 30), free);
    x.t[2] = s;
    free = s + rnd(6, 14);
  }
  const DUR: [number, number][] = [[10, 45], [15, 55], [20, 90], [45, 110], [90, 330]];
  for (const x of out) for (let k = 0; k < DUR.length; k++) x.t[k + 3] = x.t[k + 2] + rnd(...DUR[k]);
  return out;
}

export function mountFlowDemo(root: HTMLElement): void {
  const flow = root.querySelector<NxFlow>("#flow-demo")!;
  const search = root.querySelector<HTMLInputElement>("#flow-q")!;
  const log = root.querySelector<HTMLOListElement>("#flow-log")!;
  const all = trips();
  let now = DAY + (15 * 60 + 10) * 60_000;

  const items = (): FlowItem[] =>
    all
      .map((x) => ({
        id: x.id,
        label: x.label,
        sub: x.sub,
        meta: x.meta,
        flag: x.flag,
        times: Object.fromEntries(STAGES.map((s, i) => [s.id, DAY + x.t[i] * 60_000 <= now ? new Date(DAY + x.t[i] * 60_000).toISOString() : null])),
      }))
      .filter((x) => Object.values(x.times).some(Boolean));

  flow.labels = { heading: "Flujo del día", item: "viaje|viajes", queue: "viajes en cola", ended: "despachados hoy" };
  flow.stages = STAGES;
  flow.start = new Date(DAY).toISOString();
  flow.end = new Date(DAY + 24 * 3_600_000).toISOString();
  const refresh = () => {
    flow.now = new Date(now).toISOString();
    flow.items = items();
  };
  refresh();

  const say = (text: string) => {
    const li = document.createElement("li");
    li.textContent = text;
    log.prepend(li);
    while (log.children.length > 4) log.lastElementChild!.remove();
  };
  flow.addEventListener("nx-flow-stage", (e) => say(`nx-flow-stage → ${e.detail.stage ?? "ninguna"}`));
  flow.addEventListener("nx-flow-item", (e) => say(`nx-flow-item → ${e.detail.item?.label ?? "ninguno"}`));
  flow.addEventListener("nx-flow-open", (e) => say(`nx-flow-open → ${e.detail.item.label} (la app abre su ficha)`));
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    flow.highlight = q ? all.filter((x) => `${x.label} ${x.sub} ${x.meta}`.toLowerCase().includes(q)).map((x) => x.id) : null;
  });

  // Un minuto de ejemplo cada 3 s, con datos nuevos (objetos nuevos), como un refresco de la app.
  // Al salir de la página (la galería reemplaza el contenido), el reloj de la demo se apaga solo.
  const timer = setInterval(() => {
    if (!flow.isConnected) return clearInterval(timer);
    now += 60_000;
    refresh();
  }, 3000);
}
