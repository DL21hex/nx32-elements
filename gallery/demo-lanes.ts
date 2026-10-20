/**
 * Demo de `<nx-lanes>`: lo abierto de Talento Humano en ocho procesos (datos inventados, con
 * semilla). Cada 2,5 s algo se mueve, como un refresco de la app: una solicitud pasa de bandeja,
 * llega una nueva o se cierra una. El foco rota cada 10 s; al lado se pinta con `nx-lanes-spotlight`
 * y abajo se registra lo que dice `nx-lanes-change`.
 */
import "../src/components/lanes/index";
import type { Lane, LaneItem, NxLanes } from "../src/components/lanes/index";

const LANES: Lane[] = [
  { id: "abs", label: "Permisos", stages: [{ id: "jefe", label: "Jefe", other: true }, { id: "rev", label: "Revisar" }, { id: "eje", label: "Ejecutar" }] },
  { id: "vac", label: "Vacaciones", stages: [{ id: "jefe", label: "Jefe", other: true }, { id: "rev", label: "Revisar" }, { id: "apr", label: "Aprobar" }, { id: "eje", label: "Ejecutar" }] },
  {
    id: "inc",
    label: "Incapacidades",
    stages: [
      { id: "rev", label: "Revisar" },
      { id: "apr", label: "Aprobar" },
      { id: "eje", label: "Ejecutar" },
      { id: "rad", label: "Radicar" },
      { id: "rec", label: "Recobro EPS/ARL", other: true },
      { id: "pro", label: "Procesar" },
    ],
  },
  {
    id: "ret",
    label: "Retiros",
    stages: [
      { id: "env", label: "Por enviar" },
      { id: "rev", label: "Revisar" },
      { id: "liq", label: "Liquidar" },
      { id: "apr", label: "Aprobar liq." },
      { id: "cit", label: "Citar" },
      { id: "car", label: "Cargar liq." },
      { id: "pag", label: "Pagar" },
      { id: "rad", label: "Radicar dep." },
    ],
  },
  { id: "ces", label: "Cesantías", stages: [{ id: "rev", label: "Revisar" }, { id: "apr", label: "Aprobar" }, { id: "eje", label: "Ejecutar" }] },
  { id: "ben", label: "Beneficios", stages: [{ id: "rev", label: "Revisar" }, { id: "apr", label: "Aprobar" }, { id: "eje", label: "Ejecutar" }] },
  { id: "car", label: "Carpetas", stages: [{ id: "th", label: "Entregar TH" }, { id: "gdth", label: "Entregar GDTH" }, { id: "tra", label: "Transferir" }, { id: "rec", label: "Recibir" }] },
  { id: "con", label: "Contratación", stages: [{ id: "car", label: "Por cargar" }, { id: "sus", label: "Suspendidos" }] },
];

// Cuántas hay en cada bandeja por tramo (0-2 · 3-5 · 6-10 · más de 10 días), en el orden de LANES.
const SEED: number[][][] = [
  [[6, 3, 1, 0], [5, 2, 0, 0], [3, 1, 1, 0]],
  [[4, 3, 2, 2], [3, 2, 0, 0], [2, 2, 1, 0], [4, 1, 0, 1]],
  [[6, 3, 1, 0], [2, 1, 0, 0], [2, 2, 1, 1], [1, 2, 2, 3], [2, 3, 5, 14], [2, 1, 1, 2]],
  [[1, 0, 0, 1], [2, 1, 0, 0], [1, 2, 3, 4], [1, 1, 0, 1], [1, 0, 1, 0], [0, 1, 0, 0], [1, 1, 1, 0], [0, 0, 1, 1]],
  [[4, 2, 1, 0], [2, 1, 0, 0], [3, 0, 0, 0]],
  [[2, 1, 0, 0], [1, 1, 1, 0], [1, 0, 0, 0]],
  [[2, 1, 1, 0], [1, 1, 0, 1], [1, 0, 0, 0], [2, 1, 0, 0]],
  [[5, 3, 1, 0], [0, 1, 1, 2]],
];
const RANGES = [[0, 2], [3, 5], [6, 10], [11, 48]];

