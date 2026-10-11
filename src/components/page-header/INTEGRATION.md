# `<nx-page-header>`: integración

La cabecera de una página: la ruta (hijo sin `slot`), el título con el ícono del módulo (`heading`,
`heading-icon`), el subtítulo (`subheading`), las acciones (`slot="actions"`) y la navegación a
páginas hermanas (`slot="nav"`). Los hijos del autor no se mueven: el componente agrega al final el
bloque del título (`.nx-page-header__head`, con el `<h1>` y el subtítulo) y `order` lo ubica.

Archivos: `page-header.ts`, `page-header.css`, `index.ts`. La letra del título y el cuadro del ícono
son `.nx-page-title` y `.nx-page-title__icon` de `src/styles/tokens.css` (piezas compartidas con el
título de `<nx-grid>`), con el token `--nx-page-heading-size`. Pruebas: `test/page-header.dom.test.ts`
y `e2e/a11y.spec.ts` («cabecera de página»). Galería: `#/page-header` (`gallery/demo-page-header.ts`).

## BDUI

`PageHeader: "page-header"` en el registro de `src/bdui.ts` (`heading`, `headingIcon`,
`subheading`). BDUI no pasa hijos: la ruta y las acciones las pone la app.

## Peso

| Pieza | Tamaño (min + gzip) | Presupuesto |
|---|---|---|
| `dist/page-header.js` (con el núcleo) | 1,58 KB | 1,75 KB |
| `dist/page-header.css` | 0,31 KB | 1 KB |
