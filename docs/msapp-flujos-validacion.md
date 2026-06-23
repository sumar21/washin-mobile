# Validación de flujos: PowerApps (`.msapp`) ↔ React (2026-06-23)

> **Objetivo:** revisar el `.msapp` y validar que **no falte ningún flujo del técnico** en la app
> React, y validar los correos. Esta revisión **supersede** a `docs/msapp-gap-review.md` (09-jun),
> que quedó desactualizada (varios 🔴 de esa auditoría ya están resueltos).
>
> **Método:** inventario exhaustivo de los `OnSelect` de las 8 pantallas del técnico en
> `docs/powerapps/Src/*.pa.yaml` (extraído con grep por ser archivos de 0.3–2.5 MB) y cotejo
> contra rutas/pantallas (`src/routes.tsx`, `src/screens/`) y backend (`api/_lib/*`).
>
> **Alcance (memoria del proyecto):** la mobile es **solo del técnico**. **ABM, alta de
> persona/edificio y Métricas quedan FUERA** (son de la app web de administración). Los flujos PA de
> esos módulos se marcan ⛔ *fuera de scope*, no como faltantes.

## Leyenda

| Símbolo | Significado |
|---|---|
| ✅ | Flujo presente y con paridad funcional |
| 🟡 | Presente con diferencia menor / mejora intencional |
| ⛔ | Fuera de scope mobile (admin/web) — no es un faltante |
| 🔁 | Lo ejecuta otra app (cierre admin sobre estado "Asignado") — no va en mobile |
| 🔴 | **Faltante real** a decidir/implementar |

---

## Resumen ejecutivo

**No falta ningún flujo del técnico.** El ciclo del técnico está completo en React:
Login → Home (descanso, registros del día) → Planificaciones/Edificios (iniciar visita por
GPS + QR de presencia) → Checklist (finalizar + mail) → Cancelar visita (+ mail) → Ventilaciones
(programar/finalizar/adelantar) → Detalle de Máquina + Historial → Incidentes (alta rápida y
completa, resolver en 4 modos, anular, repuestos, foto, mails).

Lo que **no** está portado es, en su mayoría, **deliberado**:

- **Cierre final del incidente sobre estado "Asignado"** (confirmar repuestos usados con
  devolución a `04.Stock` global + cambio de máquina real en `08.DetalleMaquina`): en PowerApps lo
  hace el **admin**, no el técnico. → 🔁 va en la app web, no en la mobile.
- **ABM / alta persona / alta edificio / Métricas**: ⛔ fuera de scope (app de administración).
- **Flujos Power Automate** (`nWashinnVisita.Run`, `WashinnIncidente.Run`,
  `WashInn-FotoVentilacion.Run`): push notifications + subida de foto de ventilación. Plan acordado:
  lista SharePoint `Notificaciones` que consumirá el desktop futuro. → 🔴 pendiente (1 gap real).

**Único faltante real con impacto en el técnico:** la **foto de finalización de ventilación**
se captura en la UI pero **no se sube** (falta el equivalente a `WashInn-FotoVentilacion.Run`).

---

## 1. Login + Home + Descanso

| Flujo PowerApps | Estado | Dónde en React |
|---|---|---|
| Login: validar usuario/password (`bt_login_SL`), cargar catálogos | ✅ | `api/login.ts`, `ScreenLogin.tsx`, JWT |
| Cerrar sesión (`btSalir`) | ✅ | guards + logout |
| Geo: detectar edificio cercano (Home/Planif) | ✅ | `GpsButton`, geofencing en visita |
| Navegar a módulos (galería Home) | ✅ | `BottomNav`/`Sidebar` + rutas |
| Registros del día (GalHome) | ✅ | `ScreenHome`, `api/home.ts` |
| Iniciar descanso (`14.HorasDescanso`) | ✅ | `api/break.ts` (1×día, anular solo Admin) |
| Finalizar descanso | ✅ | `api/break.ts` |
| Festividades (`01.BackLog_Festividades`) | 🟡 | no portado; no es flujo operativo del técnico |
| ABM / Métricas desde Home | ⛔ | fuera de scope |

## 2. Visitas: Planificaciones + Edificios + Checklist

