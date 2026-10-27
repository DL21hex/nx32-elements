# Registro de cambios

## 0.31.1 — 2026-10-26

Una revisión de rendimiento y estabilidad de lo que usa nx32: lo que se notaba (una pantalla que se
congela, un dato que se ve mal, una acción que no corre), medido antes y después.

- **`<nx-form>`: agregar o quitar una fila ya no rehace las demás.** Lo escrito, el foco y lo elegido
  en una búsqueda del servidor se quedan: antes, la persona elegida desde la búsqueda en otra fila
  volvía a decir «Elige…» (el formulario guardaba bien el id, pero no se veía). Con 40 filas,
  «Agregar» pasa de ~60 a ~9 ms. Lo elegido en un select que busca se recuerda: si el control se
  rehace (otro esquema), vuelve con su nombre.
- **`<nx-form>`: reasignar el mismo esquema no rehace nada.** Al recargar el registro el foco ya no
  cae en la página; si el esquema cambia, vuelve al mismo campo, con lo escrito y la selección.
- **`<nx-form>`: un `fill()` sin origen (un recálculo del servidor) ya no ilumina los campos ni
  mueve la vista**, y **sostener Ctrl+S envía una sola vez.**
- **`<nx-dialog>` y `nxConfirm`: el doble clic en el botón que abre la confirmación ya no la cierra
  sola con «no».** El segundo clic caía en el fondo: la acción no corría y nada lo decía. Lo que se
  pulsa mientras abre, en sus primeros 300 ms o como segundo clic de un doble clic no cuenta como
  clic en el fondo.
- **`<nx-select source>`: un valor que no conoce ya no deja a la vista el registro anterior.** Queda
  vacío y pendiente hasta que llega su registro, como decía el README.
- **`nxToast()`: el mismo aviso otra vez mientras se ve no se apila.** El que está vuelve a empezar
  su tiempo y responde a las dos llamadas; los de «Deshacer» siguen siendo uno por acción.
- **`<nx-grid>`, memoria y velocidad con muchas filas.**
  - Las filas guardadas ya no quedan en el modo lento de V8: 20.000 filas de 14 campos ocupaban
    16,5 MB y ahora 2,8 MB, y filtrar es más rápido.
  - Con un filtro «contiene» sobre textos largos (observaciones de más de 256 caracteres), cada
    tecla de «Buscar en la tabla» o cada casilla del panel volvía a plegar todos los textos: ~145 ms
    por pasada con 20.000 filas de 1.500 caracteres, ahora ~15–20 ms.
  - Lo plegado se suelta cuando no queda ninguna tabla en la página.
  - Reasignar el mismo orden ya no vuelve a ordenar todas las filas.
- **`<nx-grid>`: `save()` repinta una vez por tarea**, no dos veces por llamada: pegar 200 horas
  (un `save()` por fila) eran 400 repintados completos y ahora son 2.
- **`<nx-grid>`: la matriz y el panel del filtro ven las filas que cambian en su lugar.** Sin
  filtros, `patchRow`, `removeRow` o una edición dejaban la matriz con los números viejos.
- **`<nx-grid>`: los chips de filtro ya no parpadean.** Se recreaban (y repetían su entrada) en cada
  tecla, cada orden y cada fila que cambiaba.
- **`<nx-grid>`: la primera petición sale en el segundo microtask.** Lo que la app repone en un
  microtask encolado al montar (la URL o lo recordado, encima de la vista predeterminada) viaja ya
  en ella, como decía el README; antes la cortaba y salía otra: una consulta cara de más por visita.
- **`<nx-grid>`: exportar con `source` se corta si la tabla sale del DOM.** Seguía pidiendo bloques y
  descargaba el archivo en la página siguiente.
- Peso: `grid.js` 42,9 KB (+0,4), `form.js` 25,4 KB (+0,7), `toast.js` 3,3 KB (+0,2).

## 0.31.0 — 2026-10-25

- **`<nx-form>`: lo que les faltaba a los formularios de solicitudes después de 0.30.0.**
  - **Opciones según otro campo (`when` en cada opción).** El motivo se ofrece según el tipo; al
    cambiar el tipo, un motivo que ya no es de él se vacía. `select`, `radio`, `segmented` y
    `checkbox` con opciones fijas.
  - **Valores ocultos (`type: "hidden"`).** No se ven, viajan en `values`, sirven de condición y la
    app los cambia con `fill()` sin marcar cambios.
  - **Avisos (`type: "notice"`).** Un recuadro con título, texto y `tone` (`info`, `success`,
    `warning`, `danger`) que la app actualiza con `fill()`; vacío no se ve. Con `blocks`, mientras se
    ve no deja enviar.
  - **Variantes de un campo (`cases`).** La primera que se cumple cambia `required`, `min`, `max`,
    `hint` o `unavailable`: la fecha de inicio con otro mínimo según el motivo.
  - Galería: «Formularios», registrar un permiso a nombre de otra persona.
  - Peso: `form.js` pasa de 24 a 25 KB de referencia.

## 0.30.0 — 2026-10-25

- **`<nx-form>`: los formularios de solicitudes (permisos, vacaciones, asistencias) ya caben en el
  esquema.** Les faltaban cuatro cosas que hasta hoy obligaban a una app a seguir con su formulario
  propio:
  - **Días bloqueados en una fecha (`unavailable`).** `{dates, weekdays}`: festivos (con su nombre:
    `{date, label}`), cierres y los días que la jornada no incluye. El campo pasa a ser `<nx-date>`
    (nuevo, se carga solo si el esquema lo usa) y el formulario no deja enviarlos («No se puede
    elegir: Festivo: Día de la Raza»). El campo de fecha del navegador solo sabe de mínimo y máximo:
    no puede apagar un sábado.
  - **Selects que dependen de otro (`dependsOn`).** Un `select` con `source` busca con el valor de
    los campos de los que depende (`?q=…&tipo=7`), queda apagado con «Primero elige…» mientras falte
    alguno y se vacía cuando uno cambia, en cadena. Un `fill()` que trae al padre y al hijo respeta
    al hijo, y `values` no vacía nada.
  - **Selección múltiple (`multiple`).** `<nx-select>` ya la tenía; el formulario no la exponía. El
    valor es una lista (de afuera también llega `"1,2"`), vacía cuenta como faltante y en lectura se
    nombran todos.
  - **Una fecha que depende de otra.** `minFrom`/`maxFrom` («hasta» no antes de «desde», en la
    validación y en el calendario) y `defaultFrom` («hasta» empieza igual que «desde» y lo sigue
    mientras la persona no escriba el suyo).
  - Al repintar, el formulario solo escribe en un control los atributos que cambian: escribir el
    `placeholder` de un `<nx-select>` abierto en cada pintado lo cerraba.
- **`<nx-date>` (nuevo): una fecha.** Se escribe a mano («12/10/2026», «12.10.26», ISO; al salir
  queda en el formato del locale) o se elige en un calendario de un mes con lo bloqueado tachado y
  su motivo al pasar o al llegar con el teclado; un clic en un día bloqueado dice por qué en vez de
  elegirlo. Sin fecha, abre en el primer día que se puede elegir. Form-associated, con su validez
  (falta, no es una fecha, fuera de rango, bloqueado), su `<label for>` como nombre de la caja,
  BDUI `Date` y `<DateInput>` en Solid. Galería: «Formularios», la solicitud de permiso.
- Peso: `dist/form.js` pasa de ≈21,9 KB a ≈23,6 KB (referencia nueva: 24 KB); `dist/date.js`,
  ≈6,8 KB.

## 0.29.1 — 2026-10-22

- **`<nx-form>`: `setErrors(errores, {focus: false})` pone errores sin mover el foco.** Asignar
  `errors` enfoca el primer campo con error y lo trae a la vista, y eso está bien al enviar. Pero un
  error que llega solo, sin que la persona haya hecho nada (una comprobación del servidor que
  termina 1–3 s después de elegir un archivo), le movía el cursor a ese campo mientras escribía en
  otro, y lo que tecleaba se perdía. Con `{focus: false}` el foco y la vista se quedan donde están, y
  el primer error nuevo se anuncia a los lectores de pantalla («Soporte: …»), que si no, no se
  enterarían. Sin la opción, `setErrors(e)` es lo mismo que `errors = e`.

## 0.29.0 — 2026-10-21

- **La página de una persona («Mi perfil»): cuatro piezas nuevas y lo que les faltaba a tres.** Se
  arman como la propuesta A de `maquetas/nx-perfil.html` (galería: «Mi perfil», `#/profile`).
  - **`<nx-entries>` (nuevo): registros que se repiten.** El núcleo familiar, la experiencia, los
    estudios, los cursos, las sesiones abiertas, las autorizaciones. Cada uno en pocas líneas: la
    cara (iniciales con el color de la persona, foto o ícono), el título y su píldora, dos líneas,
    etiquetas, lo que lo respalda con un visto y un aviso con su acción dentro del registro
    (`nx-entries-action`). Con `schema` (campos de `<nx-form>`), agregar y editar abren un panel con
    el formulario (`nx-entries-open` lo entrega para `fill()`); al enviar bien sale
    `nx-entries-save` (cancelable: el panel espera al servidor, luego `close()` o `errors`) y lo
    nuevo se ilumina. Quitar se confirma en el mismo registro diciendo qué pasa (`removeText`,
    `nx-entries-remove`). `locked` con su razón, `readonly`, y `layout` `list`, `cards` o `timeline`.
  - **`<nx-documents>` (nuevo): los documentos de la persona.** En tarjetas con su estado calculado
    con la fecha de hoy (falta, rechazado, vencido, vence en N días, en revisión, vigente), lo que
    pide atención primero. El detalle dice qué se leyó, qué se comprobó, quién lo pide y **quién lo
    ha usado**. Subir o reemplazar en el mismo panel (tipo y tamaño se revisan antes; con
    `handoff-endpoint`, la foto del celular con `<nx-handoff>`): el archivo sale en
    `nx-documents-file`, la app lo lee con `busy` y asigna `items`, y el panel muestra cómo quedó (o
    el motivo si volvió rechazado). `summaryText` («Falta 1 · 1 por vencer») para su pestaña.
    `INTEGRATION.md` trae el contrato del servidor para que otro módulo tome el documento sin pedirlo
    otra vez y el uso quede registrado.
  - **`<nx-otp>` (nuevo): el código en casillas.** Se escribe de corrido, se pega o lo llena el
    celular (`one-time-code`); `nx-otp-complete` sale una vez y en el turno siguiente al evento que
    llenó la última casilla (el error que la app pinta ahí no lo borra ese mismo `input`). Control
    de formulario.
  - **`<nx-password>` (nuevo): la contraseña.** Ojo para mostrar, aviso de mayúsculas y, con
    `meter`, medidor de cuatro tramos con su nivel en palabras y condiciones que se van cumpliendo:
    largo (`min-length`, 12), sin datos de la persona (`avoid`), no ser de las más usadas, no aparecer
    en filtraciones (`breach-endpoint`, k-anonimato) y distinta de la actual (`differs`); `match`
    para la confirmación. Nunca va a un atributo, no se repone con «atrás», `nx-password-change` no
    la trae y BDUI no la acepta en un payload (`localProps`).
  - **`<nx-form>`: tipos `otp` y `password`** (`meter`, `avoid`, `match`, `differs`,
    `breachEndpoint`). No van al borrador, `fill()` no los llena, no se recortan al salir, en lectura
    son puntos y no van dentro de `rows`.
  - **`<nx-tabs orientation="vertical">`:** el índice al lado de los paneles, con una línea de
    estado por pestaña (`data-status`, `data-tone`, `data-icon`; también en `tabs`) y arriba/abajo;
    en menos de 640 px vuelve a ser la tira de arriba y el estado queda como un punto.
  - **`<nx-fields>`:** `note` bajo el título (`note-icon`), y por dato `verified`, `masked` (con
    «Mostrar»), `pending` (un cambio en revisión con su acción, `nx-fields-pending`) y «Falta ·
    Agregar» al leer un obligatorio vacío (`nx-fields-action` con su `key`).
  - **`<nx-page-header avatar>`:** la cara de la persona (iniciales con su color o foto) en lugar del
    ícono, y `avatar-action` con su botón (`nx-page-header-avatar`).
  - Envoltorios de Solid (`<Otp>`, `<Password>`, `<Entries>`, `<Documents>`), registro BDUI
    (`breachEndpoint` y `handoffEndpoint` cuentan como direcciones) y una prueba que monta la página
    de la galería sin navegador.

## 0.28.0 — 2026-10-20

- **`<nx-lanes>` (nuevo): lo abierto de varios procesos, un punto por elemento, para un monitor en
  la pared.** Cada proceso es un carril con sus bandejas en orden sobre un riel; cada elemento
  abierto es un punto parado en su bandeja, con el color de cuánto lleva sin moverse (`bands`, por
  defecto 0 a 2, 3 a 5, 6 a 10 y más de 10 días; lo propio atrasado late). Una bandeja `other`
  espera a otro (el jefe, la EPS): punto hueco que no cuenta como propio. Con datos nuevos, el punto
  que cambió de bandeja viaja, el que llega crece en su sitio y el que se va corre hasta la punta;
  `nx-lanes-change` cuenta lo que pasó, para un registro. `spotlight` resalta un carril sin apagar
  los demás y `cycle` lo rota por los que tienen atrasados; `nx-lanes-spotlight` da sus cifras para
  una tarjeta «En foco». Llena el alto que le den y sus letras crecen con el ancho, para leerse de
  lejos. Cada bandeja es un botón (`nx-lanes-stage`) o un enlace (`href`) con su resumen. Lógica
  pura exportada (`prepare`, `summarize`, `rankLanes`, `diffPlaces`…), envoltorio `<Lanes>` en
  Solid, registro BDUI `Lanes` y página «Carriles» en la galería. ≈ 9 KB gzip con el núcleo.

## 0.27.1 — 2026-10-19

- **`<nx-grid>` en el celular (la lista de 0.26.0), revisada en un teléfono de verdad.**
  - **«Filtros» es una hoja desde abajo.** Abierto encima de la tabla, el panel dejaba la lista en
    una franja (con `height="fill"` nada se desplaza). Ahora es un `<dialog>` modal con el mismo
    panel, su propio desplazamiento y «Ver N filas» al pie (etiqueta nueva `seeRows`). Se cierra
    también tocando fuera o con Escape. Nunca arranca abierto en la lista; si la tabla se ensancha
    con la hoja abierta, el panel queda abierto en su lugar.
  - **Los atajos como segmentos se desplazan dentro de su barra.** Antes, si no cabían, movían la
    página entera de lado: su fila no se encogía por debajo del ancho de todos los segmentos.
  - **La barra queda con lo que se usa en un celular.** La lista no muestra «Tabla | Matriz» (no
    hay matriz en la lista; al volver a la tabla sigue como estaba), Vistas, Exportar ni «Guardar
    como vista». «Ordenar por» no pasa del ancho de la barra.
  - **A la derecha del renglón va un estado de verdad.** La elección automática tomaba una columna
    de nombres cuya única opción con tono era «Sin asignar» (los jefes de Empleados), y cortaba el
    nombre de cada persona. Ahora pide un `status` o una lista con tono en cada opción.

## 0.27.0 — 2026-10-19

- **`<nx-tasks>`: la línea puede alimentar el formulario de la app (`capture="form"`) y entender
  sólo el `@` (`understand="mentions"`).** Con `capture="form"` el botón dice «Siguiente»
  (`labels.next`) y <kbd>Enter</kbd> no crea nada: emite `nx-tasks-options` (cancelable) con lo
  escrito y las personas, para que la app abra su formulario completo con eso y se guarde desde
  ahí; si la app atiende el evento, el campo se vacía, y si no, se va a `options-href` con lo
  escrito. «Más opciones» ya no se ofrece aparte, y sin título también abre (el formulario lo pide).
  Con `understand="mentions"` sólo se lee el `@nombre` (`parseTask(…, {mentionsOnly})`): la fecha,
  «urgente» y «para Nombre» quedan en el título tal cual, y bajo el campo sólo se dice para quién, y
  sólo si se nombró a alguien. Un `labels.hint` vacío no pinta la explicación bajo el campo. Tipos
  `TasksCapture` y `TasksUnderstand`; `<Tasks capture understand>` en Solid. Lo de siempre no
  cambia. ≈ 0,2 KB gzip más (`tasks.js` 14,0 KB).

## 0.26.0 — 2026-10-19

