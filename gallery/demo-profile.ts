/**
 * Demo de «Mi perfil»: la propuesta A de `maquetas/nx-perfil.html` armada con las piezas de la
 * librería. Un índice vertical (`<nx-tabs orientation="vertical">`) con el estado de cada sección;
 * los datos en `<nx-fields>` (nota, verificado, oculto, en revisión, «Falta»); la familia y la hoja
 * de vida en `<nx-entries>` con su panel; los documentos en `<nx-documents>`; la contraseña y la
 * verificación en dos pasos con `<nx-password>` y `<nx-otp>`. Datos inventados; «hoy» es el 14 de
 * octubre de 2026.
 */
import "../src/components/page-header/index";
import "../src/components/notice/index";
import "../src/components/tabs/index";
import "../src/components/fields/index";
import "../src/components/entries/index";
import "../src/components/documents/index";
import "../src/components/otp/index";
import "../src/components/password/index";
import "../src/components/dialog/index";
import "../src/components/actions/index";
import { qrMatrix, qrSvgPath } from "../src/components/handoff/index";
import { registerIcons, nxToast, type ActionItem, type DocumentItem, type EntriesSchema, type EntryItem, type FieldItem, type NxDialog, type NxDocuments, type NxEntries, type NxFields, type NxNotice, type NxOtp, type NxPageHeader, type NxPassword, type NxTabs } from "../src/index";

const TODAY = "2026-10-14";

registerIcons({
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  "graduation-cap": '<path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  award: '<path d="m15.48 12.89 1.52 8.55a.5.5 0 0 1-.81.46l-3.59-2.69a1 1 0 0 0-1.2 0l-3.6 2.69a.5.5 0 0 1-.8-.46l1.51-8.55"/><circle cx="12" cy="8" r="6"/>',
  languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
});

// ---------------------------------------------------------------- datos de ejemplo

const P = {
  name: "Laura Marcela Gómez Restrepo",
  role: "Analista de nómina sénior · Nómina · Sede Medellín",
  cell: "300 482 4417",
  email: "laura.gomez.r@gmail.com",
  shoes: "" as string,
  bankPending: true,
  mfa: false,
};

const FAMILY_SCHEMA: EntriesSchema = [
  { key: "parentesco", label: "Parentesco", type: "segmented", required: true, options: ["Cónyuge o compañero(a)", "Hijo(a)", "Padre o madre", "Hermano(a)"] },
  { key: "nombres", label: "Nombres", required: true, span: 3 },
  { key: "apellidos", label: "Apellidos", required: true, span: 3 },
  { key: "documento", label: "Documento", required: true, span: 3, mono: true },
  { key: "nacimiento", label: "Fecha de nacimiento", type: "date", required: true, span: 3, max: "today" },
  { key: "usos", label: "Para qué la registras", type: "checkboxes", options: [{ value: "eps", label: "Afiliarla a mi EPS como beneficiaria" }, { value: "ccf", label: "Inscribirla en la caja de compensación" }, { value: "emergencia", label: "Es mi contacto de emergencia" }] },
  { key: "celular", label: "Celular", type: "tel", required: true, span: 3, when: { usos: { filled: true } } },
  { key: "soporte", label: "Soporte del parentesco", type: "file", accept: ".pdf,image/*", hint: "Registro civil de nacimiento o de matrimonio. Hace falta para la EPS y la caja." },
];

