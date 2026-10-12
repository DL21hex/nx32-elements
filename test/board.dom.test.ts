// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/board/index";
import type { BoardChangeDetail, NxBoard, NxBoardPanel } from "../src/components/board/index";

afterEach(() => {
  document.body.innerHTML = "";
});
const tick = () => new Promise((r) => setTimeout(r, 0));
const click = (el: Element, init: MouseEventInit = {}) => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));

async function mount(): Promise<NxBoard> {
  document.body.innerHTML = `
    <nx-board>
      <div slot="filters" id="controles">Período</div>
      <nx-board-panel span="8" heading="Días por mes" subheading="En días" dimension="tipo">
        <div slot="actions" id="acciones"><button>Días</button></div>
        <div id="leyenda">
          <button data-nx-filter="tipo:EG" data-nx-label="Enfermedad general">EG</button>
          <button data-nx-filter="tipo:AT" data-nx-label="Accidente de trabajo">AT</button>
        </div>
      </nx-board-panel>
      <nx-board-panel span="4" heading="Áreas" dimension="area mes">
        <svg><rect id="celda" data-nx-filter="area:emp,mes:2026-08"></rect></svg>
        <span id="fila" tabindex="0" role="button" data-nx-filter="area:log">Logística</span>
      </nx-board-panel>
      <nx-board-panel span="12" heading="Detalle" personal id="detalle"><p id="tabla">Ana · M54.5</p></nx-board-panel>
    </nx-board>`;
  const board = document.querySelector("nx-board")!;
  await tick();
  return board;
}

