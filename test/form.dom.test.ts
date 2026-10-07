// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/form/index";
import type { FormSection, NxForm } from "../src/components/form/index";
import type { NxField } from "../src/components/field/index";

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const tick = () => new Promise((r) => setTimeout(r, 0));

const SECTIONS: FormSection[] = [
  {
    id: "ident",
    heading: "Identificación",
    fields: [
      { key: "nombres", label: "Nombres", required: true, span: 3 },
      { key: "apellidos", label: "Apellidos", required: true, span: 3 },
      { key: "rh", label: "Grupo sanguíneo", type: "select", options: ["O+", "A+"], span: 2 },
    ],
  },
  {
    id: "contacto",
    heading: "Contacto",
    fields: [
      { key: "correo", label: "Correo personal", type: "email", required: true },
      { key: "celular", label: "Celular", type: "tel" },
    ],
  },
  {
    id: "contrato",
    heading: "Contrato",
    fields: [
      {
        key: "cargo",
        label: "Cargo",
        type: "select",
        required: true,
        options: [
          { value: "Soldador", fills: { area: "Producción", riesgo: "IV" } },
          { value: "Auxiliar de bodega", fills: { area: "Logística", riesgo: "II" } },
        ],
      },
      { key: "area", label: "Área", type: "select", required: true, options: ["Producción", "Logística"] },
      { key: "riesgo", label: "Clase de riesgo", type: "segmented", required: true, options: ["I", "II", "III", "IV", "V"] },
      { key: "tipo", label: "Tipo de contrato", type: "radio", required: true, options: ["Indefinido", "Término fijo"] },
      { key: "fin", label: "Fecha de terminación", type: "date", required: true, when: { tipo: "Término fijo" } },
      { key: "arl", label: "ARL", type: "readonly", value: "Sura" },
      { key: "acepta", label: "Acepta el tratamiento de datos", type: "checkbox", required: true },
    ],
  },
];

async function mount(attrs = ""): Promise<NxForm> {
  document.body.innerHTML = `<nx-form locale="es-CO" heading="Nuevo ingreso" ${attrs}></nx-form>`;
  const f = document.querySelector("nx-form")!;
  f.sections = SECTIONS;
  await tick();
  return f;
}
const field = (f: NxForm, k: string) => f.querySelector<NxField>(`nx-field[data-key="${k}"]`)!;
const ctl = <T extends HTMLElement = HTMLInputElement>(f: NxForm, k: string) => f.querySelector<T>(`nx-field[data-key="${k}"] [name="${k}"]`)!;
function type(el: HTMLInputElement | HTMLSelectElement, v: string, leave = true) {
  el.value = v;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  if (leave) el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
}
function pick(f: NxForm, k: string, value: string) {
  const r = f.querySelector<HTMLInputElement>(`nx-field[data-key="${k}"] input[value="${value}"]`)!;
  r.click();
}
const foot = (f: NxForm) => f.querySelector(".nx-form__left")!.textContent;

describe("<nx-form>: el esquema", () => {
  it("pinta secciones, un nx-field por campo, el índice y el pie", async () => {
    const f = await mount();
    expect(f.querySelectorAll(".nx-form__sec")).toHaveLength(3);
    expect(f.querySelector(".nx-form__title")!.textContent).toBe("Nuevo ingreso");
    expect(field(f, "nombres").getAttribute("label")).toBe("Nombres");
    expect(field(f, "nombres").getAttribute("span")).toBe("3");
    expect(field(f, "nombres").hasAttribute("required")).toBe(true);
    expect(field(f, "rh").hasAttribute("optional")).toBe(true);
    expect(field(f, "arl").getAttribute("text")).toBe("Sura");
    expect(field(f, "arl").hasAttribute("locked")).toBe(true);
    // La casilla lleva su texto al lado, no arriba.
    expect(field(f, "acepta").hasAttribute("label")).toBe(false);
    expect(f.querySelector('nx-field[data-key="acepta"] .nx-check span')!.textContent).toBe("Acepta el tratamiento de datos");
    expect(field(f, "fin").hidden).toBe(true);
    expect(f.hasAttribute("data-index")).toBe(true);
    expect([...f.querySelectorAll(".nx-form__ix-t")].map((e) => e.textContent)).toEqual(["Identificación", "Contacto", "Contrato"]);
    expect(f.querySelector(".nx-form__ix-s")!.textContent).toBe("0 de 2");
    expect(foot(f)).toBe("Faltan 8 datos obligatorios");
    expect(f.querySelector(".nx-form__btn--primary")!.textContent).toBe("Guardar");
  });

  it("acepta el esquema como atributo JSON (y fields para una sola sección)", async () => {
    document.body.innerHTML = `<nx-form fields='[{"key":"a","label":"A","required":true}]' submit-label="Crear"></nx-form>`;
    const f = document.querySelector("nx-form")!;
    await tick();
    expect(f.querySelectorAll("nx-field")).toHaveLength(1);
    expect(f.hasAttribute("data-index")).toBe(false);
    expect(f.querySelector(".nx-form__btn--primary")!.textContent).toBe("Crear");
    expect(foot(f)).toBe("Falta 1 dato obligatorio");
  });
});

