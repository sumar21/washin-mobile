# Washinn — Ficha comercial (sales enablement)

> App de gestión de mantenimiento técnico para lavanderías. Material para personal comercial nuevo: entender qué es, a quién sirve y cómo explicarla.

---

## 🔑 Acceso rápido

| | |
|---|---|
| **Link** | https://washinn.app.sumar.dev/ |
| **Usuario demo** | `Nicacosta` |
| **Contraseña** | `1004` |
| **Dispositivos** | Celular (uso principal), tablet y desktop. Es una **PWA**: se instala como app en Android/iOS desde el navegador, sin pasar por tienda. También se usa desde la computadora. |
| **Cliente / sede** | **Wash-Inn** (cadena de lavanderías; dominio `@wash-innsystem.com.ar`). Sede/sucursal específica de la demo: *(a completar con el equipo)* |

*Las credenciales corresponden a un usuario real del sistema. Mostrar la demo con el rol que ese usuario tenga cargado.*

---

## Resumen en 30 segundos

> **¿Qué es?** Una app móvil para que los **técnicos de mantenimiento** de Wash-Inn registren su trabajo en obra: visitas a edificios, checklists, incidentes en las máquinas y mantenimiento preventivo (ventilaciones).
>
> **¿Para quién?** El técnico que está en la calle; y de fondo, supervisores y administración que necesitan ver qué se hizo, dónde y cuándo.
>
> **¿Qué problema resuelve?** Reemplaza el papel, el Excel y los mensajes sueltos de WhatsApp por un registro único, con foto, ubicación y fecha de cada trabajo.
>
> **¿Qué valor da?** Trazabilidad total: cada máquina tiene su historial, cada visita queda probada con foto y GPS, y los incidentes dejan de perderse. Todo en el celular del técnico.

---

## El problema → la solución

| Antes (forma vieja) | Después (con Washinn) |
|---|---|
| El técnico anota en papel o Excel; los datos se pierden o no llegan. | Cada visita queda registrada en el sistema, con foto y hora. |
| Nadie sabe cuándo fue la última visita a un edificio o máquina. | Historial por máquina y por edificio, consultable al instante. |
| Los incidentes se reportan por teléfono/WhatsApp y se diluyen. | Incidentes centralizados: se reportan, asignan, resuelven y anulan desde la app. |
| El mantenimiento preventivo (ventilaciones) se olvida. | Ventilaciones asignadas y programadas, con foto de cierre. |
| No hay prueba de que el trabajo se hizo. | Foto obligatoria + validación de presencia por GPS y QR. |

---

## Quién la usa (roles)

La app tiene **tres roles** con accesos distintos (definidos en [src/data/types.ts](src/data/types.ts) y la matriz de permisos de [src/lib/permissions.ts](src/lib/permissions.ts)):

- **Técnico** — el usuario principal. Ve y opera **solo sus propios** registros: visitas, máquinas, incidentes y ventilaciones.
- **Supervisor** — además de lo operativo, ve edificios y datos de todos los técnicos.
- **Admin** — control total: suma administración de edificios y personas, y envío de mails.

> Para ventas, el foco es el **técnico**: ahí está el valor diferencial de la app. ABM, mails y métricas son de administración (mayormente desde la web).

---

## Cómo funciona (flujo paso a paso)

1. **Ingresa** con usuario y contraseña. La app valida la identidad y carga su día ([api/login.ts](api/login.ts), [src/screens/ScreenLogin.tsx](src/screens/ScreenLogin.tsx)).
2. **Inicio:** ve su jornada de un vistazo — visitas de hoy, incidentes activos, ventilaciones y los registros del día ([src/screens/ScreenHome.tsx](src/screens/ScreenHome.tsx)).
3. **Visita un edificio:** elige el circuito del mes (o registra una visita espontánea). Para confirmar que está realmente ahí, **escanea el QR del edificio** y/o valida por **GPS** ([src/screens/ScreenPlanificaciones.tsx](src/screens/ScreenPlanificaciones.tsx), [src/lib/geo.ts](src/lib/geo.ts)).
4. **Completa el checklist:** responde los ítems (Sí/No con observación), saca una **foto** y deja una observación general. El avance se guarda en el celular para no perderse si se cierra la app ([src/screens/ScreenCheckList.tsx](src/screens/ScreenCheckList.tsx)).
5. **Reporta incidentes** si una máquina falla, los **resuelve** (incluso descontando repuestos) o los **anula** ([src/screens/ScreenIncidentes.tsx](src/screens/ScreenIncidentes.tsx)).
6. **Programa y cierra ventilaciones** (mantenimiento preventivo) con fecha y foto ([src/screens/ScreenVentilaciones.tsx](src/screens/ScreenVentilaciones.tsx)).
7. Todo queda registrado y consultable: el **historial de cada máquina** muestra sus incidentes y repuestos ([src/screens/ScreenHM.tsx](src/screens/ScreenHM.tsx)).

---

## Módulos

**Núcleo del técnico:**

