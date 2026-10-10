// Las hojas por pieza: lo que comparten varios componentes vive en tokens.css (no en la hoja de uno
// de ellos), y los tokens no le ganan a la app por el orden de carga.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokens = readFileSync("src/styles/tokens.css", "utf8");
const pieces = readdirSync("src/components").flatMap((d) =>
  readdirSync(`src/components/${d}`)
    .filter((f) => f.endsWith(".css"))
    .map((f) => [`${d}/${f}`, readFileSync(`src/components/${d}/${f}`, "utf8")] as const),
);
/** Las reglas de primer nivel (sin anidar ni dentro de @media) de una hoja. */
const topLevel = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "").match(/^[^\s@}][^{]*\{/gm) ?? [];

describe("CSS compartido", () => {
  it("tokens.css trae el spinner, su animación y la base de íconos, glifos e iniciales", () => {
    for (const sel of [".nx-spinner {", "@keyframes nx-spin", ".nx-icon--initials {", ":is(.nx-icon, .nx-glyph) svg {", ".nx-sr-only {"]) expect(tokens, sel).toContain(sel);
  });

  it("ninguna hoja de componente redefine esas piezas en su primer nivel", () => {
    const owned = /^(\.nx-spinner|\.nx-icon--initials|\.nx-icon,|\.nx-glyph \{|:is\(\.nx-icon, \.nx-glyph\) svg|\.nx-sr-only)/;
    const bad = pieces.flatMap(([f, css]) => [...topLevel(css).filter((r) => owned.test(r)).map((r) => `${f}: ${r}`), ...(css.includes("@keyframes nx-spin ") ? [`${f}: @keyframes nx-spin`] : [])]);
    expect(bad).toEqual([]);
  });

  it("los tokens y color-scheme van en :where() (la app los sobreescribe en cualquier orden)", () => {
    const roots = topLevel(tokens).filter((r) => /:root|data-nx-palette|data-theme|\.dark|\.light/.test(r));
    expect(roots.length).toBeGreaterThan(2);
    expect(roots.filter((r) => !r.startsWith(":where("))).toEqual([]);
  });
});

describe("el velo del acento", () => {
  const rule = (css: string, sel: string) => css.slice(css.indexOf(sel), css.indexOf("}", css.indexOf(sel)));

  it("es un token de página que sigue a la paleta de la zona", () => {
    expect(rule(tokens, ":where(:root, [data-nx-palette]) {")).toContain("--nx-page-wash: light-dark(transparent,");
  });

  // Pintado en la tabla, lo que va encima del título (la ruta) lo cortaba: lo lleva siempre el
  // contenedor de la página, desde su esquina, haya o no tabla, y se desplaza con él.
  it("lo pinta siempre el contenedor con data-nx-page, no la tabla", () => {
    expect(topLevel(tokens)).toContain("[data-nx-page] {");
    expect(rule(tokens, "[data-nx-page] {")).toContain("var(--nx-page-wash)");
    expect(rule(tokens, "[data-nx-page] {")).toContain("background-attachment: local");
    const own = pieces.filter(([, css]) => /data-nx-page|--nx-page-wash|--nx-grid-wash/.test(css)).map(([f]) => f);
    expect(own).toEqual([]);
  });
});
