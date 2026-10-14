/**
 * `<nx-award>`: tipos. Todo es JSON (BDUI): proveedores, artículos, cotizaciones, criterios y la
 * recomendación, que llega como eventos (del `endpoint`, en streaming, o en la prop `advice`).
 * El componente no puntúa ni decide: la recomendación es del backend y la elección, del comprador.
 *
 * Lo adjudicado son **repartos**: un artículo puede ir entero a un proveedor, repartirse entre
 * varios por cantidad o quedar sin adjudicar. Las cantidades se redondean a milésimas.
 */

export interface AwardSupplier {
  id: string;
  /** «Ferrex». */
  name: string;
  /** Una línea corta bajo el nombre: «★ 4,6 · 5 días». */
  detail?: string;
  /** Lo que el comprador debe saber antes de adjudicarle: «Póliza de cumplimiento vencida». Se
   *  le puede adjudicar, pero la alerta queda por revisar en los artículos que se le den. */
  alert?: string;
  /** No se le puede adjudicar, y por qué: «Inhabilitado por calidad». */
  blocked?: string;
}

export interface AwardItem {
  id: string;
  /** «Tubo PVC ½" x 6 m». */
  name: string;
  /** Cantidad pedida. Sin ella (lo pedido es un texto: «servicio mensual»), el artículo no se
   *  reparte: va entero a un proveedor, por lo que este ofreció. */
  qty?: number;
  /** Lo pedido tal como se escribió, si no es un número: «90 unidades/mes». */
  qtyText?: string;
  /** «und», «m», «bulto». */
  unit?: string;
  /** Código del artículo (va en el detalle). */
  code?: string;
  /** Categoría: los artículos se agrupan por ella, en el orden en que aparecen. */
  group?: string;
}

/** Lo que cotizó un proveedor por un artículo. */
export interface AwardQuote {
  item: string;
  supplier: string;
  /** Precio unitario comparable, en la moneda del componente: ya normalizado por unidad o
   *  empaque, moneda e impuestos. Es el número que se compara. */
  price: number;
  /** Cuánto ofrece (una oferta parcial: pidieron 150 y da 120). Sin él, todo lo pedido. Nunca se
   *  le adjudica más de esto. */
  offered?: number;
  /** Días de entrega de esta cotización. */
  leadTime?: number;
  /** Lo que cotizó de verdad, antes de normalizar: «US$ 4,20 la caja x12 · TRM 4.150». */
  original?: string;
  /** Una nota del proveedor: «Marca Pavco». */
  note?: string;
}

/** Una parte de un reparto: a quién y cuánto (sin `qty`, todo lo que puede: lo pedido, o lo
 *  ofrecido si es menos). */
export interface AwardSplit {
  supplier: string;
  qty?: number;
}

/** Una línea de lo adjudicado: lo que se le compra a un proveedor de un artículo. `qty` falta
 *  solo si ni lo pedido ni lo ofrecido tienen número. */
export interface AwardAllocation {
  item: string;
  supplier: string;
  qty?: number;
}

/** Un criterio de la recomendación. `weight` es relativo (se reparte sobre la suma). */
export interface AwardCriterion {
  id: string;
  /** «Precio». */
  label: string;
  weight: number;
}

/** Un proveedor en el ranking de un artículo: `score` (0–100) y lo que sacó en cada criterio (0–100). */
export interface AwardRank {
  supplier: string;
  score: number;
  scores?: Record<string, number>;
}

/** La recomendación para un artículo: su reparto (en el protocolo, `supplier` para darlo entero a
 *  uno, o `allocations`). Vacío: no hay a quién recomendar (nadie cubre lo pedido). */
export interface AwardRecommendation {
  item: string;
  allocations: AwardSplit[];
  /** Una frase: «El más barato con entrega en 3 días». */
  reason?: string;
  /** Mejor primero (opcional: sin él, el detalle ordena por precio). */
  ranking: AwardRank[];
}

export type AwardTone = "neutral" | "warning" | "danger";

/** Algo que merece que el comprador mire la fila. Con `supplier`, se marca también su celda. */
export interface AwardFlag {
  item: string;
  supplier?: string;
  /** «48 % bajo la mediana: ¿precio de otra unidad?». */
  message: string;
  tone: AwardTone;
}

/** Una alternativa completa a «lo mejor por artículo»: `picks` le da cada uno de esos artículos,
 *  entero, a un proveedor. */
