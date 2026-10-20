/**
 * La lógica de `<nx-lanes>` sin DOM: limpiar carriles y tramos, agrupar los elementos por bandeja,
 * resumir cada carril, ordenar los carriles para el foco, comparar dos cargas y la geometría de las
 * pilas de puntos. Todo puro, para probarlo en el host y para que un servidor calcule lo mismo.
 */
import type { Lane, LaneItem, LanesChangeDetail, LanesLabels, LaneStage, LaneTone } from "./types";

export const DEFAULT_BANDS: readonly number[] = [2, 5, 10];
/** Hasta tres cortes: cuatro colores. */
const MAX_BANDS = 3;

export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** «singular|plural» según `n`. */
export const plural = (text: string, n: number): string => text.split("|")[n === 1 ? 0 : 1] ?? text;

// ---------------------------------------------------------------- tramos

/**
 * Los cortes de los tramos, de menor a mayor, sin repetidos ni negativos, a lo sumo tres. Algo que no
 * es una lista da los de siempre (`[2, 5, 10]`); una lista vacía, un solo tramo.
 */
export function cleanBands(v: unknown): number[] {
  if (!Array.isArray(v)) return [...DEFAULT_BANDS];
  const out = [...new Set(v.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0))].sort((a, b) => a - b);
  return out.slice(0, MAX_BANDS);
}

/** El tramo de una edad: el primer corte que no supera, o el último tramo. */
export function bandOf(age: number, bands: readonly number[]): number {
  for (let i = 0; i < bands.length; i++) if (age <= bands[i]) return i;
  return bands.length;
}

/** El color de cada tramo: el último es el atraso, el anterior el aviso; los primeros, el acento. */
export function toneNames(bands: readonly number[]): LaneTone[] {
  const all: LaneTone[] = ["fresh", "ok", "warn", "late"];
  if (!bands.length) return ["ok"];
  return all.slice(all.length - (bands.length + 1));
}

/** Los textos de la leyenda: «0 a 2 días», «3 a 5», «6 a 10», «Más de 10». */
export function bandLabels(bands: readonly number[], L: LanesLabels, num: (n: number) => string): string[] {
  if (!bands.length) return [];
  const unit = plural(L.unit, 2);
  const int = bands.every(Number.isInteger);
  const out: string[] = [];
  bands.forEach((b, i) => {
    const from = i === 0 ? 0 : int ? bands[i - 1] + 1 : bands[i - 1];
    out.push(fill(i === 0 ? L.bandFirst : L.band, { from: num(from), to: num(b), unit }));
  });
  out.push(fill(L.bandLast, { n: num(bands[bands.length - 1]), unit }));
  return out;
}

// ---------------------------------------------------------------- carriles y elementos

/** Los carriles que se pueden pintar: `id` y `label` de texto, `id` sin repetir, al menos una bandeja. */
export function cleanLanes(v: unknown): Lane[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: Lane[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Partial<Lane>;
    const id = typeof r.id === "string" || typeof r.id === "number" ? String(r.id) : "";
    if (!id || seen.has(id) || !Array.isArray(r.stages)) continue;
    const ids = new Set<string>();
    const stages: LaneStage[] = [];
    for (const s of r.stages as unknown[]) {
      if (!s || typeof s !== "object") continue;
      const st = s as Partial<LaneStage>;
      const sid = typeof st.id === "string" || typeof st.id === "number" ? String(st.id) : "";
      if (!sid || ids.has(sid)) continue;
      ids.add(sid);
      stages.push({ id: sid, label: typeof st.label === "string" ? st.label : sid, other: st.other === true, href: typeof st.href === "string" ? st.href : undefined });
    }
    if (!stages.length) continue;
    seen.add(id);
    out.push({ id, label: typeof r.label === "string" ? r.label : id, stages });
  }
  return out;
}

/** Un elemento ya ubicado: carril y bandeja por posición, su tramo y si espera a otro. */
export interface LaneRow {
  id: string;
  li: number;
  si: number;
  age: number;
  band: number;
  other: boolean;
  item: LaneItem;
}

