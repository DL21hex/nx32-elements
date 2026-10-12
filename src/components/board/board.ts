/**
 * `<nx-board>`: un tablero. Una grilla de 12 columnas con sus paneles (`<nx-board-panel>`) y un
 * estado de filtros que comparten: tocar una marca filtra todo el tablero.
 *
 * Reglas de diseño:
 * - **Cualquier marca filtra.** Un descendiente con `data-nx-filter="tipo:AT"` (una barra, una celda,
 *   una fila, un ítem de leyenda, un botón de una frase) es una marca: un clic deja su dimensión solo
 *   con ese valor, y otro clic lo quita; con Ctrl, Cmd o Mayús, lo suma. Una celda que es dos cosas
 *   lleva dos pares (`"area:emp,mes:2026-08"`). No hace falta que la marca sea de la librería: un
 *   `<button>` o un `<rect>` sirven igual.
 * - **El panel dueño de una dimensión no se filtra a sí mismo.** El tablero marca cada marca con
 *   `data-nx-filter-state` (`on` la elegida, `off` la que se atenúa) y `aria-pressed` si es un botón,
 *   y la app pide los datos de cada panel con `panel.filters` (los filtros menos los suyos).
 * - **Lo filtrado siempre se ve.** Un renglón de chips arriba, uno por valor, cada uno se quita solo;
 *   con dos o más, «Quitar filtros». Los nombres salen de `dimensions` o del `data-nx-label` de la
 *   marca.
 * - **Los datos sensibles no se cruzan con nombres.** Con `restricted`, filtrar por una dimensión
 *   `sensitive` (el diagnóstico) reserva los paneles `personal`: una lista de personas filtrada por
 *   diagnóstico diría quién tiene qué. Es presentación: el servidor tampoco debe mandar esos datos.
 * - **El tablero no calcula.** Avisa (`nx-board-change`) y la app pide o calcula; para calcular en el
 *   cliente está `passes(fila, except)`.
 *
 * Los hijos no se mueven (la hidratación de Solid sigue intacta): el renglón de chips va al final
 * del DOM y la grilla lo sube.
 */
import { Base, boolAttr, upgrade } from "../../core/define";
import { emit, h } from "../../core/dom";
import { glyph } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import { applyPairs, changedDims, filtersWithout, markState, matchesFilters, normalizeFilters, parseFilter, type FilterPair } from "./logic";
import type { BoardChangeDetail, BoardDimension, BoardFilters, BoardLabels } from "./types";

export const BOARD_LABELS: BoardLabels = {
  filters: "Filtros del tablero",
  clear: "Quitar filtros",
  remove: "Quitar el filtro {dimension}: {value}",
  hint: "Toca una barra, una celda o una fila para filtrar todo el tablero.",
  reserved: "Con un filtro de {dimension}, el detalle por persona no está disponible para tu rol.",
  and: "y",
};

const X = '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>';
const LOCK = '<rect width="16" height="10" x="4" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';
const fill = (t: string, map: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => (Object.hasOwn(map, k) ? map[k] : m));
const isButton = (el: Element) => el.tagName === "BUTTON" || el.getAttribute("role") === "button";

export class NxBoard extends Base {
  static observedAttributes = ["filters", "dimensions", "labels", "restricted"];

  #filters: BoardFilters = {};
  #dims: BoardDimension[] = [];
  #byDim = new Map<string, BoardDimension>();
  #labels: BoardLabels = BOARD_LABELS;
  /** Nombres de valores que trajeron las marcas (`data-nx-label`). */
  #seen = new Map<string, Map<string, string>>();
  #chips?: HTMLDivElement;
  #mo?: MutationObserver;
  #abort?: AbortController;
  #queued = false;
  #refreshQueued = false;

