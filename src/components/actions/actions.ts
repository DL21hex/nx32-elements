/**
 * `<nx-actions>`: las acciones de un registro, una debajo de otra, cada una con su botón y, debajo,
 * qué hace. Es la pestaña «Acciones» de una ficha (`<nx-dialog mode="panel">`): «Generar código
 * para cambiar la contraseña» con su línea de qué pasa al pulsarlo, «Desactivar la cuenta» en rojo.
 *
 * Reglas de diseño:
 * - **El botón es `<nx-button>`.** El mismo aspecto, el mismo spinner al esperar y las mismas
 *   variantes que el resto de la librería; nada de un botón propio que diverja.
 * - **Lo que hace se lee antes de pulsar.** La descripción va debajo de su botón, en texto (no en un
 *   `title` que el táctil no ve), y el lector la encuentra justo después del botón.
 * - **Una a la vez.** Con `busy="<id>"` esa acción muestra que espera y las demás se apagan hasta que
 *   termine: dos acciones sobre el mismo registro en paralelo se pisan.
 * - **Un enlace no emite.** Con `href` el botón es un enlace de verdad (otra pestaña con `newTab`,
 *   descarga con `download`); los botones emiten `nx-actions-action` con el `id`.
 * - **Repintar no tira el foco.** Cada acción conserva su nodo mientras su `id` siga en la lista: al
 *   pasar a «ocupado» y volver, el foco sigue en el botón que se pulsó.
 */
import { Base, upgrade } from "../../core/define";
import { emit, h, setAttr } from "../../core/dom";
import { mergeLabels } from "../../core/labels";
import "../button/index";
import type { NxButton } from "../button/button";
import type { ActionItem, ActionsActionDetail, ActionsLabels } from "./types";

export const ACTIONS_LABELS: ActionsLabels = {
  group: "Acciones",
};

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** Las acciones que llegan de afuera (BDUI: JSON): sin `id` o sin `label` no sirven; un `id` repetido
 *  se queda con la primera. */
function cleanItems(v: unknown): ActionItem[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: ActionItem[] = [];
  for (const raw of v as Record<string, unknown>[]) {
    if (!raw || typeof raw !== "object") continue;
    const id = str(raw.id).trim();
    const label = str(raw.label).trim();
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    out.push({ ...(raw as unknown as ActionItem), id, label });
  }
  return out;
}

export class NxActions extends Base {
  static observedAttributes = ["items", "labels", "busy"];

  #items: ActionItem[] = [];
  #labels: ActionsLabels = ACTIONS_LABELS;
  #list?: HTMLUListElement;
  /** El nodo de cada acción, por su `id`: se reutiliza al repintar (el foco no se pierde). */
  #nodes = new Map<string, { li: HTMLLIElement; btn: NxButton; desc: HTMLParagraphElement }>();
  #queued = false;

  /** Las acciones: `{id, label, description?, icon?, danger?, disabled?, href?, newTab?, download?}`. */
  get items(): ActionItem[] {
    return this.#items;
  }
  set items(v: ActionItem[] | null | undefined) {
    this.#items = cleanItems(v);
    this.#schedule();
  }
  /** La acción que está corriendo (su `id`): muestra que espera y las demás se apagan. */
  get busy(): string | null {
    return this.getAttribute("busy") || null;
  }
  set busy(v: string | null | undefined) {
    setAttr(this, "busy", v);
  }
  /** Textos de la interfaz (`ACTIONS_LABELS`). */
  get labels(): ActionsLabels {
    return this.#labels;
  }
  set labels(v: Partial<ActionsLabels> | null | undefined) {
    this.#labels = mergeLabels(ACTIONS_LABELS, v);
    this.#schedule();
  }

  connectedCallback(): void {
    upgrade(this);
    if (!this.#list) {
      this.#list = h("ul", { class: "nx-actions__list", role: "list" });
      this.#list.addEventListener("click", this.#onClick);
    }
    if (this.#list.parentNode !== this) this.append(this.#list);
    this.#render();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "items" || name === "labels") {
      if (value === null) return void (name === "items" ? (this.items = null) : (this.labels = null));
      try {
        (this as unknown as Record<string, unknown>)[name] = JSON.parse(value);
      } catch {
        console.warn(`[nx-actions] el atributo "${name}" no es JSON válido`);
      }
      return;
    }
    this.#schedule();
  }

  /** Varios cambios seguidos (las acciones y `busy` en el mismo turno) se pintan una vez. */
  #schedule(): void {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      this.#queued = false;
      if (this.isConnected && this.#list) this.#render();
    });
  }

  #render(): void {
    const list = this.#list!;
    this.#queued = false;
    const busy = this.busy;
    const running = !!busy && this.#items.some((a) => a.id === busy);
    list.setAttribute("aria-label", this.#labels.group);
    list.hidden = !this.#items.length;
    if (running) this.setAttribute("aria-busy", "true");
    else this.removeAttribute("aria-busy");
    const keep = new Set<string>();
    this.#items.forEach((a, i) => {
      keep.add(a.id);
      let node = this.#nodes.get(a.id);
      if (!node) {
        const btn = h("nx-button", { "log-mode": "none" }) as NxButton;
        const desc = h("p", { class: "nx-actions__desc" });
        const li = h("li", { class: "nx-actions__item", "data-nx-id": a.id }, btn, desc);
        node = { li, btn, desc };
        this.#nodes.set(a.id, node);
      }
      const { li, btn, desc } = node;
      setAttr(btn, "label", a.label);
      setAttr(btn, "icon", str(a.icon) || null);
      btn.setAttribute("variant", a.danger ? "danger" : "secondary");
      setAttr(btn, "href", str(a.href) || null);
      btn.toggleAttribute("new-tab", !!a.href && !!a.newTab);
      // `download` con texto: el nombre del archivo; `true`, el que mande el servidor.
      if (a.href && a.download) btn.setAttribute("download", typeof a.download === "string" ? a.download : "");
      else btn.removeAttribute("download");
      btn.toggleAttribute("busy", running && a.id === busy);
      btn.toggleAttribute("disabled", !!a.disabled || (running && a.id !== busy));
      const text = str(a.description).trim();
      desc.textContent = text;
      desc.hidden = !text;
      // Solo se mueve lo que cambió de lugar: mover el nodo con el foco lo soltaría.
      if (list.children[i] !== li) list.insertBefore(li, list.children[i] ?? null);
    });
    for (const [id, node] of this.#nodes)
      if (!keep.has(id)) {
        node.li.remove();
        this.#nodes.delete(id);
      }
  }

  #onClick = (e: MouseEvent): void => {
    // El clic de un `<nx-button>` ocupado o apagado no llega hasta aquí (lo detiene el botón).
    // Solo el botón: la descripción se lee, no se pulsa.
    const li = (e.target instanceof Element ? e.target : null)?.closest("nx-button")?.closest<HTMLElement>(".nx-actions__item");
    const item = li && this.#items.find((a) => a.id === li.dataset.nxId);
    if (!item || item.href || item.disabled) return;
    const detail: ActionsActionDetail = { id: item.id, item };
    emit(this, "nx-actions-action", detail);
  };
}
