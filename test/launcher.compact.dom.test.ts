// @vitest-environment happy-dom
//
// `density="compact"`, `pack`, `typeahead` y `accent`. happy-dom no calcula cajas ni subgrid: el ancho
// de la navegación y `CSS.supports` se simulan; la lista del teléfono y la luz (CSS) se ven en el
// navegador.
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/launcher/index";
import type { LauncherItem, LauncherSelectDetail, NxLauncher } from "../src/components/launcher/index";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  sessionStorage.clear();
});
const tick = () => new Promise((r) => setTimeout(r, 0));

// El inicio de un jefe con equipo en nx32 (3, 6, 2, 1 y 3 tarjetas).
const card = (id: string, section: string, accent: string, label: string, extra: Partial<LauncherItem> = {}): LauncherItem =>
  ({ id, section, accent, label, icon: "file-text", description: `${label}: para qué sirve.`, href: `/${id}`, ...extra }) as LauncherItem;
const HOME: LauncherItem[] = [
  card("certificados", "Documentos laborales", "blue", "Certificados laborales"),
  card("pagos", "Documentos laborales", "blue", "Mis pagos"),
  card("ingresos", "Documentos laborales", "blue", "Ingresos y retenciones"),
  card("cesantias", "Gestión administrativa", "green", "Cesantías"),
  card("permisos", "Gestión administrativa", "green", "Permisos"),
  card("beneficios", "Gestión administrativa", "green", "Beneficios"),
  card("incapacidades", "Gestión administrativa", "green", "Incapacidades"),
  card("vacaciones", "Gestión administrativa", "green", "Vacaciones", { signal: { value: 1, label: "en aprobación", tone: "info" } }),
  card("perfiles", "Gestión administrativa", "green", "Perfiles de cargo"),
  card("vac-equipo", "Mi equipo", "purple", "Vacaciones de mi equipo", { signal: { value: 2, label: "por decidir", tone: "warning" } }),
  card("perm-equipo", "Mi equipo", "purple", "Permisos de mi equipo"),
  card("perfil", "Documentos", "blue", "Mi perfil"),
  card("comida", "Día a día", "green", "Pedir comida", { signal: { label: "Sancocho de gallina", note: "hasta las 10:30", tone: "info" } }),
  card("visita", "Día a día", "green", "Anunciar una visita"),
  card("novedad", "Día a día", "green", "Reportar una novedad"),
];

async function mount(attrs = 'density="compact"', items: LauncherItem[] = HOME): Promise<NxLauncher> {
  document.body.insertAdjacentHTML("beforeend", `<nx-launcher locale="es-CO" ${attrs}></nx-launcher>`);
  const el = [...document.querySelectorAll("nx-launcher")].pop()!;
  el.items = structuredClone(items);
  await tick();
  return el;
}
const nav = (el: NxLauncher) => el.querySelector<HTMLElement>(".nx-launcher__nav")!;
const sections = (el: NxLauncher) => [...el.querySelectorAll<HTMLElement>(".nx-launcher__section")];
const cardEl = (el: NxLauncher, key: string) => el.querySelector<HTMLElement>(`.nx-launcher__card[data-key="${key}"]`)!;
/** El ancho de la navegación (happy-dom no lo calcula; en el prototipo, porque al cambiar un atributo
 *  la navegación se vuelve a crear) y que haya subgrid. */
function width(px: number, sub = true) {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("nx-launcher__nav") ? px : 0;
  });
  // `CSS` de happy-dom es otro objeto en cada acceso: se reemplaza entero.
  vi.stubGlobal("CSS", { supports: (p: string, v?: string) => sub && p === "grid-template-columns" && v === "subgrid" });
}
/** Algo cambia y se vuelve a pintar (las columnas se recalculan al pintar). */
async function relayout(el: NxLauncher) {
  el.toggleAttribute("pack");
  el.toggleAttribute("pack");
  await tick();
}
const key = (k: string, target: Element = document.body) => target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const type = (text: string, target?: Element) => {
  for (const c of text) key(c, target);
};

