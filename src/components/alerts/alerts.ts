/**
 * `<nx-alerts>`: «Para actuar». La lista priorizada de lo que hay que hacer —el caso que pasó el
 * día 180, los recobros sin radicar—, cada asunto con su gravedad, su detalle y una acción.
 *
 * Reglas de diseño:
 * - **La gravedad nunca va solo en color.** Cada asunto lleva su ícono (octágono, triángulo, reloj,
 *   «i») y el nombre en texto («Urgente», «Pronto»…). El color refuerza; no informa solo.
 * - **Primero lo urgente.** Por defecto se ordena por gravedad, estable dentro de cada una (el orden
 *   que mandó el servidor decide los empates); `sort="none"` respeta el orden tal cual.
 * - **Pocos a la vista.** `limit` (6) y un «Ver {n} más» que despliega el resto en el mismo lugar; el
 *   foco va al primer asunto nuevo, y al plegar se queda en el botón.
 * - **Cada asunto, una acción.** Un enlace (`href`), un filtro del tablero (`filter`: dentro de un
 *   `<nx-board>` el botón es una marca con `data-nx-filter` y el tablero filtra) o un botón que solo
 *   avisa. Siempre `nx-alerts-action` (cancelable): cancelado, el enlace no navega y el tablero no
 *   filtra.
 * - **Repintar no tira el foco.** Si la app cambia `items` (el tablero filtró y se recalculó), el foco
 *   vuelve a la misma acción del mismo asunto si sigue ahí.
 */
import { Base, upgrade } from "../../core/define";
import { emit, h, safeHref, setAttr } from "../../core/dom";
import { glyph } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import type { AlertItem, AlertsActionDetail, AlertSeverity, AlertsLabels } from "./types";

export const ALERTS_LABELS: AlertsLabels = {
  group: "Para actuar",
  empty: "Nada pendiente.",
  critical: "Urgente",
  serious: "Pronto",
  warning: "Seguimiento",
  info: "Aviso",
  more: "Ver {n} más",
  less: "Ver menos",
};

/** Las gravedades, de la más urgente a la menos. */
export const ALERT_SEVERITIES: readonly AlertSeverity[] = ["critical", "serious", "warning", "info"];

/** Los glifos de cada gravedad (trazo de 24×24, constantes del componente). */
const SEV_GLYPHS: Record<AlertSeverity, string> = {
  critical: '<path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z"/><path d="M12 8v5M12 16.5v.01"/>',
  serious: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17v.01"/>',
  warning: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8v.01"/>',
};

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
const text = (v: unknown): string => (typeof v === "string" ? v : "");
let uid = 0;

/** La gravedad conocida, o `info`. */
export function severityOf(v: unknown): AlertSeverity {
  return ALERT_SEVERITIES.includes(v as AlertSeverity) ? (v as AlertSeverity) : "info";
}

/** Los asuntos válidos (con título), con la gravedad normalizada y, si `sort` no es `none`, de la
 *  más grave a la menos, estable dentro de cada una. */
export function sortAlerts(items: readonly AlertItem[], sort: "severity" | "none" = "severity"): AlertItem[] {
  const ok = items.filter((i) => typeof i.title === "string" && i.title.trim() !== "").map((i) => ({ ...i, severity: severityOf(i.severity) }));
  if (sort === "none") return ok;
  return ok.map((it, i) => [it, i] as const).sort((a, b) => ALERT_SEVERITIES.indexOf(a[0].severity) - ALERT_SEVERITIES.indexOf(b[0].severity) || a[1] - b[1]).map(([it]) => it);
}

export class NxAlerts extends Base {
  static observedAttributes = ["items", "labels", "sort", "limit", "empty"];

  #items: AlertItem[] = [];
  #labels: AlertsLabels = ALERTS_LABELS;
  #root?: HTMLDivElement;
  #queued = false;
  #abort?: AbortController;
  #expanded = false;
  #byKey = new Map<string, AlertItem>();
  #id = `nx-alerts-${++uid}`;

  /** Los asuntos: `{id, severity, title, text?, meta?, action?: {label, href?, newTab?, filter?}}`. Sin `title`, se descarta. */
  get items(): AlertItem[] {
    return this.#items;
  }
  set items(value: AlertItem[] | null | undefined) {
    this.#items = asArray<AlertItem>(value).filter((i) => typeof i.title === "string" && i.title.trim() !== "");
    this.#schedule();
  }
  /** Textos de la interfaz (`ALERTS_LABELS`); `more` lleva `{n}`. */
  get labels(): AlertsLabels {
    return this.#labels;
  }
  set labels(value: Partial<AlertsLabels> | null | undefined) {
    this.#labels = mergeLabels(ALERTS_LABELS, value);
    this.#schedule();
  }
  /** `severity` (por defecto: de la más grave a la menos) o `none` (tal como llegan). */
  get sort(): "severity" | "none" {
    return this.getAttribute("sort") === "none" ? "none" : "severity";
  }
  set sort(v: "severity" | "none" | null | undefined) {
    setAttr(this, "sort", v);
  }
  /** Cuántos se ven antes de «Ver {n} más» (6 por defecto). */
  get limit(): number {
    const n = Math.floor(Number(this.getAttribute("limit")));
    return this.hasAttribute("limit") && Number.isFinite(n) && n > 0 ? n : 6;
  }
  set limit(v: number | string | null | undefined) {
    setAttr(this, "limit", v);
  }
  /** El texto sin asuntos (por defecto `labels.empty`). */
  get empty(): string | null {
    return this.getAttribute("empty");
  }
  set empty(v: string | null | undefined) {
    setAttr(this, "empty", v);
  }

