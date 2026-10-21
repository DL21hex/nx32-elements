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
 * - **Los enlaces** (`links`): páginas relacionadas o archivos, debajo del título (0.17.0).
 * - **Las cifras** (`kpis`): una franja de valores con su etiqueta y, si ayuda, su cambio, debajo
 *   de los enlaces (0.17.0). Para pocas cifras que orientan; un tablero va en `<nx-stats>`.
 * - **La navegación** es el hijo con `slot="nav"` (pestañas que llevan a páginas hermanas, no
 *   filtros de una tabla): al final.
 * - **La página de una persona** («Mi perfil», la ficha de un empleado): `avatar` (su nombre o la
 *   dirección de su foto) va en lugar del ícono, más grande, con sus iniciales y un color que sale
 *   del nombre; con `avatar-action` («Cambiar la foto») lleva un botón que avisa con
 *   `nx-page-header-avatar`.
 *
 * Los hijos no se mueven (la hidratación de Solid sigue intacta): el componente agrega al final el
 * título, el subtítulo, los enlaces y las cifras, y `order` los pone en su lugar (`reading-flow`
 * hace que Tab y el lector sigan ese orden). La letra del título y el cuadro del ícono son
 * `.nx-page-title` de tokens.css, los mismos del título de una tabla: no pueden divergir. El velo
 * del acento no es de la cabecera, es del contenedor de la página (`data-nx-page`).
 */
import { attrProps, Base, upgrade } from "../../core/define";
import { emit, h, safeHref, safeImageSrc } from "../../core/dom";
import { glyph, hasIcon, icon, initials } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import { formatZeroSafe, resolveLocale } from "../../core/locale";
import { hueOf } from "../presence/logic";
import type { PageHeaderAvatarDetail, PageHeaderKpi, PageHeaderLabels, PageHeaderLink, PageHeaderTone } from "./types";

export const PAGE_HEADER_LABELS: PageHeaderLabels = {
  kpis: "Cifras",
  links: "Enlaces",
};

const TONES = new Set<PageHeaderTone>(["neutral", "info", "success", "warning", "danger"]);
const CAMERA = '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>';
/** Una dirección (la foto) y no un nombre. */
const URLISH = /^(?:https?:|\/|\.\.?\/|data:image\/|blob:)/i;
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Las cifras que llegan de afuera (BDUI: JSON): sin etiqueta o sin valor no sirven. */
function cleanKpis(v: unknown): PageHeaderKpi[] {
  if (!Array.isArray(v)) return [];
  return (v as Record<string, unknown>[]).filter(
    (k): k is PageHeaderKpi & Record<string, unknown> => !!k && typeof k === "object" && !!str(k.label) && ((typeof k.value === "number" && Number.isFinite(k.value)) || !!str(k.value)),
  );
}

/** Los enlaces: con una etiqueta y una dirección segura (las demás no se pintan). */
function cleanLinks(v: unknown): PageHeaderLink[] {
  if (!Array.isArray(v)) return [];
  return (v as Record<string, unknown>[]).filter((l): l is PageHeaderLink & Record<string, unknown> => !!l && typeof l === "object" && !!str(l.label) && !!safeHref(str(l.href)));
}

export class NxPageHeader extends Base {
  static {
    attrProps(this, ["heading", "headingIcon", "subheading", "avatar", "avatarAction"]);
  }
  /** La página de una persona: su nombre (para las iniciales) o la dirección de su foto. Va en
   *  lugar de `heading-icon`. */
  declare avatar: string | null;
  /** El texto del botón del avatar («Cambiar la foto»): avisa con `nx-page-header-avatar`. */
  declare avatarAction: string | null;
  /** El título de la página («Empleados»): un `<h1>`. */
  declare heading: string | null;
  /** Un ícono del registro (`registerIcons`) junto al título, en un cuadro con el degradado del
   *  acento: el del módulo («users»). Con un nombre que no está registrado, no se pinta (unas
   *  iniciales se leerían con el título). */
  declare headingIcon: string | null;
  /** Una línea bajo el título, si dice algo que el título no dice. */
  declare subheading: string | null;
  static observedAttributes = ["heading", "heading-icon", "subheading", "avatar", "avatar-action", "kpis", "links", "labels", "locale"];

