// El catálogo de Lucide (`nx32-elements/icons/lucide`, generado por scripts/gen-icons.mjs) contra
// la fuente: un export por cada ícono VIGENTE, con el nombre de `iconExportName`, y ni alias ni
// retirados. Un nombre viejo que funciona por alias deja dos maneras de escribir el mismo ícono, y
// la que sobra desaparece en una versión de Lucide sin aviso.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import * as catalog from "../src/icons/lucide-catalog";
import { iconExportName, lucide } from "../src/icons/index";

const require = createRequire(import.meta.url);
const set = JSON.parse(readFileSync(require.resolve("@iconify-json/lucide/icons.json"), "utf8")) as {
  icons: Record<string, { body: string; hidden?: boolean }>;
  aliases?: Record<string, { parent: string }>;
};
const version = JSON.parse(readFileSync(require.resolve("@iconify-json/lucide/package.json"), "utf8")).version as string;
const current = Object.keys(set.icons).filter((n) => !set.icons[n].hidden);
const all = catalog as unknown as Record<string, string>;

describe("catálogo de Lucide", () => {
  it("un export por cada ícono vigente, con el nombre de iconExportName", () => {
    expect(Object.keys(all).length).toBe(current.length);
    for (const n of current) expect(typeof all[iconExportName(n)], n).toBe("string");
  });

  it("ni alias ni retirados: los exports son exactamente los de los vigentes", () => {
    const exports = new Set(current.map(iconExportName));
    expect(new Set(Object.keys(all))).toEqual(exports);
    const old = [...Object.keys(set.aliases ?? {}), ...Object.keys(set.icons).filter((n) => set.icons[n].hidden)];
    expect(old.length).toBeGreaterThan(0);
    // Un nombre viejo sólo «tiene» export si coincide con el de un vigente (el alias `arrow-down-01` y
    // `arrow-down-0-1` dan los dos `ArrowDown01`): ese export es el del vigente.
    for (const n of old) if (!exports.has(iconExportName(n))) expect(all[iconExportName(n)], n).toBeUndefined();
  });

  it("iconExportName: PascalCase, también con dígitos y con palabras reservadas", () => {
    expect(iconExportName("chart-column")).toBe("ChartColumn");
    expect(iconExportName("grid-2x2")).toBe("Grid2x2");
    expect(iconExportName("package")).toBe("Package");
    expect(all.Package).toBeTypeOf("string");
  });

  it("el cuerpo va sin el trazo ni el <svg>: los pone el registro", () => {
    for (const [name, body] of Object.entries(all)) {
      expect(body.startsWith("<svg"), name).toBe(false);
      expect(body, name).not.toContain('stroke="currentColor"');
    }
  });

  it("el juego pequeño (`lucide`) son íconos del catálogo, con el mismo cuerpo", () => {
    for (const [name, body] of Object.entries(lucide)) expect(all[iconExportName(name)], name).toBe(body);
  });

  it("el archivo generado es de la versión instalada de @iconify-json/lucide", () => {
    const src = readFileSync("src/icons/lucide-catalog.ts", "utf8");
    expect(src).toContain(`@iconify-json/lucide ${version}: ${current.length} íconos vigentes`);
  });
});
