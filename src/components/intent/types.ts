/**
 * Lo que se puede pedir con `<nx-intent>`: cada intención es un trámite («Certificado laboral») con
 * las palabras que lo nombran y adónde lleva. Todo es JSON: el servidor arma la lista de quien mira
 * (sus desprendibles como opciones, cada uno con el enlace a su PDF).
 */
export interface IntentOption {
  value: string;
  /** Lo que se muestra cuando se elige («con salario», «Catorcena 19 · 2026»). */
  label: string;
  /** Palabras que la eligen («banco», «crédito»). Sin tildes ni mayúsculas importa igual. */
  keywords?: string[];
  /** Si la opción tiene su propio destino (un PDF), va ahí en vez del de la intención. */
  href?: string;
  newTab?: boolean;
  /** La que se toma si el texto no elige ninguna. */
  default?: boolean;
}

/**
 * Un dato que se saca de lo escrito: `date` («mañana», «el viernes», «14 de octubre»), `month`
 * («en diciembre»), `time` («a las 3», «en la mañana»), `amount` («5 millones») u `option` (una de
 * `options`, por sus palabras).
 */
export interface IntentSlot {
  /** El parámetro de la URL (`?desde=2026-10-14`). */
  name: string;
  type: "date" | "month" | "time" | "amount" | "option";
  options?: IntentOption[];
  /** Antes del valor en el resumen («desde», «para»). */
  label?: string;
  /** `month` sin año: el próximo (`future`, por defecto) o el último que pasó (`past`). */
  direction?: "future" | "past";
}

export interface IntentDef {
  id: string;
  label: string;
  /** Palabras o frases que la nombran («certificado», «carta laboral»). Una palabra vale también como comienzo de otra («vacacion» → «vacaciones»). */
  keywords: string[];
  /** Palabras que la descartan aunque coincidan otras. */
  exclude?: string[];
  href: string;
  newTab?: boolean;
  icon?: string;
  slots?: IntentSlot[];
}

/** Lo que se entendió de un texto. */
export interface IntentMatch {
  intent: IntentDef;
  /** Los valores por nombre de dato: ISO para fechas («2026-10-14») y meses («2026-12»), «HH:MM», un número, o el `value` de la opción. */
  params: Record<string, string>;
  /** Lo que se le muestra a la persona: el trámite y cada dato entendido, ya escritos. */
  chips: string[];
  /** Adónde lleva, con los datos como parámetros (o el destino de la opción elegida). */
  href: string;
  newTab: boolean;
}

export interface IntentLabels {
  /** Nombre del campo para el lector de pantalla. */
  label: string;
  placeholder: string;
  submit: string;
  /** Antes de los chips de lo entendido. */
  understood: string;
  /** Cuando no se reconoce nada. `{list}`: los trámites conocidos. */
  unknown: string;
  examples: string;
}

export interface IntentChangeDetail {
  text: string;
  match: IntentMatch | null;
}

export interface IntentSubmitDetail {
  text: string;
  id: string;
  intent: IntentDef;
  params: Record<string, string>;
  href: string;
  newTab: boolean;
}
