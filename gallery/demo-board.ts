/**
 * Galería: «Tablero», la demo de `<nx-board>`. Un reporte de incapacidades de una empresa
 * inventada (datos inventados, con semilla): cifras, días por mes con la leyenda por tipo,
 * diagnósticos, áreas, el día en que empiezan y el detalle por persona. Todo clic en una marca
 * filtra el tablero; cada panel se pide con `panel.filters` (sin su propia dimensión) y aquí se
 * calcula en el cliente con `matchesFilters`.
 */
import "../src/components/board/index";
import "../src/components/stats/index";
import "../src/components/grid/index";
import { filterSpec, matchesFilters } from "../src/components/board/index";
import type { BoardDimension, NxBoard, NxBoardPanel } from "../src/components/board/index";
import type { GridColumn, NxGrid } from "../src/components/grid/index";
import type { NxStats, StatItem } from "../src/components/stats/index";

interface Row extends Record<string, unknown> {
  id: number;
  name: string;
  area: string;
  tipo: string;
  cie: string;
  mes: string;
  dow: string;
  dias: number;
}

const TIPOS: [string, string][] = [["EG", "Enfermedad general"], ["AT", "Accidente de trabajo"], ["EL", "Enfermedad laboral"]];
const AREAS: [string, string][] = [["prod", "Producción"], ["emp", "Empacadoras"], ["log", "Logística"], ["adm", "Administración"]];
const DX: Record<string, string> = {
  "J06.9": "Infección respiratoria aguda",
  "A09": "Gastroenteritis",
  "M54.5": "Lumbago",
  "K29.7": "Gastritis",
  "S93.4": "Esguince de tobillo",
  "S61.0": "Herida de dedo",
  "G56.0": "Túnel carpiano",
  "M65.4": "Tenosinovitis de De Quervain",
};
const BY_TIPO: Record<string, [string, number, number][]> = {
  EG: [["J06.9", 1, 3], ["A09", 1, 3], ["M54.5", 2, 10], ["K29.7", 1, 3]],
  AT: [["S93.4", 5, 20], ["S61.0", 3, 10]],
  EL: [["G56.0", 10, 30], ["M65.4", 7, 21]],
};
const MESES = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep"];
const DOWS: [string, string][] = [["1", "lun"], ["2", "mar"], ["3", "mié"], ["4", "jue"], ["5", "vie"], ["6", "sáb"]];
const NOMBRES = ["Laura Gómez", "Andrés Pardo", "Marcela Ruiz", "Camilo Arango", "Daniela Henao", "Felipe Zapata", "Juliana Cardona", "Santiago Montoya", "Paola Rincón", "Wilson Murcia", "Leidy Ortiz", "Fredy Ospina"];

