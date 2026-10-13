/**
 * La espera común de la librería («Hilo + Puntos»): lo que ya se conoce (la cabecera, los
 * encabezados, el título de la columna) queda en su sitio y debajo va una línea que corre, una
 * trama de puntos que respira y, si hay, una frase con brillo. Los estilos están en tokens.css
 * (`.nx-wait`).
 *
 * Dos reglas para que no parpadee: la espera aparece a los `WAIT_DELAY` ms (lo hace el CSS, con
 * `--nx-wait-delay`), así una respuesta rápida no dibuja nada; y si llegó a verse, el componente
 * que esconde su contenido mientras espera la deja al menos `WAIT_MIN` ms (`waitLeft`).
 */
import { h } from "./dom";

/** Lo que tarda en aparecer (el mismo valor que `--nx-wait-delay` en tokens.css). */
export const WAIT_DELAY = 250;
/** Lo mínimo que se queda a la vista una espera que llegó a verse. */
export const WAIT_MIN = 500;

/**
 * La espera: la línea, la trama y, con `text`, la frase. Con `status` (y una frase), la frase se
 * anuncia como `role="status"`; sin ella, quien la usa anuncia por su cuenta (una celda del grid,
 * `aria-busy`).
 */
export function waitEl(text = "", status = true): HTMLDivElement {
  return h(
    "div",
    { class: "nx-wait", role: status && text ? "status" : null },
    h("div", { class: "nx-wait__thread", "aria-hidden": "true" }),
    h("div", { class: "nx-wait__dots" }, text ? h("span", { class: "nx-wait__say" }, h("span", null, text)) : null),
  );
}

/** Cambia la frase de una espera ya armada (sin rearmarla: las animaciones siguen donde iban). */
export function waitText(el: HTMLElement, text: string): void {
  const say = el.querySelector(".nx-wait__say > span");
  if (say && say.textContent !== text) say.textContent = text;
}

/**
 * Cuánto falta (ms) para poder quitar una espera que empezó en `since`: 0 si nunca llegó a verse
 * (se quitó antes de `WAIT_DELAY`) o si ya estuvo `WAIT_MIN` a la vista.
 */
export function waitLeft(since: number, now: number = performance.now()): number {
  const seen = now - since - WAIT_DELAY;
  return seen <= 0 || seen >= WAIT_MIN ? 0 : Math.ceil(WAIT_MIN - seen);
}
