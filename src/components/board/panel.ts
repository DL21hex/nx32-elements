/**
 * `<nx-board-panel>`: un panel del tablero. Su título y subtítulo, sus controles (`slot="actions"`,
 * a la derecha del título) y su contenido (cualquier otro hijo: un gráfico, una tabla, una lista).
 *
 * - **`span`** dice cuántas de las 12 columnas ocupa. Cuando el tablero se angosta, los de 7 o más
 *   pasan a ocupar todo el ancho y los de 6 o menos, la mitad; en lo angosto, todos van a lo ancho.
 * - **`dimension`** es la dimensión del panel (o varias, separadas por espacio): la que sus marcas
 *   filtran. El panel no se filtra por ella; resalta lo elegido y atenúa el resto. `filters` da lo que
 *   el panel tiene que pedir: los del tablero menos los suyos.
 * - **`personal`**: muestra datos de personas (nombres). Con el tablero `restricted` y un filtro
 *   sensible, el tablero lo reserva: se ve el título y un aviso, no el contenido.
 * - **`busy`**: mientras llegan sus datos; el contenido se atenúa y `aria-busy` lo anuncia.
 *
 * Los hijos no se mueven (la hidratación de Solid sigue intacta): el bloque del título va al final
 * del DOM y la grilla lo sube.
 */
import { attrProps, Base, boolAttr, upgrade } from "../../core/define";
import { h, setAttr } from "../../core/dom";
import { dimList, filtersWithout } from "./logic";
import type { BoardFilters } from "./types";

/** Lo que el panel necesita de su tablero (evita importar `board.ts` y su ciclo). */
interface BoardLike extends HTMLElement {
  filters: BoardFilters;
}

export class NxBoardPanel extends Base {
  static {
    attrProps(this, ["heading", "subheading", "dimension", "variant"]);
  }
  /** El título del panel: un `<h2>`. */
  declare heading: string | null;
  /** Una línea bajo el título (qué mide, en qué unidad). */
  declare subheading: string | null;
  /** La dimensión del panel, o varias separadas por espacio («area mes»). */
  declare dimension: string | null;
  /** `plain`: sin borde ni fondo (un renglón de cifras que ya trae sus tarjetas). */
  declare variant: string | null;
  static observedAttributes = ["heading", "subheading", "dimension", "variant", "span", "personal", "busy"];

  #head?: HTMLDivElement;
  #title?: HTMLHeadingElement;
  #sub?: HTMLParagraphElement;

  /** Las columnas que ocupa, de 1 a 12 (12 si no se dice). */
  get span(): number {
    const n = Number.parseInt(this.getAttribute("span") ?? "", 10);
    return Number.isFinite(n) ? Math.min(12, Math.max(1, n)) : 12;
  }
  set span(v: number | string | null | undefined) {
    const n = Number.parseInt(String(v ?? ""), 10);
    setAttr(this, "span", Number.isFinite(n) ? String(Math.min(12, Math.max(1, n))) : null);
  }
  /** Muestra datos de personas: el tablero lo reserva con un filtro sensible y `restricted`. */
  get personal(): boolean {
    return boolAttr(this, "personal");
  }
  set personal(v: boolean | null | undefined) {
    this.toggleAttribute("personal", !!v);
  }
  /** Sus datos están llegando. */
  get busy(): boolean {
    return boolAttr(this, "busy");
  }
  set busy(v: boolean | null | undefined) {
    this.toggleAttribute("busy", !!v);
  }
  /** Lo que el panel tiene que pedir: los filtros del tablero menos los de su dimensión. */
  get filters(): BoardFilters {
    const board = this.closest("nx-board") as BoardLike | null;
    return filtersWithout(board?.filters ?? {}, dimList(this.dimension));
  }

  connectedCallback(): void {
    upgrade(this);
    this.#paint();
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    if (name === "busy") this.#busy();
    else if (name === "heading" || name === "subheading") this.#paint();
  }

  #busy(): void {
    if (this.busy) this.setAttribute("aria-busy", "true");
    else this.removeAttribute("aria-busy");
  }

  #paint(): void {
    this.#busy();
    const text = (this.heading ?? "").trim();
    const sub = (this.subheading ?? "").trim();
    if (!text && !sub) {
      this.#head?.remove();
      this.#head = this.#title = this.#sub = undefined;
      return;
    }
    this.#head ??= h("div", { class: "nx-board-panel__head" }) as HTMLDivElement;
    if (this.#head.parentNode !== this) this.append(this.#head);
    if (!text) {
      this.#title?.remove();
      this.#title = undefined;
    } else {
      this.#title ??= h("h2", { class: "nx-board-panel__title" }) as HTMLHeadingElement;
      if (this.#title.textContent !== text) this.#title.textContent = text;
      if (this.#title.parentNode !== this.#head) this.#head.prepend(this.#title);
    }
    if (!sub) {
      this.#sub?.remove();
      this.#sub = undefined;
    } else {
      this.#sub ??= h("p", { class: "nx-board-panel__subheading" }) as HTMLParagraphElement;
      if (this.#sub.textContent !== sub) this.#sub.textContent = sub;
      if (this.#sub.parentNode !== this.#head) this.#head.append(this.#sub);
    }
  }
}