const DIMENSIONS: BoardDimension[] = [
  { id: "tipo", label: "Tipo", values: Object.fromEntries(TIPOS) },
  { id: "area", label: "Área", values: Object.fromEntries(AREAS) },
  { id: "mes", label: "Mes", values: Object.fromEntries(MESES.map((m, i) => [m, `${MES_CORTO[i]} 2026`])) },
  { id: "cie", label: "Diagnóstico", values: DX, sensitive: true },
  { id: "dow", label: "Empieza", values: { 1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado" } },
];

function data(): Row[] {
  let seed = 2026;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const rows: Row[] = [];
  for (let i = 0; i < 640; i++) {
    const u = rnd();
    const area = u < 0.35 ? "prod" : u < 0.65 ? "emp" : u < 0.88 ? "log" : "adm";
    const v = rnd();
    const tipo = v < (area === "prod" ? 0.14 : 0.05) ? "AT" : v < (area === "emp" ? 0.14 : 0.07) ? "EL" : "EG";
    const [cie, lo, hi] = pick(BY_TIPO[tipo]);
    const short = hi <= 3;
    rows.push({
      id: i + 1,
      name: pick(NOMBRES),
      area,
      tipo,
      cie,
      mes: MESES[Math.min(8, Math.floor(rnd() * 9.4))],
      dow: short && rnd() < 0.3 ? "1" : pick(DOWS)[0],
      dias: lo + Math.floor((hi - lo + 1) * rnd() ** 1.7),
    });
  }
  return rows;
}

const nf = new Intl.NumberFormat("es-CO");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const mark = (dim: string, value: string, label: string) => `data-nx-filter="${esc(filterSpec([[dim, value]]))}" data-nx-label="${esc(label)}"`;

function sumBy(rows: Row[], key: keyof Row, keys: string[]): Map<string, number> {
  const m = new Map(keys.map((k) => [k, 0]));
  for (const r of rows) m.set(String(r[key]), (m.get(String(r[key])) ?? 0) + r.dias);
  return m;
}

export function mountBoardDemo(root: HTMLElement): void {
  const ROWS = data();
  const board = root.querySelector<NxBoard>("#bd-board")!;
  const log = root.querySelector<HTMLOListElement>("#bd-log")!;
  const panel = (id: string) => root.querySelector<NxBoardPanel>(`#${id}`)!;
  const rowsFor = (p: NxBoardPanel) => ROWS.filter((r) => matchesFilters(r, p.filters));
  board.dimensions = DIMENSIONS;

  const stats = root.querySelector<NxStats>("#bd-stats")!;
  const grid = root.querySelector<NxGrid>("#bd-grid")!;
  const cols: GridColumn[] = [
    { key: "name", label: "Persona", width: 180 },
    { key: "areaName", label: "Área", width: 140 },
    { key: "tipoName", label: "Tipo", width: 170 },
    { key: "dx", label: "Diagnóstico", width: 240 },
    { key: "mesName", label: "Mes", width: 90 },
    { key: "dias", label: "Días", type: "number", width: 80 },
  ];
  grid.columns = cols;

  function paint(): void {
    // Cifras: todos los filtros.
    const all = rowsFor(panel("bd-p-stats"));
    const dias = all.reduce((s, r) => s + r.dias, 0);
    const porMes = MESES.map((m) => all.filter((r) => r.mes === m).reduce((s, r) => s + r.dias, 0));
    const items: StatItem[] = [
      { id: "dias", label: "Días de incapacidad", value: dias, note: "ene – sep 2026", trend: porMes },
      { id: "n", label: "Incapacidades", value: all.length, note: `${all.length ? (dias / all.length).toFixed(1).replace(".", ",") : 0} días en promedio` },
      { id: "at", label: "Por accidente de trabajo", value: all.filter((r) => r.tipo === "AT").length, note: "Reportadas a la ARL" },
      { id: "personas", label: "Personas", value: new Set(all.map((r) => r.name)).size, note: "con al menos una" },
    ];
    stats.items = items;

    // Días por mes, con la leyenda por tipo (el panel es dueño de «mes» y de «tipo»).
    const pm = rowsFor(panel("bd-p-mes"));
    const months = MESES.map((m, i) => {
      const per = TIPOS.map(([t]) => pm.filter((r) => r.mes === m && r.tipo === t).reduce((s, r) => s + r.dias, 0));
      return { m, i, per, total: per.reduce((a, b) => a + b, 0) };
    });
    const max = Math.max(1, ...months.map((x) => x.total));
    panel("bd-p-mes").querySelector(".bd-legend")!.innerHTML = TIPOS.map(([t, name], k) => `<button type="button" class="bd-lg" ${mark("tipo", t, name)}><i class="bd-sw bd-s${k + 1}"></i>${name} <b>${nf.format(months.reduce((s, x) => s + x.per[k], 0))}</b></button>`).join("");
    panel("bd-p-mes").querySelector(".bd-cols")!.innerHTML = months.map((x) => `<button type="button" class="bd-col" ${mark("mes", x.m, `${MES_CORTO[x.i]} 2026`)} title="${MES_CORTO[x.i]}: ${nf.format(x.total)} días"><span class="bd-stack">${x.per.map((v, k) => (v ? `<i class="bd-piece bd-s${k + 1}" style="block-size:${(v / max) * 100}%" ${mark("tipo", TIPOS[k][0], TIPOS[k][1])}></i>` : "")).reverse().join("")}</span><span class="bd-cl">${MES_CORTO[x.i]}</span></button>`).join("");

    // Barras horizontales: diagnósticos y áreas.
    const bars = (id: string, dim: keyof Row, keys: [string, string][], code = false) => {
      const sums = sumBy(rowsFor(panel(id)), dim, keys.map(([k]) => k));
      const list = keys.map(([k, name]) => [k, name, sums.get(k) ?? 0] as const).sort((a, b) => b[2] - a[2]);
      const top = Math.max(1, list[0]?.[2] ?? 1);
      panel(id).querySelector(".bd-bars")!.innerHTML = list.map(([k, name, v]) => `<button type="button" class="bd-bar" ${mark(String(dim), k, code ? `${k} · ${name}` : name)}><span class="bd-bl">${code ? `<code>${esc(k)}</code> ` : ""}${esc(name)}</span><b>${nf.format(v)}</b><span class="bd-track"><i style="inline-size:${(v / top) * 100}%"></i></span></button>`).join("");
    };
    bars("bd-p-dx", "cie", Object.entries(DX), true);
    bars("bd-p-area", "area", AREAS);

    // Día en que empiezan (las de 1 a 3 días).
    const pd = rowsFor(panel("bd-p-dow")).filter((r) => r.dias <= 3);
    const dc = DOWS.map(([d, l]) => [d, l, pd.filter((r) => r.dow === d).length] as const);
    const dmax = Math.max(1, ...dc.map((x) => x[2]));
    panel("bd-p-dow").querySelector(".bd-cols")!.innerHTML = dc.map(([d, l, v]) => `<button type="button" class="bd-col" ${mark("dow", d, DIMENSIONS[4].values![d])}><span class="bd-stack"><b class="bd-v">${v}</b><i class="bd-piece bd-s1" style="block-size:${(v / dmax) * 100}%"></i></span><span class="bd-cl">${l}</span></button>`).join("");

    // Detalle por persona (se reserva si quien mira no ve diagnósticos y hay uno filtrado).
    grid.rows = rowsFor(panel("bd-p-det")).map((r) => ({ ...r, areaName: Object.fromEntries(AREAS)[r.area], tipoName: Object.fromEntries(TIPOS)[r.tipo], dx: board.restricted ? "Reservado" : `${r.cie} · ${DX[r.cie]}`, mesName: `${MES_CORTO[MESES.indexOf(r.mes)]} 2026` }));
  }

  board.addEventListener("nx-board-change", (e) => {
    const { changed, reserved } = e.detail;
    const li = document.createElement("li");
    li.textContent = `nx-board-change → cambió ${changed.join(", ")}${reserved ? " · paneles personales reservados" : ""}`;
    log.prepend(li);
    while (log.children.length > 6) log.lastElementChild!.remove();
    paint();
  });
  for (const b of root.querySelectorAll<HTMLButtonElement>("[data-bd-role]")) {
    b.addEventListener("click", () => {
      board.restricted = b.dataset.bdRole === "nom";
      for (const x of root.querySelectorAll("[data-bd-role]")) x.setAttribute("aria-pressed", String(x === b));
      paint();
    });
  }
  paint();
}
