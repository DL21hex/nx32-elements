/**
 * `<nx-launcher>`: tarjetas de navegación a los módulos de un área («Compras», «Talento humano»).
 *
 * Cada tarjeta dice para qué sirve el módulo y trae UN dato vivo (la señal: «7 por aprobar»). Con
 * puntero, al pasar por ella la descripción cede su lugar a las vistas del módulo, para entrar
 * directo a una; en pantallas táctiles las vistas se ven siempre. Una tarjeta destacada ocupa dos
 * columnas («Continuar donde ibas»).
 *
 * Reglas de diseño:
 * - **Light DOM y `<a href>` reales.** El router de la app las intercepta solo; en HTML plano
 *   navegan. `nx-launcher-select` (cancelable) es la puerta para quien quiera decidir otra cosa.
 * - **Nada se mueve al filtrar.** Con `search`, lo que no coincide se apaga en su sitio: la
 *   memoria de dónde está cada módulo vale más que un reacomodo.
 * - **La tarjeta se convierte en la página.** Al abrirla lleva los nombres de View Transitions
 *   `nx-launcher-card`, `-icon` y `-label`; si la página de destino los usa en su encabezado, el
 *   navegador anima el paso (entre documentos con `@view-transition`, o con `startViewTransition`
 *   en una SPA). Al volver, la misma tarjeta los recupera (`pagereveal`, o `reveal()`).
 * - **Las columnas no dejan huérfanas.** Entre las que caben y una menos, las que dejan menos
 *   tarjetas solas en la última fila (4 módulos van en 2 × 2, no en 3 + 1).
 * - **Compacta (`density="compact"`)**, para un inicio con muchas secciones: tarjetas de 190 px, el
 *   nombre completo (en dos líneas si hace falta), la señal en una línea al pie y el título de la
 *   sección con un punto de su color. Por debajo de 600 px cada sección es una lista.
 * - **Secciones que comparten fila (`pack`).** Una rejilla común (subgrid): cada sección ocupa las
 *   columnas de sus tarjetas, y la que no cabe en lo que queda de la fila baja a la siguiente. Las
 *   tarjetas miden lo mismo en todas y el orden no cambia.
 * - **Escribir para ir (`typeahead`).** Sin campo a la vista: escribir con el foco en la página apaga
 *   lo que no coincide y una píldora arriba dice qué abre `Enter`. No se anuncia; es un atajo.
 */
import { Base, boolAttr, upgrade } from "../../core/define";
import { h, safeHref } from "../../core/dom";
import { glyph, icon } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import { nxFormat, resolveLocale } from "../../core/locale";
import { accentOf, balanceColumns, clampMeter, fill, firstTarget, fitColumns, formatBadge, groupBySection, itemHref, itemNewTab, matchItem, moveIndex, packSpans, progressParts, sectionAccent, sparkPaths, type LauncherTarget } from "./logic";
import type { LauncherDensity, LauncherItem, LauncherLabels, LauncherSelectDetail, LauncherSignal } from "./types";

export const LAUNCHER_LABELS: LauncherLabels = {
  nav: "Módulos",
  search: "Ir a",
  placeholder: "Módulo o vista…",
  empty: "Ningún módulo coincide.",
  open: "Enter abre {name}",
  views: "Vistas de {name}",
};

const ARROW = '<path d="M7 17 17 7"/><path d="M8.5 7H17v8.5"/>';
/** La flecha de la tarjeta compacta (la de la fila, en el teléfono, es el chevrón). */
const ARROW_RIGHT = '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>';
/** Por debajo de este ancho, la compacta pinta cada sección como lista (igual que su CSS). */
const ROWS_BELOW = 600;
const SVG = "http://www.w3.org/2000/svg";
const NAMES = ["nx-launcher-card", "nx-launcher-icon", "nx-launcher-label"] as const;
const STORE = "nx-launcher:from";
/** Cuánto duran los nombres de View Transitions en la tarjeta si nadie los usa. */
const HOLD = 1500;

let uid = 0;
/** La última tarjeta abierta en esta página (SPA): `reveal()` sin argumento vuelve a ella. */
let lastFrom: string | null = null;

interface Card {
  el: HTMLLIElement;
  item: LauncherItem;
  /** Prefijo de los ids de la tarjeta (los ids del backend pueden traer espacios). */
  base: string;
  /** Lo que la pinta, sin la señal: si cambia, la tarjeta se rehace. */
  body: string;
  signal: string;
}

/** «240px», «18rem» o «16em» en píxeles (lo demás, 0: se usa el valor por defecto). */
function toPx(value: string, em: number): number {
  const m = /^\s*([\d.]+)(px|rem|em)?\s*$/.exec(value);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const root = typeof document !== "undefined" ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16 : 16;
  return m[2] === "rem" ? n * root : m[2] === "em" ? n * (em || 16) : n;
}