- **Inicio / Mi día** — Dashboard con indicadores del día y lista de registros. Incluye el **descanso** (uno por jornada, con cronómetro). · [src/screens/ScreenHome.tsx](src/screens/ScreenHome.tsx)
- **Visitas / Planificaciones** — Circuitos del mes, visita espontánea y validación de presencia (QR + GPS). · [src/screens/ScreenPlanificaciones.tsx](src/screens/ScreenPlanificaciones.tsx)
- **Checklist** — Ítems Sí/No, foto y observación, con barra de progreso. · [src/screens/ScreenCheckList.tsx](src/screens/ScreenCheckList.tsx)
- **Detalle de máquina + Historial** — Catálogo de máquinas con filtros (edificio, marca, modelo) e historial de incidentes/repuestos por máquina. · [src/screens/ScreenDetalleMaquina.tsx](src/screens/ScreenDetalleMaquina.tsx), [src/screens/ScreenHM.tsx](src/screens/ScreenHM.tsx)
- **Incidentes** — Reportar, registrar (con categoría y foto), resolver con repuestos, anular, y generar/adelantar una ventilación. · [src/screens/ScreenIncidentes.tsx](src/screens/ScreenIncidentes.tsx)
- **Ventilaciones** — Mantenimiento preventivo: programar fecha y finalizar con foto. · [src/screens/ScreenVentilaciones.tsx](src/screens/ScreenVentilaciones.tsx)

**Administración (rol Admin, mayormente web):**

- **ABM** de edificios y personas, alta de edificios con GPS, alta de usuarios, y **mails**. · [src/screens/ScreenABM.tsx](src/screens/ScreenABM.tsx), [src/screens/ScreenMails.tsx](src/screens/ScreenMails.tsx)

---

## Funcionalidades y beneficios

| Funcionalidad | Beneficio para el cliente |
|---|---|
| **Foto obligatoria** en visitas, ventilaciones e incidentes | Prueba real de que el trabajo se hizo. |
| **Validación de presencia** (QR del edificio + GPS) | Garantiza que el técnico estuvo físicamente en el lugar. |
| **Historial por máquina** | Se sabe qué le pasó, qué se reparó y qué repuestos se usaron. |
| **Incidentes con ciclo completo** (reportar → resolver → anular) | Ningún problema se pierde; quedan estados claros. |
| **Mantenimiento preventivo** (ventilaciones programadas) | No es solo apagar incendios: también previene fallas. |
| **Filtros y búsqueda** en máquinas e incidentes | El técnico encuentra rápido lo que necesita. |
| **Avance guardado en el celular** | Si se corta o se cierra la app, no se pierde el checklist en curso. |
| **Notificaciones automáticas** (mail / WhatsApp) | El equipo se entera de incidentes y trabajos sin llamar por teléfono. *(verificar alcance con el equipo)* |
| **Responsive** (celular, tablet, desktop) | Una misma herramienta para la calle y para la oficina. |

---

## Diferenciadores (por qué esto y no la forma vieja)

- **Hecho para el técnico en obra, no una planilla adaptada.** Mobile-first: pensado primero para el celular, con botones grandes y flujo simple.
- **Prueba objetiva del trabajo.** Foto + GPS + QR: no es "el técnico dice que fue", queda registrado.
- **Una sola fuente de verdad.** Visitas, máquinas, incidentes y ventilaciones en un mismo lugar, no repartidos entre papeles, Excel y chats.
- **Continuidad de la operación existente.** Es la evolución de la app que Wash-Inn ya usaba (originalmente en PowerApps), reconstruida sobre tecnología web moderna y conectada a su SharePoint. Misma lógica de negocio, mejor base.
- **Instalable como app sin tienda.** Al ser PWA, se instala desde el navegador; sin fricción de publicación en Google Play / App Store.

---

## Preguntas frecuentes y objeciones de venta

**"¿Necesito instalar algo desde la tienda de apps?"**
No. Se abre el link en el celular y se instala como app (PWA). En desktop se usa directo desde el navegador.

**"¿Funciona sin internet?"**
El checklist en curso se guarda localmente para no perder el avance si se cierra la app, y la app se instala como aplicación. El trabajo **100% offline con sincronización de datos** está en evolución *(a completar con el equipo)*.

**"¿Cómo sé que el técnico realmente fue al edificio?"**
La app valida la presencia con el **código QR del edificio** y la **ubicación GPS**. Sin eso, no avanza al checklist.

**"¿Cada técnico ve todo?"**
No. El técnico ve solo lo suyo. Supervisor y Admin tienen vistas más amplias.

**"¿Dónde quedan los datos?"**
En el SharePoint del cliente (Microsoft 365), accedido de forma segura. No es una base paralela.

**"Ya tenemos una app en PowerApps, ¿por qué cambiar?"**
Esta es su evolución: misma lógica, pero sobre tecnología web moderna, más rápida, responsive y mantenible, e instalable como app.

---

## Ecosistema técnico (alto nivel)

- **App:** PWA en React + TypeScript (web moderna), responsive de celular a desktop. · [package.json](package.json), [README.md](README.md)
- **Datos / backend:** **Microsoft 365 — SharePoint** como base, accedido vía **Microsoft Graph** desde funciones de servidor. El login valida credenciales reales contra SharePoint. · [api/login.ts](api/login.ts)
- **Identidad:** usuario + contraseña; cada sesión scopea los datos al rol del usuario.
- **Capacidades del dispositivo:** cámara (fotos y QR) y GPS, usadas para validar y documentar el trabajo.
- **Notificaciones:** mails (vía Microsoft Graph) y avisos por WhatsApp en ciertos flujos *(alcance a confirmar con el equipo)*.
- **Origen:** reconstrucción de la app PowerApps original de Wash-Inn, manteniendo su lógica de negocio.

> Nota: el README del repo describe una "fase 1 con datos mock"; esa descripción quedó **desactualizada**. La versión desplegada opera contra SharePoint real (por eso funcionan las credenciales de la demo).

---

## Ficha rápida (one-liner)

> **Washinn** es la app móvil con la que los técnicos de Wash-Inn registran visitas, incidentes y mantenimiento de las máquinas de lavandería —con foto, GPS y QR— dándole a la empresa trazabilidad total de cada trabajo en una sola herramienta.