export interface LanesPrepared {
  rows: LaneRow[];
  /** `[carril][bandeja]`: los elementos, el más viejo primero. */
  groups: LaneRow[][][];
}

/**
 * Ubica cada elemento en su carril y su bandeja. Lo que no tiene carril o bandeja conocidos, o una
 * edad que no es número, no se pinta; una edad negativa cuenta como 0. Un `id` repetido se queda con
 * el primero (dos puntos con el mismo nodo no se pueden mover a la vez).
 */
export function prepare(items: readonly LaneItem[], lanes: readonly Lane[], bands: readonly number[]): LanesPrepared {
  const laneAt = new Map(lanes.map((l, i) => [l.id, i]));
  const stageAt = lanes.map((l) => new Map(l.stages.map((s, i) => [s.id, i])));
  const groups = lanes.map((l) => l.stages.map(() => [] as LaneRow[]));
  const rows: LaneRow[] = [];
  const seen = new Set<string>();
  // Con cortes enteros, el tramo sale de los días cumplidos: lo mismo que se muestra («2 días» con 2,5).
  const whole = bands.every(Number.isInteger);
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const id = String(item.id);
    const li = laneAt.get(String(item.lane));
    if (li === undefined || seen.has(id)) continue;
    const si = stageAt[li].get(String(item.stage));
    const age = typeof item.age === "number" ? item.age : Number(item.age);
    if (si === undefined || !Number.isFinite(age)) continue;
    seen.add(id);
    const a = Math.max(0, age);
    const row: LaneRow = { id, li, si, age: a, band: bandOf(whole ? Math.floor(a) : a, bands), other: lanes[li].stages[si].other === true, item };
    rows.push(row);
    groups[li][si].push(row);
  }
  // El más viejo primero; a igual edad, por `id`, para que el orden no baile entre refrescos.
  for (const lane of groups) for (const g of lane) g.sort((a, b) => b.age - a.age || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { rows, groups };
}

export interface StationSummary {
  count: number;
  late: number;
  oldest: LaneRow | null;
}

export interface LaneSummary {
  own: number;
  other: number;
  late: number;
  /** Lo propio por tramo. */
  tones: number[];
  oldest: LaneRow | null;
  stations: StationSummary[];
}

/** Lo que dice cada carril: lo propio, lo de otros, lo atrasado, lo más viejo, y lo mismo por bandeja. */
export function summarize(prep: LanesPrepared, lanes: readonly Lane[], bands: readonly number[]): LaneSummary[] {
  const last = bands.length;
  return lanes.map((lane, li) => {
    const tones = new Array<number>(bands.length + 1).fill(0);
    let own = 0;
    let other = 0;
    let late = 0;
    let oldest: LaneRow | null = null;
    const stations = lane.stages.map((stage, si) => {
      const g = prep.groups[li][si];
      let sLate = 0;
      for (const r of g) {
        if (stage.other) continue;
        tones[r.band]++;
        if (last > 0 && r.band === last) sLate++;
      }
      if (stage.other) other += g.length;
      else {
        own += g.length;
        late += sLate;
        // `g` va del más viejo al más nuevo: su primero es el más viejo de la bandeja.
        if (g.length && (!oldest || g[0].age > oldest.age)) oldest = g[0];
      }
      return { count: g.length, late: sLate, oldest: g[0] ?? null };
    });
    return { own, other, late, tones, oldest, stations };
  });
}

/**
 * Los carriles que vale la pena mirar, en orden: los que tienen atrasados (más atrasados primero, y
 * a igual cuenta, el de lo más viejo); si ninguno tiene, los que tienen algo propio (más lleno primero).
 */
export function rankLanes(sums: readonly LaneSummary[]): number[] {
  const idx = sums.map((_, i) => i);
  const late = idx.filter((i) => sums[i].late > 0);
  if (late.length) return late.sort((a, b) => sums[b].late - sums[a].late || (sums[b].oldest?.age ?? 0) - (sums[a].oldest?.age ?? 0) || a - b);
  return idx.filter((i) => sums[i].own > 0).sort((a, b) => sums[b].own - sums[a].own || a - b);
}