export interface AwardScenario {
  id: string;
  /** «Máximo 3 proveedores». */
  label: string;
  detail?: string;
  picks: Record<string, string>;
}

export interface AwardNote {
  message: string;
  tone: AwardTone;
}

/** Una línea del stream de la recomendación (o un elemento de `advice` / `respond(events)`). */
export type AwardEvent =
  | ({ type: "recommend" } & AwardRecommendation)
  | ({ type: "flag" } & AwardFlag)
  | ({ type: "scenario" } & AwardScenario)
  | ({ type: "note" } & AwardNote)
  | { type: "error"; message: string }
  | { type: "done" };

/** Lo que decidió el comprador en un artículo: su reparto (`[]`: no se adjudica) y el motivo. Los
 *  artículos sin elección siguen a la sugerencia. */
export interface AwardChoice {
  item: string;
  allocations: AwardSplit[];
  reason?: string;
}

/** Lo que muestran las celdas: precio unitario, total de la línea, plazo o puntaje. */
export type AwardLens = "price" | "total" | "lead" | "score";

/** Qué filas se ven. */
export type AwardFilter = "all" | "alerts" | "changed";

/** Detalle de `nx-award-advise`: sin `endpoint`, la app recomienda con estos pesos y exclusiones
 *  y responde con los eventos del protocolo (ya, o después de `preventDefault()`, dentro de `timeout`). */
export interface AwardAdviseDetail {
  weights: Record<string, number>;
  excluded: string[];
  respond(events: unknown[]): void;
}

/** Qué cambió: una elección del comprador, o una recomendación nueva (`advice`) que movió lo
 *  adjudicado de los artículos que seguían a la sugerencia. */
export type AwardChangeKind = "pick" | "split" | "skip" | "undo" | "reason" | "bulk" | "revert" | "scenario" | "weights" | "exclude" | "motive" | "advice";

/** Detalle de `nx-award-change`: el estado completo, para guardar un borrador tal cual. */
export interface AwardChangeDetail {
  kind: AwardChangeKind;
  /** El artículo que cambió (`null` si fueron varios o ninguno). */
  item: string | null;
  /** Los artículos cuyo reparto cambió. */
  items: string[];
  value: AwardAllocation[];
  choices: AwardChoice[];
  weights: Record<string, number>;
  excluded: string[];
  scenario: string;
  motive: string;
}

export interface AwardOrderLine {
  item: string;
  /** Sin número si ni lo pedido ni lo ofrecido lo tienen (el total es el precio). */
  qty?: number;
  price: number;
  total: number;
}

/** Una orden de compra: todo lo adjudicado a un proveedor. */
export interface AwardOrder {
  supplier: string;
  lines: AwardOrderLine[];
  total: number;
}

/** Un artículo donde el comprador se apartó de la sugerencia (otro proveedor, otra cantidad o
 *  nada). Los artículos sin sugerencia son decisión libre y no cuentan. */
export interface AwardChange {
  item: string;
  allocations: AwardSplit[];
  recommended: AwardSplit[];
  reason?: string;
  /** Lo que cuesta de más (o de menos, negativo) frente a la sugerencia. */
  delta: number;
}

/** Detalle de `nx-award-submit`: lo adjudicado, las órdenes por proveedor y la trazabilidad. Si la
 *  app guarda en el servidor, llama `wait(promesa)`: el botón queda en «Generando…» y no se puede
 *  volver a enviar hasta que la promesa termine (si falla, su mensaje se muestra y se puede
 *  reintentar). */
export interface AwardSubmitDetail {
  value: AwardAllocation[];
  orders: AwardOrder[];
  changes: AwardChange[];
  /** Sin cambios frente a la sugerencia. */
  followed: boolean;
  total: number;
  /** Artículos sin adjudicar (nadie cotizó, nadie cubría lo pedido, o el comprador lo dejó). */
  unassigned: string[];
  /** Artículos con menos de lo pedido. */
  partial: string[];
  /** El motivo de la decisión (toda la adjudicación). */
  motive: string;
  /** El escenario aplicado (`""`, lo mejor por artículo). */
  scenario: string;
  /** Los pesos y exclusiones de la recomendación que se ve (no los de un pedido que falló). */
  weights: Record<string, number>;
  excluded: string[];
  /** Alertas sin abrir. */
  pending: number;
  /** La misma adjudicación da la misma clave: sirve de `Idempotency-Key`. */
  key: string;
  wait(work: Promise<unknown>): void;
}