describe("density=compact", () => {
  it("se refleja en el atributo; 6 columnas como máximo (un número las cambia)", async () => {
    const el = await mount("");
    expect(el.density).toBe("comfortable");
    expect(el.columns).toBe(4);
    el.density = "compact";
    expect(el.getAttribute("density")).toBe("compact");
    expect(el.columns).toBe(6);
    el.columns = 3;
    expect(el.columns).toBe(3);
    el.density = "comfortable";
    expect(el.hasAttribute("density")).toBe(false);
    el.setAttribute("density", "enorme");
    expect(el.density).toBe("comfortable");
  });

  it("título con punto y filete (ocultos al lector); el nombre del título sigue siendo su texto", async () => {
    const el = await mount();
    const h = el.querySelector("h2.nx-launcher__heading")!;
    expect(h.textContent).toBe("Documentos laborales");
    expect(h.querySelector(".nx-launcher__dot")!.getAttribute("aria-hidden")).toBe("true");
    expect(h.querySelector(".nx-launcher__rule")!.getAttribute("aria-hidden")).toBe("true");
    expect(el.querySelector("ul.nx-launcher__grid")!.getAttribute("aria-labelledby")).toBe(h.id);
  });

  it("la flecha → y el chevrón de la fila; cambiar la densidad rehace las tarjetas", async () => {
    const el = await mount();
    const go = cardEl(el, "pagos").querySelector(".nx-launcher__go")!;
    expect(go.querySelector(".nx-launcher__go-card")).not.toBeNull();
    expect(go.querySelector(".nx-launcher__go-row")).not.toBeNull();
    el.density = "comfortable";
    await tick();
    const go2 = cardEl(el, "pagos").querySelector(".nx-launcher__go")!;
    expect(go2.classList.contains("nx-glyph")).toBe(true);
    expect(go2.querySelector(".nx-launcher__go-row")).toBeNull();
  });

  it("la señal lleva su tono (el punto al principio de la línea); info es un tono", async () => {
    const el = await mount();
    const s = cardEl(el, "vac-equipo").querySelector(".nx-launcher__signal")!;
    expect(s.getAttribute("data-tone")).toBe("warning");
    expect(s.querySelector(".nx-launcher__value")!.textContent).toBe("2");
    const food = cardEl(el, "comida").querySelector(".nx-launcher__signal")!;
    expect(food.getAttribute("data-tone")).toBe("info");
    expect(food.querySelector(".nx-launcher__note")!.getAttribute("data-tone")).toBe("info");
    expect(cardEl(el, "pagos").querySelector(".nx-launcher__signal")).toBeNull();
  });

  it("la primera vez entra escalonada (desde visible); sin movimiento, no", async () => {
    const calls: number[] = [];
    const animate = vi.fn(function (this: Element, _k: unknown, o: KeyframeAnimationOptions) {
      calls.push(Number(o.delay));
      return { finished: Promise.resolve() } as unknown as Animation;
    });
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
    try {
      const el = await mount();
      expect(calls.length).toBe(15);
      expect(calls[0]).toBe(0);
      expect(calls[1]).toBeGreaterThan(0);
      // Lo que se vuelve a pintar ya no entra.
      el.items = [...HOME];
      await tick();
      expect(calls.length).toBe(15);
    } finally {
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
    }
  });
});

describe("accent", () => {
  it("la tarjeta y su sección llevan el color; uno desconocido no se pinta", async () => {
    const items = [card("a", "Uno", "purple", "A"), card("b", "Uno", "green", "B"), card("c", "Dos", "rojo", "C"), card("d", "Dos", "teal", "D")];
    const el = await mount('density="compact"', items);
    expect(cardEl(el, "a").dataset.accent).toBe("purple");
    expect(cardEl(el, "c").hasAttribute("data-accent")).toBe(false);
    // La sección: el de su primera tarjeta con uno válido.
    expect(sections(el).map((s) => s.dataset.accent)).toEqual(["purple", "teal"]);
  });

  it("también en la cómoda; cambiar el color de una tarjeta cambia el de su sección", async () => {
    const el = await mount("", [card("a", "Uno", "amber", "A")]);
    expect(cardEl(el, "a").dataset.accent).toBe("amber");
    el.items = [card("a", "Uno", "pink", "A")];
    await tick();
    expect(cardEl(el, "a").dataset.accent).toBe("pink");
    expect(sections(el)[0].dataset.accent).toBe("pink");
  });
});

