// @vitest-environment happy-dom
// <nx-dialog loading>: la ficha mientras llega su registro (0.17.0).
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/dialog/index";
import type { NxDialog } from "../src/components/dialog/index";

afterEach(() => {
  for (const d of document.querySelectorAll<NxDialog>("nx-dialog")) d.close();
  document.body.innerHTML = "";
});

function mount(attrs = ""): NxDialog {
  document.body.innerHTML = `<nx-dialog mode="panel" ${attrs}><p id="body">Contenido</p><div slot="footer"><button>Guardar</button></div></nx-dialog>`;
  return document.querySelector("nx-dialog")!;
}

describe("<nx-dialog loading>", () => {
  it("un esqueleto que anuncia «Cargando…», con aria-busy; el contenido del autor no se mueve", () => {
    const d = mount('heading="Laura Gómez" loading');
    const sk = d.querySelector<HTMLElement>(".nx-dialog__loading")!;
    expect(sk).not.toBeNull();
    expect(sk.getAttribute("role")).toBe("status");
    expect(sk.textContent).toBe("Cargando…");
    expect(sk.querySelectorAll(".nx-dialog__skel").length).toBeGreaterThan(5);
    expect([...sk.children].slice(1).every((c) => c.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(d.getAttribute("aria-busy")).toBe("true");
    expect(d.querySelector("#body")!.parentElement).toBe(d);
    // Con título, el título se ve; sin él, también es un esqueleto.
    expect(d.querySelector(".nx-dialog__head")!.hasAttribute("data-skeleton")).toBe(false);
    d.heading = "";
    expect(d.querySelector(".nx-dialog__head")!.hasAttribute("data-skeleton")).toBe(true);
  });

  it("al llegar el registro se quita el esqueleto y aria-busy; vuelve al pasar a otro", () => {
    const d = mount();
    expect(d.querySelector(".nx-dialog__loading")).toBeNull();
    expect(d.hasAttribute("aria-busy")).toBe(false);
    d.loading = true;
    expect(d.querySelector(".nx-dialog__loading")).not.toBeNull();
    d.loading = false;
    expect(d.querySelector(".nx-dialog__loading")).toBeNull();
    expect(d.hasAttribute("aria-busy")).toBe(false);
    expect(d.querySelector(".nx-dialog__head")!.hasAttribute("data-skeleton")).toBe(false);
    d.setAttribute("loading", "");
    expect(d.querySelector(".nx-dialog__loading")).not.toBeNull();
    // Un aria-busy del autor sin `loading` no se toca.
    d.loading = false;
    d.setAttribute("aria-busy", "true");
    d.heading = "Otra";
    expect(d.getAttribute("aria-busy")).toBe("true");
  });

  it("labels.loading cambia lo que se anuncia; si la app reemplaza el contenido, el esqueleto vuelve", async () => {
    const d = mount("loading");
    d.labels = { loading: "Cargando la ficha…" };
    expect(d.querySelector(".nx-dialog__loading")!.textContent).toBe("Cargando la ficha…");
    d.replaceChildren(document.createElement("section"));
    await new Promise((r) => setTimeout(r, 0));
    expect(d.querySelector(".nx-dialog__loading")).not.toBeNull();
    expect(d.querySelector(".nx-dialog__head")).not.toBeNull();
  });
});
