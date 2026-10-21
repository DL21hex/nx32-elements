# `<nx-documents>`: integración

Los documentos de una persona, por tipo (la cédula, el RUT, el pasaporte, la firma, el certificado
bancario), con su estado, su vigencia, quién los pide y **quién los ha usado**. Se suben una vez y
los trámites que los necesitan los toman de aquí, sin volver a pedirlos.

Archivos: `documents.ts` (el elemento), `logic.ts` (estado, orden y resumen, sin DOM), `types.ts`,
`documents.css`, `index.ts`. Pruebas: `test/documents.dom.test.ts`. Solid:
`src/solid/documents.tsx`. Galería: `#/profile`, sección «Documentos».

## Documentos

`items`: `{id, name, status?, kind?, thumbnail?, detail?, reason?, expires?, issued?, askedBy?,
uses?, fields?, checks?, addedAt?, addedBy?, note?, href?, replaceable?}`.

- `status`: `ok` (por defecto), `missing`, `review` o `rejected` (con su `reason`).
- El estado que se ve sale de `status` y de `expires` con la fecha de hoy (`today`, o la del
  equipo): vencido, vence hoy, mañana o en N días (desde `soon` días antes, 60 por defecto),
  vigente hasta la fecha, o vigente. Un vencido gana a «en revisión».
- `order="status"` (por defecto): primero lo que falta o se rechazó, luego vencido, por vencer y en
  revisión; dentro de cada grupo, el orden en que llegan. `order="none"`: tal cual.
- `summary` y `summaryText` («Falta 1 · 1 por vencer», «Todos al día») sirven para el estado de una
  pestaña (`<nx-tabs>` con `data-status`) o un aviso.

## Ver, subir y reemplazar

- Una tarjeta que falta (o rechazada) abre la subida; las demás, el detalle. `open(id)` y
  `upload(id)` hacen lo mismo desde código. `nx-documents-open` y `nx-documents-upload` son
  cancelables: con `preventDefault()` la app abre lo suyo.
- La subida revisa el tipo (`accept`, PDF e imágenes por defecto) y el tamaño (`max-size`, 20 MB)
  antes de soltar el archivo. Con `handoff-endpoint`, un `<nx-handoff kind="photo">` deja la foto del
  celular en el mismo `<input type=file>`.
- Un archivo que sirve sale en `nx-documents-file` `{id, item, file}` (cancelable). La app lo sube y
  lo lee (con `busy="<id>"` si quiere que la tarjeta lo diga) y asigna `items` con el documento
  guardado: el panel muestra lo que se leyó con «Listo: quedó guardado». Si vuelve `rejected`, el
  `reason` aparece en la subida para intentarlo otra vez.

## El contrato del servidor (lo que hace que no se pida dos veces)

El componente solo pinta. Lo que permite que Viáticos tome la cédula sin pedirla otra vez es un
servicio de documentos de la persona. Uno que encaja:

```
GET  /personas/{id}/documentos                 → [{id, name, status, expires, …, uses}]   (esta lista)
POST /personas/{id}/documentos/{tipo}           (multipart: file)   → el documento leído y guardado
GET  /personas/{id}/documentos/{tipo}?para=VIA-0331                → el archivo, y registra el uso
```

Cada `GET …?para=` deja un uso `{at, by, purpose}`: es lo que la persona ve en «Quién lo ha usado».
Un módulo que pide un documento que falta lo muestra como `askedBy` («Lo piden: Nómina») en lugar de
pedir que lo suban en su propio formulario.

## BDUI

`Documents: "documents"` en `src/bdui.ts`. Props: `items`, `today`, `soon`, `accept`, `maxSize`,
`handoffEndpoint`, `busy`, `order`, `locale`, `labels`.
