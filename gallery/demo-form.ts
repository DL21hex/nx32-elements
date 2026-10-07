/**
 * Demo de `<nx-form>` y `<nx-field>`: un ingreso de personal desde un esquema, con tres fuentes
 * para llenarlo (la cédula, una requisición y el mensaje del candidato, que lee `<nx-paste-fill>`),
 * lo habitual de cada cargo, una lista larga con buscador, beneficiarios en filas, una regla de la
 * app (el periodo de prueba, que la app calcula y explica) y la lectura después de crear. Después,
 * una recepción de mercancía que llenan `<nx-doc-capture>` (la factura) y `<nx-scan>` (lo recibido),
 * y el campo de la casa sin el formulario. No es parte de la librería.
 */
import "../src/components/form/index";
import "../src/components/paste-fill/index";
import "../src/components/capture/index";
import "../src/components/scan/index";
import { nxToast, type FormSection, type FormSource, type NxButton, type NxDocCapture, type NxForm, type NxPasteFill, type NxScan } from "../src/index";

/** Más de doce: la lista va con buscador (`<nx-select>`). */
const CIUDADES = ["Barranquilla", "Malambo", "Soledad", "Puerto Colombia", "Galapa", "Sabanalarga", "Baranoa", "Sabanagrande", "Santo Tomás", "Palmar de Varela", "Cartagena", "Santa Marta", "Valledupar", "Montería", "Sincelejo", "Bogotá", "Medellín", "Cali", "Bucaramanga"];

/** El mensaje que mandó el candidato por WhatsApp: lo lee `<nx-paste-fill>` (también con Ctrl+V). */
export const MENSAJE = "Buenas tardes, le envío mis datos para el ingreso:\nCorreo: andres.ortiz@gmial.com\nCelular 301 456 7890\nVivo en la Calle 12 # 9-45, barrio El Carmen, Malambo\nEPS: Sura\nPensión: Porvenir\nCesantías: Protección\nCuenta de ahorros Bancolombia\nGracias. Andrés Ortiz";