describe("<nx-form>: lo que hace la persona", () => {
  it("lee lo escrito, avisa nx-form-change y muestra el error al salir, no antes", async () => {
    const f = await mount();
    const changes: string[] = [];
    f.addEventListener("nx-form-change", (e) => changes.push(`${e.detail.key}=${e.detail.value}`));
    const correo = ctl(f, "correo");
    type(correo, "andres@", false);
    expect(field(f, "correo").hasAttribute("error")).toBe(false);
    correo.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    expect(field(f, "correo").getAttribute("error")).toBe("Escribe un correo como nombre@dominio.com");
    expect(changes).toEqual(["correo=andres@"]);
    expect(f.querySelector('[data-sec="1"] .nx-form__ix-s')!.textContent).toBe("1 por corregir");
    type(correo, "  Andres@Acme.co ");
    expect(f.values.correo).toBe("andres@acme.co");
    expect(correo.value).toBe("andres@acme.co");
    expect(field(f, "correo").hasAttribute("error")).toBe(false);
  });

  it("un correo con el dominio mal escrito avisa sin bloquear y se arregla con un clic", async () => {
    const f = await mount();
    type(ctl(f, "correo"), "andres.ortiz@gmial.com");
    const fl = field(f, "correo");
    expect(fl.getAttribute("warning")).toBe("¿Quisiste decir andres.ortiz@gmail.com?");
    expect(fl.getAttribute("action")).toBe("Usar gmail.com");
    expect(f.missing).not.toContain("correo");
    fl.querySelector<HTMLButtonElement>(".nx-field__act")!.click();
    expect(f.values.correo).toBe("andres.ortiz@gmail.com");
    expect(ctl(f, "correo").value).toBe("andres.ortiz@gmail.com");
    expect(fl.hasAttribute("warning")).toBe(false);
  });

  it("when muestra y oculta; lo oculto no se valida ni sale en values", async () => {
    const f = await mount();
    pick(f, "tipo", "Término fijo");
    expect(field(f, "fin").hidden).toBe(false);
    expect(f.missing).toContain("fin");
    type(ctl(f, "fin"), "2027-04-12");
    expect(f.values.fin).toBe("2027-04-12");
    pick(f, "tipo", "Indefinido");
    expect(field(f, "fin").hidden).toBe(true);
    expect("fin" in f.values).toBe(false);
    expect(f.missing).not.toContain("fin");
  });

  it("una opción con fills trae lo habitual, sin pisar lo que la persona escribió", async () => {
    const f = await mount();
    type(ctl<HTMLSelectElement>(f, "area"), "Logística");
    type(ctl<HTMLSelectElement>(f, "cargo"), "Soldador");
    expect(f.values.area).toBe("Logística");
    expect(f.values.riesgo).toBe("IV");
    expect(field(f, "riesgo").getAttribute("source")).toBe("Soldador");
    expect(field(f, "riesgo").getAttribute("source-detail")).toBe("Lo habitual para Soldador");
    expect(f.querySelector(".nx-form__status")!.textContent).toBe("1 dato de SoldadorDeshacer");
    // Otro cargo cambia lo que trajo el anterior (era del sistema).
    type(ctl<HTMLSelectElement>(f, "cargo"), "Auxiliar de bodega");
    expect(f.values.riesgo).toBe("II");
  });

  it("enviar con faltantes muestra todos los errores y enfoca el primero; con todo bien, nx-form-submit", async () => {
    const f = await mount();
    const sent: unknown[] = [];
    f.addEventListener("nx-form-submit", (e) => sent.push(e.detail));
    expect(f.submit()).toBe(false);
    expect(sent).toHaveLength(0);
    expect(field(f, "nombres").getAttribute("error")).toBe("Falta este dato");
    expect(field(f, "cargo").getAttribute("error")).toBe("Elige una opción");
    expect(field(f, "acepta").getAttribute("error")).toBe("Marca esta casilla para seguir");
    expect(document.activeElement).toBe(ctl(f, "nombres"));
    expect(f.querySelector('[data-sec="0"] .nx-form__ix-s')!.textContent).toBe("2 por llenar");

    type(ctl(f, "nombres"), "Andrés Felipe");
    type(ctl(f, "apellidos"), "Ortiz Medina");
    type(ctl(f, "correo"), "andres@acme.co");
    f.fill({ cargo: "Soldador", tipo: "Indefinido" }, "REQ-118");
    f.querySelector<HTMLInputElement>('nx-field[data-key="acepta"] input')!.click();
    expect(foot(f)).toBe("Todo listo");
    // Ctrl+S envía desde cualquier campo.
    ctl(f, "nombres").dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true }));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      values: { nombres: "Andrés Felipe", apellidos: "Ortiz Medina", rh: null, correo: "andres@acme.co", celular: null, cargo: "Soldador", area: "Producción", riesgo: "IV", tipo: "Indefinido", arl: "Sura", acepta: true },
      sources: { cargo: "REQ-118", tipo: "REQ-118", area: "Soldador", riesgo: "Soldador" },
    });
  });

  it("Enter pasa al campo siguiente que se ve", async () => {
    const f = await mount();
    const nombres = ctl(f, "nombres");
    nombres.focus();
    nombres.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(ctl(f, "apellidos"));
    // De «Tipo de contrato» salta la terminación oculta y llega a la casilla.
    const radio = f.querySelector<HTMLInputElement>('nx-field[data-key="tipo"] input')!;
    radio.focus();
    radio.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(f.querySelector('nx-field[data-key="acepta"] input'));
  });

  it("«Ir al siguiente» lleva al dato que falta después del último campo tocado", async () => {
    const f = await mount();
    ctl(f, "correo").dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    f.querySelector<HTMLButtonElement>(".nx-form__next")!.click();
    expect(document.activeElement).toBe(ctl(f, "cargo"));
  });
});

