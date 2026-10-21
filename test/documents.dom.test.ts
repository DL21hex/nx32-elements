// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/documents/index";
import "../src/components/dialog/index";
import { cleanDocuments, daysBetween, documentState, documentsSummary, elapsed, sortDocuments, stateKey, summaryText } from "../src/components/documents/logic";
import { DOCUMENTS_LABELS } from "../src/components/documents/documents";
import type { DocumentItem, DocumentsFileDetail, DocumentsOpenDetail, DocumentsUploadDetail, NxDocuments } from "../src/components/documents/index";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const TODAY = "2026-10-14";
const tick = () => new Promise((r) => setTimeout(r, 0));
const until = async (fn: () => unknown, ms = 3000) => {
  const end = Date.now() + ms;
  while (!fn() && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
};

const DOCS: DocumentItem[] = [
  {
    id: "cedula",
    name: "Cédula de ciudadanía",
    kind: "id",
    fields: [{ label: "Número", value: "1.036.482.117" }],
    checks: ["El número y el nombre coinciden con tu perfil."],
    askedBy: ["Contratación", "Viáticos"],
    uses: [
      { at: "2021-02-03", by: "Contratación", purpose: "Tu contrato de ingreso" },
      { at: "2026-08-12", by: "Viáticos", purpose: "VIA-0331 · tiquete Medellín–Bogotá" },
    ],
    addedAt: "2021-02-03",
    addedBy: "Talento Humano",
    href: "/docs/cedula.pdf",
  },
  { id: "rut", name: "RUT", kind: "page", status: "missing", reason: "Lo pide Nómina para la retención en la fuente" },
  { id: "pasaporte", name: "Pasaporte", kind: "passport", issued: "2016-12-02", expires: "2026-12-02" },
  { id: "banco", name: "Certificado bancario", status: "review", detail: "Davivienda · Ahorros" },
  { id: "examen", name: "Examen médico ocupacional", kind: "medical", note: "Dato sensible: aquí solo queda el concepto de aptitud.", replaceable: false },
];

async function mount(attrs = ""): Promise<NxDocuments> {
  document.body.innerHTML = `<nx-documents today="${TODAY}" locale="es-CO" ${attrs}></nx-documents>`;
  const el = document.querySelector("nx-documents")!;
  el.items = DOCS;
  await tick();
  return el;
}
const cards = (el: NxDocuments) => [...el.querySelectorAll<HTMLButtonElement>(".nx-documents__card")];
const card = (el: NxDocuments, id: string) => el.querySelector<HTMLButtonElement>(`.nx-documents__card[data-id="${id}"]`)!;
const panel = (el: NxDocuments) => el.querySelector<HTMLElement>("nx-dialog");
const id = (s: string) => s;

describe("documents: lógica", () => {
  it("limpia: sin id o nombre no sirve; fechas ISO; usos del más nuevo al más viejo", () => {
    const out = cleanDocuments([{ id: "a", name: "A", status: "raro", kind: "x", expires: "2026-13", uses: [{ at: "2020-01-01", by: "X" }, { at: "2026-01-01", by: "Y" }, { by: "Z" }] }, { name: "Sin id" }, { id: "a", name: "Repetido" }]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("ok");
    expect(out[0].kind).toBeUndefined();
    // «2026-13» no es una fecha ISO: no se toma.
    expect(out[0].expires).toBeUndefined();
    expect(out[0].uses!.map((u) => u.by)).toEqual(["Y", "X"]);
  });
  it("el estado con la fecha de hoy", () => {
    const L = DOCUMENTS_LABELS;
    expect(daysBetween("2026-10-14", "2026-12-02")).toBe(49);
    expect(documentState({ id: "p", name: "P", expires: "2026-12-02" }, TODAY, L, id)).toMatchObject({ key: "expiring", tone: "warning", label: "Vence en 49 días", days: 49 });
    expect(documentState({ id: "p", name: "P", expires: "2026-10-15" }, TODAY, L, id).label).toBe("Vence mañana");
    expect(documentState({ id: "p", name: "P", expires: "2026-10-14" }, TODAY, L, id).label).toBe("Vence hoy");
    expect(documentState({ id: "p", name: "P", expires: "2026-10-01" }, TODAY, L, id)).toMatchObject({ key: "expired", tone: "danger", label: "Vencido" });
    expect(documentState({ id: "p", name: "P", expires: "2036-10-14" }, TODAY, L, id).label).toBe("Vigente hasta 2036-10-14");
    expect(documentState({ id: "p", name: "P" }, TODAY, L, id).label).toBe("Vigente");
    expect(documentState({ id: "p", name: "P", status: "review", expires: "2026-01-01" }, TODAY, L, id).key).toBe("expired");
    expect(stateKey({ id: "p", name: "P", expires: "2026-12-02" }, TODAY, 30).key).toBe("ok");
  });
  it("lo que pide atención primero; el resumen en palabras", () => {
    const docs = cleanDocuments(DOCS);
    expect(sortDocuments(docs, TODAY).map((d) => d.id)).toEqual(["rut", "pasaporte", "banco", "cedula", "examen"]);
    const s = documentsSummary(docs, TODAY);
    expect(s).toEqual({ total: 5, missing: 1, rejected: 0, expired: 0, expiring: 1, review: 1 });
    expect(summaryText(s, DOCUMENTS_LABELS)).toBe("Falta 1 · 1 por vencer · 1 en revisión");
    expect(summaryText({ total: 1, missing: 0, rejected: 0, expired: 0, expiring: 0, review: 0 }, DOCUMENTS_LABELS)).toBe("Todos al día");
    expect(elapsed({ id: "p", name: "P", issued: "2016-12-02", expires: "2026-12-02" }, TODAY)).toBeCloseTo(0.9866, 3);
    expect(elapsed({ id: "p", name: "P" }, TODAY)).toBeNull();
  });
});

describe("<nx-documents>", () => {
  it("tarjetas con su estado, en orden de atención; el resumen para una pestaña", async () => {
    const el = await mount();
    expect(cards(el).map((c) => c.dataset.id)).toEqual(["rut", "pasaporte", "banco", "cedula", "examen"]);
    expect(card(el, "rut").dataset.state).toBe("missing");
    expect(card(el, "rut").querySelector(".nx-documents__state")!.textContent).toBe("Falta");
    expect(card(el, "rut").querySelector(".nx-documents__meta")!.textContent).toBe("Lo pide Nómina para la retención en la fuente");
    expect(card(el, "pasaporte").querySelector(".nx-documents__state")!.textContent).toBe("Vence en 49 días");
    expect(card(el, "pasaporte").querySelector(".nx-documents__state")!.getAttribute("data-tone")).toBe("warning");
    expect(card(el, "cedula").querySelector(".nx-documents__meta")!.textContent).toBe("Usado en 2 trámites");
    expect(card(el, "banco").querySelector(".nx-documents__meta")!.textContent).toBe("Davivienda · Ahorros");
    expect(card(el, "cedula").querySelector('.nx-documents__paper[data-kind="id"]')).toBeTruthy();
    expect(card(el, "rut").querySelector(".nx-documents__up")).toBeTruthy();
    expect(el.summaryText).toBe("Falta 1 · 1 por vencer · 1 en revisión");
    // El estado describe la tarjeta.
    expect(card(el, "rut").getAttribute("aria-describedby")).toBe(card(el, "rut").querySelector(".nx-documents__state")!.id);
    el.order = "none";
    await tick();
    expect(cards(el)[0].dataset.id).toBe("cedula");
  });

  it("una miniatura segura se ve; una insegura no", async () => {
    const el = await mount();
    el.items = [{ id: "f", name: "Foto", thumbnail: "/fotos/1.jpg" }, { id: "g", name: "Otra", thumbnail: "javascript:alert(1)", kind: "photo" }];
    await tick();
    expect(card(el, "f").querySelector("img")!.getAttribute("src")).toMatch(/\/fotos\/1\.jpg$/);
    expect(card(el, "g").querySelector("img")).toBeNull();
    expect(card(el, "g").querySelector('[data-kind="photo"]')).toBeTruthy();
  });

  it("el detalle: qué se leyó, qué se comprobó, quién lo pide y quién lo ha usado", async () => {
    const el = await mount();
    const opened: DocumentsOpenDetail[] = [];
    el.addEventListener("nx-documents-open", (e) => opened.push(e.detail));
    card(el, "cedula").click();
    await until(() => panel(el)?.getAttribute("heading"));
    const p = panel(el)!;
    expect(opened[0].id).toBe("cedula");
    expect(p.getAttribute("mode")).toBe("panel");
    expect(p.getAttribute("heading")).toBe("Cédula de ciudadanía");
    expect(p.getAttribute("description")).toBe("Vigente");
    expect(p.querySelector(".nx-documents__fields")!.textContent).toBe("Número1.036.482.117");
    expect(p.querySelector(".nx-documents__checks")!.textContent).toContain("coinciden con tu perfil");
    expect([...p.querySelectorAll(".nx-documents__chips li")].map((x) => x.textContent)).toEqual(["Contratación", "Viáticos"]);
    const uses = [...p.querySelectorAll(".nx-documents__uses li")].map((x) => x.textContent);
    expect(uses[0]).toMatch(/^12 ago\.? 2026Viáticos · VIA-0331/);
    expect(p.querySelector(".nx-documents__added")!.textContent).toMatch(/^Subido el 3 feb\.? 2021 por Talento Humano\.$/);
    const link = p.querySelector<HTMLAnchorElement>(".nx-documents__link")!;
    expect(link.getAttribute("href")).toBe("/docs/cedula.pdf");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(p.querySelector('[data-act="replace"]')).toBeTruthy();
  });

  it("vigencia en el detalle; nota sensible; sin «Reemplazar» si no se reemplaza aquí", async () => {
    const el = await mount();
    el.open("pasaporte");
    await until(() => panel(el)?.querySelector(".nx-documents__vig"));
    expect(panel(el)!.querySelector(".nx-documents__vig")!.getAttribute("data-tone")).toBe("warning");
    expect(panel(el)!.querySelector(".nx-documents__vig")!.textContent).toContain("Vence en 49 días");
    el.open("examen");
    await tick();
    expect(panel(el)!.querySelector(".nx-documents__note")!.textContent).toBe("Dato sensible: aquí solo queda el concepto de aptitud.");
    expect(panel(el)!.querySelector('[data-act="replace"]')).toBeNull();
    expect(panel(el)!.querySelector(".nx-documents__none")!.textContent).toBe("Ningún trámite todavía.");
    expect(el.upload("examen")).toBe(false);
  });

  it("lo que falta abre la subida; un archivo que no sirve se avisa ahí mismo", async () => {
    const el = await mount();
    const up: DocumentsUploadDetail[] = [];
    const files: DocumentsFileDetail[] = [];
    el.addEventListener("nx-documents-upload", (e) => up.push(e.detail));
    el.addEventListener("nx-documents-file", (e) => files.push(e.detail));
    card(el, "rut").click();
    await until(() => panel(el)?.querySelector(".nx-documents__input"));
    expect(up[0].id).toBe("rut");
    expect(panel(el)!.getAttribute("description")).toBe("Subir");
    expect(panel(el)!.querySelector(".nx-documents__hint")!.textContent).toContain("Lo pide Nómina");
    const input = panel(el)!.querySelector<HTMLInputElement>(".nx-documents__input")!;
    expect(input.getAttribute("accept")).toBe(".pdf,image/*");
    Object.defineProperty(input, "files", { value: [new File(["x"], "rut.docx", { type: "application/msword" })], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(panel(el)!.querySelector(".nx-documents__error")!.textContent).toBe("Ese tipo de archivo no sirve: sube un PDF o una imagen.");
    expect(files).toHaveLength(0);
    const big = new File(["x"], "rut.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 30 * 1024 * 1024 });
    const input2 = panel(el)!.querySelector<HTMLInputElement>(".nx-documents__input")!;
    Object.defineProperty(input2, "files", { value: [big], configurable: true });
    input2.dispatchEvent(new Event("change", { bubbles: true }));
    expect(panel(el)!.querySelector(".nx-documents__error")!.textContent).toMatch(/^El archivo pasa de 20/);
  });

  it("un archivo que sirve sale a la app; mientras lee, espera; al guardarlo, muestra cómo quedó", async () => {
    const el = await mount();
    el.addEventListener("nx-documents-file", (e) => (el.busy = e.detail.id));
    el.upload("rut");
    await until(() => panel(el)?.querySelector(".nx-documents__input"));
    const input = panel(el)!.querySelector<HTMLInputElement>(".nx-documents__input")!;
    Object.defineProperty(input, "files", { value: [new File(["%PDF"], "rut.pdf", { type: "application/pdf" })], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(panel(el)!.querySelector(".nx-documents__busy")!.textContent).toBe("Leyendo rut.pdf…");
    // La app guardó: el documento ya no falta.
    el.items = DOCS.map((d) => (d.id === "rut" ? { ...d, status: "ok", fields: [{ label: "NIT", value: "1.036.482.117-2" }], addedAt: TODAY, addedBy: "ti" } : d));
    el.busy = null;
    await tick();
    expect(panel(el)!.querySelector(".nx-documents__saved")!.textContent).toBe("Listo: quedó guardado.");
    expect(panel(el)!.querySelector(".nx-documents__fields")!.textContent).toContain("1.036.482.117-2");
    expect(panel(el)!.querySelector('[data-act="close"]')!.textContent).toBe("Listo");
    expect(card(el, "rut").dataset.state).toBe("ok");
  });

  it("si vuelve rechazado, el motivo se ve en la subida para intentar otra vez", async () => {
    const el = await mount();
    el.upload("rut");
    await until(() => panel(el)?.querySelector(".nx-documents__input"));
    const input = panel(el)!.querySelector<HTMLInputElement>(".nx-documents__input")!;
    Object.defineProperty(input, "files", { value: [new File(["%PDF"], "rut.pdf", { type: "application/pdf" })], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    el.items = DOCS.map((d) => (d.id === "rut" ? { ...d, status: "rejected", reason: "Está a nombre de otra persona." } : d));
    await tick();
    expect(panel(el)!.querySelector(".nx-documents__error")!.textContent).toBe("Está a nombre de otra persona.");
    expect(panel(el)!.querySelector(".nx-documents__input")).toBeTruthy();
    expect(card(el, "rut").querySelector(".nx-documents__state")!.textContent).toBe("Rechazado");
  });

  it("con handoff-endpoint, «Usar el celular» apunta al mismo <input>", async () => {
    const el = await mount('handoff-endpoint="/api/handoff"');
    el.upload("rut");
    await until(() => panel(el)?.querySelector("nx-handoff"));
    const ho = panel(el)!.querySelector("nx-handoff")!;
    expect(ho.getAttribute("endpoint")).toBe("/api/handoff");
    expect(ho.getAttribute("kind")).toBe("photo");
    expect(ho.getAttribute("for")).toBe(panel(el)!.querySelector(".nx-documents__input")!.id);
  });

  it("las tarjetas conservan su nodo; al cerrar el panel, el foco vuelve a la del documento", async () => {
    const el = await mount();
    const before = card(el, "cedula");
    before.focus();
    before.click();
    await until(() => panel(el)?.getAttribute("heading"));
    el.items = DOCS.map((d) => ({ ...d }));
    await tick();
    expect(card(el, "cedula")).toBe(before);
    el.close();
    await tick();
    expect(document.activeElement).toBe(before);
  });

  it("los eventos cancelados no abren el panel", async () => {
    const el = await mount();
    el.addEventListener("nx-documents-open", (e) => e.preventDefault());
    el.addEventListener("nx-documents-upload", (e) => e.preventDefault());
    expect(el.open("cedula")).toBe(false);
    expect(el.open("rut")).toBe(false);
    await tick();
    expect(panel(el)).toBeNull();
  });
});