  /** Lo elegido, por dimensión: `{tipo: ["AT"], mes: ["2026-08"]}`. Asignarlo no avisa. */
  get filters(): BoardFilters {
    return Object.fromEntries(Object.entries(this.#filters).map(([d, v]) => [d, [...v]]));
  }
  set filters(value: BoardFilters | null | undefined) {
    this.#filters = normalizeFilters(value);
    this.#schedule();
  }
  /** Las dimensiones: `{id, label?, values?, sensitive?}`. Dan los nombres de los chips. */
  get dimensions(): BoardDimension[] {
    return this.#dims;
  }
  set dimensions(value: BoardDimension[] | null | undefined) {
    this.#dims = (Array.isArray(value) ? value : []).filter((d): d is BoardDimension => !!d && typeof d === "object" && typeof d.id === "string" && d.id !== "");
    this.#byDim = new Map(this.#dims.map((d) => [d.id, d]));
    this.#schedule();
  }
  get labels(): BoardLabels {
    return this.#labels;
  }
  set labels(value: Partial<BoardLabels> | null | undefined) {
    this.#labels = mergeLabels(BOARD_LABELS, value);
    this.#schedule();
  }
  /** Quien mira no ve datos sensibles por persona (rol sin acceso al diagnóstico). */
  get restricted(): boolean {
    return boolAttr(this, "restricted");
  }
  set restricted(v: boolean | null | undefined) {
    this.toggleAttribute("restricted", !!v);
  }
  /** Si los paneles `personal` están reservados ahora. */
  get reserved(): boolean {
    return this.#sensitiveOn().length > 0;
  }

  /** Elige un valor (o lo quita si ya era lo único elegido); con `add`, lo suma o lo saca. Avisa. */
  toggle(dimension: string, value: string | number, add = false): void {
    this.#apply([[String(dimension), String(value)]], add);
  }
  /** Quita los filtros de una dimensión (o de varias), o todos. Avisa si algo cambió. */
  clear(dimension?: string | string[]): void {
    const dims = dimension == null ? Object.keys(this.#filters) : [dimension].flat();
    const next = filtersWithout(this.#filters, dims);
    this.#commit(next, changedDims(this.#filters, next));
  }
  /** Los filtros sin los de `except` (la dimensión de un panel). */
  filtersFor(except?: string | string[] | null): BoardFilters {
    return filtersWithout(this.#filters, except);
  }
  /** Si una fila (`{tipo: "AT", area: "emp", …}`) pasa los filtros, menos los de `except`. */
  passes(row: Record<string, unknown>, except?: string | string[] | null): boolean {
    return matchesFilters(row, this.#filters, except);
  }

  connectedCallback(): void {
    upgrade(this);
    this.#chips ??= h("div", { class: "nx-board__chips", role: "group", tabindex: "-1" }) as HTMLDivElement;
    if (this.#chips.parentNode !== this) this.append(this.#chips);
    this.#abort?.abort();
    const signal = (this.#abort = new AbortController()).signal;
    this.addEventListener("click", this.#onClick, { signal });
    this.addEventListener("keydown", this.#onKey, { signal });
    this.#mo?.disconnect();
    this.#mo = new MutationObserver((records) => {
      const chips = this.#chips;
      if (records.some((r) => !(chips && (r.target === chips || chips.contains(r.target))))) this.#queueRefresh();
    });
    this.#mo.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-nx-filter", "data-nx-label", "personal"] });
    this.#render();
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
    this.#mo?.disconnect();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "filters" || name === "dimensions" || name === "labels") {
      if (value === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        console.warn(`[nx-board] el atributo "${name}" no es JSON válido`);
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
      if (this.isConnected && this.#chips) this.#render();
    });
  }

  #queueRefresh(): void {
    if (this.#refreshQueued) return;
    this.#refreshQueued = true;
    queueMicrotask(() => {
      this.#refreshQueued = false;
      if (this.isConnected) this.#refresh();
    });
  }

  #apply(pairs: FilterPair[], add: boolean): void {
    const { filters, changed } = applyPairs(this.#filters, pairs, add);
    this.#commit(filters, changed);
  }

  #commit(next: BoardFilters, changed: string[], focusAt = -1): void {
    if (!changed.length) return;
    this.#filters = next;
    this.#render(focusAt);
    const detail: BoardChangeDetail = { filters: this.filters, changed, reserved: this.reserved };
    emit(this, "nx-board-change", detail);
  }

  #render(focusAt = -1): void {
    this.#queued = false;
    this.#paintChips(focusAt);
    this.#refresh();
  }

  /** Marcas y paneles reservados: lo que depende de los hijos (se repite cuando cambian). */
  #refresh(): void {
    const before = this.#labelKey();
    this.#mark();
    if (this.#labelKey() !== before) this.#paintChips();
    this.#reserve();
  }

  /** Los elementos de este tablero (no los de un tablero anidado). */
  #own<T extends Element>(selector: string): T[] {
    return [...this.querySelectorAll<T>(selector)].filter((el) => el.closest("nx-board") === this);
  }

  #mark(): void {
    for (const el of this.#own<HTMLElement>("[data-nx-filter]")) {
      const pairs = parseFilter(el.getAttribute("data-nx-filter"));
      const label = el.getAttribute("data-nx-label");
      if (label && pairs.length === 1) this.#learn(pairs[0][0], pairs[0][1], label);
      const state = markState(this.#filters, pairs);
      if (state) {
        if (el.getAttribute("data-nx-filter-state") !== state) el.setAttribute("data-nx-filter-state", state);
      } else if (el.hasAttribute("data-nx-filter-state")) el.removeAttribute("data-nx-filter-state");
      if (isButton(el)) {
        const pressed = String(state === "on");
        if (el.getAttribute("aria-pressed") !== pressed) el.setAttribute("aria-pressed", pressed);
      }
    }
  }

  #learn(dim: string, value: string, label: string): void {
    let m = this.#seen.get(dim);
    if (!m) this.#seen.set(dim, (m = new Map()));
    if (m.size < 2000) m.set(value, label);
  }

  /** Una huella de los nombres de lo elegido: si cambia tras leer las marcas, los chips se repintan. */
  #labelKey(): string {
    return Object.entries(this.#filters).map(([d, vs]) => vs.map((v) => this.#valueLabel(d, v)).join("\u0001")).join("\u0002");
  }

  #dimLabel(dim: string): string {
    return this.#byDim.get(dim)?.label || dim;
  }

  #valueLabel(dim: string, value: string): string {
    const fromDims = this.#byDim.get(dim)?.values;
    if (fromDims && typeof fromDims[value] === "string") return fromDims[value];
    return this.#seen.get(dim)?.get(value) ?? value;
  }

  #paintChips(focusAt = -1): void {
    const chips = this.#chips!;
    const L = this.#labels;
    chips.setAttribute("aria-label", L.filters);
    const parts: Node[] = [];
    for (const [dim, values] of Object.entries(this.#filters)) {
      for (const value of values) {
        const dl = this.#dimLabel(dim), vl = this.#valueLabel(dim, value);
        parts.push(
          h(
            "button",
            { type: "button", class: "nx-board__chip", "data-nx-board-dim": dim, "data-nx-board-value": value, "aria-label": fill(L.remove, { dimension: dl, value: vl }) },
            h("span", { class: "nx-board__chip-dim" }, dl),
            h("span", { class: "nx-board__chip-value" }, vl),
            glyph(X, "nx-board__chip-x"),
          ),
        );
      }
    }
    if (parts.length > 1) parts.push(h("button", { type: "button", class: "nx-board__clear", "data-nx-board-clear": "" }, L.clear));
    if (!parts.length && L.hint) parts.push(h("span", { class: "nx-board__hint" }, L.hint));
    chips.replaceChildren(...parts);
    chips.hidden = !parts.length;
    if (focusAt >= 0) {
      const buttons = chips.querySelectorAll<HTMLButtonElement>("button");
      (buttons[Math.min(focusAt, buttons.length - 1)] ?? chips).focus();
    }
  }

  /** Las dimensiones sensibles que tienen algo elegido, si quien mira es `restricted`. */
  #sensitiveOn(): string[] {
    if (!this.restricted) return [];
    return this.#dims.filter((d) => d.sensitive && this.#filters[d.id]?.length).map((d) => d.id);
  }

  #reserve(): void {
    const dims = this.#sensitiveOn();
    const names = dims.map((d) => this.#dimLabel(d).toLowerCase());
    const L = this.#labels;
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} ${L.and} ${names.at(-1)}` : (names[0] ?? "");
    const text = fill(L.reserved, { dimension: list });
    for (const panel of this.#own<HTMLElement>("nx-board-panel")) {
      const on = dims.length > 0 && boolAttr(panel, "personal");
      let note = [...panel.children].find((c) => c.classList.contains("nx-board-panel__reserved")) as HTMLElement | undefined;
      if (!on) {
        if (panel.hasAttribute("data-nx-reserved")) panel.removeAttribute("data-nx-reserved");
        note?.remove();
        continue;
      }
      if (!panel.hasAttribute("data-nx-reserved")) panel.setAttribute("data-nx-reserved", "");
      if (!note) {
        note = h("p", { class: "nx-board-panel__reserved", role: "note" }, glyph(LOCK, "nx-board-panel__lock"), h("span", null, text));
        panel.append(note);
      } else if (note.lastElementChild && note.lastElementChild.textContent !== text) note.lastElementChild.textContent = text;
    }
  }

  #onClick = (e: MouseEvent): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const chips = this.#chips;
    if (chips?.contains(t)) {
      const chip = t.closest<HTMLElement>(".nx-board__chip");
      if (chip) {
        const at = [...chips.querySelectorAll(".nx-board__chip")].indexOf(chip);
        const dim = chip.dataset.nxBoardDim ?? "", value = chip.dataset.nxBoardValue ?? "";
        const next = this.filters;
        next[dim] = (next[dim] ?? []).filter((v) => v !== value);
        if (!next[dim].length) delete next[dim];
        this.#commit(next, [dim], at);
      } else if (t.closest(".nx-board__clear")) this.#commit({}, Object.keys(this.#filters), 0);
      return;
    }
    const mark = t.closest<HTMLElement>("[data-nx-filter]");
    if (!mark || mark.closest("nx-board") !== this || mark.closest("a[href]")) return;
    this.#apply(parseFilter(mark.getAttribute("data-nx-filter")), e.ctrlKey || e.metaKey || e.shiftKey);
  };

  /** Una marca que no es botón pero se enfoca (`tabindex`, `role="button"`) responde a Enter y Espacio. */
  #onKey = (e: KeyboardEvent): void => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target instanceof Element ? e.target : null;
    if (!el?.hasAttribute("data-nx-filter") || el.tagName === "BUTTON" || el.tagName === "A" || el.closest("nx-board") !== this) return;
    e.preventDefault();
    this.#apply(parseFilter(el.getAttribute("data-nx-filter")), e.ctrlKey || e.metaKey || e.shiftKey);
  };
}
