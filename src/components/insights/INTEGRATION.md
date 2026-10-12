# `<nx-insights>`: integración

«Lectura»: las frases que el tablero calcula con los filtros puestos. Cada una con su marca (un
ícono de 22 px teñido por `tone`: `bad`, `good`, `neutral`), el texto con `**énfasis**` y, si
aplica, una acción.

Archivos: `insights.ts` (el elemento y `emphasis`, sin DOM), `types.ts`, `insights.css`,
`index.ts`. Pruebas: `test/insights.dom.test.ts`. Solid: `src/solid/insights.tsx`. La maqueta de
la que sale: `maquetas/nx-board-incapacidades.html` (panel «Lectura», `renderInsights`).

## Texto

Solo `**así**` se convierte en `<b>`, armando nodos de texto (nunca `innerHTML`); un `**` sin
cerrar o vacío se queda como texto. `emphasis(text)` devuelve los trozos
(`Array<string | {b: string}>`) por si la app quiere pintarlos en otro lado.

Íconos: `up`, `down`, `calendar`, `list`, `season`, `money`, `people`, `info` (por defecto). Son
glifos del componente; no usan el registro de la app.

## Acciones

Igual que `<nx-alerts>`: `href` es un enlace; `filter` un botón con `data-nx-filter` y
`data-nx-label` que filtra el `<nx-board>` que lo contiene; sin ninguno, un botón que avisa.
Todas emiten `nx-insights-action` `{item}` (burbujea, cancelable; cancelado, ni navega ni filtra).

## En nx32

- Las frases las arma el backend (o la app) con los filtros del panel; no ofrecer la acción que
  filtra por la dimensión que ya está filtrada (la maqueta la quita).

## BDUI

`Insights: "insights"` en `src/bdui.ts`. Props: `items`, `labels`, `empty`.
