# Módulo Incidentes — funcionamiento (relevado del `.msapp`)

> Documentación derivada de `docs/powerapps/Src/Screen_Incidentes.pa.yaml` (~3.7k líneas,
> ~41 `Collect` / 31 `Patch`) + `ScreenHome.pa.yaml` (OnSelect del botón de módulo).
> Es la **spec** para reconstruir Incidentes en React/backend. Mapear nombres de columna con
> [`../sharepoint-schema.md`](../sharepoint-schema.md).

## Listas que toca

| Lista                     | Uso                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `10.Incidentes`           | entidad principal (crear / anular / resolver / listar)                                   |
| `13.RepuestosIncidentes`  | repuestos usados por incidente (interno id = `IDIncidente_IN`, display `IDIncidente_RI`) |
| `12.FotoIncidentes`       | fotos del incidente (`IDIncidente_FI`, `Foto_FI`)                                        |
| `99.ABMRepuestos_Tecnico` | stock del técnico (descuento al resolver)                                                |
| `04.Stock`                | stock general (`Status_ST="Activo"`)                                                     |
| `08.DetalleMaquina`       | cambio de máquina al resolver                                                            |
| `19.Ventilaciones`        | crear ventilación desde incidente (`EsIncidente_VE="SI"`)                                |
| `99.ABM_Emails`           | destinatarios de mail por `Modulo_EM`                                                    |
| `Usuarios`                | técnicos (teléfono para WhatsApp)                                                        |

## Carga de datos (collects)

- **Lista principal** (activos): `CollectIncidentes = Filter('10.Incidentes', Resuelto_IN = "NO")`.
  Variante por técnico: `CollectIncidentesEdificio = Filter('10.Incidentes', TecnicoAsignado_IN = NombreUser And Resuelto_IN = "NO")`.
- **Stock del técnico**: `Filter('99.ABMRepuestos_Tecnico', Tecnico_RT = NombreUser)` (+ índice `Aux` calculado con `ForAll`/`Patch` — workaround de PowerApps, innecesario en backend).
- **Stock general**: `Filter('04.Stock', Status_ST = "Activo")`.
- **Repuestos del incidente**: `Filter('13.RepuestosIncidentes', IDIncidente_RI = Text(ID))`.
- **Máquinas**: `08.DetalleMaquina` (combos por edificio).
- **Mails**: `'99.ABM_Emails'` (Bcc por `Modulo_EM = "Incidentes"`).

## Modelo de estados

`Status_IN` ∈ { `Pendiente`, **`A Revisar`**, `Asignado`, `En Aprobacion`, `Aprobada`, `Resuelto`, `Anulado` }.

- `Resuelto_IN` ∈ { `SI`, `NO` } — **activo = `Resuelto_IN = "NO"`** (es el filtro de la lista).
- `NoResuelto_IN` ∈ { `Reportado Por Tecnico`, `Cambio de Maquina`, `Resuelto Sin Repuesto`, … } —
  determina la etiqueta de repuestos en el historial (ver `Screen_HM`).

## Flujos de escritura

### 1) Crear incidente (técnico) — `bt_saveReportarIncidente` (~L3507)

`Patch('10.Incidentes', Defaults('10.Incidentes'), { … })` con payload completo:

