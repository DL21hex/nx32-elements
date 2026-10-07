/**
 * Llenar un formulario con su origen. `<nx-paste-fill>`, `<nx-scan>` y `<nx-doc-capture>` entregan lo
 * que leyeron a un `<nx-form>` —el de su `for`, el que las contiene o el que envuelven— con
 * `fill(valores, origen)`: cada dato queda con su chip («Texto pegado», «Escáner», «Factura
 * FE-10482»), nada pisa lo que escribió la persona y el llenado se deshace entero. Sin un `<nx-form>`
 * de destino, cada una sigue llenando como siempre.
 *
 * Se reconoce por la etiqueta y el método, no por la clase: así este módulo no arrastra el
 * formulario a quien no lo usa, y un `<nx-form>` que todavía no se define no cuenta.
 */

export interface FillSource {
  label: string;
  detail?: string;
}

/** Un campo del esquema, lo que una fuente necesita saber de él. */
export interface FillField {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label?: string }[];
  fields?: FillField[];
}

/** Lo que una fuente usa de `<nx-form>`. */
export interface FillTarget extends HTMLElement {
  fill(values: Record<string, unknown>, source?: FillSource | string | null, options?: { force?: boolean; details?: Record<string, string> }): number;
  undo(): boolean;
  readonly sections: { fields: FillField[] }[];
}

const isForm = (el: Element | null | undefined): el is FillTarget => !!el && el.localName === "nx-form" && typeof (el as Partial<FillTarget>).fill === "function";

/** El `<nx-form>` de destino de `el`: el de `forId` (o el que hay adentro de ese elemento), el que
 *  contiene a `el` o el que `el` envuelve. `null` si no hay. */
export function fillTarget(el: Element, forId?: string | null): FillTarget | null {
  if (forId) {
    const t = el.ownerDocument.getElementById(forId);
    if (isForm(t)) return t;
    const inner = t?.querySelector("nx-form");
    return isForm(inner) ? inner : null;
  }
  const up = el.parentElement?.closest("nx-form");
  if (isForm(up)) return up;
  const down = el.querySelector("nx-form");
  return isForm(down) ? down : null;
}