- **`<nx-grid>`: en el celular, una lista (`narrow`).** Cuando el componente mide menos de 480 px,
  cada fila se pinta como un renglón de dos líneas: el título arriba (con su círculo si la columna
  lleva `avatar`), dos datos debajo separados por «·», y a la derecha un estado o un monto y, debajo,
  un dato con su punto. El renglón mide 60 px fijos: la virtualización es la misma y se pintan menos
  nodos que en la tabla (cinco datos por fila, no todas las columnas). Cada columna dice su lugar con
  `list` (`"title"`, `"meta"` —hasta dos—, `"end"`, `"end-meta"`); si ninguna lo trae, la tabla
  elige: la columna fija, la del avatar o la del enlace como título, el primer estado y el primer
  punto a la derecha, y las dos primeras columnas de texto debajo. Un toque abre la fila
  (`nx-grid-open`; con `href`, el renglón es el enlace); con `selectable`, el círculo es la casilla
  y, con algo marcado, tocar una fila la marca. Sin cabecera, la barra trae «Ordenar por» y la flecha
  del sentido; los grupos son renglones con sus subtotales que se pliegan al tocarlos, y las acciones
  de fila van al final del renglón. La lista no edita, no marca rangos ni pega (lo que se editaba en
  la tabla se guarda al pasar a lista) y no muestra Deshacer ni Rehacer. Teclado: flechas, Re Pág/Av
  Pág, Inicio y Fin; Enter abre, Espacio marca. Vuelve a ser tabla desde 496 px (el margen evita que
  cambie una y otra vez en el borde) y la fila de arriba sigue arriba al cambiar. `narrow="table"`
  la deja como tabla, para las que se llenan celda por celda; `data-list` en el componente dice cuál
  se ve. La tabla de escritorio no cambia. Etiquetas nuevas `sortBy`, `noSort`, `sortAsc` y
  `sortDesc`; tipos `GridNarrow` y `GridListSlot`. ≈ 1,8 KB gzip más de JS y 0,5 KB de CSS.

## 0.25.0 — 2026-10-19

- **`<nx-tasks>` (nuevo): lo que tengo que hacer, para cualquier empleado y en el celular.** Una
  tarea se anota en una línea («Llamar a Laura mañana, urgente»), se cierra con un toque y se
  deshace. Mientras se escribe, «Entendí:» dice el título, para quién, la fecha y si es urgente, y
  cada parte se quita con su ×; las fechas las lee el lector de `<nx-intent>` y `@` abre la lista de
  personas de `people-source` (la de `<nx-thread>`); «para Laura» cuenta solo con una Laura. Con
  `voice`, un botón de `<nx-voice>` escribe en el campo. Las tareas van por fecha («Vencidas», «Hoy»,
  «Próximos días», «Más adelante», «Sin fecha»; las urgentes primero, el rojo solo para lo
  vencido) y, debajo, lo que otros módulos esperan (`links`, con su acción) y lo que se pidió a
  otros (`requests`, con su avance y quién falta). Nada espera al servidor, como `<nx-kanban>`: cada
  cambio se ve al instante con «Deshacer» durante `undo` ms (también <kbd>Ctrl</kbd>+<kbd>Z</kbd>), y
  solo al terminar —o al salir del DOM o cerrarse la página— sale `nx-tasks-commit`; la app contesta
  `settle(key, {id, href} | {error})`. Marcar una tarea que todavía se crea espera a su creación, y
  lo que la app vuelve a mandar no borra lo pendiente ni lo escrito. `nx-tasks-open` y
  `nx-tasks-options` (cancelables) dejan a la app navegar con su router o abrir su formulario. BDUI
  `Tasks`, `<Tasks>` en `nx32-elements/solid/tasks`. ≈ 13,8 KB gzip con el núcleo; la lista del `@`
  (≈ 15,9 KB con el chunk de tasks) y el dictado se cargan al usarlos.
- **`<nx-intent>`: `findDateSpan(texto, hoy)`.** La fecha que lee `findDate` y dónde está en el
  texto, para quien tiene que quitarla (el título de una tarea). `findDate` es la misma función sin
  el lugar: lee igual.
- **`<nx-voice>`: `layout="button"`.** Solo el botón, con el estado en su `title`, para quien
  muestra lo que se oye a su manera (`nx-voice-partial`, `nx-voice-error`).
- **`<nx-thread>`: la lista de sugerencias sirve también a un `<input>`.** La usa el `@` de
  `<nx-tasks>` con sus propias clases; la tarjeta de registros entra al DOM la primera vez que se
  muestra.

## 0.24.0 — 2026-10-14

- **`<nx-flow>` (nuevo): el flujo del día, un punto por elemento.** Para un tablero que vive
  abierto (los viajes de contenedores de MSC: en ruta, en finca, inspecciones, cierre, patio,
  puerto). `stages` en orden (`limit`/`warn` en minutos, `end` para la salida) e `items` con la hora
  de cada etapa (`times`, ISO o milisegundos); el componente deduce el resto: en qué etapa va cada
  uno (la más avanzada cuya hora ya pasó, aunque falten hitos), cuánto lleva, el color (ámbar desde
  el 75 %, rojo pasado el límite), cuántos salieron y entraron en la última hora (por transición
  real), la etapa que se atasca («Se acumula aquí» y una frase arriba), la mediana por etapa y la
  curva de la cola. Cada punto es un nodo persistente que viaja con `transform` cuando cambia de
  etapa: con un refresco cada 45 s solo se mueven y repintan los que cambiaron (las posiciones y
  clases se escriben solo si cambian; una medida por pintado). La línea del día deja mirar otra
  hora o «Repetir el día» (~20 s) sin que los datos nuevos lo interrumpan. `highlight` atenúa lo que
  un filtro de la app deja fuera («12 de 54»); `stage` y `selected` con sus eventos
  `nx-flow-stage`, `nx-flow-item` y `nx-flow-open`; la franja del elemento elegido pone sus horas
  bajo cada etapa. `now` (hora del servidor) y un reloj de 30 s que se apaga con la pestaña oculta
  o al desconectar; con `end` pasado, se queda en el fin del día. Se puede mover el mismo elemento
  a otro contenedor sin perder lo elegido ni volver a crear los puntos. Con más de 1.500 puntos o
  con «menos movimiento», se colocan sin animar. Una ISO sin desfase se lee en `time-zone`, y una
  hora antes de 2000 o después de 2200 (un centinela de «sin hora») no cuenta. Revisado a fondo
  antes de salir: una repetición cortada por un mover no queda congelada, la franja del elegido y
  sus celdas no se rehacen si no cambian, con `highlight` los resaltados van primero si la etapa no
  cabe, Escape no cierra el diálogo que lo contiene, las marcas de hora siguen el cambio de hora, y
  las rayas del riel se mueven con `transform`. Bajo 760 px las etapas se apilan. BDUI `Flow`,
  `<Flow>` en `nx32-elements/solid/flow`. ≈ 12,8 KB gzip con el núcleo.
- **`<nx-grid>`: `applyFilters(filtros)`.** Pone los filtros como si los hubiera puesto la persona:
  emite `nx-grid-filter`, así la app que los recuerda (o un `<nx-flow>` al lado, que atenúa lo que la
  tabla deja fuera) se entera. El setter `filters` sigue sin emitir.

## 0.23.0 — 2026-10-14

- **`<nx-form>`: un enlace bajo un campo (`link`).** `{"link": {"label": "Descargar formato",
  "href": "/formatos/descarte.pdf"}}` en cualquier campo pinta, después de la ayuda, un botón
  secundario pequeño con ícono de descarga. **Siempre abre en otra pestaña** (`target="_blank"`,
  `rel="noopener noreferrer"`): así no se pierde lo escrito y el router de una SPA no lo intercepta
  (un PDF navegado por el router salía como «Página no encontrada»). Va bien bajo un `readonly` que
  trae la nota («Si estás afiliado a Salud Total, descarga el formato…») o bajo el `file` donde se
  sube lo diligenciado. Se ve también en lectura (`mode="read"`, donde la ayuda se oculta: es un
  recurso, no una ayuda de edición) y se va con su campo cuando `when` lo oculta. No es un dato: no
  sale en `values`, no se valida, no cuenta en el pie, no marca `dirty` ni va al borrador. El `href`
  pasa por `safeHref` y el `label` es siempre texto; sin `label` o con un `href` inseguro
  (`javascript:`, `data:`, vacío) el enlace se descarta con un aviso `[nx-form] enlace descartado…`
  (el campo sigue). En un campo `rows` va al pie del grupo; en un campo de una fila no se pinta
  (también con aviso). El lector de pantalla oye «Descargar formato (se abre en otra pestaña)»:
  `labels.newTab`. Tipo `FormLink` exportado (también en `nx32-elements/solid/form`).
- **`<nx-field>`: `link-label` y `link-href`** (propiedades `linkLabel`/`linkHref`; `linkLabel` y
  `linkHref` en el `<Field>` de Solid). Es quien pinta el enlace de `<nx-form>`, y un campo suelto lo
  tiene igual: al final, después del error, el aviso o la ayuda, y también con `text`. Un enlace a
  medias o con un `href` inseguro no se pinta y avisa en la consola. `labels.newTab` («(se abre en
  otra pestaña)»).

## 0.22.0 — 2026-10-14

- **`<nx-fields variant="summary">`: con más de cuatro datos, cada fila empieza alineada.** Sólo
  el primer dato de todos iba sin separador ni sangría; el primero de la segunda fila (el 5.º)
  conservaba los dos y salía corrido frente al de arriba. Ahora el primero de cada fila va como el
  primero de la franja.
- **`<nx-fields variant="summary">`: una columna de datos `mono` mide lo que mide su dato.** Las
  columnas eran iguales: la cédula y un código sobraban de espacio y la empresa, al lado, se cortaba
  («Inversiones S…»). Una columna cuyos datos son todos `mono` toma el ancho de su dato (con tope del
  40 %) y las demás se reparten el resto.
- **`<nx-fields variant="summary">`: un valor que no cabe envuelve a dos renglones.** Antes iba en
  uno y se cortaba con «…» aunque hubiera alto de sobra, y se perdía justo el dato que importaba (la
  empresa, la fecha fin de un periodo). Ahora envuelve y sólo se corta en el segundo renglón; el
  `title` sigue trayéndolo entero. Un dato `mono` (un código) no se parte: un renglón y «…».
- **`<nx-dialog>`: `badges`, otras insignias en la cabecera de ficha.** Después del estado
  (`badge`), las señales del registro que no son su estado, cada una con su tono:
  `badges='[{"label":"Extemporánea","tone":"warning"}]'` (atributo JSON o propiedad; también
  `badges` en el `<Dialog>` de Solid). Sin `badge`, `badges` también trae la cabecera de ficha.

## 0.21.0 — 2026-10-14

- **`<nx-award>`: lo adjudicado son repartos por cantidad.** Hasta ahora cada artículo iba entero a
  un proveedor, por la cantidad pedida completa. Una compra real necesita más, y el componente lo
  cubre ahora: un artículo se reparte entre varios proveedores por cantidad («a Diego le compro 20
  y a este otro 80»), se deja sin adjudicar («No adjudicar», en el detalle) o va entero. Las
  cotizaciones traen `offered` (una oferta parcial: pidieron 150 y da 120) y nunca se le adjudica a
  nadie más de lo que ofreció ni se pasa de lo pedido: un clic en la celda da hasta lo ofrecido, y
  en el detalle cada proveedor tiene su cantidad (lo que se escribe gana; si pasa de lo pedido,
  ceden los demás). Lo que falta se dice en la fila («faltan 40»), en el detalle y en el resumen
  («1 con menos de lo pedido»); la celda muestra la cantidad cuando el artículo se reparte, o
  «≤ 120» si el proveedor ofrece menos. Antes, el total de una oferta parcial salía inflado (precio ×
  lo pedido). Un artículo sin `qty` numérica (lo pedido es un texto: `qtyText: "servicio mensual"`)
  no se reparte: va entero, por lo que se ofreció. Las cantidades van en milésimas. La recomendación
  puede repartir (`{"type":"recommend","item","allocations":[{supplier, qty}]}`; `supplier` sigue
  valiendo para darlo entero a uno) y «seguir la sugerencia» es el mismo proveedor por la misma
  cantidad.
- **`<nx-award>`: una recomendación que falla, se corta o tarda no deja nada a medias.** Si el
  stream cerraba sin `done`, las filas que alcanzaron a llegar se mezclaban, sin aviso, con las de
  la recomendación anterior (pedidas con otros pesos). Si fallaba, los pesos y exclusiones nuevos se
  quedaban en pantalla con la sugerencia vieja: un proveedor «Excluido» seguía adjudicado y el envío
  llevaba esos pesos como si la hubieran dado. Ahora una recomendación que falla, se corta o vence
  el plazo devuelve la anterior **con los pesos y exclusiones que la dieron**, lo dice («La
  recomendación se cortó antes de terminar: sigue la anterior», «… tardó demasiado …») y deja
  «Reintentar». `nx-award-submit` lleva los pesos y exclusiones de la recomendación que se ve.
- **`<nx-award>`: plazo.** Un backend colgado dejaba «Revisando…» para siempre y bloqueaba «Generar
  órdenes». `timeout` (atributo y propiedad, en ms; 60.000 por defecto, un modelo puede tardar) corta
  el `endpoint`, y también espera a la app que respondió `nx-award-advise` con `preventDefault()` y
  nunca llamó `respond()`.
- **`<nx-award>`: una recomendación nueva que mueve lo adjudicado lo avisa.** Los artículos que
  seguían a la sugerencia cambiaban de proveedor sin `nx-award-change` (la app perdía el hilo de lo
  adjudicado). Ahora sale `nx-award-change` con `kind: "advice"` y los artículos que se movieron, la
  región viva lo dice («La nueva sugerencia cambió 4 artículos.») y las filas destellan un momento.
  Lo que el comprador eligió a mano no se mueve.
- **`<nx-award>`: guardar sin enviar dos veces.** Un doble clic en «Generar órdenes» emitía dos
  `nx-award-submit`. El detalle trae `wait(promesa)`: mientras la app guarda, el botón dice
  «Generando…», no se puede volver a enviar ni cambiar nada; si la promesa falla, su mensaje queda
  junto al botón y se puede reintentar; si termina bien, `dirty` se apaga. Y `key`: la misma
  adjudicación da la misma clave, para usarla como `Idempotency-Key`. El detalle trae también
  `followed` (sin cambios frente a la sugerencia), `partial` y `motive`.
- **`<nx-award>`: el motivo de la decisión.** Al pie, «Motivo de la decisión» (`motive`, atributo y
  propiedad, hasta 500 caracteres), obligatorio con `require-motive`. Además del motivo de cada
  cambio (`require-reason`).
- **`<nx-award>`: proveedores no elegibles.** `blocked: "motivo"` en un proveedor: sus celdas no se
  eligen (tachadas), su sugerencia no vale, no se le puede «Dar todo» y, si un borrador lo traía,
  «Generar órdenes» lleva a la fila y lo dice.
- **`<nx-award>`: la alerta de un proveedor cuenta en la revisión.** `alert` («Póliza vencida») era
  solo un ícono en su columna: con `require-review` se le podía adjudicar sin abrir nada. Ahora cuenta
  como alerta en las filas donde se le adjudica algo, sale en su detalle y se da por vista al abrir
  una de ellas (o su columna).
- **`<nx-award>` dentro de `<nx-dialog>`: los cambios sin guardar, al derecho.** Cambiar «Ver» marcaba
  el diálogo como cambiado y adjudicar no. Ahora los controles de vista llevan `data-nx-ephemeral` y
  cada cambio del comprador emite, además de `nx-award-change`, un `change` nativo. Nueva propiedad
  `dirty` (y `submitting`, de solo lectura).
- **`<nx-award>` en `readonly` no pide recomendación.** Con `endpoint`, abrir una adjudicación cerrada
  llamaba a la IA (gasto, y marcas que no eran las del momento de la decisión). Para abrirla tal
  cual: `value` (lo adjudicado; lo que no aparece no se adjudicó) y, si se quiere ver, `advice`.
- **`<nx-award>`: pesos.** Un juego completo se asigna en cualquier escala (600/200 queda 75/25;
  antes se topaba en 100 y quedaba 50/50); unos pocos, en la escala de los deslizadores. Asignar los
  mismos pesos ya no vuelve a pedir la recomendación. Los deslizadores y «Excluir de la sugerencia»
  solo se muestran si alguien puede volver a recomendar: con `endpoint` o con `adjustable` (la app
  responde `nx-award-advise` cada vez).
- **`<nx-award>`: más pequeños.** Los montos ya no se redondean a enteros desde 100 (US$ 123,45 se
  veía «123»); el total del resumen va completo (era compacto: «$ 4,42 M»), y el del pie lo da en su
  `title`. «1 artículo pasó a …» en singular. Apartarse de la sugerencia ya no abre el detalle (empujaba
  las filas de abajo mientras se hacía clic): el costo del cambio va en la fila; con `require-reason`,
  sí se abre. Un clic dentro del detalle ya no se pierde cuando el `change` de un campo lo repinta.
  Una celda que no cambió no se rehace al repintar, y el aviso de «Revisando…» espera lo mismo que la
  espera común antes de aparecer. Mientras se guarda no se puede volver a pedir la recomendación (lo
  que se asigne se pide al terminar); lo que el comprador cambia mientras llega una recomendación no
  se le atribuye a ella; asignar las mismas `choices` no borra «Deshacer» ni `dirty`; una cantidad
  inválida en un reparto no se lee como «todo»; una cotización retirada devuelve el artículo a la
  sugerencia; `advice` acepta texto JSON también por propiedad. `key` incluye precios y total.

- **`<nx-award>` en el navegador:** pruebas de Playwright (Chromium y Firefox) para el reparto a
  mano, el foco que se queda en el campo de cantidad, el clic dentro del detalle, el teclado y el
  doble clic al generar; y axe con el detalle abierto.
- **`<nx-toast>`:** el anuncio para el lector de pantalla (60 ms después) ya no se intenta si el
  aviso ya no está en la página (una prueba lo veía como error suelto al cerrarse).
