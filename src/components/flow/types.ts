/**
 * Una etapa del flujo, en orden. Un elemento está en la etapa más avanzada cuya hora ya pasó.
 */
export interface FlowStage {
  id: string;
  label: string;
  /** Una nota corta para la etapa vacía («salieron, no han ingresado»). */
  note?: string;
  /** Minutos que se puede quedar en la etapa. Pasado el 75 % (o `warn`), ámbar; pasado el límite, rojo. */
  limit?: number;
  /** Minutos desde los que avisa (por defecto, el 75 % de `limit`; uno igual o mayor que `limit` se ignora). Sin `limit`, solo ámbar. */
  warn?: number;
  /** La etapa final: sus elementos ya salieron del flujo (gris, fuera de la cola). */
  end?: boolean;
}

/**
 * Una hora: ISO 8601 (sin desfase, en la zona `time-zone` del componente) o milisegundos desde 1970
 * (un número menor que 10¹¹ se toma en segundos). Antes de 2000 o después de 2200 no cuenta: un 0
 * o un «0001-01-01» de «sin hora» no estira el día.
 */
export type FlowTime = string | number;

/** Un elemento que recorre el flujo (un viaje, un caso). */
export interface FlowItem {
  id: string | number;
  /** Lo que lo identifica («SZLU4012039»). */
  label: string;
  /** Un segundo renglón («KMZ426 · Jair Elles»). */
  sub?: string;
  /** Un tercer dato («Agape · PIN»). */
  meta?: string;
  /** Un aviso propio del elemento («Inspección con un “No”»): anillo rojo en el punto. `true`, sin texto. */
  flag?: string | boolean;
  /** La hora en que entró a cada etapa, por `id` de etapa. Sin hora, no pasó por ella. */
  times: Record<string, FlowTime | null | undefined>;
  /** Un enlace a su ficha: «Abrir» va ahí en vez de emitir `nx-flow-open`. */
  href?: string;
}

/** Cómo va un elemento en su etapa: a tiempo, cerca del límite, pasado, o terminado. */
export type FlowTone = "ok" | "near" | "over" | "done";

export interface FlowStageDetail {
  /** La etapa elegida, o `null` si se soltó. */
  stage: string | null;
}

export interface FlowItemDetail {
  /** El elemento elegido, o `null` si se soltó. */
  id: string | null;
  item: FlowItem | null;
}

export interface FlowOpenDetail {
  id: string;
  item: FlowItem;
}

export interface FlowLabels {
  /** El título por defecto (sin `heading`). */
  heading: string;
  live: string;
  /** «Viendo las {time}». */
  viewing: string;
  backToNow: string;
  replay: string;
  pause: string;
  /** Bajo el reloj, en vivo. */
  now: string;
  /** Bajo el reloj, mirando otra hora: «hace {d}». */
  ago: string;
  /** Bajo el reloj de un día que ya terminó. */
  dayEnd: string;
  /** El total de la cola. */
  queue: string;
  /** El total de la etapa final. */
  ended: string;
  /** El nombre de lo que fluye: «singular|plural». */
  item: string;
  /** Junto al número de una etapa con `focus`: «de {n}». */
  of: string;
  /** El cambio frente a hace una hora: «{sign}{n} en 1 h». */
  delta: string;
  /** Cuántos pasaron en la última hora, sobre el riel: «{n}/h». */
  rate: string;
  /** El título de ese número: «{n} salieron de «{stage}» en la última hora». */
  rateTitle: string;
  median: string;
  limit: string;
  /** La etapa final: «el último a las {time}». */
  last: string;
  /** La etapa final sin nadie todavía. */
  none: string;
  /** La marca de la etapa que se atasca. */
  neckTag: string;
  /** «Se acumula en {stage}: {count} {items}, {over} {carry} más de {limit}.» */
  neck: string;
  /** El verbo de `neck` según `{over}`: «lleva|llevan». */
  carry: string;
  /** «En la última hora entraron {in} y salieron {out}.» */
  flow: string;
  /** Lo mismo para la primera etapa (no tiene de dónde entrar): «En la última hora salieron {out}.» */
  flowOut: string;
  /** «Todo va a tiempo: {count} {items} en cola, ninguno pasó su límite.» */
  allOk: string;
  /** Sin límites: «{count} {items} en cola. La etapa más llena es {stage}, con {top}.» */
  busiest: string;
  /** No hay nada en cola. */
  calm: string;
  /** Sin etapas. */
  empty: string;
  /** El globo de un punto: «lleva {d} de {limit}». */
  tipAge: string;
  /** Sin límite: «lleva {d}». */
  tipAgeFree: string;
  tipOver: string;
  /** El globo de un punto terminado: «terminó a las {time}». */
  tipEnded: string;
  /** La celda de la etapa actual del elemento elegido: «lleva {d}». */
  cellNow: string;
  open: string;
  close: string;
  legendOk: string;
  legendNear: string;
  legendOver: string;
  legendEnded: string;
  legendFlag: string;
  /** «Cada punto es un {item}.» */
  legendNote: string;
  /** El botón de una etapa: «{stage}: {count} {items}». */
  stageAria: string;
  /** Con `highlight`: «{stage}: {shown} de {count} {items}». */
  stageAriaOf: string;
  /** «, {over} {pass} del límite de {limit}». */
  stageAriaOver: string;
  /** El verbo de `stageAriaOver`: «pasa|pasan». */
  pass: string;
  /** «, mediana {d}». */
  stageAriaMedian: string;
  /** El control de la hora. */
  timeAria: string;
  /** Lo que no cabe en una etapa: «+{n}». */
  more: string;
  minutes: string;
  hours: string;
  hoursMinutes: string;
  days: string;
}
