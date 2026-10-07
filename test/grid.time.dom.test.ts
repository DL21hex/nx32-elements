// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/grid/index";
import type { GridChange, GridColumn, GridRow, NxGrid } from "../src/index";

afterEach(() => vi.useRealTimers());

const COLS: GridColumn[] = [
  { key: "finca", label: "Finca" },
  { key: "caja", label: "Primera caja", type: "time", editable: true, sequence: "empaque" },
  { key: "pallet", label: "Último pallet", type: "time", editable: true, sequence: "empaque" },
  { key: "salida", label: "Salida", type: "time", editable: true, sequence: "empaque" },
];
const ROWS: GridRow[] = [
  { id: "1", finca: "Remanso", caja: "07:00", pallet: null, salida: null },
  { id: "2", finca: "Don Fuad", caja: null, pallet: null, salida: null },
];

const tick = () => new Promise((r) => setTimeout(r, 0));

function mount(): NxGrid {
  document.body.innerHTML = "<nx-grid></nx-grid>";
  const el = document.querySelector("nx-grid")!;
  el.columns = COLS;
  el.rows = ROWS;
  return el;
}

const scroll = (el: NxGrid) => el.querySelector<HTMLElement>(".nx-grid__scroll")!;
const cellEl = (el: NxGrid, r: number, c: number) => el.querySelector<HTMLElement>(`[data-r="${r}"] > [data-c="${c}"]`)!;
const key = (el: NxGrid, k: string, init: KeyboardEventInit = {}) => scroll(el).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, ...init }));
const input = (el: NxGrid) => el.querySelector<HTMLInputElement>(".nx-grid__input")!;
const type = (el: NxGrid, text: string, k = "Enter") => {
  const i = input(el);
  i.value = text;
  i.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
};
/** Lo que anuncia la tabla (su región `role="status"`). */
const live = (el: NxGrid) => [...el.querySelectorAll('.nx-sr-only[role="status"]')].map((x) => x.textContent).join(" | ");

describe("<nx-grid> horas", () => {
  it("se escribe rápido: «1430» queda 14:30 y el cambio viaja como «HH:MM»", () => {
    const el = mount();
    const seen: GridChange[] = [];
    el.addEventListener("nx-grid-change", (e) => seen.push(...e.detail.changes));
    key(el, "ArrowRight");
    key(el, "ArrowRight");
    key(el, "1");
    expect(input(el).getAttribute("inputmode")).toBe("numeric");
    type(el, "1430");
    expect(seen).toEqual([{ id: "1", key: "pallet", value: "14:30", old: null }]);
    expect(cellEl(el, 0, 2).textContent).toBe("14:30");
    expect(cellEl(el, 0, 2).classList.contains("is-time")).toBe(true);
  });

  it("una hora que no se entiende no deja salir con Enter y dice cómo escribirla", () => {
    const el = mount();
    key(el, "ArrowRight");
    key(el, "F2");
    type(el, "25:00");
    expect(input(el)).not.toBeNull();
    expect(input(el).getAttribute("aria-invalid")).toBe("true");
    expect(live(el)).toContain("6:40");
    expect(el.rows[0].caja).toBe("07:00");
    // Escribir quita la marca; una hora buena sale.
    input(el).dispatchEvent(new Event("input"));
    expect(input(el).hasAttribute("aria-invalid")).toBe(false);
    type(el, "6:45");
    expect(el.rows[0].caja).toBe("06:45");
  });

  it("al salir con una hora que no se entiende (el foco se va), la celda queda como estaba", () => {
    const el = mount();
    key(el, "ArrowRight");
    key(el, "F2");
    input(el).value = "mañana";
    input(el).dispatchEvent(new FocusEvent("blur"));
    expect(el.rows[0].caja).toBe("07:00");
  });

  it("Ctrl+: pone la hora de ahora en las celdas de hora del rango, en un solo paso", () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 6, 9, 41), toFake: ["Date"] });
    const el = mount();
    key(el, "ArrowRight");
    key(el, "ArrowRight");
    key(el, "ArrowDown", { shiftKey: true });
    key(el, ":", { ctrlKey: true, shiftKey: true });
    expect([el.rows[0].pallet, el.rows[1].pallet]).toEqual(["09:41", "09:41"]);
    el.undo();
    expect([el.rows[0].pallet, el.rows[1].pallet]).toEqual([null, null]);
  });

  it("«ahora» y Ctrl+: dentro del campo escriben la hora del reloj", () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 6, 16, 5), toFake: ["Date"] });
    const el = mount();
    key(el, "ArrowRight");
    key(el, "ArrowDown");
    key(el, "F2");
    input(el).dispatchEvent(new KeyboardEvent("keydown", { key: ";", ctrlKey: true, bubbles: true, cancelable: true }));
    expect(input(el).value).toBe("16:05");
    type(el, "ahora", "Tab");
    expect(el.rows[1].caja).toBe("16:05");
  });

  it("pegar desde Excel: horas con segundos o a. m./p. m.; lo que no es hora no pisa la celda", () => {
    const el = mount();
    key(el, "ArrowRight");
    const paste = new DataTransfer();
    paste.setData("text/plain", "06:50:00\t7:30 p. m.\tnada\r\n");
    scroll(el).dispatchEvent(new ClipboardEvent("paste", { clipboardData: paste, bubbles: true, cancelable: true }));
    expect([el.rows[0].caja, el.rows[0].pallet, el.rows[0].salida]).toEqual(["06:50", "19:30", null]);
  });
});