/** La bandeja propia con más atrasados; sin atrasados, la más llena. `-1` si no hay nada propio. */
export function jamOf(sum: LaneSummary, lane: Lane): number {
  let best = -1;
  lane.stages.forEach((s, i) => {
    if (s.other || !sum.stations[i].count) return;
    const a = sum.stations[i];
    const b = best < 0 ? null : sum.stations[best];
    if (!b || a.late > b.late || (a.late === b.late && a.count > b.count)) best = i;
  });
  return best;
}

/** Dónde estaba cada elemento: `id` → carril y bandeja (por `id`, no por posición). */
export type Places = Map<string, { lane: string; stage: string }>;

export function placesOf(prep: LanesPrepared, lanes: readonly Lane[]): Places {
  return new Map(prep.rows.map((r) => [r.id, { lane: lanes[r.li].id, stage: lanes[r.li].stages[r.si].id }]));
}

/**
 * Lo que cambió de una carga a otra. Cambiar de carril cuenta como salir de uno y llegar al otro
 * (no es un paso del trámite).
 */
export function diffPlaces(before: Places, after: Places): LanesChangeDetail {
  const out: LanesChangeDetail = { moved: [], added: [], removed: [] };
  for (const [id, now] of after) {
    const was = before.get(id);
    if (!was) out.added.push({ id, ...now });
    else if (was.lane !== now.lane) {
      out.removed.push({ id, ...was });
      out.added.push({ id, ...now });
    } else if (was.stage !== now.stage) out.moved.push({ id, lane: now.lane, from: was.stage, to: now.stage });
  }
  for (const [id, was] of before) if (!after.has(id)) out.removed.push({ id, ...was });
  return out;
}

// ---------------------------------------------------------------- geometría de las pilas

/** Lo que queda bajo el riel para el nombre de la bandeja (lo mismo que el CSS). */
export const RAIL_BOTTOM = 22;

/** El tamaño de los puntos: según el ancho del carril y lo que cabe sobre el riel (dos filas, mínimo). */
export function dotSize(width: number, height: number): number {
  const railY = Math.max(20, height - RAIL_BOTTOM);
  return Math.max(6, Math.min(13, Math.round(width / 110), Math.floor((railY - 14) / 2) - 3));
}

export interface Stack {
  /** La altura del riel desde arriba del carril. */
  railY: number;
  /** El ancho de cada bandeja. */
  sw: number;
  gap: number;
  cols: number;
  rows: number;
  cap: number;
}

/** Cuántos puntos caben por bandeja: columnas en el 78 % de su ancho, filas hasta arriba del carril. */
export function stackOf(width: number, height: number, stations: number, size: number): Stack {
  const railY = Math.max(20, height - RAIL_BOTTOM);
  const gap = size + 3;
  const sw = width / Math.max(1, stations);
  const cols = Math.max(2, Math.floor((sw * 0.78) / gap));
  const rows = Math.max(1, Math.floor((railY - 8 - size) / gap) + 1);
  return { railY, sw, gap, cols, rows, cap: cols * rows };
}

/**
 * El centro del punto `k` de los `n` de la bandeja `i`: centrados sobre su nodo, de abajo hacia
 * arriba, el más viejo junto al riel. Lo que pasa del tope comparte el último sitio (y no se ve).
 */
export function slotOf(st: Stack, i: number, k: number, n: number, size: number): { x: number; y: number } {
  const c = Math.min(st.cols, Math.max(1, n));
  const kk = Math.min(k, st.cap - 1);
  const r = Math.floor(kk / c);
  const cc = kk % c;
  return {
    x: st.sw * (i + 0.5) + (cc - (c - 1) / 2) * st.gap,
    y: st.railY - 4 - size / 2 - r * st.gap,
  };
}

/** Un retraso estable por `id` (0 a 2,6 s), para que los atrasados no laten todos a la vez. */
export function delayOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 26) / 10;
}
