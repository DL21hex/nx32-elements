# `<nx-form>`: integración

Un formulario entero desde un esquema JSON (`sections` o `fields`): cada campo es un `<nx-field>`
con su control (montos y números con `<nx-number>`; listas largas, con `search` o `source`, con
`<nx-select>`; los dos se cargan aparte, solo si el esquema los usa). Filas (`rows`), condiciones
(`when`), lo habitual de una opción (`fills`), llenar desde afuera con origen (`fill`, `undo`),
validación al salir o al enviar, avisos con arreglo, índice de secciones, pie con lo que falta,
borrador en el navegador (`draft`) y lectura (`mode="read"`).

Las fuentes lo llenan con `fill()` por el protocolo de `src/core/fill.ts` (`fillTarget`):
`<nx-paste-fill>` (envolviéndolo o con `for`), `<nx-scan field for>` y `<nx-doc-capture for>`.
Pruebas: `test/form.sources.dom.test.ts`.

Archivos: `form.ts` (el elemento), `logic.ts` (sin DOM: limpiar el esquema, condiciones, validación,
texto de lectura), `types.ts`, `form.css` (importa `field.css`), `index.ts`. Pruebas:
`test/form.logic.test.ts` y `test/form.dom.test.ts` (también la demo de la galería). Galería: página
«Formularios» (`gallery/demo-form.ts`).

## BDUI

`Form: "form"` en el registro de `src/bdui.ts`. `sections`, `fields`, `values`, `errors`,
`warnings`, `hints` y `labels` aceptan el objeto o su JSON. Ninguna regla es una función: lo que
necesita al negocio lo calcula la app y lo devuelve con `fill()` y `hints`. Los textos del esquema
van siempre como texto (nunca HTML).

## Peso

| Pieza | Tamaño (min + gzip) | Referencia |
|---|---|---|
| `dist/form.js` (con `<nx-field>` y el núcleo; `<nx-number>` y `<nx-select>` con `import()`) | 17,75 KB | 18 KB |
| `dist/form.css` (con `field.css`) | 3,47 KB | 3,75 KB |
