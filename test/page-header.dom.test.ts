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

  it("kpis: un <dl> con valor (con el locale), etiqueta y cambio con tono; los inválidos no salen", () => {
    const el = mount('<nx-page-header heading="Incapacidades" locale="es-CO"></nx-page-header>');
    el.kpis = [
      { id: "open", label: "Abiertas", value: 1284, delta: "+12 esta semana", tone: "warning", hint: "Sin cerrar" },
      { label: "Días", value: "3.402" },
      { label: "", value: 3 },
      { label: "Sin valor", value: "" },
      { label: "Tono raro", value: 2, delta: "x", tone: "rojo" as never },
    ];
    const dl = el.querySelector("dl.nx-page-header__kpis")!;
    expect(dl.getAttribute("aria-label")).toBe("Cifras");
    const kpis = [...dl.querySelectorAll(".nx-page-header__kpi")];
    expect(kpis).toHaveLength(3);
    expect(kpis[0].querySelector("dt")!.textContent).toBe("Abiertas");
    expect(kpis[0].querySelector("dd")!.firstChild!.textContent).toBe("1.284");
    expect(kpis[0].querySelector(".nx-page-header__kpi-delta")!.getAttribute("data-tone")).toBe("warning");
    expect(kpis[0].getAttribute("title")).toBe("Sin cerrar");
    expect(kpis[0].getAttribute("data-kpi")).toBe("open");
    expect(kpis[1].querySelector("dd")!.textContent).toBe("3.402");
    expect(kpis[2].querySelector(".nx-page-header__kpi-delta")!.getAttribute("data-tone")).toBe("neutral");
    // El mismo arreglo otra vez no rehace los nodos; vacío, se van.
    const first = dl.firstElementChild;
    el.kpis = [...el.kpis];
    expect(dl.firstElementChild).toBe(first);
    el.kpis = [];
    expect(el.querySelector(".nx-page-header__kpis")).toBeNull();
  });

  it("kpis: una cifra en -0 o que se redondea a cero no lleva signo; un negativo que se ve, sí", () => {
    const el = mount('<nx-page-header heading="Saldos" locale="es-CO"></nx-page-header>');
    el.kpis = [
      { label: "Cero negativo", value: -0 },
      { label: "Casi cero", value: -0.001 },
      { label: "Negativo", value: -3.5 },
    ];
    const dd = [...el.querySelectorAll(".nx-page-header__kpi dd")].map((d) => d.textContent);
    expect(dd).toEqual(["0", "0", "-3,5"]);
  });

  it("links: <a> de verdad con ícono, otra pestaña y descarga; una dirección insegura no sale", () => {
    const el = mount('<nx-page-header heading="Incapacidades"></nx-page-header>');
    el.setAttribute(
      "links",
      JSON.stringify([
        { label: "Reporte de ausentismo", href: "/hcm/incapacities/report", icon: "users" },
        { label: "Plantilla", href: "/hcm/incapacities/template.xlsx", newTab: true, download: "plantilla.xlsx" },
        { label: "Malo", href: "javascript:alert(1)" },
      ]),
    );
    const group = el.querySelector(".nx-page-header__links")!;
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-label")).toBe("Enlaces");
    const links = [...group.querySelectorAll<HTMLAnchorElement>("a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/hcm/incapacities/report", "/hcm/incapacities/template.xlsx"]);
    expect(links[0].querySelector(".nx-page-header__link-icon svg")).not.toBeNull();
    expect(links[0].hasAttribute("target")).toBe(false);
    expect(links[1].getAttribute("target")).toBe("_blank");
    expect(links[1].getAttribute("rel")).toBe("noopener noreferrer");
    expect(links[1].getAttribute("download")).toBe("plantilla.xlsx");
    expect(links[1].textContent).toBe("Plantilla");
    el.removeAttribute("links");
    expect(el.querySelector(".nx-page-header__links")).toBeNull();
  });

  it("los enlaces y las cifras van después del título y antes de la navegación, sin mover a los del autor", () => {
    const el = mount('<nx-page-header heading="Uno"><nav id="ruta">Inicio</nav><div slot="nav" id="tabs">Pestañas</div></nx-page-header>');
    el.links = [{ label: "Otra", href: "/otra" }];
    el.kpis = [{ label: "Total", value: 3 }];
    el.labels = { kpis: "Indicadores" };
    // El lugar en pantalla lo pone `order` (CSS); en el DOM, los del autor siguen en su orden y lo
    // del componente va después de ellos.
    const kids = [...el.children].map((c) => c.id || c.className);
    expect(kids.filter((k) => !k.startsWith("nx-"))).toEqual(["ruta", "tabs"]);
    expect(kids.slice(-2)).toEqual(["nx-page-header__links", "nx-page-header__kpis"]);
    expect(el.querySelector(".nx-page-header__kpis")!.getAttribute("aria-label")).toBe("Indicadores");
  });
});