- **Pruebas:** `grid.coalesce` esperaba un tiempo fijo a dos respuestas y fallaba con la máquina
  cargada; ahora espera a que no quede ninguna petición en camino.
  La demo de `<nx-form>` (cinco componentes con `import()`) tiene 30 s, y el toaster que ya salió de
  la página no oculta su capa al terminar el fundido.

- **`<nx-launcher density="compact" pack>`: las tarjetas de secciones que comparten fila miden lo
  mismo.** La separación compacta (28 px) pisaba también la de las columnas, que el subgrid comparte
  con las tarjetas (`--nx-launcher-gap`): la rejilla interna quedaba corrida y las del medio salían
  16 px más anchas. Ahora los 28 px son solo entre filas.
- **`<nx-launcher>`: el título de una sección sin coincidencias se lee.** Al filtrar escribiendo se
  atenuaba con opacidad (contraste 1,9:1); ahora pasa al color terciario (4,5:1) y solo el punto y
  el filete se desvanecen.
- **`<nx-sidemenu>`: el panel del flotante se recorre con el teclado.** Lo que se desplazaba era un
  `div` sin nada enfocable (axe: `scrollable-region-focusable`); ahora se desplaza el `listbox` que
  maneja el buscador, y las utilidades del pie quedan pegadas abajo (`sticky`), siempre a la vista.

### Migrar `<nx-award>` desde 0.20

- `value` es una lista `[{item, supplier, qty?}]` (antes `{artículo: proveedor}`), y ahora también
  se asigna.
- `choices` es `[{item, allocations: [{supplier, qty?}], reason?}]` (`allocations: []`: no se
  adjudica). La forma vieja `{item, supplier, reason?}` se sigue aceptando al asignar.
- `items[].qty` ya no vale 1 si falta: sin número, el artículo no se reparte.
- `nx-award-change` trae `{kind, item, items, value, choices, weights, excluded, scenario, motive}`
  (ya no `supplier`, `recommended` ni `reason`).
- `nx-award-submit`: `changes[]` trae `allocations` y `recommended` como repartos (no ids); hay
  `followed`, `partial`, `motive`, `key` y `wait()`. `orders[].lines[].qty` falta si no hay número.
- Sin `endpoint`, los pesos y «Excluir» necesitan `adjustable`.
- `awardTotal()` y `awardChanges()` reciben una función `(item) => repartos` en vez de un objeto;
  nuevas `awardChoicesFrom(value, items)` y `awardNormSplits()`.
- Textos: `vsAi` dice «Frente a la sugerencia»; `advising`, «Revisando las cotizaciones…». Nuevos:
  `partial`, `skipped`, `short`, `offers`, `qtyFor`, `left`, `youSplit`, `youSkip`, `youSplitFree`,
  `skip`, `blocked`, `gaveOne`, `motive`, `submitting`, `needMotive`, `needEligible`, `saveError`,
  `partialAdvice`, `timeout`, `movedOne`, `movedMany`.

## 0.20.0 — 2026-10-13

- **`<nx-grid source client-max>`: una descarga del conjunto entero que llega tarde ya no pisa la
  nueva.** La descarga que decide si caben en el navegador solo se cortaba al salir del DOM. Con
  `refresh()` (o otro `source`) a mitad de camino, la vieja podía llegar después de que el bloque 0
  de la consulta nueva volviera a dar la decisión por tomada: pasaba las guardas, la tabla se quedaba
  en el cliente con los datos viejos y la buena se tiraba al llegar. Ahora `refresh()`, un `source`
  o un tope nuevos y salir del DOM cortan esa descarga y le cambian la época: la que vuelve con otra
  se tira. Y mientras una va en camino, `patchRow()` y `removeRow()` responden `false` (el cambio
  se ve ya y se vuelve a aplicar sobre lo que llegue, que pudo leerse antes): antes lo que llegaba
  pisaba el cambio. **Cambia (0.x):** en esa ventana, `patchRow()` responde `false` donde antes
  podía responder `true`; la app que hace `if (!grid.patchRow(fila)) grid.refresh()` pide una vez
  más y recibe datos que ya traen el cambio.
- **`<nx-grid>`: buscar en la tabla es por palabras.** Con las filas en el navegador, «Buscar en la
  tabla» pedía la frase entera (`includes`): «jose martinez» no encontraba «JOSE LUIS MARTINEZ»,
  que el servidor de nx32 sí encuentra. Ahora cada palabra (separadas por espacios, en cualquier
  orden) tiene que estar en alguna columna visible de la fila, con la misma regla de tildes de
  `accents`. Es la regla escrita para `search` en el protocolo de `source` (`GridPage`, README): el
  servidor tiene que buscar igual, o la tabla encuentra cosas distintas según dónde se filtre.
  **Cambia (0.x):** una búsqueda con espacios encuentra más filas que antes (las que tienen las
  palabras separadas o en otro orden).
- **`<nx-grid client-only>`: lo que no cabe se dice.** Si el origen mandaba más filas que el tope
  (`client-max`, o 20.000), la tabla se quedaba con las primeras, lo decía solo en la consola y
  presentaba el recorte como el total («20.000 filas»). Ahora el conteo y «Todos» llevan el total
  real («20.000 de 25.300 filas»), un aviso bajo el conteo lo explica («Se muestran las primeras
  20.000 de 25.300 filas: los filtros y la búsqueda solo miran estas», `labels.truncated`), la región
  viva lo anuncia y sale `nx-grid-truncated` con `{shown, total}` (`GridTruncatedDetail`; `total`
  es el `total` del origen o, si dice menos, las filas que llegaron). Solid: `onTruncated`.
- **`<nx-grid>`: la tabla tiene nombre y avisa el fallo.** El `role="grid"` no tenía nombre
  accesible: ahora lo da `label` (atributo y propiedad; su `aria-label`) o, sin él, `heading`. Y
  cuando la primera carga falla, «No se pudieron cargar las filas», con lo que dijo el servidor, va a
  la región viva (una vez por fallo, no en cada reintento): el aviso con «Reintentar» es una celda,
  que el lector de pantalla no lee solo.
- **`<nx-grid source>`: las peticiones tienen plazo, y los reintentos se reparten.** Ninguna petición
  tenía plazo: un servidor que no contestaba dejaba «Cargando…» para siempre, sin `nx-grid-error`
  ni reintento. Ahora `timeout` (atributo y propiedad, en ms; 30.000 por defecto) corta la petición
  (cuerpo incluido, aunque el `fetch` no atienda la señal) y cuenta como la red caída: `status: 0`,
  `error: "Sin respuesta en 30 s"`, y se repite sola. Un 408 también se repite (como un 5xx o un
  429); un 429 o un 503 con `Retry-After` (segundos o fecha) espera lo que pide el servidor (hasta
  10 min); y la espera entre intentos lleva una variación al azar de hasta la mitad hacia abajo
  (1 s pasa a ser entre 0,5 y 1 s), para que muchas pestañas no vuelvan a la vez. Vale también para
  la matriz, la descarga completa y exportar. Solid: `timeout`.
- **`<nx-grid>`: la celda activa sigue a su fila.** Tras un `patchRow()` que la cambiaba de lugar (un
  orden por la columna que cambió) o un `removeRow()` de una fila de arriba, la celda activa se
  quedaba en la misma posición, sobre otra fila (y Enter abría otra ficha). Ahora sigue a su fila
  por su id, como ya lo hacía el campo de una edición; si su fila ya no se ve, queda la que ocupa su
  lugar.
- **`<nx-grid source client-max|client-only>`: `refresh()` con las filas aquí no vacía la tabla.**
  Pasaba al servidor y volvía: «Cargando…», el cuerpo con alto 0 y el desplazamiento arriba, aunque
  las filas de antes eran buenas hasta que llegaran las nuevas. Ahora la tabla sigue en el cliente
  con las filas de antes (y su desplazamiento, su celda activa y sus filtros), con `aria-busy`
  mientras viene la nueva, y pide solo el conjunto entero (sin la primera página filtrada que antes
  pedía primero). Al llegar, la reemplaza; si ya no cabe (`client-max`), pasa al servidor con la
  consulta de ahora; si falla, se quedan las de antes y sale `nx-grid-error` con `attempt: 1` y
  `retrying: false` (y la región viva lo dice). Si la tabla sale del DOM mientras tanto, lo pide al
  volver. **Cambia (0.x):** `refresh()` en ese modo ya no pasa por `mode === "server"` ni pide la
  página filtrada.
- **`<nx-grid>`: «Todos» dice la verdad y su clic siempre hace algo.** «Todos» salía presionado
  siempre que ningún atajo lo estuviera, aunque hubiera filtros: Empleados de nx32 arranca en
  «Activo» (que no es un atajo), «Todos» se veía presionado mostrando solo a los activos, y pulsarlo
  no hacía nada (solo quitaba un atajo presionado). Ahora un segmento presionado dice lo que se ve:
  un atajo, si los filtros son los suyos; «Todos», solo sin ningún filtro (su número es el del
  conjunto sin filtros). Con otros filtros no hay ninguno presionado, y «Todos» los quita todos.
  Pulsar un atajo presionado sigue devolviendo los filtros de antes de tocarlo. El arranque con
  filtro de la app no cambia (sigue filtrando); quien quiera ese filtro presionado lo declara como
  un atajo con los mismos filtros. **Cambia (0.x):** con un atajo presionado, «Todos» quita todos los
  filtros en vez de volver a los de antes del atajo.
- **`<nx-grid>`: `patchRow()` no rehace lo que no cambió.** Con las filas aquí, cada `patchRow` o
  `removeRow` recalculaba todo: el texto de búsqueda de cada fila, el orden de todas (con el
  alfabeto del locale), los conteos de los atajos y las columnas de facetas. Ahora conserva el texto
  de las demás filas, el orden si no cambió el valor por el que se ordena (la nueva va en el lugar
  de la vieja), los conteos de los atajos por diferencia y las facetas si no cambió ninguno de esos
  valores. Medido con 20.000 filas, un orden por texto, una búsqueda, un filtro y dos atajos: de ~95
  a ~32 ms por `patchRow`. El resultado es el mismo que recalcular todo (lo fija una prueba que
  compara con una tabla armada de cero).

- **`<nx-select source>`: Enter durante la búsqueda ya no elige una opción de la consulta
  anterior.** Cada tecla deja a la vista la lista de antes mientras llega la nueva, y se resaltaba
  su primera opción: un Enter rápido elegía a otra persona. Ahora los resultados llevan la consulta
  que los produjo y, mientras la escrita no tiene respuesta, la lista vieja se ve atenuada pero ni
  se resalta ni se elige con el teclado (las flechas no la recorren). Un Enter pulsado en esa espera
  se guarda y elige la primera opción de la respuesta que llegue (si llega vacía, nada); seguir
  escribiendo lo cancela. Una respuesta en camino se cancela con la tecla siguiente (antes podía
  pintarse durante la espera entre teclas como si fuera la vigente). Al cerrar se olvidan los
  resultados y el Enter pendiente. No se descarta ningún resultado del servidor por no casar en el
  cliente: el servidor busca en campos que el cliente no ve (la cédula). Nuevo `timeout` (atributo
  y propiedad, en ms; por defecto 30 000): una búsqueda que no contesta muestra el error en vez de
  «Buscando…» para siempre. Documentado: con `source`, el valor elegido llega con su registro en
  `selection` (no se pide suelto al servidor).
- **`<nx-form>`: `dirty` y `nx-form-dirty`.** El formulario dice si tiene cambios sin guardar:
  algún campo que se ve (no los `readonly`) difiere de lo último que cargó la app, con `values` o
  con un `fill()` SIN origen (un recálculo del servidor; un `fill()` con origen, como el texto
  pegado o un escaneo, es la persona trayendo datos y sí cuenta). Escribir y borrar vuelve a
  `false`. `nx-form-dirty` `{dirty}` avisa cada cambio (y el elemento lleva `data-dirty`).
  `markClean()` da lo que se ve por cargado sin tocar los valores. Solid: `onDirty`.
- **`<nx-dialog>`: el `dirty` efectivo suma el de sus formularios.** `dirty` es la marca propia O
  algún `<nx-form>` de adentro con `dirty`, también el de una pestaña oculta. `dialog.dirty = false`
  solo quita la marca propia: guardar una pestaña (la app recarga sus `values` y limpia la marca)
  ya no deja sin aviso a otra pestaña con cambios. Lo que se escribe dentro de un `<nx-form>` ya
  no pone la marca propia (escribir y borrar no es un cambio). El aviso al cerrar y al pasar de
  registro (botones, J / K, `requestNav`) usa el `dirty` efectivo. Al abrirse, al «Descartar» y al
  pasar de registro, los formularios quedan limpios (`markClean()`). **Cambia (0.x):** «Descartar»
  ya no pone la marca en `false` si la app cancela después `nx-dialog-close`: lo escrito sigue
  protegido.
- **`<nx-dialog>`: `nx-dialog-beforeclose`, cancelable, antes del aviso de cambios.** Sale en todo
  intento de cierre (botón, Escape, fondo, arrastre, «atrás», `close()`), antes de preguntar
  «¿Descartar?», y no otra vez tras «Descartar». Con `preventDefault()` el diálogo sigue abierto
  sin preguntar nada: así la app se niega a cerrar mientras guarda. `nx-dialog-close` sigue
  saliendo después, cuando ya se va a cerrar. Solid: `onBeforeClose`.
- **`<nx-dialog>`: el fondo queda `inert`.** Mientras un diálogo está arriba de la pila, los
  hermanos del diálogo y de cada uno de sus ancestros hasta `<body>` llevan `inert` (el lector de
  pantalla no los recorre y no se activan); al cerrar, o al quedar otro arriba, vuelven. No se tocan
  los avisos (`<nx-toaster>`), la paleta (`<nx-command>`) ni lo que los contiene, ni lo que ya era
  `inert`; las capas que se crean después quedan vivas. El clic en el fondo sigue cerrando.
- **`<nx-form>`: el reloj de «Guardado hace…» solo corre con borrador.** Cada formulario arrancaba
  un `setInterval` de 15 s aunque no tuviera `draft`; ahora solo con él (y se para al quitarlo).
- **`<nx-fields>`: el candado de `readonly` también al leer.** Solo se pintaba con `editing`: al
  mirar la ficha no se sabía qué no se cambia aquí hasta pulsar «Editar». Ahora va en el valor al
  leer y, en `variant="summary"` (donde el valor se corta con «…»), junto a la etiqueta; siempre
  con `role="img"`, `aria-label` y `title` (`labels.readonly`, «No se edita aquí»). Al leer, el
  valor no cambia de color.
- **`<nx-import>`: cada lote tiene identidad, un 4xx dice por qué y no invita a reintentar.**
  (a) Cada lote va con la cabecera `Idempotency-Key`, estable entre reintentos de ESE lote (la
  sesión del archivo cargado más una huella de sus filas y líneas) y distinta para otro lote u otro
  archivo; y el cuerpo suma `lines` (la línea del archivo de cada fila) a `{rows, offset}`, que no
  cambian. (b) Un no-2xx sin `errors` muestra el `error` (o `message`) del cuerpo en vez de «HTTP
  403», y si es un 4xx distinto de 408/429 no ofrece reintentar: «El servidor no aceptó el envío:
  {error}. Se importaron {n}.» (`labels.refused`) y `nx-import-error` `{code: "refused", message,
  status}`; sin red, un 5xx, 408 o 429 siguen siendo `network` (ahora con `status`). (c)
  `nx-import-batch` `{accepted, rejected, offset}` tras cada lote respondido: la app refresca
  aunque queden filas rechazadas. (d) Plazo por lote, `timeout` (ms, por defecto 60 000): vencido,
  el envío se detiene con «el servidor no respondió a tiempo» (`labels.timedOut`) y se puede
  reintentar. Solid: `timeout`, `onBatch`. **Cambia (0.x):** el cuerpo trae `lines` (un backend que
  rechaza claves desconocidas tiene que aceptarla) y `nx-import-error` de red lleva `status` si hubo
  respuesta.
- **`<nx-page-header>`: una cifra nunca dice «-0».** Los `kpis` numéricos usaban
  `Intl.NumberFormat` directo: un `-0` (una suma vacía en el servidor) o un negativo que se redondea
  a cero (-0,001 con dos decimales) salía «-0». Ahora pasan por `formatZeroSafe`, como las gráficas.
- **`<nx-history>`: acepta el tono `info`.** Los estados (`options[].tone`) admitían `neutral`,
  `success`, `warning` y `danger`; un `info` (el de `<nx-badge>` y `<nx-notice>`) caía en neutro.
  Ahora se acepta y se pinta como en `<nx-badge>`.
- **`<nx-actions>`: la descripción de cada acción describe a su botón.** Iba debajo, pero sin
  ligarse: el lector de pantalla solo la decía si se seguía leyendo, no al llegar al botón con Tab.
  Ahora el control de adentro del `<nx-button>` (el `<button>` o el `<a>`) lleva
  `aria-describedby` a su descripción, también tras pasar a enlace; sin descripción, nada.