describe("<nx-form>: llenar desde afuera", () => {
  it("fill marca el origen, avisa cuántos, respeta lo escrito y se deshace entero", async () => {
    const f = await mount();
    type(ctl(f, "nombres"), "Andrés F.");
    const fills: unknown[] = [];
    f.addEventListener("nx-form-fill", (e) => fills.push(e.detail));
    const n = f.fill({ nombres: "Andrés Felipe", apellidos: "Ortiz Medina", rh: "O+", desconocida: "x" }, { label: "Cédula", detail: "Leído del código de barras de la cédula" });
    expect(n).toBe(2);
    expect(f.values.nombres).toBe("Andrés F.");
    expect(f.values.apellidos).toBe("Ortiz Medina");
    expect(ctl(f, "apellidos").value).toBe("Ortiz Medina");
    expect(ctl<HTMLSelectElement>(f, "rh").value).toBe("O+");
    expect(field(f, "apellidos").getAttribute("source")).toBe("Cédula");
    expect(field(f, "apellidos").getAttribute("source-detail")).toBe("Leído del código de barras de la cédula");
    expect(field(f, "apellidos").classList.contains("is-filled")).toBe(true);
    expect(f.querySelector(".nx-form__status")!.textContent).toBe("2 datos de Cédula · respeté 1 que ya escribistesDeshacer".replace("escribistes", "escribiste"));
    expect(fills).toEqual([{ keys: ["apellidos", "rh"], source: { label: "Cédula", detail: "Leído del código de barras de la cédula" } }]);
    // La persona cambia un dato: deja de ser de la cédula.
    type(ctl(f, "apellidos"), "Ortiz M.");
    expect(field(f, "apellidos").hasAttribute("source")).toBe(false);
    expect(f.querySelector(".nx-form__status button")).toBeNull();
  });

  it("deshacer con el botón o con Ctrl+Z fuera de un campo", async () => {
    const f = await mount();
    f.fill({ apellidos: "Ortiz Medina", cargo: "Soldador" }, "REQ-118");
    expect(f.values.area).toBe("Producción");
    f.querySelector<HTMLButtonElement>('.nx-form__status [data-act="undo"]')!.click();
    expect(f.values.apellidos).toBeNull();
    expect(f.values.area).toBeNull();
    expect(ctl(f, "apellidos").value).toBe("");
    expect(field(f, "apellidos").hasAttribute("source")).toBe(false);
    expect(f.querySelector(".nx-form__status")!.textContent).toBe("Se deshizo el llenado de REQ-118");
    f.fill({ apellidos: "Ortiz Medina" }, "Cédula");
    f.querySelector(".nx-form__sec")!.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true }));
    expect(f.values.apellidos).toBeNull();
  });

  it("un valor que ya estaba toma el origen; fill sin origen no deja chip ni deshacer", async () => {
    const f = await mount();
    f.fill({ arl: "Positiva" });
    expect(field(f, "arl").getAttribute("text")).toBe("Positiva");
    expect(f.querySelector<HTMLElement>(".nx-form__status")!.hidden).toBe(true);
    expect(f.undo()).toBe(false);
  });
});

