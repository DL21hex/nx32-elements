// @vitest-environment happy-dom
//
// `nxToast()` con opciones que llegan de un payload: tonos desconocidos y tiempos inválidos.
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
const toast = () => [...document.querySelectorAll<HTMLElement>(".nx-toast")].at(-1)!;

describe("nxToast() robusto", () => {
  it("un tono desconocido (o una clave heredada) es neutro y no rompe", () => {
    for (const tone of ["constructor", "toString", "__proto__", "<img>"]) {
      expect(() => void nxToast({ message: "x", tone: tone as never })).not.toThrow();
      expect(toast().dataset.tone).toBe("neutral");
      expect(toast().hasAttribute("role")).toBe(false);
    }
  });

  it("un tiempo enorme no vence al instante (setTimeout lo tomaría como 0)", () => {
    vi.useFakeTimers();
    let result: string | undefined;
    void nxToast({ message: "x", duration: 1e12 }).then((r) => (result = r));
    vi.advanceTimersByTime(10_000);
    expect(result).toBeUndefined();
    expect(toast().isConnected).toBe(true);
  });

  it("un tiempo inválido usa el de siempre", async () => {
    vi.useFakeTimers();
    let result: string | undefined;
    void nxToast({ message: "x", duration: Number.NaN }).then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(5000);
    expect(result).toBe("timeout");
  });
});

describe("nxToast con signal", () => {
  it("abortar la señal cierra el aviso con «dismiss»; una señal ya abortada ni lo muestra", async () => {
    const ctrl = new AbortController();
    const p = nxToast({ message: "Movida", undo: true, signal: ctrl.signal });
    ctrl.abort();
    await expect(p).resolves.toBe("dismiss");
    const dead = new AbortController();
    dead.abort();
    await expect(nxToast({ message: "x", signal: dead.signal })).resolves.toBe("dismiss");
  });
});

// Los avisos de error se iban solos a los 5 s; y la lista era a la vez una región viva y sus avisos
// otras (`role="status"`/`"alert"` dentro de un `aria-live`): un mismo aviso se podía anunciar dos
// veces, y otra más al volver a subir el toaster sobre un diálogo.
describe("nxToast: errores y anuncios", () => {
  const say = (kind: "status" | "alert") => document.querySelector(`nx-toaster .nx-toaster__say[role="${kind}"]`)!;

  it("un error no se va solo y tiene botón de cerrar; con duration explícito, sí", async () => {
    vi.useFakeTimers();
    let result: string | undefined;
    void nxToast({ message: "No se pudo guardar", tone: "danger" }).then((r) => (result = r));
    const el = toast();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(result).toBeUndefined();
    expect(el.isConnected).toBe(true);
    expect(el.querySelector(".nx-toast__ring")).toBeNull();
    const x = el.querySelector<HTMLButtonElement>('[data-r="dismiss"]')!;
    expect(x.getAttribute("aria-label")).toBe("Cerrar");
    x.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toBe("dismiss");
    let timed: string | undefined;
    void nxToast({ message: "x", tone: "danger", duration: 3000 }).then((r) => (timed = r));
    await vi.advanceTimersByTimeAsync(3000);
    expect(timed).toBe("timeout");
  });

  it("cada aviso se anuncia una vez, aparte de la lista; un error, en la región de alerta", async () => {
    vi.useFakeTimers();
    void nxToast({ message: "Guardado", tone: "success" });
    void nxToast({ message: "No se pudo guardar", tone: "danger" });
    const list = document.querySelector("nx-toaster .nx-toaster__list")!;
    expect(list.hasAttribute("aria-live")).toBe(false);
    expect([...list.querySelectorAll("[role], [aria-live]")]).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(say("status").textContent).toBe("Guardado");
    expect(say("alert").textContent).toBe("No se pudo guardar");
    // Volver a subir el toaster (un diálogo que se abre) no vuelve a decir nada.
    document.dispatchEvent(new CustomEvent("nx-open-change"));
    await vi.advanceTimersByTimeAsync(100);
    expect(say("status").textContent).toBe("Guardado");
    // Y el texto se va solo: no queda para repetirse.
    await vi.advanceTimersByTimeAsync(5000);
    expect(say("status").textContent).toBe("");
    expect(say("alert").textContent).toBe("");
  });
});
