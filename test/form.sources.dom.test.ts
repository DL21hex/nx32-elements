// @vitest-environment happy-dom
// Las fuentes de la librería llenan un <nx-form> con su origen: el texto pegado, el escáner y un
// documento leído. Ver src/core/fill.ts.
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/form/index";
import "../src/components/paste-fill/index";
import "../src/components/scan/index";
import "../src/components/capture/index";
import type { FormSection, NxForm } from "../src/components/form/index";
import type { NxPasteFill } from "../src/components/paste-fill/index";
import type { NxScan } from "../src/components/scan/index";
import type { NxDocCapture } from "../src/components/capture/index";
import { fillTarget } from "../src/core/fill";

afterEach(() => {
  document.body.innerHTML = "";
});

const tick = () => new Promise((r) => setTimeout(r, 0));
const field = (f: Element, k: string) => f.querySelector(`nx-field[data-key="${k}"]`)!;

const PROVEEDOR: FormSection[] = [
  {
    heading: "Proveedor",
    fields: [
      { key: "razon", label: "Razón social", required: true },
      { key: "correo", label: "Correo", type: "email" },
      { key: "celular", label: "Celular", type: "tel" },
      { key: "ciudad", label: "Ciudad", type: "select", options: ["Barranquilla", "Medellín", "Bogotá"] },
      { key: "monto", label: "Monto del primer pedido", type: "money" },
    ],
  },
];

describe("fillTarget", () => {
  it("el de for, el que contiene o el que envuelve; nada si no es un <nx-form>", () => {
    document.body.innerHTML = '<div id="caja"><nx-form id="f1"></nx-form></div><nx-form id="f2"><span id="adentro"></span></nx-form><p id="p"><nx-form id="f3"></nx-form></p><div id="otro"></div>';
    const $ = (id: string) => document.getElementById(id)!;
    expect(fillTarget($("otro"), "f1")).toBe($("f1"));
    expect(fillTarget($("otro"), "caja")).toBe($("f1"));
    expect(fillTarget($("adentro"))).toBe($("f2"));
    expect(fillTarget($("p"))).toBe($("f3"));
    expect(fillTarget($("otro"))).toBeNull();
    expect(fillTarget($("otro"), "otro")).toBeNull();
  });
});

describe("<nx-paste-fill> con un <nx-form>", () => {
  async function mount(): Promise<{ pf: NxPasteFill; form: NxForm }> {
    document.body.innerHTML = '<nx-paste-fill lang="es-CO"><nx-form locale="es-CO"></nx-form></nx-paste-fill>';
    const form = document.querySelector("nx-form")!;
    form.sections = PROVEEDOR;
    await tick();
    return { pf: document.querySelector("nx-paste-fill")!, form };
  }

  it("los campos salen del esquema", async () => {
    const { pf } = await mount();
    expect(pf.fields.map((f) => [f.name, f.type])).toEqual([
      ["razon", "text"],
      ["correo", "email"],
      ["celular", "tel"],
      ["ciudad", "select"],
      ["monto", "number"],
    ]);
    expect(pf.fields.find((f) => f.name === "monto")!.kind).toBe("money");
  });

  it("lo encontrado llena el formulario con el chip «Texto pegado» y su evidencia; deshacer lo devuelve", async () => {
    const { pf, form } = await mount();
    const texto = "Buenas tardes, soy Laura Gómez de Aceros del Caribe S.A.S.\nCorreo: compras@aceroscaribe.co\nCel 310 456 7890\nEstamos en Barranquilla. Primer pedido por $ 4.500.000";
    const detail = await pf.fill(texto);
    expect(detail).not.toBeNull();
    expect(form.values.correo).toBe("compras@aceroscaribe.co");
    expect(form.values.ciudad).toBe("Barranquilla");
    expect(form.values.monto).toBe(4500000);
    const correo = field(form, "correo");
    expect(correo.getAttribute("source")).toBe("Texto pegado");
    expect(correo.getAttribute("source-detail")).toContain("compras@aceroscaribe.co");
    expect(form.querySelector(".nx-form__status")!.textContent).toMatch(/datos de Texto pegado/);
    // Sin las marcas propias de paste-fill: las pone el formulario.
    expect(pf.querySelectorAll(".nx-pf__ring")).toHaveLength(0);
    expect(pf.state).toBe("idle");
    expect(pf.undo()).toBe(true);
    expect(form.values.correo).toBeNull();
  });

  it("respeta lo que la persona escribió", async () => {
    const { pf, form } = await mount();
    const correo = form.querySelector<HTMLInputElement>('nx-field[data-key="correo"] input')!;
    correo.value = "laura@otra.co";
    correo.dispatchEvent(new Event("input", { bubbles: true }));
    correo.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await pf.fill("Correo: compras@aceroscaribe.co");
    expect(form.values.correo).toBe("laura@otra.co");
  });
});

