# `<nx-board>`: integración

Un tablero BI: `<nx-board>` (la grilla, el estado de filtros, los chips y la reserva de datos
sensibles) y `<nx-board-panel>` (cada tarjeta: `span`, título, `slot="actions"`, `dimension`,
`personal`, `busy`). Las marcas son cualquier descendiente con `data-nx-filter`; el tablero no
calcula, avisa con `nx-board-change` y cada panel pide con `panel.filters`.

Archivos: `board.ts` (el tablero), `panel.ts` (el panel), `logic.ts` (los filtros cruzados, sin DOM),
`types.ts`, `board.css`, `index.ts` (registra las dos etiquetas). Pruebas: `test/board.logic.test.ts`
y `test/board.dom.test.ts`. Galería: `#/board` (`gallery/demo-board.ts`). La maqueta de la que sale:
`maquetas/nx-board-incapacidades.html`.

## En nx32

- Cada panel es una consulta del backend con `panel.filters` (los del tablero menos los suyos). Al
  llegar `nx-board-change`, se vuelven a pedir los paneles cuya única dimensión no es la que cambió
  (`changed`); mientras llegan, `busy`.
- Si `reserved` es `true`, no pedir los paneles `personal`: el backend tampoco debe responder datos
  por persona filtrados por una dimensión sensible a un rol sin acceso. La reserva del tablero es
  presentación.

## BDUI

`Board: "board"` y `BoardPanel: "board-panel"` en `src/bdui.ts`. BDUI no pasa hijos: los paneles y
sus gráficos los arma la app.

## Peso

| Pieza | Tamaño (min + gzip) | Referencia |
|---|---|---|
| `dist/board.js` (con el núcleo) | 4,93 KB | 5 KB |
| `dist/board.css` | 1,19 KB | 1,5 KB |
