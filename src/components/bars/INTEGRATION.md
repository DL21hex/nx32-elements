# `<nx-bars>`: integración

Barras por categoría: horizontales (una lista con nombre · valor · acumulado y la barra debajo) o columnas, simples o apiladas por serie (`series` + `parts`, paleta categórica u `ordinal`). `limit` resume las que sobran; `cumulative` agrega el Pareto como texto; `reference` es una línea punteada. Con `dimension`, cada barra es un botón con `data-nx-filter` (filtra un `<nx-board>`); con `selectable` o `dimension`, emite `nx-bars-select`.

Archivos: `bars.ts`, `logic.ts` (limpiar, escala, tope, acumulado), `types.ts`, `bars.css`, `index.ts`. Pruebas: `test/bars.logic.test.ts`, `test/bars.dom.test.ts`. Usa el núcleo de gráficos `src/core/chart.ts` (formato, colores por `data-nx-slot`, marcas del tablero, `ChartTip`) y los tokens `--nx-chart-*` de `src/styles/tokens.css`. Galería: `#/board`.

## En nx32

Dentro de un `<nx-board-panel dimension="…">`, los datos del gráfico se piden con `panel.filters` (los del tablero menos los de su dimensión) y se vuelven a pedir con `nx-board-change`.

## BDUI

`Bars: "bars"` en `src/bdui.ts`. Todas sus props son JSON.

## Peso

| Pieza | Tamaño (min + gzip) | Referencia |
|---|---|---|
| `dist/bars.js` (con el núcleo) | 5,86 KB | 6 KB |
| `dist/bars.css` | 1,22 KB | 1,5 KB |
