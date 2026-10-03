/**
 * El export de `nx32-elements/icons/lucide` que corresponde a un nombre de Lucide: el nombre en
 * PascalCase (`chart-column` → `ChartColumn`, `building-complex` → `BuildingComplex`). PascalCase y no
 * camelCase porque Lucide tiene `delete` y `package`, que no pueden ser nombres de variable. Es la
 * misma regla que usa `scripts/gen-icons.mjs` al generar el catálogo.
 */
export function iconExportName(name: string): string {
  return name
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}