export const INGRESO: FormSection[] = [
  {
    id: "ident",
    heading: "Identificación",
    description: "Como aparece en el documento.",
    fields: [
      { key: "tipoDoc", label: "Tipo de documento", type: "select", required: true, span: 2, options: ["Cédula de ciudadanía", "Cédula de extranjería", "Pasaporte"], value: "Cédula de ciudadanía" },
      { key: "numDoc", label: "Número de documento", required: true, span: 2, pattern: "[0-9.]{6,13}", patternMessage: "Solo números: entre 6 y 10 dígitos" },
      { key: "rh", label: "Grupo sanguíneo", type: "select", span: 2, options: ["O+", "O−", "A+", "A−", "B+", "B−", "AB+", "AB−"] },
      { key: "nombres", label: "Nombres", required: true, span: 3 },
      { key: "apellidos", label: "Apellidos", required: true, span: 3 },
      { key: "fechaNac", label: "Fecha de nacimiento", type: "date", required: true, span: 3, max: "today" },
      { key: "sexo", label: "Sexo", type: "segmented", required: true, span: 3, options: ["Femenino", "Masculino"], hint: "Como figura en el documento" },
    ],
  },
  {
    id: "contacto",
    heading: "Contacto",
    fields: [
      { key: "correo", label: "Correo personal", type: "email", required: true, span: 3, hint: "Allí le llegan los desprendibles de pago" },
      { key: "celular", label: "Celular", type: "tel", required: true, span: 3 },
      { key: "direccion", label: "Dirección de residencia", required: true, span: 4 },
      { key: "ciudad", label: "Ciudad", type: "select", required: true, span: 2, options: CIUDADES },
    ],
  },
  {
    id: "contrato",
    heading: "Contrato",
    description: "El cargo trae lo habitual: área, centro de costo y clase de riesgo.",
    fields: [
      {
        key: "cargo",
        label: "Cargo",
        type: "select",
        required: true,
        span: 3,
        options: [
          { value: "Soldador", fills: { area: "Producción", centroCosto: "CC-3104 · Soldadura", riesgo: "IV" } },
          { value: "Auxiliar de bodega", fills: { area: "Logística", centroCosto: "CC-2201 · Bodega", riesgo: "II" } },
          { value: "Analista de nómina", fills: { area: "Talento humano", centroCosto: "CC-1102 · Nómina", riesgo: "I" } },
        ],
      },
      { key: "jefe", label: "Jefe inmediato", type: "select", required: true, span: 3, options: ["Carlos Pertuz", "Marta Insignares", "Laura Gómez"] },
      { key: "area", label: "Área", type: "select", required: true, span: 3, options: ["Producción", "Logística", "Talento humano"] },
      { key: "centroCosto", label: "Centro de costo", type: "select", required: true, span: 3, options: ["CC-1102 · Nómina", "CC-2201 · Bodega", "CC-3104 · Soldadura"] },
      { key: "tipoContrato", label: "Tipo de contrato", type: "segmented", required: true, options: ["Indefinido", "Término fijo", "Obra o labor", "Aprendizaje"] },
      { key: "ingreso", label: "Fecha de ingreso", type: "date", required: true, span: 2 },
      { key: "fin", label: "Fecha de terminación", type: "date", required: true, span: 2, when: { tipoContrato: "Término fijo" } },
      { key: "institucion", label: "Institución de formación", required: true, span: 2, hint: "SENA u otra", when: { tipoContrato: "Aprendizaje" } },
      { key: "prueba", label: "Periodo de prueba", type: "readonly", span: 2 },
      { key: "salario", label: "Salario mensual", type: "money", required: true, span: 3, min: 1 },
      { key: "jornada", label: "Jornada", type: "select", required: true, span: 3, options: ["Tiempo completo · 42 h semanales", "Medio tiempo · 21 h semanales"] },
    ],
  },
  {
    id: "ss",
    heading: "Seguridad social",
    fields: [
      { key: "eps", label: "EPS", type: "select", required: true, span: 2, options: ["Sura", "Sanitas", "Nueva EPS", "Salud Total", "Compensar", "Coosalud"] },
      { key: "afp", label: "Fondo de pensiones", type: "select", required: true, span: 2, options: ["Porvenir", "Protección", "Colfondos", "Skandia", "Colpensiones"] },
      { key: "cesantias", label: "Fondo de cesantías", type: "select", required: true, span: 2, options: ["Porvenir", "Protección", "Colfondos", "Skandia", "Fondo Nacional del Ahorro"] },
      { key: "arl", label: "ARL", type: "readonly", span: 3, value: "Sura · póliza de la empresa" },
      { key: "riesgo", label: "Clase de riesgo", type: "segmented", required: true, span: 3, options: ["I", "II", "III", "IV", "V"] },
    ],
  },
  {
    id: "pago",
    heading: "Pago de nómina",
    fields: [
      { key: "banco", label: "Banco", type: "select", required: true, span: 2, options: ["Bancolombia", "Davivienda", "Banco de Bogotá", "BBVA", "Nequi"] },
      { key: "tipoCuenta", label: "Tipo de cuenta", type: "segmented", required: true, span: 2, options: ["Ahorros", "Corriente"] },
      { key: "cuenta", label: "Número de cuenta", required: true, span: 2, mono: true, pattern: "[0-9 -]{6,20}", patternMessage: "Solo números y guiones" },
      { key: "autoriza", label: "Autoriza el tratamiento de sus datos personales", type: "checkbox", required: true },
    ],
  },
  {
    id: "benef",
    heading: "Beneficiarios",
    description: "Personas a cargo, para la EPS y la caja de compensación.",
    fields: [
      {
        key: "beneficiarios",
        label: "Personas a cargo",
        type: "rows",
        max: 6,
        addLabel: "Agregar persona a cargo",
        fields: [
          { key: "nombre", label: "Nombre completo", required: true, span: 3 },
          { key: "parentesco", label: "Parentesco", type: "select", required: true, span: 2, options: ["Hija", "Hijo", "Cónyuge o compañero(a)", "Madre", "Padre"] },
          { key: "nace", label: "Nacimiento", type: "date", required: true, span: 1, max: "today" },
        ],
      },
    ],
  },
];

/** Lo que trae cada fuente. En la app: `<nx-scan>` lee la cédula, la requisición viene del servidor
 *  y `<nx-paste-fill>` saca los datos del mensaje. */
