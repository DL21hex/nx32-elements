/** Lógica pura de `<nx-grid>`: valores, filtros, orden, grupos, estadísticas, TSV y la tabla HTML
 *  que se copia. Las barras del filtro de una columna están en `bars.ts` (solo las usa el panel, que
 *  se carga aparte). */
import { foldText, matchText } from "../../core/text";
import { nxFormat, type NxFormat } from "../../core/locale";
import type { GridAccents, GridColumn, GridDateRel, GridFilter, GridMatrixCell, GridRow, GridSort } from "./types";
import { parseTime, type TimeContext } from "./time";

// Las funciones que muestran o leen valores reciben el formato del locale (`nxFormat`); sin él,
// usan «es-CO».

export const colType = (c: GridColumn) => c.type ?? "text";
export const isNumeric = (c: GridColumn) => colType(c) === "number" || colType(c) === "money";

// ---------------------------------------------------------------- valores

export function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim()) {
    const n = parseNumber(v);
    return n;
  }
  return null;
}

/** «1.234.567», «1.234,5», «1234.5», «$ 12» → número. Para datos y frases en español; lo que se
 *  escribe en una celda se lee con el locale de la tabla (`NxFormat.parse`). «0.125» no son miles
 *  (ningún grupo de miles empieza con 0): es un decimal como lo serializa un backend. */
