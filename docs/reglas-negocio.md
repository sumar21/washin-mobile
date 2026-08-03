# Reglas de negocio — Washinn Mobile

Documento de reglas de negocio codificadas en la app. **Solo refleja lo que está explícitamente en el código o en la documentación del proyecto**; nada es inventado. Cada regla cita su fuente.

> Para el detalle de flujos PowerApps ver [msapp-flujos-validacion.md](msapp-flujos-validacion.md) y [powerapps/incidentes.md](powerapps/incidentes.md).

---

## Terminología clave: OT = Incidente

El negocio llama **OT (Orden de Trabajo)** a lo que la app representa internamente como **Incidente** (`10.Incidentes`). En código, rutas, UI y docs del proyecto se usa siempre el término **"Incidente"**. Esta equivalencia es intencional y explícita. Usar uno u otro nombre depende del contexto (negocio vs técnico), pero refieren a la misma entidad.

---

## Roles y acceso

> **Nota de arquitectura:** existe una **app de escritorio separada** (fuera de este repo) que gestiona la parte administrativa del flujo de OT: asignación de incidentes a técnicos, elección/aprobación de la máquina de reemplazo, descuento de stock al asignar, ABM y métricas. La **app mobile es la herramienta del técnico en campo**: recibe las OTs ya asignadas, las **resuelve** (confirmando repuestos, ejecutando el swap de máquina y reingresando lo no usado a `04.Stock`) y ejecuta las acciones del técnico.

- Los tres roles del sistema son **Técnico**, **Supervisor** y **Admin**. ([`api/_lib/jwt.ts`](../api/_lib/jwt.ts), [docs/arquitectura.md](arquitectura.md))
- Las rutas `/abm`, `/edificios/nuevo`, `/personas/nueva` y `/mails` están **gateadas a Admin** exclusivamente mediante `RoleGuard`. ([`src/routes.tsx:55`](../src/routes.tsx))
- El módulo **ABM** (configuración) y el compositor de **Mails** solo aparecen en el menú de Admin. ([`src/lib/nav.ts:16`](../src/lib/nav.ts))
- El **técnico solo ve sus propios datos** en listas, incidentes y ventilaciones. El Admin/Supervisor ve todo sin scope.
  - Registros de visita: `01.Registros.Nombre = login del técnico`. ([`api/_lib/planificaciones.ts:118`](../api/_lib/planificaciones.ts))
  - Incidentes: **solo lo ASIGNADO** → `TecnicoAsignado_IN = NombreUser (Concat) OR TecnicoAsignado_IN = login`. Se **removió** el match por `User_IN` (login del creador): antes el técnico veía también lo que él reportó para OTRO técnico. El KPI de incidentes activos del Home usa el mismo criterio. ([`api/_lib/incidentes.ts:165-177`](../api/_lib/incidentes.ts), [`api/_lib/home.ts:120-130`](../api/_lib/home.ts))
  - Ventilaciones: `IDAsignado_VE = ID del técnico logueado`. ([`api/_lib/ventilaciones.ts:106`](../api/_lib/ventilaciones.ts))
- La **app mobile es exclusivamente para técnicos**. ABM de personas/edificios y Métricas son de la **app de escritorio** (fuera de este repo). ([docs/msapp-flujos-validacion.md](msapp-flujos-validacion.md))
- El **cierre del incidente "Asignado" lo ejecuta el TÉCNICO desde la mobile** (`resolverAsignadoIncidente`): confirma los repuestos ya asignados, y el sistema devuelve lo no usado a `04.Stock` y —si es cambio de máquina— hace el swap en `08.DetalleMaquina`. Ver sección **Resolver (incidente "Asignado")** abajo. Lo que sigue en escritorio es la **asignación** previa (elegir qué máquina, aprobación) y el ABM/métricas. ([`api/_lib/incidentes.ts`](../api/_lib/incidentes.ts))
- La **asignación del estado "Asignado"** a un incidente la hace un **Admin o Supervisor desde la app de escritorio**. La app mobile no asigna OTs; las recibe ya asignadas. (Confirmado por el usuario.)

---

## Visitas / Planificaciones