const FUENTES: Record<string, { source: FormSource; values: Record<string, unknown> }> = {
  cedula: {
    source: { label: "Cédula", detail: "Leído del código de barras de la cédula" },
    values: { tipoDoc: "Cédula de ciudadanía", numDoc: "1.143.456.789", nombres: "Andrés Felipe", apellidos: "Ortiz Medina", fechaNac: "1992-06-18", sexo: "Masculino", rh: "O+" },
  },
  req: {
    source: { label: "REQ-118", detail: "De la requisición REQ-118, aprobada el 2 oct" },
    values: { cargo: "Soldador", jefe: "Carlos Pertuz", tipoContrato: "Término fijo", ingreso: "2026-10-13", fin: "2027-04-12", salario: 2100000, jornada: "Tiempo completo · 42 h semanales" },
  },
};

// ---------------------------------------------------------------- recepción de mercancía

/** Las claves son las del esquema de la factura que lee `<nx-doc-capture>` (ver la página Captura). */
export const RECEPCION: FormSection[] = [
  {
    heading: "Factura",
    fields: [
      { key: "prov", label: "Proveedor", required: true, span: 4 },
      { key: "nit", label: "NIT", required: true, span: 2, mono: true },
      { key: "num", label: "Nº factura", required: true, span: 2, mono: true },
      { key: "fecha", label: "Fecha", type: "date", required: true, span: 2 },
      { key: "vence", label: "Vence", type: "date", span: 2 },
      { key: "oc", label: "Orden de compra", span: 2, mono: true },
      {
        key: "items",
        label: "Ítems facturados",
        type: "rows",
        required: true,
        addLabel: "Agregar ítem",
        fields: [
          { key: "desc", label: "Descripción", required: true, span: 3 },
          { key: "cantidad", label: "Cantidad", type: "number", required: true, span: 1 },
          { key: "unitario", label: "V. unitario", type: "money", span: 1 },
          { key: "total", label: "Total", type: "money", span: 1 },
        ],
      },
      { key: "total", label: "Total de la factura", type: "money", required: true, span: 3 },
    ],
  },
  {
    heading: "Recepción",
    fields: [
      { key: "bodega", label: "Bodega", type: "segmented", required: true, span: 3, options: ["Malambo", "Soledad", "Itagüí"] },
      { key: "recibe", label: "Recibe", required: true, span: 3 },
      { key: "recibidos", label: "Códigos recibidos", type: "rows", hint: "Escanea cada producto con la cámara, la pistola o escribiendo el código.", fields: [{ key: "codigo", label: "Código", required: true, mono: true }] },
    ],
  },
];

function mountRecepcion(root: HTMLElement, add: (t: string) => void): void {
  const form = root.querySelector<NxForm>("#frm-recepcion")!;
  const cap = root.querySelector<NxDocCapture>("#frm-cap")!;
  const scan = root.querySelector<NxScan>("#frm-scan")!;
  const sample = root.querySelector<NxButton>("#frm-cap-sample")!;
  form.sections = RECEPCION;
  cap.schema = [
    { key: "prov", label: "Proveedor", section: "Encabezado" },
    { key: "nit", label: "NIT", section: "Encabezado" },
    { key: "num", label: "Nº factura", section: "Encabezado" },
    { key: "fecha", label: "Fecha", type: "date", section: "Encabezado" },
    { key: "vence", label: "Vence", type: "date", section: "Encabezado" },
    { key: "oc", label: "Orden de compra", section: "Encabezado" },
    { key: "items", label: "Ítems", type: "table", section: "Detalle", columns: [{ key: "desc", label: "Descripción" }, { key: "cantidad", label: "Cant.", type: "number" }, { key: "unitario", label: "V. unit.", type: "money" }, { key: "total", label: "Total", type: "money" }] },
    { key: "subtotal", label: "Subtotal", type: "money", section: "Totales" },
    { key: "iva", label: "IVA 19 %", type: "money", section: "Totales" },
    { key: "total", label: "Total", type: "money", section: "Totales" },
  ];
  sample.addEventListener("click", () =>
    void sample.run(async () => {
      const blob = await (await fetch("/demo/capture/factura.svg")).blob();
      void cap.extract(new File([blob], "FE-10482.pdf", { type: "application/pdf" }));
    }),
  );
  root.querySelector("#frm-scan-try")!.addEventListener("click", () => {
    const codes = ["7707123450011", "7707123450028", "7707123450035"];
    scan.add(codes[(form.values.recibidos as unknown[] | null)?.length ?? 0] ?? `77071234500${40 + Math.floor(Math.random() * 50)}`);
  });
  form.addEventListener("nx-form-fill", (e) => e.detail.source && add(`recepción · nx-form-fill · ${e.detail.keys.length} campos de ${e.detail.source.label}`));
  form.addEventListener("nx-form-submit", (e) => {
    add(`recepción · nx-form-submit · ${(e.detail.values.items as unknown[]).length} ítems, ${(e.detail.values.recibidos as unknown[] | null)?.length ?? 0} códigos`);
    void nxToast({ message: "Recepción registrada", tone: "success" });
    form.mode = "read";
  });
}

