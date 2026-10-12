// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/alerts/index";
import "../src/components/board/index";
import { sortAlerts, type AlertItem, type AlertsActionDetail, type NxAlerts } from "../src/components/alerts/index";
import type { NxBoard } from "../src/components/board/index";

afterEach(() => {
  document.body.innerHTML = "";
});
const tick = () => new Promise((r) => setTimeout(r, 0));
/** Un clic; devuelve si el componente lo canceló. Después se cancela siempre, para que happy-dom
 *  no intente navegar a los enlaces. */
const click = (el: Element, init: MouseEventInit = {}) => {
  let prevented = false;
  const stop = (e: Event) => {
    prevented = e.defaultPrevented;
    e.preventDefault();
  };
  document.addEventListener("click", stop, { once: true });
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
  document.removeEventListener("click", stop);
  return { defaultPrevented: prevented };
};

const ITEMS: AlertItem[] = [
  { id: "glosa", severity: "warning", title: "Recobros glosados", text: "4 por $3.200.000.", action: { label: "Ver cuáles", filter: "est:Glosado" } },
  { id: "d180", severity: "critical", title: "Pasó el día 180", meta: "Día 197", text: "Ana Ruiz · lumbago.", action: { label: "Abrir la ficha", href: "/hcm/ana", newTab: true } },
  { id: "rad", severity: "serious", title: "Recobros sin radicar", text: "12 sin radicar.", action: { label: "Ver cuáles", filter: "est:Sin radicar" } },
  { id: "rep", severity: "warning", title: "Se repite", action: { label: "Avisar" } },
  { id: "x", severity: "rara" as never, title: "Aviso suelto" },
  { id: "malo", severity: "critical" } as never,
];

async function mount(items: AlertItem[] = ITEMS, attrs = ""): Promise<NxAlerts> {
  document.body.innerHTML = `<nx-alerts ${attrs}></nx-alerts>`;
  const el = document.querySelector("nx-alerts")!;
  el.items = items;
  await tick();
  return el;
}
const titles = (el: Element) => [...el.querySelectorAll(".nx-alerts__name")].map((n) => n.textContent);

describe("sortAlerts", () => {
  it("descarta sin título, normaliza la gravedad y ordena estable", () => {
    const out = sortAlerts(ITEMS);
    expect(out.map((i) => i.id)).toEqual(["d180", "rad", "glosa", "rep", "x"]);
    expect(out.at(-1)!.severity).toBe("info");
    expect(sortAlerts(ITEMS, "none").map((i) => i.id)).toEqual(["glosa", "d180", "rad", "rep", "x"]);
  });
});

