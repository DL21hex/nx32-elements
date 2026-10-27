// @vitest-environment happy-dom
//
// El doble clic sobre un botón que abre un `nxConfirm` lo cerraba: el primer clic lo abría y el
// segundo (pointerdown + click con `detail: 2`) caía fuera de la caja, en el fondo, y cerraba con
// `reason: "backdrop"`, así que la promesa resolvía `false` sin que nadie viera el diálogo. Ahora lo
// que se pulsa mientras abre o recién abierto (300 ms), y un clic con `detail > 1`, no es un clic en
// el fondo. El clic normal en el fondo sigue cerrando (ver dialog.dom.test.ts).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { nxConfirm, type NxDialog } from "../src/index";

beforeAll(() => {
  const fire = (el: HTMLElement, newState: string) => {
    for (const type of ["beforetoggle", "toggle"]) el.dispatchEvent(Object.assign(new Event(type), { newState }));
  };
  HTMLElement.prototype.showPopover = function (this: HTMLElement) {
    fire(this, "open");
  };
  HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
    fire(this, "closed");
  };
  Element.prototype.getClientRects = function () {
    return [{}] as unknown as DOMRectList;
  };
});
afterEach(() => {
  vi.restoreAllMocks();
  delete (document as { startViewTransition?: unknown }).startViewTransition;
  document.querySelectorAll("nx-dialog").forEach((d) => (d as NxDialog).open && (d as NxDialog).close());
  document.body.innerHTML = "";
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** La caja del diálogo va de x=400 a x=800; (1100, 300) es el fondo (donde estaba el botón). */
const BOX = { left: 400, right: 800, top: 200, bottom: 400, width: 400, height: 200, x: 400, y: 200, toJSON() {} } as DOMRect;
const at = { clientX: 1100, clientY: 300, bubbles: true, cancelable: true };
function press(target: Element, detail: number) {
  target.dispatchEvent(new PointerEvent("pointerdown", at));
  target.dispatchEvent(new MouseEvent("click", { ...at, detail }));
}
/** Como si hubiera pasado `ms` desde ahora (sin esperar de verdad). */
const after = (ms: number, fn: () => void) => {
  const now = vi.spyOn(performance, "now").mockReturnValue(performance.now() + ms);
  try {
    fn();
  } finally {
    now.mockRestore();
  }
};

describe("<nx-dialog>: el fondo y el doble clic", () => {
  it("el doble clic sobre el botón que abre un nxConfirm no lo cierra", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.localName === "nx-dialog" ? BOX : ({ left: 1050, right: 1150, top: 280, bottom: 320, width: 100, height: 40, x: 1050, y: 280, toJSON() {} } as DOMRect);
    });
    document.body.innerHTML = '<main><button id="anular">Anular</button></main>';
    const btn = document.getElementById("anular")!;
    let result: boolean | string = "pendiente";
    btn.addEventListener("click", (e) => {
      if ((e as MouseEvent).detail === 1) void nxConfirm({ heading: "¿Anular?", tone: "primary" }).then((ok) => (result = ok));
    });
    press(btn, 1);
    const dlg = document.querySelector<NxDialog>("nx-dialog.nx-confirm")!;
    expect(dlg.open).toBe(true);
    // El segundo clic del doble clic cae en el fondo del propio diálogo, ya abierto.
    press(dlg, 2);
    await sleep(10);
    expect(dlg.open).toBe(true);
    expect(result).toBe("pendiente");
    // Un rato después, el clic en el fondo sí cierra (y la respuesta es «no»).
    after(1000, () => press(dlg, 1));
    await sleep(10);
    expect(dlg.open).toBe(false);
    expect(result).toBe(false);
  });

  it("lo que se pulsa recién abierto no cierra; pasado el momento, sí", async () => {
    document.body.innerHTML = '<nx-dialog heading="Pedido"><p>hola</p></nx-dialog>';
    const d = document.querySelector<NxDialog>("nx-dialog")!;
    d.getBoundingClientRect = () => BOX;
    const reasons: string[] = [];
    d.addEventListener("nx-dialog-close", (e) => reasons.push((e as CustomEvent).detail.reason));
    void d.show();
    press(d, 1);
    after(200, () => press(d, 1));
    expect(d.open).toBe(true);
    await sleep(320);
    press(d, 1);
    expect(d.open).toBe(false);
    expect(reasons).toEqual(["backdrop"]);
  });

  it("un doble clic lento (pasado el momento) tampoco: el clic con detail > 1 no es del fondo", () => {
    document.body.innerHTML = '<nx-dialog heading="Pedido"><p>hola</p></nx-dialog>';
    const d = document.querySelector<NxDialog>("nx-dialog")!;
    d.getBoundingClientRect = () => BOX;
    void d.show();
    after(1000, () => press(d, 2));
    after(1000, () => press(d, 3));
    expect(d.open).toBe(true);
    after(1000, () => press(d, 1));
    expect(d.open).toBe(false);
  });

  it("mientras abre (la transición del botón al diálogo todavía no termina), el fondo no cuenta", () => {
    let pending: (() => void) | null = null;
    const done = Promise.resolve();
    Object.assign(document, {
      startViewTransition: (cb: () => void) => {
        pending = cb;
        return { finished: done, ready: done, updateCallbackDone: done };
      },
    });
    document.body.innerHTML = '<button id="o">Abrir</button><nx-dialog heading="Pedido"><p>hola</p></nx-dialog>';
    const d = document.querySelector<NxDialog>("nx-dialog")!;
    d.getBoundingClientRect = () => BOX;
    void d.show(document.getElementById("o"));
    expect(pending).not.toBeNull();
    // Aún sin mostrarse: pulsar y soltar en el fondo no cierra lo que se está abriendo.
    after(1000, () => press(d, 1));
    expect(d.open).toBe(true);
    pending!();
    after(1000, () => press(d, 1));
    expect(d.open).toBe(false);
  });
});
