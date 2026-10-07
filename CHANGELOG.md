# Registro de cambios

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
  primeras palabras del texto, que con dos nombres y dos apellidos son dos nombres («Abel Andres
  Hernandez Carrillo» da AA, no AH). Una clave que no es texto se quita.
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
