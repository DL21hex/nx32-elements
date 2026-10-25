/**
 * `<nx-form>`: la lógica sin DOM. Limpia el esquema que llega del backend, decide qué campos se ven
 * (`when`), valida cada valor y lo pasa a texto para leerlo. Todo puro: se prueba sin navegador y el
 * servidor puede usar lo mismo.
 */
import { safeHref } from "../../core/dom";
import type { NxFormat } from "../../core/locale";
import { acceptsFile, formatBytes } from "../capture/logic";
import { blockedReason, cleanUnavailable, plainUnavailable, type Unavailable } from "../date/logic";
import { firstUnmet, passwordRules } from "../password/logic";
import type { FormCondition, FormField, FormFieldType, FormLabels, FormLink, FormOption, FormRow, FormRule, FormSection, FormValue } from "./types";

export const FORM_TYPES: readonly FormFieldType[] = ["text", "email", "tel", "url", "textarea", "number", "money", "percent", "date", "select", "radio", "segmented", "checkbox", "checkboxes", "readonly", "rows", "file", "otp", "password"];
/** Lo que no se guarda en el borrador, no se llena desde afuera y no se muestra al leer. */
const SECRET = new Set<FormFieldType>(["otp", "password"]);
export const isSecret = (t: FormFieldType): boolean => SECRET.has(t);
/** Las casillas de un código: `maxLength` (de 4 a 8) o 6. */
export const otpLength = (def: Pick<FormField, "maxLength">): number => {
  const n = Math.round(Number(def.maxLength));
  return n >= 4 && n <= 8 ? n : 6;
};
/** El tamaño máximo de un archivo si el campo no trae `maxSize` (20 MB, como `<nx-doc-capture>`). */
export const FILE_MAX_SIZE = 20 * 1024 * 1024;
/** Con más opciones que esto, un `select` lleva buscador (`<nx-select>`). */
export const SEARCH_FROM = 12;
const NUMERIC = new Set<FormFieldType>(["number", "money", "percent"]);
const CHOICE = new Set<FormFieldType>(["select", "radio", "segmented", "checkboxes"]);

export const isNumeric = (t: FormFieldType): boolean => NUMERIC.has(t);
export const hasOptions = (t: FormFieldType): boolean => CHOICE.has(t);

/** Un campo ya limpio: tipo conocido, opciones normalizadas y su sección. */
export interface FieldDef extends Omit<FormField, "fields"> {
  type: FormFieldType;
  options: FormOption[];
  /** El índice de su sección. */
  sec: number;
  /** `rows`: los campos de cada fila, ya limpios. */
  subs?: FieldDef[];
  /** `date` con `unavailable`: lo que no se puede elegir, ya limpio. */
  blocked?: Unavailable;
}

/** Un `select` que va con buscador (`<nx-select>`): lo pide, busca en el servidor o tiene muchas opciones. */
export const usesSearch = (def: FieldDef): boolean => def.type === "select" && (!!def.search || !!def.source || !!def.multiple || def.options.length > SEARCH_FROM);
/** Un `select` de varios: su valor es una lista. */
export const isMulti = (def: FieldDef): boolean => def.type === "select" && !!def.multiple;
/** Una fecha con días bloqueados: va con `<nx-date>`. */
export const usesCalendar = (def: FieldDef): boolean => def.type === "date" && !!def.blocked;

