// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { chartValue, niceTicks, shareText } from "../src/core/chart";
import { nxFormat } from "../src/core/locale";
import { statValue } from "../src/components/stats/stats";

// -0 llega en un JSON como `-0.0` (en Rust, `Iterator::sum` de ningún f64 da -0.0) y
// Intl.NumberFormat lo escribe «-0». Ningún número de un gráfico debe salir con signo.
const minus = /[-−]/;

describe("-0 en los gráficos", () => {
  it("chartValue: número, monto y porcentaje, sin signo", () => {
    for (const locale of ["es-CO", "en-US"]) {
      const out = [
        chartValue(-0, { locale }),
        chartValue(-0, { locale, decimals: 2 }),
        chartValue(-0, { locale, short: true }),
        chartValue(-0, { format: "money", currency: "COP", locale }),
        chartValue(-0, { format: "money", currency: "COP", locale, short: true }),
        chartValue(-0, { format: "money", locale }),
        chartValue(-0, { format: "money", locale, short: true }),
        chartValue(-0, { format: "percent", locale }),
        chartValue(-0, { format: "percent", locale, decimals: 0 }),
      ];
      for (const s of out) {
        expect(s).toMatch(/0/);
        expect(s).not.toMatch(minus);
      }
    }
    expect(chartValue(-0, { locale: "es-CO" })).toBe(chartValue(0, { locale: "es-CO" }));
    expect(chartValue(-0, { format: "percent", locale: "es-CO" })).toBe(chartValue(0, { format: "percent", locale: "es-CO" }));
    expect(chartValue(-0, { format: "money", currency: "COP", locale: "es-CO" })).toBe(chartValue(0, { format: "money", currency: "COP", locale: "es-CO" }));
    // Los negativos de verdad conservan su signo.
    expect(chartValue(-5, { locale: "es-CO" })).toMatch(minus);
  });

  it("shareText: una parte -0 es «0 %»", () => {
    expect(shareText(-0, 10, "es-CO")).toBe(shareText(0, 10, "es-CO"));
    expect(shareText(-0, 10, "es-CO")).not.toMatch(minus);
  });

  it("niceTicks: ningún tick es -0", () => {
    for (const t of [niceTicks(-0, -0, 5, true), niceTicks(-0, 10), niceTicks(-40, -0, 5, true), niceTicks(-0, 1e-320)]) {
      expect(t.some((v) => Object.is(v, -0))).toBe(false);
    }
  });

  it("nxFormat (ejes y tooltips de nx-trend): number, compact y money", () => {
    const f = nxFormat("es-CO");
    for (const s of [f.number(-0), f.compact(-0), f.money(-0, { currency: "COP" }), f.money(-0, { currency: "COP" }, true), f.money(-0, {}), f.money(-0, {}, true)]) {
      expect(s).not.toMatch(minus);
    }
  });

  it("nx-stats: la cifra -0 en número, monto y porcentaje", () => {
    expect(statValue({ label: "a", value: -0 }, "es-CO")).toBe("0");
    expect(statValue({ label: "a", value: -0, format: "money", currency: "COP" }, "es-CO")).not.toMatch(minus);
    expect(statValue({ label: "a", value: -0, format: "percent" }, "es-CO")).not.toMatch(minus);
  });
});
