// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import "../src/components/page-header/index";
import { registerIcons } from "../src/core/icons";

beforeAll(() => {
  registerIcons({ users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6"/>' });
});

afterEach(() => {
  document.body.innerHTML = "";
});

const mount = (html: string) => {
  document.body.innerHTML = html;
  return document.querySelector("nx-page-header")!;
};

describe("<nx-page-header>", () => {
  it("pinta el título como h1 con el ícono del módulo, con la letra compartida del título de página", () => {
    const el = mount('<nx-page-header heading="Empleados" heading-icon="users"></nx-page-header>');
    const h1 = el.querySelector("h1")!;
    expect(h1.className).toBe("nx-page-header__title nx-page-title");
    expect(h1.textContent).toBe("Empleados");
    const tile = h1.firstElementChild!;
    expect(tile.className).toBe("nx-page-title__icon");
    expect(tile.getAttribute("aria-hidden")).toBe("true");
    expect(tile.querySelector(".nx-icon svg")).not.toBeNull();
  });

  it("un ícono que no está registrado no se pinta (unas iniciales se leerían con el título)", () => {
    const el = mount('<nx-page-header heading="Empleados" heading-icon="no-existe"></nx-page-header>');
    expect(el.querySelector(".nx-page-title__icon")).toBeNull();
    expect(el.querySelector("h1")!.textContent).toBe("Empleados");
  });

  it("deja los hijos del autor donde están y agrega título y subtítulo al final", () => {
    const el = mount(
      '<nx-page-header heading="Contratación" subheading="Los contratos de tu alcance"><nav id="ruta">Inicio</nav><div slot="actions" id="acc"><button>Nuevo</button></div><div slot="nav" id="tabs">Pestañas</div></nx-page-header>',
    );
    // Los del autor, en su orden y sin moverse; el título y el subtítulo, una vez cada uno (su lugar
    // en pantalla lo pone `order`, no el DOM).
    const ruta = el.querySelector("#ruta");
    el.heading = "Contratos";
    expect(el.querySelector("#ruta")).toBe(ruta);
    expect([...el.children].filter((c) => c.id).map((c) => c.id)).toEqual(["ruta", "acc", "tabs"]);
    expect(el.querySelectorAll(":scope > .nx-page-header__head")).toHaveLength(1);
    // El subtítulo va con el título, en su bloque: en lo angosto no queda detrás de las acciones.
    const head = el.querySelector(".nx-page-header__head")!;
    expect([...head.children].map((c) => c.className)).toEqual(["nx-page-header__title nx-page-title", "nx-page-header__subheading"]);
    expect(el.querySelector(".nx-page-header__subheading")!.textContent).toBe("Los contratos de tu alcance");
  });

  it("sigue a sus atributos: cambia el texto, quita lo vacío y no duplica", () => {
    const el = mount('<nx-page-header heading="Uno" subheading="Algo"></nx-page-header>');
    el.heading = "Dos";
    el.heading = "Dos";
    expect(el.querySelectorAll("h1")).toHaveLength(1);
    expect(el.querySelector("h1")!.textContent).toBe("Dos");
    el.subheading = null;
    expect(el.querySelector(".nx-page-header__subheading")).toBeNull();
    el.heading = "";
    expect(el.querySelector("h1")).toBeNull();
    expect(el.querySelector(".nx-page-header__head")).toBeNull();
    el.headingIcon = "users";
    el.heading = "Tres";
    expect(el.querySelector("h1 .nx-page-title__icon")).not.toBeNull();
  });
});