- **Un técnico solo puede tener UNA visita "Pendiente" (en curso) a la vez.** Esta regla se verifica al intentar iniciar una nueva visita y para ofrecer "continuar" la anterior. ([`api/_lib/planificaciones.ts:544`](../api/_lib/planificaciones.ts))
- **Visita de circuito vs visita espontánea:** una visita espontánea se distingue porque `UnivocoCircuito_R` queda vacío en `01.Registros`. El combo de edificio es libre; no hay circuito planificado que escalar. ([`api/_lib/planificaciones.ts:570`](../api/_lib/planificaciones.ts))
- **Doble verificación de presencia (geo + QR):** la geolocalización abre el "Pendiente" pero no es suficiente; el técnico debe además escanear el QR del edificio (`qrScanned`) para confirmar la presencia. ([docs/msapp-flujos-validacion.md — tabla Visitas](msapp-flujos-validacion.md))
- **Radio de geofencing:** 150 metros (haversine). Reemplaza al bounding-box asimétrico de PowerApps. Soporta hasta 2 pares de coordenadas por edificio. ([`src/lib/geo.ts:11`](../src/lib/geo.ts))
- **Cancelar visita:** solo cancela el registro "Pendiente" que matchea `técnico + código de edificio + mes-año`. Si no existe ese registro, no crea uno nuevo (paridad con el `LookUp` de PowerApps que no hace nada si es Blank). ([`api/_lib/planificaciones.ts:654-675`](../api/_lib/planificaciones.ts))
- **Contador de visitas:** `cantidadVisitas` = cantidad de registros `Finalizado` del técnico para ese código de edificio en el mes en curso. `ultimaVisita` = `FechaTerminada_R` del Finalizado más reciente del técnico. `ultimaVisitaEdificio` = ídem pero de cualquier técnico (para mostrar "Ult Visita" del edificio). ([`api/_lib/planificaciones.ts:300-325`](../api/_lib/planificaciones.ts))
- **Scope mensual:** circuitos, edificios a visitar y registros se filtran por `MesAno_DP/EV/R = mm/yyyy`. El mes se genera con la fecha local argentina. ([`api/_lib/planificaciones.ts:33`](../api/_lib/planificaciones.ts))
- **Mail al finalizar visita:** se envía automáticamente al correo del edificio (fallback `washinn@sumardigital.com.ar` si no tiene) + Bcc al `MailSumar` del módulo "Checklist" en `99.ABM_Emails`. **Best-effort: nunca bloquea el guardado.** ([`api/_lib/planificaciones.ts:829`](../api/_lib/planificaciones.ts))
- **Mail al cancelar visita:** se envía al edificio + `paul.risau@wash-innsystem.com.ar` + `pablo.tecnico@wash-innsystem.com.ar`, Bcc `MailSumar` de "Checklist". **Best-effort.** ([`api/_lib/planificaciones.ts:697-720`](../api/_lib/planificaciones.ts))

### Destinatarios internos — regla global de TODOS los mails

> **Las casillas `@sumardigital.com.ar` van SIEMPRE en Bcc, nunca visibles en el To.**

Vale para los cuatro mails automáticos actuales **y para cualquiera que se agregue después**. Por eso se aplica en `sendMail` ([`api/_lib/mail.ts`](../api/_lib/mail.ts), función `repartirDestinatarios`), que es el único punto por el que pasan todos los envíos — no en cada armador. Un mail nuevo la hereda sin hacer nada.

- La decisión es **por dominio**, no por una lista de direcciones: una casilla nueva de Sumar queda cubierta sola.
- Cada armador sigue pidiendo el To que quiera; el transporte reparte. Si una dirección interna venía en el To, se mueve al Bcc; si ya estaba en el Bcc, no se duplica.
- **Excepción única:** si *todos* los destinatarios son internos no se mueve nada — un mail sin To no se puede enviar, y ahí no hay a quién ocultarle la dirección.
- Motivo: la app le escribe a consorcios y a Wash Inn. Que vean nuestras direcciones internas en el encabezado no aporta y expone a quién le llega cada aviso.
- Cubierto por tests offline en [`api/_lib/mail.test.ts`](../api/_lib/mail.test.ts) (`npx tsx api/_lib/mail.test.ts`), incluido el caso borde de "solo internos".

