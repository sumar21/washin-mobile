# SharePoint — paginación, límites y columnas a indexar

> Auditoría del acceso a datos (`api/_lib/*.ts`) contra Microsoft Graph. Objetivo: confirmar que
> no truncamos datos y documentar qué columnas indexar para evitar el *list view threshold* (5000
> ítems) y mejorar la performance/fiabilidad de los `$filter`.
>
> Los índices se crean en **Configuración de la lista → Columnas indexadas** (Indexed columns).
> En SharePoint Online el umbral son **5000 ítems**: un `$filter`/`$orderby` sobre una columna **no
> indexada** en una lista más grande falla o se degrada (hoy lo "salva" el header
> `HonorNonIndexedQueriesWarningMayFailRandomly`, que **puede fallar de forma intermitente**).

## 1. ¿Estamos usando límites o dejando datos afuera?

**Veredicto: ninguna lectura masiva trunca datos por volumen.** Todas las funciones de lista usan
`getListItems` / `getListItemsFiltered` / `countItems`, que corren sobre `graphAll` y siguen
`@odata.nextLink` hasta agotar la colección. `$top` (999 / 200 / 20) es solo **tamaño de página**,
no un tope total (incluso `break.ts` con `$top=20` pagina todo).

Accesos `graph()` de una sola página: son lecturas puntuales por `itemId` (`getListItem`,
`getSiteInfo`), no recortes de colección. ~~`getListItem` devolvía `null` ante *cualquier* error~~
→ **corregido**: ahora solo el 404 da `null`; los errores transitorios (403/429/5xx/timeout) se
propagan (no se confunde un fallo de red con "no existe").

Recortes del lado del cliente (después de traer todo) — la mayoría son reglas de negocio:

| Función | Recorte | ¿Pierde datos? |
| --- | --- | --- |
| `listStockTecnico` | `.filter(Cantidad > 0)` | No — intencional (picker). |
| `listRepuestosCatalogo` | `.filter(Nombre)` | Descarta repuestos sin nombre. |
| `listChecklistItems` | `.filter(Descripcion)` | Intencional. |
| `findActiveRaw` (break) | `items[length-1]` **sin orden** | Frágil → corregido (orden por id). |
| `visitaEnCurso` | `sort id desc` + `[0]` | OK (regla = 1 sola pendiente). |
| `cancelarVisita` | `items[0]` **sin orden** | No determinista → corregido (orden por id). |
| `finalizarVisita` | `regs[0]` (asume `IDUnico` único) | OK si no hay duplicados. |
| `authenticateUser` | `.find(field_1 == target)` | Primer match. |

**El riesgo dominante no es "datos afuera" sino la fiabilidad/latencia de los `$filter` sobre
columnas no indexadas en listas grandes.**

## 2. Columnas a indexar por lista (priorizado por tamaño)

| Lista | Tamaño | Columnas a indexar | Prioridad |
| --- | --- | --- | --- |
| **18.EdificiosVisitar** | **7807 (> 5000)** | `TecnicoAsignado_EV`, `MesAno_EV`, `Estado_EV` | **ALTA (crítica)** |
| **10.Incidentes** | ≈miles (puede pasar 5000) | `IDMaquina_IN`, `Resuelto_IN`, `TecnicoAsignado_IN` | **ALTA** |
| **01.Registros** | grande (crece por visita/mes) | `Nombre`, `MesA_x00f1_o`, `Estado`, `Fecha0`, `IDUnico`, `Codigo` | **ALTA** |
| 13.RepuestosIncidentes | 2991 | `IDIncidente_IN` | MEDIA |
| 08.DetalleMaquina | 1735 | `Status_DM`, `Edificio_DM`, `Modelo_DM`, `Marca_DM` | MEDIA |
| 19.Ventilaciones | media | `Estado_VE`, `IDAsignado_VE`, `Asignado_VE` | MEDIA |
| 14.HorasDescanso | crece (1+/usuario/día) | `User_HD`, `Status_HD`, `Fecha_HD` | MEDIA |
| 15.ResumenPlanificaciones | media | `IDUnivocoRuta_RP` | MEDIA |
| 16.DetallePlanificaciones | 653 | `Tecnico_DP`, `Status_DP`, `MesAno_DP`, `IDUnivocoCircuito_DP` | BAJA |
| 99.ABMRepuestos_Tecnico | 471 | `Tecnico_RT`, `Status_RT` | BAJA |
| ABM.Edificios | 419 | `Status` | BAJA |
| 11.Respuestos | 285 | `Status_RP` | BAJA |
| Usuarios | 36 | — (filtra en memoria) | BAJA |