- **`nxToast()`: un error no se va solo, y cada aviso se anuncia una vez.** Un aviso con
  `tone: "danger"` se cerraba a los 5 s, a veces antes de leerlo; ahora se queda hasta cerrarlo con
  su × (sin el anillo del tiempo), salvo con un `duration` explícito o con `undo` (que necesita su
  tiempo). La lista que se ve ya no es una región viva (era `aria-live` y cada aviso, además,
  `role="status"`/`"alert"`: un mismo aviso se podía anunciar dos veces, y otra al volver a subir
  el toaster sobre un diálogo); el texto va una sola vez a una región aparte, cortés o de alerta
  (error), que se vacía sola a los pocos segundos y al ocultarse el toaster. **Cambia (0.x):** los
  `<li class="nx-toast">` ya no llevan `role`.
## 0.19.0 — 2026-10-13

- **`<nx-dialog>`: pasar de registro respeta los cambios sin guardar.** En una ficha con un
  formulario editado, «siguiente» (o J / K) cargaba otro registro y lo escrito se perdía sin aviso;
  y como `dirty` solo volvía a `false` al abrir, cerrar después la ficha siguiente, sin haberla
  tocado, preguntaba «¿Descartar?». Ahora, con `dirty`, pasar de registro pide la misma
  confirmación que cerrar (el mismo aviso, con `labels.unsaved`, `keep` y `discard`): «Seguir
  editando» (o Escape) se queda donde está y «Descartar» pasa, con el foco de vuelta en el botón de
  pasar. Al pasar, el diálogo pone `dirty = false`: lo que protegía era del registro que se deja.
  `nx-dialog-nav` es cancelable: con `preventDefault()` no se pasa, y `dirty` no cambia (lo escrito
  sigue ahí). `requestNav("prev" | "next")` hace lo mismo que los botones y devuelve si pasó.
  **Cambia (0.x):** con cambios sin guardar, `nx-dialog-nav` ya no sale al pulsar: sale después de
  «Descartar». Una app que guarda sola antes de pasar de registro pone `dirty = false` al guardar,
  como ya lo hacía para cerrar sin el aviso.
- **`<nx-grid>`: la vista predeterminada gana también cuando la tabla se conecta antes de recibir
  sus propiedades.** La prioridad del arranque es: lo que la app pone encima (la URL, lo recordado)
  › la vista marcada «abrir con esta vista» (`views-storage`) › los filtros y el orden de arranque
  que asigna la app. Una tabla que llega en el HTML del servidor solo con sus atributos (`source`,
  `views-storage`, `client-max`…) se conecta al cargar la librería, antes de que la hidratación le
  asigne `columns`, `filters` y `sort` (en cada carga completa: un enlace, un marcador, recargar).
  La vista se aplicaba al conectarse, los filtros y el orden de arranque la pisaban enseguida y
  `activeView` seguía nombrándola: la tabla abría sin la vista de la persona y el menú decía que
  estaba puesta. En una navegación dentro de la app (las propiedades llegan antes de conectar) sí
  ganaba. Ahora, sin columnas, la vista espera a las primeras (sin ellas no se sabe qué claves
  valen) y se aplica al final de esa tarea, encima de los `filters` y `sort` asignados en ella o
  antes, sin importar el orden; la primera petición de filas ya sale con la vista (una sola, sin
  cancelaciones). `activeView` es `null` hasta que se aplica. `applyView(id)` en esa misma tarea
  reemplaza a la predeterminada. Con las propiedades antes de conectar nada cambia; sin `source`,
  lo mismo (sin petición). **Cambia (0.x):** en una tabla que se conecta sin columnas, la vista
  predeterminada (y `activeView`) ya no está en la misma tarea en que llegan las columnas, sino al
  final de ella. Quien repone algo encima (la URL, lo recordado) y miraba `activeView` en esa tarea
  lo hace después: en otra tarea o en un microtask encolado tras asignar las propiedades, y sale en
  la misma petición. Una prueba que miraba la vista en el acto la encuentra tras un
  `await Promise.resolve()`.
- **`<nx-grid source client-max>`: la descarga completa que no cabe se contesta con un número.**
  Cuando la primera página dice `total <= client-max`, la tabla pide el conjunto entero sin filtros
  (`{offset: 0, limit: client-max + 1, sort: null, filters: []}`) para seguir en el navegador. Pero
  ese `total` era el de la consulta filtrada (una bandeja que abre en «Activo»): si sin filtros
  pasaban del tope, la fuente leía y mandaba `client-max + 1` filas que la tabla tiraba. Ahora es
  parte del protocolo de `source` (README y `GridPage`): a la petición completa la fuente puede
  contestar solo `{rows: [], total: N}`, sin leer las filas; con un `total` numérico mayor que
  `client-max` la tabla entiende que no cabe y sigue en el servidor aunque `rows` venga corta o
  vacía (ya lo hacía porque llegaban menos filas que `total`; ahora es la regla escrita y probada).
  Ese `total` es el de la consulta sin filtros: «Todos» (los segmentos) lo muestra, cuando antes iba
  sin número hasta quitar los filtros. Una fuente que sigue mandando las `client-max + 1` filas
  funciona igual que antes.
- **`<nx-grid>`: `nx-grid-columns` avisa cuando la persona cambia las columnas.** La app no tenía
  cómo enterarse de que alguien escondió o mostró una columna o cambió un ancho (solo
  `removeColumn()` emitía `nx-grid-columns`): leía `view` al desmontar o en `pagehide`, que en el
  celular no siempre llega, y la disposición elegida se perdía. Ahora `nx-grid-columns` sale cada vez
  que la persona cambia las columnas visibles o un ancho, y solo si algo cambió: «Columnas»
  (esconder, mostrar, «Volver a las columnas de la tabla»), el borde de la cabecera (un arrastre
  avisa una vez, al soltar, no en cada píxel; Ctrl+←/→, Supr y doble clic, uno por cambio) o una
  vista elegida en «Vistas» que los cambia. El detalle suma a `columns` las ocultas y los anchos,
  los mismos de `view`: `{columns, hidden, widths}` (`GridColumnsDetail`). No sale por lo que asigna
  la app (`columns`, `view`, `applyView()`) ni por la vista predeterminada al abrir: la app ya lo
  sabe, y un recuerdo guardado al oírlo se pisaría con el arranque. `removeColumn()` lo sigue
  emitiendo, ahora con `hidden` y `widths`. Solid: `onColumns`, con el detalle nuevo. Se reutilizó
  `nx-grid-columns` (el nombre que ya dice «las columnas») en vez de otro, que habría quedado al
  lado de `nx-grid-layout` (Tabla | Matriz). **Cambia (0.x):** `nx-grid-columns` ya no quiere decir
  solo «se quitó una columna»: quien lo escuchaba para eso lo recibe también al esconder, mostrar o
  cambiar un ancho (que `columns` sea más corta lo distingue).

## 0.18.0 — 2026-10-12

- **Una sola espera para toda la librería, sin esqueletos.** Seis componentes tenían su propio
  barrido gris con la forma del contenido (diálogo, kanban, historial, IA, tendencia y la primera
  carga del grid, que además tenía un spinner). Ahora todos usan la misma espera, `.nx-wait`
  (`waitEl` en `core/wait.ts`, estilos en tokens.css): lo que ya se conoce queda en su sitio y el
  resto lo llena una línea que corre bajo la cabecera, una trama de puntos que respira en el color
  de la marca y, si hay, una frase con brillo. Se eligió en la maqueta `maquetas/nx-cargando.html`
  («Hilo + Puntos»).
  - Aparece a los 250 ms: una respuesta rápida ya no dibuja nada (antes parpadeaba). En
    `<nx-dialog loading>`, si llegó a verse, se queda al menos medio segundo y el contenido entra
    con un fundido corto.
  - Cuesta menos que los barridos: la línea y la trama solo animan posición y opacidad (no
    repintan); solo la frase se repinta, una línea de texto. El diálogo repintaba ~19 barras.
  - `<nx-dialog loading>`: sin `heading`, la cabecera ya no pinta una barra en lugar del título.
  - `<nx-grid>`: la primera carga ocupa todo bajo la cabecera, con «Cargando…»; las filas que aún no
    llegan al desplazarse muestran la trama quieta en vez de barras.
  - `<nx-kanban busy>`: cada columna vacía muestra la espera (sin frase; la anuncia `aria-busy`).
  - `<nx-trend busy>`: la espera sobre el área del gráfico, con `labels.loading` (nuevo,
    «Cargando…»).
  - `<nx-history>` y `<nx-ai-answer>`: la espera en lugar de las barras (en la IA, baja, con su
    color y sin frase: los pasos en vivo ya cuentan qué hace).
  - Con menos movimiento: la trama quieta, la frase sin brillo y la línea más lenta. En alto
    contraste: `GrayText` y `Highlight`.
  - Se ajusta con `--nx-wait-height`, `--nx-wait-bg`, `--nx-wait-dot` y `--nx-wait-glow`.
  - **Cambia (0.x):** desaparecen las clases `.nx-dialog__skel*`, `.nx-kanban__skel`,
    `.nx-history__skel`, `.nx-ai__skeleton` y el atributo `data-skeleton` de la cabecera del
    diálogo. `.nx-dialog__loading` sigue (ahora es la espera). Quien las usaba en sus estilos o
    pruebas busca `.nx-wait`.

## 0.17.1 — 2026-10-12

- **`<nx-grid>` con `source`: lo que se asigna en la misma tarea es una sola petición.** Una app (o
  un envoltorio) conecta la tabla y enseguida le asigna `filters`, `sort` y `search`; cada
  asignación es una consulta nueva y la tabla pedía su página en el acto, cortando la anterior. Al
  abrir una página con filtros recordados salían tres peticiones de filas y dos se cancelaban a los
  ~50 ms (en producción, el 5 % de las peticiones de una tabla de empleados y el 28 % de una de
  incapacidades eran esas cancelaciones). Ahora el primer bloque de una consulta nueva se pide al
  final de la tarea (un microtask): las asignaciones seguidas son una sola petición, con la consulta
  final. Lo mismo con `refresh()` (llamado varias veces seguidas, una petición), un `row-key` nuevo,
  la vuelta al DOM, `client-only` y la matriz con `source`. «Cargando…» se pinta igual que antes,
  sin esperar; los bloques que se piden al desplazarse salen en el acto; los reintentos y
  `nx-grid-error` no cambian. Una app que asigna sus propiedades un cuadro después (tras un `await`,
  dentro de un `Suspense`) sigue costando una petición cortada: esperar ese cuadro retrasaría la
  primera carga de todas las demás. Una prueba que esperaba el `fetch` en el acto al conectar lo
  encuentra tras un `await Promise.resolve()`.
- **`<nx-grid source>` sin columnas no pide filas.** Una tabla que llega en el HTML del servidor
  solo con sus atributos (`source`, `client-max`, `views-storage`…) se conecta al cargar la
  librería, antes de que la hidratación le asigne `columns`, `filters` y `sort`; esas propiedades
  llegan después y a veces en otras tareas, así que juntarlas en un microtask no alcanzaba: salía
  una petición con la consulta vacía y cada propiedad la cortaba (tres peticiones por carga, dos
  canceladas). Ahora, sin columnas, la tabla no pide (no hay qué pintar y quien la configura aún no
  termina): ni al conectarse, ni con `refresh()`, ni al cambiar filtros, ni la matriz ni
  `client-only`. Las primeras columnas piden una vez, con los filtros, el orden y la búsqueda que
  lleguen en su misma tarea (y la vista predeterminada de `views-storage`). Si los filtros llegan en
  una tarea posterior a las columnas, son dos peticiones y la primera se corta, pero ninguna sale
  sin columnas. Volver a asignar las mismas columnas sigue sin pedir; un `source` puesto después de
  las columnas pide como siempre.

## 0.17.0 — 2026-10-12

Sin cambios que rompan: todo es nuevo y opcional. Lo único que cambia de comportamiento es que un
4xx de `source` ya no se reintenta solo (ver abajo).

- **`<nx-grid>`: `patchRow(fila)` y `removeRow(id)`, una fila sin pedir la tabla entera.** Lo que
  guarda una ficha cambia una fila; antes había que llamar a `refresh()` y volver a bajar todo (en
  una bandeja, hasta 20.000 filas). `patchRow` reemplaza la fila con su `id` (según `row-key`) o la
  agrega al final si no estaba; `removeRow` la quita. Con las filas en el navegador (`rows`, o
  `client-max` / `client-only` ya en el cliente) se recalcula todo lo que depende de ellas: la
  búsqueda, los filtros, los conteos de las facetas y de los atajos, el orden, los grupos, los
  totales, la selección (una fila quitada sale de ella, con `nx-grid-selection`) y `shownIds`, de
  modo que el «anterior / siguiente» de una ficha abierta sigue la tabla nueva. Responden si lo que
  se ve quedó exacto; `false` quiere decir «pide otra vez» (`refresh()`), y la tabla nunca deja
  conteos viejos callada:
  - con la consulta en el servidor, `patchRow` cambia la fila cargada en su lugar y responde `true`
    solo si no cambió ningún valor del que dependen el orden, los filtros, las facetas, los atajos,
    los totales o las barras (con una búsqueda o con la matriz, siempre `false`; una fila no
    cargada, también `false`, sin tocar nada); `removeRow` responde `false` sin quitar nada;
  - un atajo que es enlace con conteo del servidor también hace `false`: ese conteo solo lo sabe
    el servidor;
  - una fila sin `id` no se toca (`false`). Las marcas de edición y el historial para deshacer de
    la fila parchada se olvidan: lo que llega es lo guardado.
- **`nx-grid-error` dice qué pasó, y un 4xx ya no se reintenta.** El detalle suma `status` (0 sin
  respuesta), `message` (el `error` o el `message` del JSON del servidor; si no dijo nada, el mismo
  `error` de siempre), `body` (el JSON, o el texto), `attempt` (1 el primero: para avisar una vez por
  fallo y no por intento) y `retrying` (si la tabla lo volverá a pedir); `{offset, limit, error}`
  siguen igual. Solo se reintenta lo que puede pasar solo: la red, un 5xx o un 429. Un 4xx se dice
  una vez y espera a «Reintentar» o `refresh()` (tampoco vuelve al desplazarse): antes un 403 se
  pedía cinco veces en un minuto. Sin filas, el aviso pone el mensaje del servidor debajo de «No se
  pudieron cargar las filas».
- **`<nx-grid client-only>`: un origen que solo sirve el conjunto entero.** La primera petición va
  sin filtros, búsqueda ni orden (`{offset: 0, limit: client-max + 1, sort: null, filters: []}`;
  sin `client-max`, hasta 20.000 filas) y los filtros, los recordados también, se aplican en el
  navegador. Antes, con solo `client-max`, la tabla probaba la página filtrada, el origen la
  rechazaba y recién entonces pedía el conjunto: una ida y vuelta de más en cada regreso con un
  filtro recordado. Filtrar mientras llega no lo vuelve a pedir; `refresh()` lo pide entero otra
  vez; si llegan más filas que el tope, se toman las del tope y se avisa por consola. Sin el
  atributo, nada cambia (tampoco el respaldo de la 0.4.3). Solid: `clientOnly`.
- **`<nx-actions>`: las acciones de un registro, cada una con lo que hace.** La pestaña «Acciones»
  de una ficha: una lista de `<nx-button>` con una línea debajo de cada uno. `items`
  (`{id, label, description?, icon?, danger?, disabled?, href?, newTab?, download?}`); un botón
  emite `nx-actions-action` `{id, item}`, un enlace navega, abre otra pestaña o descarga y no
  emite. `busy="<id>"`: esa acción espera y las demás se apagan (`aria-busy` en el elemento); los
  nodos se conservan por `id`, así el foco no se pierde al repintar. BDUI `Actions`, Solid
  `<Actions>`, subruta `nx32-elements/actions`.
- **`<nx-dialog loading>`: la ficha mientras llega su registro.** En lugar del contenido (que se
  esconde sin moverse), un esqueleto con la forma de una ficha: el resumen, las pestañas y unos
  campos. Es un `role="status"` que anuncia `labels.loading` («Cargando…», texto nuevo) y el diálogo
  lleva `aria-busy`. La cabecera sigue (cerrar, pasar de registro); sin `heading`, el título también
  es un esqueleto. Quieto con menos movimiento; `GrayText` en alto contraste. Solid: `loading`.
- **`<nx-page-header>`: enlaces y cifras.** `links` (`{label, href, icon?, newTab?, download?}`):
  `<a>` de verdad en un grupo con nombre, bajo el título. `kpis` (`{id?, label, value, delta?,
  tone?, hint?}`): un `<dl>` con el valor arriba (un número, con el locale) y la etiqueta abajo; el
  cambio, coloreado por `tone`, nunca se parte; en el celular van de a dos. Las dos aceptan JSON en
  el atributo; `labels` (`kpis`, `links`) y `locale` nuevos. Orden: la ruta; el título y las
  acciones; los enlaces; las cifras; la navegación.
- **`<nx-button download="nombre.xlsx">`.** El valor de `download` es el nombre del archivo (vacío,
  el que mande el servidor, como antes). Un botón que descarga es `<nx-button href download
  new-tab>`: un `<a download>` de verdad, en otra pestaña (el router de una app no lo intercepta) y
  sin `href` mientras está ocupado o apagado.
- La galería: la ficha lateral (`#/drawer`) suma la pestaña «Acciones», el esqueleto al pasar de
  registro y una ficha que tarda; la cabecera (`#/page-header`), una con enlaces, cifras y una
  descarga.

