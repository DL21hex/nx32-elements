/**
 * `nxToast()`: avisos breves, y el reemplazo de «¿Está seguro?»: la acción ocurre al instante y se
 * puede deshacer mientras corre el tiempo (con el botón o Ctrl+Z). La app confirma en el backend
 * cuando la promesa dice que no se deshizo:
 *
 *   ocultar(filas);
 *   if ((await nxToast({ message: "3 pedidos anulados", undo: true })) === "undo") mostrar(filas);
 *   else await anular(filas); // "timeout", "dismiss" o la página se cerró
 *
 * Viven en `<nx-toaster>`, en la capa superior (por encima de los diálogos), que se crea sola. Pasar
 * el mouse o el foco por encima pausa el tiempo. Un aviso de error (`tone: "danger"`) no se va solo:
 * se queda hasta cerrarlo (salvo un `duration` explícito).
 *
 * Cada aviso se anuncia UNA vez: la lista que se ve no es una región viva (volver a subirla sobre
 * un diálogo, `raise()`, la ocultaba y mostraba, y un lector podía repetirla); el texto va aparte, a
 * una región cortés (o a una de alerta, si es un error) que se vacía sola.
 */
import { Base } from "../../core/define";
import { h } from "../../core/dom";
import { glyph } from "../../core/icons";
import { mergeLabels } from "../../core/labels";
import { clampDelay } from "../../core/time";
import type { ToastLabels, ToastOptions, ToastResult, ToastTone } from "./types";

const TONES = new Set<ToastTone>(["neutral", "success", "warning", "danger"]);

export const TOAST_LABELS: ToastLabels = {
  undo: "Deshacer",
  undone: "Deshecho",
  dismiss: "Cerrar",
  region: "Notificaciones",
};

const ICONS: Record<string, string> = {
  success: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  danger: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
};
const X = '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>';

/** Cuánto se queda el texto en la región viva (ms): lo justo para que el lector lo tome. */
const SAY_MS = 4000;

type Live = { el: HTMLLIElement; opts: ToastOptions; resolve: (r: ToastResult) => void; left: number; since: number; timer: number; done: boolean };

let labels: ToastLabels = TOAST_LABELS;
let wired = false;

/** Textos de los avisos (para otros idiomas). */
export function setToastLabels(v: Partial<ToastLabels>): void {
  labels = mergeLabels(TOAST_LABELS, v);
}

export class NxToaster extends Base {
  #list?: HTMLOListElement;
  /** Las regiones vivas, fuera de la lista: cortés para los avisos, alerta para los errores. */
  #polite?: HTMLSpanElement;
  #urgent?: HTMLSpanElement;
  #live: Live[] = [];
  #paused = false;

