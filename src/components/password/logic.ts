/**
 * `<nx-password>`: la lógica sin DOM. Las condiciones de una contraseña nueva, qué tan difícil es de
 * adivinar y la consulta de filtraciones por k-anonimato (solo los 5 primeros caracteres del SHA-1
 * salen del navegador, como en «Have I Been Pwned»). La usa también `<nx-form>` para validar.
 */
import type { PasswordRule, PasswordRuleId, PasswordStrength } from "./types";

/** El largo mínimo de una contraseña nueva si no se dice otro. */
export const PASSWORD_MIN = 12;

/** Sin tildes, en minúsculas y sin lo que separa («Gómez-2024» → «gomez2024»). */
export function foldPassword(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
const bare = (s: string) => foldPassword(s).replace(/[^a-z0-9]/g, "");

/**
 * Las más usadas (de las listas públicas de filtraciones, más las de aquí: equipos de fútbol,
 * ciudades, «contraseña»). Se comparan sin tildes ni mayúsculas ni lo que separa, y también dentro
 * de una más larga («Qwerty2026!»).
 */
const COMMON = [
  "123456", "1234567", "12345678", "123456789", "1234567890", "12345", "123123", "123321", "112233", "121212", "111111", "000000",
  "654321", "666666", "777777", "888888", "987654321", "1q2w3e4r", "1qaz2wsx", "qwerty", "qwertyuiop", "asdfgh", "asdfghjkl", "zxcvbnm",
  "qazwsx", "password", "passw0rd", "contrasena", "clave", "temporal", "cambiame", "bienvenido", "welcome", "letmein", "iloveyou",
  "teamo", "tequiero", "admin", "administrador", "usuario", "root", "abc123", "abcd1234", "dragon", "monkey", "master", "shadow",
  "sunshine", "princesa", "princess", "superman", "batman", "football", "futbol", "baseball", "soccer", "nacional", "millonarios",
  "americadecali", "junior", "santafe", "colombia", "medellin", "bogota", "barranquilla", "cartagena", "mexico", "argentina",
  "holamundo", "hola", "jesus", "diosesamor", "mariposa", "estrella", "familia", "corazon", "angel", "amor", "nomina", "empresa",
];
const COMMON_SET = new Set(COMMON);

/** Tres o más seguidos en el teclado o en orden («abcd», «4321», «qwer»). */
function isSequence(s: string): boolean {
  if (s.length < 4) return false;
  const rows = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
  for (const r of rows) {
    if (r.includes(s)) return true;
    const rev = [...r].reverse().join("");
    if (rev.includes(s)) return true;
  }
  return false;
}

/**
 * Es de las más usadas: igual a una de la lista (con o sin números o símbolos al final, «Colombia2026*»),
 * la contiene (las de 6 o más), es una secuencia («abcd1234») o un mismo carácter repetido.
 */
export function isCommon(pw: string): boolean {
  const b = bare(pw);
  if (!b) return false;
  if (COMMON_SET.has(b)) return true;
  const letters = b.replace(/\d+$/, "").replace(/^\d+/, "");
  if (letters.length >= 4 && COMMON_SET.has(letters)) return true;
  if (COMMON.some((c) => c.length >= 6 && b.includes(c))) return true;
  if (/^(.)\1+$/.test(b)) return true;
  const parts = b.match(/[a-z]+|\d+/g) ?? [];
  return parts.length > 0 && parts.every((p) => p.length >= 3 && isSequence(p)) && b.length < 16;
}

/**
 * Lleva algo de la persona: una palabra de `avoid` de 3 letras o más (el nombre, el apellido, la
 * empresa) o 5 dígitos seguidos de un número de `avoid` (la cédula, el celular).
 */
export function hasPersonal(pw: string, avoid: readonly string[]): boolean {
  const b = bare(pw);
  const digits = pw.replace(/\D/g, "");
  if (!b) return false;
  for (const raw of avoid) {
    for (const word of foldPassword(String(raw)).split(/[^a-z0-9]+/)) {
      if (/^\d+$/.test(word)) {
        if (word.length < 5) continue;
        for (let i = 0; i + 5 <= word.length; i++) if (digits.includes(word.slice(i, i + 5))) return true;
      } else if (word.length >= 3 && b.includes(word)) return true;
    }
  }
  return false;
}

/** Los bits aproximados: el largo por el tamaño del alfabeto que usa. */
export function passwordBits(pw: string): number {
  if (!pw) return 0;
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9\s]/.test(pw)) pool += 33;
  if (/\s/.test(pw)) pool += 1;
  // Repetir el mismo carácter no suma: «aaaaaaaaaaaa» no es fuerte por larga.
  const distinct = new Set(pw).size;
  const len = Math.min([...pw].length, distinct * 3);
  return len * Math.log2(Math.max(pool, 2));
}

