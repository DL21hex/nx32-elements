// @vitest-environment happy-dom
// La espera común (core/wait.ts, 0.18.0).
import { describe, expect, it } from "vitest";
import { WAIT_DELAY, WAIT_MIN, waitEl, waitLeft, waitText } from "../src/core/wait";

describe("waitEl", () => {
  it("la línea, la trama y la frase; con frase se anuncia, sin ella no", () => {
    const w = waitEl("Cargando empleados…");
    expect(w.className).toBe("nx-wait");
    expect(w.getAttribute("role")).toBe("status");
    expect(w.querySelector(".nx-wait__thread")!.getAttribute("aria-hidden")).toBe("true");
    expect(w.querySelector(".nx-wait__dots .nx-wait__say")!.textContent).toBe("Cargando empleados…");
    expect(waitEl().hasAttribute("role")).toBe(false);
    expect(waitEl().querySelector(".nx-wait__say")).toBeNull();
    expect(waitEl("Cargando…", false).hasAttribute("role")).toBe(false);
  });

  it("waitText cambia la frase en su lugar", () => {
    const w = waitEl("Uno");
    const say = w.querySelector(".nx-wait__say > span");
    waitText(w, "Dos");
    expect(w.querySelector(".nx-wait__say > span")).toBe(say);
    expect(w.textContent).toBe("Dos");
  });
});

describe("waitLeft", () => {
  it("0 si no llegó a verse o si ya se vio lo mínimo; si no, lo que falta", () => {
    expect(waitLeft(0, WAIT_DELAY - 1)).toBe(0);
    expect(waitLeft(0, WAIT_DELAY)).toBe(0);
    expect(waitLeft(0, WAIT_DELAY + 100)).toBe(WAIT_MIN - 100);
    expect(waitLeft(0, WAIT_DELAY + WAIT_MIN)).toBe(0);
    expect(waitLeft(1000, 1000 + WAIT_DELAY + 1)).toBe(WAIT_MIN - 1);
  });
});