describe("<nx-form>: lo que pone la app", () => {
  it("errors del servidor se ven hasta que la persona cambia el campo; warnings y hints también", async () => {
    const f = await mount();
    f.errors = { correo: "Ya existe un empleado con este correo" };
    expect(field(f, "correo").getAttribute("error")).toBe("Ya existe un empleado con este correo");
    expect(document.activeElement).toBe(ctl(f, "correo"));
    type(ctl(f, "correo"), "otro@acme.co");
    expect(field(f, "correo").hasAttribute("error")).toBe(false);
    f.warnings = { nombres: "Revisa la tilde" };
    f.hints = { celular: "Sin el +57" };
    expect(field(f, "nombres").getAttribute("warning")).toBe("Revisa la tilde");
    expect(field(f, "celular").getAttribute("hint")).toBe("Sin el +57");
  });

  it("values carga un registro; reset vuelve a él", async () => {
    const f = await mount();
    f.values = { nombres: "Laura", tipo: "Término fijo", fin: "2027-01-31", acepta: "true" };
    expect(ctl(f, "nombres").value).toBe("Laura");
    expect(field(f, "fin").hidden).toBe(false);
    expect(f.values.acepta).toBe(true);
    type(ctl(f, "nombres"), "Otra");
    f.reset();
    expect(f.values.nombres).toBe("Laura");
  });

  it("en lectura, la misma rejilla con los valores como texto", async () => {
    const f = await mount();
    f.values = { nombres: "Laura", cargo: "Soldador", tipo: "Término fijo", fin: "2027-01-31", acepta: true };
    f.mode = "read";
    expect(field(f, "nombres").getAttribute("text")).toBe("Laura");
    expect(field(f, "fin").getAttribute("text")).toMatch(/^31 ene\.? 2027$/);
    expect(field(f, "rh").getAttribute("text")).toBe("");
    expect(field(f, "acepta").getAttribute("text")).toBe("Sí");
    expect(field(f, "acepta").getAttribute("label")).toBe("Acepta el tratamiento de datos");
    expect(f.querySelector<HTMLElement>(".nx-form__foot")!.hidden).toBe(true);
    expect(f.submit()).toBe(false);
    f.mode = "edit";
    expect(field(f, "nombres").hasAttribute("text")).toBe(false);
  });

  it("montos con nx-number: llenar, leer y escribir", async () => {
    document.body.innerHTML = '<nx-form locale="es-CO" currency="COP"></nx-form>';
    const f = document.querySelector("nx-form")!;
    f.fields = [{ key: "salario", label: "Salario mensual", type: "money", required: true, min: 1000000 }];
    await vi.waitFor(() => expect(customElements.get("nx-number")).toBeTruthy());
    await tick();
    const num = f.querySelector<HTMLElement & { value: number | null }>("nx-number")!;
    expect(num.getAttribute("format")).toBe("money");
    expect(num.getAttribute("currency")).toBe("COP");
    f.fill({ salario: "2.100.000" }, "REQ-118");
    expect(num.value).toBe(2100000);
    expect(f.values.salario).toBe(2100000);
    num.value = 900000;
    num.dispatchEvent(new Event("input", { bubbles: true }));
    expect(f.values.salario).toBe(900000);
    expect(field(f as never, "salario").hasAttribute("source")).toBe(false);
    f.validate();
    expect(field(f as never, "salario").getAttribute("error")).toMatch(/^El mínimo es \$\s?1\.000\.000$/);
    f.mode = "read";
    expect(field(f as never, "salario").getAttribute("text")).toMatch(/^\$\s?900\.000$/);
  });
});