describe("pack", () => {
  it("una rejilla común: cada sección ocupa las columnas de sus tarjetas y sus listas van con subgrid", async () => {
    const el = await mount('density="compact" pack');
    expect(el.pack).toBe(true);
    width(1260);
    await relayout(el);
    const n = nav(el);
    expect(n.classList.contains("is-packed")).toBe(true);
    expect(n.style.gridTemplateColumns).toContain("repeat(6");
    expect(sections(el).map((s) => s.style.gridColumn)).toEqual(["span 3", "span 6", "span 2", "span 1", "span 3"]);
    // Las listas no llevan columnas en línea: las toma el CSS (subgrid).
    for (const g of el.querySelectorAll<HTMLElement>(".nx-launcher__grid")) {
      expect(g.style.gridTemplateColumns).toBe("");
      expect(g.dataset.cols).toBe("6");
    }
  });

  it("sin pack (o sin subgrid), cada sección es su rejilla, como siempre", async () => {
    const el = await mount('density="compact" pack');
    width(1260, false);
    await relayout(el);
    expect(nav(el).classList.contains("is-packed")).toBe(false);
    expect(sections(el).every((s) => s.style.gridColumn === "")).toBe(true);
    expect(el.querySelector<HTMLElement>(".nx-launcher__grid")!.style.gridTemplateColumns).toContain("repeat(6");
    width(1260);
    el.pack = false;
    await tick();
    expect(nav(el).classList.contains("is-packed")).toBe(false);
    expect(nav(el).style.gridTemplateColumns).toBe("");
  });

  it("la compacta angosta es una lista por sección: no comparte filas", async () => {
    const el = await mount('density="compact" pack');
    width(520);
    await relayout(el);
    expect(nav(el).classList.contains("is-packed")).toBe(false);
    // La cómoda a ese ancho sí comparte (dos columnas de 240).
    el.density = "comfortable";
    await tick();
    expect(nav(el).classList.contains("is-packed")).toBe(true);
    expect(nav(el).style.gridTemplateColumns).toContain("repeat(2");
  });

  it("donde caben 5, van 4 (la de 6 tarjetas no deja 1 sola)", async () => {
    const el = await mount('density="compact" pack');
    width(1050);
    await relayout(el);
    expect(nav(el).style.gridTemplateColumns).toContain("repeat(4");
    expect(sections(el).map((s) => s.style.gridColumn)).toEqual(["span 3", "span 4", "span 2", "span 1", "span 3"]);
  });
});

