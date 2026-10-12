/**
 * `<nx-insights>`: «Lectura». Las pocas frases que el tablero calcula con los filtros puestos —«los
 * días subieron 18 %», «el 31 % empieza un lunes»—, cada una con su marca y, si aplica, qué mirar.
 *
 * Reglas de diseño:
 * - **Una frase, una idea.** El texto lo arma la app (o el servidor) con los filtros puestos; el
 *   componente solo lo pinta. El dato que importa va en `**negrita**` (y solo eso: nada de HTML).
 * - **La marca acompaña.** Un ícono en un cuadro de 22 px (sube, baja, calendario…) teñido por el
 *   tono (`bad`, `good`, `neutral`); la frase ya dice si es bueno o malo, el color no informa solo.
 * - **Cada frase lleva a mirar.** Una acción opcional: un enlace (`href`), un filtro del tablero
 *   (`filter`: dentro de un `<nx-board>` el vínculo es una marca con `data-nx-filter`) o un botón que
 *   solo avisa. Siempre `nx-insights-action` (cancelable): cancelado, el enlace no navega y el
 *   tablero no filtra.
 * - **Repintar no tira el foco.** Si la app cambia `items`, el foco vuelve a la acción de la misma
 *   frase si sigue ahí.
 */
import { Base, upgrade } from "../../core/define";
import { emit, h, safeHref, setAttr } from "../../core/dom";
import { glyph } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import type { EmphasisPart, InsightIcon, InsightItem, InsightsActionDetail, InsightsLabels, InsightTone } from "./types";

export const INSIGHTS_LABELS: InsightsLabels = {
  group: "Lectura",
  empty: "Sin hallazgos con estos filtros.",
};

/** Las marcas (trazo de 24×24, constantes del componente). */
const ICONS: Record<InsightIcon, string> = {
  up: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  down: '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  season: '<path d="M20 15.5A4.5 4.5 0 0 0 17.5 7a6 6 0 0 0-11.4 1.8A4 4 0 0 0 7 16.5"/><path d="m9 19-1 2M13 18l-1 3M17 18l-1 2"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1 0-2-.5-2.5-1.5M12 6.5v11"/>',
  people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8v.01"/>',
};
const TONES: readonly InsightTone[] = ["bad", "good", "neutral"];

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * La frase partida en trozos: el texto entre `**` va como `{b}`. Solo eso: un `**` sin cerrar o un
 * `****` vacío se quedan como texto. Para pintar con nodos de texto, nunca con `innerHTML`.
 */
export function emphasis(text: string): EmphasisPart[] {
  const out: EmphasisPart[] = [];
  const push = (s: string) => {
    if (!s) return;
    const last = out[out.length - 1];
    if (typeof last === "string") out[out.length - 1] = last + s;
    else out.push(s);
  };
  const src = typeof text === "string" ? text : "";
  let i = 0;
  for (;;) {
    const open = src.indexOf("**", i);
    if (open < 0) break;
    const close = src.indexOf("**", open + 2);
    if (close < 0) break;
    const inner = src.slice(open + 2, close);
    push(src.slice(i, open));
    if (inner) out.push({ b: inner });
    else push("****");
    i = close + 2;
  }
  push(src.slice(i));
  return out;
}

export class NxInsights extends Base {
  static observedAttributes = ["items", "labels", "empty"];

  #items: InsightItem[] = [];
  #labels: InsightsLabels = INSIGHTS_LABELS;
  #root?: HTMLDivElement;
  #queued = false;
  #abort?: AbortController;
  #byKey = new Map<string, InsightItem>();

