// @vitest-environment happy-dom
//
// Las filas de <nx-form> (`type: "rows"`): agregar o quitar una fila rehacía todas, y cada
// <nx-select> nuevo volvía solo con `options` + `value`, así que lo que la persona eligió desde la
// búsqueda en el servidor (`source`) quedaba como «Elige…» aunque `values` siguiera con el id. Ahora
// las filas se ponen al día por id (las que siguen conservan sus nodos) y el formulario recuerda el
// registro elegido en un select que busca, para devolvérselo al control cuando tiene que rehacerlo.
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/form/index";
import "../src/components/select/index";
import type { FormField, NxForm } from "../src/components/form/index";
import type { NxSelect } from "../src/components/select/index";

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});
const tick = () => new Promise((r) => setTimeout(r, 0));

const people = (hint?: string): FormField[] => [
  {
    key: "people",
    label: "Personas",
    type: "rows",
    hint,
    fields: [
      { key: "user_id", label: "Persona", type: "select", source: "/core/users_for_select", options: [{ value: "1", label: "Ana" }], span: 3 },
      { key: "nota", label: "Nota", span: 3 },
    ],
  },
];
async function mount(fields: FormField[] = people()): Promise<NxForm> {
  document.body.innerHTML = '<nx-form locale="es-CO"></nx-form>';
  const f = document.querySelector("nx-form")!;
  f.fields = fields;
  f.values = { people: [{ user_id: "1", nota: "Líder" }] };
  await tick();
  return f;
}
const rows = (f: NxForm) => [...f.querySelectorAll<HTMLElement>(".nx-form__row")];
const selects = (f: NxForm) => [...f.querySelectorAll<NxSelect>(".nx-form__row nx-select")];
const shown = (f: NxForm) => selects(f).map((s) => s.querySelector(".nx-select__field")!.textContent!.trim());
const add = (f: NxForm) => f.querySelector<HTMLButtonElement>('[data-act="add-row"]')!.click();
/** La persona elige en la búsqueda del servidor un registro que no está en `options`. */
function choose(sel: NxSelect, record: { value: string; label: string }) {
  sel.selection = [record];
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("<nx-form>: filas que se ponen al día por id", () => {
  it("agregar una fila no rehace las demás: lo elegido en la búsqueda se sigue viendo", async () => {
    const f = await mount();
    add(f);
    choose(selects(f)[1], { value: "77", label: "Pedro (de la búsqueda)" });
    expect(f.values.people).toEqual([
      { user_id: "1", nota: "Líder" },
      { user_id: "77", nota: null },
    ]);
    const [a, b] = rows(f);
    const sel = selects(f)[1];
    add(f);
    expect(rows(f)).toHaveLength(3);
    expect(rows(f)[0]).toBe(a);
    expect(rows(f)[1]).toBe(b);
    expect(selects(f)[1]).toBe(sel);
    expect(shown(f)).toEqual(["Ana", "Pedro (de la búsqueda)", "Elige…"]);
    expect(f.values.people).toEqual([
      { user_id: "1", nota: "Líder" },
      { user_id: "77", nota: null },
      { user_id: null, nota: null },
    ]);
  });

  it("quitar una fila deja las otras como estaban, renumera «fila n» y el foco pasa a la que quedó en su lugar", async () => {
    const f = await mount();
    add(f);
    choose(selects(f)[1], { value: "77", label: "Pedro (de la búsqueda)" });
    add(f);
    const [a, b, c] = rows(f);
    expect(b.getAttribute("aria-label")).toBe("Personas, fila 2");
    a.querySelector<HTMLButtonElement>(".nx-form__row-del")!.click();
    expect(rows(f)).toEqual([b, c]);
    expect(a.isConnected).toBe(false);
    expect(shown(f)).toEqual(["Pedro (de la búsqueda)", "Elige…"]);
    expect(b.getAttribute("aria-label")).toBe("Personas, fila 1");
    const del = b.querySelector<HTMLButtonElement>(".nx-form__row-del")!;
    expect(del.getAttribute("aria-label")).toBe("Quitar Personas, fila 1");
    expect(del.getAttribute("title")).toBe("Quitar Personas, fila 1");
    expect(c.getAttribute("aria-label")).toBe("Personas, fila 2");
    expect(document.activeElement).toBe(del);
    expect(f.values.people).toEqual([
      { user_id: "77", nota: null },
      { user_id: null, nota: null },
    ]);
  });

  it("si el control se rehace (otro esquema), vuelve con el registro elegido, en una fila o suelto", async () => {
    const fields = (hint?: string): FormField[] => [...people(hint), { key: "jefe", label: "Jefe", type: "select", source: "/core/users_for_select", options: [] }];
    const f = await mount(fields());
    add(f);
    choose(selects(f)[1], { value: "77", label: "Pedro (de la búsqueda)" });
    const jefe = () => f.querySelector<NxSelect>('nx-field[data-key="jefe"] nx-select')!;
    choose(jefe(), { value: "9", label: "Marta (de la búsqueda)" });
    const old = jefe();
    f.fields = fields("Quien participa en la tarea");
    expect(jefe()).not.toBe(old);
    expect(jefe().value).toBe("9");
    expect(jefe().querySelector(".nx-select__field")!.textContent).toContain("Marta (de la búsqueda)");
    expect(shown(f)).toEqual(["Ana", "Pedro (de la búsqueda)"]);
    expect(f.values.people).toEqual([
      { user_id: "1", nota: "Líder" },
      { user_id: "77", nota: null },
    ]);
  });

  it("si la fila cambió a otro valor, no se le pone el registro viejo", async () => {
    const f = await mount();
    add(f);
    choose(selects(f)[1], { value: "77", label: "Pedro (de la búsqueda)" });
    f.values = { people: [{ user_id: "1" }, { user_id: "88" }] };
    expect(selects(f)[1].value).toBe("");
    expect(shown(f)[1]).toBe("Elige…");
    expect(f.values.people).toEqual([
      { user_id: "1", nota: null },
      { user_id: "88", nota: null },
    ]);
  });

  it("recargar el registro (values) no rehace las filas: el foco y la selección del texto se quedan", async () => {
    const f = await mount();
    const nota = f.querySelector<HTMLInputElement>('.nx-form__row [name$=".nota"]')!;
    nota.focus();
    nota.setSelectionRange(1, 3);
    f.values = { people: [{ user_id: "1", nota: "Líder" }, { user_id: "1", nota: "Apoyo" }] };
    expect(rows(f)).toHaveLength(2);
    expect(f.querySelector('.nx-form__row [name$=".nota"]')).toBe(nota);
    expect(document.activeElement).toBe(nota);
    expect([nota.selectionStart, nota.selectionEnd]).toEqual([1, 3]);
    expect(rows(f)[1].querySelector<HTMLInputElement>('[name$=".nota"]')!.value).toBe("Apoyo");
  });
});