describe("<nx-form>: borrador", () => {
  it("guarda lo escrito y lo recupera al volver, con «Empezar de cero»", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let f = await mount('draft="ingreso"');
    type(ctl(f, "nombres"), "Andrés");
    f.fill({ apellidos: "Ortiz" }, "Cédula");
    expect(f.querySelector(".nx-form__draft")!.textContent).toBe("Guardando borrador…");
    vi.advanceTimersByTime(700);
    expect(f.querySelector(".nx-form__draft")!.textContent).toBe("Borrador guardado · hace un momento");
    const saved = JSON.parse(localStorage.getItem("nx-form:ingreso")!);
    expect(saved.v.nombres).toBe("Andrés");
    expect(saved.marks.apellidos.label).toBe("Cédula");

    document.body.innerHTML = "";
    f = await mount('draft="ingreso"');
    expect(f.values.nombres).toBe("Andrés");
    expect(field(f, "apellidos").getAttribute("source")).toBe("Cédula");
    expect(f.querySelector(".nx-form__status")!.textContent).toBe("Recuperamos tu borrador, guardado hace un momento.Empezar de cero");
    // El registro que la app carga después no tapa el borrador.
    f.values = { nombres: "Laura", rh: "A+" };
    expect(f.values.nombres).toBe("Andrés");
    expect(f.values.rh).toBe("A+");
    f.querySelector<HTMLButtonElement>('.nx-form__status [data-act="restart"]')!.click();
    expect(f.values.nombres).toBe("Laura");
    expect(localStorage.getItem("nx-form:ingreso")).toBeNull();
  });

  it("sin cambios frente al registro no deja borrador; clearDraft lo borra", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = await mount('draft="x"');
    type(ctl(f, "nombres"), "A");
    vi.advanceTimersByTime(700);
    expect(localStorage.getItem("nx-form:x")).not.toBeNull();
    type(ctl(f, "nombres"), "");
    vi.advanceTimersByTime(700);
    expect(localStorage.getItem("nx-form:x")).toBeNull();
    type(ctl(f, "nombres"), "B");
    vi.advanceTimersByTime(700);
    f.clearDraft();
    expect(localStorage.getItem("nx-form:x")).toBeNull();
    expect(f.querySelector<HTMLElement>(".nx-form__draft")!.hidden).toBe(true);
  });
});

