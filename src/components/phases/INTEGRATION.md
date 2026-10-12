# `<nx-phases>`: integración

Tramos consecutivos sobre un eje de días: quién paga cada día de una incapacidad, con «hoy» marcado
y lo que falta rayado. Dibujo en HTML y CSS (sin SVG): cada tramo va en su lugar del eje con un
ancho proporcional a sus días. La barra es una imagen con un resumen para el lector de pantalla;
con `list`, la lista de tramos con rango, regla, valor y lo que falta. No filtra ni emite eventos.

Archivos: `phases.ts`, `logic.ts` (limpiar y ordenar tramos, avance con `today`, posición de un día,
ticks por defecto; sin DOM), `types.ts`, `phases.css`, `index.ts`. Pruebas:
`test/phases.logic.test.ts` y `test/phases.dom.test.ts`. La maqueta de la que sale:
`maquetas/nx-board-incapacidades.html` (ficha lateral, «Quién paga cada día»).

## En nx32

- Los tramos los arma el backend con la regla de cada tipo (enfermedad general: empresa días 1 y 2,
  EPS hasta el 180 con el 66,67 % y luego el 50 %, fondo de pensiones desde el 181; riesgos laborales:
  ARL desde el día 1). `today` es el día acumulado de la incapacidad activa; sin `today`, todo se
  pinta como pasado.
- `value` de cada tramo es lo causado hasta hoy (`format="money"`, `currency="COP"`).

## BDUI

`Phases: "phases"` en `src/bdui.ts` (`phases`, `labels`, `ticks`, `total`, `today`, `format`,
`currency`, `locale`, `list`).

## Peso

Sin medir todavía (no se corrió `npm run build`).
