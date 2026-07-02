# Documentación — Washinn Mobile

Índice de todos los documentos del proyecto.

---

## Arquitectura

| Doc | Descripción |
|---|---|
| [arquitectura.md](arquitectura.md) | Stack, capas, auth/JWT, flujo de datos, estado, navegación, guards, dev/build y convenciones técnicas. **Empezar acá.** |
| [mapa-app.md](mapa-app.md) | Tablas de referencia rápida: pantallas → rutas → endpoints, endpoints → listas SP, listas → libs. |

## Datos

| Doc | Descripción |
|---|---|
| [sharepoint-schema.md](sharepoint-schema.md) | Catálogo autoritativo de ~20 listas SharePoint: columnas con display name y nombre interno Graph. Generado por introspección de Graph API. |
| [sharepoint-indexing.md](sharepoint-indexing.md) | Paginación, límites y columnas a indexar en SharePoint. |

## Paridad de negocio

| Doc | Descripción |
|---|---|
| [reglas-negocio.md](reglas-negocio.md) | Reglas de negocio codificadas: roles, visitas, OT/Incidentes (≡ OT), ventilaciones, descanso, stock. Con sección "Pendiente de confirmar". |
| [msapp-flujos-validacion.md](msapp-flujos-validacion.md) | Paridad de flujos del técnico vs PowerApps (.msapp), fecha 2026-06-23. Fuente autoritativa de negocio. |
| [msapp-gap-review.md](msapp-gap-review.md) | Auditoría de gaps PowerApps ↔ React (foco Incidentes). |
| [incidentes-por-maquina.md](incidentes-por-maquina.md) | Cómo relacionar incidente ↔ máquina de forma consistente (IDMaquina no es único). Clave compuesta `IDMaquina + Edificio`, dos máquinas por incidente. Base del reporte "incidentes por máquina". |

## Referencia PowerApps

| Doc | Descripción |
|---|---|
| [powerapps/README.md](powerapps/README.md) | Cómo usar el código fuente extraído del .msapp (read-only). |
| [powerapps/incidentes.md](powerapps/incidentes.md) | Referencia extraída de la pantalla Incidentes del .msapp. |

## Otros

| Doc | Descripción |
|---|---|
| [comercial-washinn.md](comercial-washinn.md) | Ficha comercial / sales enablement. |
