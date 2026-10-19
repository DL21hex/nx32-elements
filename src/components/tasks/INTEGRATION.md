# `<nx-tasks>`: integración

## Dónde está cableado

- **BDUI**: `src/bdui.ts`, `Tasks: "tasks"` (`{component: "Tasks", props}` → `<nx-tasks>`).
- **Entradas**: `vite.config.ts` (`tasks`), `scripts/build-css.mjs` (`tasks.css`),
  `src/styles/nx32-elements.css`, `src/index.ts`, `package.json` `exports["./tasks"]` (el CSS y el
  adaptador de Solid salen por los comodines `./*.css` y `./solid/*`).
- **Solid**: `src/solid/tasks.tsx` (`<Tasks>`), con los tipos JSX en `src/solid/jsx.ts`.
- **Galería**: `#/tasks` (`gallery/index.html`, `gallery/main.ts`, `gallery/demo-tasks.ts`: el día
  de un jefe de compras, con una API de mentira que confirma a los 400 ms y otra que falla).

## Peso

`scripts/size.mjs` (min + gzip, con el núcleo):

| Pieza | Medido | Límite |
|---|---|---|
| `dist/tasks.js` (con el lector de fechas de `<nx-intent>`; la lista y el dictado fuera) | 13,8 KB | 14 KB |
| `tasks-pick` (la lista de personas del `@`, con el chunk de tasks ya cargado) | 15,9 KB | 16,25 KB |
| `dist/tasks.css` | 3,2 KB | 3,25 KB |

La lista de personas se pide al entrar al campo si hay `people-source`; el dictado
(`<nx-voice>`), sólo con `voice`. Quien sólo marca tareas no baja ninguno de los dos. La app
importa `tasks.css` y, si usa `voice`, también `voice.css`.

## Protocolo con el servidor

El elemento no habla con ningún servidor salvo `people-source`. Todo lo demás pasa por eventos:

1. La persona crea o marca algo: se ve al instante, con «Deshacer» durante `undo` ms.
2. Si deshace, sale `nx-tasks-undo {key, type}` y no se envía nada.
3. Si no, al vencer el plazo (o al salir del DOM, o en `pagehide`) sale `nx-tasks-commit`:
   - `{key, type: "create", title, due?, urgent, people}`: sin `people` es una tarea propia; con
     ellas, un pedido (una tarea para cada una).
   - `{key, type: "done", id, done}`.
4. La app guarda y contesta `settle(key, resultado)`:
   - `{id?, href?}`: listo. Una tarea propia recién creada cambia su id provisional (su `key`) por
     el del servidor, y su título pasa a ser enlace si llega `href`.
   - `{error}`: el cambio se revierte y la barra de estado dice el mensaje, sin «Deshacer».

**Usa la `key` como clave de idempotencia** (`Idempotency-Key`): en `pagehide` el cambio sale
con la página cerrándose y la app puede reintentarlo; con la misma clave, el servidor no crea dos
veces. Marcar una tarea que todavía se está creando hace salir primero la creación y la marca
espera a su `settle`, así que un `done` nunca llega con un id provisional, salvo el que sale con
la página cerrándose (el elemento lo dice en el README).

`nx-tasks-open {kind, item}` y `nx-tasks-options {draft}` son cancelables: una SPA los cancela y
navega con su router (si no, el elemento hace `location.assign`). Un enlace con `newTab` lo abre
el elemento.

## Primer uso: nx32

El inicio de prueba `/core/home/tasks__for_employees` (BDUI `NxTasks`). El adaptador
(`frontend/src/components/NxTasks.tsx`) contesta los `commit` con dos rutas de Pendientes
(crear y `set_done`), manda la `key` como `Idempotency-Key`, navega con el router las tareas, los
enlaces y «Más opciones», y `people-source` es `/core/users/people__for_all`
(`{items: [{id, name, detail}]}`).

## Decisiones

- **Un pedido a varias personas es una fila en «Lo que pediste», no N filas.** El servidor crea
  una tarea por persona; quien pidió quiere ver «2 de 3 hechas · falta Andrés».
- **«para Laura» sólo cuenta con una Laura.** Con dos, adivinar le pediría la tarea a quien no
  era; el texto queda en el título y el `@` resuelve.
- **El rojo es sólo para lo vencido.** «Hoy» va en el tono principal; lo demás, sin color.
- **Lo que la app vuelve a mandar no borra lo pendiente ni lo escrito**: una señal que se
  recalcula (Solid) o un refresco no pueden comerse la tarea que se acaba de anotar.
