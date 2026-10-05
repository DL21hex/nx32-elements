/**
 * ¿Puede este navegador con la librería? La librería no se protege por componente: en un navegador
 * viejo los colores se pierden (todo sale de `light-dark()`) y los menús no abren (Popover API), sin
 * ningún error a la vista. Es mejor que la app lo pregunte una vez al arrancar y avise con claridad.
 *
 * Solo se comprueba lo que fija el mínimo; lo que se degrada solo (`@starting-style`,
 * `field-sizing`) no cuenta. Un navegador que ni siquiera entiende ES2022 no llega a ejecutar esto:
 * para ese, el aviso tiene que ir fuera del bundle.
 */

/** Lo que puede faltar. */
export type NxFeature = "custom-elements" | "popover" | "light-dark";

export interface NxSupport {
  /** `true` si no falta nada. */
  ok: boolean;
  /** Lo que falta, en este orden: `custom-elements`, `popover`, `light-dark`. */
  missing: NxFeature[];
  /** Las versiones mínimas, para el texto del aviso. */
  minimum: Readonly<{ chrome: number; edge: number; safari: number; firefox: number }>;
}

const MINIMUM = Object.freeze({ chrome: 123, edge: 123, safari: 17.5, firefox: 125 });

function css(...args: [string] | [string, string]): boolean {
  try {
    return typeof CSS !== "undefined" && (CSS.supports as (...a: string[]) => boolean)(...args);
  } catch {
    return false;
  }
}

/** En el servidor (SSR) responde `ok`: la pregunta es del navegador. */
export function nxSupported(): NxSupport {
  const missing: NxFeature[] = [];
  if (typeof document !== "undefined") {
    if (typeof customElements === "undefined") missing.push("custom-elements");
    if (!("showPopover" in HTMLElement.prototype) || !css("selector(:popover-open)")) missing.push("popover");
    if (!css("color", "light-dark(#000, #fff)")) missing.push("light-dark");
  }
  return { ok: missing.length === 0, missing, minimum: MINIMUM };
}