let family: EntryItem[] = [
  { id: "andres", title: "Andrés Felipe Pérez Ríos", meta: "Esposo · 36 años · CC 71.845.220", avatar: "Andrés Pérez", tags: [{ label: "Beneficiario de la EPS", icon: "heart" }, { label: "Contacto de emergencia", icon: "phone" }], proof: "Registro civil de matrimonio", values: { parentesco: "Cónyuge o compañero(a)", nombres: "Andrés Felipe", apellidos: "Pérez Ríos", documento: "71845220", nacimiento: "1990-03-22", usos: ["eps", "emergencia"], celular: "310 555 0182" }, removeText: "Talento Humano tramitará su retiro de la EPS." },
  { id: "sofia", title: "Sofía Pérez Gómez", meta: "Hija · 13 años · TI 1.036.950.331", avatar: "Sofía Pérez", tags: [{ label: "Beneficiaria de la EPS", icon: "heart" }, "Cuota monetaria"], proof: "Registro civil de nacimiento", note: { text: "La caja pide el certificado escolar de 2026 para seguir pagando la cuota monetaria (hijos de 12 a 18 años).", action: "Subir certificado" }, values: { parentesco: "Hijo(a)", nombres: "Sofía", apellidos: "Pérez Gómez", documento: "1036950331", nacimiento: "2013-01-20", usos: ["eps", "ccf"] }, removeText: "Talento Humano tramitará su retiro de la EPS y de la caja." },
  { id: "tomas", title: "Tomás Pérez Gómez", meta: "Hijo · 7 años · TI 1.036.981.204", avatar: "Tomás Pérez", tags: [{ label: "Beneficiario de la EPS", icon: "heart" }, "Cuota monetaria"], proof: "Registro civil de nacimiento", values: { parentesco: "Hijo(a)", nombres: "Tomás", apellidos: "Pérez Gómez", documento: "1036981204", nacimiento: "2019-06-08", usos: ["eps", "ccf"] } },
];

const CAREER: EntryItem[] = [
  { id: "c3", title: "Analista de nómina sénior", meta: "Nómina · desde sept 2025", detail: "1 año y 1 mes" },
  { id: "c2", title: "Analista de nómina", meta: "Nómina · mar 2023 – sept 2025", detail: "2 años y 6 meses" },
  { id: "c1", title: "Auxiliar de nómina", meta: "Nómina · feb 2021 – mar 2023", detail: "2 años y 1 mes" },
];
const EXP_SCHEMA: EntriesSchema = [
  { key: "cargo", label: "Cargo", required: true, span: 3 },
  { key: "empresa", label: "Empresa", required: true, span: 3 },
  { key: "desde", label: "Desde", type: "date", required: true, span: 3 },
  { key: "hasta", label: "Hasta", type: "date", required: true, span: 3, max: "today" },
  { key: "certificado", label: "Certificado laboral", type: "file", accept: ".pdf,image/*" },
];
let experience: EntryItem[] = [
  { id: "exito", title: "Analista de compensación", meta: "Grupo Éxito · Envigado", detail: "mar 2017 – ene 2021 · 3 años y 10 meses", icon: "briefcase", proof: "Certificado laboral", values: { cargo: "Analista de compensación", empresa: "Grupo Éxito", desde: "2017-03-01", hasta: "2021-01-31" } },
  { id: "conta", title: "Auxiliar contable", meta: "Contadores Asociados del Sur · Itagüí", detail: "ene 2014 – feb 2017 · 3 años y 1 mes", icon: "briefcase", values: { cargo: "Auxiliar contable", empresa: "Contadores Asociados del Sur", desde: "2014-01-01", hasta: "2017-02-28" } },
];
const COURSES: EntryItem[] = [
  { id: "brig", title: "Brigadista de emergencias, nivel básico", meta: "ARL Sura · 20 horas · nov 2025", icon: "award", proof: "Certificado", note: { text: "Vence el 15 nov 2026, en 32 días. La brigada necesita el certificado vigente.", action: "Subir el nuevo" } },
  { id: "sgsst", title: "Curso virtual de 50 horas del SG-SST", meta: "SENA · 50 horas · abr 2024", icon: "award", proof: "Certificado" },
  { id: "esp", title: "Especialización en Gerencia del Talento Humano", meta: "Universidad EAFIT · nov 2019", icon: "graduation-cap", proof: "Diploma y acta de grado" },
];

