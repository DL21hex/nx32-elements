// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/field/index";
import type { NxField } from "../src/components/field/index";

afterEach(() => {
  document.body.innerHTML = "";
});

const tick = () => new Promise((r) => setTimeout(r, 0));
/** Como el parser: el elemento se conecta antes que sus hijos, y el campo se acomoda al llegar. */
async function mount(html: string): Promise<NxField> {
  document.body.innerHTML = html;
  await tick();
  return document.querySelector("nx-field")!;
}
const msg = (f: NxField) => f.querySelector(".nx-field__msg")!;

describe("<nx-field>", () => {
  it("pone la etiqueta arriba con for, y el mensaje después del control", async () => {
    const f = await mount('<nx-field label="Correo personal" hint="Allí llegan los desprendibles"><input type="email" name="correo"></nx-field>');
    const input = f.querySelector("input")!;
    const label = f.querySelector<HTMLLabelElement>(".nx-field__label")!;
    expect(label.tagName).toBe("LABEL");
    expect(label.textContent).toBe("Correo personal");
    expect(label.htmlFor).toBe(input.id);
    expect(input.id).toMatch(/^nx-field\d+-c$/);
    expect(f.firstElementChild!.classList.contains("nx-field__top")).toBe(true);
    expect(f.lastElementChild).toBe(msg(f));
    expect(msg(f).textContent).toBe("Allí llegan los desprendibles");
    expect(input.getAttribute("aria-describedby")).toBe(msg(f).id);
  });

  it("respeta el id y el aria-describedby del autor", async () => {
    const f = await mount('<nx-field label="Celular"><input id="cel" aria-describedby="otro"></nx-field>');
    const input = f.querySelector("input")!;
    expect(input.id).toBe("cel");
    expect(f.querySelector<HTMLLabelElement>("label")!.htmlFor).toBe("cel");
    expect(input.getAttribute("aria-describedby")).toBe(`otro ${msg(f).id}`);
  });

  it("una sola línea debajo: error, si no aviso, si no ayuda", async () => {
    const f = await mount('<nx-field label="Correo" hint="Ayuda"><input></nx-field>');
    const input = f.querySelector("input")!;
    f.warning = "¿Quisiste decir gmail.com?";
    expect(msg(f).querySelector(".nx-field__warn")!.textContent).toBe("¿Quisiste decir gmail.com?");
    expect(f.hasAttribute("data-warning")).toBe(true);
    f.error = "Escribe un correo como nombre@dominio.com";
    expect(msg(f).querySelector(".nx-field__err")!.textContent).toBe("Escribe un correo como nombre@dominio.com");
    expect(msg(f).querySelector(".nx-field__warn")).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    f.error = null;
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(msg(f).querySelector(".nx-field__warn")).not.toBeNull();
  });

  it("lo que la persona cambia borra el error, el aviso y el origen", async () => {
    const f = await mount('<nx-field label="Nombres" source="Cédula" source-detail="Leído de la cédula" error="Falta" warning="Revisa"><input></nx-field>');
    const src = f.querySelector<HTMLElement>(".nx-field__src")!;
    expect(src.hidden).toBe(false);
    expect(src.textContent).toContain("Cédula");
    expect(src.title).toBe("Leído de la cédula");
    expect(f.querySelector("input")!.getAttribute("aria-describedby")).toContain(src.id);
    const input = f.querySelector("input")!;
    input.value = "Andrés";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(f.error).toBeNull();
    expect(f.warning).toBeNull();
    expect(f.source).toBeNull();
    expect(src.hidden).toBe(true);
  });

  it("required va al control; optional pinta «Opcional»", async () => {
    const f = await mount('<nx-field label="RH" optional><select><option>O+</option></select></nx-field>');
    expect(f.querySelector<HTMLElement>(".nx-field__opt")!.hidden).toBe(false);
    expect(f.querySelector(".nx-field__opt")!.textContent).toBe("Opcional");
    f.optional = false;
    f.required = true;
    const sel = f.querySelector("select")!;
    expect(sel.required).toBe(true);
    expect(sel.getAttribute("aria-required")).toBe("true");
    f.required = false;
    expect(sel.required).toBe(false);
    expect(sel.hasAttribute("aria-required")).toBe(false);
  });

  it("no le quita required a un control que ya lo traía", async () => {
    const f = await mount('<nx-field label="X"><input required></nx-field>');
    f.required = true;
    f.required = false;
    expect(f.querySelector("input")!.required).toBe(true);
  });

  it("un grupo de radios se nombra como grupo", async () => {
    const f = await mount(`<nx-field label="Tipo de cuenta" required>
      <div class="nx-segmented"><label><input type="radio" name="t" value="a"><span>Ahorros</span></label><label><input type="radio" name="t" value="c"><span>Corriente</span></label></div>
    </nx-field>`);
    const label = f.querySelector(".nx-field__label")!;
    expect(label.tagName).toBe("SPAN");
    expect(f.getAttribute("role")).toBe("radiogroup");
    expect(f.getAttribute("aria-labelledby")).toBe(label.id);
    expect(f.getAttribute("aria-required")).toBe("true");
    const radios = [...f.querySelectorAll("input")];
    expect(radios.every((r) => r.getAttribute("aria-describedby") === msg(f).id)).toBe(true);
    f.error = "Elige una opción";
    expect(radios.every((r) => r.getAttribute("aria-invalid") === "true")).toBe(true);
    radios[1].click();
    expect(f.error).toBeNull();
  });

  it("en lectura muestra el texto, «—» si está vacío, y candado con locked", async () => {
    const f = await mount('<nx-field label="ARL" text="Sura · póliza de la empresa" locked><input></nx-field>');
    const view = f.querySelector(".nx-field__text")!;
    expect(view.textContent).toContain("Sura · póliza de la empresa");
    expect(view.querySelector('[role="img"]')!.getAttribute("aria-label")).toBe("No se edita aquí");
    expect(f.querySelector(".nx-field__label")!.tagName).toBe("SPAN");
    f.text = "";
    expect(view.querySelector(".nx-field__empty")!.textContent).toBe("—");
    expect(view.querySelector(".nx-sr-only")!.textContent).toBe("Sin dato");
    f.text = null;
    expect(f.querySelector<HTMLElement>(".nx-field__text")!.hidden).toBe(true);
    expect(f.querySelector(".nx-field__label")!.tagName).toBe("LABEL");
  });

  it("un control que llega después también se conecta", async () => {
    const f = await mount('<nx-field label="Ciudad"></nx-field>');
    expect(f.querySelector(".nx-field__label")!.tagName).toBe("SPAN");
    f.append(document.createElement("select"));
    await tick();
    const sel = f.querySelector("select")!;
    expect(f.querySelector<HTMLLabelElement>(".nx-field__label")!.htmlFor).toBe(sel.id);
    expect(f.lastElementChild).toBe(msg(f));
  });

  it("span solo acepta 1 a 6; labels cambia los textos", async () => {
    const f = await mount('<nx-field label="X" optional><input></nx-field>');
    f.span = 3;
    expect(f.getAttribute("span")).toBe("3");
    f.span = 9;
    expect(f.hasAttribute("span")).toBe(false);
    f.labels = { optional: "Optional" };
    expect(f.querySelector(".nx-field__opt")!.textContent).toBe("Optional");
    expect(f.control).toBe(f.querySelector("input"));
  });
});