  connectedCallback(): void {
    if (this.#list) return;
    if (!this.hasAttribute("popover")) this.setAttribute("popover", "manual");
    this.setAttribute("role", "region");
    this.setAttribute("aria-label", labels.region);
    this.#list = h("ol", { class: "nx-toaster__list" });
    this.#polite = h("span", { class: "nx-toaster__say", role: "status", "aria-live": "polite" });
    this.#urgent = h("span", { class: "nx-toaster__say", role: "alert", "aria-live": "assertive" });
    this.append(this.#list, this.#polite, this.#urgent);
    const pause = (on: boolean) => {
      if (on === this.#paused) return;
      this.#paused = on;
      this.toggleAttribute("data-paused", on);
      for (const t of this.#live) on ? this.#stop(t) : this.#run(t);
    };
    this.addEventListener("pointerenter", () => pause(true));
    this.addEventListener("pointerleave", () => pause(this.contains(document.activeElement)));
    this.addEventListener("focusin", () => pause(true));
    this.addEventListener("focusout", (e) => pause(this.contains(e.relatedTarget as Node)));
    document.addEventListener("visibilitychange", () => pause(document.hidden));
  }

  push(opts: ToastOptions): Promise<ToastResult> {
    const L = labels;
    // `tone` y `duration` pueden venir de un payload: un tono desconocido es neutro (y nunca una
    // clave heredada como «constructor»); un tiempo inválido o enorme se acota a lo que acepta
    // `setTimeout` (0 = hasta cerrarlo).
    const tone: ToastTone = TONES.has(opts.tone as ToastTone) ? (opts.tone as ToastTone) : "neutral";
    // Un error no se va solo: quien lo lee puede necesitar más de 5 s (o estar mirando a otro lado).
    // Con «Deshacer» sí corre el tiempo (es el que confirma la acción).
    const duration = clampDelay(opts.duration, opts.undo ? 7000 : tone === "danger" ? 0 : 5000);
    const lead = opts.undo ? ICONS.undo : Object.hasOwn(ICONS, tone) ? ICONS[tone] : undefined;
    // El tiempo que queda, como un anillo que se vacía (lo anima CSS; se pausa con el toaster).
    const ring = duration ? h("span", { class: "nx-toast__ring", "aria-hidden": "true" }) : null;
    const el = h(
      "li",
      { class: "nx-toast", "data-tone": tone },
      lead ? glyph(lead, "nx-toast__icon") : null,
      h("span", { class: "nx-toast__msg" }, opts.message),
      opts.undo ? h("button", { type: "button", class: "nx-toast__btn", "data-r": "undo" }, L.undo) : null,
      opts.action ? h("button", { type: "button", class: "nx-toast__btn", "data-r": "action" }, opts.action) : null,
      ring,
      h("button", { type: "button", class: "nx-toast__x", "data-r": "dismiss", "aria-label": L.dismiss }, glyph(X)),
    );
    if (duration) el.style.setProperty("--_dur", `${duration}ms`);
    return new Promise<ToastResult>((resolve) => {
      const t: Live = { el, opts, resolve, left: duration, since: 0, timer: 0, done: false };
      el.addEventListener("click", (e) => {
        const r = (e.target as Element).closest<HTMLElement>("[data-r]")?.dataset.r as ToastResult | undefined;
        if (r) this.end(t, r);
      });
      if (opts.signal?.aborted) return void resolve("dismiss");
      opts.signal?.addEventListener("abort", () => this.end(t, "dismiss"), { once: true });
      this.#live.push(t);
      this.#list!.append(el);
      this.raise();
      this.#say(opts.message, tone === "danger");
      if (duration && !this.#paused) this.#run(t);
    });
  }

  /** El aviso con deshacer más reciente que sigue vivo (para Ctrl+Z). */
  lastUndo(): Live | undefined {
    return [...this.#live].reverse().find((t) => t.opts.undo && !t.done);
  }

  end(t: Live, r: ToastResult): void {
    if (t.done) return;
    t.done = true;
    clearTimeout(t.timer);
    this.#live = this.#live.filter((x) => x !== t);
    t.resolve(r);
    const out = () => {
      t.el.classList.add("is-out");
      setTimeout(() => {
        t.el.remove();
        if (!this.#live.length) {
          this.hidePopover?.();
          // Oculto, nada queda por decir: al volver a mostrarse no se repite.
          this.#polite?.replaceChildren();
          this.#urgent?.replaceChildren();
        }
      }, 220);
    };
    // «Deshecho» se queda un instante: la persona ve que funcionó.
    if (r === "undo") {
      t.el.classList.add("is-undone");
      t.el.querySelector(".nx-toast__msg")!.textContent = labels.undone;
      this.#say(labels.undone, false);
      t.el.querySelectorAll(".nx-toast__btn, .nx-toast__ring").forEach((b) => b.remove());
      setTimeout(out, 1100);
    } else out();
  }

  /** Todos los pendientes terminan como si se hubiera acabado el tiempo (la página se cierra). */
  flush(): void {
    for (const t of [...this.#live]) this.end(t, "timeout");
  }

  /** Por encima de todo lo abierto en la capa superior (p. ej. un diálogo abierto después). */
  raise(): void {
    if (!this.#live.length) return;
    this.hidePopover?.();
    this.showPopover?.();
  }

  /** Anuncia `text` una vez: un renglón nuevo en la región viva (con la región ya a la vista), que se
   *  quita solo. */
  #say(text: string, urgent: boolean): void {
    const region = urgent ? this.#urgent : this.#polite;
    if (!region || !text) return;
    setTimeout(() => {
      // El aviso se fue (o la página se cerró) en esos 60 ms: no hay a quién anunciárselo.
      if (!region.isConnected) return;
      const line = h("span", null, text);
      region.append(line);
      setTimeout(() => line.remove(), SAY_MS);
    }, 60);
  }

  #run(t: Live): void {
    if (!t.left || t.done) return;
    t.since = performance.now();
    t.timer = window.setTimeout(() => this.end(t, "timeout"), t.left);
  }

  #stop(t: Live): void {
    if (!t.left || t.done) return;
    clearTimeout(t.timer);
    t.left = Math.max(0, t.left - (performance.now() - t.since));
  }
}

function toaster(): NxToaster {
  let el = document.querySelector("nx-toaster");
  if (!el) {
    el = document.createElement("nx-toaster");
    document.body.append(el);
  }
  if (!wired) {
    wired = true;
    // Ctrl+Z deshace lo último, salvo que se esté escribiendo o que el foco esté en algo que
    // tenga su propio deshacer (un campo, una tabla).
    document.addEventListener("keydown", (e) => {
      if (e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== "z") return;
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.closest("nx-grid"))) return;
      const tt = document.querySelector("nx-toaster") as NxToaster | null;
      const t = tt?.lastUndo();
      if (!t) return;
      e.preventDefault();
      tt!.end(t, "undo");
    });
    addEventListener("pagehide", () => (document.querySelector("nx-toaster") as NxToaster | null)?.flush());
    // Un diálogo que se abre después queda encima: los avisos vuelven a subir.
    document.addEventListener("nx-open-change", () => (document.querySelector("nx-toaster") as NxToaster | null)?.raise());
  }
  return el as NxToaster;
}

/** Muestra un aviso. La promesa dice cómo terminó: `"undo"`, `"action"`, `"timeout"` o `"dismiss"`. */
export function nxToast(opts: ToastOptions | string): Promise<ToastResult> {
  const o = typeof opts === "string" ? { message: opts } : opts;
  if (typeof document === "undefined") return Promise.resolve("timeout");
  return toaster().push({ ...o, message: String(o.message ?? "") });
}
