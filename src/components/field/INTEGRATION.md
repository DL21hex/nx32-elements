# `<nx-field>`: integración

El campo de la casa. Envuelve un control (un `<input>`, `<select>` o `<textarea>` nativo,
`<nx-number>`, `<nx-select>`, `<nx-date-range>`… o un grupo de radios o casillas) sin moverlo y le pone
la etiqueta, «Opcional», el chip de origen y una sola línea debajo (error, aviso con su botón o
ayuda), con la accesibilidad conectada. Con `text`, se lee. Trae también las clases de los controles
(`.nx-input`, `.nx-check`, `.nx-choices`, `.nx-segmented`) y la rejilla `.nx-form-grid`.

Archivos: `field.ts`, `types.ts`, `field.css`, `index.ts`. Pruebas: `test/field.dom.test.ts`.
Galería: página «Formularios» (`gallery/demo-form.ts`).

## BDUI

No está en el registro: lo suyo es el control que envuelve, y un nodo BDUI no trae hijos. Un
formulario desde el backend usa `Form` (`<nx-form>`), que pinta sus `<nx-field>`.

## Peso

| Pieza | Tamaño (min + gzip) | Referencia |
|---|---|---|
| `dist/field.js` (con el núcleo) | 3,94 KB | 4 KB |
| `dist/field.css` | 1,90 KB | 2 KB |
