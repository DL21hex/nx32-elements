# `<nx-alerts>`: integración

«Para actuar»: la lista priorizada de lo que hay que hacer. Cada asunto lleva su gravedad (ícono y
texto: «Urgente», «Pronto», «Seguimiento», «Aviso»), su título, un dato corto (`meta`), el detalle y
una acción. Se ordena por gravedad (estable) salvo `sort="none"`; muestra `limit` (6) y un
«Ver {n} más» que despliega el resto.

Archivos: `alerts.ts` (el elemento y `sortAlerts`, sin DOM), `types.ts`, `alerts.css`, `index.ts`.
Pruebas: `test/alerts.dom.test.ts`. Solid: `src/solid/alerts.tsx`. La maqueta de la que sale:
`maquetas/nx-board-incapacidades.html` (panel «Para actuar», `renderAlerts`).

## Acciones

- `action.href`: un enlace (`safeHref`; un `javascript:` no pasa y queda el botón). `newTab` abre
  otra pestaña con `rel="noopener"`.
- `action.filter`: un botón con `data-nx-filter` y `data-nx-label` = `action.label`. Dentro de un
  `<nx-board>` el tablero filtra al tocarlo; no hace falta nada más.
- Sin ninguno de los dos: un botón que solo emite el evento.

Todas emiten `nx-alerts-action` `{item}` (burbujea, cancelable). Cancelado: el enlace no navega y
el clic de un filtro no llega al tablero (`stopPropagation`).

## En nx32

- Los asuntos los calcula el backend con los filtros del panel (`panel.filters`) y la fecha de
  corte; el componente no calcula plazos. El texto con nombres de personas es dato sensible: si el
  tablero reserva los paneles `personal`, no mandar los asuntos por persona.
- Para abrir la ficha de un caso: una acción sin `href` ni `filter` y escuchar `nx-alerts-action`.

## BDUI

`Alerts: "alerts"` en `src/bdui.ts`. Props: `items`, `labels`, `sort`, `limit`, `empty`.