// ---------------------------------------------------------------- una regla de la app

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const utc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (s: string) => {
  const d = utc(s);
  return `${d.getUTCDate()} ${MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const addDays = (s: string, n: number) => {
  const d = utc(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const addMonths = (s: string, n: number) => {
  const d = utc(s);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  t.setUTCDate(Math.min(d.getUTCDate(), new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()));
  return iso(t);
};
const valid = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** El periodo de prueba (art. 78 del CST): dos meses como máximo; en un término fijo de menos de un
 *  año, la quinta parte. La calcula la app y el formulario la muestra con su porqué. */
export function periodoDePrueba(v: Record<string, unknown>): { text: string | null; why: string } {
  const a = v.ingreso;
  if (v.tipoContrato === "Aprendizaje") return { text: null, why: "Se define en el contrato de aprendizaje" };
  if (!v.tipoContrato || !valid(a)) return { text: null, why: "Sale del tipo de contrato y la fecha de ingreso" };
  const dos = addDays(addMonths(a, 2), -1);
  if (v.tipoContrato === "Término fijo") {
    const b = v.fin;
    if (!valid(b) || b <= a) return { text: null, why: "Sale de la fecha de terminación" };
    const dias = Math.round((utc(b).getTime() - utc(a).getTime()) / 864e5) + 1;
    if (dias < 365) {
      const n = Math.floor(dias / 5);
      const fin = addDays(a, n - 1);
      if (fin < dos) return { text: `Hasta el ${fmt(fin)} · ${n} días`, why: `La quinta parte de un contrato de ${dias} días (art. 78 del CST)` };
    }
  }
  return { text: `Hasta el ${fmt(dos)} · 2 meses`, why: "El máximo de la ley (art. 78 del CST)" };
}

// ---------------------------------------------------------------- montar

export function mountFormDemo(root: HTMLElement): void {
  const form = root.querySelector<NxForm>("#frm-demo")!;
  const paste = root.querySelector<NxPasteFill>("#frm-paste")!;
  const log = root.querySelector<HTMLOListElement>("#frm-log")!;
  const read = root.querySelector<HTMLInputElement>("#frm-read")!;
  const add = (text: string) => {
    const li = document.createElement("li");
    li.textContent = text;
    log.prepend(li);
    while (log.children.length > 6) log.lastElementChild!.remove();
  };

  form.sections = INGRESO;
  const rule = () => {
    const p = periodoDePrueba(form.values);
    form.fill({ prueba: p.text });
    form.hints = { prueba: p.why };
  };
  rule();

  root.querySelector(".frm-tools")!.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button[data-fill]");
    if (b?.dataset.fill === "texto") return void paste.fill(MENSAJE);
    const f = b && FUENTES[b.dataset.fill!];
    if (f) form.fill(f.values, f.source);
  });
  read.addEventListener("change", () => (form.mode = read.checked ? "read" : "edit"));

  form.addEventListener("nx-form-change", (e) => {
    add(`nx-form-change · ${e.detail.key} = ${JSON.stringify(e.detail.value)}`);
    if (["ingreso", "fin", "tipoContrato"].includes(e.detail.key)) rule();
  });
  form.addEventListener("nx-form-fill", (e) => {
    if (e.detail.source) add(`nx-form-fill · ${e.detail.keys.length} datos de ${e.detail.source.label}`);
    if (e.detail.keys.some((k) => ["ingreso", "fin", "tipoContrato"].includes(k))) rule();
  });
  form.addEventListener("nx-form-undo", (e) => {
    add(`nx-form-undo · ${e.detail.keys.length} datos`);
    rule();
  });
  form.addEventListener("nx-form-submit", (e) => {
    const { values, sources } = e.detail;
    const auto = Object.keys(sources).length;
    add(`nx-form-submit · ${Object.keys(values).length} datos, ${auto} llegaron solos`);
    void nxToast({ message: `Ingreso creado: ${values.nombres ?? ""} ${values.apellidos ?? ""}`.trim(), tone: "success" });
    form.clearDraft();
    form.mode = "read";
    read.checked = true;
  });

  mountRecepcion(root, add);
}
