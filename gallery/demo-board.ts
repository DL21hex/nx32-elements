/**
 * Galería: «Tablero BI», la demo de `<nx-board>` con todas sus piezas. Un reporte de incapacidades
 * de una empresa inventada (datos inventados, con semilla), enero a septiembre de 2026 frente al
 * mismo periodo de 2025: cifras con su cambio, días por mes apilados por tipo con la proyección
 * del trimestre que viene, la lectura, ausentismo por área y mes, lo que hay que hacer, los
 * diagnósticos (Pareto), el día en que empiezan, quién paga, la cartera por recobrar y el detalle.
 *
 * Todo clic en una marca filtra el tablero. Cada panel se calcula con `panel.filters` (los filtros
 * del tablero menos su propia dimensión) y `matchesFilters`, como haría una app sin backend.
 */
import "../src/components/board/index";
import "../src/components/stats/index";
import "../src/components/trend/index";
import "../src/components/heatmap/index";
import "../src/components/bars/index";
import "../src/components/parts/index";
import "../src/components/phases/index";
import "../src/components/alerts/index";
import "../src/components/insights/index";
import "../src/components/grid/index";
import "../src/components/dialog/index";
import { matchesFilters } from "../src/components/board/index";
import type { BoardDimension, NxBoard, NxBoardPanel } from "../src/components/board/index";
import type { AlertItem, NxAlerts } from "../src/components/alerts/index";
import type { BarItem, NxBars } from "../src/components/bars/index";
import type { NxHeatmap } from "../src/components/heatmap/index";
import type { InsightItem, NxInsights } from "../src/components/insights/index";
import type { NxParts } from "../src/components/parts/index";
import type { NxPhases, Phase } from "../src/components/phases/index";
import type { NxStats, StatItem } from "../src/components/stats/index";
import type { NxTrend, TrendSeries } from "../src/components/trend/index";
import type { GridColumn, NxGrid } from "../src/components/grid/index";
import type { NxDialog } from "../src/components/dialog/index";

interface Row extends Record<string, unknown> {
  id: number;
  year: number;
  mes: string;
  name: string;
  area: string;
  tipo: string;
  cie: string;
  dow: string;
  dias: number;
  valor: number;
  emp: number;
  ent: string;
  entPart: number;
  est: string;
  age: number;
}

