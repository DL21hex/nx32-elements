// @vitest-environment happy-dom
// La página «Mi perfil» de la galería, montada sin navegador: la plantilla de gallery/index.html y
// su demo. Que todo se pinte y se conecte (el estado del índice sale de los componentes).
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import "../src/index";
import { mountProfileDemo } from "../gallery/demo-profile";
import type { NxDocuments, NxEntries, NxFields, NxTabs } from "../src/index";

afterEach(() => {
  document.body.innerHTML = "";
});

const tick = () => new Promise((r) => setTimeout(r, 0));

function template(): string {
  const html = readFileSync("gallery/index.html", "utf8");
  const m = /<template id="page-profile">([\s\S]*?)<\/template>/.exec(html);
  if (!m) throw new Error("no está la plantilla page-profile");
  return m[1];
}

describe("galería: Mi perfil", () => {
  it("monta la página y el índice dice el estado de cada sección", async () => {
    document.body.innerHTML = `<main id="root">${template()}</main>`;
    mountProfileDemo(document.querySelector("#root")!);
    await tick();
    await tick();
    const tabs = document.querySelector<NxTabs>("#pf-tabs")!;
    const status = (v: string) => tabs.querySelector<HTMLElement>(`[data-tab="${v}"]`)!.dataset.status;
    expect(status("Empleado")).toBe("Falta la talla de calzado");
    expect(status("Núcleo familiar")).toBe("Falta el certificado escolar de Sofía");
    expect(status("Documentos")).toBe("Faltan 2 · 1 por vencer · 1 en revisión");
    expect(status("Seguridad")).toBe("Sin verificación en dos pasos");
    await tick();
    expect(tabs.querySelector('[role="tablist"]')!.getAttribute("aria-orientation")).toBe("vertical");
    expect(tabs.querySelectorAll(".nx-tabs__status")).toHaveLength(6);

    expect(document.querySelector("#pf-head .nx-page-header__face")!.textContent).toBe("LG");
    const sizes = document.querySelector<NxFields>("#pf-sizes")!;
    expect(sizes.querySelector(".nx-fields__missing")!.textContent).toBe("Falta");
    expect(document.querySelector<NxFields>("#pf-bank")!.querySelector(".nx-fields__pending")).toBeTruthy();
    expect(document.querySelector<NxFields>("#pf-contract")!.querySelector(".nx-fields__masked")).toBeTruthy();
    expect(document.querySelectorAll<NxEntries>("#pf-family .nx-entries__item")).toHaveLength(3);
    expect(document.querySelectorAll("#pf-career .nx-entries__dot")).toHaveLength(3);
    const docs = document.querySelector<NxDocuments>("#pf-docs")!;
    expect(docs.querySelectorAll(".nx-documents__card")).toHaveLength(8);
    expect(document.querySelector("#pf-qr svg path")!.getAttribute("d")!.length).toBeGreaterThan(100);
    expect(document.querySelectorAll("#pf-rights nx-button")).toHaveLength(3);
  });

  it("agregar la talla de calzado quita «Falta» del índice", async () => {
    document.body.innerHTML = `<main id="root">${template()}</main>`;
    mountProfileDemo(document.querySelector("#root")!);
    await tick();
    const sizes = document.querySelector<NxFields>("#pf-sizes")!;
    sizes.querySelector<HTMLButtonElement>(".nx-fields__add")!.click();
    expect(sizes.editing).toBe(true);
    const sel = sizes.querySelector<HTMLSelectElement>('[name="calzado"]')!;
    sel.value = "37";
    sel.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await tick();
    expect(sizes.editing).toBe(false);
    expect(document.querySelector<HTMLElement>('#pf-tabs [data-tab="Empleado"]')!.dataset.status).toBe("Cambio de cuenta en revisión");
  });
});