export interface SectionDef {
  id: string;
  heading: string;
  description: string;
  fields: FieldDef[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** Una opción como llegue (texto, número u objeto) → `{value, label?, fills?, …columnas}`. */
export function optionOf(o: unknown): FormOption | null {
  if (typeof o === "string" || typeof o === "number") return { value: String(o) };
  if (!isObj(o)) return null;
  const value = str(o.value);
  if (!value && !str(o.label)) return null;
  const out: FormOption = { ...o, value: value || str(o.label) };
  if (typeof o.label !== "string") delete out.label;
  if (!isObj(o.fills)) delete out.fills;
  return out;
}

/** El `link` de un campo como llega → `{label, href}` limpio, o `undefined`: con un aviso si llegó y
 *  no sirve (sin `label`, con un `href` inseguro o vacío) o si es de un campo de una fila. */
function cleanLink(v: unknown, key: string, nested: boolean): FormLink | undefined {
  if (v === undefined || v === null) return undefined;
  if (nested) {
    console.warn(`[nx-form] un enlace no va dentro de una fila: el de "${key}" no se pinta`);
    return undefined;
  }
  const label = isObj(v) && typeof v.label === "string" ? v.label.trim() : "";
  const href = isObj(v) ? safeHref(v.href) : undefined;
  if (!label || !href) {
    console.warn(`[nx-form] enlace descartado en "${key}" (${label ? "href inválido" : "sin label"}): ${JSON.stringify(v).slice(0, 80)}`);
    return undefined;
  }
  return { label, href };
}

/** Un campo como llega → limpio, o `null` (con un aviso). En una fila no hay filas. */
function cleanField(f: unknown, seen: Set<string>, sec: number, nested: boolean): FieldDef | null {
  if (!isObj(f)) return null;
  const key = str(f.key).trim();
  if (!key || typeof f.label !== "string") {
    console.warn(`[nx-form] campo sin key o sin label: ${JSON.stringify(f).slice(0, 80)}`);
    return null;
  }
  if (seen.has(key)) {
    console.warn(`[nx-form] la clave "${key}" está repetida: se usa el primer campo`);
    return null;
  }
  const t = f.type as FormFieldType;
  // Un archivo no va en una fila: su valor no es texto y las filas se guardan en el borrador. Una
  // contraseña o un código tampoco: no pueden terminar en el borrador.
  if (nested && (t === "file" || t === "otp" || t === "password")) {
    console.warn(`[nx-form] ${t === "file" ? "un archivo" : t === "otp" ? "un código" : "una contraseña"} no va dentro de una fila: "${key}" no se pinta`);
    return null;
  }
  if (t !== undefined && (!FORM_TYPES.includes(t) || (nested && t === "rows"))) console.warn(`[nx-form] tipo ${nested && t === "rows" ? "rows dentro de una fila" : `desconocido "${String(t)}"`} en "${key}": se usa text`);
  const type: FormFieldType = FORM_TYPES.includes(t) && !(nested && t === "rows") ? t : "text";
  const options = (Array.isArray(f.options) ? f.options : []).map(optionOf).filter((o): o is FormOption => !!o);
  const { fields: subs, link: rawLink, ...rest } = f as unknown as FormField;
  const { unavailable: rawBlocked, dependsOn: rawDeps, multiple, minFrom, maxFrom, defaultFrom, ...base } = rest;
  const def: FieldDef = { ...base, key, type, options, sec };
  const link = cleanLink(rawLink, key, nested);
  if (link) def.link = link;
  // Lo que solo tiene sentido en su tipo se descarta en los demás (sin aviso: un esquema compartido
  // entre tipos no es un error). Lo que nombra otro campo, solo en el primer nivel.
  if (type === "date") {
    const blocked = cleanUnavailable(rawBlocked);
    if (blocked) (def.blocked = blocked), (def.unavailable = plainUnavailable(blocked));
  }
  if (type === "select" && multiple === true) def.multiple = true;
  const ref = (v: unknown, what: string): string | undefined => {
    const k = str(v).trim();
    if (!k) return undefined;
    if (nested || k === key) {
      console.warn(`[nx-form] ${what} de "${key}" ${nested ? "no va dentro de una fila" : "no puede nombrar al mismo campo"}: se ignora`);
      return undefined;
    }
    return k;
  };
  if (type === "date") {
    const lo = ref(minFrom, "minFrom");
    const hi = ref(maxFrom, "maxFrom");
    if (lo) def.minFrom = lo;
    if (hi) def.maxFrom = hi;
  }
  const from = ref(defaultFrom, "defaultFrom");
  if (from) def.defaultFrom = from;
  if (rawDeps !== undefined && type === "select") {
    if (!def.source) console.warn(`[nx-form] dependsOn de "${key}" necesita source: se ignora`);
    else if (nested) console.warn(`[nx-form] dependsOn de "${key}" no va dentro de una fila: se ignora`);
    else {
      const deps = [...new Set((Array.isArray(rawDeps) ? rawDeps : [rawDeps]).map((d) => str(d).trim()).filter((d) => d && d !== key))];
      if (deps.length) def.dependsOn = deps;
    }
  }
  if (type === "rows") {
    const inner = new Set<string>();
    def.subs = (Array.isArray(subs) ? subs : []).map((x) => cleanField(x, inner, sec, true)).filter((x): x is FieldDef => !!x);
    if (!def.subs.length) {
      console.warn(`[nx-form] el campo de filas "${key}" no tiene campos: no se pinta`);
      return null;
    }
  }
  seen.add(key);
  return def;
}

/**
 * Las secciones tal como llegan → secciones limpias. Se descarta (con un aviso) el campo sin `key` o
 * sin `label`, el de clave repetida y el de un tipo desconocido pasa a `text`. Una sección sin
 * campos válidos no se pinta.
 */
export function cleanSections(raw: unknown): SectionDef[] {
  const seen = new Set<string>();
  const out: SectionDef[] = [];
  const list = Array.isArray(raw) ? raw : [];
  list.forEach((s, i) => {
    if (!isObj(s)) return;
    const fields: FieldDef[] = [];
    for (const f of Array.isArray(s.fields) ? s.fields : []) {
      const def = cleanField(f, seen, out.length, false);
      if (def) fields.push(def);
    }
    if (!fields.length) return;
    out.push({ id: str(s.id) || `s${i + 1}`, heading: str(s.heading), description: str(s.description), fields });
  });
  return out;
}

/** Un archivo del navegador (`File`). Por su forma, no con `instanceof`: sirve con el `File` de otro
 *  marco (un iframe) y en el servidor. */
export function isFile(v: unknown): v is File {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const f = v as Record<string, unknown>;
  return typeof f.name === "string" && typeof f.size === "number" && typeof f.type === "string" && typeof f.slice === "function";
}

/** El tope de un campo `file`, en bytes. */
export function fileMaxSize(def: Pick<FormField, "maxSize">): number {
  const n = numLimit(def.maxSize);
  return n !== null && n > 0 ? n : FILE_MAX_SIZE;
}

/** `accept` para leerlo: «.pdf, image/*» → «PDF, image/*». */
export function acceptText(accept: string): string {
  return accept
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith(".") ? t.slice(1).toUpperCase() : t))
    .join(", ");
}