/** 0 (vacía) a 4. Una de las más usadas o con datos de la persona no pasa de 1. */
export function passwordStrength(pw: string, avoid: readonly string[] = []): PasswordStrength {
  if (!pw) return 0;
  if (isCommon(pw) || hasPersonal(pw, avoid)) return 1;
  const bits = passwordBits(pw);
  return bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
}

export interface RuleOptions {
  minLength?: number;
  avoid?: readonly string[];
  /** Hay revisión de filtraciones: su resultado (`null` mientras va o si no se pudo). */
  breach?: boolean | null;
  /** Hay que compararla con la actual: la actual. */
  differs?: string | null;
  labels?: Partial<Record<PasswordRuleId, string>>;
}

/**
 * Las condiciones que aplican, en orden, con si se cumplen. Vacía, ninguna se cumple todavía
 * (salvo la de filtraciones, que no se sabe).
 */
export function passwordRules(pw: string, o: RuleOptions = {}): PasswordRule[] {
  const L = o.labels ?? {};
  const min = Math.max(1, Math.round(Number(o.minLength)) || PASSWORD_MIN);
  const has = !!pw;
  const out: PasswordRule[] = [{ id: "length", label: (L.length ?? "{n} caracteres o más").replace("{n}", String(min)), ok: [...pw].length >= min }];
  if (o.avoid && o.avoid.some((w) => String(w).trim())) out.push({ id: "avoid", label: L.avoid ?? "Sin tu nombre ni tu documento", ok: has && !hasPersonal(pw, o.avoid) });
  out.push({ id: "common", label: L.common ?? "No es de las más usadas", ok: has && !isCommon(pw) });
  if (o.breach !== undefined) out.push({ id: "breach", label: L.breach ?? "No aparece en filtraciones conocidas", ok: has ? o.breach : null });
  if (o.differs !== undefined) out.push({ id: "differs", label: L.differs ?? "Distinta de la actual", ok: has && (o.differs === null || o.differs === "" || pw !== o.differs) });
  return out;
}

/** La primera que no se cumple (una que no se sabe no cuenta como incumplida). */
export function firstUnmet(rules: readonly PasswordRule[]): PasswordRule | undefined {
  return rules.find((r) => r.ok === false);
}

/** El SHA-1 en hexadecimal (mayúsculas), con `crypto.subtle`. `null` si el navegador no lo tiene
 *  (una página sin HTTPS). */
export async function sha1Hex(text: string): Promise<string | null> {
  const subtle = typeof crypto !== "undefined" ? crypto.subtle : undefined;
  if (!subtle) return null;
  const buf = await subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Cuántas veces aparece el resto del hash en la respuesta de un rango («SUFIJO:VECES» por línea, el
 * formato de Have I Been Pwned). 0 si no está.
 */
export function breachCount(body: string, suffix: string): number {
  const want = suffix.toUpperCase();
  for (const line of body.split(/\r?\n/)) {
    const [s, n] = line.trim().split(":");
    if (s && s.toUpperCase() === want) return Math.max(1, Number(n) || 1);
  }
  return 0;
}

/** La dirección del rango: `endpoint` + «/» + los 5 primeros caracteres del hash. */
export function rangeUrl(endpoint: string, prefix: string): string {
  return `${endpoint.replace(/\/+$/, "")}/${prefix}`;
}
