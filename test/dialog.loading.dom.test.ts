// @vitest-environment happy-dom
// <nx-dialog loading>: la ficha mientras llega su registro (0.17.0; la espera común desde 0.18.0).
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/dialog/index";
import type { NxDialog } from "../src/components/dialog/index";
import { WAIT_DELAY, WAIT_MIN } from "../src/core/wait";

afterEach(() => {
  vi.useRealTimers();
  for (const d of document.querySelectorAll<NxDialog>("nx-dialog")) d.close();
  document.body.innerHTML = "";
});

function mount(attrs = ""): NxDialog {
  document.body.innerHTML = `<nx-dialog mode="panel" ${attrs}><p id="body">Contenido</p><div slot="footer"><button>Guardar</button></div></nx-dialog>`;
  return document.querySelector("nx-dialog")!;
}

describe("<nx-dialog loading>", () => {
  it("la espera común anuncia «Cargando…», con aria-busy; el contenido del autor no se mueve", () => {
    const d = mount('heading="Laura Gómez" loading');
    const w = d.querySelector<HTMLElement>(".nx-dialog__loading")!;
    expect(w).not.toBeNull();
    expect(w.classList.contains("nx-wait")).toBe(true);
    expect(w.getAttribute("role")).toBe("status");
    expect(w.textContent).toBe("Cargando…");
    // La línea y la trama, sin barras que imiten el contenido.
    expect(w.querySelector(".nx-wait__thread")!.getAttribute("aria-hidden")).toBe("true");
    expect(w.querySelector(".nx-wait__dots")).not.toBeNull();
    expect(d.querySelector(".nx-dialog__skel")).toBeNull();
    expect(d.hasAttribute("data-nx-wait")).toBe(true);
    expect(d.getAttribute("aria-busy")).toBe("true");
    expect(d.querySelector("#body")!.parentElement).toBe(d);
    // Sin título, la cabecera no inventa uno.
    d.heading = "";
    expect(d.querySelector(".nx-dialog__head")!.hasAttribute("data-skeleton")).toBe(false);
  });

  it("al llegar el registro se quita la espera y aria-busy; vuelve al pasar a otro", () => {
    const d = mount();
    expect(d.querySelector(".nx-dialog__loading")).toBeNull();
    expect(d.hasAttribute("aria-busy")).toBe(false);
    d.loading = true;
    expect(d.querySelector(".nx-dialog__loading")).not.toBeNull();
    d.loading = false;
    expect(d.querySelector(".nx-dialog__loading")).toBeNull();
    expect(d.hasAttribute("aria-busy")).toBe(false);
    expect(d.hasAttribute("data-nx-wait")).toBe(false);
    // Llegó antes de verse: el contenido no anima su entrada.
    expect(d.hasAttribute("data-nx-arrived")).toBe(false);
    d.setAttribute("loading", "");
    expect(d.querySelector(".nx-dialog__loading")).not.toBeNull();
    // Un aria-busy del autor sin `loading` no se toca.
    d.loading = false;
    d.setAttribute("aria-busy", "true");
    d.heading = "Otra";
    expect(d.getAttribute("aria-busy")).toBe("true");
  });

  it("si la espera llegó a verse, se queda al menos medio segundo y el contenido entra con un fundido", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const d = mount("loading");
    vi.advanceTimersByTime(WAIT_DELAY + 100);
    d.loading = false;
    // Se vio 100 ms: faltan WAIT_MIN - 100.
    expect(d.querySelector(".nx-dialog__loading")).not.toBeNull();
    expect(d.hasAttribute("data-nx-wait")).toBe(true);
    vi.advanceTimersByTime(WAIT_MIN - 100 - 1);
    expect(d.querySelector(".nx-dialog__loading")).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(d.querySelector(".nx-dialog__loading")).toBeNull();
    expect(d.hasAttribute("aria-busy")).toBe(false);
    expect(d.hasAttribute("data-nx-arrived")).toBe(true);
    vi.advanceTimersByTime(700);
    expect(d.hasAttribute("data-nx-arrived")).toBe(false);
  });

  it("si vuelve a cargar mientras se cumple el medio segundo, la espera sigue sin cortarse", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const d = mount("loading");
    const w = d.querySelector(".nx-dialog__loading");
    vi.advanceTimersByTime(WAIT_DELAY + 50);
    d.loading = false;
    d.loading = true;
    vi.advanceTimersByTime(WAIT_MIN * 2);
    expect(d.querySelector(".nx-dialog__loading")).toBe(w);
    expect(d.hasAttribute("data-nx-wait")).toBe(true);
    d.loading = false;
    expect(d.querySelector(".nx-dialog__loading")).toBeNull();
  });

  it("labels.loading cambia la frase; si la app reemplaza el contenido, la espera vuelve", async () => {
    const d = mount("loading");
    d.labels = { loading: "Cargando la ficha…" };
    expect(d.querySelector(".nx-dialog__loading")!.textContent).toBe("Cargando la ficha…");
    d.replaceChildren(document.createElement("section"));
    await new Promise((r) => setTimeout(r, 0));
    expect(d.querySelector(".nx-dialog__loading")).not.toBeNull();
    expect(d.querySelector(".nx-dialog__head")).not.toBeNull();
  });
});
