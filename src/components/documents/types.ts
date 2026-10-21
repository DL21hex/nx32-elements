/** `<nx-documents>`: tipos. Todo es JSON: los documentos de una persona pueden venir del backend. */

/** `ok` (por defecto), `missing` (falta), `review` (lo revisa alguien) o `rejected` (no sirvió). */
export type DocumentStatus = "ok" | "missing" | "review" | "rejected";

/** El dibujo cuando no hay miniatura: un carné, una hoja, un pasaporte, una tarjeta, una foto, una
 *  firma, varios papeles o un examen. */
export type DocumentKind = "id" | "page" | "passport" | "card" | "photo" | "signature" | "stack" | "medical";

/** Un uso del documento: qué módulo o trámite lo tomó, cuándo y para qué. */
export interface DocumentUse {
  /** Fecha ISO («2026-08-12»). */
  at: string;
  /** Quién lo usó («Viáticos»). */
  by: string;
  /** Para qué («VIA-0331 · tiquete Medellín–Bogotá»). */
  purpose?: string;
}

/** Un dato leído del documento («Número» · «1.036.482.117»). */
export interface DocumentField {
  label: string;
  value: string;
}

export interface DocumentItem {
  id: string;
  /** «Cédula de ciudadanía». */
  name: string;
  status?: DocumentStatus;
  kind?: DocumentKind;
  /** Una imagen del documento (del mismo origen o https). Sin ella, el dibujo de `kind`. */
  thumbnail?: string;
  /** Una línea debajo del nombre cuando no hay nada más que decir («Contador público · 184562-T»). */
  detail?: string;
  /** Por qué hace falta (si falta) o por qué no sirvió (si se rechazó). */
  reason?: string;
  /** Vencimiento (ISO). Con `issued`, la barra de vigencia del detalle. */
  expires?: string;
  issued?: string;
  /** Quién lo pide («Nómina», «Viáticos»). */
  askedBy?: string[];
  /** Quién lo ha usado: la persona sabe a dónde fue su documento. */
  uses?: DocumentUse[];
  /** Lo que se leyó de él. */
  fields?: DocumentField[];
  /** Lo que se comprobó («El número coincide con tu perfil»). */
  checks?: string[];
  addedAt?: string;
  addedBy?: string;
  /** Una advertencia con candado en el detalle («Dato sensible: aquí solo queda el concepto»). */
  note?: string;
  /** El archivo para verlo (se abre en otra pestaña). */
  href?: string;
  /** `false`: no se reemplaza desde aquí (el examen médico lo sube Seguridad y Salud). */
  replaceable?: boolean;
}

/** El estado que se ve, ya calculado con la fecha de hoy. */
export type DocumentStateKey = "missing" | "rejected" | "review" | "expired" | "expiring" | "ok";
export type DocumentTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface DocumentState {
  key: DocumentStateKey;
  tone: DocumentTone;
  /** «Falta», «Vence en 49 días», «Vigente hasta 14 oct 2036»… */
  label: string;
  /** Días que faltan para vencer (negativo: vencido). */
  days?: number;
}

/** Cuántos hay de cada cosa que pide atención: para el estado de una pestaña o un aviso. */
export interface DocumentsSummary {
  total: number;
  missing: number;
  rejected: number;
  expired: number;
  expiring: number;
  review: number;
}

export interface DocumentsLabels {
  missing: string;
  rejected: string;
  review: string;
  expired: string;
  expiresToday: string;
  expiresTomorrow: string;
  /** «Vence en {n} días». */
  expiresIn: string;
  /** «Vigente hasta {date}». */
  validUntil: string;
  valid: string;
  /** La línea de una tarjeta: «Usado en {n} trámites» (y en singular). */
  usedIn: string;
  usedInOne: string;
  /** El nombre de la rejilla para el lector. */
  list: string;
  /** El panel. */
  read: string;
  askedBy: string;
  uses: string;
  noUses: string;
  /** «Subido el {date} por {by}» (o sin quién). */
  added: string;
  addedNoBy: string;
  view: string;
  close: string;
  done: string;
  replace: string;
  upload: string;
  /** La descripción del panel para subir: «Súbelo una vez; lo toman los trámites que lo piden». */
  uploadHint: string;
  /** La de reemplazar: «La versión anterior queda en el historial». */
  replaceHint: string;
  choose: string;
  drop: string;
  /** «PDF o imagen, hasta {max}». */
  limits: string;
  or: string;
  /** «Leyendo {file}…». */
  reading: string;
  /** Al terminar: «Listo: {name} quedó guardado». */
  saved: string;
  badType: string;
  /** «El archivo pasa de {max}». */
  tooBig: string;
  /** El resumen: «Faltan {n}», «Falta 1», «{n} por vencer», «1 vencido»… */
  sumMissing: string;
  sumMissingOne: string;
  sumExpiring: string;
  sumExpired: string;
  sumExpiredOne: string;
  /** Las condiciones del archivo con un `accept` propio: «Hasta {max}». */
  limitsAny: string;
  sumReview: string;
  sumOk: string;
}

/** `nx-documents-open`: se pidió ver un documento. Cancelable: con `preventDefault()` la app abre lo suyo. */
export interface DocumentsOpenDetail {
  id: string;
  item: DocumentItem;
}

/** `nx-documents-upload`: se pidió subir o reemplazar. Cancelable: la app abre lo suyo. */
export interface DocumentsUploadDetail {
  id: string;
  item: DocumentItem;
}

/** `nx-documents-file`: se eligió (o llegó del celular) un archivo que sirve. Cancelable. La app lo
 *  sube y lo lee con `busy` puesto, y luego asigna `items` con el documento ya guardado. */
export interface DocumentsFileDetail {
  id: string;
  item: DocumentItem;
  file: File;
}