describe("<nx-grid> pasos de un proceso (sequence)", () => {
  it("«Faltante» aparece al registrar un paso posterior, y se va al llenar el que faltaba", () => {
    const el = mount();
    // El paso que sigue se ve «--:--»; los de después, vacíos.
    expect(cellEl(el, 0, 2).textContent).toBe("--:--");
    expect(cellEl(el, 0, 3).textContent).toBe("");
    key(el, "End");
    key(el, "F2");
    type(el, "15:00");
    expect(cellEl(el, 0, 2).textContent).toBe("Faltante");
    expect(cellEl(el, 0, 2).classList.contains("is-missing")).toBe(true);
    key(el, "ArrowUp");
    key(el, "ArrowLeft");
    key(el, "F2");
    // Faltante es lo que se ve, no el valor: el campo abre vacío.
    expect(input(el).value).toBe("");
    type(el, "11:20");
    expect(cellEl(el, 0, 2).textContent).toBe("11:20");
    expect(cellEl(el, 0, 2).classList.contains("is-missing")).toBe(false);
  });

  it("una hora anterior a la del paso previo va en ámbar con el motivo", () => {
    const el = mount();
    key(el, "ArrowRight");
    key(el, "ArrowRight");
    key(el, "F2");
    type(el, "06:00");
    const c = cellEl(el, 0, 2);
    expect(c.classList.contains("is-out-of-order")).toBe(true);
    expect(c.title).toBe("Antes de «Primera caja»");
    expect(c.querySelector('.nx-grid__pill[data-tone="warning"]')!.textContent).toBe("06:00");
  });
});

describe("<nx-grid> save()", () => {
  it("guardando → guardado: la celda lo dice y se anuncia", async () => {
    const el = mount();
    let done!: () => void;
    el.addEventListener("nx-grid-change", (e) => void el.save(e.detail.changes, new Promise<void>((r) => (done = r))));
    key(el, "ArrowRight");
    key(el, "ArrowDown");
    key(el, "F2");
    type(el, "800");
    const c = () => cellEl(el, 1, 1);
    expect(c().classList.contains("is-saving")).toBe(true);
    expect(c().getAttribute("aria-busy")).toBe("true");
    expect(el.pendingSaves).toBe(1);
    done();
    await tick();
    expect(c().classList.contains("is-saving")).toBe(false);
    expect(c().classList.contains("is-saved")).toBe(true);
    expect(el.pendingSaves).toBe(0);
    expect(live(el)).toContain("Guardado");
  });

  it("si no se guardó: vuelve al valor anterior, sale del historial y queda en rojo con el motivo", async () => {
    const el = mount();
    let fail!: (e: Error) => void;
    el.addEventListener("nx-grid-change", (e) => void el.save(e.detail.changes, new Promise<void>((_, rej) => (fail = rej))));
    key(el, "ArrowRight");
    key(el, "F2");
    type(el, "830");
    expect(el.rows[0].caja).toBe("08:30");
    expect(el.canUndo).toBe(true);
    fail(new Error("Hora inválida en «first_box_at»"));
    await tick();
    expect(el.rows[0].caja).toBe("07:00");
    expect(el.canUndo).toBe(false);
    const c = cellEl(el, 0, 1);
    expect(c.classList.contains("is-failed")).toBe(true);
    expect(c.classList.contains("is-edited")).toBe(false);
    expect(c.title).toContain("Hora inválida");
    expect(live(el)).toContain("No se guardó: Hora inválida en «first_box_at»");
  });

  it("una celda que se volvió a editar mientras se guardaba no se revierte", async () => {
    const el = mount();
    const fails: ((e: Error) => void)[] = [];
    el.addEventListener("nx-grid-change", (e) => void el.save(e.detail.changes, new Promise<void>((_, rej) => fails.push(rej))));
    key(el, "ArrowRight");
    key(el, "F2");
    type(el, "830");
    key(el, "ArrowUp");
    key(el, "F2");
    type(el, "845");
    fails[0](new Error("caído"));
    await tick();
    expect(el.rows[0].caja).toBe("08:45");
  });
});

