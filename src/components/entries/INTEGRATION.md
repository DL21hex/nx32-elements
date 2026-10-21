# `<nx-entries>`: integración

Registros que se repiten, cada uno en pocas líneas, con agregar, editar y quitar: las personas del
núcleo familiar, los trabajos y estudios de una hoja de vida, las sesiones abiertas, las
autorizaciones.

Archivos: `entries.ts` (el elemento), `logic.ts` (limpieza, sin DOM), `types.ts`, `entries.css`,
`index.ts`. Pruebas: `test/entries.dom.test.ts`. Solid: `src/solid/entries.tsx`. Galería:
`#/profile`, «Núcleo familiar» y «Hoja de vida».

## Registros

`items`: `{id, title, meta?, detail?, avatar?, icon?, badge?, badgeTone?, tags?, proof?, note?,
locked?, removable?, removeText?, values?}`. Sin `id` o sin `title` se descarta; un `id` repetido se
queda con el primero.

- `avatar`: un nombre (iniciales con el color de la persona) o la dirección de una foto; sin él,
  `icon` (registrado). En `layout="timeline"` va un punto.
- `note`: `{text, tone?, action?}`: el aviso dentro del registro; su botón emite
  `nx-entries-action` `{id, action, item}`.
- `locked`: candado con su explicación, sin editar ni quitar. `removable: false`: se edita pero no
  se quita. `readonly` (del elemento): todo para leer.

## Agregar, editar y quitar

- `add-label` pone el botón de agregar en la cabecera. Agregar y editar emiten `nx-entries-edit`
  `{id, item}` (cancelable; `id: null` al agregar). Sin `schema`, eso es todo: la app abre lo suyo.
- Con `schema` (campos o secciones de `<nx-form>`), se abre un `<nx-dialog mode="panel">` con un
  `<nx-form>` (`values` del registro). `nx-entries-open` `{id, form}` lo entrega para llenarlo desde
  un documento (`fill()`) o ponerle herramientas en su `slot="tools"`.
- Al enviar bien: `nx-entries-save` `{id, item, values, sources}` (cancelable). Sin cancelar, el
  panel se cierra; la app guarda y asigna `items`. Para esperar al servidor: `preventDefault()`,
  guardar y luego `close()`, o `errors` con lo que dijo el servidor. Lo nuevo se ilumina un momento.
- Quitar pide confirmar en el mismo registro, con `removeText` (qué pasa). Confirmado,
  `nx-entries-remove` `{id, item}` (cancelable) y el registro sale de la lista.

## BDUI

`Entries: "entries"` en `src/bdui.ts`. Props: `items`, `schema`, `errors`, `heading`,
`headingLevel`, `addLabel`, `empty`, `layout`, `readonly`, `labels`.