| Campo                                                     | Valor                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Título`                                                  | `"Wash Inn"`                                                                                     |
| `IDMaquina_IN`                                            | lookup por `ConcatMaquinaIncidente_DM`                                                           |
| `ConcatMaquina_IN`                                        | máquina elegida (Blank si "Elegir Edificio")                                                     |
| `Categoria_IN`                                            | `"Agua"` ⚠️ **hardcodeado**                                                                      |
| `NoResuelto_IN`                                           | `"Reportado Por Tecnico"`                                                                        |
| `DescripcionCarga_IN`                                     | descripción ingresada                                                                            |
| `Status_IN`                                               | **`"A Revisar"`**                                                                                |
| `TecnicoAsignado_IN`                                      | técnico elegido                                                                                  |
| `Fecha_IN` / `FechaMesAno_IN` / `FechaAno_IN` / `Hora_IN` | now() en es-ES                                                                                   |
| `Version_IN`                                              | `VarVersion`                                                                                     |
| `User_IN`                                                 | usuario logueado                                                                                 |
| `CodigoEdifcio_IN`                                        | lookup por edificio                                                                              |
| `NombreEdificio_IN`                                       | edificio elegido                                                                                 |
| `Resuelto_IN`                                             | `"NO"`                                                                                           |
| `ConcatAux_IN`                                            | id efímero `Left(user,3) & mm:ss & "INC"` (para encontrar el ID recién creado y mandar WhatsApp) |

Luego: recarga `CollectIncidentes`, y **notifica al técnico por WhatsApp**:
`Launch("whatsapp://send?text=" & _Message & "&phone=+54" & LookUp(CollectUsuarios, Concat_Nombre_Apellido = tecnico, Telefono))`.
`_Message` = "INCIDENTE N : <id> / EDIFICIO / MAQUINA / OBSERVACIONES".

### 2) Anular — `bt_guardarAnular` (L2824)

```
Patch('10.Incidentes', LookUp(ID = IDContinuar),
      { Status_IN: "Anulado", Resuelto_IN: "SI", DescripcionAnulado_IN: input_obsAnular.Text });
Office365Outlook.SendEmailV2("paul.risau@wash-innsystem.com.ar",
      "Incidente N: " & IDContinuar & " Anulado", <htmlBody>,
      { Bcc: LookUp(CollectMails, Modulo_EM = "Incidentes", MailSumar_EM) });
```

Luego recarga la lista del técnico.

### 3) Resolver (bloques escapados ~L806 / L1110 / L1499) — **transacción multi-lista**

Decodificar en Fase 2. Escribe en: `10.Incidentes` (estado → Resuelto/…), `13.RepuestosIncidentes`
(repuestos usados), `12.FotoIncidentes` (fotos), `99.ABMRepuestos_Tecnico` y `04.Stock`
(descuento de stock), `08.DetalleMaquina` (cambio de máquina si corresponde).

### 4) Crear ventilación desde incidente (L3386)

`Patch('19.Ventilaciones', …, { EsIncidente_VE: "SI", Estado_VE: "Asignada", … })`.

## Efectos externos

- **WhatsApp** al técnico (client-side → en React: `window.open("https://wa.me/54…?text=…")`).
- **Mails** (`Office365Outlook.SendEmailV2`) en anular/reportar → replicar con Graph `sendMail`
  (**requiere scope `Mail.Send`**), destinatarios desde `99.ABM_Emails` (`Modulo_EM="Incidentes"`).

## Oportunidades de mejora / hallazgos

- **Status divergente**: el mock React crea `Status_IN="Pendiente"`; el real es **`"A Revisar"`**
  (+ `NoResuelto_IN="Reportado Por Tecnico"`). Corregido al portar.
- `Categoria_IN="Agua"` hardcodeada pese a existir un combo de categoría → exponer la categoría real.
- Destinatario de mail de anulación hardcodeado (`paul.risau@…`) → tomar todo de `99.ABM_Emails`.
- `ConcatAux_IN` + `Patch`/`LookUp` para obtener el ID recién creado → innecesario: `createItem`
  de Graph ya devuelve el `id`.
- Índice `Aux` del stock del técnico (ForAll/Patch) → innecesario en backend.
- La lista PowerApps solo trae activos (`Resuelto_IN="NO"`); la pantalla React agrega tab
  "Cerrados" → el backend expone `?resuelto=SI|NO` para soportar ambas.

## Estado de la reconstrucción

- **Fase 1 (core)**: lista (scopeada por técnico, por estado), crear (status real + WhatsApp),
  anular, ver repuestos. → `api/_lib/incidentes.ts`, `api/incidentes.ts`, client + pantallas.
- **Fase 2 (pendiente)**: resolver transaccional (stock/cambio de máquina), crear-ventilación
  desde incidente, y mails vía Graph (`Mail.Send`).