describe("<nx-grid> horas en su proceso", () => {
  const STEPS: GridColumn[] = [
    { key: "finca", label: "Finca" },
    { key: "caja", label: "Primera caja", type: "time", editable: true, sequence: "empaque" },
    { key: "pallet", label: "Primer pallet", type: "time", editable: true, sequence: "empaque" },
    { key: "ultima", label: "Última caja", type: "time", editable: true, sequence: "empaque" },
    { key: "avance", label: "Avance", type: "timeline", sequence: "empaque" },
  ];
  const mountSteps = () => {
    document.body.innerHTML = "<nx-grid></nx-grid>";
    const el = document.querySelector("nx-grid")!;
    el.columns = STEPS;
    el.rows = [
      { id: "1", finca: "Agua Fría", caja: "06:05", pallet: "06:31", ultima: null },
      { id: "2", finca: "Zacapa", caja: null, pallet: null, ultima: null },
      { id: "3", finca: "Burdeos", caja: "05:50", pallet: "06:20", ultima: "13:40" },
    ];
    return el;
  };
  // Sin popover (happy-dom) el recuadro va en `body`.
  const pop = (_el: NxGrid) => document.querySelector<HTMLElement>(".nx-grid__time")!;
  const write = (el: NxGrid, text: string) => {
    const i = input(el);
    i.value = text;
    i.dispatchEvent(new Event("input"));
  };

  it("la columna `timeline` dice cómo va el proceso y cambia al editar; por ella se filtra", () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 7, 14, 35), toFake: ["Date"] });
    const el = mountSteps();
    expect(el.rows.map((r) => r.avance)).toEqual(["live", "idle", "done"]);
    const line = cellEl(el, 0, 4);
    expect(line.classList.contains("is-timeline")).toBe(true);
    expect(line.querySelectorAll(".nx-grid__tl-dot").length).toBe(2);
    expect(line.getAttribute("aria-label")).toBe("En curso · Primera caja 06:05 · Primer pallet 06:31");
    expect(cellEl(el, 2, 4).querySelector(".nx-grid__tl")!.getAttribute("data-state")).toBe("done");
    // Los estados llevan nombre y tono (los de la tabla, si la app no los da).
    expect(el.columns[4].options?.map((o) => o.value)).toEqual(["idle", "live", "done", "review"]);
    key(el, "ArrowRight");
    key(el, "ArrowRight");
    key(el, "ArrowRight");
    key(el, "2");
    type(el, "2");
    expect(el.rows[0].ultima).toBe("14:00");
    expect(el.rows[0].avance).toBe("done");
    expect(cellEl(el, 0, 4).querySelector(".nx-grid__tl-dot.is-new")).not.toBeNull();
    el.filters = [{ key: "avance", op: "in", values: ["done"] }];
    expect(el.count).toBe(2);
  });

  it("cada paso dice en su cabecera cuántas filas lo tienen, y se mueve al escribir", () => {
    const el = mountSteps();
    const of = (c: number) => el.querySelectorAll<HTMLElement>(".nx-grid__th")[c].querySelector(".nx-grid__step-of")!.textContent;
    expect([of(1), of(2), of(3)]).toEqual(["2/3", "2/3", "1/3"]);
    expect(el.querySelectorAll(".nx-grid__th")[4].querySelector(".nx-grid__tl-axis")).not.toBeNull();
    key(el, "ArrowDown");
    key(el, "ArrowRight");
    key(el, "6");
    type(el, "6");
    expect(of(1)).toBe("3/3");
    expect(el.querySelectorAll(".nx-grid__th")[1].querySelector(".nx-grid__step-n")!.classList.contains("is-full")).toBe(true);
  });

  it("el recuadro bajo la celda dice qué hora se entendió y por qué, con la regla del día", () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 7, 14, 35), toFake: ["Date"] });
    const el = mountSteps();
    key(el, "ArrowRight");
    key(el, "ArrowRight");
    key(el, "ArrowRight");
    key(el, "2");
    write(el, "2");
    const p = pop(el);
    expect(p.hasAttribute("data-open")).toBe(true);
    expect(p.querySelector(".nx-grid__time-ctx")!.textContent).toBe("Agua Fría · 3. Última caja");
    expect(p.querySelector(".nx-grid__time-read strong")!.textContent).toBe("14:00");
    expect(p.querySelector(".nx-grid__time-note")!.textContent).toBe("Se tomó de la tarde: va después de «Primer pallet» (06:31).");
    expect(p.querySelector(".nx-grid__time-note")!.getAttribute("data-tone")).toBe("inferred");
    // Los otros dos pasos en la regla, la hora escrita y la de ahora.
    expect(p.querySelectorAll(".nx-grid__time-dot").length).toBe(2);
    expect(p.querySelector<HTMLElement>(".nx-grid__time-me")!.hidden).toBe(false);
    expect(input(el).getAttribute("aria-describedby")).toContain("time-note");
    write(el, "+20");
    expect(p.querySelector(".nx-grid__time-read strong")!.textContent).toBe("06:51");
    expect(p.querySelector(".nx-grid__time-note")!.textContent).toBe("20 min después de «Primer pallet» (06:31).");
    write(el, "aho");
    expect(p.dataset.state).toBe("empty");
    expect(input(el).hasAttribute("aria-invalid")).toBe(false);
    write(el, "25:00");
    expect(p.dataset.state).toBe("bad");
    // «Dejar vacía» solo si la celda tenía hora; «Ahora» guarda la hora del reloj.
    expect(p.querySelector<HTMLElement>('[data-time="clear"]')!.hidden).toBe(true);
    expect(p.querySelector('[data-time="now"]')!.textContent).toBe("Ahora · 14:35");
    p.querySelector<HTMLElement>('[data-time="now"]')!.click();
    expect(el.rows[0].ultima).toBe("14:35");
    expect(p.hasAttribute("data-open")).toBe(false);
    expect(input(el)).toBeNull();
  });

  it("pegar una fila de horas: lo pegado antes cuenta como paso anterior", () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 7, 14, 35), toFake: ["Date"] });
    const el = mountSteps();
    key(el, "ArrowDown");
    key(el, "ArrowRight");
    const paste = new DataTransfer();
    paste.setData("text/plain", "6:40\t7:05\t1:20\r\n");
    scroll(el).dispatchEvent(new ClipboardEvent("paste", { clipboardData: paste, bubbles: true, cancelable: true }));
    expect([el.rows[1].caja, el.rows[1].pallet, el.rows[1].ultima]).toEqual(["06:40", "07:05", "13:20"]);
    expect(el.rows[1].avance).toBe("done");
  });

  it("Ctrl+: sobre un rango llena solo las celdas vacías", () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 7, 14, 35), toFake: ["Date"] });
    const el = mountSteps();
    key(el, "ArrowRight");
    key(el, "ArrowRight");
    key(el, "ArrowRight");
    key(el, "ArrowDown", { shiftKey: true });
    key(el, ":", { ctrlKey: true, shiftKey: true });
    expect([el.rows[0].ultima, el.rows[1].ultima]).toEqual(["14:35", "14:35"]);
    key(el, "ArrowLeft", { shiftKey: true });
    key(el, ":", { ctrlKey: true, shiftKey: true });
    // «06:31» de la primera fila no se pisa.
    expect([el.rows[0].pallet, el.rows[1].pallet]).toEqual(["06:31", "14:35"]);
  });

  it("junto a deshacer se ve cómo va el guardado", async () => {
    const el = mountSteps();
    let done!: () => void;
    el.addEventListener("nx-grid-change", (e) => void el.save(e.detail.changes, new Promise<void>((r) => (done = r))));
    key(el, "ArrowDown");
    key(el, "ArrowRight");
    key(el, "6");
    type(el, "6");
    const note = el.querySelector<HTMLElement>(".nx-grid__save-note")!;
    expect([note.hidden, note.textContent]).toEqual([false, "Guardando…"]);
    done();
    await tick();
    expect([note.hidden, note.textContent, note.dataset.state]).toEqual([false, "Guardado", "saved"]);
  });
});