describe("<nx-scan> con un <nx-form>", () => {
  it("field llena ese campo con el origen «Escáner»; filas.campo agrega una fila por código", async () => {
    document.body.innerHTML = '<nx-form locale="es-CO"><nx-scan slot="tools" mode="count" field="lineas.codigo" wedge="off"></nx-scan></nx-form><nx-scan id="suelto" for="f" field="guia" wedge="off"></nx-scan>';
    const form = document.querySelector("nx-form")!;
    form.id = "f";
    form.fields = [
      { key: "guia", label: "Guía de transporte" },
      { key: "lineas", label: "Productos", type: "rows", fields: [{ key: "codigo", label: "Código" }, { key: "cant", label: "Cantidad", type: "number" }] },
    ];
    await tick();
    const [enLinea, suelto] = [...document.querySelectorAll<NxScan>("nx-scan")];
    suelto.add("GUIA-48211");
    expect(form.values.guia).toBe("GUIA-48211");
    expect(field(form, "guia").getAttribute("source")).toBe("Escáner");
    enLinea.add("7707123450011");
    enLinea.add("7707123450028");
    enLinea.add("7707123450011");
    expect((form.values.lineas as { codigo: string }[]).map((r) => r.codigo)).toEqual(["7707123450011", "7707123450028"]);
    expect(form.sources["lineas.0.codigo"]).toBe("Escáner");
  });
});

describe("<nx-doc-capture> con un <nx-form>", () => {
  it("el botón pasa lo leído al formulario (las tablas, como filas) con el nombre del archivo", async () => {
    document.body.innerHTML = '<nx-doc-capture for="factura"></nx-doc-capture><nx-form id="factura" locale="es-CO"></nx-form>';
    const form = document.querySelector("nx-form")!;
    form.fields = [
      { key: "nit", label: "NIT", required: true },
      { key: "vence", label: "Vence", type: "date" },
      { key: "total", label: "Total", type: "money" },
      { key: "items", label: "Ítems", type: "rows", fields: [{ key: "desc", label: "Descripción" }, { key: "cant", label: "Cantidad", type: "number" }] },
    ];
    const cap = document.querySelector<NxDocCapture>("nx-doc-capture")!;
    cap.schema = [
      { key: "nit", label: "NIT" },
      { key: "vence", label: "Vence", type: "date" },
      { key: "total", label: "Total", type: "money" },
      { key: "items", label: "Ítems", type: "table", columns: [{ key: "desc", label: "Descripción" }, { key: "cant", label: "Cant.", type: "number" }] },
    ];
    await tick();
    const box = { page: 1, x: 0.1, y: 0.1, w: 0.2, h: 0.02 };
    cap.begin("FE-10482.pdf");
    cap.push({ type: "page", n: 1, src: "/p1.png", width: 800, height: 1000 });
    cap.push({ type: "field", key: "nit", value: "900.123.456-7", confidence: 0.99, box });
    cap.push({ type: "field", key: "vence", value: "12/10/2026", confidence: 0.98, box });
    cap.push({ type: "field", key: "total", value: "9.100.000", confidence: 0.97, box });
    cap.push({ type: "field", key: "items.0.desc", value: "Lámina HR 3 mm", confidence: 0.95, box });
    cap.push({ type: "field", key: "items.0.cant", value: "40", confidence: 0.95, box });
    cap.end();
    const btn = cap.querySelector<HTMLElement & { label: string }>("nx-button")!;
    expect(btn.label).toBe("Pasar al formulario");
    cap.querySelector<HTMLButtonElement>("nx-button .nx-button__btn")!.click();
    await tick();
    expect(form.values).toMatchObject({ nit: "900.123.456-7", vence: "2026-10-12", total: 9100000, items: [{ desc: "Lámina HR 3 mm", cant: 40 }] });
    expect(field(form, "nit").getAttribute("source")).toBe("FE-10482.pdf");
    expect(field(form, "nit").getAttribute("source-detail")).toBe("Leído de FE-10482.pdf");
    expect(form.sources["items.0.desc"]).toBe("FE-10482.pdf");
  });
});