/** Subgrid: sin él, `pack` no se aplica (cada sección queda en su propia rejilla, como sin `pack`). */
const subgrid = () => typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("grid-template-columns", "subgrid");
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
/** ¿Se está escribiendo en un campo? El origen real del evento: uno dentro de un shadow DOM llega reapuntado a su host. */
const isField = (e: Event) => {
  const t = e.composedPath?.()[0] ?? e.target;
  return t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
};

/** El formato de porcentaje, uno por locale (el mismo de `fmt`, ya validado). */
const percents = new Map<string, Intl.NumberFormat>();
function percent(locale: string): Intl.NumberFormat {
  let f = percents.get(locale);
  if (!f) percents.set(locale, (f = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 })));
  return f;
}

export class NxLauncher extends Base {
  static observedAttributes = ["items", "labels", "search", "columns", "heading-level", "locale", "density", "pack", "typeahead"];

  #items: LauncherItem[] = [];
  #labels: LauncherLabels = LAUNCHER_LABELS;
  #uid = `nx-la${++uid}`;
  #root?: HTMLDivElement;
  #nav?: HTMLElement;
  #input?: HTMLInputElement;
  #hint?: HTMLElement;
  /** La píldora de `typeahead` (lo escrito y lo que abre `Enter`). */
  #goto?: HTMLDivElement;
  #gotoQ?: HTMLElement;
  #gotoHint?: HTMLElement;
  /** Ya entraron las tarjetas (la entrada escalonada de la compacta, una vez). */
  #entered = false;
  #cards = new Map<string, Card>();
  /** La forma de la navegación (secciones y claves en orden): si no cambia, las tarjetas no se mueven. */
  #shape = "";
  #query = "";
  #target: LauncherTarget | null = null;
  #queued = false;
  #rendered = false;
  #abort?: AbortController;
  #resize?: ResizeObserver;
  #marked: HTMLElement | null = null;
  #seq = 0;
  #unmark = 0;

  // ---------------------------------------------------------------- propiedades

  /** Las tarjetas. El atributo `items` acepta el mismo arreglo como JSON. */
  get items(): LauncherItem[] {
    return this.#items;
  }
  set items(value: LauncherItem[] | null | undefined) {
    this.#items = Array.isArray(value) ? value.filter((it) => it && typeof it === "object") : [];
    this.#schedule();
  }

  get labels(): LauncherLabels {
    return this.#labels;
  }
  set labels(value: Partial<LauncherLabels> | null | undefined) {
    this.#labels = mergeLabels(LAUNCHER_LABELS, value);
    // Los textos van también dentro de las tarjetas («Vistas de …»): se rehacen.
    this.#cards.clear();
    this.#shape = "";
    this.#schedule();
  }

  /** Muestra el buscador «Ir a». Escribir con el foco en la página (o en una tarjeta) lo usa. */
  get search(): boolean {
    return boolAttr(this, "search");
  }
  set search(value: boolean) {
    this.#setAttr("search", value ? "" : null);
  }

  /** Máximo de columnas (4 por defecto; 6 en la compacta). */
  get columns(): number {
    const n = Number(this.getAttribute("columns"));
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : this.density === "compact" ? 6 : 4;
  }
  set columns(value: number | null | undefined) {
    this.#setAttr("columns", value == null ? null : String(value));
  }

  /** `compact`: tarjetas de 190 px, nombre completo, señal en una línea al pie, título de sección con
   *  punto y filete y, por debajo de 600 px, cada sección como lista. `comfortable` por defecto. */
  get density(): LauncherDensity {
    return this.getAttribute("density") === "compact" ? "compact" : "comfortable";
  }
  set density(value: LauncherDensity | null | undefined) {
    this.#setAttr("density", value === "compact" ? "compact" : null);
  }

  /** Las secciones cortas comparten fila si caben, en su orden. */
  get pack(): boolean {
    return boolAttr(this, "pack");
  }
  set pack(value: boolean) {
    this.#setAttr("pack", value ? "" : null);
  }

  /** Escribir con el foco en la página filtra sin un campo a la vista (con `search`, manda el buscador). */
  get typeahead(): boolean {
    return boolAttr(this, "typeahead");
  }
  set typeahead(value: boolean) {
    this.#setAttr("typeahead", value ? "" : null);
  }

  /** Nivel de los títulos de sección (2 por defecto). */
  get headingLevel(): number {
    const n = Number(this.getAttribute("heading-level"));
    return n >= 1 && n <= 6 ? Math.floor(n) : 2;
  }
  set headingLevel(value: number | null | undefined) {
    this.#setAttr("heading-level", value == null ? null : String(value));
  }

