# Mapa de la app — Washinn Mobile

> Inventario de pantallas, endpoints y listas SharePoint.
> Para columnas detalladas de cada lista ver [sharepoint-schema.md](sharepoint-schema.md).
> Para arquitectura y flujos ver [arquitectura.md](arquitectura.md).

---

## Pantallas

| Screen | Ruta | Propósito | Admin only | Endpoint principal |
|---|---|---|---|---|
| ScreenStart | `/` | Splash / redirección inicial | No | — |
| ScreenLogin | `/login` | Formulario de login | No | `POST /api/login` |
| ScreenHome | `/home` | Dashboard: KPIs + registros del día + grilla de módulos | No | `GET /api/home` |
| ScreenCheckList | `/checklist` | Checklist de la visita en curso | No | `GET /api/planificaciones?checklist` |
| ScreenEdificios | `/edificios` | Edificios a visitar de un circuito | No | `GET /api/planificaciones?edificios` |
| ScreenCrearEdificios | `/edificios/nuevo` | Alta de edificio (ABM) | **Sí** | `POST /api/abm` (action: crear-edificio) |
| ScreenPlanificaciones | `/planificaciones` | "Mis Visitas": circuitos + visita espontánea | No | `GET /api/planificaciones` |
| ScreenRegistroDetalle | `/registros` | Detalle de un registro/checklist confirmado | No | `GET /api/planificaciones?detalle=<IDUnico>` |
| ScreenVentilaciones | `/ventilaciones` | Worklist de ventilaciones | No | `GET /api/ventilaciones` |
| ScreenHM | `/maquinas/:id/historial` | Historial de incidentes de una máquina | No | `GET /api/maquinas?historial=<IDMaquina_DM>` |
| ScreenDetalleMaquina | `/maquinas` | Detalle de máquinas del edificio | No | `GET /api/maquinas` |
| ScreenCrearPersona | `/personas/nueva` | Alta de usuario (ABM) | **Sí** | `POST /api/abm` (action: crear-usuario) |
| ScreenIncidentes | `/incidentes` | Listado de incidentes activos/cerrados | No | `GET /api/incidentes` |
| ScreenIncidenteForm | `/incidentes/nuevo` y `/incidentes/:id/revisar` | Alta y resolución de incidente | No | `POST /api/incidentes` (action: crear / resolver) |
| ScreenABM | `/abm` | Panel admin (edificios, usuarios, mails) | **Sí** | `GET /api/abm` |
| ScreenMails | `/mails` | Gestión de mails por módulo | **Sí** | `GET /api/mail` / `POST /api/mail` |
| ScreenStockTecnico | `/stock` | Stock de repuestos del técnico (solo lectura) | No | `GET /api/incidentes?stockTecnico=1` |

**Guards:** Todas las rutas (excepto `/` y `/login`) están bajo `AuthGuard` (JWT requerido). Las marcadas "Admin only" están además bajo `RoleGuard roles=["Admin"]`.

---

## Endpoints

| Endpoint | Métodos / Acciones | Lib | Listas SharePoint |
|---|---|---|---|
| `/api/login` | `POST {usuario, password}` → `{user, token}` | `api/_lib/users.ts`, `api/_lib/jwt.ts` | `Usuarios` |
| `/api/home` | `GET` → `{kpis, registros, modulos}` | `api/_lib/home.ts` | `01.Registros`, `10.Incidentes`, `19.Ventilaciones`, `99.ListaPermisosMobile` |
| `/api/health` | `GET` → `{ok, site}` | `api/_lib/sharepoint.ts` | — |
| `/api/abm` | `GET ?edificios\|?usuarios\|?emails` ; `POST` action: `crear-edificio\|crear-usuario\|status-edificio\|status-usuario` | `api/_lib/abm.ts` | `ABM.Edificios`, `Usuarios`, `99.ABM_Emails` |
| `/api/incidentes` | `GET ?resuelto=NO\|SI [?mes]` \| `?id=` \| `?stockTecnico` \| `?catalogoRepuestos` ; `POST` action: `crear\|crearCompleto\|anular\|resolver\|resolverAsignado` | `api/_lib/incidentes.ts` | `10.Incidentes`, `13.RepuestosIncidentes`, `99.ABMRepuestos_Tecnico`, `11.Respuestos`, `12.FotoIncidentes`, `04.Stock`, `08.DetalleMaquina` |
| `/api/maquinas` | `GET` → `{maquinas}` \| `?historial=<IDMaquina_DM>[&edificio=<Codigo>]` \| `?repuestos=<idIncidente>` | `api/_lib/maquinas.ts` | `08.DetalleMaquina`, `10.Incidentes`, `13.RepuestosIncidentes` |
| `/api/planificaciones` | `GET [?circuitos]` \| `?edificios` \| `?checklist` \| `?detalle=<IDUnico>` \| `?enCurso` ; `POST` action: `iniciar\|cancelar\|finalizar` | `api/_lib/planificaciones.ts` | `16.DetallePlanificaciones`, `18.EdificiosVisitar`, `01.Registros`, `02.Detalles`, `15.ResumenPlanificaciones`, `ABM.Checklist` |
| `/api/registros` | `POST {id, action:"anular"}` (Admin) | `api/_lib/registros.ts` | `01.Registros` |
| `/api/ventilaciones` | `GET [?pendientes]` ; `POST` action: `programar\|finalizar\|adelantar\|crear` | `api/_lib/ventilaciones.ts` | `19.Ventilaciones` |
| `/api/mail` | `GET` → `{enabled}` ; `POST {to, subject, html, bcc?}` | `api/_lib/mail.ts` | — |
| `/api/catalogos` | `GET ?tipo=edificios\|marcas\|motivos\|usuarios` | `api/_lib/catalogos.ts`, `api/_lib/users.ts` | `ABM.Edificios`, `99.ABM_MaquinasCompra`, `99.MotivosCancelacion`, `Usuarios` |
| `/api/break` | `GET` → `{active, usedToday}` ; `POST` action: `start\|end` | `api/_lib/break.ts` | `14.HorasDescanso` |

---

## Listas SharePoint por lib

> Para columnas (display name + nombre interno Graph) ver [sharepoint-schema.md](sharepoint-schema.md).

| Lib | Listas que toca |
|---|---|
| `api/_lib/abm.ts` | `ABM.Edificios`, `Usuarios`, `99.ABM_Emails` |
| `api/_lib/break.ts` | `14.HorasDescanso` |
| `api/_lib/catalogos.ts` | `ABM.Edificios`, `99.ABM_MaquinasCompra`, `99.MotivosCancelacion` |
| `api/_lib/home.ts` | `01.Registros`, `10.Incidentes`, `19.Ventilaciones`, `99.ListaPermisosMobile` |
| `api/_lib/incidentes.ts` | `10.Incidentes`, `13.RepuestosIncidentes`, `99.ABMRepuestos_Tecnico`, `11.Respuestos`, `12.FotoIncidentes`, `04.Stock` (reingreso al resolver), `08.DetalleMaquina` (swap de cambio de máquina) |
| `api/_lib/maquinas.ts` | `08.DetalleMaquina`, `10.Incidentes`, `13.RepuestosIncidentes` |
| `api/_lib/planificaciones.ts` | `16.DetallePlanificaciones`, `18.EdificiosVisitar`, `01.Registros`, `02.Detalles`, `15.ResumenPlanificaciones`, `ABM.Checklist` |
| `api/_lib/registros.ts` | `01.Registros` |
| `api/_lib/users.ts` | `Usuarios` |
| `api/_lib/ventilaciones.ts` | `19.Ventilaciones` |
