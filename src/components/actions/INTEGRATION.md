# `<nx-actions>`: integración

Las acciones de un registro, una debajo de otra: cada una es un `<nx-button>` y, debajo, una línea
que dice qué hace. Es la pestaña «Acciones» de una ficha lateral (`<nx-dialog mode="panel">`), la
que antes cada app armaba con su propia lista.

Archivos: `actions.ts` (el elemento), `types.ts`, `actions.css` (importa `button.css`), `index.ts`.
Pruebas: `test/actions.dom.test.ts`. Solid: `src/solid/actions.tsx`. Galería: `#/drawer`, pestaña
«Acciones» de la ficha.

## Acciones

`items`: `{id, label, description?, icon?, danger?, disabled?, href?, newTab?, download?}`. Sin
`id` o sin `label` se descarta; un `id` repetido se queda con la primera.

- **Botón** (sin `href`): emite `nx-actions-action` `{id, item}` (burbujea; no cancelable). La app
  hace lo suyo (confirmar, pedir, avisar con `nxToast`) y pone `busy` mientras tanto.
- **Enlace** (`href`): `<nx-button href>` por dentro, un `<a>` de verdad; `newTab` abre en otra
  pestaña (`rel="noopener noreferrer"`) y `download` descarga (un texto es el nombre del archivo).
  No emite nada.
- `danger`: el botón en rojo (`variant="danger"`). `disabled`: apagado.

## `busy`

`busy="<id>"`: esa acción muestra que espera (el spinner de `<nx-button busy>`) y las demás se
apagan hasta que se quite; el elemento lleva `aria-busy="true"`. Un `id` que no está en la lista no
apaga nada. Los nodos se conservan por `id` al repintar: el foco sigue en el botón que se pulsó.

## BDUI

`Actions: "actions"` en `src/bdui.ts`. Props: `items`, `busy`, `labels`.

## Peso

| Pieza | Presupuesto |
|---|---|
| `dist/actions.js` (con `<nx-button>` y el núcleo) | 7,5 KB |
| `dist/actions.css` (con `button.css`) | 4 KB |