## 0.16.2 — 2026-10-12

- **Ningún número sale «-0», tampoco al redondear.** Un negativo que se escribe como cero
  (-0,004 con 2 decimales, -0,004 % con uno) salía «-0», «-0 %» o «-$ 0». `formatZeroSafe`
  (`src/core/locale.ts`) lo escribe sin signo según los decimales de cada formateador, y lo usan
  `nxFormat` (`number`, `compact`, `money`), `chartValue` y la cifra de `<nx-stats>`. En
  `<nx-trend>`, un cambio que redondea a cero es «0 %» (no «+0 %» ni «−0 %») y la ficha «¿por qué?»
  lo marca con «=», no con ▲ o ▼. En `<nx-stats>`, un `delta` numérico que se escribe «0» es plano
  («= Igual 0», sin color).
- **`<nx-trend>`: un valor en porcentaje conserva su signo.** Con `format="percent"`, el punto, el
  tooltip y el eje escribían el valor absoluto: -5,2 % se leía «5,2 %». Ahora se lee «-5,2 %».

## 0.16.1 — 2026-10-12

- **Los gráficos ya no escriben «-0».** Un `-0.0` en el JSON (en Rust, `Iterator::sum` de ningún
  `f64` da -0.0) salía «-0», «-0 %» o «-$ 0» en tooltips, ejes, totales y celdas de `<nx-bars>`,
  `<nx-heatmap>`, `<nx-parts>`, `<nx-phases>`, `<nx-trend>` y `<nx-stats>`. Ahora el formato lo
  vuelve 0 en el origen: `chartValue` (y con él `shareText`), los ticks de `niceTicks`, la cifra de
  `<nx-stats>` y `nxFormat` (`number`, `compact`, `money`), así que tampoco sale en `<nx-grid>`.
  Los negativos de verdad conservan su signo.

## 0.16.0 — 2026-10-12

- **`<nx-board>` y `<nx-board-panel>`: un tablero BI con filtros cruzados.** Una grilla de 12
  columnas con sus paneles (`span`, `heading`, `subheading`, `slot="actions"`) que comparten un
  estado de filtros. Cualquier descendiente con `data-nx-filter="dimensión:valor"` es una marca: un
  clic filtra todo el tablero (con Ctrl, Cmd o Mayús, suma), y el panel dueño de esa dimensión no se
  filtra a sí mismo: el tablero marca cada marca como elegida o atenuada (`data-nx-filter-state`,
  `aria-pressed`). Arriba, un chip por filtro y «Quitar filtros». El tablero no calcula: avisa
  (`nx-board-change` `{filters, changed, reserved}`) y cada panel sabe qué pedir (`panel.filters`).
  Con `restricted`, filtrar por una dimensión `sensitive` (el diagnóstico) reserva los paneles
  `personal`. Funciones sueltas para calcular en el cliente (`matchesFilters`, `applyPairs`…). Sale
  de la maqueta `maquetas/nx-board-incapacidades.html`.
- **Los gráficos del tablero**, sobre un núcleo común (`src/core/chart.ts`: formato, ticks, colores
  fijos por serie, marcas del tablero y tooltip) y tokens nuevos (`--nx-chart-1…8`, `-muted`,
  `-seq`, `-seq-ink`, `-neg`, `-ord-1…4`; `<nx-trend>` pasa a usarlos):
  - **`<nx-bars>`**: barras horizontales o columnas, apiladas por serie (paleta categórica u
    ordinal), con el % acumulado (Pareto) como texto, línea de referencia y `limit`.
  - **`<nx-heatmap>`**: una tabla con escala secuencial o divergente, totales con su cambio (subir
    puede ser malo) y encabezados y celdas que filtran, con una sola parada de Tab y flechas.
  - **`<nx-parts>`**: partes de un todo en una barra al 100 % y la lista que se lee.
  - **`<nx-phases>`**: tramos sobre un eje de días, con hoy y lo que falta rayado.
  - **`<nx-alerts>`**: lo que hay que hacer, por gravedad (ícono y palabra), con acciones que
    enlazan, filtran o avisan.
  - **`<nx-insights>`**: frases calculadas con `**énfasis**`, tono y acción.
  - **`<nx-stats>`**: `delta` (la flecha y el color según si subir es malo o bueno) y `goal` (una
    línea punteada en la minigráfica).
  - **`<nx-trend>`**: `stacked`, puntos proyectados con su rango (`forecast`, `low`, `high`) y
    `dimension` / `period-dimension` para filtrar un tablero.
  - La galería (`#/board`) arma el tablero de incapacidades completo con todas las piezas.

## 0.15.0 — 2026-10-12

- **`<nx-history variant="plain">`: sólo la línea de tiempo.** Sin buscador, sin filtros por
  persona o campo y sin viaje en el tiempo (ni el panel de al lado ni la hora como botón de «ver
  cómo estaba»): para la ficha angosta de un registro, donde lo que se busca es leer qué pasó. La
  línea toma todo el ancho. Pasar a `plain` suelta los filtros y vuelve al presente.
- **`<nx-history readonly>`: el historial sólo se lee.** Sin la caja «Agregar una nota…» ni
  «Revertir», y `comment()` y `revert()` no hacen nada. Para una app que todavía no guarda notas: la
  caja ya no promete algo que se pierde al recargar.
- **`<nx-grid no-group>`: sin «Agrupar por».** Ni el selector ni la agrupación, aunque `group-by` o
  una vista guardada la pidan. Para las tablas cuyas filas se leen una a una, como una bandeja.
- **`<nx-import template="…">`: la plantilla dentro del importador.** El primer paso ofrece
  «Descargar la plantilla» (un `<a download>` en otra pestaña) debajo de donde se suelta el archivo;
  quien importa ya no la busca en otro botón. Solo URLs seguras; con un archivo leído no se ve.
  Texto nuevo en `labels`: `template`.

## 0.14.0 — 2026-10-12

- **`<nx-form>` pide un archivo (`type: "file"`).** «Elegir archivo o suéltalo aquí»: se abre con
  un clic, con <kbd>Enter</kbd> o <kbd>Espacio</kbd>, o se arrastra encima; ya elegido, se ve su
  nombre, su tamaño y «Quitar». `accept` (la sintaxis de `<input accept>`, `".pdf,image/*"`) y
  `maxSize` (bytes; 20 MB por defecto, como `<nx-doc-capture>`) se revisan al elegir y salen como
  error del campo; `required` y `when` funcionan como en los demás. **No sube nada: el valor es el
  `File`** (`FormValue` lo incluye), y lo traen `values`, `nx-form-change` y `nx-form-submit`; la app
  lo sube al enviar. `fill()` solo pone un `File` (un texto se ignora; `null` lo quita), el
  borrador no guarda archivos, `reset()` lo deja vacío y en lectura se ve el nombre. Uno por campo y
  nunca dentro de `rows` (se descarta con un aviso). El control es un `<input type=file>` de verdad,
  oculto a la vista: lleva la etiqueta, el anillo de foco y el error por `aria-describedby`. Textos
  nuevos en `labels`: `fileChoose`, `fileDrop`, `fileMax`, `fileRemove`, `fileBadType`, `fileTooBig`.
- **`<nx-grid>`: `shownIds`.** Los `id` (según `row-key`) de las filas que pasan la búsqueda y los
  filtros, en el orden en que se ven (agrupada, grupo por grupo). Es para el «anterior / siguiente»
  de una ficha abierta desde una fila (`<nx-dialog nav>`): la app ya no tiene que repetir los
  filtros ni el orden. Con `source`, los de las filas ya cargadas, en ese orden.

## 0.13.5 — 2026-10-12

- **Los títulos de sección del panel de `<nx-sidemenu>` se distinguen de sus pantallas.** Antes
  eran mayúsculas de 10 px en gris claro, más débiles que las opciones, y el espacio sobre un título
  era casi el mismo que entre opciones: no se veía dónde empezaba cada grupo. Ahora van en 12 px,
  peso 600 y color de texto, con más aire arriba (16 px; 8 px el primero de cada columna) que abajo,
  y una línea fina que sale del título hasta el borde. Los íconos de las opciones bajan un tono para
  no competir con los títulos.
- **`<nx-breadcrumb>`: un nivel que solo dice dónde está.** `static: true` (`data-static` en los
  hijos) es para el módulo, un grupo del menú que no es una página: se ve igual que los demás
  nombres, pero no se pulsa, su separador no se abre y «‹ Padre» y `Alt+↑` lo saltan. Puede ir solo
  sin ser la página actual, así que la etiqueta «Talento Humano» sobre el título y la ruta «Talento
  Humano › Empleados › Pepito Pérez» de más adentro son el mismo elemento. En lo angosto, si arriba
  solo hay niveles quietos, la ruta se queda entera en vez de pasar a «‹ Padre».

## 0.13.4 — 2026-10-11

- **La fila «Total» de la matriz se cierra abajo.** Con pocas filas, las líneas de las columnas
  seguían hasta el fondo y la fila «Total» no tenía línea debajo: parecía una celda gigante. Ahora
  una línea la cierra de borde a borde, como «Total» a la derecha. Va con las líneas de las
  columnas, como fondo debajo de la tabla: cuando la matriz desborda y «Total» queda fija abajo, no
  se junta con la línea de la nota.

## 0.13.3 — 2026-10-11

- **La matriz, con sus celdas a la vista.** Cada celda lleva su línea, como en la tabla: antes solo
  había líneas al cerrar los nombres de las filas y alrededor de «Total», y entre los números no se
  veían las columnas. Y, como en la tabla con pocas filas, las líneas de las columnas siguen hasta el
  fondo de la caja (las de las filas ya seguían hasta el borde derecho): la matriz mide sus columnas
  y las dibuja como fondo debajo de la tabla, sin agregar scroll; vuelve a medir si la tabla cambia
  de ancho (al llegar la fuente, por ejemplo).

## 0.13.2 — 2026-10-11

- **La matriz vuelve entera después de consultar un cruce.** Tocar un número abre la tabla con esos
  dos filtros (como antes); volver con «Matriz» ahora quita lo que puso ese clic y la matriz se ve
  como estaba, en vez de quedar en 1 × 1. Solo se quita si sigue igual: un filtro que la persona
  cambió a mano en la tabla se queda, y en cada eje vuelve lo que tenía antes del clic. Se olvida al
  asignar `filters` o aplicar una vista. Sin botones nuevos.

## 0.13.1 — 2026-10-11

- **La matriz ya no alarga la página (ahora sí).** Cada cruce vacío lleva un texto para lectores de
  pantalla (`.nx-sr-only`, absoluto); como ninguna caja de la matriz estaba posicionada, se ubicaba
  contra la página, a la altura de su renglón en la matriz entera, y la alargaba: con
  `height="fill"` quedaba un scroll vertical a página vacía bajo la matriz. La caja con scroll de la
  matriz es ahora `position: relative`, como la de la tabla. (El `contain: size` de la 0.13.0 no lo
  evitaba: limita el tamaño de la caja, no a dónde van sus hijos absolutos.)
- **La matriz no muestra valores sin filas.** Los valores declarados de un eje (`options`: todo el
  catálogo de subdivisiones, por ejemplo) salían aunque los filtros los dejaran en cero; ahora, como
  en el panel de filtros, solo sale lo que tiene filas, en el orden declarado. Lo mismo al exportarla.

## 0.13.0 — 2026-10-11

- **La matriz de `<nx-grid>` cuenta las mismas filas que la tabla.** Antes ignoraba los filtros de
  sus dos columnas (mostraba todos sus valores, marcaba el que filtraba y lo decía en una nota), y
  su total no coincidía con el de la tabla. Ahora aplica la búsqueda y todos los filtros: filtrar
  «Cali» deja solo esa fila, y los valores declarados (`options`) que el filtro quita tampoco salen.
  Un encabezado o un total pone el filtro de su eje y deja el otro como estaba; el total general
  vuelve a la tabla sin cambiar los filtros. Con `source`, la petición de la matriz lleva todos los
  filtros. **Rompe:** se quitan `labels.matrixIgnores` y la marca del cruce (`aria-pressed`).
- **Lo que sobra a la derecha ya no estira la última columna.** En la tabla, cada columna mide lo
  suyo (la última también: su filtro queda junto a su nombre) y lo que sobra es una pista vacía al
  final, por la que siguen el fondo del encabezado, la línea de cada fila y la banda de los grupos.
  La columna de acciones lleva su línea de cierre. En la matriz, igual: las columnas no se ensanchan,
  una línea cierra «Total» y las de las filas llegan al borde.
- **«Exportar» también en la matriz.** Baja la matriz como se ve (`tabla-matriz.xlsx`, o `filename`
  con «-matriz»): el eje de filas en la primera columna, un cruce por celda, «Total» a la derecha y
  abajo, fuera del autofiltro (ordenar no lo mezcla). Números de Excel, con el formato de moneda si
  suma o promedia montos, completos y sin abreviar; un cruce sin filas es 0, o vacío en un promedio.
  Los cruces ya están en memoria: no se le pide nada más al servidor. `nx-grid-export` trae `layout`
  y el aviso es `labels.exportedMatrix` («Se exportó la matriz»). `exportXlsx()` exporta lo que se
  ve. `buildXlsx` y `sheetXml` aceptan `foot` (las últimas filas, fuera del autofiltro).
- **La matriz ya no deja un scroll a hueco en la página.** Con `height="fill"`, la caja de la matriz
  se veía del alto correcto, pero la página reservaba el alto de todas sus filas: aparecía un scroll
  vertical que solo bajaba a página vacía. Ahora, como la tabla, su contenido no cuenta para su alto
  (`contain: size`) y se desplaza dentro. Venía de la 0.8.0.

## 0.12.5 — 2026-10-11

- **`<nx-account omit>` quita del panel lo que la app todavía no usa.** `omit="status locale
  shortcuts"` (cualquiera de los tres, separados por espacios): `status` quita Estado y el punto de
  la tarjeta —salvo el gris de sin conexión— y la cuenta se da siempre «En línea»; `locale` quita
  «Idioma y formatos» del panel y de la paleta de comandos (el atributo `locale` sigue mandando);
  `shortcuts` quita «Atajos de teclado». En Solid, `omit={["status", "locale", "shortcuts"]}`. Si
  entre las dos rayas del panel no queda nada, queda una sola.

## 0.12.4 — 2026-10-11

- **Escribir rápido en «Buscar en la tabla» ya no se come letras.** Cada vez que la tabla repintaba
  su barra (al llegar la respuesta del servidor de lo ya buscado, o la carga inicial), la caja volvía
  a decir lo último buscado y pisaba lo que se seguía tecleando: «ERI» se borraba y quedaba «KA»;
  «DIEGO» quedaba «DIEO». Ahora, mientras hay teclas sin buscar, la caja es de la persona; asignar
  `search` desde código la sigue mandando.

## 0.12.3 — 2026-10-11

- **Aire entre el resumen y las pestañas de la ficha lateral.** En `<nx-dialog mode="panel">`, el
  resumen (`<nx-fields variant="summary">`) y la lista de pestañas iban pegados; el resumen lleva
  ahora 18 px debajo.

## 0.12.2 — 2026-10-11

- **El clic en el fondo cierra `<nx-dialog>`.** Se esperaba que el clic sobre el `::backdrop` le
  llegara al propio diálogo, como en un `<dialog>` nativo; en nx32 no le llegaba, y la parte oscura
  junto a la ficha lateral no cerraba nada (Escape y la × sí). Ahora el clic se mira desde el
  documento y por posición: si empezó y terminó fuera de la caja del diálogo de arriba, y no en algo
  suyo (un menú que se sale) ni en un aviso, lo cierra (o rebota, con `persistent`). Si el clic iba a
  la página de debajo, no la activa. La prueba que decía cubrir el clic fuera solo probaba Escape;
  ahora hay una de verdad.

## 0.12.1 — 2026-10-11

Dos arreglos para la ficha lateral (`<nx-dialog mode="panel">` con `<nx-form>`):

- **Dos campos por fila en el panel.** `.nx-form-grid` pasaba todo campo a la fila por debajo de
  520 px, y el formulario de un panel de 560 px mide ~520: `span="3"` nunca se cumplía ahí. El corte
  del teléfono baja a 440 px.
- **Una lista simple no va en negrita.** En `<nx-select>` el texto principal pesaba 550 siempre; ahora
  sólo cuando la opción trae un segundo renglón (nombre · cargo). Una lista de EPS o de ciudades se
  lee en peso normal, como un `<select>`.

## 0.12.0 — 2026-10-10

La cabecera de una página es UNA y es de la librería: el título de la página deja de vivir en la
tabla.

### `<nx-page-header>` (nuevo): la cabecera de una página

- La ruta (el hijo sin `slot`, un `<nx-breadcrumb>`), el título con el ícono de su módulo
  (`heading`, `heading-icon`), el subtítulo (`subheading`), las acciones (`slot="actions"`, a la
  derecha del título y, si no caben, debajo de él, nunca antes) y la navegación a páginas hermanas
  (`slot="nav"`). Los hijos no se mueven; `order` y `reading-flow` ordenan.
- En BDUI, `PageHeader`. En Solid, `<PageHeader>` (`nx32-elements/solid/page-header`).

### Tokens: un solo título de página