describe("la demo de la galería", () => {
  it("llena desde las tres fuentes, calcula el periodo de prueba y crea el ingreso", async () => {
    const { readFileSync } = await import("node:fs");
    const html = /<template id="page-form">([\s\S]*?)<\/template>/.exec(readFileSync("gallery/index.html", "utf8"))![1];
    await import("../src/components/paste-fill/index");
    await import("../src/components/capture/index");
    await import("../src/components/scan/index");
    await import("../src/components/button/index");
    const { mountFormDemo, periodoDePrueba } = await import("../gallery/demo-form");
    document.body.innerHTML = `<main>${html}</main>`;
    await tick();
    mountFormDemo(document.querySelector("main")!);
    const f = document.querySelector<NxForm>("#frm-demo")!;
    const click = (sel: string) => document.querySelector<HTMLElement>(sel)!.click();
    click('[data-fill="cedula"]');
    click('[data-fill="req"]');
    click('[data-fill="texto"]');
    await vi.waitFor(() => expect(f.values.eps).toBe("Sura"));
    expect(f.values.ciudad).toBe("Malambo");
    expect(field(f, "eps").getAttribute("source")).toBe("Texto pegado");
    expect(f.querySelector('nx-field[data-key="ciudad"] nx-select')).not.toBeNull();
    expect(f.values.nombres).toBe("Andrés Felipe");
    expect(f.values.area).toBe("Producción");
    expect(field(f, "area").getAttribute("source")).toBe("Soldador");
    expect(field(f, "prueba").getAttribute("text")).toBe("Hasta el 17 nov 2026 · 36 días");
    expect(field(f, "prueba").getAttribute("hint")).toBe("La quinta parte de un contrato de 182 días (art. 78 del CST)");
    expect(field(f, "correo").getAttribute("warning")).toBe("¿Quisiste decir andres.ortiz@gmail.com?");
    // Con todo lo que llegó solo, faltan el número de cuenta y la autorización.
    expect(f.missing).toEqual(["cuenta", "autoriza"]);
    f.fill({ cuenta: "123-456789-01", autoriza: true }, null);
    // Una persona a cargo, en su fila.
    f.querySelector<HTMLButtonElement>(".nx-form__add")!.click();
    expect(f.missing).toEqual(["beneficiarios.0.nombre", "beneficiarios.0.parentesco", "beneficiarios.0.nace"]);
    f.fill({ beneficiarios: [{ nombre: "Sofía Ortiz Pérez", parentesco: "Hija", nace: "2019-05-03" }] }, "Registro civil");
    f.querySelector<HTMLButtonElement>(".nx-form__row-del")!.click();
    pick(f, "tipoContrato", "Indefinido");
    expect(field(f, "prueba").getAttribute("text")).toBe("Hasta el 12 dic 2026 · 2 meses");
    expect(f.submit()).toBe(true);
    expect(f.mode).toBe("read");
    expect(document.querySelector<HTMLInputElement>("#frm-read")!.checked).toBe(true);
    expect(document.querySelector("#frm-log li")!.textContent).toMatch(/^nx-form-submit · \d+ datos, \d+ llegaron solos$/);
    expect(periodoDePrueba({ tipoContrato: "Aprendizaje" }).text).toBeNull();
    // La recepción: el escáner agrega una fila por código.
    const rec = document.querySelector<NxForm>("#frm-recepcion")!;
    document.querySelector<HTMLElement>("#frm-scan-try")!.click();
    document.querySelector<HTMLElement>("#frm-scan-try")!.click();
    expect((rec.values.recibidos as { codigo: string }[]).map((r) => r.codigo)).toEqual(["7707123450011", "7707123450028"]);
    // El campo suelto, con su error y su origen.
    const plain = document.querySelectorAll<NxField>("#frm-plain nx-field");
    expect(plain[4].querySelector(".nx-field__err")!.textContent).toBe("En Bancolombia la cuenta tiene 11 dígitos");
    expect(plain[3].querySelector(".nx-field__src")!.textContent).toContain("REQ-118");
  });
});

