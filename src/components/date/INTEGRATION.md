# `<nx-date>`: integración

Una fecha: la caja de texto de siempre (se escribe «25/10/2026» y se pasa al siguiente) más un
calendario de un mes en un popover, donde lo que no se puede elegir sale tachado con su motivo:
`unavailable` (`{dates, weekdays}`; fechas ISO o `{date, label}`, días 0 domingo … 6 sábado) y lo
que queda fuera de `min`/`max`. Un clic en un día bloqueado no lo elige: lo explica en la nota de
abajo y la sacude.

Archivos: `date.ts` (el elemento), `logic.ts` (sin DOM: limpiar `unavailable`, el motivo de un día,
leer y escribir una fecha en el orden del locale), `types.ts`, `date.css`, `index.ts`. La rejilla
del mes, los nombres de los días y el título vienen de `date-range/logic.ts` (`monthGrid`,
`weekdays`, `monthTitle`, `dayLabel`) y la aritmética de días de `core/days.ts`: no se copian.

`<nx-form>` usa este elemento en un campo `date` con `unavailable` y valida con la misma lógica
(`blockedReason`, `cleanUnavailable`), sin cargar el calendario. Lee `value || text`: lo escrito que
no es una fecha también llega, para que el campo diga que no la entiende.

El nombre de la caja sale de `label` o del `<label for>` del elemento (`internals.labels`): el
etiquetable es el elemento, no la caja de adentro, así que se copia a `aria-labelledby` de la caja.

Pruebas: `test/date.logic.test.ts`, `test/date.dom.test.ts` (happy-dom, con la Popover API
simulada), `test/form.links.dom.test.ts` (dentro de `<nx-form>`) y `e2e/date.spec.ts` (foco y
teclado en un navegador real). Galería: «Formularios», la solicitud de permiso.

## BDUI

`Date: "date"` en el registro de `src/bdui.ts`. `unavailable` y `labels` aceptan el objeto o su JSON.