- `.nx-page-title` y `.nx-page-title__icon` (piezas compartidas de tokens.css): la letra del título
  de una página y el cuadro del ícono con `--nx-primary-gradient`. Las usan `<nx-page-header>` y el
  título de `<nx-grid>`, así que no pueden divergir. `--nx-page-heading-size` (22 px) es su tamaño;
  `--nx-grid-heading-size` sigue cambiando sólo el de la tabla.

### `<nx-grid>`: segmentos sin título

- `segments`: los atajos como filtro segmentado («Todos» y uno por atajo, con su conteo) aunque la
  tabla no lleve título, para la tabla de una página cuyo título pone `<nx-page-header>`. Sin título
  ni `segments`, siguen siendo tarjetas. El cuadro del ícono del título lleva además la clase
  compartida `nx-page-title__icon`.

### Galería

- «Cabecera de página» (`#/page-header`): Empleados (sin acciones, con la tabla de segmentos) y
  Contratación (con acciones y subtítulo).

## 0.11.0 — 2026-10-10

**Rompe la API en una cosa:** el velo del acento ya no lo pinta `<nx-grid>`. La app marca el
contenedor de su página con `data-nx-page`, y `--nx-grid-wash` pasa a ser `--nx-page-wash`.

### Tokens: el velo es de la página

- **`data-nx-page`.** El contenedor de la página (el área junto al menú) lleva siempre el velo del
  acento, haya o no tabla: una luz desde su esquina de arriba a la izquierda que se apaga hacia
  abajo, como en la maqueta `maquetas/nx-grid-presencia.html`. Antes era el fondo de `<nx-grid>` con
  título, así que empezaba donde empezaba la tabla y lo de encima (la ruta «‹ Talento Humano», el
  margen) lo cortaba. Si el contenedor es el que se desplaza, el velo se va con la cabecera
  (`background-attachment: local`). Viene en `tokens.css`.
- `--nx-page-wash` (antes `--nx-grid-wash`): el color del velo. Solo en oscuro; va con la paleta, así
  que una zona con `data-nx-palette` tiene el suyo. `transparent` lo quita.

### Galería

- El marco de «La tabla como página» lleva `data-nx-page`.

## 0.10.0 — 2026-10-10

Un inicio por secciones con el mismo `<nx-launcher>`. Sale de la maqueta
`maquetas/nx-launcher-inicio.html` (el inicio de nx32: «Como está» y seis cambios, todos aprobados).

### `<nx-launcher>`

- **Compacta (`density="compact"`).** Tarjetas desde 190 px y hasta 6 columnas para un inicio con
  muchas secciones: el nombre entero (se parte en dos líneas en vez de cortarse), la flecha en la
  esquina para que la descripción use todo el ancho, el título de la sección con un punto y un filete,
  y una entrada escalonada la primera vez.
- **Un color por sección (`accent`).** Cada tarjeta puede traer `blue`, `green`, `amber`, `purple`,
  `pink`, `teal` o `neutral`: pinta su ícono, y el punto del título toma el de la primera tarjeta de
  la sección. Al pasar el puntero el ícono se intensifica en ese color, y la luz que sigue al puntero
  también lo toma. Sirve en las dos densidades.
- **La señal en una línea al pie** en la compacta: el punto del tono, el dato, su etiqueta y la nota,
  alineada en toda la fila. `tone` suma `info`.
- **Secciones que comparten fila (`pack`).** Una sola rejilla con subgrid: cada sección ocupa las
  columnas de sus tarjetas y la que no cabe en lo que queda de la fila baja a la siguiente, sin
  cambiar el orden. El inicio de un jefe con equipo pasa de cinco filas de tarjetas a tres. Sin
  subgrid en el navegador, cada sección queda en su fila, como antes.
- **Escribir para ir (`typeahead`).** Sin un campo a la vista: escribir con el foco en la página apaga
  lo que no coincide sin moverlo y una píldora arriba (en la capa superior) dice qué abre `Enter`.
  `Retroceso` borra una letra, `Escape` todo, `↓` enfoca la primera y tocar fuera también borra.
- **En el teléfono, listas.** En la compacta, por debajo de 600 px de ancho del launcher (consulta de
  contenedor) cada sección es una lista: ícono, nombre, descripción completa, señal y chevrón.
- Una sección sin nada que coincida con el buscador apaga también su título.
- Con el foco en el cuerpo de la página, lo escrito lo toma el primer launcher con `search` o
  `typeahead` en el orden de la página (antes, el primero que se había conectado).
- `<Launcher>` de Solid acepta `density`, `pack` y `typeahead`. Nuevas: `packSpans()` y `accentOf()`.

### Galería

- Página nueva **Inicio por secciones** (`#/launcher-inicio`), con un botón para verla angosta como
  un teléfono.

## 0.9.1 — 2026-10-10

### `<nx-grid>`

- **El ícono del título (`heading-icon`) pesa menos.** Junto a un título de 22 px, el cuadro de
  38 px con sombra de color era lo primero que se veía, más que el título. Ahora es de 32 px, el
  ícono va a su tamaño de siempre (18 px) y sin la sombra de color de abajo; solo el reflejo de
  arriba.

### Tokens

- `--nx-primary-gradient` es más corto: ±10° de tono en vez de −15°/+25°, y menos diferencia de luz.
  El giro de turquesa a azul lo hacía parecer un ícono de app.

## 0.9.0 — 2026-10-09

Más presencia sin perder la sobriedad: el diseño va en el marco y el color solo donde dice algo. Sale
de la maqueta `maquetas/nx-grid-presencia.html` (la vista Empleados, «Actual» y «Con presencia»).

### Tokens

- **En oscuro, las superficies toman un tinte del acento** (`--nx-canvas`, `--nx-background`,
  `--nx-sidebar`, `--nx-card`, `--nx-popover`), y el menú va más hundido que el fondo: ahí las sombras
  casi no se ven, y lo que separa las capas es su luz y ese tinte. Con un acento sin croma
  (`grafito`) quedan casi grises. **En claro no cambian.**
- `--nx-shadow-card`: una hoja sobre el fondo, solo en oscuro (en claro la separan su borde y el
  blanco). `--nx-shadow-raise`: una pieza levantada, en los dos temas. `--nx-primary-gradient`: el
  acento en degradado, para un ícono que lleva la marca.

### `<nx-sidemenu>`

- **La sección activa es una pieza levantada** (la hoja de la página con `--nx-shadow-raise`, el
  ícono en el acento), no un tinte con barra: en claro, el tinte sobre el gris del menú se veía como
  una mancha. Con colores forzados vuelve la barra.

### `<nx-grid>`

- **Puntos de color (`dot`).** Una columna con `dot: true` muestra un punto antes de cada valor en vez
  de la píldora: el `tone` de la opción o, sin tono, uno de ocho por su lugar en `options`. El mismo
  punto va en «Filtros», en la lista del filtro de la columna y en el chip de un filtro con un solo
  valor. Sin `dot`, las opciones con tono siguen en píldora en la celda, y ahora llevan su punto en
  los filtros y en el chip («Estado: Activo» en verde).
- **Ícono del título (`heading-icon`).** Un ícono del registro junto al título, en un cuadro con el
  degradado del acento. En oscuro, detrás del título va un velo del acento (`--nx-grid-wash`;
  `transparent` lo quita).
- **Un enlace con avatar va en el color del texto**; el acento vuelve al pasar el puntero.
- Los conteos de los atajos junto al título van en una pastilla, gris o del tono del atajo.
- La cabecera de la tabla es una banda apenas más oscura que la hoja; el panel de filtros, la caja de
  la tabla, la de la matriz y las tarjetas de atajos llevan `--nx-shadow-card`.
- En la galería, «La tabla como página» trae el ícono y la categoría con puntos, y el directorio de
  TH, el contrato con puntos.

## 0.8.1 — 2026-10-09

### `<nx-grid>`

- **Una columna fuera del panel de filtros (`facet: false`) no es eje de la matriz**, aunque traiga
  `options`, salvo que `matrix` la nombre. Con `source` el servidor agrupa por las columnas del
  panel: «Jefe», con su única opción «Sin asignar», aparecía como eje y la matriz fallaba.

## 0.8.0 — 2026-10-09

### `<nx-grid>`

- **Matriz: «Tabla | Matriz» (`matrix`, `layout`).** Con `matrix`, la barra ofrece ver la tabla o
  una matriz que cruza dos columnas de pocos valores (Área × Estado): en cada cruce, cuántas filas
  hay, o la suma o el promedio de una columna numérica (`agg`, `value`), con los totales de cada
  fila, de cada columna y el general. Ocupa el lugar de la tabla, con su mismo alto: se ve una cosa
  a la vez. Arriba se eligen las dos columnas, se intercambian y se elige qué mostrar. Tocar un
  cruce vuelve a la tabla con esos dos filtros puestos (como chips); un encabezado o un total, con
  el de su columna; el total general, sin ninguno. La matriz cuenta con la búsqueda y los demás
  filtros, no con los de sus dos columnas: al volver se ve todo y queda marcado el cruce que filtra.
  Una sola parada de Tab, con flechas dentro. Con `source`, la tabla la pide aparte (`limit: 0` y
  `matrix` en la petición) y el servidor responde `matrix` con los cruces (un `GROUP BY` de las dos
  columnas); `rowLabel`/`colLabel` nombran un valor que es un código. Las vistas guardadas recuerdan
  si se veía la matriz y cuál. Evento `nx-grid-layout` (`{layout, matrix}`), `matrixCells()` para
  calcular los cruces como la tabla, y los textos `labels.layout*` y `labels.matrix*`. Su código se
  carga al pasar a «Matriz» (~3,8 KB).
- En la galería, «Necesidades de compra» y «La tabla como página» traen la matriz, también en modo
  servidor.

## 0.7.1 — 2026-10-09

### `<nx-sidemenu>`

- **Con muchos hijos, el panel flotante va en dos columnas.** Desde 12 hijos (sin contar los chips
  del pie), la lista se reparte sola en dos columnas y el flotante se ensancha a
  `--nx-flyout-width-wide` (520px, variable nueva). Así un padre como Talento Humano (15 pantallas)
  se ve entero sin desplazarse. Las secciones (`section`) van enteras y en orden de lectura, con el
  corte donde las columnas quedan más parejas. Una sección solo se parte cuando es mucho más grande
  que las demás, y la segunda columna la continúa sin repetir el título. Sin secciones, la lista se
  parte por la mitad. Las flechas recorren la primera columna y luego la segunda; al filtrar, una
  columna vacía desaparece y la otra toma el ancho. El drill-down del drawer sigue en una columna,
  y si la ventana no da el ancho, las columnas vuelven a ser una lista.

## 0.7.0 — 2026-10-08

El inicio de una persona: cuatro componentes nuevos y los festivos en el núcleo.

### `<nx-timeline>` (nuevo): la cinta del tiempo

- Carriles sobre un eje de días: `bars` (el alto es el monto; `extra` resaltado arriba), `ranges`
  (franjas; si se pisan, en renglones) y `points` (punto o rombo). Meses, festivos, la línea de hoy
  y lo pasado sombreado; `state` (`done`, `upcoming`, `pending`, `rejected`, `draft`) y `tone`.
- La lente sale al pasar el puntero o al enfocar, en la capa superior (Popover API): ningún
  `overflow` la recorta. Un solo <kbd>Tab</kbd> y las flechas recorren las marcas en el orden del
  eje. Las marcas con `href` son `<a href>` (con `newTab`, en otra pestaña); `nx-timeline-select`
  es cancelable y dice `newTab`.
- Nada se mide en JavaScript: posiciones en % y altos por variable CSS. En pantallas angostas se
  desplaza a lo ancho y arranca mostrando hoy (`scrollToDay()`). En el registro BDUI como `Timeline`.

### `<nx-intent>` (nuevo): «¿Qué necesitas?»

- Lee lo escrito y dice qué entendió (el trámite y cada dato, como chips) antes de llevar. Trámites
  por `keywords`/`exclude`; datos por `slots`: `date`, `month`, `time`, `amount` y `option` (con su
  propio destino, p. ej. un PDF en otra pestaña). Sin modelos ni servidor. `Escape` borra; `hotkey`
  trae el foco. `nx-intent-submit` cancelable. En el registro BDUI como `Intent`.

### `<nx-tracker>` (nuevo): lo que va en camino

- Solicitudes con su estado y los pasos de su recorrido; con `days`, la tira de días desde el
  primer día libre hasta el último, con los pedidos marcados (según `workdays` y `holidays`).
  Sugerencias con `eyebrow` y acciones. En el registro BDUI como `Tracker`.

### `<nx-stats>` (nuevo): las cifras de entrada

- Cifras con nota, pastilla y una forma (tendencia, barra o anillo), en fila o en lista. En el
  registro BDUI como `Stats`.

### Núcleo: festivos, días hábiles y puentes

- `nx32-elements/core` exporta `colombiaHolidayList` (con nombres), `colombiaHolidays`,
  `holidayLookup`, `workdayTest`, `workdaysBetween`, `restAround` y `suggestBreaks`. Los festivos de
  `<nx-recurrence>` salen de ahí (misma API).
- **Festivo nuevo: la Virgen de Chiquinquirá** (Ley 2578 de 2026: 9 de julio, corrido al lunes),
  desde 2026. Cambia los días hábiles de julio en `<nx-recurrence>` y en lo que use los festivos.

### `<nx-launcher>`

- `newTab` en una tarjeta o una vista: el enlace lleva `target="_blank"` (un PDF que el router de la
  app no debe interceptar). `nx-launcher-select` trae `newTab`.

## 0.6.1 — 2026-10-07

### `<nx-inbox>`

- **Rechazar mientras A espera el impacto ya no se pierde.** Al aprobar un ítem cuyo impacto todavía
  llegaba, el ítem quedaba «en revisión», y un rechazo con motivo en ese momento se descartaba sin
  aviso. Ahora el rechazo vale y la aprobación pendiente no sigue (el ítem ya no está). Lo destapó
  la verificación con la máquina cargada.

### Desarrollo

- **`npm run check` no falla por carga.** Playwright abre menos navegadores a la vez (según núcleos y
  RAM; `NX_E2E_WORKERS` lo fija), da más margen a las esperas y reintenta una vez; lo que pasa al
  reintentar se ve como «flaky». La galería se compila al arrancar Vite (`server.warmup`). Antes,
  con seis navegadores, la swap se llenaba y en cada corrida vencían una o dos pruebas de Firefox
  distintas.

## 0.6.0 — 2026-10-07

### `<nx-form>` (nuevo): un formulario entero desde un esquema

- **El esquema en JSON.** `sections` (o `fields`) con sus campos: `key`, `label`, `type`
  (`text`, `email`, `tel`, `url`, `textarea`, `number`, `money`, `percent`, `date`, `select`,
  `radio`, `segmented`, `checkbox`, `checkboxes`, `readonly`), `required`, `hint`, `span` de seis
  columnas, `value`, `options`, límites (`min`/`max`, `"today"` en fechas, `minLength`/`maxLength`,
  `pattern`). Montos y números son `<nx-number>`, que se carga solo si el esquema los tiene. En el
  registro BDUI como `Form`.
- **`when`**: un campo aparece según otros (un valor, una lista, `{not}`, `{filled}`); lo oculto no
  se valida ni sale en `values`.
- **Lo habitual de una opción (`options[].fills`)**: el cargo trae el área y la clase de riesgo, con
  su chip, sin pisar lo que la persona escribió.
- **`fill(valores, origen)` y `undo()`**: lo que llega de la cédula, una requisición o un texto
  pegado se marca con su origen hasta que la persona lo cambia, se anuncia «7 datos de Cédula ·
  Deshacer», ilumina los campos en orden, respeta lo escrito y se deshace entero (también
  Ctrl+Z fuera de un campo). `sources` dice de dónde vino cada dato.
- **Revisar sin estorbar**: los errores salen al dejar el campo o al enviar; un correo con el
  dominio mal escrito avisa sin bloquear y se corrige con un clic; `errors` (servidor), `warnings`
  y `hints` (la app).
- **Índice y pie**: con tres secciones o más, el avance de cada una; el pie dice cuántos datos
  faltan, con «Ir al siguiente». Enter pasa al campo siguiente y Ctrl+S envía.
- **Borrador** (`draft`, `clearDraft()`): se guarda mientras se escribe y se recupera al volver,
  encima del registro que cargue la app. **Lectura** (`mode="read"`): la misma rejilla como texto.
- **Listas largas**: un `select` con más de 12 opciones, `search` (también en varias columnas) o
  `source` es un `<nx-select>`, que se carga solo si el esquema lo usa.
- **Filas (`type: "rows"`)**: un grupo de campos que se repite (beneficiarios, líneas), con agregar y
  quitar, `min`/`max`, `fills` dentro de la fila, validación por fila y errores del servidor como
  `"beneficiarios.0.nombre"`; `fill()` agrega las filas que no estaban.
- **`fill(…, {details})`**: el detalle del origen por dato (de qué tramo del texto salió). Las fechas
  como «12/10/2026» se leen día/mes/año (mes/día en `en-US`).
- Eventos: `nx-form-change` (`{key, value, values}`; en una fila, también `row` y `field`),
  `nx-form-fill`, `nx-form-undo`, `nx-form-submit` `{values, sources}`, `nx-form-cancel`. Solid:
  `<Form>` en `nx32-elements/solid/form`.