---

## OT / Incidentes

> **OT = Incidente** (ver encabezado).
>
> **Nota de arquitectura:** la app mobile cubre la parte del técnico en campo (alta, revisar y **resolver**). La **asignación** de OTs y la **elección/aprobación** de la máquina de reemplazo viven en la **app de escritorio separada** (fuera de este repo).

### Estados

`Status_IN` ∈ { `A Revisar`, `Pendiente`, `Asignado`, `En Aprobacion`, `Aprobada`, `Resuelto`, `Anulado` }.

- **Activo** = `Resuelto_IN = "NO"` (filtro de la lista abierta).
- **Cerrado** = `Resuelto_IN = "SI"` (aplica tanto a "Resuelto" como a "Anulado").
- ([docs/powerapps/incidentes.md — Modelo de estados](powerapps/incidentes.md))

### Alta

- **Toda OT creada desde la mobile entra como `"A Revisar"`.** No existe flujo en la mobile para crear una OT ya resuelta desde el alta. (Confirmado por el usuario.) El estado inicial es siempre `Status_IN = "A Revisar"`, `Resuelto_IN = "NO"`.
- **Alta rápida** (`crearIncidente`): crea el incidente con `Status_IN = "A Revisar"`, `NoResuelto_IN = "Reportado Por Tecnico"`, `Resuelto_IN = "NO"`. Categoría por defecto `"Agua"` si no se especifica. ([`api/_lib/incidentes.ts:194-219`](../api/_lib/incidentes.ts))
- **Alta completa** (`crearIncidenteCompleto`): permite especificar categoría, modo de acción, repuestos y foto desde la creación. Si el modo resuelve (`Cambio Repuesto` o `Resuelto Sin Repuesto`), el incidente nace con `Status_IN = "Resuelto"`, `Resuelto_IN = "SI"`. ([`api/_lib/incidentes.ts:551-616`](../api/_lib/incidentes.ts))
- **Categorías válidas (`Categoria_IN`):** hardcodeadas en la UI. Valores: `["Tildado", "Todo Funcionando", "Mecanico", "Placa"]`. No vienen de un catálogo SharePoint. ([`src/screens/ScreenIncidenteForm.tsx:32`](../src/screens/ScreenIncidenteForm.tsx) — constante `CATEGORIAS`)
- Tras crear, se notifica al técnico asignado por **WhatsApp** (client-side: `window.open("https://wa.me/54…?text=…")`). ([docs/powerapps/incidentes.md — sección WhatsApp](powerapps/incidentes.md))

### Asignación

- **La lista y el KPI del técnico muestran SOLO lo asignado a él** (`TecnicoAsignado_IN`), no lo que reportó para otro. El match por `User_IN` (login del creador) fue removido de `listIncidentes` y del KPI de Home. El detalle individual (`getIncidente`, al abrir un incidente por URL) sí conserva el match por `User_IN` para que el creador pueda abrir uno propio. ([`api/_lib/incidentes.ts:120-177`](../api/_lib/incidentes.ts), [`api/_lib/home.ts:120-130`](../api/_lib/home.ts))
- El estado **"Asignado"** lo pone un **Admin o Supervisor desde la app de escritorio** (fuera de este repo). La app mobile no tiene ninguna acción para asignar una OT. Es el gate para que el técnico pueda resolver. (Confirmado por el usuario.) ([docs/msapp-flujos-validacion.md — decisiones de negocio](msapp-flujos-validacion.md))

### Gates de acción (paridad PowerApps)

