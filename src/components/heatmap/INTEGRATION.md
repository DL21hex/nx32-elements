# `<nx-heatmap>`: integración

Un mapa de calor que es una `<table>`: encabezados de fila y columna, el valor escrito en cada celda y su color en una escala secuencial (`--nx-chart-seq`) o divergente (`--nx-chart-neg` al otro lado de `mid`). La columna final es el `total` de cada fila con su `delta` (`polarity` dice si subir es malo). Con `row-dimension` y `column-dimension`, encabezados y celdas filtran un `<nx-board>`; una sola parada de Tab y las flechas recorren la tabla.

Archivos: `heatmap.ts`, `logic.ts` (limpiar, dominio, intensidad, flechas), `types.ts`, `heatmap.css`, `index.ts`. Pruebas: `test/heatmap.logic.test.ts`, `test/heatmap.dom.test.ts`. Usa el núcleo de gráficos `src/core/chart.ts` (formato, colores por `data-nx-slot`, marcas del tablero, `ChartTip`) y los tokens `--nx-chart-*` de `src/styles/tokens.css`. Galería: `#/board`.

## En nx32

Dentro de un `<nx-board-panel dimension="…">`, los datos del gráfico se piden con `panel.filters` (los del tablero menos los de su dimensión) y se vuelven a pedir con `nx-board-change`.

## BDUI

`Heatmap: "heatmap"` en `src/bdui.ts`. Todas sus props son JSON.

## Peso

| Pieza | Tamaño (min + gzip) | Referencia |
|---|---|---|
| `dist/heatmap.js` (con el núcleo) | 6,00 KB | 6,25 KB |
| `dist/heatmap.css` | 0,96 KB | 1,5 KB |