let docs: DocumentItem[] = [
  { id: "cedula", name: "Cédula de ciudadanía", kind: "id", fields: [{ label: "Número", value: "1.036.482.117" }, { label: "Nombre", value: "LAURA MARCELA GÓMEZ RESTREPO" }, { label: "Nacimiento", value: "14 may 1992" }, { label: "Expedición", value: "12 jun 2010 · Medellín" }], checks: ["El número y el nombre coinciden con tu perfil."], askedBy: ["Contratación", "Afiliaciones", "Viáticos"], uses: [{ at: "2026-09-02", by: "Compras", purpose: "Póliza de la tarjeta corporativa" }, { at: "2026-08-12", by: "Viáticos", purpose: "VIA-0331 · tiquete Medellín–Bogotá" }, { at: "2021-02-03", by: "Contratación", purpose: "Tu contrato de ingreso" }], addedAt: "2021-02-03", addedBy: "Talento Humano" },
  { id: "rut", name: "RUT", kind: "page", status: "missing", reason: "Lo pide Nómina para la retención en la fuente", askedBy: ["Nómina"] },
  { id: "banco", name: "Certificado bancario", kind: "page", status: "review", detail: "Davivienda · Ahorros", reason: "Va con el cambio de cuenta: lo revisa Nómina.", addedAt: "2026-10-10", addedBy: "ti" },
  { id: "pasaporte", name: "Pasaporte", kind: "passport", issued: "2016-12-02", expires: "2026-12-02", askedBy: ["Viáticos"], uses: [{ at: "2024-03-11", by: "Viáticos", purpose: "VIA-0188 · congreso en Lima" }], addedAt: "2023-05-20", addedBy: "ti" },
  { id: "tarjeta", name: "Tarjeta profesional", kind: "card", detail: "Contador público · 184562-T", uses: [{ at: "2021-02-03", by: "Contratación", purpose: "Requisito del cargo" }] },
  { id: "examen", name: "Examen médico ocupacional", kind: "medical", issued: "2026-03-12", expires: "2027-03-12", detail: "Apto sin restricciones · periódico", note: "Dato sensible: el resultado completo lo guarda la IPS; aquí solo queda el concepto de aptitud.", replaceable: false },
  { id: "firma", name: "Firma", kind: "signature", detail: "Actas de entrega y recibidos de dotación", uses: [{ at: "2026-08-31", by: "Dotación", purpose: "Recibido de la dotación de agosto" }] },
  { id: "escolar", name: "Certificado escolar de Sofía", kind: "page", status: "missing", reason: "Lo pide la caja de compensación para la cuota monetaria", askedBy: ["Caja de compensación"] },
];

let sessions: EntryItem[] = [
  { id: "s1", title: "Chrome en Linux · Medellín", meta: "Activa ahora", icon: "monitor", badge: "Este equipo", badgeTone: "info", removable: false, locked: "La sesión de este equipo" },
  { id: "s2", title: "App nx32 en iPhone · Medellín", meta: "Hace 2 horas", icon: "smartphone" },
  { id: "s3", title: "Edge en Windows · Bogotá", meta: "Entró el 11 oct a las 11:52 p. m.", icon: "monitor", note: { text: "No es tu ciudad de siempre, y al día siguiente hubo 3 intentos con contraseña equivocada.", tone: "danger" }, removeText: "Quien esté ahí tendrá que volver a entrar." },
];

const CONSENTS: EntryItem[] = [
  { id: "datos", title: "Tratamiento de datos personales", meta: "Aceptada el 3 feb 2021 · política de 2020", badge: "Aceptada", badgeTone: "success", locked: "Es necesaria para tu contrato" },
  { id: "sens", title: "Datos sensibles: salud y huella del reloj de asistencia", meta: "Aceptada el 3 feb 2021", badge: "Aceptada", badgeTone: "success", removeText: "Si la retiras, marcarás la asistencia con tu carné en vez de la huella." },
  { id: "wa", title: "Mensajes por WhatsApp", meta: "Aceptada el 2 sept 2026", badge: "Aceptada", badgeTone: "success", removeText: "Dejarás de recibir por WhatsApp el desprendible y los avisos." },
];

// ---------------------------------------------------------------- la página

