/** `<nx-otp>`: tipos. */

/** `numeric` (por defecto): solo dígitos. `alphanumeric`: letras y dígitos, en mayúsculas. */
export type OtpKind = "numeric" | "alphanumeric";

export interface OtpLabels {
  /** El nombre de cada casilla para el lector: «Dígito {n} de {total}». */
  digit: string;
  /** El nombre del grupo si no hay `label` ni un `<label>` que lo nombre. */
  group: string;
  /** La validez de un código obligatorio que falta: el <form> no se envía. */
  required: string;
  /** La validez de un código a medias: «Faltan {n}». */
  incomplete: string;
}

/** `nx-otp-change`: cada vez que cambia una casilla. */
export interface OtpChangeDetail {
  value: string;
  /** Están todas llenas. */
  complete: boolean;
}

/** `nx-otp-complete`: la última casilla se llenó (una vez por código). */
export interface OtpCompleteDetail {
  value: string;
}
