# `<nx-form>`: integración

Un formulario entero desde un esquema JSON (`sections` o `fields`): cada campo es un `<nx-field>`
con su control (montos y números con `<nx-number>`; listas largas, con `search` o `source`, con
`<nx-select>`; los dos se cargan aparte, solo si el esquema los usa). Filas (`rows`), un archivo
(`file`: el valor es el `File`, la app lo sube; `accept` y `maxSize` con la lógica de
`<nx-doc-capture>`, `capture/logic.ts`; nunca en una fila ni en el borrador), condiciones
(`when`), un enlace bajo el campo (`link`: `{label, href}`, botón secundario siempre en otra
pestaña, también en lectura; no es un dato), selects que buscan con el valor de otro campo
(`dependsOn`: la URL de búsqueda la arma `dependentSource`, `#syncLinks` la pone en el control con
cada pintado, y `#cascade` vacía a los hijos cuando cambia el padre), selección múltiple
(`multiple`), fechas con días bloqueados (`unavailable`: el control es `<nx-date>`, que se carga
aparte) o que dependen de otra (`minFrom`/`maxFrom` con `dateBounds`, `defaultFrom` con `#derive`),
lo habitual de una opción (`fills`), llenar desde
afuera con origen (`fill`, `undo`),
validación al salir o al enviar, avisos con arreglo, índice de secciones, pie con lo que falta,
borrador en el navegador (`draft`) y lectura (`mode="read"`).

Las fuentes lo llenan con `fill()` por el protocolo de `src/core/fill.ts` (`fillTarget`):
`<nx-paste-fill>` (envolviéndolo o con `for`), `<nx-scan field for>` y `<nx-doc-capture for>`.
Pruebas: `test/form.sources.dom.test.ts`.

Archivos: `form.ts` (el elemento), `logic.ts` (sin DOM: limpiar el esquema, condiciones, validación,
texto de lectura), `types.ts`, `form.css` (importa `field.css`), `index.ts`. Pruebas:
`test/form.logic.test.ts`, `test/form.dom.test.ts` (también la demo de la galería) y
`test/form.links.dom.test.ts` (lo que un campo toma de otro). Galería: página
«Formularios» (`gallery/demo-form.ts`).

## BDUI

`Form: "form"` en el registro de `src/bdui.ts`. `sections`, `fields`, `values`, `errors`,
`warnings`, `hints` y `labels` aceptan el objeto o su JSON. Ninguna regla es una función: lo que
necesita al negocio lo calcula la app y lo devuelve con `fill()` y `hints`. Los textos del esquema
van siempre como texto (nunca HTML).

`link` llega tal cual en el JSON del campo (`{"link": {"label": "Descargar formato", "href":
"/formatos/descarte.pdf"}}`). `cleanSections` lo limpia: el `href` pasa por `safeHref` y, sin
`label` o con un `href` inseguro (`javascript:`, `data:`, vacío), el enlace se descarta con un aviso
`[nx-form] enlace descartado…` (el campo sigue). En un campo de una fila tampoco se pinta: un enlace
por fila sería ruido; el de un campo `rows` va al pie del grupo. El campo se lo pasa a su
`<nx-field>` como `link-label`/`link-href`, y es `<nx-field>` quien lo pinta (`fieldLink`).

## Peso

| Pieza | Tamaño (min + gzip) | Referencia |
|---|---|---|
| `dist/form.js` (con `<nx-field>`, el campo de archivo y el núcleo; `<nx-number>`, `<nx-select>` y `<nx-date>` con `import()`) | 23,6 KB | 24 KB |
| `dist/form.css` (con `field.css`) | 3,88 KB | 4 KB |