| Flujo PowerApps | Estado | Dónde en React |
|---|---|---|
| Seleccionar circuito planificado (16/18) | ✅ | `ScreenPlanificaciones`, `api/planificaciones.ts` |
| Registrar visita planificada (`01.Registros`) | ✅ | `finalizarVisita`/registro |
| Registrar **visita espontánea** (manual) | ✅ | `ScreenPlanificaciones` (combobox edificio) |
| QR de presencia (valida `Codigo`, marca HoraInicio) | ✅ | doble-QR (GEO abre, QR confirma); gate `qrScanned` |
| Checklist ítem Sí/No + observación por ítem | ✅ | `ScreenCheckList` |
| Observación general + **foto general** | 🟡 | se captura; persiste en localStorage (no se sube como imagen aparte) |
| Finalizar checklist → `02.Detalles` + `01.Registros` (Finalizado) | ✅ | `finalizarVisita` |
| **Mail "Mantenimiento"** al finalizar | ✅ | `api/_lib/mail-visitas.ts` → `htmlMantenimiento` |
| Cancelar visita (motivo) → `01.Registros` (Cancelado) | ✅ | `cancelarVisita` |
| **Mail "Visita cancelada"** (planificada y espontánea) | ✅ | `htmlVisitaCancelada` (una plantilla cubre ambas) |
| `nWashinnVisita.Run` (Power Automate, post-finalizar) | 🔴 | push notif. — no portado (plan: lista `Notificaciones`) |

## 3. Ventilaciones

| Flujo PowerApps | Estado | Dónde en React |
|---|---|---|
| Listar ventilaciones (asignadas/programadas) | ✅ | `ScreenVentilaciones`, `api/_lib/ventilaciones.ts` |
| Programar ventilación (fecha, Estado="Programada", Orden 2) | ✅ | `programarVentilacion` |
| Finalizar → Realizada + auto-crea próximo ciclo Pendiente | ✅ | `finalizarVentilacion` |
| Adelantar ventilación pendiente (desde incidente) | ✅ | `adelantarVentilacion` (EsIncidente="SI") |
| **Subir foto de finalización** (`WashInn-FotoVentilacion.Run`) | 🔴 | **se captura pero NO se sube** — ver `ScreenVentilaciones.tsx:132` |

## 4. Máquinas: Detalle + Historial (HM)

