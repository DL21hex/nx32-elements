// Genera los íconos de Lucide desde @iconify-json/lucide (licencia ISC). Se ejecuta a mano
// (`node scripts/gen-icons.mjs`) al cambiar la lista o subir @iconify-json/lucide; los archivos
// generados se versionan.
//
// - src/icons/lucide.ts: un juego pequeño (`lucide`, un objeto) para probar o para una app chica.
// - src/icons/lucide-catalog.ts: el catálogo completo, un export por ícono
//   (`nx32-elements/icons/lucide`). Un bundler se queda solo con los que la app importa.
//
// Sólo los nombres VIGENTES: ni alias (`set.aliases`) ni retirados (`hidden`). Un nombre viejo que
// funciona por alias deja dos maneras de escribir el mismo ícono, y la que sobra desaparece en
// una versión de Lucide sin aviso.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const set = JSON.parse(readFileSync(require.resolve("@iconify-json/lucide/icons.json"), "utf8"));
const version = JSON.parse(readFileSync(require.resolve("@iconify-json/lucide/package.json"), "utf8")).version;

const NAMES = [
  "house", "layout-dashboard", "users", "user", "settings", "chart-column", "trending-up",
  "shopping-cart", "package", "truck", "warehouse", "receipt", "wallet", "file-text", "folder",
  "clipboard-list", "calendar", "inbox", "bell", "shield", "shield-user", "factory", "hard-hat",
  "utensils-crossed", "map-pin", "building-complex", "circle-question-mark", "log-out", "smartphone", "keyboard", "upload",
  "shield-alert", "scale", "printer", "pen-line", "calendar-range", "list-checks", "mic", "message-circle", "clipboard-check", "repeat", "loader", "layout-grid", "panel-right",
];

// Los atributos de trazo van una sola vez en el <svg> que arma el registro, no en cada path.
const STROKE = ' fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"';

/** Los vigentes, en orden alfabético. */
const CURRENT = Object.keys(set.icons)
  .filter((n) => !set.icons[n].hidden)
  .sort();
const isCurrent = new Set(CURRENT);

function body(name) {
  if (!isCurrent.has(name)) {
    const parent = set.aliases?.[name]?.parent;
    throw new Error(`«${name}» no es un ícono vigente de lucide${parent ? ` (es un alias de «${parent}»)` : ""}`);
  }
  const icon = set.icons[name];
  if ((icon.width ?? set.width ?? 24) !== 24 || (icon.height ?? set.height ?? 24) !== 24) throw new Error(`«${name}» no mide 24×24`);
  let b = icon.body;
  const g = `<g${STROKE}>`;
  if (b.startsWith(g) && b.endsWith("</g>")) b = b.slice(g.length, -4);
  return b.replaceAll(STROKE, "");
}

/** La misma regla que `iconExportName` (src/icons/name.ts): `chart-column` → `ChartColumn`. */
const exportName = (name) => name.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");

const HEADER = `// Generado por scripts/gen-icons.mjs — no editar a mano.
// Íconos de Lucide (https://lucide.dev), licencia ISC: Copyright (c) Lucide Contributors.`;

// El juego pequeño.
writeFileSync(
  new URL("../src/icons/lucide.ts", import.meta.url),
  `${HEADER}
export const lucide: Record<string, string> = {
${NAMES.map((n) => `  ${JSON.stringify(n)}: ${JSON.stringify(body(n))},`).join("\n")}
};
`,
);

// El catálogo.
const seen = new Map();
for (const n of CURRENT) {
  const e = exportName(n);
  if (seen.has(e)) throw new Error(`«${n}» y «${seen.get(e)}» dan el mismo export (${e})`);
  seen.set(e, n);
}
writeFileSync(
  new URL("../src/icons/lucide-catalog.ts", import.meta.url),
  `${HEADER}
// @iconify-json/lucide ${version}: ${CURRENT.length} íconos vigentes (sin alias ni retirados).
//
// Un export por ícono, con el nombre de Lucide en PascalCase (\`chart-column\` → \`ChartColumn\`,
// \`iconExportName\`). El valor es el cuerpo del SVG, listo para \`registerIcons\`:
//   import { House, ChartColumn } from "nx32-elements/icons/lucide";
//   registerIcons({ house: House, "chart-column": ChartColumn });
${CURRENT.map((n) => `export const ${exportName(n)} = ${JSON.stringify(body(n))};`).join("\n")}
`,
);
console.log(`${NAMES.length} íconos → src/icons/lucide.ts; ${CURRENT.length} → src/icons/lucide-catalog.ts`);
