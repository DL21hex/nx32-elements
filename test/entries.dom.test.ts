// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/entries/index";
import "../src/components/dialog/index";
import "../src/components/form/index";
import { cleanEntries, isSections, newIds } from "../src/components/entries/logic";
import { registerIcons } from "../src/core/icons";
import type { EntriesActionDetail, EntriesEditDetail, EntriesOpenDetail, EntriesRemoveDetail, EntriesSaveDetail, EntryItem, NxEntries } from "../src/components/entries/index";
import type { FormField, NxForm } from "../src/components/form/index";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const tick = () => new Promise((r) => setTimeout(r, 0));
/** Espera a que se cumpla (el panel carga diálogo, formulario y botón la primera vez). */
const until = async (fn: () => unknown, ms = 3000) => {
  const end = Date.now() + ms;
  while (!fn() && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
};

const FAMILY: EntryItem[] = [
  { id: "andres", title: "Andrés Felipe Pérez Ríos", meta: "Esposo · 36 años · CC 71.845.220", avatar: "Andrés Pérez", tags: ["Beneficiario de la EPS", { label: "Contacto de emergencia", icon: "phone" }], proof: "Registro civil de matrimonio", values: { nombres: "Andrés Felipe", parentesco: "Cónyuge" } },
  { id: "sofia", title: "Sofía Pérez Gómez", meta: "Hija · 13 años", avatar: "Sofía Pérez", note: { text: "La caja pide el certificado escolar de 2026.", action: "Subir certificado" }, removeText: "Talento Humano tramitará su retiro de la EPS y de la caja." },
  { id: "gloria", title: "Gloria Elena Restrepo", meta: "Madre · 66 años", avatar: "Gloria Restrepo", badge: "Afiliación en trámite", badgeTone: "info", removable: false },
  { id: "th", title: "Analista de nómina sénior", meta: "Crear Colombia", locked: "Lo registra Talento Humano" },
];
const SCHEMA: FormField[] = [
  { key: "nombres", label: "Nombres", required: true },
  { key: "parentesco", label: "Parentesco", type: "select", options: ["Cónyuge", "Hijo(a)"], required: true },
];

async function mount(attrs = 'heading="Núcleo familiar" add-label="Agregar persona"', items = FAMILY): Promise<NxEntries> {
  document.body.innerHTML = `<nx-entries ${attrs}></nx-entries>`;
  const el = document.querySelector("nx-entries")!;
  el.items = items;
  await tick();
  return el;
}
const rows = (el: NxEntries) => [...el.querySelectorAll<HTMLLIElement>(".nx-entries__item")];
const row = (el: NxEntries, id: string) => el.querySelector<HTMLLIElement>(`.nx-entries__item[data-id="${id}"]`)!;
const btn = (li: Element, act: string) => li.querySelector<HTMLButtonElement>(`[data-act="${act}"]`);

describe("entries: lógica", () => {
  it("limpia lo que llega: sin id o título no sirve, el id repetido se ignora, tonos conocidos", () => {
    const out = cleanEntries([{ id: "a", title: "A", badge: "X", badgeTone: "rojo", tags: ["t", { label: "" }, 5], note: "Ojo" }, { id: "a", title: "Otra" }, { title: "Sin id" }, null, { id: 2, title: "Dos", locked: true, removable: false }]);
    expect(out.map((x) => x.id)).toEqual(["a", "2"]);
    expect(out[0].badgeTone).toBe("neutral");
    expect(out[0].tags).toEqual([{ label: "t" }, { label: "5" }]);
    expect(out[0].note).toEqual({ text: "Ojo", tone: "warning" });
    expect(out[1]).toMatchObject({ locked: true, removable: false });
  });
  it("secciones o campos; los ids nuevos", () => {
    expect(isSections([{ fields: [] }] as never)).toBe(true);
    expect(isSections(SCHEMA)).toBe(false);
    expect(isSections(null)).toBe(false);
    expect(newIds([{ id: "a", title: "A" }], [{ id: "a", title: "A" }, { id: "b", title: "B" }])).toEqual(["b"]);
  });
});

describe("<nx-entries>", () => {
  it("cabecera con título y agregar; cada registro con su cara, líneas, etiquetas, respaldo y aviso", async () => {
    registerIcons({ phone: '<rect x="6" y="2" width="12" height="20"/>' });
    const el = await mount();
    expect(el.querySelector(".nx-entries__title")!.textContent).toBe("Núcleo familiar");
    expect(el.querySelector(".nx-entries__title")!.tagName).toBe("H3");
    expect(el.querySelector(".nx-entries__add")!.textContent).toBe("Agregar persona");
    expect(el.querySelector(".nx-entries__list")!.getAttribute("aria-labelledby")).toBe(el.querySelector(".nx-entries__title")!.id);
    expect(rows(el)).toHaveLength(4);
    const a = row(el, "andres");
    expect(a.querySelector(".nx-entries__face")!.textContent).toBe("AP");
    expect(a.querySelector(".nx-entries__meta")!.textContent).toBe("Esposo · 36 años · CC 71.845.220");
    expect([...a.querySelectorAll(".nx-entries__tag")].map((t) => t.textContent)).toEqual(["Beneficiario de la EPS", "Contacto de emergencia"]);
    expect(a.querySelector(".nx-entries__tag .nx-icon svg")).toBeTruthy();
    expect(a.querySelector(".nx-entries__proof")!.textContent).toBe("Registro civil de matrimonio");
    expect(btn(a, "edit")!.getAttribute("aria-label")).toBe("Editar Andrés Felipe Pérez Ríos");
    expect(btn(a, "remove")!.getAttribute("aria-label")).toBe("Quitar Andrés Felipe Pérez Ríos");
    const g = row(el, "gloria");
    expect(g.querySelector(".nx-entries__badge")!.textContent).toBe("Afiliación en trámite");
    expect(g.querySelector(".nx-entries__badge")!.getAttribute("data-tone")).toBe("info");
    // No se quita, pero se edita.
    expect(btn(g, "remove")).toBeNull();
    expect(btn(g, "edit")).toBeTruthy();
  });

  it("bloqueado: candado con su explicación, sin editar ni quitar", async () => {
    const el = await mount();
    const th = row(el, "th");
    const lock = th.querySelector(".nx-entries__lock")!;
    expect(lock.getAttribute("role")).toBe("img");
    expect(lock.getAttribute("aria-label")).toBe("Lo registra Talento Humano");
    expect(btn(th, "edit")).toBeNull();
    expect(btn(th, "remove")).toBeNull();
  });

  it("la acción del aviso avisa con su id", async () => {
    const el = await mount();
    const got: EntriesActionDetail[] = [];
    el.addEventListener("nx-entries-action", (e) => got.push(e.detail));
    btn(row(el, "sofia"), "note")!.click();
    expect(got[0]).toMatchObject({ id: "sofia", action: "Subir certificado" });
  });

  it("quitar pide confirmar en el registro, con lo que pasa; Cancelar y Escape vuelven", async () => {
    const el = await mount();
    const s = row(el, "sofia");
    btn(s, "remove")!.focus();
    btn(s, "remove")!.click();
    const confirm = s.querySelector(".nx-entries__confirm")!;
    expect(confirm.textContent).toContain("¿Quitar «Sofía Pérez Gómez»?");
    expect(confirm.textContent).toContain("Talento Humano tramitará su retiro de la EPS y de la caja.");
    expect(document.activeElement).toBe(btn(s, "remove-no"));
    expect(btn(s, "edit")).toBeNull();
    btn(s, "remove-no")!.click();
    expect(s.querySelector(".nx-entries__confirm")).toBeNull();
    expect(document.activeElement).toBe(btn(s, "remove"));
    btn(s, "remove")!.click();
    btn(s, "remove-no")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(s.querySelector(".nx-entries__confirm")).toBeNull();
  });

  it("confirmar quita y avisa; cancelado, se queda", async () => {
    const el = await mount();
    const got: EntriesRemoveDetail[] = [];
    el.addEventListener("nx-entries-remove", (e) => got.push(e.detail));
    btn(row(el, "andres"), "remove")!.click();
    btn(row(el, "andres"), "remove-yes")!.click();
    expect(got[0].id).toBe("andres");
    expect(rows(el).map((r) => r.dataset.id)).toEqual(["sofia", "gloria", "th"]);
    // El foco pasa al que quedó en su lugar.
    expect(document.activeElement?.closest(".nx-entries__item")?.getAttribute("data-id")).toBe("sofia");
    el.addEventListener("nx-entries-remove", (e) => e.preventDefault());
    btn(row(el, "sofia"), "remove")!.click();
    btn(row(el, "sofia"), "remove-yes")!.click();
    expect(rows(el)).toHaveLength(3);
  });

  it("readonly: sin agregar, editar ni quitar; vacía dice su texto", async () => {
    const el = await mount('heading="En Crear Colombia" add-label="Agregar" readonly layout="timeline"', FAMILY.slice(0, 2));
    expect(el.querySelector<HTMLElement>(".nx-entries__add")!.hidden).toBe(true);
    expect(el.querySelector('[data-act="edit"], [data-act="remove"]')).toBeNull();
    // En la línea de tiempo, un punto en lugar de la cara.
    expect(el.querySelectorAll(".nx-entries__dot")).toHaveLength(2);
    expect(el.querySelector(".nx-entries__face")).toBeNull();
    el.items = [];
    await tick();
    expect(el.querySelector<HTMLElement>(".nx-entries__empty")!.hidden).toBe(false);
    expect(el.querySelector(".nx-entries__empty")!.textContent).toBe("Aún no hay nada aquí.");
    el.empty = "Sin experiencia registrada.";
    await tick();
    expect(el.querySelector(".nx-entries__empty")!.textContent).toBe("Sin experiencia registrada.");
  });

  it("sin schema, editar y agregar solo avisan", async () => {
    const el = await mount();
    const got: EntriesEditDetail[] = [];
    el.addEventListener("nx-entries-edit", (e) => got.push(e.detail));
    el.querySelector<HTMLButtonElement>(".nx-entries__add")!.click();
    btn(row(el, "andres"), "edit")!.click();
    expect(got.map((g) => g.id)).toEqual([null, "andres"]);
    expect(got[1].item!.title).toBe("Andrés Felipe Pérez Ríos");
    expect(el.querySelector("nx-dialog")).toBeNull();
  });

  it("con schema, editar abre el panel con el formulario lleno; guardar avisa y cierra", async () => {
    const el = await mount();
    el.schema = SCHEMA;
    const opened: EntriesOpenDetail[] = [];
    const saved: EntriesSaveDetail[] = [];
    el.addEventListener("nx-entries-open", (e) => opened.push(e.detail));
    el.addEventListener("nx-entries-save", (e) => saved.push(e.detail));
    btn(row(el, "andres"), "edit")!.click();
    await until(() => opened.length);
    const dlg = el.querySelector("nx-dialog")!;
    expect(dlg.getAttribute("mode")).toBe("panel");
    expect(dlg.getAttribute("heading")).toBe("Andrés Felipe Pérez Ríos");
    expect(dlg.getAttribute("description")).toBe("Núcleo familiar");
    const form = opened[0].form as NxForm;
    expect(el.form).toBe(form);
    await tick();
    expect(form.values).toMatchObject({ nombres: "Andrés Felipe", parentesco: "Cónyuge" });
    expect(dlg.querySelector('[data-act="panel-save"]')!.getAttribute("label")).toBe("Guardar");
    // El botón de adentro: un clic en el envoltorio de nx-button no es un clic del botón.
    dlg.querySelector<HTMLElement>('[data-act="panel-save"] .nx-button__btn')!.click();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: "andres", values: { nombres: "Andrés Felipe", parentesco: "Cónyuge" } });
    await tick();
    expect(el.form).toBeNull();
  });

  it("agregar: panel vacío con «Agregar»; un error del formulario no avisa; preventDefault deja el panel abierto", async () => {
    const el = await mount();
    el.schema = [{ heading: "Datos", fields: SCHEMA }];
    const saved: EntriesSaveDetail[] = [];
    el.addEventListener("nx-entries-save", (e) => {
      saved.push(e.detail);
      e.preventDefault();
    });
    el.querySelector<HTMLButtonElement>(".nx-entries__add")!.click();
    await until(() => el.form);
    const dlg = el.querySelector("nx-dialog")!;
    expect(dlg.getAttribute("heading")).toBe("Agregar persona");
    expect(dlg.querySelector('[data-act="panel-save"]')!.getAttribute("label")).toBe("Agregar");
    const form = el.form as NxForm;
    expect(form.submit()).toBe(false);
    expect(saved).toHaveLength(0);
    form.values = { nombres: "Emilia", parentesco: "Hijo(a)" };
    expect(form.submit()).toBe(true);
    expect(saved[0].id).toBeNull();
    // La app canceló: sigue abierto, y puede mostrar errores del servidor.
    expect(el.form).toBe(form);
    el.errors = { nombres: "Ya está registrada" };
    await tick();
    expect(form.querySelector('nx-field[data-key="nombres"]')!.getAttribute("error")).toBe("Ya está registrada");
    // Lo nuevo se ilumina cuando la app lo agrega.
    el.items = [...FAMILY, { id: "emilia", title: "Emilia Pérez Gómez" }];
    el.close();
    await tick();
    expect(row(el, "emilia").classList.contains("is-new")).toBe(true);
    expect(row(el, "andres").classList.contains("is-new")).toBe(false);
  });

  it("nx-entries-edit cancelado no abre el panel", async () => {
    const el = await mount();
    el.schema = SCHEMA;
    el.addEventListener("nx-entries-edit", (e) => e.preventDefault());
    expect(el.edit("andres")).toBe(false);
    await tick();
    expect(el.querySelector("nx-dialog")).toBeNull();
  });

  it("repintar no tira el foco: el botón de editar sigue enfocado", async () => {
    const el = await mount();
    btn(row(el, "sofia"), "edit")!.focus();
    el.items = FAMILY.map((x) => (x.id === "sofia" ? { ...x, meta: "Hija · 14 años" } : x));
    await tick();
    expect(document.activeElement).toBe(btn(row(el, "sofia"), "edit"));
    expect(row(el, "sofia").querySelector(".nx-entries__meta")!.textContent).toBe("Hija · 14 años");
  });

  it("los atributos aceptan JSON; layout cards", async () => {
    document.body.innerHTML = `<nx-entries layout="cards" items='${JSON.stringify([{ id: "a", title: "A" }])}'></nx-entries>`;
    await tick();
    const el = document.querySelector("nx-entries")!;
    expect(el.dataset.layout).toBe("cards");
    expect(rows(el)).toHaveLength(1);
    el.setAttribute("heading-level", "2");
    el.heading = "Idiomas";
    await tick();
    expect(el.querySelector(".nx-entries__title")!.tagName).toBe("H2");
  });
});