describe("<nx-alerts>", () => {
  it("lista con gravedad en ícono y texto, meta, detalle y acciones", async () => {
    const el = await mount();
    const ol = el.querySelector("ol.nx-alerts__list")!;
    expect(ol.getAttribute("aria-label")).toBe("Para actuar");
    expect(titles(el)).toEqual(["Pasó el día 180", "Recobros sin radicar", "Recobros glosados", "Se repite", "Aviso suelto"]);
    const first = el.querySelector(".nx-alerts__item")!;
    expect(first.className).toContain("is-critical");
    expect(first.querySelector(".nx-alerts__sev svg")).toBeTruthy();
    expect(first.querySelector(".nx-alerts__level")!.textContent).toBe("Urgente");
    expect(first.querySelector(".nx-alerts__meta")!.textContent).toBe("Día 197");
    expect(first.querySelector(".nx-alerts__text")!.textContent).toBe("Ana Ruiz · lumbago.");
    const link = first.querySelector("a.nx-alerts__action")!;
    expect(link.getAttribute("href")).toBe("/hcm/ana");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener");
    expect(link.getAttribute("aria-describedby")).toBe(first.querySelector(".nx-alerts__title")!.id);
    const levels = [...el.querySelectorAll(".nx-alerts__level")].map((n) => n.textContent);
    expect(levels).toEqual(["Urgente", "Pronto", "Seguimiento", "Seguimiento", "Aviso"]);
    const filt = el.querySelectorAll("button.nx-alerts__action");
    expect(filt[0].getAttribute("data-nx-filter")).toBe("est:Sin radicar");
    expect(filt[0].getAttribute("data-nx-label")).toBe("Ver cuáles");
    expect(filt[2].hasAttribute("data-nx-filter")).toBe(false);
    expect(el.querySelector(".nx-alerts__item:last-child .nx-alerts__action")).toBeNull();
  });

  it("los datos van como texto, nunca como HTML", async () => {
    const el = await mount([{ id: "a", severity: "info", title: "<img src=x onerror=alert(1)>", text: "<b>x</b>", action: { label: "<i>y</i>", href: "javascript:alert(1)" } }]);
    expect(el.querySelector("img, b, i")).toBeNull();
    expect(el.querySelector(".nx-alerts__name")!.textContent).toBe("<img src=x onerror=alert(1)>");
    // Un href inseguro no es enlace: queda el botón que avisa.
    expect(el.querySelector("a")).toBeNull();
    expect(el.querySelector("button.nx-alerts__action")!.textContent).toBe("<i>y</i>");
  });

  it("sort=none, atributo items en JSON, labels y vacío", async () => {
    const el = await mount(ITEMS, 'sort="none"');
    expect(titles(el)[0]).toBe("Recobros glosados");
    el.setAttribute("labels", JSON.stringify({ critical: "Ya", group: "Pendientes" }));
    el.setAttribute("items", JSON.stringify([{ id: "z", severity: "critical", title: "Uno" }]));
    await tick();
    expect(el.querySelector("ol")!.getAttribute("aria-label")).toBe("Pendientes");
    expect(el.querySelector(".nx-alerts__level")!.textContent).toBe("Ya");
    el.items = [];
    await tick();
    expect(el.querySelector("ol")).toBeNull();
    expect(el.querySelector(".nx-alerts__empty")!.textContent).toBe("Nada pendiente.");
    el.empty = "Nada pendiente al corte";
    await tick();
    expect(el.querySelector(".nx-alerts__empty")!.textContent).toBe("Nada pendiente al corte");
  });

  it("limit: «Ver {n} más» despliega, lleva el foco al primero nuevo y «Ver menos» lo deja en el botón", async () => {
    const el = await mount(ITEMS, 'limit="2"');
    expect(el.limit).toBe(2);
    expect(el.querySelectorAll(".nx-alerts__item")).toHaveLength(2);
    const more = el.querySelector<HTMLButtonElement>(".nx-alerts__more")!;
    expect(more.textContent).toBe("Ver 3 más");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    more.focus();
    click(more);
    const items = el.querySelectorAll<HTMLElement>(".nx-alerts__item");
    expect(items).toHaveLength(5);
    expect(document.activeElement).toBe(items[2]);
    const less = el.querySelector<HTMLButtonElement>(".nx-alerts__more")!;
    expect(less.textContent).toBe("Ver menos");
    expect(less.getAttribute("aria-expanded")).toBe("true");
    click(less);
    expect(el.querySelectorAll(".nx-alerts__item")).toHaveLength(2);
    expect(document.activeElement).toBe(el.querySelector(".nx-alerts__more"));
    el.limit = 10;
    await tick();
    expect(el.querySelector(".nx-alerts__more")).toBeNull();
    el.setAttribute("limit", "-1");
    expect(el.limit).toBe(6);
  });

  it("repintar devuelve el foco a la misma acción", async () => {
    const el = await mount();
    const btn = el.querySelector<HTMLButtonElement>('[data-nx-key="rad"] .nx-alerts__action')!;
    btn.focus();
    el.items = ITEMS.filter((i) => i.id !== "d180");
    await tick();
    expect(document.activeElement).not.toBe(btn);
    expect(document.activeElement).toBe(el.querySelector('[data-nx-key="rad"] .nx-alerts__action'));
  });

  it("nx-alerts-action: avisa y, cancelado, el enlace no navega", async () => {
    const el = await mount();
    const seen: AlertsActionDetail[] = [];
    let cancel = false;
    el.addEventListener("nx-alerts-action", (e) => {
      seen.push(e.detail);
      if (cancel) e.preventDefault();
    });
    const link = el.querySelector("a.nx-alerts__action")!;
    expect(click(link).defaultPrevented).toBe(false);
    expect(seen[0].item.id).toBe("d180");
    cancel = true;
    expect(click(link).defaultPrevented).toBe(true);
    // Con Ctrl el navegador abre otra pestaña: no se avisa.
    click(link, { ctrlKey: true });
    expect(seen).toHaveLength(2);
    click(el.querySelector('[data-nx-key="rep"] .nx-alerts__action')!);
    expect(seen[2].item.id).toBe("rep");
  });

  it("dentro de un <nx-board>, la acción con filter filtra el tablero; cancelada, no", async () => {
    document.body.innerHTML = `<nx-board><nx-alerts></nx-alerts></nx-board>`;
    const board = document.querySelector("nx-board") as NxBoard;
    const el = document.querySelector("nx-alerts")!;
    el.items = ITEMS;
    await tick();
    let cancel = true;
    el.addEventListener("nx-alerts-action", (e) => cancel && e.preventDefault());
    const btn = el.querySelector('[data-nx-key="rad"] .nx-alerts__action')!;
    click(btn);
    expect(board.filters).toEqual({});
    cancel = false;
    click(btn);
    expect(board.filters).toEqual({ est: ["Sin radicar"] });
  });
});
