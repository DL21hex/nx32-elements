// @vitest-environment happy-dom
// `<nx-tabs orientation="vertical">`: el índice al lado, con una línea de estado por sección.
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/tabs/index";
import { registerIcons } from "../src/core/icons";
import type { NxTabs, TabsChangeDetail } from "../src/components/tabs/index";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const tick = () => new Promise((r) => setTimeout(r, 0));

async function mount(attrs = 'orientation="vertical"'): Promise<NxTabs> {
  document.body.innerHTML = `<nx-tabs label="Secciones del perfil" ${attrs}>
    <section data-tab="Empleado" data-icon="user" data-status="Falta la talla de calzado" data-tone="warning">E</section>
    <section data-tab="Núcleo familiar" data-icon="users" data-status="4 personas">F</section>
    <section data-tab="Seguridad" data-status="Sin verificación en dos pasos" data-tone="danger">S</section>
  </nx-tabs>`;
  await tick();
  return document.querySelector("nx-tabs")!;
}
const tabs = (t: NxTabs) => [...t.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

describe("<nx-tabs orientation=vertical>", () => {
  it("la lista es vertical; cada pestaña lleva su estado con el punto del tono", async () => {
    registerIcons({ user: '<circle cx="12" cy="8" r="4"/>' });
    const t = await mount();
    const list = t.querySelector('[role="tablist"]')!;
    expect(t.orientation).toBe("vertical");
    expect(list.getAttribute("aria-orientation")).toBe("vertical");
    const [a, b, c] = tabs(t);
    expect(a.querySelector(".nx-tabs__label")!.textContent).toBe("Empleado");
    expect(a.querySelector(".nx-tabs__status")!.getAttribute("data-tone")).toBe("warning");
    expect(a.querySelector(".nx-tabs__status-t")!.textContent).toBe("Falta la talla de calzado");
    expect(b.querySelector(".nx-tabs__status")!.getAttribute("data-tone")).toBe("neutral");
    expect(c.querySelector(".nx-tabs__status")!.getAttribute("data-tone")).toBe("danger");
    // Ícono solo si está registrado («users» no lo está).
    expect(a.querySelector(".nx-tabs__icon svg")).toBeTruthy();
    expect(b.querySelector(".nx-tabs__icon")).toBeNull();
    // El nombre accesible incluye el estado: el lector lo dice.
    expect(a.textContent).toBe("EmpleadoFalta la talla de calzado");
  });

  it("arriba y abajo se mueven y activan (y los lados también)", async () => {
    const t = await mount();
    const got: TabsChangeDetail[] = [];
    t.addEventListener("nx-tabs-change", (e) => got.push(e.detail));
    tabs(t)[0].focus();
    key(tabs(t)[0], "ArrowDown");
    expect(document.activeElement).toBe(tabs(t)[1]);
    key(tabs(t)[1], "ArrowDown");
    key(tabs(t)[2], "ArrowDown");
    expect(document.activeElement).toBe(tabs(t)[0]);
    key(tabs(t)[0], "ArrowUp");
    expect(document.activeElement).toBe(tabs(t)[2]);
    key(tabs(t)[2], "ArrowLeft");
    expect(document.activeElement).toBe(tabs(t)[1]);
    expect(got.map((g) => g.value)).toEqual(["Núcleo familiar", "Seguridad", "Empleado", "Seguridad", "Núcleo familiar"]);
  });

  it("horizontal: arriba y abajo no hacen nada; el estado queda como punto", async () => {
    const t = await mount("");
    expect(t.querySelector('[role="tablist"]')!.getAttribute("aria-orientation")).toBe("horizontal");
    tabs(t)[0].focus();
    key(tabs(t)[0], "ArrowDown");
    expect(document.activeElement).toBe(tabs(t)[0]);
    expect(tabs(t)[0].querySelector(".nx-tabs__dot")).toBeTruthy();
  });

  it("el estado se actualiza al cambiar data-status sin perder el foco", async () => {
    const t = await mount();
    tabs(t)[0].focus();
    const p = t.querySelector<HTMLElement>("section")!;
    p.dataset.status = "Confirmada hoy";
    p.dataset.tone = "success";
    await tick();
    await tick();
    expect(tabs(t)[0].querySelector(".nx-tabs__status-t")!.textContent).toBe("Confirmada hoy");
    expect(document.activeElement).toBe(tabs(t)[0]);
  });

  it("con tabs (BDUI): status, tone e icon desde el arreglo", async () => {
    document.body.innerHTML = '<nx-tabs orientation="vertical"></nx-tabs>';
    const t = document.querySelector("nx-tabs")!;
    t.tabs = [{ value: "a", label: "A", status: "Al día", tone: "success" }, { value: "b", label: "B" }];
    await tick();
    expect(tabs(t)[0].querySelector(".nx-tabs__status")!.getAttribute("data-tone")).toBe("success");
    expect(tabs(t)[1].querySelector(".nx-tabs__status")).toBeNull();
  });

  it("en angosto vuelve a ser la tira horizontal", async () => {
    let cb: ResizeObserverCallback | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(fn: ResizeObserverCallback) {
          cb = fn;
        }
        observe() {}
        disconnect() {}
      },
    );
    const t = await mount();
    cb!([{ contentRect: { width: 390 } } as ResizeObserverEntry], {} as ResizeObserver);
    await tick();
    expect(t.hasAttribute("data-narrow")).toBe(true);
    expect(t.querySelector('[role="tablist"]')!.getAttribute("aria-orientation")).toBe("horizontal");
    cb!([{ contentRect: { width: 1000 } } as ResizeObserverEntry], {} as ResizeObserver);
    await tick();
    expect(t.hasAttribute("data-narrow")).toBe(false);
    expect(t.querySelector('[role="tablist"]')!.getAttribute("aria-orientation")).toBe("vertical");
  });
});