/** Vacío: `null`, texto en blanco, lista sin elementos o una casilla sin marcar. */
export function isEmpty(v: FormValue | undefined): boolean {
  return v === null || v === undefined || v === false || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);
}

/** Igualdad de valores (las listas y las filas, por contenido). */
export function sameValue(a: FormValue | undefined, b: FormValue | undefined): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return (a as unknown[]).every((x, i) => (isObj(x) ? JSON.stringify(x) === JSON.stringify((b as unknown[])[i]) : x === (b as unknown[])[i]));
  }
  return (a ?? null) === (b ?? null);
}

/** Un valor para comparar en `when`: los números y los sí/no también como texto («3» es 3). */
const norm = (v: FormValue | undefined): string => (v === null || v === undefined ? "" : Array.isArray(v) ? v.join("\u0000") : String(v));

function ruleOk(rule: FormRule, v: FormValue | undefined): boolean {
  if (isObj(rule)) {
    if ("filled" in rule) return !isEmpty(v) === !!rule.filled;
    if ("not" in rule) return !ruleOk(rule.not as FormRule, v);
    return false;
  }
  const list = Array.isArray(rule) ? rule : [rule];
  // Una lista de casillas cumple si tiene alguno de los valores.
  if (Array.isArray(v)) return list.some((r) => (v as unknown[]).includes(norm(r as FormValue)));
  return list.some((r) => norm(r as FormValue) === norm(v));
}

/** `when` se cumple con estos valores (sin condición, siempre). */
export function matches(cond: FormCondition | undefined, values: Record<string, FormValue>): boolean {
  if (!isObj(cond)) return true;
  return Object.entries(cond).every(([k, rule]) => ruleOk(rule, values[k]));
}