function personalItems(): FieldItem[] {
  return [
    { key: "nombre", label: "Nombre", value: P.name, readonly: true, wide: true },
    { key: "documento", label: "Documento", value: "CC 1.036.482.117", readonly: true, mono: true, copy: true },
    { key: "nacimiento", label: "Nacimiento", value: "14 may 1992 · 34 años", readonly: true },
    { key: "civil", label: "Estado civil", value: "Casada", input: { type: "select", options: ["Soltera", "Casada", "Unión libre", "Separada", "Divorciada", "Viuda"], required: true } },
    { key: "lugar", label: "Lugar de nacimiento", value: "Envigado, Antioquia", input: { required: true } },
  ];
}
function contactItems(): FieldItem[] {
  return [
    { key: "correo", label: "Correo personal", value: P.email, verified: true, input: { type: "email", required: true, hint: "Allí llegan tus desprendibles." } },
    { key: "celular", label: "Celular", value: P.cell, verified: true, input: { type: "tel", required: true } },
    { key: "direccion", label: "Dirección", value: "Cra. 43A # 18 Sur-135, apto. 1204", wide: true, input: { required: true } },
  ];
}
function contractItems(): FieldItem[] {
  return [
    { label: "Cargo", value: "Analista de nómina sénior", readonly: true },
    { label: "Jefe inmediato", value: "Carlos Mejía Ortiz", readonly: true },
    { label: "Fecha de ingreso", value: "2021-02-03", format: "date", readonly: true },
    { label: "Salario básico", value: 5240000, format: "money", masked: true, readonly: true },
  ];
}
function bankItems(): FieldItem[] {
  return [
    { key: "cuenta", label: "Cuenta", value: "Bancolombia · Ahorros · •••• 4821", readonly: true, wide: true, pending: P.bankPending ? { value: "Davivienda · Ahorros · •••• 0937", text: "Si Nómina lo aprueba antes del 25 oct, el pago del 30 oct llega a la cuenta nueva.", action: "Cancelar solicitud" } : undefined },
  ];
}
function sizeItems(): FieldItem[] {
  return [
    { key: "camisa", label: "Camisa o blusa", value: "M", input: { type: "select", options: ["XS", "S", "M", "L", "XL"], required: true } },
    { key: "calzado", label: "Calzado", value: P.shoes || null, input: { type: "select", options: ["35", "36", "37", "38", "39"], required: true } },
  ];
}

