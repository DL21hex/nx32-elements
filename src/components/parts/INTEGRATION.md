# `<nx-parts>`: integración

Las partes de un todo: una barra al 100 % y, debajo, la lista con monto, regla y porcentaje (el
«Quién paga» del tablero de incapacidades: empresa, EPS, ARL, fondo de pensiones). El orden es el
que llega; más de ocho partes se pliegan en «Otros». Con `dimension`, cada renglón es un botón con
su marca (`data-nx-filter`) y la parte de la barra también: dentro de un `<nx-board>`, filtra.

Archivos: `parts.ts`, `logic.ts` (qué partes se pintan, sin DOM: `shownParts`), `types.ts`,
`parts.css`, `index.ts`. Pruebas: `test/parts.dom.test.ts`. La maqueta de la que sale:
`maquetas/nx-board-incapacidades.html` (panel «Quién paga»).

## En nx32

- Los montos llegan ya calculados por el backend (lo causado por cada pagador con los filtros del
  panel); `format="money"` y `currency="COP"`.
- La regla de cada parte (`note`) es texto de la app («Días 1 y 2 · 66,67 % del salario»).
- Dentro de un `<nx-board-panel dimension="pagador">`, `dimension="pagador"` en el componente y los
  `id` de las partes son los valores de esa dimensión.

## BDUI

`Parts: "parts"` en `src/bdui.ts` (`items`, `labels`, `format`, `currency`, `locale`, `dimension`).

## Peso

| Pieza | Tamaño (min + gzip) | Referencia |
|---|---|---|
| `dist/parts.js` (con el núcleo) | 4,55 KB | 4,75 KB |
| `dist/parts.css` | 0,69 KB | 1,5 KB |
