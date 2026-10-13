// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "../src/bdui";
import type { ActionItem, ActionsActionDetail, NxActions, NxButton } from "../src/index";
import "../src/index";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const ITEMS: ActionItem[] = [
  { id: "reset", label: "Generar código para cambiar la contraseña", icon: "key", description: "La persona lo usa una vez, en los próximos 15 minutos." },
  { id: "deactivate", label: "Desactivar la cuenta", description: "Deja de entrar desde ya; su historial se conserva.", danger: true },
  { id: "cert", label: "Certificado laboral", href: "/hcm/certificates/1.pdf", newTab: true, download: "certificado.pdf" },
  { id: "card", label: "Asignar carné", disabled: true },
];

const flush = () => new Promise((r) => queueMicrotask(() => r(undefined)));

async function mount(items: ActionItem[] = ITEMS): Promise<NxActions> {
  document.body.innerHTML = "<nx-actions></nx-actions>";
  const el = document.querySelector("nx-actions")!;
  el.items = items;
  await flush();
  return el;
}
const buttons = (el: NxActions) => [...el.querySelectorAll<NxButton>("nx-button")];
const inner = (b: NxButton) => b.querySelector<HTMLElement>(".nx-button__btn")!;

describe("<nx-actions>", () => {
  it("una lista con un nx-button por acción y su descripción debajo", async () => {
    const el = await mount();
    const list = el.querySelector("ul")!;
    expect(list.getAttribute("aria-label")).toBe("Acciones");
    expect(list.getAttribute("role")).toBe("list");
    const items = [...el.querySelectorAll("li")];
    expect(items.map((li) => li.querySelector("nx-button")!.getAttribute("label"))).toEqual(ITEMS.map((a) => a.label));
    expect(items.map((li) => li.querySelector<HTMLElement>(".nx-actions__desc")!.hidden)).toEqual([false, false, true, true]);
    expect(items[0].querySelector(".nx-actions__desc")!.textContent).toBe(ITEMS[0].description);
    const [reset, off, cert, card] = buttons(el);
    expect(reset.getAttribute("variant")).toBe("secondary");
    expect(reset.getAttribute("icon")).toBe("key");
    expect(off.getAttribute("variant")).toBe("danger");
    // El enlace: un <a> de verdad, en otra pestaña y con el nombre del archivo.
    expect(inner(cert).tagName).toBe("A");
    expect(inner(cert).getAttribute("href")).toBe("/hcm/certificates/1.pdf");
    expect(inner(cert).getAttribute("target")).toBe("_blank");
    expect(inner(cert).getAttribute("download")).toBe("certificado.pdf");
    expect(card.hasAttribute("disabled")).toBe(true);
  });

  it("un botón emite nx-actions-action con su id; un enlace, uno apagado o la descripción no", async () => {
    const el = await mount();
    const got: ActionsActionDetail[] = [];
    el.addEventListener("nx-actions-action", (e) => got.push(e.detail));
    const [reset, , cert, card] = buttons(el);
    inner(reset).click();
    inner(card).click();
    cert.addEventListener("click", (e) => e.preventDefault());
    inner(cert).click();
    el.querySelector<HTMLElement>(".nx-actions__desc")!.click();
    expect(got.map((d) => d.id)).toEqual(["reset"]);
    expect(got[0].item.label).toBe(ITEMS[0].label);
  });

  it("busy: esa acción espera, las demás se apagan y no emiten; el foco no se pierde al repintar", async () => {
    const el = await mount();
    const got: string[] = [];
    el.addEventListener("nx-actions-action", (e) => got.push(e.detail.id));
    const [reset, off] = buttons(el);
    inner(reset).focus();
    el.busy = "reset";
    await flush();
    expect(el.getAttribute("aria-busy")).toBe("true");
    expect(reset.hasAttribute("busy")).toBe(true);
    expect(off.hasAttribute("disabled")).toBe(true);
    expect(inner(reset).getAttribute("aria-busy")).toBe("true");
    inner(reset).click();
    inner(off).click();
    expect(got).toEqual([]);
    // Los mismos nodos: el foco sigue en el botón que se pulsó.
    expect(buttons(el)[0]).toBe(reset);
    expect(document.activeElement).toBe(inner(reset));
    el.busy = null;
    await flush();
    expect(el.hasAttribute("aria-busy")).toBe(false);
    expect(off.hasAttribute("disabled")).toBe(false);
    inner(off).click();
    expect(got).toEqual(["deactivate"]);
    // Un busy que no es de ninguna acción no apaga nada.
    el.busy = "otra";
    await flush();
    expect(off.hasAttribute("disabled")).toBe(false);
  });

  it("cambiar las acciones reutiliza los nodos de las que siguen y quita las que no", async () => {
    const el = await mount();
    const [reset] = buttons(el);
    el.items = [ITEMS[1], ITEMS[0]];
    await flush();
    expect(buttons(el)).toHaveLength(2);
    expect(buttons(el)[1]).toBe(reset);
    expect(buttons(el)[0].getAttribute("label")).toBe(ITEMS[1].label);
    el.items = [];
    await flush();
    expect(el.querySelector("ul")!.hidden).toBe(true);
  });

  it("los atributos JSON funcionan; sin id o sin label se descarta; un id repetido queda una vez", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.innerHTML = `<nx-actions items='${JSON.stringify([{ id: "a", label: "Uno" }, { id: "a", label: "Otra" }, { label: "Sin id" }, { id: "b" }, { id: 7, label: "Siete" }])}' labels='{"group":"Qué hacer"}'></nx-actions>`;
    const el = document.querySelector("nx-actions")!;
    await flush();
    expect(el.items.map((a) => a.id)).toEqual(["a", "7"]);
    expect(el.querySelector("ul")!.getAttribute("aria-label")).toBe("Qué hacer");
    el.setAttribute("items", "{no es json");
    expect(warn).toHaveBeenCalled();
    expect(el.items).toHaveLength(2);
  });

  it("BDUI: Actions", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    render({ component: "Actions", props: { items: ITEMS.slice(0, 2), busy: "reset" } }, root);
    await flush();
    const el = root.querySelector("nx-actions")!;
    expect(buttons(el)).toHaveLength(2);
    expect(buttons(el)[0].hasAttribute("busy")).toBe(true);
  });
});

// La descripción de cada acción iba debajo de su botón, pero sin ligarse a él: el lector de pantalla
// solo la decía si se seguía leyendo, no al llegar al botón con Tab.
describe("<nx-actions>: la descripción describe a su botón", () => {
  it("aria-describedby en el control de adentro, con la descripción; sin descripción, nada", async () => {
    const el = await mount();
    const [reset, off, cert, card] = buttons(el);
    const desc = (b: NxButton) => document.getElementById(inner(b).getAttribute("aria-describedby") ?? "")?.textContent;
    expect(desc(reset)).toBe(ITEMS[0].description);
    expect(desc(off)).toBe(ITEMS[1].description);
    expect(inner(cert).hasAttribute("aria-describedby")).toBe(false);
    expect(inner(card).hasAttribute("aria-describedby")).toBe(false);
    // Cambia la descripción, o la acción pasa a enlace (el control se rehace): sigue ligada.
    el.items = [{ ...ITEMS[0], href: "/x", description: "Otra explicación" }, { ...ITEMS[1], description: "" }];
    await flush();
    const [a, b] = buttons(el);
    expect(inner(a).tagName).toBe("A");
    expect(desc(a)).toBe("Otra explicación");
    expect(inner(b).hasAttribute("aria-describedby")).toBe(false);
  });
});