describe("<nx-form>: filas (rows)", () => {
  const ROWS: FormSection[] = [
    {
      heading: "Beneficiarios",
      fields: [
        {
          key: "benef",
          label: "Beneficiarios",
          type: "rows",
          required: true,
          max: 3,
          addLabel: "Agregar beneficiario",
          fields: [
            { key: "nombre", label: "Nombre completo", required: true, span: 3 },
            { key: "parentesco", label: "Parentesco", type: "select", required: true, span: 2, options: [{ value: "Hija", fills: { cubre: "EPS y caja" } }, "Hijo", "Madre"] },
            { key: "nace", label: "Nacimiento", type: "date", span: 1 },
            { key: "cubre", label: "Cubre", span: 6 },
          ],
        },
      ],
    },
  ];
  async function mountRows(): Promise<NxForm> {
    document.body.innerHTML = '<nx-form locale="es-CO"></nx-form>';
    const f = document.querySelector("nx-form")!;
    f.sections = ROWS;
    await tick();
    return f;
  }
  const rowCtl = (f: NxForm, i: number, k: string) => f.querySelectorAll(".nx-form__row")[i].querySelector<HTMLInputElement>(`[name$=".${k}"]`)!;

  it("agrega y quita filas; cada fila lleva sus campos con el foco en el primero", async () => {
    const f = await mountRows();
    expect(f.querySelector(".nx-form__rows-msg")!.textContent).toBe("Ninguno todavía");
    expect(f.querySelector(".nx-form__rows-label")!.textContent).toBe("Beneficiarios");
    expect(foot(f)).toBe("Falta 1 dato obligatorio");
    const changes: unknown[] = [];
    f.addEventListener("nx-form-change", (e) => changes.push(e.detail));
    f.querySelector<HTMLButtonElement>(".nx-form__add")!.click();
    expect(f.querySelectorAll(".nx-form__row")).toHaveLength(1);
    expect(document.activeElement).toBe(rowCtl(f, 0, "nombre"));
    expect(f.querySelector(".nx-form__add")!.textContent).toBe("Agregar beneficiario");
    expect(f.values.benef).toEqual([{ nombre: null, parentesco: null, nace: null, cubre: null }]);
    // Las filas cuentan sus obligatorios.
    expect(foot(f)).toBe("Faltan 2 datos obligatorios");
    type(rowCtl(f, 0, "nombre"), "Sofía Ortiz Pérez");
    expect(f.values.benef).toEqual([{ nombre: "Sofía Ortiz Pérez", parentesco: null, nace: null, cubre: null }]);
    expect(changes.at(-1)).toMatchObject({ key: "benef", row: 0, field: "nombre" });
    f.querySelector<HTMLButtonElement>(".nx-form__add")!.click();
    f.querySelector<HTMLButtonElement>(".nx-form__add")!.click();
    expect(f.querySelector<HTMLElement>(".nx-form__add")!.hidden).toBe(true);
    const dels = f.querySelectorAll<HTMLButtonElement>(".nx-form__row-del");
    expect(dels[0].getAttribute("aria-label")).toBe("Quitar Beneficiarios, fila 1");
    dels[0].click();
    expect(f.querySelectorAll(".nx-form__row")).toHaveLength(2);
    expect((f.values.benef as unknown[]).every((r) => (r as { nombre: unknown }).nombre === null)).toBe(true);
    expect(document.activeElement).toBe(f.querySelectorAll(".nx-form__row-del")[0]);
  });

  it("una opción con fills llena los campos de su misma fila", async () => {
    const f = await mountRows();
    f.querySelector<HTMLButtonElement>(".nx-form__add")!.click();
    type(rowCtl(f, 0, "parentesco") as unknown as HTMLSelectElement, "Hija");
    expect((f.values.benef as { cubre: unknown }[])[0].cubre).toBe("EPS y caja");
    expect(f.querySelector('.nx-form__row nx-field[data-key$=".cubre"]')!.getAttribute("source")).toBe("Hija");
  });

  it("fill agrega las filas que no estaban, con su origen, y deshacer las quita", async () => {
    const f = await mountRows();
    const fila = { nombre: "Sofía Ortiz Pérez", parentesco: "Hija", nace: "03/05/2019" };
    expect(f.fill({ benef: [fila] }, "Texto pegado")).toBe(1);
    expect(f.fill({ benef: [fila] }, "Texto pegado")).toBe(0);
    expect(f.values.benef).toEqual([{ nombre: "Sofía Ortiz Pérez", parentesco: "Hija", nace: "2019-05-03", cubre: null }]);
    const row = f.querySelector(".nx-form__row")!;
    expect(row.querySelector('nx-field[data-key$=".nombre"]')!.getAttribute("source")).toBe("Texto pegado");
    expect(row.querySelector('nx-field[data-key$=".cubre"]')!.hasAttribute("source")).toBe(false);
    expect(f.sources).toEqual({ "benef.0.nombre": "Texto pegado", "benef.0.parentesco": "Texto pegado", "benef.0.nace": "Texto pegado" });
    f.undo();
    expect(f.values.benef).toEqual([]);
    expect(f.querySelectorAll(".nx-form__row")).toHaveLength(0);
  });

  it("valida al enviar: al menos una fila y los obligatorios de cada una; errores del servidor por ruta", async () => {
    const f = await mountRows();
    expect(f.submit()).toBe(false);
    expect(f.querySelector(".nx-form__rows-msg")!.textContent).toBe("Agrega al menos 1");
    expect(f.missing).toEqual(["benef"]);
    expect(document.activeElement).toBe(f.querySelector(".nx-form__add"));
    f.values = { benef: [{ nombre: "Ana", parentesco: "Hija" }, { nombre: "" }] };
    expect(f.missing).toEqual(["benef.1.nombre", "benef.1.parentesco"]);
    f.validate();
    expect(f.querySelectorAll(".nx-form__row")[1].querySelector('nx-field[data-key$=".nombre"]')!.getAttribute("error")).toBe("Falta este dato");
    f.errors = { "benef.0.nombre": "Ya está como beneficiaria de otro empleado" };
    expect(f.querySelectorAll(".nx-form__row")[0].querySelector('nx-field[data-key$=".nombre"]')!.getAttribute("error")).toBe("Ya está como beneficiaria de otro empleado");
    expect(f.errors).toEqual({ "benef.0.nombre": "Ya está como beneficiaria de otro empleado" });
    f.focusField("benef.1.parentesco");
    expect(document.activeElement).toBe(rowCtl(f, 1, "parentesco"));
    f.mode = "read";
    expect(f.querySelectorAll(".nx-form__row")[0].querySelector('nx-field[data-key$=".nombre"]')!.getAttribute("text")).toBe("Ana");
    expect(f.querySelector<HTMLElement>(".nx-form__add")!.hidden).toBe(true);
  });

  it("el borrador guarda las filas", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    document.body.innerHTML = '<nx-form locale="es-CO" draft="filas"></nx-form>';
    let f = document.querySelector("nx-form")!;
    f.sections = ROWS;
    await tick();
    f.fill({ benef: [{ nombre: "Sofía", parentesco: "Hija" }] }, "Texto pegado");
    vi.advanceTimersByTime(700);
    document.body.innerHTML = '<nx-form locale="es-CO" draft="filas"></nx-form>';
    f = document.querySelector("nx-form")!;
    f.sections = ROWS;
    await tick();
    expect((f.values.benef as { nombre: unknown }[])[0].nombre).toBe("Sofía");
    expect(f.querySelectorAll(".nx-form__row")).toHaveLength(1);
  });
});