export interface AwardLabels {
  /** Nombre de la tabla sin `heading`. */
  table: string;
  /** Primera columna. */
  item: string;
  /** Pie de la tabla. */
  awarded: string;
  total: string;
  vsAi: string;
  /** Sin cambios frente a la sugerencia. */
  same: string;
  /** «1 cambio» / «{n} cambios». */
  changeOne: string;
  changeMany: string;
  orders: string;
  /** «1 proveedor» / «{n} proveedores». */
  supplierOne: string;
  supplierMany: string;
  pending: string;
  /** Bajo el número de alertas por revisar: «de {total} alertas». */
  pendingOf: string;
  /** Todas las alertas abiertas. */
  reviewed: string;
  /** Sin alertas. */
  noAlerts: string;
  next: string;
  /** «{n} sin adjudicar». */
  unassigned: string;
  /** «{n} con menos de lo pedido». */
  partial: string;
  lens: string;
  lensPrice: string;
  lensTotal: string;
  lensLead: string;
  lensScore: string;
  /** Filtro de filas. */
  show: string;
  filterAll: string;
  filterAlerts: string;
  filterChanged: string;
  scenario: string;
  /** El escenario base. */
  best: string;
  criteria: string;
  reset: string;
  /** Lo que se lee después de una celda sugerida. */
  suggested: string;
  noQuote: string;
  nobody: string;
  /** Marca de la fila que se apartó de la sugerencia. */
  changed: string;
  /** La fila que el comprador dejó sin adjudicar. */
  skipped: string;
  /** «faltan {n}»: lo adjudicado no llega a lo pedido. */
  short: string;
  /** «Ofrece {qty}» (oferta parcial). */
  offers: string;
  /** «Elegir a {name}» (todo el artículo). */
  pick: string;
  /** «Cantidad para {name}». */
  qtyFor: string;
  /** «Quedan {n} sin adjudicar.». */
  left: string;
  /** «Elegiste {supplier}: {delta} frente a la sugerencia.». */
  youChose: string;
  /** «Tu reparto: {delta} frente a la sugerencia.». */
  youSplit: string;
  /** «No se adjudica: {delta} frente a la sugerencia.». */
  youSkip: string;
  /** Sin sugerencia: «Elegiste {supplier}.». */
  youChoseFree: string;
  /** Sin sugerencia y repartido: «Tu reparto.». */
  youSplitFree: string;
  reason: string;
  undo: string;
  /** «No adjudicar». */
  skip: string;
  excluded: string;
  exclude: string;
  include: string;
  /** Proveedor que no se puede elegir: «No elegible». */
  blocked: string;
  giveAll: string;
  /** «1 artículo pasó a {supplier}.» / «{n} artículos pasaron a {supplier}.». */
  gaveOne: string;
  gaveAll: string;
  /** El motivo que llevan esos artículos: «Consolidar en {supplier}». */
  bulkReason: string;
  /** Deshacer lo último en bloque. */
  revert: string;
  /** «{quoted} cotizados · {awarded} adjudicados · {total}». */
  supplierStats: string;
  close: string;
  /** El motivo de toda la decisión. */
  motive: string;
  submit: string;
  /** El botón mientras la app guarda. */
  submitting: string;
  /** «Generar órdenes» mientras llega una recomendación. */
  busy: string;
  needReview: string;
  /** «Falta el motivo del cambio en {name}.». */
  needReason: string;
  needMotive: string;
  /** «{supplier} no es elegible ({name}).». */
  needEligible: string;
  /** No se pudo guardar (la promesa de `wait` falló sin mensaje). */
  saveError: string;
  advising: string;
  error: string;
  /** La recomendación se cortó antes de terminar. */
  partialAdvice: string;
  /** Tardó más que `timeout`. */
  timeout: string;
  /** «La nueva sugerencia cambió 1 artículo.» / «… {n} artículos.». */
  movedOne: string;
  movedMany: string;
  retry: string;
  /** «{n} d». */
  days: string;
  /** «{n} pts». */
  points: string;
  /** Antes del precio original: «Cotizó». */
  quoted: string;
  /** «{n} art.». */
  count: string;
}
