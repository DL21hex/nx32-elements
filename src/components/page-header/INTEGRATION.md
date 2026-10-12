# `<nx-page-header>`: integración

La cabecera de una página: la ruta (hijo sin `slot`), el título con el ícono del módulo (`heading`,
`heading-icon`), el subtítulo (`subheading`), las acciones (`slot="actions"`), los enlaces
(`links`), las cifras (`kpis`) y la navegación a páginas hermanas (`slot="nav"`). Los hijos del
autor no se mueven: el componente agrega al final el bloque del título (`.nx-page-header__head`, con
el `<h1>` y el subtítulo), los enlaces (`.nx-page-header__links`) y las cifras
(`.nx-page-header__kpis`), y `order` los ubica: ruta, título · acciones, enlaces, cifras,
navegación.

- `kpis` (0.17.0): `{id?, label, value, delta?, tone?, hint?}`; un `<dl>` con `aria-label`
  (`labels.kpis`). Un `value` numérico sale con el locale (`locale` o el `lang` más cercano). `tone`
  colorea solo el cambio (`neutral`, `info`, `success`, `warning`, `danger`). Por debajo de 480 px
  de ventana, de a dos por renglón.
- `links` (0.17.0): `{label, href, icon?, newTab?, download?}`; `<a>` de verdad en un grupo con
  `aria-label` (`labels.links`). Solo direcciones seguras (`safeHref`).

Archivos: `page-header.ts`, `types.ts`, `page-header.css`, `index.ts`. La letra del título y el cuadro del ícono
son `.nx-page-title` y `.nx-page-title__icon` de `src/styles/tokens.css` (piezas compartidas con el
título de `<nx-grid>`), con el token `--nx-page-heading-size`. Pruebas: `test/page-header.dom.test.ts`
y `e2e/a11y.spec.ts` («cabecera de página»). Galería: `#/page-header` (`gallery/demo-page-header.ts`).

## BDUI

`PageHeader: "page-header"` en el registro de `src/bdui.ts` (`heading`, `headingIcon`,
`subheading`, `kpis`, `links`, `labels`, `locale`). BDUI no pasa hijos: la ruta y las acciones las
pone la app.

## Peso

| Pieza | Tamaño (min + gzip) | Presupuesto |
|---|---|---|
| `dist/page-header.js` (con el núcleo; enlaces y cifras desde la 0.17.0) | 2,67 KB | 2,75 KB |
| `dist/page-header.css` | 0,83 KB | 1 KB |
