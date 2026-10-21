/** `<nx-password>`: tipos. */

/**
 * Las condiciones de una contraseña nueva (con `meter`): el largo, no llevar el nombre ni el
 * documento de la persona (`avoid`), no ser de las más usadas, no aparecer en filtraciones
 * (`breach-endpoint`) y ser distinta de la actual (`differs`).
 */
export type PasswordRuleId = "length" | "avoid" | "common" | "breach" | "differs";

export interface PasswordRule {
  id: PasswordRuleId;
  label: string;
  /** `null`: todavía no se sabe (la revisión de filtraciones va en camino o no se pudo hacer). */
  ok: boolean | null;
}

/** Qué tan difícil de adivinar: 0 (vacía) a 4. */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export interface PasswordLabels {
  show: string;
  hide: string;
  capsLock: string;
  /** El nivel junto al medidor: «Seguridad: {level}». */
  strength: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
  /** «{n} caracteres o más». */
  ruleLength: string;
  ruleAvoid: string;
  ruleCommon: string;
  ruleBreach: string;
  ruleDiffers: string;
  /** Mientras se revisa en las filtraciones. */
  checking: string;
  /** No se pudo revisar (sin conexión): no bloquea. */
  unchecked: string;
  /** Nombre de la lista de condiciones para el lector. */
  rules: string;
  required: string;
  /** La validez cuando falta una condición: «Todavía no cumple: {rule}». */
  unmet: string;
  /** La de la confirmación (`match`) que no coincide. */
  mismatch: string;
}

/** `nx-password-change`: cada vez que cambia. No trae la contraseña (que no termine en un log). */
export interface PasswordChangeDetail {
  strength: PasswordStrength;
  /** Cumple todas las condiciones que ya se saben (y coincide, con `match`). */
  ok: boolean;
  rules: PasswordRule[];
}
