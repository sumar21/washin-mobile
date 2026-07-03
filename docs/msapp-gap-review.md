# Revisión MSAPP ↔ React (paridad de funcionamiento)

> Auditoría automatizada (workflow, 7 agentes comparando PowerApps vs React, 81 gaps) con foco en
> **Incidentes**. Tipos: `falta_funcionalidad`, `campo_faltante`, `bug`, `estetica`, `divergencia`.

## Resumen ejecutivo

| Módulo | Paridad aprox. | Gaps alta | media | baja |
|---|---|---|---|---|
| **Incidentes — Alta/Reportar** | Parcial (~55%) | 3 | 3 | 4 |
| **Incidentes — Resolver** | Parcial-baja (~40%) | 4 | 4 | 5 |
| **Incidentes — Listado/acciones** | Parcial (~55%) | 4 | 5 | 5 |
| Visitas | Alta (~85%) | 1 | 3 | 6 |
| Ventilaciones | Alta (~85%) | 1 | 1 | 5 |
| Máquinas | Media (~70%) | 2 | 5 | 6 |
| Home / ABM | Parcial (~65%) | 4 | 4 | 8 |

> **Clave:** Incidentes es el único módulo que **no cierra el ciclo de vida completo** (falta estado
> "Asignado", confirmar repuestos usados, cambio de máquina real, fotos, mails). Visitas y
> Ventilaciones tienen paridad alta. Máquinas y Home/ABM, punto medio (falta edición en ABM, filtros).

---

## 🔴 Incidentes (detallado)

> Contexto crítico: PowerApps tiene **dos flujos de alta** que React mezcló/renombró. El "Registrar"
> de React equivale al alta **rápida** de PA (`bt_saveReportarIncidente`: crea con Categoría="Agua"
> fija + WhatsApp al técnico). El alta **completa** de PA (`AdddNewIncidente`/`bt_guardarIncidente`,
> con Categoría/Estado/Resolución/Foto/Repuestos) **no existe en React**. El "Reportar" de React
> (mail al edificio) **no tiene equivalente en PA**. De ahí que "PowerApps pide más datos".

### Alta / Reportar / Registrar

**🔴 1. Semántica invertida "Reportar" vs "Registrar"** *(divergencia)* — PA "reportar" **crea** el
incidente + WhatsApp; no hay mail al edificio. React: "Registrar"=alta; "Reportar"=mail al edificio
(no existe en PA). → Definir si el mail es feature nueva; para paridad, "Reportar" debería crear+WhatsApp.

**🔴 2. Falta Categoría seleccionable** *(campo_faltante)* — PA exige combo obligatorio
`[Tildado, Todo Funcionando, Mecanico, Placa]` → `Categoria_IN`. React no lo pide; el backend fuerza
`Categoria_IN || "Agua"` → **siempre "Agua"**. → Agregar Select obligatorio y enviarlo.

**🔴 3. Foto capturada pero descartada** *(falta_funcionalidad)* — `onCrear` tiene `<PhotoCapture>`
pero **nunca envía la foto**; no se escribe `12.FotoIncidentes`. PA solo persiste foto si nace
"Resuelto" (el alta de técnico es "A Revisar"). → Quitar el PhotoCapture del alta o implementar guardado.

**🟡 4. No se puede dar de alta ya resuelto** *(falta_funcionalidad)* — PA permite nacer Resuelto
(combos Estado/Resolución + líneas en `13.RepuestosIncidentes`). React siempre "A Revisar". → Confirmar
si se necesita en mobile; si no, documentar la divergencia.

**🟡 5. `WashinnIncidente.Run` (Power Automate) no portado** *(divergencia)* — PA ejecuta el flujo +
mail si nace Resuelto+Cambio Repuesto. React replica WhatsApp pero no el flujo. → Averiguar qué hace.

**🟡 6. Máquina obligatoria vs opcional** *(divergencia)* — PA rápido: máquina opcional (solo Edificio
+ Descripción). React la exige. → Decidir qué flujo se portó.

**🟢 7. Combos no buscables** *(estética)* — PA usa ComboBox buscable; React `<Select>` plano (con
400+ edificios contradice CLAUDE.md). → Usar `Combobox`.
**🟢 8. No resetea máquina al cambiar edificio** *(bug)* — `setMaq("")` en onChange del edificio.
**🟢 9. Técnico pre-seleccionado** *(divergencia)* — React arranca con `myName`; PA en blanco.
**🟢 10. Payload** *(campo_faltante)* — falta `Version_IN` (confirmar si se usa en Power BI).

### Resolver

> React implementa solo la **primera pasada** (modos, observación, stock del técnico, pedido de
> repuestos, patch de `10.Incidentes`). Falta el **segundo flujo** (`AprobarIncidente` sobre estado
> "Asignado"): confirmar repuestos usados, cambio de máquina real, fotos, mails.

**✅ 1. "Confirmar repuestos usados" al cerrar — RESUELTO** *(era falta_funcionalidad)* — PA
(`gal_ConfirmarRepuestos`): por línea `Patch 13.RepuestosIncidentes {Status_RI: 0→'Anulado'/else'Pendiente',
Cantidad_RI}` y **devuelve lo no usado a `04.Stock`**. Implementado en `resolverAsignadoIncidente`
(diálogo `ResolverIncidenteDialog` de 2 pasos con toggle "Todos los repuestos" + reingreso a `04.Stock`).

