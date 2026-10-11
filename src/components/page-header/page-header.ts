/**
 * `<nx-page-header>`: la cabecera de una página. Dónde está (la ruta), qué es (el título, con el
 * ícono de su módulo) y qué se puede hacer en ella (sus acciones, a la derecha del título), y, si la
 * página tiene hermanas, cómo ir a ellas (la navegación, debajo).
 *
 * Es UNA sola cabecera para toda página: la de una tabla, la de un formulario y la de un tablero.
 * El título es suyo; una tabla que es la página no lleva otro (`<nx-grid segments>` pinta sus atajos
 * sin título).
 *
 * - **La ruta** es el hijo del autor sin `slot` (un `<nx-breadcrumb>`), en su propio renglón.
 * - **Las acciones** son el hijo con `slot="actions"` (agrupa ahí tus botones): a la derecha del
 *   título y, si no caben, debajo de él, nunca antes.
 * - **La navegación** es el hijo con `slot="nav"` (pestañas que llevan a páginas hermanas, no
 *   filtros de una tabla): debajo del título.
 *
 * Los hijos no se mueven (la hidratación de Solid sigue intacta): el componente agrega al final el
 * título y el subtítulo, y `order` los pone en su lugar (`reading-flow` hace que Tab y el lector
 * sigan ese orden). La letra del título y el cuadro del ícono son `.nx-page-title` de tokens.css,
 * los mismos del título de una tabla: no pueden divergir. El velo del acento no es de la cabecera,
 * es del contenedor de la página (`data-nx-page`).
 */
import { attrProps, Base, upgrade } from "../../core/define";
import { h } from "../../core/dom";
import { hasIcon, icon } from "../../core/icons";

export class NxPageHeader extends Base {
  static {
    attrProps(this, ["heading", "headingIcon", "subheading"]);
  }
  /** El título de la página («Empleados»): un `<h1>`. */
  declare heading: string | null;
  /** Un ícono del registro (`registerIcons`) junto al título, en un cuadro con el degradado del
   *  acento: el del módulo («users»). Con un nombre que no está registrado, no se pinta (unas
   *  iniciales se leerían con el título). */
  declare headingIcon: string | null;
  /** Una línea bajo el título, si dice algo que el título no dice. */
  declare subheading: string | null;
  static observedAttributes = ["heading", "heading-icon", "subheading"];

  /** El bloque del título: el `<h1>` y, debajo, el subtítulo. Va junto a las acciones. */
  #head?: HTMLDivElement;
  #title?: HTMLHeadingElement;
  #titleKey = "";
  #sub?: HTMLParagraphElement;

  connectedCallback(): void {
    upgrade(this);
    this.#paint();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#paint();
  }

  #paint(): void {
    const text = (this.heading ?? "").trim();
    const sub = (this.subheading ?? "").trim();
    if (!text && !sub) {
      this.#head?.remove();
      this.#head = this.#title = this.#sub = undefined;
      this.#titleKey = "";
      return;
    }
    this.#head ??= h("div", { class: "nx-page-header__head" }) as HTMLDivElement;
    if (this.#head.parentNode !== this) this.append(this.#head);

    if (!text) {
      this.#title?.remove();
      this.#title = undefined;
      this.#titleKey = "";
    } else {
      this.#title ??= h("h1", { class: "nx-page-header__title nx-page-title" }) as HTMLHeadingElement;
      const name = (this.headingIcon ?? "").trim();
      const glyphName = hasIcon(name) ? name : "";
      const key = `${glyphName}\u0000${text}`;
      if (key !== this.#titleKey) {
        this.#titleKey = key;
        this.#title.replaceChildren(...(glyphName ? [h("span", { class: "nx-page-title__icon", "aria-hidden": "true" }, icon(glyphName))] : []), text);
      }
      if (this.#title.parentNode !== this.#head) this.#head.prepend(this.#title);
    }

    if (!sub) {
      this.#sub?.remove();
      this.#sub = undefined;
    } else {
      this.#sub ??= h("p", { class: "nx-page-header__subheading" }) as HTMLParagraphElement;
      if (this.#sub.textContent !== sub) this.#sub.textContent = sub;
      if (this.#sub.parentNode !== this.#head) this.#head.append(this.#sub);
    }
  }
}
