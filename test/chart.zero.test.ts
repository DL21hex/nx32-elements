// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { chartValue, niceTicks, shareText } from "../src/core/chart";
import { formatZeroSafe, nxFormat } from "../src/core/locale";
import { statValue } from "../src/components/stats/stats";
import { pctSign, pctText, pctValue } from "../src/components/trend/logic";

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

describe("un negativo que se redondea a cero tampoco lleva signo", () => {
  it("formatZeroSafe: según los decimales del formateador (un porcentaje, dos más)", () => {
    const two = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
    expect(formatZeroSafe(two, -0.004)).toBe("0");
    expect(formatZeroSafe(two, -0.005)).toBe("-0,01");
    expect(formatZeroSafe(two, -0.006)).toBe("-0,01");
    expect(formatZeroSafe(two, -3)).toBe("-3");
    const pct = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 1 });
    expect(formatZeroSafe(pct, -0.0004)).not.toMatch(minus);
    expect(formatZeroSafe(pct, -0.0006)).toMatch(minus);
    // Con cifras significativas no se adivina el redondeo: solo -0.
    const sig = new Intl.NumberFormat("es-CO", { maximumSignificantDigits: 2 });
    expect(formatZeroSafe(sig, -0)).toBe("0");
    expect(formatZeroSafe(sig, -0.0001)).toMatch(minus);
  });

  it("chartValue y nxFormat", () => {
    expect(chartValue(-0.004, { locale: "es-CO" })).toBe("0");
    expect(chartValue(-0.004, { locale: "es-CO", decimals: 2 })).toBe("0,00");
    expect(chartValue(-0.04, { locale: "es-CO", short: true })).toBe("0");
    expect(chartValue(-0.0004, { format: "percent", locale: "es-CO" })).not.toMatch(minus);
    expect(chartValue(-0.004, { format: "percent", locale: "es-CO", decimals: 0 })).not.toMatch(minus);
    expect(chartValue(-0.004, { format: "money", currency: "COP", locale: "es-CO" })).not.toMatch(minus);
    expect(chartValue(-0.04, { format: "money", currency: "COP", locale: "es-CO", short: true })).not.toMatch(minus);
    expect(chartValue(-0.004, { format: "money", locale: "es-CO" })).toBe("$ 0");
    expect(shareText(-0.001, 10, "es-CO")).not.toMatch(minus);
    expect(chartValue(-0.006, { locale: "es-CO" })).toBe("-0,01");
    expect(nxFormat("en-US").money(-0.004, { currency: "USD" })).toBe("$0");
  });

  it("nx-stats: la cifra en porcentaje", () => {
    expect(statValue({ label: "a", value: -0.0004, format: "percent" }, "es-CO")).not.toMatch(minus);
    expect(statValue({ label: "a", value: -0.004 }, "es-CO")).toBe("0");
  });

  it("nx-trend: «+0 %» y «−0 %» son «0 %»; un valor en % conserva su signo", () => {
    expect(pctText(-0.0001)).toBe("0 %");
    expect(pctText(0.0004)).toBe("0 %");
    expect(pctText(-0.0005)).toBe("−0,1 %");
    expect(pctSign(-0.0001)).toBe(0);
    expect(pctSign(-0.01)).toBe(-1);
    expect(pctSign(Number.NaN)).toBe(0);
    expect(pctValue(-0.052)).toBe("-5,2 %");
    expect(pctValue(-0.18)).toBe("-18 %");
    expect(pctValue(0.25, "en-US")).toBe("25 %");
    expect(pctValue(-0.0001)).toBe("0 %");
    expect(pctValue(-0)).toBe("0 %");
  });
});