### Las fuentes llenan un `<nx-form>` con su origen

- **`<nx-paste-fill>`**: con un `<nx-form>` de destino (el que envuelve o el de `for`), los campos
  salen de su esquema y lo encontrado se le entrega con `fill()`: chip «Texto pegado» con el tramo del
  texto de cada dato, sin sus propias marcas; `undo()` deshace en el formulario.
- **`<nx-scan>`**: `field` (la clave que llena cada lectura, con el origen «Escáner»; `filas.campo`
  agrega una fila por código) y `for` (el `id` del formulario). Etiquetas nuevas: `formSource`,
  `formDetail`.
- **`<nx-doc-capture>`**: `for`. Con un formulario de destino, el botón dice «Pasar al formulario» y
  le entrega lo leído (las tablas como filas, el nombre del archivo como origen) en vez de registrarlo.
  Etiquetas nuevas: `toForm`, `formSource`, `formDetail`.

### `<nx-field>` (nuevo): el campo de la casa

- Envuelve un control (nativo, `<nx-number>`, `<nx-select>`… o un grupo de radios o casillas) sin
  moverlo: etiqueta arriba, «Opcional» (`optional`), el chip de origen (`source`, `source-detail`) y
  una sola línea debajo: `error`, `warning` con su botón (`action`, `nx-field-action`) o `hint`.
  Conecta `label for`, el grupo (`role="radiogroup"`), `aria-describedby`, `aria-invalid` y
  `required`. Lo que la persona cambia borra el error, el aviso y el origen. Con `text` (y
  `locked`), se lee.
- Clases que sirven solas: `.nx-input` (input, select y textarea con el aspecto de `<nx-number>`),
  `.nx-check`, `.nx-choices`, `.nx-segmented` y `.nx-form-grid` (seis columnas, `span` por campo).
- No está en el registro BDUI (lo suyo es el control que envuelve): un payload usa `Form`. Solid:
  `<Field>` en `nx32-elements/solid/field`.

## 0.5.0 — 2026-10-07

### `<nx-grid>`

- **Horas del día (`type: "time"`).** «HH:MM» de 24 horas, en cifras de ancho fijo. Editable, se
  escribe como se teclea rápido («730», «7:30 pm», «09:30:00» de Excel, «ahora», «+20» después del
  paso anterior, «-10» o «hace 10») y Ctrl+: pone la hora de ahora (en un rango, solo en las celdas
  vacías). Lo que no se entiende no sale del campo con Enter ni Tab (se queda en rojo y dice cómo
  escribirla) ni pisa una celda al pegar. `readTime()` y `parseTime()` se exportan para que el
  servidor o la app lean igual.
- **La hora se lee en su proceso.** Sin a. m./p. m. ni cero adelante, la hora es la que encaja
  después del paso anterior: «2» después de las 06:31 son las 14:00, y «150» entre las 06:44 y las
  14:02 son las 13:50. Al pegar una fila, lo pegado antes cuenta como paso anterior.
- **Un recuadro bajo la celda mientras se escribe la hora.** Dice la hora que entendió (también en
  12 horas), por qué (de la tarde por el orden, «20 min después de…», «hace 10 min») o qué no
  cuadra, y dibuja la regla del día con los demás pasos, el tramo donde debería caer y la hora de
  ahora. Botones «Ahora · 14:35» y «Dejar vacía».
- **La línea de un proceso (`type: "timeline"`).** Dibuja los pasos de la fila sobre las horas del
  día (`hours`, de 04:00 a 23:00 por defecto) con la hora de ahora, que se mueve sola; el punto que
  se acaba de escribir entra con un destello. Su valor es cómo va el proceso (`idle`, `live`,
  `done`, `review`) y por él se filtra y se cuentan los atajos. `sequenceState()` se exporta.
- **El paso que sigue y cuántos van.** La celda del paso que sigue se ve «--:--», y la cabecera de
  cada paso dice cuántas filas ya lo tienen («52/57»), con su barra.
- **Los pasos de un proceso (`sequence`).** Las columnas con el mismo nombre son pasos en orden: un
  paso vacío con uno posterior registrado dice «Faltante», y uno anterior al paso previo va en
  ámbar con el motivo. Se recalcula al editar. `sequenceMarks()` se exporta.
- **`save(changes, promesa)`: guardar a la vista.** La celda dice «guardando» (gris), «guardado»
  (destello verde) o «no se guardó»: vuelve a su valor, sale del historial y queda en rojo con el
  motivo. Lo que se volvió a editar mientras tanto no se toca. `pendingSaves` cuenta lo que va en
  camino. Junto a deshacer se lee «Guardando…», «Guardado» o «No se guardó: …».
- Etiquetas nuevas: `stepMissing`, `stepOrder`, `stepNext`, `stepCount`, `timeInvalid`, `timeHint`,
  `timeEmpty`, `timeNowButton`, `timeClear`, `timeIsNow`, `timeAfternoon`, `timeAfter`, `timeAgo`,
  `timeBeforePrev`, `timeAfterNext`, `timeFuture`, `timeNoPrev`, `stateIdle`, `stateLive`,
  `stateDone`, `stateReview`, `timelineNow`, `saving`, `saved`, `saveError`.

## 0.4.7 — 2026-10-07

### `<nx-grid>`

- **Copiar como tabla.** Con varias celdas, Ctrl+C deja también una tabla HTML (`text/html`) con
  los encabezados de las columnas y lo que se ve en la tabla: montos con su formato, estados con su
  nombre y enlaces (`href` de la columna) que siguen siendo enlaces. Pegada en un correo o en un
  documento es una tabla con bordes finos y la cabecera en gris, no texto con tabuladores. El TSV
  sigue igual para quien pega texto (y para pegar de vuelta en la tabla). Excel y Sheets prefieren
  el HTML: ahora pegan también la fila de encabezados, cada monto como número y cada texto como
  texto (nada se vuelve fórmula, «00123» conserva los ceros). Una sola celda va solo como valor.
- **`toHTMLTable(head, rows, right)`** y el tipo `HtmlCell`, exportados junto a `toTSV`.

## 0.4.6 — 2026-10-06

### `<nx-grid>`

- **El segmento marcado se ve en oscuro.** En claro es blanco sobre el gris del fondo; en oscuro
  casi no se separaba de él. Ahora sube a un gris claro y lleva una línea.
- **«Todos» ya no dice el total filtrado con `source`.** Con las filas en el servidor, «Todos» decía
  el total de la consulta de ese momento, que con un atajo marcado es el del atajo («Todos 882» junto
  a «Contratos que vencen 882»). Ahora dice el total sin filtros ni búsqueda, el último que vio, y si
  todavía no lo vio (la tabla arrancó filtrada) va sin número.

## 0.4.5 — 2026-10-06

### `<nx-grid>`

- **Junto al título, los atajos son un filtro segmentado con «Todos».** Eran botones con borde, del
  mismo tamaño y aspecto que los botones de la cabecera de la página justo encima: dos pisos de
  cajas a la derecha, con la línea corta cortada y tarjetas en «0» que no decían nada. Ahora van en
  la fila de abajo del título: «Todos» (`labels.presetsAll`) y un segmento por atajo con su conteo,
  excluyentes, como pestañas que no salen de la página; pulsar el marcado (o «Todos») lo quita. La
  línea corta va al pasar el mouse. Los atajos que llevan a otra página (`href`) van después, como
  enlaces con su número y ↗. Sin título siguen siendo tarjetas.

## 0.4.4 — 2026-10-06

### `<nx-grid>`

- **Un texto propio para «no hay datos» (`labels.noRows`, «No hay filas»).** Sin filas y sin nada
  filtrado ni buscado, la tabla ya no dice «Ninguna fila coincide con los filtros» (que ahí era
  falso y ofrecía aflojar filtros que no había): dice `noRows`, donde la app pone lo que haya que
  hacer («Carga el catálogo con la carga masiva»). Con filtros o búsqueda que no dejan ninguna,
  sigue `labels.empty`.
- **`labels.rows` y `labels.of` aceptan «singular|plural»:** «1 desprendible», «2 desprendibles»
  (`of` elige por el total). Un texto sin «|», tal cual.

## 0.4.3 — 2026-10-05

### `<nx-grid>`

- **Con `client-max`, un origen sin modo servidor aguanta los filtros recordados.** La primera
  página sale con la consulta de ese momento; un origen que solo sabe responder la consulta
  completa rechaza filtros, búsqueda u orden, y al volver a la página con un filtro recordado la
  tabla se quedaba en «No se pudieron cargar las filas». Ahora, si esa primera página falla y pedía
  algo, la tabla prueba la consulta completa antes de dar el error y, si cabe, filtra aquí.
- **La fila del total y los filtros puestos va con sangría (18 px):** es de la tabla, no del mismo
  nivel que la barra de arriba.

## 0.4.2 — 2026-10-05

### `<nx-grid>`

- **Columnas fijas (`sticky: true`).** La columna no se va al desplazar la tabla a lo ancho (el
  nombre de la persona en una tabla con muchas columnas). Las fijas van primero, en su orden, y la
  de las casillas se fija con ellas. Son opacas y la última lleva una línea más marcada. El teclado
  no deja la celda activa tapada. Una etiqueta de grupo que ocupa varias columnas no se fija, todas
  fijas es ninguna, y con la tabla bajo 640 px no se fija nada.
- **Los atajos junto al título llevan un embudo**, no una flecha: filtran la tabla, no llevan a
  otro lado. Marcados, la ✕; los enlaces, ↗.
- **Las opciones de los filtros van en una línea con mouse** (el panel, el filtro de una columna y
  «Columnas»): el texto completo sale al pasar por encima. En una pantalla táctil siguen hasta en
  dos líneas, porque ahí no hay «encima».

### Núcleo

- **`nxSupported()`** dice si el navegador puede con la librería: `{ok, missing, minimum}`. En uno
  viejo no hay plan B por componente (los colores salen de `light-dark()` y los menús de la Popover
  API): la app lo pregunta al arrancar y avisa con claridad, con las versiones mínimas de `minimum`.
  Desde `nx32-elements/core` y la raíz.

## 0.4.1 — 2026-10-05

### `<nx-grid>`

- **Un atajo puede llevar a otra página (`href` en `GridPreset`).** Es un `<a href>` de verdad con
  el aspecto de los demás (Ctrl/⌘+clic abre otra pestaña y el router de la app lo navega), con ↗
  en lugar de la flecha, y nunca queda marcado porque no filtra. Su número solo lo manda el servidor
  (`presets` de la respuesta) y se conserva cuando la tabla pasa a contar en el navegador
  (`client-max`); sin él, el atajo va sin número. Una dirección que no es segura lo quita, `filters`
  puede faltar y `menu` no aplica. Como tarjeta, la ↗ va en la esquina.

## 0.4.0 — 2026-10-05

### `<nx-grid>`

- **Título con los atajos como botones (`heading`, `heading-level`).** El título va en la primera
  fila de la tabla y los atajos, como botones a su derecha: el número, el nombre, su línea corta y
  una flecha que, marcado, pasa a ✕. Si no caben al lado del título, bajan a la fila siguiente y se
  desplazan de lado. Es para la tabla que es la página: el título y los atajos viven con el estado
  de la tabla y no hay nada que sincronizar afuera. El nivel es 2 por defecto (1 si es el de la
  página) y el tamaño sale de `--nx-grid-heading-size`. Sin `heading`, los atajos siguen siendo
  tarjetas.
- **Alto del contenedor (`height="fill"`).** La tabla ocupa el alto de su contenedor y es lo único
  que se desplaza, así que su barra horizontal siempre se ve y la de arriba no se pone. El
  contenedor tiene que tener alto. El panel «Filtros» se desplaza dentro del suyo, y la tabla no baja
  de `--nx-grid-fill-min` (240 px). En Solid, `height="fill"`.
- **Atajos de menú (`menu: true` en `GridPreset`).** Van en «Vistas», en el grupo «Seguimiento»
  (`labels.viewTracking`), sin conteo: ni la tabla lo cuenta ni el servidor tiene que mandarlo. Se
  marcan y se quitan como las tarjetas. Con atajos de menú, «Vistas» aparece aunque no haya
  `views-storage`, y entonces solo trae ese grupo.
- **El total va arriba, con los filtros.** «**9.704** filas» abre la fila de los filtros puestos,
  con el número en negrita. El pie queda para los totales de los montos y las cuentas de un rango
  marcado, y no ocupa nada si no tiene ninguno. Para quien leía el conteo en `.nx-grid__foot`: ahora
  está en `.nx-grid__count`.
- **Un solo «Limpiar todo».** Va en la fila de los filtros puestos; el del encabezado del panel
  «Filtros» se quitó.
- La galería tiene una sección «La tabla como página» con las cuatro cosas juntas.

## 0.3.3 — 2026-10-05

### `<nx-grid>`

- **Opciones completas en los filtros.** En el panel de facetas, el filtro por columna y
  «Columnas», el texto de cada opción ocupa hasta dos líneas antes de cortarse y lleva el nombre
  completo en `title`. En una sola línea, dos subdivisiones que empiezan igual
  («ADMINISTRACION SM BAN…») se veían idénticas y nada mostraba el resto.
- **Iniciales que trae la fila (`initials` en la columna).** Nombra la clave de la fila con las
  iniciales del avatar, hasta tres letras y en mayúsculas. Sin ella siguen saliendo de las dos
  primeras palabras del texto, que con dos nombres y dos apellidos son dos nombres («Luis Fernando
  Ortega Salas» da LF, no LO). Una clave que no es texto se quita.
- **La celda activa no aparece enmarcada al cargar.** El recuadro sin foco, que marca dónde se iba,
  aparece solo cuando alguien ya entró a la tabla. Antes, el de la primera celda parecía un borde
  suelto.

## 0.3.2 — 2026-10-04

### `<nx-grid>`

- **Atajos con tono (`tone` en `GridPreset`: `info`, `success`, `warning`, `danger`).** El conteo
  va en ese color y, marcado, la tarjeta también (fondo y borde del tono en vez de los del color
  principal). Es para el atajo que señala algo por resolver («Sin jefe asignado» en `warning`); los
  demás siguen sin tono. `neutral`, o un tono que no existe, no pinta nada (el segundo se quita).
- **Avatares en gris (`avatar: "neutral"` en la columna).** Las mismas iniciales, todas con el gris
  de la píldora sin tono en vez de un color por persona: para la columna que más se lee, donde
  quince tonos distintos compiten con los de la tabla. `avatar: true` sigue igual.
- Los atajos (`presets`) quedan documentados en el README, que no los nombraba.
- `npm run contrast` revisa también el conteo de un atajo con tono sobre la tarjeta y el avatar
  neutro.

## 0.3.1 — 2026-10-04

### `<nx-button>`

- **`href`: el botón como enlace.** Con dirección, el control de adentro es un `<a href>` de verdad
  en vez del `<button>`, con el mismo aspecto y las mismas variantes: Ctrl/⌘+clic, la rueda y el
  menú del navegador funcionan, y el router de la app lo intercepta como a cualquier enlace.
  `new-tab` (en Solid, `newTab`) abre en otra pestaña con `rel="noopener noreferrer"`; `download`
  descarga. Una dirección que no es segura no se pinta, y deshabilitado u ocupado el enlace pierde
  su `href` (ni un Ctrl/⌘+clic lo sigue). Con `href` no aplican `type`, `name`, `value` ni `stream`.
  Aparecer o irse `href` cambia el control sin perder etiqueta, ícono ni oyentes.
- **Se retira la clase `nx-button` de la 0.2.5.** Servía para vestir un `<a>` suelto de botón; con
  `href` el enlace es el propio componente, y las clases vuelven a ser internas. Para migrar:
  `<a class="nx-button nx-button--primary" href="/x">Ir</a>` →
  `<nx-button variant="primary" href="/x" label="Ir"></nx-button>`.

### Versiones

- La 0.3.0 (enlaces y acciones de fila de `<nx-grid>`) salió de una rama antes de entrar a `main`, y
  la 0.2.5 salió de `main` sin ella. Las dos están en esta versión.

## 0.3.0 — 2026-10-04

### `<nx-grid>`

- **Enlaces de verdad (`href` en la columna).** `{ key: "oc", label: "Pedido", href: "detalle_url" }`
  pinta un `<a href>` en las filas que traen esa clave: Ctrl/⌘+clic o la rueda abren otra pestaña,
  el clic derecho da el menú del navegador y un router de la app lo intercepta como a cualquier
  enlace. Abrir la fila (Enter, doble clic, segundo toque) lo sigue con ese mismo clic y **no**
  emite `nx-grid-open`. `newTab` pone `target="_blank"` y `rel="noopener noreferrer"`. Una dirección
  que no es segura (`javascript:`, `data:`…) no se pinta: la celda queda como `link`. `href` implica
  `link`.
- **Columnas que empiezan escondidas (`hidden` en la columna).** La persona las muestra desde
  «Columnas»; restablecer (o la tabla original de las vistas) las vuelve a esconder, y ese botón lo
  dice (`columnsResetDefault`: «Volver a las columnas de la tabla, con su ancho original»).
  Reasignar `columns` no vuelve a esconder lo que la persona mostró. Un `view` sin `hidden` deja
  escondidas las declaradas; con `hidden: []`, todas a la vista.
