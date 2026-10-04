// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render } from "../src/bdui";
import type { NxButton } from "../src/index";
import "../src/index";

const inner = (el: NxButton) => el.querySelector<HTMLElement>(".nx-button__btn")!;
const text = (el: NxButton) => el.querySelector(".nx-button__text")!.textContent;

function mount(html: string): NxButton {
  document.body.innerHTML = html;
  return document.querySelector("nx-button")!;
}

describe("<nx-button href>: un enlace de verdad", () => {
  it("con href, el control de adentro es un <a href> con el aspecto del botón", () => {
    const el = mount('<nx-button label="Correos por corregir" icon="mail" variant="primary" href="/hcm/employees/invalid_emails"></nx-button>');
    const a = inner(el);
    expect(a.tagName).toBe("A");
    expect(a.getAttribute("href")).toBe("/hcm/employees/invalid_emails");
    expect(a.className).toContain("nx-button--primary");
    expect(a.hasAttribute("role")).toBe(false);
    expect(a.hasAttribute("type")).toBe(false);
    expect(text(el)).toBe("Correos por corregir");
    // El conmutador del registro sigue siendo un botón: sólo cambia el control principal.
    expect(el.querySelectorAll("a")).toHaveLength(1);
  });

  it("new-tab abre en otra pestaña sin dar acceso a la página de origen", () => {
    const el = mount('<nx-button label="Manual" href="https://example.com/manual.pdf" new-tab></nx-button>');
    expect(inner(el).getAttribute("target")).toBe("_blank");
    expect(inner(el).getAttribute("rel")).toBe("noopener noreferrer");
    el.newTab = false;
    expect(inner(el).hasAttribute("target")).toBe(false);
    expect(inner(el).hasAttribute("rel")).toBe(false);
  });

  it("download descarga en vez de navegar", () => {
    const el = mount('<nx-button label="Plantilla" href="/plantilla.xlsx" download></nx-button>');
    expect(inner(el).hasAttribute("download")).toBe(true);
    el.download = false;
    expect(inner(el).hasAttribute("download")).toBe(false);
  });

  it("una dirección que no es segura no se pinta: el enlace queda apagado", () => {
    for (const bad of ["javascript:alert(1)", " java\tscript:alert(1)", "data:text/html,<b>x</b>", ""]) {
      const el = mount("<nx-button label='Ir'></nx-button>");
      el.setAttribute("href", bad);
      const a = inner(el);
      expect(a.tagName, bad).toBe("A");
      expect(a.hasAttribute("href"), bad).toBe(false);
      expect(a.getAttribute("role"), bad).toBe("link");
      expect(a.getAttribute("aria-disabled"), bad).toBe("true");
    }
  });

  it("deshabilitado u ocupado, no lleva a ninguna parte (ni con Ctrl/⌘+clic ni con la rueda)", () => {
    const el = mount('<nx-button label="Ir" href="/destino"></nx-button>');
    el.disabled = true;
    expect(inner(el).hasAttribute("href")).toBe(false);
    expect(inner(el).getAttribute("role")).toBe("link");
    expect(inner(el).getAttribute("aria-disabled")).toBe("true");
    el.disabled = false;
    expect(inner(el).getAttribute("href")).toBe("/destino");
    expect(inner(el).getAttribute("aria-disabled")).toBe("false");
    el.busy = true;
    expect(inner(el).hasAttribute("href")).toBe(false);
  });

  it("el clic del enlace llega a la app (un router lo intercepta); apagado, no llega", () => {
    const el = mount('<nx-button label="Ir" href="/destino"></nx-button>');
    const seen = vi.fn((e: Event) => e.preventDefault());
    document.addEventListener("click", seen);
    inner(el).click();
    expect(seen).toHaveBeenCalledTimes(1);
    el.disabled = true;
    inner(el).click();
    expect(seen).toHaveBeenCalledTimes(1);
    document.removeEventListener("click", seen);
  });

  it("con href, stream no corre: el enlace navega", () => {
    const el = mount('<nx-button label="Ir" href="/destino" stream="/tarea"></nx-button>');
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("click", prevent);
    inner(el).click();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(el.busy).toBe(false);
    document.removeEventListener("click", prevent);
    fetchSpy.mockRestore();
  });

  it("aparecer o irse href cambia el control sin perder etiqueta, ícono ni oyentes", () => {
    const el = mount('<nx-button label="Guardar" icon="save"></nx-button>');
    expect(inner(el).tagName).toBe("BUTTON");
    el.href = "/otro";
    expect(inner(el).tagName).toBe("A");
    expect(text(el)).toBe("Guardar");
    expect(el.querySelectorAll(".nx-button__btn")).toHaveLength(1);
    const seen = vi.fn((e: Event) => e.preventDefault());
    el.addEventListener("click", seen);
    inner(el).click();
    expect(seen).toHaveBeenCalledTimes(1);
    el.href = null;
    expect(inner(el).tagName).toBe("BUTTON");
    expect((inner(el) as HTMLButtonElement).type).toBe("button");
    expect(text(el)).toBe("Guardar");
    el.disabled = true;
    inner(el).click();
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("desde un payload BDUI", () => {
    const [el] = render(
      { component: "Button", props: { label: "Correos por corregir", icon: "mail", href: "/hcm/employees/invalid_emails", newTab: true } },
      document.body,
    );
    const a = (el as NxButton).querySelector<HTMLAnchorElement>(".nx-button__btn")!;
    expect(a.tagName).toBe("A");
    expect(a.getAttribute("href")).toBe("/hcm/employees/invalid_emails");
    expect(a.target).toBe("_blank");
  });
});
