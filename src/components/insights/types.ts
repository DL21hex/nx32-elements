export type InsightTone = "bad" | "good" | "neutral";
export type InsightIcon = "up" | "down" | "calendar" | "list" | "season" | "money" | "people" | "info";

/**
 * Lo que se hace con una frase: un enlace (`href`, `newTab`), un filtro del tablero (`filter`, con la
 * sintaxis de `data-nx-filter`: `"dow:1"`) o, sin ninguno de los dos, un botón que solo avisa
 * (`nx-insights-action`). Con `href`, el `filter` se ignora.
 */
export interface InsightAction {
  label: string;
  href?: string;
  newTab?: boolean;
  filter?: string;
}

/** Una frase que lee los datos: qué pasa, con su marca y, si aplica, qué mirar. */
export interface InsightItem {
  id: string;
  /** La frase. Admite énfasis con `**así**` (y solo eso). */
  text: string;
  /** `bad`, `good` o `neutral` (por defecto): el color de la marca. */
  tone?: InsightTone;
  /** La marca: `up`, `down`, `calendar`, `list`, `season`, `money`, `people` o `info` (por defecto). */
  icon?: InsightIcon;
  action?: InsightAction;
}

/** Un trozo de la frase: texto suelto o `{b}` en negrita. */
export type EmphasisPart = string | { b: string };

export interface InsightsLabels {
  /** Nombre de la lista para el lector de pantalla. */
  group: string;
  /** Sin frases (si el autor no puso `empty`). */
  empty: string;
}

export interface InsightsActionDetail {
  item: InsightItem;
}
