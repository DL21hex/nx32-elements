// `<Award>` de Solid tal como lo usa una app (nx32): los datos por props, una adjudicación guardada
// por `value`, el borrador por `onChange` y el guardado con `wait()` en `onSubmit`.
import { afterEach, describe, expect, it } from "vitest";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { Award, type AwardChangeDetail, type AwardSubmitDetail, type NxAward } from "../src/solid/award";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
let dispose = () => {};
afterEach(() => {
  dispose();
  document.body.innerHTML = "";
});

const SUPPLIERS = [
  { id: "1", name: "Ferrex" },
  { id: "2", name: "Induma" },
];
const ITEMS = [{ id: "10", name: "Tubo", qty: 100, unit: "und" }];
const QUOTES = [
  { item: "10", supplier: "1", price: 1000, offered: 60 },
  { item: "10", supplier: "2", price: 1100 },
];
const ADVICE = [{ type: "recommend" as const, item: "10", allocations: [{ supplier: "1", qty: 60 }, { supplier: "2", qty: 40 }], ranking: [] }, { type: "done" as const }];

describe("<Award> de Solid", () => {
  it("pasa los datos, avisa los cambios y guarda con wait()", async () => {
    const changes: AwardChangeDetail[] = [];
    const sent: AwardSubmitDetail[] = [];
    let finish!: () => void;
    const host = document.createElement("div");
    document.body.append(host);
    dispose = render(
      () => (
        <Award
          suppliers={SUPPLIERS}
          items={ITEMS}
          quotes={QUOTES}
          advice={ADVICE}
          currency="COP"
          locale="es-CO"
          requireMotive
          motive="Reparto propuesto"
          timeout={5000}
          onChange={(e) => changes.push(e.detail)}
          onSubmit={(e) => {
            sent.push(e.detail);
            e.detail.wait(new Promise<void>((r) => (finish = r)));
          }}
        />
      ),
      host,
    );
    const el = host.querySelector("nx-award") as NxAward;
    await tick();
    expect(el.hasAttribute("require-motive")).toBe(true);
    expect(el.timeout).toBe(5000);
    expect(el.value).toEqual([
      { item: "10", supplier: "1", qty: 60 },
      { item: "10", supplier: "2", qty: 40 },
    ]);
    el.querySelectorAll<HTMLElement>("td")[1].click();
    await tick();
    expect(changes.at(-1)).toMatchObject({ kind: "pick", item: "10", value: [{ item: "10", supplier: "2", qty: 100 }] });
    expect(el.submit()).toBe(true);
    expect(el.submit()).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ motive: "Reparto propuesto", followed: false, value: [{ item: "10", supplier: "2", qty: 100 }] });
    finish();
    await tick();
    expect(el.submitting).toBe(false);
    expect(el.dirty).toBe(false);
  });

  it("una adjudicación cerrada por `value`, en solo lectura, y reactiva", async () => {
    const [value, setValue] = createSignal([{ item: "10", supplier: "1", qty: 60 }]);
    const host = document.createElement("div");
    document.body.append(host);
    dispose = render(() => <Award suppliers={SUPPLIERS} items={ITEMS} quotes={QUOTES} value={value()} readonly />, host);
    const el = host.querySelector("nx-award") as NxAward;
    await tick();
    expect(el.readonly).toBe(true);
    expect(el.value).toEqual([{ item: "10", supplier: "1", qty: 60 }]);
    setValue([{ item: "10", supplier: "2", qty: 100 }]);
    await tick();
    expect(el.value).toEqual([{ item: "10", supplier: "2", qty: 100 }]);
  });
});