  /** El bloque del título: el `<h1>` y, debajo, el subtítulo. Va junto a las acciones. */
  #head?: HTMLDivElement;
  #title?: HTMLHeadingElement;
  #titleKey = "";
  #sub?: HTMLParagraphElement;
  #avatarEl?: HTMLSpanElement;
  #avatarKey = "";
  #kpis: PageHeaderKpi[] = [];
  #links: PageHeaderLink[] = [];
  #labels: PageHeaderLabels = PAGE_HEADER_LABELS;
  #kpiEl?: HTMLDListElement;
  #linkEl?: HTMLDivElement;
  /** Lo que tienen pintado las cifras y los enlaces: no se rehacen si no cambió nada. */
  #kpiKey = "";
  #linkKey = "";

  /** Las cifras: `{id?, label, value, delta?, tone?, hint?}`. Sin etiqueta o sin valor, se descarta. */
  get kpis(): PageHeaderKpi[] {
    return this.#kpis;
  }
  set kpis(v: PageHeaderKpi[] | null | undefined) {
    this.#kpis = cleanKpis(v);
    if (this.isConnected) this.#paint();
  }
  /** Los enlaces: `{label, href, icon?, newTab?, download?}`. Una dirección que no es segura no se pinta. */
  get links(): PageHeaderLink[] {
    return this.#links;
  }
  set links(v: PageHeaderLink[] | null | undefined) {
    this.#links = cleanLinks(v);
    if (this.isConnected) this.#paint();
  }
  /** Formato de las cifras numéricas (`es-CO`, `en-US`…). Por defecto, el `lang` más cercano, o «es-CO». */
  get locale(): string {
    return resolveLocale(this);
  }
  set locale(v: string | null | undefined) {
    if (v) this.setAttribute("locale", v);
    else this.removeAttribute("locale");
  }
  /** Textos de la interfaz (`PAGE_HEADER_LABELS`). */
  get labels(): PageHeaderLabels {
    return this.#labels;
  }
  set labels(v: Partial<PageHeaderLabels> | null | undefined) {
    this.#labels = mergeLabels(PAGE_HEADER_LABELS, v);
    this.#kpiKey = this.#linkKey = "";
    if (this.isConnected) this.#paint();
  }