describe("<nx-board>", () => {
  it("arma la grilla sin mover los hijos y pinta el título de cada panel", async () => {
    const board = await mount();
    const panel = board.querySelector<NxBoardPanel>("nx-board-panel")!;
    expect(panel.span).toBe(8);
    const head = panel.querySelector(":scope > .nx-board-panel__head")!;
    expect(head.querySelector("h2")?.textContent).toBe("Días por mes");
    expect(head.querySelector("p")?.textContent).toBe("En días");
    // El título y los chips son nodos propios: nunca se duplican, y los del autor siguen en su lugar.
    expect(panel.querySelectorAll(":scope > .nx-board-panel__head")).toHaveLength(1);
    expect(board.querySelectorAll(":scope > .nx-board__chips")).toHaveLength(1);
    expect(board.querySelector(":scope > [slot=filters]")?.nextElementSibling?.tagName).toBe("NX-BOARD-PANEL");
    const chips = board.querySelector(".nx-board__chips")!;
    expect(chips.textContent).toMatch(/Toca una barra/);
    panel.heading = "Incapacidades por mes";
    await tick();
    expect(head.querySelector("h2")?.textContent).toBe("Incapacidades por mes");
  });

  it("un clic en una marca filtra, avisa, marca y pone su chip con el nombre de la marca", async () => {
    const board = await mount();
    const seen: BoardChangeDetail[] = [];
    board.addEventListener("nx-board-change", (e) => seen.push(e.detail));
    const at = board.querySelector('[data-nx-filter="tipo:AT"]')!;
    click(at);
    expect(board.filters).toEqual({ tipo: ["AT"] });
    expect(seen).toEqual([{ filters: { tipo: ["AT"] }, changed: ["tipo"], reserved: false }]);
    expect(at.getAttribute("data-nx-filter-state")).toBe("on");
    expect(at.getAttribute("aria-pressed")).toBe("true");
    const eg = board.querySelector('[data-nx-filter="tipo:EG"]')!;
    expect(eg.getAttribute("data-nx-filter-state")).toBe("off");
    expect(eg.getAttribute("aria-pressed")).toBe("false");
    const chip = board.querySelector(".nx-board__chip")!;
    expect(chip.textContent).toBe("tipoAccidente de trabajo");
    expect(chip.getAttribute("aria-label")).toBe("Quitar el filtro tipo: Accidente de trabajo");
    // El panel de tipo no se filtra a sí mismo; el de áreas sí.
    const [p1, p2] = board.querySelectorAll<NxBoardPanel>("nx-board-panel");
    expect(p1.filters).toEqual({});
    expect(p2.filters).toEqual({ tipo: ["AT"] });
    expect(board.filtersFor("tipo")).toEqual({});
    expect(board.passes({ tipo: "EG" })).toBe(false);
    expect(board.passes({ tipo: "EG" }, "tipo")).toBe(true);
    click(at);
    expect(board.filters).toEqual({});
    expect(at.hasAttribute("data-nx-filter-state")).toBe(false);
    expect(seen).toHaveLength(2);
  });

  it("Ctrl suma; una celda elige dos dimensiones; Enter en una marca que no es botón", async () => {
    const board = await mount();
    click(board.querySelector('[data-nx-filter="tipo:AT"]')!);
    click(board.querySelector('[data-nx-filter="tipo:EG"]')!, { ctrlKey: true });
    expect(board.filters).toEqual({ tipo: ["AT", "EG"] });
    click(board.querySelector("#celda")!);
    expect(board.filters).toEqual({ tipo: ["AT", "EG"], area: ["emp"], mes: ["2026-08"] });
    expect(board.querySelector("#celda")!.getAttribute("data-nx-filter-state")).toBe("on");
    expect(board.querySelector("#fila")!.getAttribute("data-nx-filter-state")).toBe("off");
    board.querySelector("#fila")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(board.filters.area).toEqual(["log"]);
    expect(board.querySelector("#celda")!.getAttribute("data-nx-filter-state")).toBe("off");
  });

  it("los chips quitan su filtro y «Quitar filtros» quita todo, con el foco en su lugar", async () => {
    const board = await mount();
    board.dimensions = [{ id: "tipo", label: "Tipo", values: { EG: "Enf. general" } }];
    board.filters = { tipo: ["EG", "AT"], area: ["log"] };
    await tick();
    const chips = () => [...board.querySelectorAll(".nx-board__chip")];
    expect(chips().map((c) => c.textContent)).toEqual(["TipoEnf. general", "TipoAccidente de trabajo", "arealog"]);
    expect(board.querySelector(".nx-board__clear")?.textContent).toBe("Quitar filtros");
    const seen: BoardChangeDetail[] = [];
    board.addEventListener("nx-board-change", (e) => seen.push(e.detail));
    click(chips()[1]);
    expect(board.filters).toEqual({ tipo: ["EG"], area: ["log"] });
    expect(seen[0].changed).toEqual(["tipo"]);
    expect(document.activeElement).toBe(chips()[1]);
    click(board.querySelector(".nx-board__clear")!);
    expect(board.filters).toEqual({});
    expect(seen[1].changed.sort()).toEqual(["area", "tipo"]);
    board.labels = { hint: "" };
    await tick();
    expect((board.querySelector(".nx-board__chips") as HTMLElement).hidden).toBe(true);
  });

  it("asignar filtros no avisa; toggle() y clear() sí", async () => {
    const board = await mount();
    let n = 0;
    board.addEventListener("nx-board-change", () => n++);
    board.filters = { tipo: ["AT"] };
    await tick();
    expect(n).toBe(0);
    expect(board.querySelector('[data-nx-filter="tipo:AT"]')!.getAttribute("data-nx-filter-state")).toBe("on");
    board.toggle("area", "emp");
    expect(n).toBe(1);
    board.clear("area");
    expect(board.filters).toEqual({ tipo: ["AT"] });
    board.clear("area");
    expect(n).toBe(2);
  });

  it("las marcas que llegan después se marcan solas", async () => {
    const board = await mount();
    board.filters = { tipo: ["AT"] };
    await tick();
    const b = document.createElement("button");
    b.setAttribute("data-nx-filter", "tipo:MAT");
    board.querySelector("#leyenda")!.append(b);
    await tick();
    expect(b.getAttribute("data-nx-filter-state")).toBe("off");
  });

  it("restricted + filtro sensible reserva los paneles personales", async () => {
    const board = await mount();
    board.dimensions = [{ id: "cie", label: "Diagnóstico", sensitive: true }, { id: "area", label: "Área", sensitive: true }];
    board.toggle("cie", "M54.5");
    const detalle = board.querySelector("#detalle")!;
    expect(detalle.hasAttribute("data-nx-reserved")).toBe(false);
    expect(board.reserved).toBe(false);
    const seen: BoardChangeDetail[] = [];
    board.addEventListener("nx-board-change", (e) => seen.push(e.detail));
    board.restricted = true;
    await tick();
    expect(board.reserved).toBe(true);
    expect(detalle.hasAttribute("data-nx-reserved")).toBe(true);
    expect(detalle.querySelector(".nx-board-panel__reserved")?.textContent).toBe("Con un filtro de diagnóstico, el detalle por persona no está disponible para tu rol.");
    board.toggle("area", "emp");
    await tick();
    expect(seen.at(-1)?.reserved).toBe(true);
    expect(detalle.querySelectorAll(".nx-board-panel__reserved")).toHaveLength(1);
    expect(detalle.querySelector(".nx-board-panel__reserved")?.textContent).toMatch(/diagnóstico y área/);
    expect(board.querySelectorAll(".nx-board-panel__reserved")).toHaveLength(1);
    board.clear();
    expect(detalle.hasAttribute("data-nx-reserved")).toBe(false);
    expect(detalle.querySelector(".nx-board-panel__reserved")).toBeNull();
  });

  it("busy en el panel y atributos JSON en el tablero", async () => {
    document.body.innerHTML = `<nx-board filters='{"tipo":["AT"]}' dimensions='[{"id":"tipo","label":"Tipo"}]'><nx-board-panel busy span="40"></nx-board-panel></nx-board>`;
    await tick();
    const board = document.querySelector("nx-board")!;
    expect(board.filters).toEqual({ tipo: ["AT"] });
    expect(board.querySelector(".nx-board__chip")?.textContent).toBe("TipoAT");
    const p = board.querySelector("nx-board-panel")!;
    expect(p.getAttribute("aria-busy")).toBe("true");
    expect(p.span).toBe(12);
    p.busy = false;
    expect(p.hasAttribute("aria-busy")).toBe(false);
    expect(p.querySelector(".nx-board-panel__head")).toBeNull();
  });
});