  /** Las frases: `{id, text, tone?, icon?, action?: {label, href?, newTab?, filter?}}`. Sin `text`, se descarta. */
  get items(): InsightItem[] {
    return this.#items;
  }
  set items(value: InsightItem[] | null | undefined) {
    this.#items = asArray<InsightItem>(value).filter((i) => typeof i.text === "string" && i.text.trim() !== "");
    this.#schedule();
  }
  /** Textos de la interfaz (`INSIGHTS_LABELS`). */
  get labels(): InsightsLabels {
    return this.#labels;
  }
  set labels(value: Partial<InsightsLabels> | null | undefined) {
    this.#labels = mergeLabels(INSIGHTS_LABELS, value);
    this.#schedule();
  }
  /** El texto sin frases (por defecto `labels.empty`). */
  get empty(): string | null {
    return this.getAttribute("empty");
  }
  set empty(v: string | null | undefined) {
    setAttr(this, "empty", v);
  }

  connectedCallback(): void {
    upgrade(this);
    if (!this.#root) this.#root = h("div", { class: "nx-insights__root" });
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
        console.warn(`[nx-insights] el atributo "${name}" no es JSON válido`);
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

  #render(): void {
    const root = this.#root!;
    this.#queued = false;
    // La acción que tenía el foco (la frase y su vínculo), para devolverlo tras repintar.
    const active = document.activeElement;
    const had = active && root.contains(active) ? active.closest<HTMLElement>("[data-nx-key]")?.dataset.nxKey : undefined;
    this.#byKey.clear();
    root.replaceChildren();
    if (!this.#items.length) {
      root.append(h("p", { class: "nx-insights__empty" }, this.empty ?? this.#labels.empty));
      return;
    }
    const ol = h("ol", { class: "nx-insights__list", "aria-label": this.#labels.group });
    const seen = new Set<string>();
    this.#items.forEach((it, i) => {
      let key = typeof it.id === "string" && it.id ? it.id : `#${i}`;
      if (seen.has(key)) key = `#${i}`;
      seen.add(key);
      ol.append(this.#item(it, key));
    });
    root.append(ol);
    if (had) [...ol.querySelectorAll<HTMLElement>(".nx-insights__item")].find((li) => li.dataset.nxKey === had)?.querySelector<HTMLElement>(".nx-insights__action")?.focus();
  }

  #item(it: InsightItem, key: string): HTMLLIElement {
    const tone = TONES.includes(it.tone as InsightTone) ? (it.tone as InsightTone) : "neutral";
    const icon = Object.hasOwn(ICONS, str(it.icon)) ? (it.icon as InsightIcon) : "info";
    const p = h("p", { class: "nx-insights__text" });
    for (const part of emphasis(it.text)) p.append(typeof part === "string" ? part : h("b", null, part.b));
    const li = h("li", { class: "nx-insights__item", "data-nx-key": key }, h("span", { class: `nx-insights__mark is-${tone}` }, glyph(ICONS[icon])), p);
    const action = it.action && typeof it.action === "object" && str(it.action.label).trim() ? it.action : null;
    if (action) {
      this.#byKey.set(key, it);
      const href = safeHref(action.href);
      const filter = str(action.filter).trim();
      li.append(
        href
          ? h("a", { class: "nx-insights__action", href, target: action.newTab ? "_blank" : null, rel: action.newTab ? "noopener" : null }, action.label)
          : h("button", { type: "button", class: "nx-insights__action", "data-nx-filter": filter || null, "data-nx-label": filter ? action.label : null }, action.label),
      );
    }
    return li;
  }

  #onClick = (e: MouseEvent): void => {
    const el = (e.target instanceof Element ? e.target : null)?.closest<HTMLElement>(".nx-insights__action");
    if (!el) return;
    if (el.tagName === "A" && (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0)) return;
    const item = this.#byKey.get(el.closest<HTMLElement>("[data-nx-key]")?.dataset.nxKey ?? "");
    if (!item) return;
    const detail: InsightsActionDetail = { item };
    if (emit(this, "nx-insights-action", detail, true)) return;
    e.preventDefault();
    // Cancelado: un filtro no llega al tablero.
    if (el.hasAttribute("data-nx-filter")) e.stopPropagation();
  };
}
