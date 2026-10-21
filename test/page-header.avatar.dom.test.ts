// @vitest-environment happy-dom
// `<nx-page-header avatar>`: la página de una persona.
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/page-header/index";
import { registerIcons } from "../src/core/icons";
import type { NxPageHeader, PageHeaderAvatarDetail } from "../src/components/page-header/index";

afterEach(() => {
  document.body.innerHTML = "";
});

function mount(attrs: string): NxPageHeader {
  document.body.innerHTML = `<nx-page-header ${attrs}></nx-page-header>`;
  return document.querySelector("nx-page-header")!;
}
const head = (el: NxPageHeader) => el.querySelector<HTMLElement>(".nx-page-header__head")!;

describe("<nx-page-header avatar>", () => {
  it("las iniciales con el color del nombre, antes del título; el ícono del módulo sobra", () => {
    registerIcons({ user: '<circle cx="12" cy="8" r="4"/>' });
    const el = mount('heading="Laura Marcela Gómez Restrepo" subheading="Analista de nómina sénior" heading-icon="user" avatar="Laura Gómez"');
    const h = head(el);
    expect(h.classList.contains("has-avatar")).toBe(true);
    expect(h.firstElementChild!.className).toBe("nx-page-header__avatar");
    const face = h.querySelector<HTMLElement>(".nx-page-header__face")!;
    expect(face.textContent).toBe("LG");
    expect(face.style.getPropertyValue("--_h")).not.toBe("");
    expect(face.getAttribute("aria-hidden")).toBe("true");
    expect(el.querySelector(".nx-page-title__icon")).toBeNull();
    expect([...h.children].map((c) => c.className)).toEqual(["nx-page-header__avatar", "nx-page-header__title nx-page-title", "nx-page-header__subheading"]);
  });

  it("una dirección es la foto; una insegura no se pinta", () => {
    const el = mount('heading="Laura" avatar="/fotos/482.jpg"');
    const img = el.querySelector<HTMLImageElement>(".nx-page-header__face img")!;
    expect(img.getAttribute("src")).toMatch(/\/fotos\/482\.jpg$/);
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
    el.avatar = "javascript:alert(1)";
    // No es una dirección que se reconozca: se toma como nombre.
    expect(el.querySelector(".nx-page-header__face img")).toBeNull();
    el.avatar = "http://otro.example/f.jpg";
    expect(el.querySelector(".nx-page-header__avatar")).toBeNull();
  });

  it("avatar-action pone el botón que avisa", () => {
    const el = mount('heading="Laura" avatar="Laura Gómez" avatar-action="Cambiar la foto"');
    const got: PageHeaderAvatarDetail[] = [];
    el.addEventListener("nx-page-header-avatar", (e) => got.push(e.detail));
    const b = el.querySelector<HTMLButtonElement>(".nx-page-header__avatar-act")!;
    expect(b.getAttribute("aria-label")).toBe("Cambiar la foto");
    b.click();
    expect(got).toEqual([{ action: "Cambiar la foto" }]);
  });

  it("sin avatar todo sigue como antes, y quitarlo lo quita", () => {
    const el = mount('heading="Empleados" avatar="Laura"');
    el.removeAttribute("avatar");
    expect(head(el).classList.contains("has-avatar")).toBe(false);
    expect(el.querySelector(".nx-page-header__avatar")).toBeNull();
    expect(head(el).firstElementChild!.tagName).toBe("H1");
  });
});
