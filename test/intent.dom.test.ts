// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/intent/index";
import type { IntentChangeDetail, IntentDef, IntentSubmitDetail, NxIntent } from "../src/components/intent/index";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});
const tick = () => new Promise((r) => setTimeout(r, 0));

const INTENTS: IntentDef[] = [
  {
    id: "cert",
    label: "Certificado laboral",
    keywords: ["certificado", "constancia"],
    href: "/cert",
    slots: [{ name: "salario", type: "option", options: [{ value: "con", label: "con salario", keywords: ["banco"], href: "/cert/con.pdf", newTab: true }] }],
  },
  { id: "perm", label: "Permiso", keywords: ["permiso"], href: "/perm", slots: [{ name: "dia", type: "date" }] },
];

async function mount(): Promise<NxIntent> {
  const el = document.createElement("nx-intent") as NxIntent;
  el.setAttribute("today", "2026-10-08");
  el.intents = INTENTS;
  el.examples = ["Certificado para el banco", "Permiso mañana"];
  document.body.append(el);
  await tick();
  return el;
}
const type = (el: NxIntent, text: string) => {
  const input = el.querySelector<HTMLInputElement>("input")!;
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("<nx-intent>", () => {
  it("una caja con nombre, el botón apagado y los ejemplos", async () => {
    const el = await mount();
    const input = el.querySelector("input")!;
    expect(el.querySelector(`label[for="${input.id}"]`)?.textContent).toBe("¿Qué necesitas?");
    expect(input.getAttribute("aria-describedby")).toBe(el.querySelector(".nx-intent__read")!.id);
    expect(el.querySelector<HTMLButtonElement>(".nx-intent__go")!.disabled).toBe(true);
    expect([...el.querySelectorAll(".nx-intent__example")].map((b) => b.textContent)).toEqual(["Certificado para el banco", "Permiso mañana"]);
  });

  it("dice lo que entendió mientras se escribe y avisa el cambio", async () => {
    const el = await mount();
    const changes: IntentChangeDetail[] = [];
    el.addEventListener("nx-intent-change", (e) => changes.push(e.detail));
    type(el, "permiso");
    type(el, "permiso mañana");
    const read = el.querySelector(".nx-intent__read")!;
    expect([...read.querySelectorAll(".nx-intent__chip")].map((c) => c.textContent)).toEqual(["Permiso", expect.stringMatching(/viernes 9 de octubre/)]);
    expect(read.querySelector(".nx-intent__understood")?.textContent).toBe("Entendí:");
    expect(el.querySelector<HTMLButtonElement>(".nx-intent__go")!.disabled).toBe(false);
    expect(changes.map((c) => c.match?.href)).toEqual(["/perm", "/perm?dia=2026-10-09"]);
    expect(el.match?.params).toEqual({ dia: "2026-10-09" });
  });

  it("si no entiende, lo dice y nombra lo que sabe hacer", async () => {
    const el = await mount();
    type(el, "hola qué tal");
    const read = el.querySelector(".nx-intent__read")!;
    expect(read.classList.contains("is-unknown")).toBe(true);
    expect(read.textContent).toBe("Eso no lo reconozco todavía. Puedo ayudarte con certificado laboral y permiso.");
    expect(el.querySelector<HTMLButtonElement>(".nx-intent__go")!.disabled).toBe(true);
  });

  it("al preparar: nx-intent-submit cancelable y, si nadie lo cancela, abre el destino", async () => {
    const el = await mount();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const seen: IntentSubmitDetail[] = [];
    el.addEventListener("nx-intent-submit", (e) => seen.push(e.detail));
    type(el, "certificado para el banco");
    el.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(seen[0]).toMatchObject({ id: "cert", href: "/cert/con.pdf", newTab: true, params: { salario: "con" } });
    expect(open).toHaveBeenCalledWith("/cert/con.pdf", "_blank", "noopener");
  });

  it("un ejemplo se escribe y se prepara; la app puede navegar ella", async () => {
    const el = await mount();
    const seen: string[] = [];
    el.addEventListener("nx-intent-submit", (e) => {
      seen.push(e.detail.href);
      e.preventDefault();
    });
    el.querySelector<HTMLButtonElement>('[data-nx-example="Permiso mañana"]')!.click();
    expect(el.value).toBe("Permiso mañana");
    expect(seen).toEqual(["/perm?dia=2026-10-09"]);
  });

  it("Escape borra; la tecla de hotkey trae el foco desde fuera de un campo", async () => {
    const el = await mount();
    el.hotkey = "/";
    type(el, "permiso");
    const input = el.querySelector("input")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(input.value).toBe("");
    expect(el.match).toBeNull();
    input.blur();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(input);
  });

  it("atributos JSON y textos propios; un JSON roto avisa sin romper", async () => {
    const el = document.createElement("nx-intent") as NxIntent;
    el.setAttribute("intents", JSON.stringify(INTENTS));
    el.setAttribute("labels", JSON.stringify({ submit: "Ir", placeholder: "Escribe" }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    el.setAttribute("examples", "[roto");
    document.body.append(el);
    await tick();
    expect(warn).toHaveBeenCalled();
    expect(el.querySelector(".nx-intent__go")?.textContent).toBe("Ir");
    expect(el.querySelector("input")?.placeholder).toBe("Escribe");
    expect(el.querySelector<HTMLElement>(".nx-intent__examples")!.hidden).toBe(true);
    el.value = "constancia";
    expect(el.match?.intent.id).toBe("cert");
  });
});
