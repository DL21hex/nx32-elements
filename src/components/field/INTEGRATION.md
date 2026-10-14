# `<nx-field>`: integración

El campo de la casa. Envuelve un control (un `<input>`, `<select>` o `<textarea>` nativo,
`<nx-number>`, `<nx-select>`, `<nx-date-range>`… o un grupo de radios o casillas) sin moverlo y le pone
la etiqueta, «Opcional», el chip de origen y una sola línea debajo (error, aviso con su botón o
ayuda), con la accesibilidad conectada. Con `text`, se lee. Con `link-label` y `link-href`, un
enlace al final, con aspecto de botón secundario pequeño: siempre en otra pestaña (`target="_blank"`,
`rel="noopener noreferrer"`), también en lectura (es un recurso, no una ayuda), con el `href` por
`safeHref` (uno inseguro o un enlace sin texto no se pinta: un aviso en la consola) y nombre accesible
«texto + (se abre en otra pestaña)» (`labels.newTab`). `fieldLink()` lo arma también para el grupo
de filas de `<nx-form>`. Trae también las clases de los controles
(`.nx-input`, `.nx-check`, `.nx-choices`, `.nx-segmented`) y la rejilla `.nx-form-grid`.

Archivos: `field.ts`, `types.ts`, `field.css`, `index.ts`. Pruebas: `test/field.dom.test.ts`.
Galería: página «Formularios» (`gallery/demo-form.ts`).

## BDUI

No está en el registro: lo suyo es el control que envuelve, y un nodo BDUI no trae hijos. Un
formulario desde el backend usa `Form` (`<nx-form>`), que pinta sus `<nx-field>`.

## Peso

| Pieza | Tamaño (min + gzip) | Referencia |
|---|---|---|
| `dist/field.js` (con el núcleo) | 4,37 KB | 4,5 KB |
| `dist/field.css` | 2,07 KB | 2,25 KB |
