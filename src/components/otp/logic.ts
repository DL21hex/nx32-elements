/**
 * `<nx-otp>`: la lógica sin DOM. Qué caracteres valen, cuántas casillas hay y cómo se reparte un
 * código pegado (o el que llena el celular solo, que llega entero en la primera casilla).
 */
import type { OtpKind } from "./types";

export const OTP_MIN = 4;
export const OTP_MAX = 8;
export const OTP_DEFAULT = 6;

/** Cuántas casillas: de 4 a 8 (6 por defecto). */
export function cleanLength(v: unknown): number {
  const n = Math.round(Number(v));
  return v !== null && v !== "" && n >= OTP_MIN && n <= OTP_MAX ? n : OTP_DEFAULT;
}

export function cleanKind(v: unknown): OtpKind {
  return v === "alphanumeric" ? "alphanumeric" : "numeric";
}

/**
 * Lo que sirve de un texto, en orden: los dígitos (también los de ancho completo, «１２３», que
 * escribe algún teclado) o, con `alphanumeric`, letras y dígitos sin tildes y en mayúsculas.
 * Espacios, guiones y lo demás se ignoran: «482 113» y «482-113» son el mismo código.
 */
export function sanitize(text: unknown, kind: OtpKind = "numeric"): string {
  if (typeof text !== "string" && typeof text !== "number") return "";
  const s = String(text).normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return kind === "alphanumeric" ? s.replace(/[^a-z0-9]/gi, "").toUpperCase() : s.replace(/\D/g, "");
}

/** Las casillas de un valor: recortado a `length` y relleno con vacías. */
export function charsOf(value: unknown, length: number, kind: OtpKind = "numeric"): string[] {
  const s = sanitize(value, kind).slice(0, length);
  return Array.from({ length }, (_, i) => s[i] ?? "");
}

/**
 * Reparte `text` desde la casilla `from`: un código pegado o el que llena el celular. Si el texto
 * trae justo `length` caracteres, es el código entero y empieza en la primera, esté donde esté el
 * cursor. Devuelve las casillas nuevas y la que sigue (la última, si se llenaron todas).
 */
export function spread(chars: readonly string[], from: number, text: string, kind: OtpKind = "numeric"): { chars: string[]; next: number } {
  const n = chars.length;
  const s = sanitize(text, kind);
  const out = [...chars];
  if (!s) return { chars: out, next: Math.min(Math.max(from, 0), n - 1) };
  const start = s.length >= n ? 0 : Math.min(Math.max(from, 0), n - 1);
  let i = start;
  for (const c of s) {
    if (i >= n) break;
    out[i++] = c;
  }
  return { chars: out, next: Math.min(i, n - 1) };
}

/** El código: las casillas juntas (las vacías no cuentan). */
export function joinCode(chars: readonly string[]): string {
  return chars.join("");
}

/** Todas llenas. */
export function isComplete(chars: readonly string[]): boolean {
  return chars.length > 0 && chars.every((c) => c !== "");
}

/** La primera casilla vacía, o la última si están todas llenas. */
export function firstEmpty(chars: readonly string[]): number {
  const i = chars.findIndex((c) => c === "");
  return i < 0 ? chars.length - 1 : i;
}