  /** Locale de los números de la señal («es-CO»); sin él, el `lang` más cercano. */
  get locale(): string | null {
    return this.getAttribute("locale");
  }
  set locale(value: string | null | undefined) {
    this.#setAttr("locale", value || null);
  }

  /** Lo que hay escrito en el buscador. */
  get query(): string {
    return this.#query;
  }
  set query(value: string | null | undefined) {
    this.#query = String(value ?? "");
    if (this.#input) this.#input.value = this.#query;
    this.#applyFilter();
  }

  /** Enfoca la tarjeta `id` (o la primera). */
  focusItem(id?: string): void {
    this.#flush();
    const card = id === undefined ? this.#nav?.querySelector(".nx-launcher__card") : this.#cardOf(id)?.el;
    card?.querySelector<HTMLElement>(".nx-launcher__link")?.focus();
  }

  /**
   * Para volver con una View Transition en una SPA: dentro del `startViewTransition` de la vuelta,
   * después de montar el launcher, marca la tarjeta de la que se salió (o `id`) con los nombres de
   * la animación. Se limpian solos.
   */
  reveal(id?: string): void {
    this.#flush();
    const key = id ?? lastFrom ?? this.#stored();
    const card = key ? this.#cardOf(key) : undefined;
    if (card) this.#mark(card.el, HOLD);
  }

  // ---------------------------------------------------------------- ciclo de vida

  connectedCallback(): void {
    upgrade(this);
    if (!this.#root) this.#root = h("div", { class: "nx-launcher__root" });
    if (this.#root.parentNode !== this) this.append(this.#root);

    this.#abort?.abort();
    const signal = (this.#abort = new AbortController()).signal;
    this.addEventListener("click", this.#onClick, { signal });
    this.addEventListener("keydown", this.#onKey, { signal });
    this.addEventListener("pointermove", this.#onPointer, { signal, passive: true });
    document.addEventListener("keydown", this.#onTypeAhead, { signal });
    // Con `typeahead`, tocar fuera borra lo escrito (dentro, el clic decide: abrir también lo borra).
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (this.#query && this.#goto && !(e.target instanceof Node && this.contains(e.target))) this.query = "";
      },
      { signal, capture: true },
    );
    // Al volver a esta página (atrás, o desde el bfcache) con una View Transition entre documentos,
    // la tarjeta de la que se salió recupera los nombres para que la página se «encoja» en ella.
    addEventListener(
      "pagereveal",
      (e) => {
        const vt = (e as Event & { viewTransition?: ViewTransition | null }).viewTransition;
        const key = this.#stored();
        if (!vt || !key) return;
        this.#flush();
        const card = this.#cardOf(key);
        if (!card) return;
        this.#mark(card.el, 0);
        vt.finished.finally(() => this.#clearMark());
      },
      { signal },
    );
    if (typeof ResizeObserver === "function") {
      this.#resize = new ResizeObserver(() => this.#layout());
      this.#resize.observe(this);
    }
    this.#rendered = false;
    this.#render();
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
    this.#popover(false);
    this.#resize?.disconnect();
    clearTimeout(this.#unmark);
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "items" || name === "labels") {
      if (value === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        console.warn(`[nx-launcher] el atributo "${name}" no es JSON válido`);
        return;
      }
      if (name === "items") this.items = parsed as LauncherItem[];
      else this.labels = parsed as Partial<LauncherLabels>;
      return;
    }
    // El nivel de los títulos, el buscador, la densidad o el locale cambian lo que se pinta: se rehace
    // todo (la densidad y el locale, también dentro de las tarjetas).
    this.#shape = "";
    if (name === "locale" || name === "density") this.#cards.clear();
    if ((name === "typeahead" || name === "search") && !this.search && !this.typeahead) this.#query = "";
    this.#schedule();
  }

  // ---------------------------------------------------------------- estado interno

  #setAttr(name: string, value: string | null): void {
    if (value === null) this.removeAttribute(name);
    else this.setAttribute(name, value);
  }

  #emit<T>(type: string, detail: T, cancelable = false): boolean {
    return this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable }));
  }

  #schedule(): void {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => this.#flush());
  }

  /** Pinta ya lo pendiente (un método público no espera la microtarea). */
  #flush(): void {
    if (!this.#queued && this.#rendered) return;
    this.#queued = false;
    if (this.isConnected && this.#root) this.#render();
  }

  #cardOf(id: string): Card | undefined {
    for (const c of this.#cards.values()) if (c.item.id === id) return c;
    return undefined;
  }

  #stored(): string | null {
    try {
      const raw = sessionStorage.getItem(STORE);
      const s = raw ? (JSON.parse(raw) as { path?: string; id?: string }) : null;
      return s && s.path === location.pathname && typeof s.id === "string" ? s.id : null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------- render

  #render(): void {
    const root = this.#root!;
    this.#queued = false;
    const first = !this.#rendered;
    this.#rendered = true;
    const fmt = nxFormat(resolveLocale(this));
    const groups = groupBySection(this.#items);

    // Dónde estaba el foco, para devolverlo si al rehacer o mover una tarjeta se pierde.
    const active = document.activeElement as HTMLElement | null;
    let focus: { key?: string; sel: string } | null = null;
    if (active && root.contains(active)) {
      const c = active.closest<HTMLElement>(".nx-launcher__card");
      if (active === this.#input) focus = { sel: "input" };
      else if (c) focus = { key: c.dataset.key, sel: active.dataset.nxView !== undefined ? `[data-nx-view="${active.dataset.nxView}"]` : ".nx-launcher__link" };
    }

    // Claves estables por id (los repetidos se desambiguan por su orden).
    const seen = new Map<string, number>();
    const keyed = groups.map((g) => ({
      label: g.label,
      accent: sectionAccent(g.items),
      entries: g.items.map((item) => {
        const id = String(item.id ?? "");
        const n = seen.get(id) ?? 0;
        seen.set(id, n + 1);
        return { item, key: n ? `${id}#${n}` : id };
      }),
    }));

    const next = new Map<string, Card>();
    for (const g of keyed) {
      for (const { item, key } of g.entries) {
        // `data` es de la app (puede ser cualquier cosa, hasta circular): no decide el pintado.
        const { signal: sig, data: _data, ...rest } = item;
        const body = JSON.stringify([rest, !!sig]);
        const signal = JSON.stringify(sig ?? null);
        const old = this.#cards.get(key);
        const changed = !first && sig?.value !== undefined && sig.value !== old?.item.signal?.value;
        if (old && old.body === body) {
          // Solo cambió el dato: se cambia en su sitio (la tarjeta conserva el puntero y el foco).
          if (old.signal !== signal) {
            old.el.querySelector(".nx-launcher__signal")?.remove();
            const s = this.#signal(sig, fmt, `${old.base}-s`);
            if (s) old.el.append(s);
            if (changed) this.#pulse(old.el);
          }
          next.set(key, { ...old, item, signal });
          continue;
        }
        const base = `${this.#uid}-c${++this.#seq}`;
        const el = this.#card(item, key, base, fmt);
        if (old) {
          old.el.replaceWith(el);
          if (changed) this.#pulse(el);
        }
        next.set(key, { el, item, base, body, signal });
      }
    }
    this.#cards = next;

    const shape = JSON.stringify([this.search, this.typeahead, this.headingLevel, keyed.map((g) => [g.label, g.accent, g.entries.map((e) => e.key)])]);
    if (shape !== this.#shape) {
      this.#shape = shape;
      root.replaceChildren(...this.#chrome(keyed.map((g) => ({ label: g.label, accent: g.accent, keys: g.entries.map((e) => e.key) }))));
    }
    if (focus && !root.contains(document.activeElement)) {
      const target = focus.sel === "input" ? this.#input : this.#cards.get(focus.key!)?.el.querySelector<HTMLElement>(focus.sel);
      target?.focus();
    }
    this.#layout();
    this.#applyFilter();
    this.#enter();
  }

  /** La compacta entra escalonada la primera vez que tiene tarjetas (desde un estado visible). */
  #enter(): void {
    if (this.#entered || !this.#cards.size) return;
    this.#entered = true;
    if (this.density !== "compact" || reduced()) return;
    let i = 0;
    for (const el of this.#nav?.querySelectorAll<HTMLElement>(".nx-launcher__card") ?? []) {
      if (typeof el.animate !== "function") return;
      el.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], {
        duration: 360,
        delay: Math.min(i++, 16) * 26,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        fill: "backwards",
      });
    }
  }

  /** El buscador, las secciones y sus rejillas (con las tarjetas ya hechas). */
  #chrome(groups: { label: string | null; accent: string | null; keys: string[] }[]): Node[] {
    const out: Node[] = [];
    const L = this.#labels;
    if (this.search) {
      const id = `${this.#uid}-q`;
      const hintId = `${this.#uid}-h`;
      this.#input ??= h("input", { type: "search", class: "nx-launcher__input", autocomplete: "off", spellcheck: "false", enterkeyhint: "go" });
      this.#input.id = id;
      this.#input.placeholder = L.placeholder;
      this.#input.setAttribute("aria-describedby", hintId);
      this.#input.value = this.#query;
      this.#input.oninput = () => {
        this.#query = this.#input!.value;
        this.#applyFilter();
      };
      this.#hint = h("p", { id: hintId, class: "nx-launcher__hint", "aria-live": "polite" });
      out.push(
        h("div", { class: "nx-launcher__search" }, h("label", { for: id, class: "nx-launcher__search-label" }, L.search), h("div", { class: "nx-launcher__field" }, glyph("search"), this.#input), this.#hint),
      );
    } else {
      this.#hint = undefined;
    }
    if (this.typeahead && !this.search) {
      if (!this.#goto) {
        this.#gotoQ = h("span", { class: "nx-launcher__goto-q" });
        this.#gotoHint = h("span", { class: "nx-launcher__goto-hint", role: "status", "aria-live": "polite" });
        // En la capa superior (popover) para que ningún `transform` ni `overflow` de la página la mueva.
        this.#goto = h("div", { class: "nx-launcher__goto", popover: "manual", hidden: true }, glyph("search"), this.#gotoQ, this.#gotoHint);
      }
      out.push(this.#goto);
    } else if (this.#goto) {
      this.#popover(false);
      this.#goto = this.#gotoQ = this.#gotoHint = undefined;
    }
    const nav = (this.#nav = h("nav", { class: "nx-launcher__nav", "aria-label": L.nav }));
    groups.forEach((g, gi) => {
      const hid = g.label ? `${this.#uid}-g${gi}` : null;
      const grid = h("ul", { class: "nx-launcher__grid", role: "list", "aria-labelledby": hid });
      for (const k of g.keys) grid.append(this.#cards.get(k)!.el);
      // El punto y el filete solo se ven en la compacta; el nombre accesible del título es su texto.
      const heading = g.label
        ? h(
            `h${this.headingLevel}` as "h2",
            { id: hid, class: "nx-launcher__heading" },
            h("span", { class: "nx-launcher__dot", "aria-hidden": "true" }),
            h("span", { class: "nx-launcher__heading-text" }, g.label),
            h("span", { class: "nx-launcher__rule", "aria-hidden": "true" }),
          )
        : null;
      nav.append(h("section", { class: "nx-launcher__section", "data-accent": g.accent }, heading, grid));
    });
    out.push(nav);
    return out;
  }

  #card(item: LauncherItem, key: string, base: string, fmt: ReturnType<typeof nxFormat>): HTMLLIElement {
    const L = this.#labels;
    const label = String(item.label ?? "");
    const descId = item.description ? `${base}-d` : null;
    const sigId = item.signal ? `${base}-s` : null;
    const href = safeHref(itemHref(item));
    const described = [descId, sigId].filter(Boolean).join(" ") || null;
    const text = h("span", { class: "nx-launcher__label" }, label);
    const link = href
      ? h("a", { class: "nx-launcher__link", href, "data-nx-open": "", "aria-describedby": described, ...(itemNewTab(item) ? { target: "_blank", rel: "noopener" } : null) }, text)
      : h("button", { type: "button", class: "nx-launcher__link", "data-nx-open": "", "aria-describedby": described }, text);

    const views = (Array.isArray(item.views) ? item.views : []).filter((v) => v && typeof v === "object");
    const list = views.length
      ? h(
          "ul",
          { class: "nx-launcher__views", role: "list", "aria-label": fill(L.views, label) },
          ...views.map((v, i) => {
            const vHref = safeHref(v.href);
            const badge = formatBadge(v.badge);
            const content = [String(v.label ?? ""), v.hint ? h("span", { class: "nx-launcher__hint-text" }, String(v.hint)) : null, badge ? h("span", { class: "nx-launcher__badge" }, badge) : null];
            const attrs = { class: "nx-launcher__view", "data-nx-open": "", "data-nx-view": i };
            return h("li", null, vHref ? h("a", { ...attrs, href: vHref, ...(v.newTab ? { target: "_blank", rel: "noopener" } : null) }, ...content) : h("button", { ...attrs, type: "button" }, ...content));
          }),
        )
      : null;

    const parts = item.featured ? progressParts(item.progress) : [];
    // La compacta lleva la flecha → y el chevrón de la fila (el CSS muestra uno según el ancho).
    const go =
      this.density === "compact"
        ? h("span", { class: "nx-launcher__go", "aria-hidden": "true" }, glyph(ARROW_RIGHT, "nx-launcher__go-card"), glyph("chevron", "nx-launcher__go-row"))
        : glyph(ARROW, "nx-launcher__go");
    const el = h(
      "li",
      { class: `nx-launcher__card${item.featured ? " is-featured" : ""}${list ? " has-views" : ""}`, "data-key": key, "data-accent": accentOf(item.accent) },
      h("div", { class: "nx-launcher__top" }, h("span", { class: "nx-launcher__icon" }, icon(item.icon, label)), go),
      item.featured && item.eyebrow ? h("p", { class: "nx-launcher__eyebrow" }, String(item.eyebrow)) : null,
      link,
      h("div", { class: "nx-launcher__swap" }, item.description ? h("p", { id: descId, class: "nx-launcher__desc" }, String(item.description)) : null, list),
      parts.length
        ? h(
            "div",
            { class: "nx-launcher__progress" },
            h("div", { class: "nx-launcher__bar", "aria-hidden": "true" }, ...parts.map((p, i) => h("i", { "data-part": Math.min(i, 2), style: `inline-size:${p.pct.toFixed(2)}%` }))),
            h("ul", { class: "nx-launcher__legend", role: "list" }, ...parts.map((p) => h("li", null, h("b", null, fmt.number(p.value)), ` ${p.label}`))),
          )
        : null,
    );
    const s = this.#signal(item.signal, fmt, sigId ?? "");
    if (s) el.append(s);
    return el;
  }

  #signal(sig: LauncherSignal | undefined, fmt: ReturnType<typeof nxFormat>, id: string): HTMLElement | null {
    if (!sig || typeof sig !== "object") return null;
    const value = typeof sig.value === "number" && Number.isFinite(sig.value) ? fmt.number(sig.value) : typeof sig.value === "string" ? sig.value : "";
    const meter = clampMeter(sig.meter);
    const spark = sparkPaths(sig.trend);
    if (!value && !sig.label && !sig.note && meter === null && !spark) return null;
    const tone = sig.tone === "success" || sig.tone === "warning" || sig.tone === "danger" || sig.tone === "info" ? sig.tone : null;
    // `data-tone` también en la señal: la compacta pone el punto al principio de la línea.
    const el = h(
      "div",
      { id: id || null, class: "nx-launcher__signal", "data-tone": tone },
      value ? h("b", { class: "nx-launcher__value" }, value) : null,
      sig.label ? h("span", { class: "nx-launcher__what" }, String(sig.label)) : null,
      sig.note ? h("span", { class: "nx-launcher__note", "data-tone": tone }, String(sig.note)) : null,
    );
    if (spark) {
      const svg = document.createElementNS(SVG, "svg");
      svg.setAttribute("class", "nx-launcher__trend");
      svg.setAttribute("viewBox", "0 0 100 22");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("aria-hidden", "true");
      for (const [cls, d] of [["area", spark.area], ["line", spark.line]]) {
        const p = document.createElementNS(SVG, "path");
        p.setAttribute("class", `nx-launcher__trend-${cls}`);
        p.setAttribute("d", d);
        svg.append(p);
      }
      el.append(svg);
    }
    if (meter !== null) {
      // La barra se ve; el lector oye el porcentaje («71 %»), que también describe la tarjeta.
      const pct = percent(fmt.locale).format(meter / 100);
      el.append(h("span", { class: "nx-launcher__meter", "aria-hidden": "true" }, h("i", { style: `inline-size:${meter}%` })), h("span", { class: "nx-sr-only" }, pct));
    }
    return el;
  }

  /** Un dato que cambió se anuncia con un pulso breve (sin movimiento si se pidió menos movimiento). */
  #pulse(card: HTMLElement): void {
    if (reduced() || typeof card.animate !== "function") return;
    const ease = "cubic-bezier(0.2, 0.8, 0.2, 1)";
    card.querySelector(".nx-launcher__value")?.animate([{ transform: "translateY(-6px)", opacity: 0, color: "var(--nx-primary-ink)" }, { transform: "none", opacity: 1, color: "var(--nx-primary-ink)", offset: 0.5 }, {}], { duration: 900, easing: ease });
    card.animate([{ boxShadow: "0 0 0 0 var(--nx-primary-border)" }, { boxShadow: "0 0 0 6px transparent" }], { duration: 900, easing: "ease-out" });
  }

  /**
   * Columnas: las que caben (o una menos, si deja menos huérfanas), iguales en todas las secciones.
   * Con `pack`, la rejilla es una sola (la de la navegación) y cada sección ocupa las columnas de sus
   * tarjetas; sus listas toman esas columnas con subgrid.
   */
  #layout(): void {
    const nav = this.#nav;
    if (!nav) return;
    const sections = [...nav.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("nx-launcher__section"));
    const grids = sections.map((s) => s.querySelector<HTMLElement>(".nx-launcher__grid")!);
    const width = nav.clientWidth;
    if (!width || !grids.length) return;
    const compact = this.density === "compact";
    const css = getComputedStyle(this);
    const min = toPx(css.getPropertyValue("--_min"), parseFloat(css.fontSize)) || (compact ? 190 : 240);
    const gap = parseFloat(getComputedStyle(grids[0]).columnGap) || 12;
    const items = grids.map((g) => [...g.children].map((li) => this.#cards.get((li as HTMLElement).dataset.key!)?.item ?? {}));
    const cols = balanceColumns(items, fitColumns(width, min, gap, this.columns));
    // En la compacta angosta cada sección es una lista: no hay columnas que compartir.
    const packed = this.pack && cols > 1 && !(compact && width < ROWS_BELOW) && subgrid();
    nav.classList.toggle("is-packed", packed);
    nav.style.gridTemplateColumns = packed ? `repeat(${cols}, minmax(0, 1fr))` : "";
    const spans = packed ? packSpans(items, cols) : [];
    sections.forEach((s, i) => {
      s.style.gridColumn = packed ? `span ${spans[i]}` : "";
    });
    const tpl = packed ? "" : `repeat(${cols}, minmax(0, 1fr))`;
    for (const g of grids) {
      g.dataset.cols = String(cols);
      if (g.dataset.tpl === tpl) continue;
      g.dataset.tpl = tpl;
      // Con `pack` manda el CSS (subgrid); sin él, las columnas van en línea.
      g.style.gridTemplateColumns = tpl;
    }
  }

  // ---------------------------------------------------------------- buscador

  /** Apaga lo que no coincide (sin moverlo), enciende las vistas que sí y marca lo que abre `Enter`. */
  #applyFilter(): void {
    const q = this.#query;
    const ordered = [...(this.#nav?.querySelectorAll<HTMLElement>(".nx-launcher__card") ?? [])].map((el) => this.#cards.get(el.dataset.key!)).filter((c): c is Card => !!c);
    this.#target = this.search || this.typeahead ? firstTarget(ordered.map((c) => c.item), q) : null;
    for (const c of ordered) {
      const m = q.trim() ? matchItem(c.item, q) : { own: true, views: [] };
      c.el.classList.toggle("is-dim", !m);
      c.el.classList.toggle("is-found", !!m && m.views.length > 0);
      c.el.classList.toggle("is-first", this.#target?.item === c.item);
      c.el.querySelectorAll<HTMLElement>(".nx-launcher__view").forEach((v, i) => v.classList.toggle("is-hit", !!m?.views.includes(i)));
    }
    // Una sección sin nada encendido apaga también su título.
    for (const s of this.#nav?.querySelectorAll<HTMLElement>(".nx-launcher__section") ?? []) {
      s.classList.toggle("is-dim", !!q.trim() && !s.querySelector(".nx-launcher__card:not(.is-dim)"));
    }
    const t = this.#target;
    const hint = !q.trim() ? "" : t ? fill(this.#labels.open, t.view ? `${t.item.label} › ${t.view.label}` : String(t.item.label)) : this.#labels.empty;
    if (this.#hint) this.#hint.textContent = hint;
    if (this.#goto) {
      this.#gotoQ!.textContent = q;
      this.#gotoHint!.textContent = hint;
      this.#popover(!!q);
    }
  }

  /** Muestra u oculta la píldora de `typeahead` (en la capa superior si hay popover). */
  #popover(show: boolean): void {
    const g = this.#goto;
    if (!g) return;
    if (show) g.hidden = false;
    try {
      if (show && g.isConnected && !g.matches(":popover-open")) g.showPopover?.();
      else if (!show && g.matches(":popover-open")) g.hidePopover?.();
    } catch {
      /* sin popover (o ya estaba así): queda fija con el CSS */
    }
    if (!show) g.hidden = true;
  }

  /** El enlace (o botón) que abre el objetivo del buscador. */
  #targetEl(): HTMLElement | null {
    const t = this.#target;
    if (!t) return null;
    const card = [...this.#cards.values()].find((c) => c.item === t.item);
    return card?.el.querySelector<HTMLElement>(t.view ? `[data-nx-view="${t.viewIndex}"]` : ".nx-launcher__link") ?? null;
  }

  // ---------------------------------------------------------------- transición

  /** Pone los nombres de View Transitions en la tarjeta (y los quita de la anterior). `hold` > 0: se limpian solos. */
  #mark(card: HTMLElement, hold: number): void {
    this.#clearMark();
    if (reduced()) return;
    const [c, i, l] = NAMES;
    card.style.viewTransitionName = c;
    const ic = card.querySelector<HTMLElement>(".nx-launcher__icon");
    const lb = card.querySelector<HTMLElement>(".nx-launcher__label");
    if (ic) ic.style.viewTransitionName = i;
    if (lb) lb.style.viewTransitionName = l;
    this.#marked = card;
    if (hold > 0) this.#unmark = window.setTimeout(() => this.#clearMark(), hold);
  }

  #clearMark(): void {
    clearTimeout(this.#unmark);
    const card = this.#marked;
    if (!card) return;
    this.#marked = null;
    for (const el of [card, card.querySelector<HTMLElement>(".nx-launcher__icon"), card.querySelector<HTMLElement>(".nx-launcher__label")]) {
      if (el) el.style.viewTransitionName = "";
    }
  }

  // ---------------------------------------------------------------- interacción

  #onClick = (e: MouseEvent): void => {
    const t = e.target as Element | null;
    const opener = t?.closest?.<HTMLElement>("[data-nx-open]");
    if (!opener || !this.contains(opener)) return;
    const cardEl = opener.closest<HTMLElement>(".nx-launcher__card");
    const card = cardEl ? this.#cards.get(cardEl.dataset.key!) : undefined;
    if (!card) return;
    // Un clic con modificador (abrir en otra pestaña) es del navegador: no se anuncia nada.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const vi = opener.dataset.nxView;
    const view = vi !== undefined ? (card.item.views?.[Number(vi)] ?? null) : null;
    const href = opener.getAttribute("href") ?? undefined;
    lastFrom = card.item.id;
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ path: location.pathname, id: card.item.id }));
    } catch {
      /* sin almacenamiento: la vuelta no anima */
    }
    // Antes del evento: si la app anima con `startViewTransition` en su manejador, ya los encuentra.
    this.#mark(card.el, HOLD);
    const detail: LauncherSelectDetail = { item: card.item, view, href, newTab: opener.getAttribute("target") === "_blank" };
    if (!this.#emit("nx-launcher-select", detail, true)) e.preventDefault();
    // Lo escrito sin campo era para llegar aquí: al volver, la página está entera.
    if (this.#goto && this.#query) this.query = "";
  };

  #onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement;
    if (t === this.#input) {
      // Enter o las flechas que confirman una composición (IME: japonés, chino) son de la composición.
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter") {
        const el = this.#targetEl();
        if (el) {
          e.preventDefault();
          el.click();
        }
      } else if (e.key === "Escape" && this.#input.value) {
        e.preventDefault();
        this.query = "";
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        (this.#targetEl()?.closest(".nx-launcher__card")?.querySelector<HTMLElement>(".nx-launcher__link") ?? this.#nav?.querySelector<HTMLElement>(".nx-launcher__link"))?.focus();
      }
      return;
    }
    if (!t.classList?.contains("nx-launcher__link") || e.altKey || e.ctrlKey || e.metaKey) return;
    const links = [...(this.#nav?.querySelectorAll<HTMLElement>(".nx-launcher__link") ?? [])];
    const from = links.indexOf(t);
    const rects = links.map((l) => {
      const r = l.closest(".nx-launcher__card")!.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const to = moveIndex(rects, from, e.key);
    if (to === null) return;
    e.preventDefault();
    links[to]?.focus();
  };

  /**
   * Con `search`, escribir con el foco en la página (o en una tarjeta) va al buscador. Con
   * `typeahead` (sin `search`), lo escrito filtra sin campo: `Retroceso` borra, `Escape` limpia,
   * `Enter` abre la primera coincidencia y `↓` la enfoca. Con el foco en el cuerpo de la página
   * escucha solo el primer `<nx-launcher>` con `search` o `typeahead` del documento.
   */
  #onTypeAhead = (e: KeyboardEvent): void => {
    if (!this.search && !this.typeahead) return;
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || isField(e)) return;
    const active = document.activeElement;
    const inside = !!active && this.contains(active);
    if (!inside && active && active !== document.body) return;
    // Con el foco en el cuerpo, solo el primero (en el orden de la página) que escucha lo escrito.
    if (!inside && document.querySelector("nx-launcher[search]:not([hidden]), nx-launcher[typeahead]:not([hidden])") !== this) return;
    if (this.search) {
      if (this.#input && e.key.length === 1 && e.key !== " ") this.#input.focus();
      return;
    }
    if (!this.typeahead || !this.#goto || this.hidden || this.closest("[hidden]")) return;
    const q = this.#query;
    const k = e.key;
    if (k === "Escape" || k === "Backspace") {
      if (!q) return;
      e.preventDefault();
      this.query = k === "Escape" ? "" : q.slice(0, -1);
    } else if (k === "Enter") {
      // Sobre una tarjeta o una vista, Enter es de ella (el enlace).
      if (!q || (e.target instanceof Element && e.target.closest("[data-nx-open]"))) return;
      const el = this.#targetEl();
      if (!el) return;
      e.preventDefault();
      el.click();
    } else if (k === "ArrowDown" && q && !inside) {
      const link = this.#targetEl()?.closest(".nx-launcher__card")?.querySelector<HTMLElement>(".nx-launcher__link");
      if (!link) return;
      e.preventDefault();
      link.focus();
    } else if (k.length === 1 && (k !== " " || q)) {
      e.preventDefault();
      this.query = q + k;
    }
  };

  #onPointer = (e: PointerEvent): void => {
    const card = (e.target as Element | null)?.closest?.<HTMLElement>(".nx-launcher__card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--nx-launcher-x", `${e.clientX - r.left}px`);
    card.style.setProperty("--nx-launcher-y", `${e.clientY - r.top}px`);
  };
}
