// @vitest-environment happy-dom
//
// happy-dom no implementa la Popover API: se simula con los mismos eventos que emite el navegador.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "../src/bdui";
import type { NxDate } from "../src/components/date/index";
import "../src/components/date/index";

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
});
afterEach(() => {
  document.body.innerHTML = "";
});

const UNAVAILABLE = JSON.stringify({ dates: [{ date: "2026-10-12", label: "Festivo: Día de la Raza" }], weekdays: [0] });

function mount(attrs = ""): NxDate {
  document.body.innerHTML = `<nx-date today="2026-10-07" week-start="1" locale="es-CO" unavailable='${UNAVAILABLE}' ${attrs}></nx-date>`;
  return document.querySelector("nx-date")!;
}
const input = (el: NxDate) => el.querySelector<HTMLInputElement>(".nx-date__input")!;
const btn = (el: NxDate) => el.querySelector<HTMLButtonElement>(".nx-date__btn")!;
const cell = (el: NxDate, iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return el.querySelector<HTMLElement>(`[data-day="${Math.round(Date.UTC(y, m - 1, d) / 864e5)}"]`)!;
};
const type = (el: NxDate, text: string) => {
  input(el).value = text;
  input(el).dispatchEvent(new Event("input", { bubbles: true }));
};

describe("<nx-date>", () => {
  it("se escribe a mano: el valor es ISO y al salir queda en el formato del locale", () => {
    const el = mount();
    expect(input(el).placeholder).toBe("dd/mm/aaaa");
    type(el, "8.10.26");
    expect(el.value).toBe("2026-10-08");
    input(el).dispatchEvent(new Event("change", { bubbles: true }));
    expect(input(el).value).toBe("08/10/2026");
  });

  it("lo que no es una fecha queda en `text`, con el valor vacío", () => {
    const el = mount();
    type(el, "31/02/2026");
    expect(el.value).toBe("");
    expect(el.text).toBe("31/02/2026");
    expect(el.validationMessage).toBe("Escribe una fecha válida");
  });

  it("el calendario tacha los días bloqueados con su motivo y no los deja elegir", () => {
    const el = mount();
    btn(el).click();
    expect(el.open).toBe(true);
    const holiday = cell(el, "2026-10-12");
    expect(holiday.getAttribute("aria-disabled")).toBe("true");
    expect(holiday.title).toBe("Festivo: Día de la Raza");
    expect(cell(el, "2026-10-11").getAttribute("aria-disabled")).toBe("true"); // domingo
    expect(cell(el, "2026-10-13").getAttribute("aria-disabled")).toBeNull();
    const change = vi.fn();
    el.addEventListener("nx-date-change", change);
    holiday.click();
    expect(el.open).toBe(true);
    expect(el.value).toBe("");
    expect(change).not.toHaveBeenCalled();
    expect(el.querySelector(".nx-date__note")!.textContent).toContain("Festivo: Día de la Raza");
    cell(el, "2026-10-13").click();
    expect(el.open).toBe(false);
    expect(el.value).toBe("2026-10-13");
    expect(input(el).value).toBe("13/10/2026");
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("min y max también apagan días (y la navegación más allá)", () => {
    const el = mount('min="today" max="2026-10-20"');
    btn(el).click();
    expect(cell(el, "2026-10-06").getAttribute("aria-disabled")).toBe("true");
    expect(cell(el, "2026-10-21").getAttribute("aria-disabled")).toBe("true");
    expect(el.querySelector<HTMLButtonElement>("[data-nav='1']")!.disabled).toBe(true);
    expect(el.querySelector<HTMLButtonElement>("[data-nav='-1']")!.disabled).toBe(true);
  });

  it("se maneja con el teclado: flechas, Enter, Escape", () => {
    const el = mount('value="2026-10-14"');
    btn(el).click();
    const grid = el.querySelector(".nx-date__grid")!;
    const key = (k: string) => grid.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    key("ArrowRight");
    key("Enter");
    expect(el.value).toBe("2026-10-15");
    btn(el).click();
    key("ArrowDown"); // 22
    key("PageDown"); // 22 nov
    expect(el.querySelector(".nx-date__title")!.textContent!.toLowerCase()).toContain("noviembre");
    el.querySelector(".nx-date__pop")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(el.open).toBe(false);
    expect(el.value).toBe("2026-10-15");
  });

  it("un día bloqueado escrito a mano no es válido y dice por qué", () => {
    const el = mount();
    type(el, "12/10/2026");
    expect(el.value).toBe("2026-10-12");
    expect(el.validationMessage).toBe("Festivo: Día de la Raza");
  });

  it("llega por BDUI con `unavailable` como objeto", () => {
    const host = document.createElement("div");
    document.body.append(host);
    render({ component: "Date", props: { value: "2026-10-12", unavailable: { weekdays: [1] }, locale: "es-CO" } }, host);
    const el = host.querySelector("nx-date")!;
    expect(el.value).toBe("2026-10-12");
    expect(el.validationMessage).toBe("Ese día no se puede elegir");
  });
});

describe("<nx-date>: al abrir", () => {
  it("sin fecha, el foco va al primer día que se puede elegir (hoy es domingo)", () => {
    document.body.innerHTML = `<nx-date today="2026-10-11" locale="es-CO" unavailable='${UNAVAILABLE}'></nx-date>`;
    const el = document.querySelector("nx-date")!;
    el.querySelector<HTMLButtonElement>(".nx-date__btn")!.click();
    // 11 domingo, 12 festivo: el 13.
    expect(el.querySelector('[tabindex="0"]')!.textContent).toBe("13");
  });
});