const TIPOS: [string, string][] = [["EG", "Enfermedad general"], ["AT", "Accidente de trabajo"], ["EL", "Enfermedad laboral"]];
const AREAS: { id: string; name: string; hc: number; rate: number; at: number; el: number; sal: number }[] = [
  { id: "prod", name: "Producción", hc: 420, rate: 0.1, at: 0.13, el: 0.02, sal: 2_100_000 },
  { id: "emp", name: "Empacadoras", hc: 310, rate: 0.115, at: 0.05, el: 0.08, sal: 1_800_000 },
  { id: "log", name: "Logística", hc: 180, rate: 0.1, at: 0.1, el: 0.02, sal: 2_200_000 },
  { id: "adm", name: "Administración", hc: 95, rate: 0.05, at: 0.01, el: 0.01, sal: 4_200_000 },
];
const AREA = Object.fromEntries(AREAS.map((a) => [a.id, a]));
const DX: Record<string, [string, number, number]> = {
  "J06.9": ["Infección respiratoria aguda", 1, 3],
  "A09": ["Gastroenteritis", 1, 3],
  "M54.5": ["Lumbago", 2, 10],
  "K29.7": ["Gastritis", 1, 3],
  "F41.1": ["Ansiedad generalizada", 5, 30],
  "M51.1": ["Trastorno de disco lumbar", 15, 60],
  "S93.4": ["Esguince de tobillo", 5, 20],
  "S61.0": ["Herida de dedo", 3, 10],
  "G56.0": ["Túnel carpiano", 10, 30],
  "M75.1": ["Manguito rotador", 15, 45],
};
const BY_TIPO: Record<string, [string, number][]> = {
  EG: [["J06.9", 18], ["A09", 10], ["M54.5", 12], ["K29.7", 6], ["F41.1", 3], ["M51.1", 1]],
  AT: [["S93.4", 5], ["S61.0", 6]],
  EL: [["G56.0", 4], ["M75.1", 3]],
};
const EPS: [string, number, number][] = [["Sura", 28, 45], ["Sanitas", 18, 62], ["Nueva EPS", 16, 138], ["Compensar", 14, 70], ["Salud Total", 12, 84]];
const PAYS: Record<string, number> = { ...Object.fromEntries(EPS.map(([n, , d]) => [n, d])), "ARL Sura": 38 };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS = Array.from({ length: 9 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);
// Temporadas de lluvia (abril-mayo, octubre-noviembre): más infecciones respiratorias.
const SEASON = [0.95, 1, 1.05, 1.2, 1.25, 1, 0.95, 0.95, 1, 1.2, 1.25, 0.85];
const NOMBRES = ["Laura Gómez", "Andrés Pardo", "Marcela Ruiz", "Camilo Arango", "Daniela Henao", "Felipe Zapata", "Juliana Cardona", "Santiago Montoya", "Paola Rincón", "Wilson Murcia", "Leidy Ortiz", "Fredy Ospina", "Angie Bohórquez", "Héctor Villamil"];
const AGES = [{ id: "0-30", label: "0 a 30 días" }, { id: "31-60", label: "31 a 60" }, { id: "61-90", label: "61 a 90" }, { id: "90+", label: "Más de 90" }];

const DIMENSIONS: BoardDimension[] = [
  { id: "tipo", label: "Tipo", values: Object.fromEntries(TIPOS) },
  { id: "area", label: "Área", values: Object.fromEntries(AREAS.map((a) => [a.id, a.name])) },
  { id: "mes", label: "Mes", values: Object.fromEntries(MONTHS.map((m, i) => [m, `${MES[i]} 2026`])) },
  { id: "cie", label: "Diagnóstico", values: Object.fromEntries(Object.entries(DX).map(([k, v]) => [k, `${k} · ${v[0]}`])), sensitive: true },
  { id: "dow", label: "Empieza", values: { 1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado" } },
  { id: "ent", label: "Entidad" },
  { id: "est", label: "Recobro" },
];

function data(): Row[] {
  let seed = 20261012;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const wpick = <T,>(items: [T, number][]): T => {
    let x = rnd() * items.reduce((s, [, w]) => s + w, 0);
    for (const [v, w] of items) if ((x -= w) <= 0) return v;
    return items[items.length - 1][0];
  };
  const rows: Row[] = [];
  for (const year of [2025, 2026]) {
    for (let m = 0; m < 9; m++) {
      for (const a of AREAS) {
        const growth = year === 2026 ? (a.id === "emp" ? 1.3 : 1.04) : 1;
        const n = Math.round(a.hc * a.rate * SEASON[m] * growth * (0.85 + rnd() * 0.3));
        for (let k = 0; k < n; k++) {
          const u = rnd();
          const tipo = u < a.at ? "AT" : u < a.at + a.el ? "EL" : "EG";
          const cie = wpick(BY_TIPO[tipo].map(([c, w]) => [c, c === "J06.9" ? w * SEASON[m] ** 4 : w] as [string, number]));
          const [, lo, hi] = DX[cie];
          const dias = lo + Math.floor((hi - lo + 1) * rnd() ** 1.7);
          const dow = tipo === "EG" && dias <= 3 && rnd() < 0.12 ? "1" : String(1 + Math.floor(rnd() * 6));
          const daily = (a.sal * (0.85 + rnd() * 0.3)) / 30;
          const valor = Math.round(daily * dias * (tipo === "EG" ? 2 / 3 : 1));
          const emp = tipo === "EG" ? Math.round(daily * Math.min(2, dias) * (2 / 3)) : 0;
          const ent = tipo === "EG" ? wpick(EPS.map(([e, w]) => [e, w] as [string, number])) : "ARL Sura";
          const age = (8 - m) * 30 + Math.floor(rnd() * 30);
          const paid = age > PAYS[ent] * (0.7 + rnd() * 0.6);
          const est = valor - emp <= 0 ? "No aplica" : paid ? (rnd() < 0.06 ? "Glosado" : "Pagado") : age > 30 && rnd() < 0.18 ? "Sin radicar" : "Radicado";
          rows.push({ id: rows.length + 1, year, mes: `${year}-${String(m + 1).padStart(2, "0")}`, name: NOMBRES[Math.floor(rnd() * NOMBRES.length)], area: a.id, tipo, cie, dow, dias, valor, emp, ent, entPart: valor - emp, est, age });
        }
      }
    }
  }
  return rows;
}

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const pct = (x: number) => `${nf.format(x * 100)} %`;
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const lastYear = (m: string) => `2025${m.slice(4)}`;

export function mountBoardDemo(root: HTMLElement): void {
  const ROWS = data();
  const board = root.querySelector<NxBoard>("#bd-board")!;
  const log = root.querySelector<HTMLOListElement>("#bd-log")!;
  const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const panel = (id: string) => $<NxBoardPanel>(`#${id}`);
  /** Las filas de 2026 (o de 2025 con `prev`) que pide el panel: sin su propia dimensión. */
  const rowsFor = (p: NxBoardPanel, prev = false) => {
    const f = p.filters;
    const meses = f.mes;
    const g = { ...f };
    delete g.mes;
    return ROWS.filter((r) => r.year === (prev ? 2025 : 2026) && matchesFilters(r, g) && (!meses || meses.includes(prev ? `2026${r.mes.slice(4)}` : r.mes)));
  };
  const headcount = () => {
    const areas = board.filters.area;
    return sum(AREAS.filter((a) => !areas || areas.includes(a.id)).map((a) => a.hc));
  };
  board.dimensions = DIMENSIONS;

  const grid = $<NxGrid>("#bd-grid");
  const cols: GridColumn[] = [
    { key: "name", label: "Persona", width: 170 },
    { key: "areaName", label: "Área", width: 140 },
    { key: "tipoName", label: "Tipo", width: 170 },
    { key: "dx", label: "Diagnóstico", width: 240 },
    { key: "mesName", label: "Mes", width: 90 },
    { key: "dias", label: "Días", type: "number", width: 70 },
    { key: "valor", label: "Valor", type: "money", width: 120 },
    { key: "est", label: "Recobro", width: 120 },
  ];
  grid.columns = cols;

  function paint(): void {
    // ---------- Cifras (todos los filtros), con el cambio frente al mismo periodo de 2025.
    const now = rowsFor(panel("bd-p-stats")), before = rowsFor(panel("bd-p-stats"), true);
    const months = board.filters.mes?.length ?? MONTHS.length;
    const hc = headcount();
    const days = (rs: Row[]) => sum(rs.map((r) => r.dias));
    const aus = (rs: Row[]) => days(rs) / (hc * 30 * months);
    const ch = (a: number, b: number) => (b ? (a - b) / b : 0);
    const label = "frente a 2025";
    const items: StatItem[] = [
      { id: "aus", label: "Ausentismo por causa médica", value: aus(now), format: "percent", delta: { value: aus(now) - aus(before), format: "points", label }, trend: MONTHS.map((m) => days(now.filter((r) => r.mes === m)) / (hc * 30)), goal: 0.02, note: "Meta 2 % · Res. 0312" },
      { id: "dias", label: "Días de incapacidad", value: days(now), delta: { value: ch(days(now), days(before)), label } },
      { id: "n", label: "Incapacidades", value: now.length, delta: { value: ch(now.length, before.length), label }, note: `${nf.format(days(now) / (now.length || 1))} días en promedio` },
      { id: "valor", label: "Valor pagado", value: sum(now.map((r) => r.valor)), format: "money", currency: "COP", delta: { value: ch(sum(now.map((r) => r.valor)), sum(before.map((r) => r.valor))), label }, note: `La empresa asume ${pct(sum(now.map((r) => r.emp)) / (sum(now.map((r) => r.valor)) || 1))}` },
    ];
    $<NxStats>("#bd-stats").items = items;

    // ---------- Días por mes apilados por tipo, 2025 como referencia y el trimestre que viene.
    const pm = rowsFor(panel("bd-p-mes")), pmPrev = rowsFor(panel("bd-p-mes"), true);
    const series: TrendSeries[] = TIPOS.map(([t, name]) => ({ id: t, label: name, kind: "bar", points: MONTHS.map((m) => ({ x: m, y: days(pm.filter((r) => r.mes === m && r.tipo === t)) })) }));
    series.push({ id: "prev", label: "2025", kind: "line", muted: true, points: MONTHS.map((m) => ({ x: m, y: days(pmPrev.filter((r) => r.mes === lastYear(m))) })) });
    const recent = sum(MONTHS.slice(-3).map((m) => days(pm.filter((r) => r.mes === m)))) / 3;
    series.push({ id: "proy", label: "Proyección", kind: "bar", points: [9, 10, 11].map((i) => {
      const y = Math.round((recent * SEASON[i]) / SEASON[8]);
      return { x: `2026-${i + 1}`, y, forecast: true, low: Math.round(y * 0.86), high: Math.round(y * 1.14) };
    }) });
    $<NxTrend>("#bd-trend").series = series;

    // ---------- Ausentismo por área y mes.
    const ph = rowsFor(panel("bd-p-heat")), phPrev = rowsFor(panel("bd-p-heat"), true);
    const hm = $<NxHeatmap>("#bd-heat");
    hm.columns = MONTHS.map((m, i) => ({ id: m, label: MES[i] }));
    hm.rows = AREAS.map((a) => {
      const total = days(ph.filter((r) => r.area === a.id)) / (a.hc * 30 * MONTHS.length);
      const prev = days(phPrev.filter((r) => r.area === a.id)) / (a.hc * 30 * MONTHS.length);
      return { id: a.id, label: a.name, note: nf.format(a.hc), total, delta: total - prev };
    });
    hm.values = AREAS.map((a) => MONTHS.map((m) => days(ph.filter((r) => r.area === a.id && r.mes === m)) / (a.hc * 30)));

    // ---------- Diagnósticos (Pareto).
    const pd = rowsFor(panel("bd-p-dx"));
    const dx: BarItem[] = Object.keys(DX).map((c) => {
      const rs = pd.filter((r) => r.cie === c);
      return { id: c, code: c, label: DX[c][0], value: days(rs), note: `${rs.length} incapacidades` };
    }).filter((b) => b.value > 0).sort((a, b) => b.value - a.value);
    $<NxBars>("#bd-dx").items = dx;

    // ---------- Día en que empiezan (las de 1 a 3 días).
    const pw = rowsFor(panel("bd-p-dow")).filter((r) => r.dias <= 3);
    const dows: [string, string][] = [["1", "lun"], ["2", "mar"], ["3", "mié"], ["4", "jue"], ["5", "vie"], ["6", "sáb"]];
    const dow = $<NxBars>("#bd-dow");
    dow.items = dows.map(([d, l]) => ({ id: d, label: l, value: pw.filter((r) => r.dow === d).length }));
    dow.reference = String(pw.length / 6);

    // ---------- Quién paga.
    const pp = rowsFor(panel("bd-p-pay"));
    const eps = sum(pp.filter((r) => r.tipo === "EG").map((r) => r.entPart));
    const arl = sum(pp.filter((r) => r.tipo !== "EG").map((r) => r.valor));
    $<NxParts>("#bd-pay").items = [
      { id: "emp", label: "Empresa", value: sum(pp.map((r) => r.emp)), note: "Días 1 y 2 de enfermedad general", slot: 6 },
      { id: "eps", label: "EPS", value: eps, note: "Enfermedad general desde el día 3", slot: 7 },
      { id: "arl", label: "ARL", value: arl, note: "Accidente de trabajo y enfermedad laboral", slot: 3 },
    ];

    // ---------- Cartera por recobrar, por entidad y antigüedad.
    const pc = rowsFor(panel("bd-p-ent")).filter((r) => r.est === "Radicado" || r.est === "Sin radicar" || r.est === "Glosado");
    const ents = [...new Set(pc.map((r) => r.ent))];
    const bucket = (age: number) => (age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3);
    const cart = $<NxBars>("#bd-ent");
    cart.series = AGES;
    cart.items = ents.map((e) => {
      const rs = pc.filter((r) => r.ent === e);
      const parts = [0, 0, 0, 0];
      for (const r of rs) parts[bucket(r.age)] += r.entPart;
      return { id: e, label: e, value: sum(parts), parts, extra: `paga en ${PAYS[e]} d`, note: `${rs.length} incapacidades` };
    }).sort((a, b) => b.value - a.value);

    // ---------- Lectura.
    const ins: InsightItem[] = [];
    const dNow = days(now), dPrev = days(before);
    if (dPrev) {
      const byArea = AREAS.map((a) => [a, days(now.filter((r) => r.area === a.id)) - days(before.filter((r) => r.area === a.id))] as const).sort((x, y) => y[1] - x[1]);
      const up = dNow >= dPrev;
      const top = byArea[0];
      const share = sum(byArea.map(([, d]) => Math.max(0, d)));
      ins.push({ id: "cambio", tone: up ? "bad" : "good", icon: up ? "up" : "down", text: `Los días de incapacidad **${up ? "subieron" : "bajaron"} ${pct(Math.abs(ch(dNow, dPrev)))}** frente a 2025.${up && share && !board.filters.area ? ` ${top[0].name} explica **${pct(Math.max(0, top[1]) / share)}** del aumento.` : ""}`, action: board.filters.area ? undefined : { label: `Ver ${top[0].name}`, filter: `area:${top[0].id}` } });
    }
    const short = now.filter((r) => r.tipo === "EG" && r.dias <= 3);
    if (short.length > 10) ins.push({ id: "lunes", icon: "calendar", tone: "neutral", text: `De las incapacidades de 1 a 3 días, el **${pct(short.filter((r) => r.dow === "1").length / short.length)}** empieza un lunes. Parejo sería 17 %.`, action: { label: "Ver las de los lunes", filter: "dow:1" } });
    if (dx.length > 2) {
      let acc = 0, k = 0;
      const tot = sum(dx.map((b) => b.value));
      while (k < dx.length && acc / tot < 0.5) acc += dx[k++].value;
      ins.push({ id: "pareto", icon: "list", text: `**${k} de ${dx.length} diagnósticos** suman el ${pct(acc / tot)} de los días. El primero es ${dx[0].label.toLowerCase()}.`, action: { label: `Ver ${dx[0].code}`, filter: `cie:${dx[0].id}` } });
    }
    const slow = [...ents].sort((a, b) => PAYS[b] - PAYS[a])[0];
    if (slow) ins.push({ id: "pago", icon: "money", tone: PAYS[slow] > 90 ? "bad" : "neutral", text: `**${slow}** se demora ${PAYS[slow]} días en pagar un recobro; ARL Sura, ${PAYS["ARL Sura"]}.`, action: { label: `Ver ${slow}`, filter: `ent:${slow}` } });
    $<NxInsights>("#bd-insights").items = ins;

    // ---------- Para actuar.
    const sinRadicar = ROWS.filter((r) => r.year === 2026 && r.est === "Sin radicar" && matchesFilters(r, board.filtersFor("mes")));
    const glosados = ROWS.filter((r) => r.year === 2026 && r.est === "Glosado" && matchesFilters(r, board.filtersFor("mes")));
    const alerts: AlertItem[] = [
      { id: "wilson", severity: "critical", title: "Pasó el día 180", meta: "Día 197", text: "Wilson Cárdenas · Producción. Desde el día 181 paga el fondo de pensiones: radicar el cobro ante Colfondos.", action: { label: "Ver quién paga cada día" } },
      { id: "gloria", severity: "serious", title: "Se acerca al día 180", meta: "Día 178", text: "Gloria Pineda · Administración. Confirmar que la EPS envió el concepto de rehabilitación al fondo." },
      { id: "sin", severity: "serious", title: "Recobros sin radicar", meta: `${sinRadicar.length}`, text: `Incapacidades que terminaron y no se han radicado ante la entidad.`, action: { label: "Ver cuáles", filter: "est:Sin radicar" } },
      { id: "glosa", severity: "warning", title: "Recobros glosados", meta: `${glosados.length}`, text: "La entidad los devolvió: corregir y volver a radicar.", action: { label: "Ver cuáles", filter: "est:Glosado" } },
      { id: "angie", severity: "warning", title: "Se repite", meta: "3 en 90 días", text: "Angie Bohórquez · Empacadoras: J06.9, A09 y M54.5. Remitir a medicina laboral." },
    ];
    $<NxAlerts>("#bd-alerts").items = alerts;

    // ---------- Detalle por persona (se reserva con «Nómina» y un diagnóstico filtrado).
    const det = rowsFor(panel("bd-p-det")).slice(-400).reverse();
    grid.rows = det.map((r) => ({ ...r, areaName: AREA[r.area].name, tipoName: Object.fromEntries(TIPOS)[r.tipo], dx: board.restricted ? "Reservado" : `${r.cie} · ${DX[r.cie][0]}`, mesName: `${MES[Number(r.mes.slice(5)) - 1]} 2026` }));
  }

  // La ficha del caso: quién paga cada día de una incapacidad de 260 días que va en el día 197.
  const ficha = $<NxDialog>("#bd-ficha");
  const phases: Phase[] = [
    { from: 1, to: 2, label: "Empresa", note: "66,67 % del salario", slot: 6, value: 95_000 },
    { from: 3, to: 90, label: "EPS Sura", note: "66,67 % del salario", slot: 7, value: 4_200_000 },
    { from: 91, to: 180, label: "EPS Sura", note: "50 % del salario", slot: 7, value: 4_300_000 },
    { from: 181, to: 260, label: "Fondo de pensiones (Colfondos)", note: "50 % del salario, sin bajar del mínimo", slot: 4, value: 807_000 },
  ];
  const ph = $<NxPhases>("#bd-phases");
  ph.phases = phases;
  ph.ticks = [1, 90, 180, 260];
  $<NxAlerts>("#bd-alerts").addEventListener("nx-alerts-action", (e) => {
    if (e.detail.item.id === "wilson") void ficha.show();
  });

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
