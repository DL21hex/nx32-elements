// @vitest-environment happy-dom
//
// `nxToast()` con el mismo aviso otra vez mientras se ve (guardar dos veces seguidas, un error que
// se repite): antes se apilaban avisos idénticos. Ahora el que está vuelve a empezar su tiempo y
// responde también a la nueva llamada; con otro texto, otro tono, otra acción o con «Deshacer»
// (cada uno confirma su propia acción), sigue siendo otro aviso.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { nxToast } from "../src/index";

beforeAll(() => {
  HTMLElement.prototype.showPopover = function () {};
  HTMLElement.prototype.hidePopover = function () {};
});
afterEach(() => {
  vi.useRealTimers();
  document.querySelector("nx-toaster")?.remove();
});
const alive = () => [...document.querySelectorAll<HTMLElement>(".nx-toast:not(.is-out)")];

describe("nxToast: el mismo aviso otra vez", () => {
  it("no se apila: el que está vuelve a empezar su tiempo y responde a las dos llamadas", async () => {
    vi.useFakeTimers();
    const got: string[] = [];
    void nxToast("Guardado").then((r) => got.push(`1:${r}`));
    const ring = alive()[0].querySelector(".nx-toast__ring");
    await vi.advanceTimersByTimeAsync(4000);
    void nxToast("Guardado").then((r) => got.push(`2:${r}`));
    expect(alive()).toHaveLength(1);
    // El anillo vuelve a empezar (uno nuevo, con su animación desde el principio).
    expect(alive()[0].querySelector(".nx-toast__ring")).not.toBe(ring);
    // A los 5 s del primero no se va: el tiempo empezó de nuevo con el segundo.
    await vi.advanceTimersByTimeAsync(4000);
    expect(got).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(got).toEqual(["1:timeout", "2:timeout"]);
  });

  it("otro texto, otro tono u otra acción es otro aviso; con «Deshacer», siempre otro", () => {
    void nxToast("Guardado");
    void nxToast({ message: "Guardado", tone: "success" });
    void nxToast({ message: "Guardado", action: "Ver" });
    void nxToast({ message: "Guardado", action: "Ver" });
    void nxToast({ message: "Fila quitada", undo: true });
    void nxToast({ message: "Fila quitada", undo: true });
    expect(alive().map((t) => t.querySelector(".nx-toast__msg")!.textContent)).toEqual(["Guardado", "Guardado", "Guardado", "Fila quitada", "Fila quitada"]);
  });

  it("cerrarlo responde a todas; la señal de una llamada no lo cierra mientras otra lo espera", async () => {
    const ctrl = new AbortController();
    const first = nxToast({ message: "Sin conexión", tone: "danger", signal: ctrl.signal });
    const second = nxToast({ message: "Sin conexión", tone: "danger" });
    expect(alive()).toHaveLength(1);
    ctrl.abort();
    await expect(first).resolves.toBe("dismiss");
    expect(alive()).toHaveLength(1);
    alive()[0].querySelector<HTMLButtonElement>('[data-r="dismiss"]')!.click();
    await expect(second).resolves.toBe("dismiss");
    expect(alive()).toHaveLength(0);
  });

  it("un error que se queda hasta cerrarlo sigue así aunque se repita con tiempo; repetido enseguida se anuncia una vez", async () => {
    vi.useFakeTimers();
    let result: string | undefined;
    void nxToast({ message: "No se pudo guardar", tone: "danger" }).then((r) => (result = r));
    void nxToast({ message: "No se pudo guardar", tone: "danger", duration: 3000 });
    await vi.advanceTimersByTimeAsync(100);
    const say = document.querySelector('nx-toaster .nx-toaster__say[role="alert"]')!;
    expect(say.children).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(result).toBeUndefined();
    expect(alive()).toHaveLength(1);
  });
});