- **Acciones de fila (`actions`, propiedad o atributo JSON; en Solid, `actions` y `onAction`).** Una
  columna fija a la derecha, opaca, fuera de los filtros, la búsqueda, la exportación y «Columnas».
  Cada acción: `key`, `label`, `icon` (del registro: queda solo el ícono, con `aria-label` y
  `title`), `tone: "danger"`, `href` (clave de la fila con la dirección: un enlace, con `newTab` y
  `download`; una fila sin dirección segura no la muestra) y `when` (clave de la fila que dice si
  aplica). Un botón emite **`nx-grid-action`** `{action, id, row}`; un enlace no emite nada. Con el
  teclado, las acciones salen primero en el menú de la celda (Mayús+F10, tecla de menú o clic
  derecho), aunque la columna no se filtre (`labels.rowActions`). Tocar la columna deja el foco en
  la tabla y su fila como la activa. Una `key` repetida, o una acción sin `key` o `label`, se
  descarta.
- Clic derecho sobre un enlace (el de una celda o el de una acción): el menú del navegador, no el
  de la tabla.
- Nuevos textos: `labels.actions` («Acciones», la cabecera para lectores de pantalla) y
  `labels.rowActions` («Acciones de la fila»). Nuevos tipos: `GridAction`, `GridActionDetail`.

## 0.2.5 — 2026-10-04

### `<nx-button>`

- **Clase `nx-button`** para un `<a>` (o un `<button>`) con el aspecto del botón, sin JS:
  `<a class="nx-button nx-button--primary" href="/empleados">`. Trae la tipografía del componente,
  quita el subrayado y el color de enlace, da 16 px al ícono que vaya dentro y se apaga con
  `aria-disabled="true"` (en un `<a>`, además, deja de responder al clic). Las variantes son las
  mismas: `--primary`, `--danger`, `--ghost`.

## 0.2.4 — 2026-10-03

### `<nx-grid>`

- **`accents="exact"`** (propiedad `accents`: `"fold"` o `"exact"`; en Solid, `accents="exact"`):
  la tabla busca y filtra sin mayúsculas pero **con** tildes y ñ, en NFC. «peña» encuentra «PEÑA»
  y «Peña», pero «pena» no encuentra «PEÑA», «tecnico» no encuentra «TÉCNICO» y «Llinas» no
  encuentra «Llinás». Una «é» compuesta y una «e» + U+0301 siguen siendo la misma letra. Es para
  datos de un ERP en mayúsculas cuyo servidor compara así: con todas las filas en el navegador, la
  tabla encuentra lo mismo que con `source`. Rige en «Buscar en la tabla», el «contiene» de una
  columna (su muestra, lo resaltado y su aviso, con el texto nuevo `labels.containsHintExact`), el
  buscador de la lista de valores del filtro y el de las facetas. Cambiarlo con algo buscado vuelve
  a filtrar con la nueva regla.
- **Sin el atributo, nada cambia:** la tabla sigue sin distinguir tildes ni mayúsculas
  («porteria» encuentra «Portería»), igual que el resto de la librería (select, paleta, menú,
  lanzador, tarjetas…). Lo que interpreta lo escrito (un estado escrito en una celda, montos como
  «5 millones», el nombre de una vista repetido) sigue tolerando la tilde que falta en los dos
  modos.
- `applyFilters` y `crossfilter` aceptan la regla como último argumento (`"fold"` por omisión).
  Nuevo tipo `GridAccents`.

## 0.2.3 — 2026-10-03

### Íconos

- **`nx32-elements/icons/lucide`**: el catálogo completo de Lucide (1853 íconos de
  @iconify-json/lucide 1.2.136), un export por ícono con su nombre en PascalCase
  (`chart-column` → `ChartColumn`). Un bundler se queda con los que la app importa. Sólo los
  nombres vigentes: ni alias ni retirados.
- **`iconExportName(nombre)`** en `nx32-elements/icons`: el export que corresponde a un nombre.
- **El juego pequeño (`lucide`) ya no usa alias**: `building-2` pasa a `building-complex` y
  `circle-help` a `circle-question-mark`. Si registrabas `lucide` y usabas esos dos nombres,
  cámbialos.

## 0.2.2 — 2026-10-03

### `<nx-account>`

- **`appearance="false"`** (en Solid, `appearance={false}`): quita Tema y Color del panel y de la
  paleta de comandos, y la cuenta deja de tocar `<html>` (`data-theme`, `data-nx-palette`), tampoco
  con lo que alguien guardó antes. Para una app que maneja su propia apariencia; los recientes de
  empresa se siguen leyendo de `storage`.

## 0.2.1 — 2026-10-03

### `<nx-grid>`

- **Panel de filtros:** las opciones sin filas ya no aparecen deshabilitadas: se ocultan. Una
  opción marcada que queda en 0 sigue a la vista, para poder desmarcarla. Una faceta sin ninguna
  opción desaparece, y «Ver N más» y la búsqueda de la faceta cuentan solo las que se ven.
- **«Columnas» y «Vistas»:** volver a pulsar el botón con el menú abierto lo cierra (antes lo
  volvía a abrir).

## 0.2.0 — 2026-10-03

Revisión de calidad multiagente de `<nx-button>`, `<nx-select>`, `<nx-dialog>`, `<nx-tabs>`,
`<nx-fields>`, `<nx-notice>`, `<nx-badge>`, `<nx-sidemenu>`, `<nx-breadcrumb>`, `<nx-command>`,
`<nx-launcher>`, `<nx-account>`, `<nx-grid>` y de lo transversal (núcleo, empaquetado, BDUI,
envoltorios de Solid y tokens). Cada hallazgo pasó por una verificación adversarial antes de
arreglarse, y cada arreglo, por una revisión de su diff. Son unos 200 arreglos de corrección,
seguridad, accesibilidad, rendimiento y estabilidad, con sus pruebas (vitest y Playwright en
Chromium y Firefox).

**Esta versión rompe la API.** Lee «Migrar desde 0.1» antes de actualizar.

### Migrar desde 0.1

**Eventos.** Cada evento propio de un componente se llama ahora `nx-<componente>-<acción>`.
`nx-open-change` sigue siendo el evento compartido. Los controles de formulario emiten además un
`change` nativo que burbujea, para el código genérico (marcar sucio, frameworks).

| Antes | Ahora |
|---|---|
| `nx-done` (`<nx-button>`) | `nx-button-done` |
| `nx-change` (`<nx-select>`) | `nx-select-change` (+ `change` nativo) |
| `nx-change` (`<nx-number>` y la corrección de `<nx-guard>`) | `nx-number-change` |
| `nx-change` (`<nx-date-range>`) | `nx-date-range-change` (+ `change` nativo) |
| `nx-change` (`<nx-recurrence>`) | `nx-recurrence-change` |
| `nx-select` (`<nx-sidemenu>`) | `nx-sidemenu-select` |
| `nx-toggle` (`<nx-sidemenu>`) | `nx-sidemenu-toggle` |
| `nx-tab-change` (`<nx-tabs>`) | `nx-tabs-change` (tipo `TabsChangeDetail`; `TabChangeDetail` queda como alias obsoleto) |
| `nx-ai-start`, `-done`, `-action`, `-feedback` | `nx-ai-answer-start`, `-done`, `-action`, `-feedback` |
| `nx-capture-file`, `-start`, `-done`, `-change`, `-submit` | `nx-doc-capture-file`, `-start`, `-done`, `-change`, `-submit` |
| `nx-keytip` | `nx-keytips-activate` (Solid: `onKeytip` → `onActivate`) |
| `nx-scan` | `nx-scan-read` (Solid: `onScan` → `onRead`) |

Ya no existe la declaración global de `nx-change` en `HTMLElementEventMap`. Si escuchabas
`nx-change` para marcar un formulario como modificado, escucha `change`.

**Nada de props que sean funciones u objetos vivos** (principio 2):

- `<nx-breadcrumb>`: se quitó `loadChildren` (y el tipo `BreadcrumbLoader`). Para pedir los
  hermanos bajo demanda, usa el atributo `children-endpoint` (plantilla con `{id}` y `{level}`,
  del mismo origen) o atiende el evento cancelable `nx-breadcrumb-expand` y responde con
  `detail.respond(...)`. En Solid: `childrenEndpoint` y `onExpand`. Sin `children-endpoint`, un
  nivel sin `children` solo abre su separador si lleva `expandable: true`.
- `<nx-account>`: `sync` es ahora el **nombre** de la cola de `nx-sync` (atributo y propiedad de
  texto, p. ej. `sync="nx-sync:ana"`), no el objeto de la cola. Se quitó `AccountSyncQueue`.
- BDUI: una clase puede declarar `static localProps`; `propsOf()` no las lista y `render()` las
  rechaza con aviso.

**Envoltorios de Solid.** Ignoran los eventos del mismo nombre que burbujean desde un hijo (antes
un `<nx-date-range>` dentro de un `<Dialog>` controlado cerraba el diálogo). Los que no tienen
hijos ya no aceptan `children`.

### Eliminado

- **Bloqueo de pantalla de `<nx-account>`**: atributos `lock`, `lock-after` y `lock-endpoint`,
  propiedad `lockVerify`, método `lock()`, Ctrl+L, la fila y el comando «Bloquear»
  (`account:lock`), el evento `nx-lock-change`, `sessionStorage["nx-locked"]`,
  `data-nx-locked` y su label. Era un bloqueo solo de la pestaña y del cliente: abrir la app en
  otra pestaña lo saltaba sin herramientas.

### Cambios por componente

**`<nx-grid>`**
- La edición abierta ya no cae en otra fila cuando cambian los datos, el filtro o el orden. Si la
  app reasigna `rows`, `filters`, `sort`, `search`, `columns` o `group-by`, sigue abierta en su
  fila. Si la fila quedó oculta, se guarda en su registro. Si desaparece la fila o la columna, se
  descarta y se anuncia (`labels.editLost`). Con `source`, se guarda antes de cada consulta.
- Teclado según el patrón grid de la APG: la tabla es una sola parada de Tab. ↑ desde la primera
  fila lleva a la cabecera, ←/→ recorren las cabeceras, Alt+↓ abre el filtro y Ctrl+←/→ cambia
  el ancho. Los botones de la cabecera y las asas ya no son paradas de Tab.
- `row-key` se observa: asignarlo después de `rows` reindexa. Un id repetido recibe un id
  posicional y se avisa por consola.
- Columnas y filtros que llegan de BDUI se normalizan (opciones, anchos, tipos, valores de
  `in`/`notIn`, rangos).
- Las filas guardadas son objetos sin prototipo (`Object.create(null)`).
- Con `source`: un bloque que falla emite `nx-grid-error` y se reintenta con espera creciente
  (hasta 5 veces; después, «Reintentar» o `refresh()`). El aviso sin filas pasa de `<p>` a
  `div[role=row]` (misma clase). Los bloques lejanos se liberan. El alto virtual tiene un tope
  (8.000.000 px) con escala. Asignar `rows` o `columns` ya no vuelve a pedir datos.
- `exportXlsx()` resuelve con el número de filas y emite `nx-grid-export`. Los errores de
  exportación se anuncian. La hoja se arma por partes, sin el límite de cadena de V8.
- Rendimiento: filtrar o buscar ya no reordena todo (el orden se cachea), `in`/`notIn` usan `Set`
  y el texto plegado se calcula una vez por dato.
- Foco y celda activa visibles en alto contraste (forced-colors).
- `facets-open` abre el panel de arranque solo si cabe al lado de la tabla (640 px o más); más
  angosta, queda cerrado tras el botón «Filtros». Se juzga una vez, y lo que se abra con el botón
  no se vuelve a cerrar.

**`<nx-select>`**
- Participa de verdad en formularios: `required` con aviso visible, `reset()` vuelve al valor
  inicial, `name` tardío, `<fieldset disabled>` y la API de validez. `checkValidity()` del
  elemento no marca `aria-invalid` (`reportValidity()` y el envío fallido, sí).
- Enter en el buscador sin resultado ya no envía el formulario.
- `<label for>` y `aria-labelledby` le dan nombre al combobox. El combobox declara
  `aria-haspopup="dialog"` y el popover es `role="dialog"`. El buscador ya no usa `autofocus`.
- Un `value` repetido en las opciones se descarta con aviso. `multiple` ya no recorta el valor
  inicial según el orden de las props.

**`<nx-button>`**
- Los clics en el envoltorio, en «Registro» o en su panel ya no saltan `busy`, `disabled` ni
  `hold`. Acepta `type="reset"`, `name`, `value` e `icon-only` (con nombre accesible).
- El registro se actualiza en su lugar: el lector de pantalla solo anuncia lo nuevo.
- La pulsación larga (`hold`) no abre el menú contextual del toque largo.

**`<nx-dialog>`**
- Abrir y cerrar seguidos (con View Transitions) ya no desincroniza el estado.
- Tab sigue el orden en que se ve (cabecera, cuerpo, aviso, pie) sin atrapar el foco. Al cerrar
  un panel apilado, el foco vuelve al botón que lo abrió.
- Escape dentro de un popover del autor cierra solo el popover. Las tarjetas de la librería
  (`nx-explain`, `nx-trend`, `nx-tour`) reciben el foco encima del diálogo.
- Sin `heading` no pone `aria-labelledby`, y respeta el del autor.

**`<nx-tabs>`, `<nx-fields>`, `<nx-notice>`, `<nx-badge>`**
- `<nx-tabs>`: botones actualizados en su lugar, pestaña activa visible en alto contraste, orden
  de lectura con `aria-owns` y contadores con `nxFormat`.
- `<nx-fields>`: un repintado ya no borra lo escrito ni el foco (en los items con `key`). Ningún
  número se redondea sin que la persona lo toque. Nuevo método `reset()`.
- Quitar un atributo JSON (`items`, `labels`, `actions`, `errors`…) vuelve al valor por defecto.

**`<nx-sidemenu>`**
- Un cambio de `items`, `labels` o `collapsed` ya no cierra el flotante abierto: espera a que se
  cierre.
- En compacto, el nombre de cada ítem sale en una etiqueta flotante accesible (antes `title`).
- `open` sale de `beforetoggle`/`toggle` y se resetea al sacar el drawer del DOM.

**`<nx-breadcrumb>`**
- El menú de hermanos tiene tabindex itinerante y foco visible en alto contraste. Tab vuelve al
  separador. Abre hacia arriba cerca del borde, sigue a RTL y no abre el teclado virtual en
  táctil.
- Si el módulo del menú no carga, el separador navega al `href` de su nivel.

**`<nx-command>` y `<nx-launcher>`**
- Un atajo sin modificador («/») funciona con teclados español y latinoamericano, y escribirlo en
  la caja no cierra la paleta. Respeta IME (`isComposing`).
- La paleta se reabre tras sacarla del DOM abierta. El resaltado no salta al llegar `source`, y
  la lista vuelve arriba al escribir.
- Se anuncian «N resultados», «Sin resultados», «Buscando…» y los errores. El listbox nunca queda
  sin opciones.
- `<nx-launcher>`: las vistas ocultas siguen en el árbol de accesibilidad, el medidor tiene
  texto y los enlaces inseguros se descartan.

**`<nx-account>`**
- Cierre de sesión por **POST** (formulario con `logout-csrf` en `logout-csrf-field`, `_csrf`
  por defecto). `logout-method="get"` conserva la navegación GET.
- Salir de «Ver como» es cancelable (`nx-account-view-as {user:null}`). La franja va en la
  entrada y se reintenta si falla.
- Inyección de CSS por el color de una paleta, el reemplazo con `$&` en los textos y los avatares
  rotos, arreglados. Quitar un atributo JSON resetea la propiedad.

### Núcleo, empaquetado y tokens

- Nueva subruta sin efectos **`nx32-elements/core`** (`registerIcons`, `hasIcon`,
  `allowOrigins`, `safeEndpoint`, `safeHref`, `nxFormat`, `resolveLocale`, `canonicalLocale`):
  ya no hace falta importar la raíz, que registra todos los componentes.
- Todas las hojas por pieza se exportan (`nx32-elements/<pieza>.css`), y también
  `nx32-elements/package.json` y la condición `default`.
- `nxFormat().parse` no devuelve un número equivocado en silencio: entiende separadores mezclados
  («1,234.56» en es-CO), negativos contables «(1.234)» y el signo menos U+2212, y devuelve `null`
  ante lo ambiguo («12.34,5», fechas, horas). «0.123» en es y «0,500» en en se leen como
  decimales. `nxFormat().date` devuelve tal cual una fecha inexistente.
- Cambiar `<html lang>` (por ejemplo, el selector de idioma de `<nx-account>`) repinta los
  componentes que dependen del locale.
- `tokens.css`: tokens y `color-scheme` dentro de `:where()`, así que la app los sobreescribe sin
  depender del orden. `.nx-spinner`, `@keyframes nx-spin` y la base de los íconos pasan de
  `button.css`/`sidemenu.css` a `tokens.css`.
- `nx-sync`: `createSync({name})` registra la cola por nombre (`syncQueue(name)`,
  `onSyncQueue(name, fn)`).
- `npm run size` solo informa el peso frente a su referencia: por ahora, primero que todo
  funcione, después se optimiza (`NX_SIZE_STRICT=1` vuelve a exigir los topes).