> En un `$filter` con `AND`, **basta indexar la columna más selectiva** para que el motor no escanee
> toda la lista. Indexar esa primero.

### Las 3 críticas
- **18.EdificiosVisitar (7807):** indexar **primero `TecnicoAsignado_EV`** (lo más selectivo), luego
  `MesAno_EV`. `Estado_EV` (choice, poca cardinalidad) es secundaria. **Ya superó 5000**, así que sin
  índice en la primera columna del `AND` la query depende 100% del header y puede fallar de entrada.
- **10.Incidentes:** `IDMaquina_IN` (historial de máquina, muy selectiva), `Resuelto_IN` y
  `TecnicoAsignado_IN` (lista + KPIs del Home). Es la de mayor crecimiento → actuar antes de 5000.
- **01.Registros:** `Nombre` + `MesA_x00f1_o` (la combinación ya acota muchísimo); secundarias
  `Estado`, `Fecha0`, `IDUnico`, `Codigo`.

## 3. Riesgos y recomendaciones

### 3.1 Dónde el header `HonorNonIndexedQueries` tapa un problema indexable
Es un parche ("MayFailRandomly"). Indexar elimina la dependencia en:
`listEdificiosAVisitar` (18.EdificiosVisitar, **el más grave**), `listIncidentes` /
`listHistorialMaquina` / KPIs del Home (10.Incidentes), `buildHome` / `visitaEnCurso` /
`cancelarVisita` / `finalizarVisita` (01.Registros), `listCircuitos` (16), `findActiveRaw` (14).

### 3.2 Operadores que NO mejoran con índice (rediseñar el filtro)
- ~~**`ne` (negación)** en `listDetalleMaquina`: `Status_DM ne 'ELIMINADA'` (full scan).~~
  → **corregido**: se filtra por edificio/modelo/marca en OData y se excluye `ELIMINADA` en memoria
  (se eliminó el `ne`). Si no hay filtro, trae todo (1735, paginado) y filtra en memoria.
- **`or` sobre la misma columna** (Ventilaciones/circuitos por estado): agrava el threshold.
  Mitigación: que el otro lado del `AND` (técnico/mes) esté indexado y sea selectivo, para reducir el
  set antes de evaluar el `or`.

### 3.3 Fechas como texto
`Fecha0`, `Fecha_HD`, `MesA_x00f1_o`, `MesAno_*` se guardan como **texto `dd/mm/yyyy`** y se comparan
por igualdad exacta. Riesgos: (a) cualquier desfasaje de formato/zona da conteo 0 erróneo — asegurar
que `todayAr()`/`fecha.ts` produzcan exactamente el formato de SharePoint; (b) no permite rangos
(`ge`/`le`). Si en el futuro se necesita "últimos N días", migrar a columna `DateTime` real.

### 3.4 Queries que conviene acotar
- **`getListItems` sin filtro**: hoy solo sobre listas chicas/medias. **Nunca** usarlo sobre
  `01.Registros`/`10.Incidentes` (descarga completa).
- **`countItems` cuenta en cliente** (descarga ids y hace `.length`): con las columnas indexadas baja
  el costo; idealmente usar `$count` del servidor si la lista lo soporta.
- **`listEdificiosAVisitar`** cruza 18.EdificiosVisitar (7807) con 01.Registros del mes: indexar ambas
  y mantener **siempre** el filtro por mes + técnico.

## Acción mínima priorizada
1. **18.EdificiosVisitar:** indexar `TecnicoAsignado_EV` (+ `MesAno_EV`) — ya pasó 5000, máxima urgencia. _(SharePoint, manual)_
2. **10.Incidentes:** indexar `IDMaquina_IN`, `Resuelto_IN`, `TecnicoAsignado_IN` — antes de cruzar 5000. _(SharePoint, manual)_
3. **01.Registros:** indexar `Nombre` y `MesA_x00f1_o`. _(SharePoint, manual)_
4. ~~Rediseñar el `ne 'ELIMINADA'`~~ → **hecho** (filtro en memoria).
5. ~~`$orderby`/sort determinista en `findActiveRaw` y `cancelarVisita`~~ → **hecho**.
6. ~~`getListItem` distingue 404 de errores transitorios~~ → **hecho**.

> Lo único pendiente es **crear los índices en SharePoint** (items 1-3): son cambios de
> configuración de la lista, no de código. El resto del código ya quedó optimizado.