/**
 * Las claves visibles. Un campo oculto cuenta como vacío para los demás (un «Motivo» que depende de
 * un campo que a su vez se ocultó también se oculta). Se repite hasta que no cambie (con tope).
 */
export function visibleKeys(fields: FieldDef[], values: Record<string, FormValue>): Set<string> {
  let vis = new Set(fields.map((f) => f.key));
  for (let i = 0; i < 10; i++) {
    const eff: Record<string, FormValue> = {};
    for (const f of fields) eff[f.key] = vis.has(f.key) ? (values[f.key] ?? null) : null;
    const next = new Set(fields.filter((f) => matches(f.when, eff)).map((f) => f.key));
    if (next.size === vis.size && [...next].every((k) => vis.has(k))) return next;
    vis = next;
  }
  return vis;
}

/** Hoy en ISO, con la fecha local (no la de UTC: a las 8 p. m. en Bogotá ya es mañana en UTC). */
export function todayISO(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Una fecha ISO válida («2026-02-30» no). */
export function isISODate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Un límite de fecha: ISO o «today». */
export function dateLimit(v: unknown, today: string): string | null {
  if (v === "today") return today;
  return isISODate(v) ? v : null;
}

/** Los límites de una fecha con estos valores: `min`/`max` (ISO o «today») y, si el otro campo
 *  tiene una fecha, `minFrom`/`maxFrom` (gana el más estricto). */
export function dateBounds(def: Pick<FormField, "min" | "max" | "minFrom" | "maxFrom">, values: Record<string, FormValue>, today: string): { min: string | null; max: string | null } {
  let min = dateLimit(def.min, today);
  let max = dateLimit(def.max, today);
  const lo = def.minFrom ? values[def.minFrom] : null;
  const hi = def.maxFrom ? values[def.maxFrom] : null;
  if (isISODate(lo) && (!min || lo > min)) min = lo;
  if (isISODate(hi) && (!max || hi < max)) max = hi;
  return { min, max };
}

/** La URL de búsqueda de un `select` con `dependsOn`: `source` con el valor de cada campo del que
 *  depende (una lista, separada por comas), o `null` si alguno está vacío (el campo se apaga). */
export function dependentSource(source: string, dependsOn: readonly string[], values: Record<string, FormValue>): string | null {
  const params: string[] = [];
  for (const k of dependsOn) {
    const v = values[k];
    if (isEmpty(v) || isFile(v)) return null;
    const text = Array.isArray(v) ? (v as unknown[]).map(String).join(",") : String(v);
    params.push(`${encodeURIComponent(k)}=${encodeURIComponent(text)}`);
  }
  if (!params.length) return source;
  const [path, hash = ""] = source.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}${params.join("&")}${hash ? `#${hash}` : ""}`;
}

const numLimit = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

/** Dominios mal escritos que se ven a diario. */
const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotamil.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "iclod.com": "icloud.com",
  "icloud.co": "icloud.com",
};
const EMAIL = /^([^\s@]+)@([^\s@]+\.[^\s@]{2,})$/;

/** El correo corregido si el dominio es un error conocido («gmial.com» → «gmail.com»), o `null`. */
export function emailTypo(v: string): string | null {
  const m = EMAIL.exec(v.trim());
  const fix = m && TYPOS[m[2].toLowerCase()];
  return fix ? `${m[1]}@${fix}` : null;
}

export interface Check {
  /** Bloquea el envío. */
  error: string;
  /** No bloquea («¿Quisiste decir…?»), con un arreglo a un clic. */
  warning: string;
  fix?: { label: string; value: FormValue };
}

export interface CheckContext {
  labels: FormLabels;
  fmt: NxFormat;
  today: string;
  /** Los valores del formulario: los usa una contraseña con `match` o `differs`. */
  values?: Record<string, FormValue>;
}

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** Revisa un valor contra su campo: obligatorio, formato y límites. */
export function check(def: FieldDef, value: FormValue | undefined, ctx: CheckContext): Check {
  const L = ctx.labels;
  const out: Check = { error: "", warning: "" };
  if (def.type === "readonly") return out;
  if (def.type === "rows") {
    const n = Array.isArray(value) ? value.length : 0;
    const min = Math.max(numLimit(def.min) ?? 0, def.required ? 1 : 0);
    const max = numLimit(def.max);
    if (n < min) out.error = fill(L.rowsMin, { n: min });
    else if (max !== null && n > max) out.error = fill(L.rowsMax, { n: max });
    return out;
  }
  if (isEmpty(value)) {
    if (def.required) out.error = def.type === "checkbox" ? L.check : hasOptions(def.type) ? L.choose : L.required;
    return out;
  }
  if (def.type === "file") {
    if (!isFile(value)) out.error = L.required;
    else if (def.accept && !acceptsFile(def.accept, value.name, value.type)) out.error = fill(L.fileBadType, { accept: acceptText(def.accept) });
    else if (value.size > fileMaxSize(def)) out.error = fill(L.fileTooBig, { max: formatBytes(fileMaxSize(def), ctx.fmt.locale) });
    return out;
  }
  if (def.type === "password") {
    // La contraseña tal cual: un espacio al final también cuenta.
    const pw = typeof value === "string" ? value : "";
    const others = ctx.values ?? {};
    if (def.meter) {
      const unmet = firstUnmet(passwordRules(pw, { minLength: def.minLength, avoid: Array.isArray(def.avoid) ? def.avoid : [] }));
      if (unmet) out.error = L.passwordWeak;
    }
    if (!out.error && def.match && pw !== (others[def.match] ?? "")) out.error = L.passwordMismatch;
    if (!out.error && def.differs && pw === others[def.differs]) out.error = L.passwordSame;
    return out;
  }
  if (def.type === "otp") {
    const n = otpLength(def);
    if (typeof value !== "string" || value.length < n) out.error = fill(L.otp, { n });
    return out;
  }
  const text = typeof value === "string" ? value.trim() : "";
  switch (def.type) {
    case "email": {
      if (!EMAIL.test(text)) out.error = L.email;
      else {
        const fixed = emailTypo(text);
        if (fixed) {
          out.warning = fill(L.emailTypo, { email: fixed });
          out.fix = { label: fill(L.emailFix, { domain: fixed.split("@")[1] }), value: fixed };
        }
      }
      break;
    }
    case "url": {
      let ok = false;
      try {
        const u = new URL(text);
        ok = (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
      } catch {
        ok = false;
      }
      if (!ok) out.error = L.url;
      break;
    }
    case "tel":
      if (/[^\d\s()+.\-/]/.test(text) || text.replace(/\D/g, "").length < 7) out.error = L.tel;
      break;
    case "number":
    case "money":
    case "percent": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        out.error = L.number;
        break;
      }
      const min = numLimit(def.min);
      const max = numLimit(def.max);
      const show = (n: number) => (def.type === "money" ? ctx.fmt.money(n, { currency: def.currency }) : def.type === "percent" ? `${ctx.fmt.number(n * 100)} %` : ctx.fmt.number(n));
      if (min !== null && value < min) out.error = fill(L.min, { min: show(min) });
      else if (max !== null && value > max) out.error = fill(L.max, { max: show(max) });
      break;
    }
    case "date": {
      if (!isISODate(text)) {
        out.error = L.date;
        break;
      }
      const { min, max } = dateBounds(def, ctx.values ?? {}, ctx.today);
      const why = blockedReason(def.blocked ?? null, text);
      if (min && text < min) out.error = fill(L.dateMin, { min: ctx.fmt.date(min) });
      else if (max && text > max) out.error = fill(L.dateMax, { max: ctx.fmt.date(max) });
      else if (why !== null) out.error = why ? fill(L.dateBlockedWhy, { reason: why }) : L.dateBlocked;
      break;
    }
  }
  if (!out.error && (def.type === "text" || def.type === "textarea" || def.type === "tel" || def.type === "email" || def.type === "url")) {
    const n = [...text].length;
    if (typeof def.minLength === "number" && n < def.minLength) out.error = fill(L.minLength, { n: def.minLength });
    else if (typeof def.maxLength === "number" && n > def.maxLength) out.error = fill(L.maxLength, { n: def.maxLength });
    else if (def.pattern) {
      let re: RegExp | null = null;
      try {
        re = new RegExp(`^(?:${def.pattern})$`, "u");
      } catch {
        re = null;
      }
      if (re && !re.test(text)) out.error = def.patternMessage || L.pattern;
    }
  }
  return out;
}

/** El texto de una opción. */
export function optionLabel(def: FieldDef, value: string): string {
  return def.options.find((o) => o.value === value)?.label ?? value;
}

/** Un valor para leerlo: montos y números con el locale, fechas en palabras, opciones con su texto,
 *  sí/no. Vacío es «» (el campo pinta «—»). */
export function displayValue(def: FieldDef, value: FormValue | undefined, fmt: NxFormat, labels: FormLabels, currency?: string): string {
  if (def.type === "checkbox") return value ? labels.yes : labels.no;
  if (isEmpty(value)) return "";
  if (isSecret(def.type)) return labels.masked;
  if (def.type === "rows") return String(Array.isArray(value) ? value.length : 0);
  if (isFile(value)) return value.name;
  if (Array.isArray(value)) return (value as string[]).map((v) => optionLabel(def, String(v))).join(", ");
  if (typeof value === "number") {
    if (def.type === "money") return fmt.money(value, { currency: def.currency ?? currency });
    if (def.type === "percent") return `${fmt.number(value * 100)} %`;
    return fmt.number(value);
  }
  const s = String(value);
  if (def.type === "date" && isISODate(s)) return fmt.date(s);
  if (hasOptions(def.type)) return optionLabel(def, s);
  return s;
}

/**
 * Una fecha escrita como la dicta un documento → ISO. «12/10/2026», «12-10-2026» y «12.10.2026»
 * son día/mes/año, salvo en inglés de EE. UU. (mes/día); una ISO con hora pierde la hora. Lo que no
 * es una fecha válida vuelve tal cual (y el campo dice que no la entiende).
 */
export function parseDateText(s: string, locale = "es-CO"): string {
  const t = s.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (!m) return t;
  const [a, b] = /^en-US\b/i.test(locale) ? [m[2], m[1]] : [m[1], m[2]];
  const out = `${m[3]}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
  return isISODate(out) ? out : t;
}