**✅ 2. Cambio de Máquina real — RESUELTO** *(era falta_funcionalidad)* — al **Resolver** un "Asignado"
con `NoResuelto_IN="Cambio de Maquina"`: nueva→`INSTALADA` en el edificio, vieja→`DEPOSITO`/`C-9999`,
`+1` a `04.Stock`. Implementado en `resolverAsignadoIncidente` (`ejecutarCambioMaquina`). La **elección**
de la máquina de reemplazo sigue en la app web; la mobile ejecuta el swap al resolver.

**🔴 3. Falta Categoría obligatoria al resolver** *(campo_faltante)* — PA `cmbox_catCont` obligatorio.
React no la pide → `Categoria_IN` no se actualiza. → Agregar selector obligatorio.

**✅ 4. Estado "Asignado" y transición de cierre — RESUELTO** *(era divergencia)* — el estado
"Asignado" lo pone el **admin (app web)**; el **cierre** sobre "Asignado" (Resolver) ya está portado
a la mobile (`resolverAsignadoIncidente`), con sus dos ramas (confirmar repuestos / cambio de máquina).

**🟡 5. Fotos de resolución no se suben** — agregar captura + `12.FotoIncidentes`.
**🟡 6. Mails al resolver** — PA manda "Incidente Resuelto En: X" a `99.ABM_Emails`. → Graph Mail.Send (ya hay capacidad).
**🟡 7. Reasignar/confirmar máquina al resolver** — PA `cmbox_maqContinuar` obligatorio patchea `ConcatMaquina_IN`/`IDMaquina_IN`.
**🟡 8. No desasigna técnico al "No Resuelto"** — PA pone `TecnicoAsignado_IN=Blank()`; React no.
**🟡 9. Descuento de stock — condición distinta** — converge en la práctica (React por stockId, más robusto).
**🟢 10. Mail de anulación** — PA manda mail; React no (Fase 2). → Graph Mail.Send.
**🟢 11. `WashinnIncidente.Run` tras resolver.**  **🟢 12. `CantidadRepuestos_IN` — paritario.**

### Listado / acciones

**🔴 1. Filtro de items** *(divergencia)* — PA excluye "Pendiente"/"Aprobada" de Abiertos y no tiene
tab "Cerrados". React filtra solo por `Resuelto_IN` + tab Cerrados. → Excluir esos estados en Abiertos.

**🔴 2. Gate de "Resolver" no respetado** *(bug)* — PA muestra resolver solo si `TecnicoAsignado_IN=usuario
AND Status="Asignado"`. React lo muestra para todo abierto. → Condicionar a Status="Asignado" + técnico.

**🔴 3. Gate de "Anular" no respetado** *(bug)* — PA: anular solo si Status="A Revisar" y técnico del
usuario. React lo expone para cualquier abierto. → Restringir a "A Revisar".

