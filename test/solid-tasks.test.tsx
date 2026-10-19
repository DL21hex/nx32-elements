// `<Tasks>` de Solid: las props llegan al elemento (`prop:` para los datos, `attr:` y `bool:` para lo
// demás) y `settle` se alcanza con `ref`, la forma de los demás envoltorios.
import { afterEach, describe, expect, it } from "vitest";
import { render } from "solid-js/web";
import { createSignal } from "solid-js";
import { Tasks, type NxTasks, type TaskItem, type TasksCommitDetail } from "../src/solid/tasks";

let dispose = () => {};
afterEach(() => {
  dispose();
  document.body.innerHTML = "";
});

describe("<Tasks> (Solid)", () => {
  it("pasa los datos, los atributos y los eventos; settle con ref", async () => {
    const root = document.body.appendChild(document.createElement("div"));
    const commits: TasksCommitDetail[] = [];
    let el!: NxTasks;
    const [items, setItems] = createSignal<TaskItem[]>([{ id: "a", title: "Revisar la cotización", due: "2026-10-19" }]);
    dispose = render(
      () => (
        <Tasks
          ref={el}
          items={items()}
          links={[{ id: "l", title: "OC-2291", kind: "Firma", action: "Firmar", href: "/f" }]}
          requests={[{ id: "r", title: "Cotizar", people: [{ name: "Ana" }] }]}
          heading="Tu día"
          headingLevel={3}
          today="2026-10-19"
          peopleSource="/api/personas"
          moreHref="/pendientes"
          moreLabel="Ver todos los pendientes"
          optionsHref="/pendientes/nueva"
          undo={0}
          labels={{ add: "Anotar" }}
          onCommit={(e) => commits.push(e.detail)}
        />
      ),
      root,
    );
    expect(el.localName).toBe("nx-tasks");
    expect(el.getAttribute("heading-level")).toBe("3");
    expect(el.getAttribute("people-source")).toBe("/api/personas");
    expect(el.hasAttribute("voice")).toBe(false);
    expect(el.querySelector(".nx-tasks__heading")!.localName).toBe("h3");
    expect(el.querySelector(".nx-tasks__add")!.textContent).toBe("Anotar");
    expect(el.querySelector('.nx-tasks__row[data-id="a"]')).toBeTruthy();
    expect(el.querySelector('.nx-tasks__row[data-id="l"]')).toBeTruthy();
    expect(el.querySelector(".nx-tasks__foot a")!.textContent).toBe("Ver todos los pendientes");
    el.querySelector<HTMLButtonElement>('.nx-tasks__row[data-id="a"] .nx-tasks__check')!.click();
    expect(commits).toEqual([{ key: expect.any(String), type: "done", id: "a", done: true }]);
    expect(el.settle(commits[0].key, {})).toBe(true);
    // Datos nuevos desde la señal: la marca confirmada se sostiene hasta que la app la refleje.
    setItems([{ id: "a", title: "Revisar la cotización", due: "2026-10-19" }, { id: "b", title: "Otra" }]);
    expect(el.items.find((t) => t.id === "a")?.done).toBe(true);
    expect(el.querySelector('.nx-tasks__row[data-id="b"]')).toBeTruthy();
  });
});