describe("typeahead", () => {
  it("escribir con el foco en la página filtra sin moverlo y la píldora dice qué abre Enter", async () => {
    const el = await mount('density="compact" typeahead');
    expect(el.typeahead).toBe(true);
    const pill = el.querySelector<HTMLElement>(".nx-launcher__goto")!;
    expect(pill.getAttribute("popover")).toBe("manual");
    expect(pill.hidden).toBe(true);
    expect(el.querySelector("input")).toBeNull();
    const order = [...el.querySelectorAll<HTMLElement>(".nx-launcher__card")].map((c) => c.dataset.key);
    type("vac");
    expect(el.query).toBe("vac");
    expect(pill.hidden).toBe(false);
    expect(pill.querySelector(".nx-launcher__goto-q")!.textContent).toBe("vac");
    const hint = pill.querySelector(".nx-launcher__goto-hint")!;
    expect(hint.getAttribute("aria-live")).toBe("polite");
    expect(hint.textContent).toBe("Enter abre Vacaciones");
    const lit = [...el.querySelectorAll<HTMLElement>(".nx-launcher__card:not(.is-dim)")].map((c) => c.dataset.key);
    expect(lit).toEqual(["vacaciones", "vac-equipo"]);
    expect(cardEl(el, "vacaciones").classList.contains("is-first")).toBe(true);
    // Nada se movió; las secciones sin nada encendido se apagan enteras.
    expect([...el.querySelectorAll<HTMLElement>(".nx-launcher__card")].map((c) => c.dataset.key)).toEqual(order);
    expect(sections(el).map((s) => s.classList.contains("is-dim"))).toEqual([true, false, false, true, true]);
  });

  it("Retroceso borra una letra, Escape todo; un espacio solo cuenta en medio de algo", async () => {
    const el = await mount('density="compact" typeahead');
    key(" ");
    expect(el.query).toBe("");
    type("mi e");
    expect(el.query).toBe("mi e");
    key("Backspace");
    expect(el.query).toBe("mi ");
    key("Escape");
    expect(el.query).toBe("");
    expect(el.querySelector<HTMLElement>(".nx-launcher__goto")!.hidden).toBe(true);
    expect(el.querySelectorAll(".is-dim").length).toBe(0);
    type("zzz");
    expect(el.querySelector(".nx-launcher__goto-hint")!.textContent).toBe("Ningún módulo coincide.");
  });

  it("Enter abre la primera (nx-launcher-select) y lo escrito se borra", async () => {
    const el = await mount('density="compact" typeahead');
    const log: LauncherSelectDetail[] = [];
    el.addEventListener("nx-launcher-select", (e) => {
      e.preventDefault();
      log.push(e.detail);
    });
    type("perm");
    key("Enter");
    expect(log.map((d) => d.item.id)).toEqual(["permisos"]);
    expect(log[0].href).toBe("/permisos");
    expect(el.query).toBe("");
  });

  it("↓ enfoca la primera; desde una tarjeta se sigue escribiendo y Enter es del enlace", async () => {
    const el = await mount('density="compact" typeahead');
    type("equipo");
    key("ArrowDown");
    const link = cardEl(el, "vac-equipo").querySelector<HTMLElement>(".nx-launcher__link")!;
    expect(document.activeElement).toBe(link);
    const log: string[] = [];
    el.addEventListener("nx-launcher-select", (e) => {
      e.preventDefault();
      log.push(e.detail.item.id);
    });
    type(" p", link);
    expect(el.query).toBe("equipo p");
    // Enter sobre el enlace no abre «la primera»: lo hace el enlace (aquí no hay activación nativa).
    key("Enter", link);
    expect(log).toEqual([]);
  });

  it("con el foco en otro campo o en otro control de la página, no escucha", async () => {
    document.body.innerHTML = '<input id="otro"><button id="b">B</button>';
    const el = await mount('density="compact" typeahead');
    const input = document.getElementById("otro")!;
    input.focus();
    type("vac", input);
    expect(el.query).toBe("");
    const b = document.getElementById("b")!;
    b.focus();
    type("vac", b);
    expect(el.query).toBe("");
  });

  it("con el foco en la página, solo el primer launcher con typeahead", async () => {
    const a = await mount('density="compact" typeahead');
    const b = await mount('density="compact" typeahead');
    type("vac");
    expect(a.query).toBe("vac");
    expect(b.query).toBe("");
  });

  it("tocar fuera borra lo escrito; apagar typeahead quita la píldora", async () => {
    const el = await mount('density="compact" typeahead');
    type("vac");
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(el.query).toBe("");
    type("vac");
    el.typeahead = false;
    await tick();
    expect(el.query).toBe("");
    expect(el.querySelector(".nx-launcher__goto")).toBeNull();
    type("vac");
    expect(el.query).toBe("");
  });

  it("con search manda el buscador: no hay píldora y escribir va al campo", async () => {
    const el = await mount('density="compact" typeahead search');
    expect(el.querySelector(".nx-launcher__goto")).toBeNull();
    const input = el.querySelector("input")!;
    key("v");
    expect(document.activeElement).toBe(input);
  });
});