/** Un valor que llega de afuera (`values`, `fill`, un borrador) → el tipo que el campo guarda. */
export function coerce(def: FieldDef, v: unknown, fmt: NxFormat): FormValue {
  if (def.type === "rows") {
    const subs = def.subs ?? [];
    return (Array.isArray(v) ? v : []).filter(isObj).map((r) => {
      const row: FormRow = {};
      for (const sub of subs) row[sub.key] = coerce(sub, sub.key in r ? r[sub.key] : sub.value, fmt) as FormRow[string];
      return row;
    });
  }
  if (v === null || v === undefined) return def.type === "checkbox" ? false : def.type === "checkboxes" || isMulti(def) ? [] : null;
  // Un archivo solo es un `File`: un texto (el nombre que trae un registro, un borrador) no lo es.
  if (def.type === "file") return isFile(v) ? v : null;
  if (isFile(v)) return null;
  switch (def.type) {
    case "checkbox":
      return v === true || v === "true" || v === 1 || v === "1" || v === "on";
    case "checkboxes":
      return (Array.isArray(v) ? v : [v]).map(str).filter(Boolean);
    case "select":
      // Varios: una lista; «1,2» (lo que manda un formulario plano) también. Uno: el primero.
      if (isMulti(def)) return [...new Set((Array.isArray(v) ? v : str(v).split(",")).map((x) => str(x).trim()).filter(Boolean))];
      return (Array.isArray(v) ? str(v[0]) : str(v)) || null;
    case "number":
    case "money":
    case "percent": {
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      const s = str(v).trim();
      if (!s) return null;
      const plain = Number(s);
      return Number.isFinite(plain) ? plain : fmt.parse(s);
    }
    case "date": {
      const s = parseDateText(str(v), fmt.locale);
      return s || null;
    }
    case "readonly":
      return typeof v === "number" || typeof v === "boolean" ? v : str(v) || null;
    default: {
      const s = str(v);
      return s === "" ? null : s;
    }
  }
}