export function mountProfileDemo(root: HTMLElement): void {
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const log = $("#pf-log");
  const add = (t: string) => {
    const li = document.createElement("li");
    li.textContent = t;
    log.prepend(li);
  };
  const head = $<NxPageHeader>("#pf-head");
  const tabs = $<NxTabs>("#pf-tabs");
  const notice = $<NxNotice>("#pf-notice");
  const personal = $<NxFields>("#pf-personal");
  const contact = $<NxFields>("#pf-contact");
  const contract = $<NxFields>("#pf-contract");
  const bank = $<NxFields>("#pf-bank");
  const sizes = $<NxFields>("#pf-sizes");
  const fam = $<NxEntries>("#pf-family");
  const career = $<NxEntries>("#pf-career");
  const exp = $<NxEntries>("#pf-exp");
  const courses = $<NxEntries>("#pf-courses");
  const documents = $<NxDocuments>("#pf-docs");
  const sess = $<NxEntries>("#pf-sessions");
  const consents = $<NxEntries>("#pf-consents");
  const rights = root.querySelector<HTMLElement & { items: ActionItem[] }>("#pf-rights")!;

  /** El estado de cada sección en el índice. */
  const status = () => {
    const panel = (v: string) => tabs.querySelector<HTMLElement>(`[data-tab="${v}"]`)!;
    const set = (v: string, text: string, tone = "") => {
      panel(v).dataset.status = text;
      if (tone) panel(v).dataset.tone = tone;
      else delete panel(v).dataset.tone;
    };
    set("Empleado", !P.shoes ? "Falta la talla de calzado" : P.bankPending ? "Cambio de cuenta en revisión" : "Al día", !P.shoes ? "warning" : P.bankPending ? "info" : "");
    const school = docs.find((d) => d.id === "escolar")!.status === "missing";
    set("Núcleo familiar", school ? "Falta el certificado escolar de Sofía" : `${family.length} personas`, school ? "warning" : "");
    set("Hoja de vida", "Brigadista vence en 32 días", "warning");
    set("Documentos", documents.summaryText, documents.summary.missing || documents.summary.expiring ? "warning" : "success");
    set("Seguridad", P.mfa ? "Verificación en dos pasos activa" : "Sin verificación en dos pasos", P.mfa ? "success" : "warning");
  };

  head.addEventListener("nx-page-header-avatar", () => add("nx-page-header-avatar · la app abre el selector de la foto"));
  notice.addEventListener("nx-notice-action", () => {
    add("nx-notice-action · empezar la actualización de datos");
    tabs.value = "Empleado";
  });

  personal.items = personalItems();
  contact.items = contactItems();
  contract.items = contractItems();
  bank.items = bankItems();
  sizes.items = sizeItems();
  for (const f of [personal, contact, sizes]) {
    f.addEventListener("nx-fields-action", (e) => {
      f.editing = true;
      if (e.detail.key) f.focusField(e.detail.key);
      add(`nx-fields-action · ${e.detail.action}${e.detail.key ? ` · ${e.detail.key}` : ""}`);
    });
  }
  sizes.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !sizes.editing) return;
    e.preventDefault();
    if (!sizes.validate()) return;
    P.shoes = String(sizes.values.calzado ?? "");
    sizes.editing = false;
    sizes.items = sizeItems();
    status();
    add("Tallas guardadas");
  });
  bank.addEventListener("nx-fields-pending", (e) => {
    P.bankPending = false;
    bank.items = bankItems();
    status();
    add(`nx-fields-pending · ${e.detail.action}`);
    void nxToast({ message: "Cancelaste el cambio de cuenta. El pago sigue llegando a Bancolombia.", undo: true }).then((r) => {
      if (r !== "undo") return;
      P.bankPending = true;
      bank.items = bankItems();
      status();
    });
  });

  // Núcleo familiar
  fam.schema = FAMILY_SCHEMA;
  fam.items = family;
  fam.addEventListener("nx-entries-open", (e) => {
    if (e.detail.id !== null) return;
    // «Llenar con el registro civil»: lo que leería <nx-doc-capture>, con su origen.
    const form = e.detail.form as HTMLElement & { fill(values: Record<string, unknown>, source: string): void };
    const tools = document.createElement("div");
    tools.slot = "tools";
    const b = document.createElement("nx-button");
    b.setAttribute("label", "Llenar con el registro civil");
    b.setAttribute("variant", "secondary");
    b.addEventListener("click", () => form.fill({ parentesco: "Hijo(a)", nombres: "Emilia", apellidos: "Pérez Gómez", documento: "1036998812", nacimiento: "2026-09-18" }, "Registro civil"));
    tools.append(b);
    form.querySelector('[slot="tools"]')?.remove();
    form.append(tools);
  });
  fam.addEventListener("nx-entries-save", (e) => {
    const v = e.detail.values as Record<string, string | string[]>;
    const title = `${v.nombres} ${v.apellidos}`;
    const uses = Array.isArray(v.usos) ? v.usos : [];
    const item: EntryItem = { id: e.detail.id ?? `p${Date.now()}`, title, meta: `${v.parentesco} · ${String(v.documento)}`, avatar: title, badge: uses.length && !e.detail.id ? "Afiliación en trámite" : undefined, badgeTone: "info", values: v };
    family = e.detail.id ? family.map((x) => (x.id === e.detail.id ? { ...x, ...item, tags: x.tags, proof: x.proof, note: x.note } : x)) : [...family, item];
    fam.items = family;
    status();
    add(`nx-entries-save · ${e.detail.id ?? "nueva"} · ${title}`);
  });
  fam.addEventListener("nx-entries-remove", (e) => {
    family = family.filter((x) => x.id !== e.detail.id);
    status();
    add(`nx-entries-remove · ${e.detail.id}`);
  });
  fam.addEventListener("nx-entries-action", (e) => {
    add(`nx-entries-action · ${e.detail.action}`);
    tabs.value = "Documentos";
    documents.upload("escolar");
  });

  // Hoja de vida
  career.items = CAREER;
  exp.schema = EXP_SCHEMA;
  exp.items = experience;
  exp.addEventListener("nx-entries-save", (e) => {
    const v = e.detail.values as Record<string, string>;
    const item: EntryItem = { id: e.detail.id ?? `e${Date.now()}`, title: v.cargo, meta: v.empresa, detail: `${v.desde} – ${v.hasta}`, icon: "briefcase", values: v };
    experience = e.detail.id ? experience.map((x) => (x.id === e.detail.id ? { ...x, ...item } : x)) : [item, ...experience];
    exp.items = experience;
    add(`nx-entries-save · experiencia · ${v.cargo}`);
  });
  courses.items = COURSES;
  courses.addEventListener("nx-entries-action", (e) => add(`nx-entries-action · ${e.detail.id} · ${e.detail.action}`));

  // Documentos
  documents.items = docs;
  documents.addEventListener("nx-documents-file", (e) => {
    const { id, file } = e.detail;
    documents.busy = id;
    add(`nx-documents-file · ${id} · ${file.name}`);
    // La app sube y lee el archivo; aquí, un momento y lo que habría leído.
    setTimeout(() => {
      const read: Record<string, DocumentItem["fields"]> = {
        rut: [{ label: "NIT", value: "1.036.482.117-2" }, { label: "Actividad principal", value: "0010 · Asalariados" }],
        escolar: [{ label: "Estudiante", value: "Sofía Pérez Gómez" }, { label: "Grado", value: "Octavo" }, { label: "Año lectivo", value: "2026" }],
      };
      docs = docs.map((d) => (d.id === id ? { ...d, status: "ok", fields: read[id] ?? d.fields, checks: ["El nombre coincide con tu perfil."], addedAt: TODAY, addedBy: "ti", reason: undefined, ...(id === "pasaporte" ? { issued: TODAY, expires: "2036-10-14" } : {}), ...(id === "escolar" ? { issued: "2026-02-01", expires: "2026-12-31" } : {}) } : d));
      documents.items = docs;
      documents.busy = null;
      if (id === "escolar") {
        family = family.map((x) => (x.id === "sofia" ? { ...x, note: undefined } : x));
        fam.items = family;
      }
      status();
    }, 1200);
  });

  // Seguridad
  sess.items = sessions;
  sess.addEventListener("nx-entries-remove", (e) => {
    sessions = sessions.filter((x) => x.id !== e.detail.id);
    add(`Cerraste la sesión: ${e.detail.item.title}`);
  });
  const pwDlg = $<NxDialog>("#pf-pw-dialog");
  $("#pf-pw-open").addEventListener("click", () => void pwDlg.show());
  $("#pf-pw-save").addEventListener("click", () => {
    const fields = [...pwDlg.querySelectorAll<NxPassword>("nx-password")];
    const bad = fields.find((f) => !f.value || (f.validity && !f.validity.valid));
    if (bad) {
      bad.focus();
      void nxToast({ message: bad.validationMessage || "Revisa la contraseña", tone: "danger", duration: 3000 });
      return;
    }
    pwDlg.close(undefined, "form");
    add("Contraseña cambiada");
    void nxToast({ message: "Cambiaste la contraseña.", tone: "success" });
  });
  const mfaDlg = $<NxDialog>("#pf-mfa-dialog");
  const otp = $<NxOtp>("#pf-otp");
  const qr = $("#pf-qr");
  const m = qrMatrix("otpauth://totp/nx32:laura.gomez?secret=JBSWY3DPEHPK3PXP&issuer=nx32");
  qr.innerHTML = `<svg viewBox="0 0 ${m.length + 8} ${m.length + 8}" width="168" height="168" role="img" aria-label="Código QR para la app autenticadora"><rect width="100%" height="100%" fill="#fff"/><path d="${qrSvgPath(m)}" fill="#14161c"/></svg>`;
  $("#pf-mfa-open").addEventListener("click", () => {
    otp.clear(false);
    void mfaDlg.show();
  });
  otp.addEventListener("nx-otp-complete", (e) => {
    const field = otp.closest("nx-field")!;
    if (e.detail.value === "000000") {
      field.setAttribute("error", "Ese código no coincide. Revisa que la hora del celular esté al día.");
      otp.clear();
      return;
    }
    field.removeAttribute("error");
    mfaDlg.close(undefined, "form");
    P.mfa = true;
    $("#pf-mfa-state").textContent = "Activa · app autenticadora desde hoy";
    status();
    add(`nx-otp-complete · ${e.detail.value}`);
    void nxToast({ message: "Activaste la verificación en dos pasos.", tone: "success" });
  });

  // Privacidad
  consents.items = CONSENTS;
  consents.addEventListener("nx-entries-remove", (e) => add(`Retiraste la autorización: ${e.detail.item.title}`));
  rights.items = [
    { id: "dl", label: "Descargar todos mis datos", icon: "upload", description: "Un archivo con tu perfil, tu familia, tus documentos y quién los ha usado." },
    { id: "fix", label: "Pedir que corrijan un dato", description: "Para lo que tiene candado. Talento Humano responde en máximo 15 días hábiles." },
    { id: "del", label: "Pedir que borren un dato", description: "Solo lo que la ley no obliga a conservar." },
  ];

  void Promise.resolve().then(status);
}