**🔴 4. "Reportar" reinterpretado** — *(= Alta #1)*.

**🟡 5. Generar ventilación desde incidente** *(divergencia)* — PA **adelanta** una ventilación
PENDIENTE existente (`ProximaLimpieza=hoy`, `EsIncidente_VE='SI'`). React lista todos los ALTA y **crea
una nueva**. → Alinear a adelantar pendiente.
**🟡 6. Texto contextual por card** — PA muestra textos por estado y "Ver Repuestos" solo cuando aplica.
**🟡 7-10.** duplicados de Alta #2/#4/#3 (categoría, alta resuelta, repuestos en alta, foto).
**🟢 11-13.** badges/colores, KPI por tab, detalle de edificio (`bt_verDetalleEdificio`).

---

## Otros módulos

### Visitas — ALTA (~85%)
- 🔴 **Mail al finalizar** (PA manda a `CollectMails`/edificio, plantilla gmail/no-gmail, Bcc). React no.
- 🟡 NO sin observación (React más estricto); faltan `Concat_Edificio_Direccion` + `VersionApp_R` al iniciar; geofencing caja vs radio (equivalente).
- 🟢 `Version_D` en `02.Detalles`; foto general no persiste offline; cancelar sin visita previa no setea `IDUnico`.

### Ventilaciones — ALTA (~85%)
- 🔴 **Foto de finalización no se sube** (PA flujo `WashInn-FotoVentilacion`; React la captura pero no la envía).
- 🟡 Próximo ciclo copia datos **denormalizados** del registro en vez de releer `ABM.Edificios` (arrastra datos viejos).
- 🟢 Observación obligatoria (React) vs opcional (PA); falta `VersionResuelto_VE`; orden por `Orden_VE`.

### Máquinas — MEDIA (~70%)
- 🔴 **Falta filtro por Encendido (App/Fichas)** (PA lo tiene).
- 🔴 **Bug observación estado "A Revisar"**: PA→`DescripcionCarga_IN`; React→`Descripcion_IN`. → switch por estado en `listHistorialMaquina`.
- 🟡 Buscador sin `Marca_DM`; título sin fallback Segmento+Serie; muestra id interno; `StatusBadge` no cubre Asignado/A Revisar/Aprobada/En Aprobacion; "Nuevo incidente desde HM" no precarga.
- 🟢 `Proper` en técnico/edificio; **verificar nombre interno del filtro de repuestos** (`IDIncidente_IN` vs `IDIncidente_RI` — si es incorrecto trae 0).

### Home / ABM — PARCIAL (~65%)
- 🔴 **Falta EDITAR persona** (PA `PopUpModPersona`; React solo togglea Status). → edición + PATCH.
- 🔴 **Falta EDITAR edificio** (PA `PopUpModEdificio`). → edición + PATCH + `Concat_Edificio_Direccion`/`Latitud_ED`.
- 🔴 **Coordenadas secundarias descartadas (rompe geofencing)** *(bug)* — React recolecta lat2/lng2 pero los descarta; `crearEdificio` no escribe `Latitud_ED`/`Longitud_ED` → **edificios creados desde React no se reconocen en el geo de visita**. → persistir esas columnas.
- 🔴 **Password — verificar columna `field_4`** (el login depende de esto).
- 🔴 **Mails: compositor libre vs repositorio de plantillas** — PA `ScreenMails` es solo repo de 9 plantillas; los mails se disparan desde otros screens. React hizo compositor libre. → decidir alcance.
- 🟡 Falta `Cumpleaños` (persona); `Concat_Edificio_Direccion` (edificio); plantillas por módulo.
- 🟢 Título edificio `'[sumar]'`; exclusión de admin case-sensitive; casing de username.

---

## Plan de acción sugerido (priorizado)

### (a) Funcionalidad faltante
1. **[Incidentes]** Modelar estado **"Asignado"** + cierre de ciclo — **primero verificar quién lo asigna** (¿app web admin?). Habilita 2–4. *(alta)*
2. **[Incidentes]** Confirmar repuestos usados + devolución a `04.Stock`. *(alta)*
3. **[Incidentes]** Cambio de máquina real (`08.DetalleMaquina` + `04.Stock`). *(alta)*
4. **[Home/ABM]** Editar persona y edificio (+ PATCH). *(alta)*
5. **[Visitas]** Mail al finalizar. *(alta)*
6. **[Ventilaciones]** Subida de foto de finalización. *(alta)*
7. **[Máquinas]** Filtro por Encendido. *(alta)*
8. **[Incidentes]** Fotos de resolución (`12.FotoIncidentes`). *(media)*
9. **[Incidentes]** Mails de resolución y anulación (Graph Mail.Send). *(media)*
10. **[Incidentes]** Alta completa (resuelto + repuestos) — solo si negocio lo requiere. *(media)*

### (b) Campos faltantes
1. **[Incidentes]** Categoría obligatoria (alta completa + resolver). *(alta)*
2. **[Home/ABM]** `Latitud_ED`/`Longitud_ED` en crearEdificio (rompe geofencing). *(alta)*
3. **[Home/ABM]** Verificar columna Password (`field_4`). *(alta)*
4. **[Home/ABM]** `Cumpleaños`, `Concat_Edificio_Direccion`. *(media)*
5. **[Incidentes]** Reasignar máquina al resolver. *(media)*

### (c) Bugs
1. **[Incidentes]** Gate de "Resolver" → solo "Asignado" + técnico. *(alta)*
2. **[Incidentes]** Gate de "Anular" → solo "A Revisar". *(alta)*
3. **[Home/ABM]** Coordenadas secundarias descartadas. *(alta)*
4. **[Máquinas]** Observación por estado "A Revisar" → `DescripcionCarga_IN`. *(alta)*
5. **[Incidentes]** Filtro listado → excluir "Pendiente"/"Aprobada". *(alta)*
6. **[Incidentes]** Reset de máquina al cambiar edificio. *(baja)*
7. **[Máquinas]** Verificar `IDIncidente_IN` vs `IDIncidente_RI` en filtro de repuestos. *(baja)*
8. **[Incidentes]** Foto en alta: quitar o persistir (pérdida silenciosa). *(alta — decidir)*

### (d) Estética / decisiones de producto
1. **[Incidentes]** Semántica "Reportar" vs "Registrar". 2. Generar ventilación (adelantar vs crear).
3. Combobox buscable en alta. 4. Textos contextuales por card. 5. `StatusBadge` máquinas. 6. Obligatoriedad de observación.

### ⚠️ Decisiones de negocio a confirmar (bloquean parte del plan)
- ¿Quién pone el incidente en **"Asignado"**? (define si el cierre va en mobile o en otra app)
- ¿El **mail-al-edificio** de "Reportar" es feature nueva o error de interpretación?
- ¿Se necesita **alta de incidente ya resuelto** en mobile?
- ¿El **cambio de máquina** lo cierra el técnico o el admin?
- ¿**Mails** automáticos (paridad PA) o compositor libre (React actual)?
- ¿Las **coordenadas secundarias** (lat2/lng2) son reales o son la UI de `Latitud_ED`/`Longitud_ED`?