function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mountLanesDemo(root: HTMLElement): void {
  const lanes = root.querySelector<NxLanes>("#lanes-demo")!;
  const focus = root.querySelector<HTMLElement>("#lanes-focus")!;
  const log = root.querySelector<HTMLOListElement>("#lanes-log")!;
  const R = rng(20261020);
  const between = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
  let next = 4710;
  let items: LaneItem[] = [];
  SEED.forEach((lane, li) =>
    lane.forEach((tramos, si) =>
      tramos.forEach((n, t) => {
        for (let k = 0; k < n; k++) items.push({ id: next, label: `#${next++}`, lane: LANES[li].id, stage: LANES[li].stages[si].id, age: between(RANGES[t][0], RANGES[t][1]) });
      }),
    ),
  );

  lanes.labels = { item: "solicitud|solicitudes", oldest: "la más vieja {age}" };
  lanes.lanes = LANES;
  lanes.items = items;

  const laneOf = (id: string) => LANES.find((l) => l.id === id)!;
  const stageOf = (lane: string, stage: string) => laneOf(lane).stages.find((s) => s.id === stage)?.label ?? stage;
  const say = (text: string) => {
    const li = document.createElement("li");
    li.textContent = `${new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false })} · ${text}`;
    log.prepend(li);
    while (log.children.length > 6) log.lastElementChild!.remove();
  };
  lanes.addEventListener("nx-lanes-change", (e) => {
    for (const m of e.detail.moved) say(`${laneOf(m.lane).label} · #${m.id} pasó a ${stageOf(m.lane, m.to)}`);
    for (const a of e.detail.added) say(`${laneOf(a.lane).label} · #${a.id} nueva en ${stageOf(a.lane, a.stage)}`);
    for (const r of e.detail.removed) say(`${laneOf(r.lane).label} · #${r.id} cerrada`);
  });
  lanes.addEventListener("nx-lanes-spotlight", (e) => {
    const d = e.detail;
    if (!d.lane) {
      focus.textContent = "Ningún carril con atrasos.";
      return;
    }
    const where = d.oldest ? `La más vieja lleva ${Math.floor(d.oldest.age)} días en «${d.oldest.stageLabel}».` : "";
    const jam = d.jam && d.jam.late ? ` El atasco está en «${d.jam.label}»: ${d.jam.late} de ${d.jam.count} llevan más de 10 días.` : "";
    focus.textContent = `En foco (${d.index} de ${d.total}): ${d.label}, ${d.own} esperan a Talento Humano. ${where}${jam}`;
  });
  lanes.addEventListener("nx-lanes-stage", (e) => say(`nx-lanes-stage → ${laneOf(e.detail.lane).label} · ${stageOf(e.detail.lane, e.detail.stage)}`));
  lanes.addEventListener("nx-lanes-item", (e) => say(`nx-lanes-item → #${e.detail.id}`));

  // Un refresco cada 2,5 s con objetos nuevos, como haría la app. Lo joven se mueve más que lo atascado.
  // Al salir de la página (la galería reemplaza el contenido), se apaga solo.
  const timer = setInterval(() => {
    if (!lanes.isConnected) return clearInterval(timer);
    items = items.map((it) => ({ ...it }));
    if (R() < 0.3) {
      const lane = LANES[between(0, LANES.length - 1)];
      items.push({ id: next, label: `#${next++}`, lane: lane.id, stage: lane.stages[0].id, age: 0 });
    } else {
      const weights = items.map((it) => (it.age <= 5 ? 4 : it.age <= 10 ? 2 : 0.6));
      let r = R() * weights.reduce((a, b) => a + b, 0);
      const k = Math.max(0, weights.findIndex((w) => (r -= w) < 0));
      const it = items[k];
      const stages = laneOf(it.lane).stages;
      const at = stages.findIndex((s) => s.id === it.stage);
      if (at === stages.length - 1) items.splice(k, 1);
      else items[k] = { ...it, stage: stages[at + 1].id, age: 0 };
    }
    lanes.items = items;
  }, 2500);
}