- **"Resolver"** solo disponible cuando `Status_IN = "Asignado"` Y el `TecnicoAsignado_IN` es el técnico logueado. ([docs/msapp-gap-review.md — Listado #2](msapp-gap-review.md))
- **"Anular"** solo disponible cuando `Status_IN = "A Revisar"`. ([docs/msapp-gap-review.md — Listado #3](msapp-gap-review.md))

### Dos flujos distintos: "Revisar" vs "Resolver"

El técnico ve dos acciones diferentes según el estado del incidente (paridad PowerApps):

- **Revisar** (`Status_IN = "A Revisar"`): *diagnostica*. Elige resuelto/no y el modo (los 4 de abajo), fija máquina y categoría. Pantalla `ScreenIncidenteForm` (`/incidentes/:id/revisar`) + `resolverIncidente`.
- **Resolver** (`Status_IN = "Asignado"`): los repuestos ya vienen asignados; solo confirma el uso + observación + foto. Diálogo `ResolverIncidenteDialog` (2 pasos) + `resolverAsignadoIncidente`. Ver subsección **Resolver (incidente "Asignado")**.

#### 4 modos de resolución (flujo "Revisar")

Implementados en `resolverIncidente`. Cada modo tiene efectos distintos:

| Modo | `Resuelto_IN` | Consume stock técnico | Crea filas en `13.RepuestosIncidentes` | Mail |
|---|---|---|---|---|
| `Cambio Repuesto` | `"SI"` (`Status="Resuelto"`) | Sí (`descontarStockTecnico`) | Sí | Sí |
| `Resuelto Sin Repuesto` | `"SI"` (`Status="Resuelto"`) | No | No | No |
| `Requiere Repuesto` | `"NO"` (`Status="Pendiente"`) | No | Sí (filas `Status_RI="Pendiente"`) | No |
| `Cambio de Maquina` | `"NO"` (`Status="Pendiente"`) | No | No | No — solo setea `MaquinaAsignada_IN`; el cambio real ocurre en escritorio |

([`api/_lib/incidentes.ts:337-490`](../api/_lib/incidentes.ts))

- **`Cambio de Maquina` en "Revisar" solo deja constancia** (`MaquinaAsignada_IN`) y deriva a la aprobación en escritorio. La **elección** de qué máquina reemplaza vive en la escritorio. Pero cuando ese incidente vuelve como **"Asignado"** y el técnico lo **Resuelve** en la mobile, ahí SÍ se ejecuta el swap real (ver subsección **Resolver**). (Confirmado por el usuario.)

- **Foto de resolución:** solo se guarda si el incidente queda **Resuelto** (`Cambio Repuesto` o `Resuelto Sin Repuesto`). Se escribe en `12.FotoIncidentes`. ([`api/_lib/incidentes.ts:472-475`](../api/_lib/incidentes.ts))
- **Mail "Incidente Resuelto":** se envía solo en modo `Cambio Repuesto`, únicamente a las casillas configuradas en `99.ABM_Emails`, con remitente `notificaciones@sumardigital.com.ar`. **No** se envía al edificio ni a ningún otro destinatario. Los armadores piden To = `[Checklist.MailSumar, Incidentes.MailWashinn]` y Bcc = `Checklist.MailSumar`, pero el reparto final lo decide el transporte (ver **Destinatarios internos** abajo): `Checklist.MailSumar` es del dominio propio, así que termina **solo en Bcc**. **Best-effort.** ([`api/_lib/incidentes.ts:477-487`](../api/_lib/incidentes.ts))
- **Descuento de stock:** `nueva Cantidad_RT = max(0, actual - usada)`. Se hace con Patch, nunca Remove. ([`api/_lib/incidentes.ts:391-407`](../api/_lib/incidentes.ts))

### Resolver (incidente "Asignado")

Flujo del botón **"Resolver"** (distinto de "Revisar"). Los repuestos ya están asignados; el técnico solo confirma. Implementado en `resolverAsignadoIncidente`; bifurca por `NoResuelto_IN` (paridad PA ~L1499). ([`api/_lib/incidentes.ts`](../api/_lib/incidentes.ts))

- **Caso `Requiere Repuesto`** (confirmar repuestos):
  - El técnico ve los repuestos de `13.RepuestosIncidentes` con un toggle **"Todos los repuestos"** (usó todo) o edita `Cantidad_RI` / elimina líneas. Luego **observación (obligatoria) + foto (opcional)**.
  - Al confirmar: incidente → `Resuelto`; cada línea ajusta `Cantidad_RI` (`Status_RI = "Anulado"` si queda 0) y **lo no usado (`asignado − usado`) REINGRESA a `04.Stock`** (los repuestos ya se habían comprometido al asignarse; **no** se toca el stock del técnico acá).
- **Caso `Cambio de Maquina`** (swap): sin paso de repuestos; **observación + foto opcional** y al confirmar se ejecuta el swap contra `08.DetalleMaquina` (máquinas identificadas por `ConcatMaquinaIncidente_DM`, la que trae la serie):
  - **Nueva** (`MaquinaAsignada_IN`) → `Status_DM = "INSTALADA"` en el edificio del incidente (hereda `Encendido_DM` del edificio).
  - **Vieja** (`ConcatMaquina_IN`) → `Status_DM = "DEPOSITO"`, `Edificio_DM = "Wash Inn"`, `CodigoEdificio_DM = "C-9999"`, y su unidad **reingresa `+1` a `04.Stock`** (clave `Item_ST`/interno `Lodge_ST`, por `ConcatMaquina_DM`).
- **Foto** opcional en ambos casos (`12.FotoIncidentes`). **Mail** "Incidente Resuelto" best-effort si hubo repuestos usados.
- **Reingreso a `04.Stock`, no descuento:** el descuento (comprometer stock al asignar) vive en la escritorio; la mobile solo reingresa al resolver. Ver [powerapps/incidentes.md](powerapps/incidentes.md).

### Anulación

- Patch `{ Status_IN: "Anulado", Resuelto_IN: "SI", DescripcionAnulado_IN: motivo }`.
- Se envía mail de anulación. To = `MailWashinn` del módulo "Incidentes" en `99.ABM_Emails` (fallback `MailSumar`). **No se hardcodea el destinatario** (corrección deliberada del bug de PA). **Best-effort.** ([`api/_lib/incidentes.ts:225-261`](../api/_lib/incidentes.ts))

### Destinatarios de mail

Todos los destinatarios se leen de `99.ABM_Emails` por `Modulo_EM`. No se hardcodean en el código (excepción histórica de PA corregida). ([`api/_lib/incidentes.ts:28-36`](../api/_lib/incidentes.ts))

### Historial de incidentes por máquina

- `IDMaquina` (`IDMaquina_IN` / `IDMaquina_DM`) **no es único**: la misma numeración se repite entre segmentos (lavadora/encendedora) y edificios. El historial de una máquina se acota por **clave compuesta `IDMaquina + CodigoEdificio`** para no mezclar incidentes de máquinas distintas con el mismo número. La máquina exacta se identifica por su id de ítem SharePoint. Detalle, residuales y base del reporte "incidentes por máquina" (repo de gerentes): [incidentes-por-maquina.md](incidentes-por-maquina.md). ([`api/_lib/maquinas.ts`](../api/_lib/maquinas.ts))

---

## Ventilaciones

- **Estados activos para el técnico:** `"Asignada"` y `"Programada"`. Scope por `IDAsignado_VE = ID del técnico`. ([`api/_lib/ventilaciones.ts:18,106`](../api/_lib/ventilaciones.ts))
- **Programar:** cambia `Estado_VE = "Programada"`, guarda `FechaProgramada_VE` y pone `Orden_VE = "2"`. ([`api/_lib/ventilaciones.ts:144-155`](../api/_lib/ventilaciones.ts))
- **Finalizar genera el próximo ciclo:** al finalizar (`Estado_VE = "Realizada"`), se crea automáticamente una nueva fila `Estado_VE = "Pendiente"` con `ProximaLimpieza_VE = hoy + Frecuencia_VE días`. La nueva fila **no tiene técnico asignado** (lo asigna un flujo externo). ([`api/_lib/ventilaciones.ts:159-201`](../api/_lib/ventilaciones.ts))
- **Adelantar una ventilación pendiente** (desde incidente): NO crea una fila nueva. Patchea la ventilación `"Pendiente"` seleccionada: `ProximaLimpieza_VE = hoy` + `EsIncidente_VE = "SI"`. El `Estado_VE` no cambia. ([`api/_lib/ventilaciones.ts:126-142`](../api/_lib/ventilaciones.ts))
- **`EsIncidente_VE`:** campo de trazabilidad. `"SI"` cuando la ventilación fue adelantada o creada desde un incidente; `"NO"` en ciclos normales generados al finalizar. ([`api/_lib/ventilaciones.ts:126-142`](../api/_lib/ventilaciones.ts) y [`api/_lib/ventilaciones.ts:185`](../api/_lib/ventilaciones.ts))
- **Foto de finalización:** la UI la captura pero **no se sube** (falta el equivalente a `WashInn-FotoVentilacion.Run` de PowerApps). Gap conocido. ([docs/msapp-flujos-validacion.md — Gaps #1](msapp-flujos-validacion.md))

---

## Descanso

- **Máximo 1 descanso por día por técnico.** Si ya hubo un descanso en el día (activo o finalizado), se lanza `BreakAlreadyUsedError` y no se permite otro. ([`api/_lib/break.ts:30-31,89-90`](../api/_lib/break.ts))
- El scope es por **login** (`User_HD = VarUsuario`), no por el nombre concatenado (`Concat_Nombre_Apellido`). ([`api/_lib/break.ts:4-6`](../api/_lib/break.ts))
- Si ya hay un descanso activo e idempotente se llama a `startBreak`, devuelve el activo sin crear otro. ([`api/_lib/break.ts:88`](../api/_lib/break.ts))
- El anular un descanso está reservado al **Admin** (no está expuesto en la mobile del técnico). ([docs/msapp-flujos-validacion.md — tabla Home](msapp-flujos-validacion.md))

---

## Stock técnico

- El stock personal del técnico viene de `99.ABMRepuestos_Tecnico`. Solo se muestran los repuestos con `Status_RT = "Activo"` y `Cantidad_RT > 0`. ([`api/_lib/incidentes.ts:281-300`](../api/_lib/incidentes.ts))
- El stock **se consume** únicamente en modo `Cambio Repuesto` al resolver un incidente. La nueva cantidad es `max(0, actual - usada)`, nunca negativa. ([`api/_lib/incidentes.ts:391-407`](../api/_lib/incidentes.ts))
- En modo `Requiere Repuesto` se crean filas en `13.RepuestosIncidentes` (pendientes de procurar) pero **no se descuenta el stock del técnico**. ([`api/_lib/incidentes.ts:337-342`](../api/_lib/incidentes.ts))
- Al **Resolver** un incidente "Asignado" (`resolverAsignadoIncidente`) **no** se consume stock del técnico: los repuestos ya estaban comprometidos, así que lo no usado **reingresa a `04.Stock` (general)**. Ver sección **Resolver (incidente "Asignado")**.
- El catálogo general de repuestos (`11.Respuestos`) filtra solo `Status_RP = "Activo"`. Se usa para el modo `Requiere Repuesto` (pedir repuesto del catálogo general, no del stock personal). ([`api/_lib/incidentes.ts:319-334`](../api/_lib/incidentes.ts))

---

## ⚠️ Pendiente de confirmar con el usuario

Las siguientes preguntas no tienen respuesta definitiva en el código ni en los docs. Varias vienen de `docs/msapp-gap-review.md — Decisiones de negocio`:

1. **¿Las coordenadas secundarias (`Latitud2_EV`/`Longitud2_EV`) de los edificios son pares alternativos de la misma entrada o coordenadas de salida?** El código las soporta como segundo punto de geofencing. Confirmarlo para asegurarse de que los edificios cargados desde la mobile validen geo correctamente.

2. **¿La foto de finalización de ventilación se debe subir?** Hoy se captura en la UI pero no se persiste. Es un gap conocido (`WashInn-FotoVentilacion.Run` no portado). ¿Es prioridad?

3. **Notificaciones push** (`nWashinnVisita.Run`, `WashinnIncidente.Run`): plan acordado es lista SharePoint `Notificaciones` que consume el desktop futuro. ¿Tiene fecha/prioridad?

4. **¿Quién puede anular un descanso?** El código dice "solo Admin" pero no hay endpoint de anulación de descanso en la mobile. ¿Está en la app de escritorio?

5. **`Version_IN` en el payload del incidente:** PowerApps incluye `VarVersion`. ¿Se usa en Power BI o reportes? Si sí, conviene agregarlo al crear incidente.