  connectedCallback(): void {
    upgrade(this);
    if (!this.#root) this.#root = h("div", { class: "nx-alerts__root" });
    if (this.#root.parentNode !== this) this.append(this.#root);
    this.#abort?.abort();
    this.#root.addEventListener("click", this.#onClick, { signal: (this.#abort = new AbortController()).signal });
    this.#render();
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "items" || name === "labels") {
      if (value === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        console.warn(`[nx-alerts] el atributo "${name}" no es JSON válido`);
        return;
      }
      (this as unknown as Record<string, unknown>)[name] = parsed;
      return;
    }
    this.#schedule();
  }

  #schedule(): void {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      if (!this.#queued) return;
      this.#queued = false;
      if (this.isConnected && this.#root) this.#render();
    });
  }

  #render(focus?: { key?: string; part: "item" | "action" | "more" }): void {
    const root = this.#root!;
    this.#queued = false;
    focus ??= this.#focused();
    this.#byKey.clear();
    root.replaceChildren();
    const all = sortAlerts(this.#items, this.sort);
    if (!all.length) {
      root.append(h("p", { class: "nx-alerts__empty" }, this.empty ?? this.#labels.empty));
      return;
    }
    const limit = this.limit;
    const shown = this.#expanded ? all : all.slice(0, limit);
    const ol = h("ol", { class: "nx-alerts__list", id: `${this.#id}-list`, "aria-label": this.#labels.group });
    const seen = new Set<string>();
    shown.forEach((it, i) => {
      let key = typeof it.id === "string" && it.id ? it.id : `#${i}`;
      if (seen.has(key)) key = `#${i}`;
      seen.add(key);
      ol.append(this.#item(it, key, i));
    });
    root.append(ol);
    if (all.length > limit) {
      const label = this.#expanded ? this.#labels.less : this.#labels.more.replace("{n}", String(all.length - limit));
      root.append(h("button", { type: "button", class: "nx-alerts__more", "aria-expanded": String(this.#expanded), "aria-controls": ol.id }, label));
    }
    if (focus) this.#refocus(focus);
  }

  #item(it: AlertItem, key: string, i: number): HTMLLIElement {
    const sev = it.severity;
    const titleId = `${this.#id}-t${i}`;
    const head = h("p", { class: "nx-alerts__title", id: titleId }, h("span", { class: "nx-alerts__name" }, it.title), " ", h("span", { class: "nx-alerts__level" }, this.#labels[sev]));
    const meta = text(it.meta).trim();
    if (meta) head.append(" ", h("span", { class: "nx-alerts__meta" }, meta));
    const li = h("li", { class: `nx-alerts__item is-${sev}`, "data-nx-key": key }, h("span", { class: "nx-alerts__sev" }, glyph(SEV_GLYPHS[sev])), head);
    const detail = text(it.text).trim();
    if (detail) li.append(h("p", { class: "nx-alerts__text" }, detail));
    const action = it.action && typeof it.action === "object" && text(it.action.label).trim() ? it.action : null;
    if (action) {
      this.#byKey.set(key, it);
      const href = safeHref(action.href);
      const filter = text(action.filter).trim();
      li.append(
        href
          ? h("a", { class: "nx-alerts__action", href, target: action.newTab ? "_blank" : null, rel: action.newTab ? "noopener" : null, "aria-describedby": titleId }, action.label)
          : h("button", { type: "button", class: "nx-alerts__action", "aria-describedby": titleId, "data-nx-filter": filter || null, "data-nx-label": filter ? action.label : null }, action.label),
      );
    }
    return li;
  }

  /** Qué tenía el foco dentro del componente, para devolverlo tras repintar. */
  #focused(): { key?: string; part: "item" | "action" | "more" } | undefined {
    const a = document.activeElement;
    if (!a || !this.#root?.contains(a)) return undefined;
    if (a.classList.contains("nx-alerts__more")) return { part: "more" };
    const key = a.closest<HTMLElement>("[data-nx-key]")?.dataset.nxKey;
    return key ? { key, part: a.classList.contains("nx-alerts__action") ? "action" : "item" } : undefined;
  }

  #refocus(f: { key?: string; part: "item" | "action" | "more" }): void {
    const root = this.#root!;
    if (f.part === "more") {
      root.querySelector<HTMLElement>(".nx-alerts__more")?.focus();
      return;
    }
    const li = [...root.querySelectorAll<HTMLElement>(".nx-alerts__item")].find((el) => el.dataset.nxKey === f.key);
    if (!li) return;
    const action = f.part === "action" ? li.querySelector<HTMLElement>(".nx-alerts__action") : null;
    if (action) action.focus();
    else {
      li.tabIndex = -1;
      li.focus();
    }
  }

  #onClick = (e: MouseEvent): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    if (t.closest(".nx-alerts__more")) {
      const before = this.limit;
      this.#expanded = !this.#expanded;
      if (!this.#expanded) return this.#render({ part: "more" });
      this.#render({ part: "more" });
      // El primer asunto que apareció: el foco va ahí, para seguir leyendo donde se quedó.
      const first = this.#root!.querySelectorAll<HTMLElement>(".nx-alerts__item")[before];
      if (first) {
        first.tabIndex = -1;
        first.focus();
      }
      return;
    }
    const el = t.closest<HTMLElement>(".nx-alerts__action");
    if (!el) return;
    const isLink = el.tagName === "A";
    if (isLink && (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0)) return;
    const item = this.#byKey.get(el.closest<HTMLElement>("[data-nx-key]")?.dataset.nxKey ?? "");
    if (!item) return;
    const detail: AlertsActionDetail = { item };
    if (emit(this, "nx-alerts-action", detail, true)) return;
    e.preventDefault();
    // Cancelado: un filtro no llega al tablero.
    if (el.hasAttribute("data-nx-filter")) e.stopPropagation();
  };
}