| Flujo PowerApps | Estado | Dónde en React |
|---|---|---|
| Listar/Detalle de máquinas por edificio (`08.DetalleMaquina`) | ✅ | `ScreenDetalleMaquina`, `api/_lib/maquinas.ts` |
| Filtros (Marca/Modelo/**Encendido**) | ✅ | `MaquinaFilters`/`MaquinaFilterButton` |
| Historial de máquina = incidentes de la máquina (`10.Incidentes`) | ✅ | `ScreenHM` (`getHistorialMaquina`) |
| Ver repuestos del incidente (`13.RepuestosIncidentes`) | ✅ | `VerRepuestosDialog` |
| Nuevo incidente desde máquina/HM (preselección) | ✅ | navega a `/incidentes/nuevo` con máquina |

## 5. Incidentes (el más pesado — 46+ controles en PA)

| Flujo PowerApps | Estado | Dónde en React |
|---|---|---|
| Listado por tab (excluye Pendiente/Aprobada de Abiertos) | ✅ | `ScreenIncidentes` (scope por técnico) |
| **Alta rápida** (`bt_saveReportarIncidente`, Status "A Revisar") | ✅ | `crearIncidente` (default Categoría "Agua") |
| **Alta completa** (`bt_guardarIncidente`: categoría/repuestos/foto) | ✅ | `crearIncidenteCompleto` (categoría real, foto, repuestos) |
| Categoría obligatoria (combo buscable) | ✅ | `Combobox` en `ScreenIncidenteForm` |
| Agregar repuesto (catálogo + stock del técnico) | ✅ | `RepuestosPicker` |
| **Resolver** — 4 modos (Cambio Repuesto / Sin Repuesto / Requiere Repuesto / Cambio de Máquina) | ✅ | `resolverIncidente` |
| Resolver: escribir `13.RepuestosIncidentes` | ✅ | `escribirRepuestosIncidente` |
| Resolver: descontar **stock del técnico** (`99.ABMRepuestos_Tecnico`) | ✅ | `descontarStockTecnico` |
| Resolver: **foto** (solo si Resuelto) → `12.FotoIncidentes` | ✅ | `escribirFotoIncidente` |
| **Mail "Incidente Resuelto"** (Cambio Repuesto + notificar) | ✅ | `htmlIncidenteResuelto` |
| **Anular** (gate Status="A Revisar") + **mail anulado** | ✅ | `anularIncidente` + `htmlIncidenteAnulado` |
| Gate "Resolver" = Status "Asignado" + técnico asignado | ✅ | gating replicado |
| **Generar ventilación** = adelantar una pendiente (no crear) | ✅ | `adelantarVentilacion` |
| Ver detalle de edificio del incidente | ✅ | diálogo de detalle |
| **Confirmar repuestos usados** + **devolver no usados a `04.Stock`** | 🔁 | cierre admin sobre "Asignado" |
| **Cambio de máquina real** (`08.DetalleMaquina` INSTALADA/DEPOSITO + `+1` a `04.Stock`) | 🔁 | cierre admin (React solo setea `MaquinaAsignada_IN`) |
| `WashinnIncidente.Run` (Power Automate) | 🔴 | push notif. — no portado |

## 6. Módulos de administración (⛔ fuera de scope mobile)

| Pantalla PowerApps | Flujos | Estado |
|---|---|---|
| `Screen_ABM` | editar/cambiar status edificio y persona | ⛔ app web admin |
| `Screen_CrearPersona` | alta de persona | ⛔ |
| `ScreenCrearEdificios` | alta de edificio | ⛔ |
| `ScreenMetricas` | reportes general/problemas (`Washinn.Run`) | ⛔ |

> Nota: existen rutas `/abm`, `/personas/nueva`, `/edificios/nuevo`, `/mails` **gateadas a Admin**
> en React, pero por scope no se invierte ahí. La edición de persona/edificio del PA (`PopUpMod…`)
> no se replica.

---

## Mails — validación (detalle en `/mails`)

Los **4 correos** que dispara la app están cableados y renderizados en `/mails` (abrí
`mails/index.html`). Resumen:

| Correo | Disparo (código) | Para / Bcc | Paridad |
|---|---|---|---|
| Mantenimiento | `finalizarVisita` (planificaciones) | edificio · Bcc Sumar(Checklist) | ✅ texto OK; sin logo |
| Visita cancelada | `cancelarVisita` | edificio + paul.risau + pablo.tecnico · Bcc Sumar | 🟡 agrega "Motivo:" |
| Incidente resuelto | `resolverIncidente` (Cambio Repuesto) | Sumar(Checklist)+Washinn(Incidentes) · Bcc Sumar | 🟡 sin 2ª tabla cambio-máquina |
| Incidente anulado | `anularIncidente` | Washinn(Incidentes) · Bcc Sumar | ✅ texto OK (destinatario de `99.ABM_Emails`, no hardcode) |

- **Envío:** Microsoft Graph `sendMail` (`api/_lib/mail.ts`), casilla
  `notificaciones@sumardigital.com.ar`. **Best-effort** (nunca rompe el flujo).
- **Asuntos** idénticos a PowerApps.
- **Destinatarios** desde `99.ABM_Emails` por módulo — divergencia **deliberada** del hardcode
  `paul.risau@…` de PA.
- **Diseño:** moderno/minimalista (shell `api/_lib/mail-layout.ts`): encabezado con el logo de
  Wash-Inn (`public/Logoapp.png` en base64, única imagen) + `WASH INN SYSTEM`, barra de acento,
  eyebrow, título, lista de datos con hairlines, tabla de repuestos y firma. Layout de tablas
  email-safe; si el cliente bloquea el logo, el texto sigue llevando la marca.

---

## Gaps reales pendientes (accionables)

1. 🔴 **Foto de finalización de ventilación no se sube.** Se captura en `ScreenVentilaciones`
   pero `finalizarVentilacion(id, observacion)` no recibe imagen. PA usa
   `WashInn-FotoVentilacion.Run`. → Agregar `fotoBase64` al endpoint + escritura en la lista de
   fotos de ventilación (equivalente a `escribirFotoIncidente`).
2. 🔴 **Flujos Power Automate (push notifications)** `nWashinnVisita.Run` / `WashinnIncidente.Run`
   no portados. → Plan acordado: lista SharePoint `Notificaciones` (escribe la mobile, consume el
   desktop futuro). Sin impacto en el flujo del técnico hoy.
3. 🟡 **Mail incidente resuelto:** falta la 2ª tabla de "cambio de máquina" (máquina nueva) que PA
   incluye. Menor — solo aplica al cierre con cambio de máquina.
4. 🟡 **Foto general del checklist:** persiste en localStorage pero no se sube como imagen
   independiente (PA tampoco la sube por ítem; única imagen = `ImagenGral` en `01.Registros`).

## Decisiones de negocio (cierran el resto)

- ✅ **¿Quién pone "Asignado" / cierra el incidente?** → el **admin** (app web). El cierre final
  (devolución a `04.Stock`, cambio real de máquina) es 🔁, no va en mobile.
- ✅ **Mails:** automáticos por flujo (paridad PA), destinatarios desde `99.ABM_Emails`.
- ✅ **ABM / Métricas:** fuera de scope mobile.
</content>
