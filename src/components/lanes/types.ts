/** Una bandeja de un carril, en el orden del trámite. */
export interface LaneStage {
  id: string;
  label: string;
  /** Lo que está aquí espera a otro (el jefe, la EPS): punto hueco, no cuenta como propio. */
  other?: boolean;
  /** Un enlace a la pantalla donde se resuelve: la bandeja es un enlace en vez de emitir `nx-lanes-stage`. */
  href?: string;
}

/** Un carril: un proceso con sus bandejas. */
export interface Lane {
  id: string;
  label: string;
  stages: LaneStage[];
}

/** Un elemento abierto (una solicitud, un caso), parado en una bandeja. */
export interface LaneItem {
  id: string | number;
  /** El `id` de su carril. */
  lane: string;
  /** El `id` de su bandeja dentro del carril. */
  stage: string;
  /** Cuánto lleva sin moverse, en la unidad de `labels.unit` (días por defecto). */
  age: number;
  /** Lo que lo identifica en el globo («#4821»). Sin `label`, el globo dice `#id`. */
  label?: string;
  /** Un segundo renglón del globo. */
  sub?: string;
}

/** El tramo de un punto según `bands`: reciente, normal, cerca del atraso, atrasado. */
export type LaneTone = "fresh" | "ok" | "warn" | "late";

export interface LanesStageDetail {
  lane: string;
  stage: string;
}

export interface LanesItemDetail {
  id: string;
  item: LaneItem;
}

export interface LanesMove {
  id: string;
  lane: string;
  from: string;
  to: string;
}

export interface LanesPlace {
  id: string;
  lane: string;
  stage: string;
}

/** Lo que cambió entre dos `items`: lo que pasó de bandeja, lo que llegó y lo que salió. */
export interface LanesChangeDetail {
  moved: LanesMove[];
  added: LanesPlace[];
  removed: LanesPlace[];
}

/** Las cifras del carril en foco, para pintar al lado una tarjeta «En foco». */
export interface LanesSpotlightDetail {
  /** El carril en foco, o `null` si no hay ninguno. */
  lane: string | null;
  label: string;
  /** Su puesto entre los carriles que rota `cycle` (1, 2…), o 0 si no está entre ellos. */
  index: number;
  total: number;
  /** Lo que espera al dueño del tablero (bandejas sin `other`). */
  own: number;
  /** Lo que espera a otro. */
  other: number;
  /** Lo propio en el último tramo de `bands`. */
  late: number;
  /** Lo propio por tramo, en el orden de `bands` (uno más que `bands`). */
  tones: number[];
  /** Lo propio más viejo. */
  oldest: { id: string; age: number; stage: string; stageLabel: string } | null;
  /** La bandeja propia con más atrasados (o la más llena si no hay atrasados). */
  jam: { stage: string; label: string; late: number; count: number } | null;
}

export interface LanesLabels {
  /** El nombre del conjunto para el lector de pantalla cuando no hay `heading`. */
  heading: string;
  /** El nombre de lo que se cuenta: «singular|plural». */
  item: string;
  /** La unidad de `age`: «singular|plural». */
  unit: string;
  /** La edad corta: «{n} d». */
  age: string;
  /** Bajo el número del carril: «el más viejo {age}». */
  oldest: string;
  /** Un carril sin nada propio. */
  calm: string;
  /** El globo de lo que espera a otro en un carril: «{n} esperan a otro». */
  others: string;
  /** La leyenda del primer tramo: «{from} a {to} {unit}». */
  bandFirst: string;
  /** La de los tramos del medio: «{from} a {to}». */
  band: string;
  /** La del último: «Más de {n}». */
  bandLast: string;
  /** La leyenda del punto hueco. */
  other: string;
  /** Lo que no cabe en una bandeja: «+{n}». */
  more: string;
  /** El grupo de un carril: «{lane}: {count} {items}». */
  laneAria: string;
  /** El botón de una bandeja: «{stage}: {count} {items}». */
  stageAria: string;
  /** «, {late} con más de {n} {unit}». */
  stageAriaLate: string;
  /** «, esperan a otro». */
  stageAriaOther: string;
  /** El globo de un punto: «{n} {unit} sin moverse». */
  tipAge: string;
  /** El globo de un punto hueco. */
  tipOther: string;
  /** Sin carriles. */
  empty: string;
}