  connectedCallback(): void {
    upgrade(this);
    this.#paint();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "kpis" || name === "links" || name === "labels") {
      if (value === null) return void ((this as unknown as Record<string, unknown>)[name] = null);
      try {
        (this as unknown as Record<string, unknown>)[name] = JSON.parse(value);
      } catch {
        console.warn(`[nx-page-header] el atributo "${name}" no es JSON válido`);
      }
      return;
    }
    if (name === "locale") this.#kpiKey = "";
    if (this.isConnected) this.#paint();
  }

  #paint(): void {
    this.#paintHead();
    this.#paintLinks();
    this.#paintKpis();
  }

  #paintHead(): void {
    const text = (this.heading ?? "").trim();
    const sub = (this.subheading ?? "").trim();
    if (!text && !sub) {
      this.#head?.remove();
      this.#head = this.#title = this.#sub = this.#avatarEl = undefined;
      this.#titleKey = this.#avatarKey = "";
      return;
    }
    this.#head ??= h("div", { class: "nx-page-header__head" }) as HTMLDivElement;
    if (this.#head.parentNode !== this) this.append(this.#head);
    this.#paintAvatar();

    if (!text) {
      this.#title?.remove();
      this.#title = undefined;
      this.#titleKey = "";
    } else {
      this.#title ??= h("h1", { class: "nx-page-header__title nx-page-title" }) as HTMLHeadingElement;
      const name = (this.headingIcon ?? "").trim();
      // Con avatar, el ícono del módulo sobra: la página es de una persona.
      const glyphName = hasIcon(name) && !this.#avatarEl ? name : "";
      const key = `${glyphName}\u0000${text}`;
      if (key !== this.#titleKey) {
        this.#titleKey = key;
        this.#title.replaceChildren(...(glyphName ? [h("span", { class: "nx-page-title__icon", "aria-hidden": "true" }, icon(glyphName))] : []), text);
      }
      if (this.#title.parentNode !== this.#head) this.#head.insertBefore(this.#title, this.#sub?.parentNode === this.#head ? this.#sub : null);
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

  /** El avatar: la foto o las iniciales con el color de la persona, y su botón si hay `avatar-action`. */
  #paintAvatar(): void {
    const head = this.#head!;
    const av = (this.avatar ?? "").trim();
    const src = URLISH.test(av) ? safeImageSrc(av) : undefined;
    const action = (this.avatarAction ?? "").trim();
    const show = !!av && (!URLISH.test(av) || !!src);
    head.classList.toggle("has-avatar", show);
    if (!show) {
      this.#avatarEl?.remove();
      this.#avatarEl = undefined;
      this.#avatarKey = "";
      return;
    }
    const name = (this.heading ?? "").trim() || av;
    const key = JSON.stringify([av, action, name]);
    if (key === this.#avatarKey && this.#avatarEl) {
      if (head.firstElementChild !== this.#avatarEl) head.prepend(this.#avatarEl);
      return;
    }
    this.#avatarKey = key;
    const face = h("span", { class: "nx-page-header__face", "aria-hidden": "true" });
    if (src) face.append(h("img", { src, alt: "", referrerpolicy: "no-referrer" }));
    else {
      face.textContent = initials(av);
      face.style.setProperty("--_h", String(hueOf(av)));
    }
    const btn = action ? h("button", { type: "button", class: "nx-page-header__avatar-act", "aria-label": action, title: action }, glyph(CAMERA)) : null;
    btn?.addEventListener("click", () => emit(this, "nx-page-header-avatar", { action } satisfies PageHeaderAvatarDetail));
    const el = h("span", { class: "nx-page-header__avatar" }, face, btn);
    this.#avatarEl?.replaceWith(el);
    this.#avatarEl = el;
    if (head.firstElementChild !== el) head.prepend(el);
  }

  /** Los enlaces: `<a>` de verdad (el router de la app los intercepta como a cualquier enlace). */
  #paintLinks(): void {
    if (!this.#links.length) {
      this.#linkEl?.remove();
      this.#linkEl = undefined;
      this.#linkKey = "";
      return;
    }
    this.#linkEl ??= h("div", { class: "nx-page-header__links", role: "group" }) as HTMLDivElement;
    if (this.#linkEl.parentNode !== this) this.append(this.#linkEl);
    const key = JSON.stringify([this.#labels.links, this.#links.map((l) => [l.label, l.href, l.icon, l.newTab, l.download, hasIcon(str(l.icon))])]);
    if (key === this.#linkKey) return;
    this.#linkKey = key;
    this.#linkEl.setAttribute("aria-label", this.#labels.links);
    this.#linkEl.replaceChildren(
      ...this.#links.map((l) => {
        const name = str(l.icon);
        const a = h(
          "a",
          { class: "nx-page-header__link", href: safeHref(str(l.href))!, target: l.newTab ? "_blank" : null, rel: l.newTab ? "noopener noreferrer" : null },
          ...(hasIcon(name) ? [h("span", { class: "nx-page-header__link-icon", "aria-hidden": "true" }, icon(name))] : []),
          h("span", null, str(l.label)),
        );
        if (l.download) a.setAttribute("download", typeof l.download === "string" ? l.download : "");
        return a;
      }),
    );
  }

  /** Las cifras: un `<dl>` (la etiqueta es el `<dt>`, el valor el `<dd>`); se ven valor arriba. */
  #paintKpis(): void {
    if (!this.#kpis.length) {
      this.#kpiEl?.remove();
      this.#kpiEl = undefined;
      this.#kpiKey = "";
      return;
    }
    this.#kpiEl ??= h("dl", { class: "nx-page-header__kpis" }) as HTMLDListElement;
    if (this.#kpiEl.parentNode !== this) this.append(this.#kpiEl);
    const locale = resolveLocale(this);
    const key = JSON.stringify([this.#labels.kpis, locale, this.#kpis.map((k) => [k.id, k.label, k.value, k.delta, k.tone, k.hint])]);
    if (key === this.#kpiKey) return;
    this.#kpiKey = key;
    this.#kpiEl.setAttribute("aria-label", this.#labels.kpis);
    let nf: Intl.NumberFormat | undefined;
    // Sin «-0»: ni -0 (una suma vacía en el servidor) ni un negativo que se redondea a cero.
    const value = (v: string | number) => (typeof v === "number" ? formatZeroSafe((nf ??= new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })), v).replace(/[  ]/g, " ") : str(v));
    this.#kpiEl.replaceChildren(
      ...this.#kpis.map((k) => {
        const delta = str(k.delta);
        const tone = k.tone && TONES.has(k.tone) ? k.tone : "neutral";
        return h(
          "div",
          { class: "nx-page-header__kpi", "data-kpi": str(k.id) || null, title: str(k.hint) || null },
          h("dt", { class: "nx-page-header__kpi-label" }, str(k.label)),
          h("dd", { class: "nx-page-header__kpi-value" }, value(k.value), ...(delta ? [h("span", { class: "nx-page-header__kpi-delta", "data-tone": tone }, delta)] : [])),
        );
      }),
    );
  }
}