describe("<nx-form>: listas largas con <nx-select>", () => {
  it("un select con muchas opciones, search o source usa nx-select, y se llena, se lee y se lee en lectura", async () => {
    document.body.innerHTML = '<nx-form locale="es-CO"></nx-form>';
    const f = document.querySelector("nx-form")!;
    const ciudades = Array.from({ length: 20 }, (_, i) => `Ciudad ${i + 1}`);
    f.fields = [
      { key: "ciudad", label: "Ciudad", type: "select", required: true, options: ciudades },
      { key: "jefe", label: "Jefe", type: "select", search: [{ key: "label", label: "Nombre" }, { key: "cedula", label: "Cédula", kind: "digits" }], options: [{ value: "17", label: "Carlos Pertuz", cedula: "72123456" }] },
      { key: "rh", label: "RH", type: "select", options: ["O+", "A+"] },
    ];
    await vi.waitFor(() => expect(customElements.get("nx-select")).toBeTruthy());
    await tick();
    const sel = f.querySelector<HTMLElement & { value: string; options: unknown[]; fields: unknown[]; selection: { label: string }[] }>('nx-field[data-key="ciudad"] nx-select')!;
    expect(sel).not.toBeNull();
    expect(sel.options).toHaveLength(20);
    expect(f.querySelector('nx-field[data-key="rh"] select')).not.toBeNull();
    const jefe = f.querySelector<HTMLElement & { fields: { key: string }[] }>('nx-field[data-key="jefe"] nx-select')!;
    expect(jefe.fields.map((x) => x.key)).toEqual(["label", "cedula"]);
    f.fill({ ciudad: "Ciudad 7" }, "REQ-118");
    expect(sel.value).toBe("Ciudad 7");
    sel.value = "Ciudad 9";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    expect(f.values.ciudad).toBe("Ciudad 9");
    expect(field(f, "ciudad").hasAttribute("source")).toBe(false);
    f.fill({ jefe: "17" });
    f.mode = "read";
    expect(field(f, "jefe").getAttribute("text")).toBe("Carlos Pertuz");
  });
});