export function parseNumber(text: string): number | null {
  let t = text.replace(/[^\d.,-]/g, "");
  if (!t || t === "-") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** «8,2 M», «450 k», «85» (según el locale). */
export function compact(n: number, f: NxFormat = nxFormat()): string {
  return f.compact(n);
}

export function formatDate(iso: string, f: NxFormat = nxFormat()): string {
  return f.date(iso);
}

/** El texto de una celda (lo que se ve, se copia y se busca). */
export function formatCell(v: unknown, c: GridColumn, f: NxFormat = nxFormat()): string {
  if (v === null || v === undefined || v === "") return "";
  switch (colType(c)) {
    case "number": {
      const n = num(v);
      return n === null ? String(v) : f.number(n);
    }
    case "money": {
      const n = num(v);
      return n === null ? String(v) : f.money(n, c);
    }
    case "date":
      return f.date(String(v));
    case "time":
      return String(v);
    case "status":
    case "timeline":
      return c.options?.find((o) => o.value === String(v))?.label ?? String(v);
    default:
      return String(v);
  }
}

/** Lo que alguien escribe en una celda editable, en el tipo de la columna. `undefined`: no se
 *  entiende (una hora como «25:00»): la celda no cambia. `steps`: en una hora, el paso anterior y el
 *  siguiente de su proceso (ver `readTime`). */
export function parseInput(text: string, c: GridColumn, f: NxFormat = nxFormat(), now?: () => Date, steps?: Pick<TimeContext, "prev" | "next">): unknown {
  const t = text.trim();
  if (isNumeric(c)) return t ? f.parse(t) : null;
  if (colType(c) === "time") return parseTime(t, now, steps);
  if (colType(c) === "status") {
    const k = foldText(t);
    return c.options?.find((o) => foldText(o.value) === k || foldText(o.label ?? "") === k)?.value ?? t;
  }
  return t;
}

// ---------------------------------------------------------------- buscar en la tabla

/** Cómo se normaliza un texto para buscar: sin tildes ni mayúsculas (`foldText`, por omisión) o
 *  sin mayúsculas y con sus tildes y su ñ (`matchText`, `accents="exact"`). Lo escrito y el dato
 *  pasan siempre por la misma. */
export const normalizer = (accents: GridAccents = "fold"): ((s: string) => string) => (accents === "exact" ? matchText : foldText);

/** Lo que «Buscar en la tabla» mira de una fila: el texto que se ve en cada columna y, en números y
 *  fechas, también el valor sin formato («8000000», «2026-03»), sin tildes ni mayúsculas (o con sus
 *  tildes, con `accents` en `"exact"`). Un salto de línea separa las columnas: lo buscado no puede
 *  quedar a caballo entre dos.
 *
 *  Devuelve la función que lo arma para unas columnas y un locale. Los valores que se repiten
 *  (fechas, estados, proveedores) se formatean una sola vez: formatear 100.000 fechas con `Intl`
 *  costaba más de la mitad del tiempo, y solo había 336 distintas. */
export function rowTexter(cols: readonly GridColumn[], f: NxFormat = nxFormat(), accents: GridAccents = "fold"): (r: GridRow) => string {
  const norm = normalizer(accents);
  const memo = cols.map(() => new Map<unknown, string>());
  return (r) => {
    let s = "";
    cols.forEach((c, i) => {
      const v = r[c.key];
      if (v === null || v === undefined || v === "") return;
      let t = memo[i].get(v);
      if (t === undefined) {
        t = norm(isNumeric(c) || colType(c) === "date" ? `${formatCell(v, c, f)}\n${String(v)}` : formatCell(v, c, f));
        if (memo[i].size < 5000) memo[i].set(v, t);
      }
      s += `${t}\n`;
    });
    return s;
  };
}

// ---------------------------------------------------------------- filtros y orden

/** «Contiene» se evalúa en cada fila con el mismo texto buscado: se pliega una vez, no por fila
 *  (una aguja por modo: dos grillas, una con `accents="exact"`, no se pisan). */
const needles: Record<GridAccents, { raw: string; folded: string }> = { fold: { raw: "", folded: "" }, exact: { raw: "", folded: "" } };
const folded = (q: string, accents: GridAccents) => {
  const n = needles[accents];
  return n.raw === q ? n.folded : (needles[accents] = { raw: q, folded: normalizer(accents)(q) }).folded;
};

/** Cada dato se pliega (sin tildes ni mayúsculas; con `"exact"`, solo sin mayúsculas) una sola
 *  vez: «contiene» se vuelve a evaluar en cada cambio de filtro, en cada faceta y en la muestra del
 *  panel, siempre sobre los mismos datos. Va por valor, no por fila: una celda editada es otro
 *  valor. Con más valores distintos que el tope se empieza de nuevo (la memoria no crece sin fin),
 *  y un texto largo (observaciones de varios KB) no se guarda: con miles de ellos la memoria
 *  guardaba cientos de MB. Una memoria por modo. */
const FOLD_MAX = 200_000;
const FOLD_LONG = 256;
const foldMemo: Record<GridAccents, Map<string, string>> = { fold: new Map(), exact: new Map() };
export function foldValue(s: string, accents: GridAccents = "fold"): string {
  const norm = normalizer(accents);
  if (s.length > FOLD_LONG) return norm(s);
  let t = foldMemo[accents].get(s);
  if (t === undefined) {
    if (foldMemo[accents].size >= FOLD_MAX) foldMemo[accents] = new Map();
    foldMemo[accents].set(s, (t = norm(s)));
  }
  return t;
}

/** Los valores de un `in` / `notIn` como conjunto, armado una vez por lista: con miles de valores,
 *  buscar en la lista por cada fila congelaba la página varios segundos. */
const valueSets = new WeakMap<readonly string[], { n: number; set: Set<string> }>();
function valueSet(values: readonly string[]): Set<string> {
  let s = valueSets.get(values);
  // Una lista cambiada en su lugar (otro largo) se vuelve a armar.
  if (!s || s.n !== values.length) valueSets.set(values, (s = { n: values.length, set: new Set(values) }));
  return s.set;
}

/** Al empezar una pasada por las filas, los conjuntos de sus filtros se arman de nuevo: una lista
 *  cambiada en su lugar con el mismo largo (`fs[0].values[1] = "c"`) no deja un conjunto viejo. Es
 *  una vez por pasada, no por fila. */
function freshSets(filters: readonly GridFilter[]): void {
  for (const f of filters) if (f.op === "in" || f.op === "notIn") valueSets.set(f.values, { n: f.values.length, set: new Set(f.values) });
}

/** `accents`: cómo compara «contiene» (ver `GridAccents`); los demás filtros no lo miran. */
export function matchFilter(row: GridRow, f: GridFilter, accents: GridAccents = "fold"): boolean {
  return matchValue(row[f.key], f, accents);
}

function matchValue(v: unknown, f: GridFilter, accents: GridAccents): boolean {
  switch (f.op) {
    case "in":
      return valueSet(f.values).has(String(v ?? ""));
    case "notIn":
      return !valueSet(f.values).has(String(v ?? ""));
    case "contains":
      return foldValue(String(v ?? ""), accents).includes(folded(f.value, accents));
    case "range": {
      if (v === null || v === undefined || v === "") return false;
      const x = typeof f.min === "string" || typeof f.max === "string" ? String(v) : num(v);
      if (x === null) return false;
      if (f.min !== undefined && x < f.min) return false;
      if (f.max !== undefined && x >= f.max) return false;
      return true;
    }
  }
}

export function applyFilters(rows: readonly GridRow[], filters: readonly GridFilter[], accents: GridAccents = "fold"): GridRow[] {
  if (!filters.length) return rows as GridRow[];
  freshSets(filters);
  return rows.filter((r) => filters.every((f) => matchFilter(r, f, accents)));
}

/** Orden estable. El texto sigue el alfabeto del locale (tildes y mayúsculas no cuentan, «OC-9» va
 *  antes que «OC-10»); los estados, el orden de sus opciones. */
export function sortRows(rows: readonly GridRow[], sort: GridSort | null, columns: readonly GridColumn[], f: NxFormat = nxFormat()): GridRow[] {
  if (!sort) return rows as GridRow[];
  const c = columns.find((x) => x.key === sort.key);
  if (!c) return rows as GridRow[];
  const numeric = isNumeric(c);
  const order = c.options && new Map(c.options.map((o, i) => [o.value, i]));
  const key = (r: GridRow): number | string => {
    const v = r[sort.key];
    if (numeric) return num(v) ?? Number.NEGATIVE_INFINITY;
    if (order) return order.get(String(v)) ?? order.size;
    return v === null || v === undefined ? "" : String(v);
  };
  const keyed = rows.map((r, i) => ({ r, i, k: key(r) }));
  // El texto se ordena por rango: los valores distintos (pocos, casi siempre) se ordenan con el
  // alfabeto del locale una sola vez, y las filas se comparan como números. Comparar 100.000
  // textos con `Intl.Collator` en cada paso es varias veces más lento.
  if (keyed.length && typeof keyed[0].k === "string") {
    const distinct = [...new Set(keyed.map((x) => x.k as string))].sort(f.compare);
    const rank = new Map<string, number>();
    // «Árbol» y «arbol» comparten rango: entre ellas manda el orden original (estable).
    distinct.forEach((v, i) => rank.set(v, i && f.compare(distinct[i - 1], v) === 0 ? rank.get(distinct[i - 1])! : i));
    for (const x of keyed) x.k = rank.get(x.k as string)!;
  }
  return keyed.sort((a, b) => ((a.k as number) - (b.k as number)) * sort.dir || a.i - b.i).map((x) => x.r);
}

/** El texto de un chip de filtro. `rels`: los nombres de los tramos relativos («Este mes»). */
export function filterLabel(f: GridFilter, c: GridColumn | undefined, fmt: NxFormat = nxFormat(), rels?: Partial<Record<GridDateRel, string>>): string {
  const name = c?.label ?? f.key;
  const show = (v: number | string) => (typeof v === "string" ? fmt.date(v) : c && colType(c) === "money" ? fmt.money(v, c, true) : fmt.compact(v));
  const opt = (v: string) => c?.options?.find((o) => o.value === v)?.label ?? v;
  switch (f.op) {
    case "in":
      return `${name}: ${f.values.map(opt).join(", ") || "—"}`;
    case "notIn":
      return `${name}: sin ${f.values.map(opt).join(", ")}`;
    case "contains":
      return `${name} contiene «${f.value}»`;
    case "range": {
      const rel = f.rel && rels?.[f.rel];
      if (rel) return `${name}: ${rel.toLowerCase()}`;
      if (typeof f.min === "string" && typeof f.max === "string" && /-01$/.test(f.min) && /-01$/.test(f.max) && monthSpan(f.min, f.max) === 1) return `${name}: ${fmt.date(f.min.slice(0, 7))}`;
      // `max` no se incluye: en una fecha, el tramo termina el día anterior.
      const max = typeof f.max === "string" && ISO_DAY.test(f.max) ? addDays(f.max, -1) : f.max;
      if (f.min !== undefined && max !== undefined) return `${name}: ${show(f.min)} – ${show(max)}`;
      if (f.min !== undefined) return `${name} ≥ ${show(f.min)}`;
      return typeof max === "string" ? `${name} ≤ ${show(max)}` : `${name} < ${show(max!)}`;
    }
  }
}

function monthSpan(a: string, b: string): number {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

// ---------------------------------------------------------------- filtro por columna

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, "0");

/** Hoy, en la zona de quien mira (AAAA-MM-DD). */
export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const DATE_RELS: readonly GridDateRel[] = ["past", "last30", "next30", "month", "lastMonth", "year"];

/** El tramo de un filtro relativo (`max` excluido), contado desde `today`. */
export function relRange(rel: GridDateRel, today: string): { min?: string; max?: string } {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const first = (yy: number, mm: number) => (mm > 12 ? `${yy + 1}-01-01` : mm < 1 ? `${yy - 1}-12-01` : `${yy}-${pad(mm)}-01`);
  switch (rel) {
    case "past":
      return { max: today };
    case "last30":
      return { min: addDays(today, -30), max: addDays(today, 1) };
    case "next30":
      return { min: today, max: addDays(today, 31) };
    case "month":
      return { min: first(y, m), max: first(y, m + 1) };
    case "lastMonth":
      return { min: first(y, m - 1), max: first(y, m) };
    default:
      return { min: `${y}-01-01`, max: `${y + 1}-01-01` };
  }
}

/** Los tramos relativos se recalculan con la fecha de hoy (una vista guardada ayer sigue siendo
 *  cierta); un `rel` desconocido se quita y queda el tramo fijo. */
export function resolveRel(filters: readonly GridFilter[], today = todayISO()): GridFilter[] {
  return filters.map((f) => {
    if (f.op !== "range" || f.rel === undefined) return f;
    const { rel, ...fixed } = f;
    return DATE_RELS.includes(rel) ? { key: f.key, op: "range", rel, ...relRange(rel, today) } : fixed;
  });
}

/** Lo marcado en la lista de una columna: los valores que pasan sus filtros `in` / `notIn`, o
 *  `null` si no tiene ninguno. */
export function selection(filters: readonly GridFilter[], key: string, values: readonly string[]): Set<string> | null {
  const own = filters.filter((f) => f.key === key && (f.op === "in" || f.op === "notIn"));
  if (!own.length) return null;
  freshSets(own);
  // Solo `in` / `notIn`: la regla de tildes no cuenta.
  return new Set(values.filter((v) => own.every((f) => matchValue(v, f, "fold"))));
}

/** Lo marcado → los filtros de la columna. Todo marcado es no filtrar; con más de la mitad (si se
 *  conocen todos los valores: `exclude`) se guarda como exclusión, «sin Cali». */
export function fromSelection(key: string, sel: ReadonlySet<string>, values: readonly string[], exclude = true): GridFilter[] {
  if (values.every((v) => sel.has(v))) return [];
  if (exclude && sel.size > values.length / 2) return [{ key, op: "notIn", values: values.filter((v) => !sel.has(v)) }];
  return [{ key, op: "in", values: values.filter((v) => sel.has(v)) }];
}

/** Los filtros con los de una columna reemplazados. */
export function withColumn(filters: readonly GridFilter[], key: string, next: readonly GridFilter[]): GridFilter[] {
  return [...filters.filter((f) => f.key !== key), ...next];
}

// ---------------------------------------------------------------- grupos

export interface GridGroup {
  key: string;
  label: string;
  rows: GridRow[];
  /** Subtotales de las columnas numéricas. */
  sums: Record<string, number>;
}

/** Agrupa por una columna (por mes si es fecha), con subtotales. Ordena por tamaño, o por el orden
 *  de las opciones / cronológico. */
export function groupRows(rows: readonly GridRow[], c: GridColumn, columns: readonly GridColumn[], f: NxFormat = nxFormat()): GridGroup[] {
  const numeric = columns.filter(isNumeric);
  const date = colType(c) === "date";
  const groups = new Map<string, GridGroup>();
  for (const r of rows) {
    const raw = String(r[c.key] ?? "");
    const key = date ? raw.slice(0, 7) : raw;
    let g = groups.get(key);
    if (!g) {
      g = { key, label: key ? (date ? f.date(key) : formatCell(raw, c, f)) : "—", rows: [], sums: {} };
      groups.set(key, g);
    }
    g.rows.push(r);
    for (const n of numeric) g.sums[n.key] = (g.sums[n.key] ?? 0) + (num(r[n.key]) ?? 0);
  }
  const list = [...groups.values()];
  const order = c.options?.map((o) => o.value);
  if (date) list.sort((a, b) => (a.key < b.key ? -1 : 1));
  else if (order) list.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  else list.sort((a, b) => b.rows.length - a.rows.length);
  return list;
}

// ---------------------------------------------------------------- selección y portapapeles

export function stats(values: readonly number[]): { count: number; sum: number; avg: number; min: number; max: number } | null {
  if (!values.length) return null;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { count: values.length, sum, avg: sum / values.length, min, max };
}

/** Una matriz como TSV (lo que Excel entiende al pegar). Las celdas con tabs o saltos van entre comillas. */
export function toTSV(matrix: readonly (readonly string[])[]): string {
  const cell = (s: string) => (/[\t\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return matrix.map((r) => r.map(cell).join("\t")).join("\n");
}

const FORMULA = /^[=+\-@\t\r]/;

/** Un texto que Excel o Sheets tomarían como fórmula al pegarlo (`=HYPERLINK(…)`, `+cmd`, `@SUMA`)
 *  va con un apóstrofo delante: así queda como texto. Solo para columnas que no son numéricas (un
 *  «-5» de verdad se copia como número). */
export function formulaSafe(text: string): string {
  return FORMULA.test(text) ? `'${text}` : text;
}

/** Una celda de la tabla que va al portapapeles como HTML (`toHTMLTable`). */
export interface HtmlCell {
  /** Lo que se ve, con el formato de la tabla. */
  text: string;
  /** El número sin formato: Excel y Sheets lo pegan como número aunque el texto diga «$ 8.000.000». */
  num?: number;
  /** Fecha sin formato (AAAA-MM-DD): la celda no se marca como texto, para que la hoja la lea. */
  date?: boolean;
  /** Dirección ya revisada (`safeHref`): la celda va como enlace. */
  href?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const CELL = "border:1px solid #d4d4d8;padding:4px 8px;vertical-align:top";

/** El rango copiado como una tabla HTML con encabezados, para pegarla en un correo o en un
 *  documento. Los estilos van en línea (los correos quitan las hojas de estilo) y son sobrios: bordes
 *  finos, cabecera en gris y montos a la derecha, con la letra del destino. Excel y Sheets también
 *  leen este HTML: cada número lleva su valor sin formato (`x:num`, `data-sheets-value`) y cada texto
 *  va marcado como texto (`x:str`), así que «=1+1» no se vuelve fórmula y «00123» no pierde los ceros. */
export function toHTMLTable(head: readonly string[], rows: readonly (readonly HtmlCell[])[], right: readonly boolean[] = []): string {
  const align = (j: number) => (right[j] ? ";text-align:right" : ";text-align:left");
  const th = head.map((t, j) => `<th style="${CELL};background:#f4f4f5;font-weight:600${align(j)}">${esc(t)}</th>`).join("");
  const td = (c: HtmlCell, j: number) => {
    let attrs: string;
    if (c.num !== undefined) attrs = ` x:num="${c.num}" data-sheets-value="${esc(JSON.stringify({ 1: 3, 3: c.num }))}"`;
    else if (c.date || !c.text) attrs = "";
    else attrs = ` x:str data-sheets-value="${esc(JSON.stringify({ 1: 2, 2: c.text }))}"`;
    const body = esc(c.text).replace(/\r?\n/g, "<br>");
    const inner = c.href ? `<a href="${esc(c.href)}">${body}</a>` : body;
    return `<td style="${CELL}${right[j] ? ";text-align:right;white-space:nowrap" : ""}"${attrs}>${inner}</td>`;
  };
  const tr = rows.map((r) => `<tr>${r.map(td).join("")}</tr>`).join("");
  return `<table style="border-collapse:collapse"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

/** Lo inverso al pegar en la tabla: quita ese apóstrofo (y solo ese). */
export function unformulaSafe(text: string): string {
  return text.startsWith("'") && FORMULA.test(text.slice(1)) ? text.slice(1) : text;
}

/** TSV (lo que Excel copia) a matriz, con las comillas de Excel. */
export function parseTSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const t = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

// ---------------------------------------------------------------- facetas

export interface GridFacet {
  key: string;
  label: string;
  /** Opciones en orden, con su conteo (aplicando los DEMÁS filtros, no los de esta faceta). */
  options: { value: string; label: string; count: number }[];
  /** Lo marcado ahora (el filtro `in` de esta columna). */
  selected: string[];
}

/** Las columnas que van al panel: `status`, y texto con pocas opciones distintas. */
export function facetColumns(columns: readonly GridColumn[], rows: readonly GridRow[], max = 40): GridColumn[] {
  return columns.filter((c) => {
    if (isNumeric(c) || colType(c) === "date") return false;
    if (c.options) return true;
    const seen = new Set<string>();
    let n = 0;
    for (let i = 0; i < rows.length && i < 20000; i++, n++) {
      const v = rows[i][c.key];
      if (typeof v === "string" && v) seen.add(v);
      if (seen.size > max) return false;
    }
    return seen.size >= 2 && seen.size < n;
  });
}

/** El orden de las opciones de cada faceta: las declaradas, o por frecuencia en TODAS las filas.
 *  Es estable: marcar una casilla no reordena la lista. Se calcula una vez por versión de datos. */
export function facetOrder(columns: readonly GridColumn[], rows: readonly GridRow[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const c of columns) {
    if (c.options) {
      out.set(c.key, c.options.map((o) => o.value));
      continue;
    }
    const total = new Map<string, number>();
    for (const r of rows) {
      const v = String(r[c.key] ?? "");
      if (v) total.set(v, (total.get(v) ?? 0) + 1);
    }
    out.set(c.key, [...total.keys()].sort((a, b) => total.get(b)! - total.get(a)! || a.localeCompare(b)));
  }
  return out;
}

/**
 * Filtra y cuenta las facetas en UNA pasada, con la regla de nx32 (`ListingGrid`): dentro de una
 * faceta las opciones se suman (O), entre facetas se restringen (Y), y cada opción se cuenta con
 * todos los filtros MENOS los de su propia columna (una faceta nunca se cuenta a sí misma).
 *
 * Por fila se evalúa cada columna filtrada una vez: si no falla ninguna, la fila pasa y cuenta en
 * todas las facetas; si falla solo una, cuenta únicamente en la faceta de esa columna.
 */
export function crossfilter(
  rows: readonly GridRow[],
  filters: readonly GridFilter[],
  columns: readonly GridColumn[],
  order: Map<string, string[]> = facetOrder(columns, rows),
  accents: GridAccents = "fold",
): { filtered: GridRow[]; facets: GridFacet[] } {
  freshSets(filters);
  const byKey = new Map<string, GridFilter[]>();
  for (const f of filters) byKey.set(f.key, [...(byKey.get(f.key) ?? []), f]);
  const groups = [...byKey];
  const counts = columns.map(() => new Map<string, number>());
  const at = new Map(columns.map((c, i) => [c.key, i]));
  const bump = (i: number, r: GridRow) => {
    const v = String(r[columns[i].key] ?? "");
    if (v) counts[i].set(v, (counts[i].get(v) ?? 0) + 1);
  };
  const filtered: GridRow[] = [];
  for (const r of rows) {
    let fails = 0;
    let failed = "";
    for (const [key, fs] of groups) {
      if (fs.every((f) => matchFilter(r, f, accents))) continue;
      failed = key;
      if (++fails > 1) break;
    }
    if (fails === 0) {
      filtered.push(r);
      for (let i = 0; i < columns.length; i++) bump(i, r);
    } else if (fails === 1) {
      const i = at.get(failed);
      if (i !== undefined) bump(i, r);
    }
  }
  return {
    filtered: filters.length ? filtered : (rows as GridRow[]),
    facets: columns.map((c, i) => {
      const own = filters.find((f): f is Extract<GridFilter, { op: "in" }> => f.key === c.key && f.op === "in");
      return {
        key: c.key,
        label: c.label,
        options: (order.get(c.key) ?? []).map((v) => ({ value: v, label: c.options?.find((o) => o.value === v)?.label ?? v, count: counts[i].get(v) ?? 0 })),
        selected: own?.values ?? [],
      };
    }),
  };
}

/** Solo las facetas (ver `crossfilter`). */
export function facets(columns: readonly GridColumn[], rows: readonly GridRow[], filters: readonly GridFilter[]): GridFacet[] {
  return crossfilter(rows, filters, columns).facets;
}

/** Los cruces de la matriz (`matrix`) en el navegador: uno por par de valores de las dos columnas
 *  que tenga filas (`""` es «sin dato»), con lo que vale (`count`, o la suma o el promedio de `value`)
 *  y cuántas filas lo forman (con `avg`, las que traen número: con eso se ponderan los totales). Es
 *  lo mismo que manda el servidor (`GridPage.matrix`). */
export function matrixCells(rows: readonly GridRow[], m: { rows: string; cols: string; agg: "count" | "sum" | "avg"; value: string }): GridMatrixCell[] {
  const acc = new Map<string, { row: string; col: string; n: number; sum: number; has: number }>();
  for (const r of rows) {
    const row = String(r[m.rows] ?? "");
    const col = String(r[m.cols] ?? "");
    const k = `${row}\u0000${col}`;
    let c = acc.get(k);
    if (!c) acc.set(k, (c = { row, col, n: 0, sum: 0, has: 0 }));
    c.n++;
    if (m.agg === "count") continue;
    const v = num(r[m.value]);
    if (v === null) continue;
    c.sum += v;
    c.has++;
  }
  return [...acc.values()].map((c) => ({
    row: c.row,
    col: c.col,
    value: m.agg === "count" ? c.n : m.agg === "sum" ? c.sum : c.has ? c.sum / c.has : 0,
    count: m.agg === "avg" ? c.has : c.n,
  }));
}

/** Marca o desmarca un valor de faceta: edita (o crea, o quita) el filtro `in` de esa columna. Si
 *  la columna tiene una exclusión («sin Cali», del filtro de la cabecera) y se conocen sus valores,
 *  parte de lo que esa exclusión deja marcado. */
export function toggleFacet(filters: readonly GridFilter[], key: string, value: string, all?: readonly string[]): GridFilter[] {
  if (all && filters.some((f) => f.key === key && f.op === "notIn")) {
    const sel = selection(filters, key, all)!;
    if (!sel.delete(value)) sel.add(value);
    return withColumn(filters, key, sel.size ? fromSelection(key, sel, all, false) : []);
  }
  const own = filters.find((f): f is Extract<GridFilter, { op: "in" }> => f.key === key && f.op === "in");
  const rest = filters.filter((f) => f !== own);
  const values = own ? (own.values.includes(value) ? own.values.filter((v) => v !== value) : [...own.values, value]) : [value];
  return values.length ? [...rest, { key, op: "in", values }] : rest;
}
