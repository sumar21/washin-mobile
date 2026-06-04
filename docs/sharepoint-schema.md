# WashInn — Esquema SharePoint (base de datos)

> Documento generado por introspección read-only del sitio SharePoint vía Microsoft Graph.
> Es la **base de datos real** de la app. El backend (Vercel + Graph API) y el front consumen estas listas.

## Conexión

- **Sitio:** WashInn — https://sumardigital.sharepoint.com/sites/Nueva
- **Site ID:** `dfc1fa64-5f15-4d04-9a21-8a93ffa8fa1a` (env `SHAREPOINT_SITE_ID`)
- **Auth:** OAuth2 _client credentials_ (app registration en Azure AD) — envs `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.
- **Token:** `POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` con `scope=https://graph.microsoft.com/.default`.
- **Listas:** `GET https://graph.microsoft.com/v1.0/sites/{siteId}/lists`
- **Ítems:** `GET .../lists/{listId}/items?$expand=fields` — los campos vienen bajo `fields` usando el **nombre interno** de columna (columna _Interno (Graph)_ en las tablas).

> ⚠️ **Importante:** Graph usa el **nombre interno** de la columna, no el display. Ej.: en _Usuarios_ el usuario de login es `field_1` y el password `field_4`, aunque se muestren como _Usuario_/_Password_. Nombres con acentos vienen codificados (ej. `Cumplea_x00f1_os` = _Cumpleaños_).

## 🔐 Autenticación / Login

- **Lista:** `Usuarios` (referida como `00.Usuarios`).
- **Usuario (user log):** columna interna **`field_1`** (display _Usuario_). Es la combinación de las **3 primeras letras del nombre (primera en mayúscula) + apellido**. Ej.: _Agustín Fernández_ → `Agufernandez`.
- **Password:** columna interna **`field_4`** (display _Password_).
- **Filtro de acceso:** solo usuarios con **`Status`** = `Activo` / `Alta`. Los inactivos no pueden ingresar.
- **Rol:** columna `Rol` (define permisos; ver `99.ListaPermisosMobile`).

**Columnas de `Usuarios`:**

| Interno (Graph)          | Display                | Tipo  | Notas |
| ------------------------ | ---------------------- | ----- | ----- |
| `Title`                  | Legajo                 | Texto |       |
| `field_1`                | Usuario                | Texto |       |
| `field_4`                | Password               | Texto |       |
| `Status`                 | Status                 | Texto |       |
| `Nombre`                 | Nombre                 | Texto |       |
| `Apellido`               | Apellido               | Texto |       |
| `Concat_Nombre_Apellido` | Concat_Nombre_Apellido | Texto |       |
| `Telefono`               | Telefono               | Texto |       |
| `Cumplea_x00f1_os`       | Cumpleaños             | Texto |       |
| `Correo`                 | Correo                 | Texto |       |
| `Rol`                    | Rol                    | Texto |       |
| `FechaNac_USR`           | FechaNac_USR           | Texto |       |

## Índice de listas

- [01.Registros](#01registros) — `01Registros`
- [02.Detalles](#02detalles) — `Lista`
- [03.ScanneoCodigos](#03scanneocodigos) — `03ScanneoCodigos`
- [04.Stock](#04stock) — `04Stock`
- [05.PedidoCompras](#05pedidocompras) — `05PedidoCompras`
- [06.DetalleCompra](#06detallecompra) — `06DetalleCompra`
- [07.Aprobaciones](#07aprobaciones) — `07Aprobaciones`
- [08.DetalleMaquina](#08detallemaquina) — `08DetalleMaquina`
- [09.HistorialMaquina](#09historialmaquina) — `09HistorialMaquina`
- [10.Incidentes](#10incidentes) — `10Incidentes`
- [11.Respuestos](#11respuestos) — `11Respuestos`
- [12.FotoIncidentes](#12fotoincidentes) — `12FotoIncidentes`
- [13.RepuestosIncidentes](#13repuestosincidentes) — `13RepuestosIncidentes`
- [14.HorasDescanso](#14horasdescanso) — `14HorasDescanso`
- [15.ResumenPlanificaciones](#15resumenplanificaciones) — `15ResumenPlanificaciones`
- [16.DetallePlanificaciones](#16detalleplanificaciones) — `16DetallePlanificaciones`
- [17.MesesPlanificacion](#17mesesplanificacion) — `17MesesPlanificacion`
- [18.EdificiosVisitar](#18edificiosvisitar) — `18EdificiosVisitar`
- [19.Ventilaciones](#19ventilaciones) — `19Ventilaciones`
- [99.ABM_DetalleCircuito](#99abmdetallecircuito) — `99ABM_DetalleCircuito`
- [99.ABM_Emails](#99abmemails) — `99ABM_Emails`
- [99.ABM_Encendedores](#99abmencendedores) — `99ABM_Encendedores`
- [99.ABM_Frecuencias](#99abmfrecuencias) — `99ABM_Frecuencias`
- [99.ABM_GruposVent](#99abmgruposvent) — `99ABM_GruposVent`
- [99.ABM_ItemCompras](#99abmitemcompras) — `99ABM_ItemCompras`
- [99.ABM_MaquinasCompra](#99abmmaquinascompra) — `99ABM_MaquinasCompra`
- [99.ABM_ResumenCircuito](#99abmresumencircuito) — `99ABM_ResumenCircuito`
- [99.ABM_Rutas](#99abmrutas) — `99ABM_Rutas`
- [99.ABM_TipoABM](#99abmtipoabm) — `99ABM_TipoABM`
- [99.ABMRepuestos_Tecnico](#99abmrepuestostecnico) — `99ABMRepuestos_Tecnico`
- [99.ListaPermisosDesktop](#99listapermisosdesktop) — `99ListaPermisosDesktop`
- [99.ListaPermisosMobile](#99listapermisosmobile) — `99ListaPermisosMobile`
- [99.LPPDesktop](#99lppdesktop) — `99LPPDesktop`
- [99.MotivosCancelacion](#99motivoscancelacion) — `99MotivosCancelacion`
- [ABM.Checklist](#abmchecklist) — `ABMChecklist`
- [ABM.Edificios](#abmedificios) — `ABMEdificios`
- [ABM.Roles](#abmroles) — `ABMRoles`
- [Usuarios](#usuarios) — `Usuarios`

## Listas

Total: **38** listas de negocio (se omiten librerías de documentos y listas de sistema ocultas).

### 01.Registros

**Nombre interno (Graph):** `01Registros` · **Template:** genericList · **Columnas de negocio:** 28

| Interno (Graph)             | Display                   | Tipo   | Req | Notas      |
| --------------------------- | ------------------------- | ------ | :-: | ---------- |
| `Title`                     | Título                    | Texto  |     |            |
| `Edificio`                  | Edificio                  | Texto  |     |            |
| `Nombre`                    | Nombre                    | Texto  |     |            |
| `Hora`                      | HoraInicio                | Texto  |     |            |
| `Fecha`                     | HoraFinal                 | Texto  |     |            |
| `IDUnico`                   | IDUnico                   | Texto  |     |            |
| `ObservacionFinal`          | ObservacionGeneral        | Texto  |     |            |
| `ImagenGral`                | ImagenGral                | Texto  |     | multilínea |
| `HoraVisita`                | HoraVisita                | Texto  |     |            |
| `HoraSalida`                | HoraSalida                | Texto  |     |            |
| `Codigo`                    | Codigo                    | Texto  |     |            |
| `Direccion`                 | Direccion                 | Texto  |     |            |
| `Fecha0`                    | Fecha                     | Texto  |     |            |
| `MesA_x00f1_o`              | MesAño                    | Texto  |     |            |
| `Concat_Edificio_Direccion` | Concat_Edificio_Direccion | Texto  |     |            |
| `Estado`                    | Estado                    | Texto  |     |            |
| `Check`                     | Check                     | Número |     |            |
| `Ok`                        | Ok                        | Número |     |            |
| `VersionApp_R`              | VersionApp_R              | Texto  |     |            |
| `FechaTerminada_R`          | FechaTerminada_R          | Texto  |     |            |
| `TecnicoAsignado_R`         | TecnicoAsignado_R         | Texto  |     |            |
| `ObservacionEdificio_R`     | ObservacionEdificio_R     | Texto  |     |            |
| `HoraSugerida_R`            | HoraSugerida_R            | Texto  |     |            |
| `NroCircuito_R`             | NroCircuito_R             | Número |     |            |
| `NroRuta_R`                 | NroRuta_R                 | Texto  |     |            |
| `UnivocoCircuito_R`         | UnivocoCircuito_R         | Texto  |     |            |
| `MotivoCancelacion_R`       | MotivoCancelacion_R       | Texto  |     |            |
| `ObservacionCancelacion_R`  | ObservacionCancelacion_R  | Texto  |     |            |

### 02.Detalles

**Nombre interno (Graph):** `Lista` · **Template:** genericList · **Columnas de negocio:** 14

| Interno (Graph)    | Display          | Tipo  | Req | Notas    |
| ------------------ | ---------------- | ----- | :-: | -------- |
| `Title`            | Título           | Texto |     |          |
| `Edificio`         | Edificio         | Texto |     |          |
| `Nombre`           | Nombre           | Texto |     |          |
| `Check`            | Check            | Texto |     |          |
| `IDUnico`          | IDUnico          | Texto |     | indexado |
| `ObservacionUnica` | ObservacionItem  | Texto |     |          |
| `Item`             | Item             | Texto |     | indexado |
| `Version_D`        | Version_D        | Texto |     |          |
| `Fecha_D`          | Fecha_D          | Texto |     |          |
| `FechaMesAno_D`    | FechaMesAno_D    | Texto |     |          |
| `FechaMes_D`       | FechaMes_D       | Texto |     |          |
| `Status_D`         | Status_D         | Texto |     |          |
| `Hora_D`           | Hora_D           | Texto |     |          |
| `NombreEdificio_D` | NombreEdificio_D | Texto |     |          |

### 03.ScanneoCodigos

**Nombre interno (Graph):** `03ScanneoCodigos` · **Template:** genericList · **Columnas de negocio:** 12

| Interno (Graph)     | Display           | Tipo  | Req | Notas      |
| ------------------- | ----------------- | ----- | :-: | ---------- |
| `Title`             | Título            | Texto |     |            |
| `Usuario_SC`        | Usuario_SC        | Texto |     |            |
| `Fecha_SC`          | Fecha_SC          | Texto |     |            |
| `CodigoEdificio_SC` | CodigoEdificio_SC | Texto |     |            |
| `FechaMes_SC`       | FechaMes_SC       | Texto |     |            |
| `FechaMesAno_SC`    | FechaMesAno_SC    | Texto |     |            |
| `VarVersion_SC`     | VarVersion_SC     | Texto |     |            |
| `HoraFin_SC`        | HoraFin_SC        | Texto |     |            |
| `IDScanneado_SC`    | IDScanneado_SC    | Texto |     |            |
| `Estado_SC`         | Estado_SC         | Texto |     |            |
| `FotoOBSGeneral_SC` | FotoOBSGeneral_SC | Texto |     | multilínea |
| `OBSGeneral_SC`     | OBSGeneral_SC     | Texto |     |            |

### 04.Stock

**Nombre interno (Graph):** `04Stock` · **Template:** genericList · **Columnas de negocio:** 13

| Interno (Graph)     | Display           | Tipo  | Req | Notas      |
| ------------------- | ----------------- | ----- | :-: | ---------- |
| `Title`             | Título            | Texto |     |            |
| `Status_ST`         | Status_ST         | Texto |     |            |
| `Lodge_ST`          | Item_ST           | Texto |     |            |
| `Nro_ST`            | Nro_ST            | Texto |     |            |
| `Cantidad_ST`       | Cantidad_ST       | Texto |     |            |
| `FechaUltMod_ST`    | FechaUltMod_ST    | Texto |     |            |
| `FechaMesUltMod_ST` | FechaMesUltMod_ST | Texto |     |            |
| `UserMod_ST`        | UserMod_ST        | Texto |     |            |
| `VersionMod_ST`     | VersionMod_ST     | Texto |     |            |
| `Tipo_ST`           | Tipo_ST           | Texto |     | multilínea |
| `ModuloAgregado_ST` | ModuloAgregado_ST | Texto |     |            |
| `ConcatStock_ST`    | ConcatStock_ST    | Texto |     |            |
| `Marca_ST`          | Marca_ST          | Texto |     |            |

### 05.PedidoCompras

**Nombre interno (Graph):** `05PedidoCompras` · **Template:** genericList · **Columnas de negocio:** 17

| Interno (Graph)          | Display                | Tipo  | Req | Notas |
| ------------------------ | ---------------------- | ----- | :-: | ----- |
| `Title`                  | Título                 | Texto |     |       |
| `Status_PC`              | Status_PC              | Texto |     |       |
| `Edificio_PC`            | Edificio_PC            | Texto |     |       |
| `Cantidad_PC`            | Cantidad_PC            | Texto |     |       |
| `Observaciones_PC`       | Observaciones_PC       | Texto |     |       |
| `Fecha_PC`               | Fecha_PC               | Texto |     |       |
| `FechaMesAno_PC`         | FechaMesAno_PC         | Texto |     |       |
| `FechaMes_PC`            | FechaMes_PC            | Texto |     |       |
| `FechaAno_PC`            | FechaAno_PC            | Texto |     |       |
| `Usuario_PC`             | Usuario_PC             | Texto |     |       |
| `Version_PC`             | Version_PC             | Texto |     |       |
| `IDUnivoco_PC`           | IDUnivoco_PC           | Texto |     |       |
| `Segmento_PC`            | Segmento_PC            | Texto |     |       |
| `Filtrar_PC`             | Filtrar_PC             | Texto |     |       |
| `Hora_PC`                | Hora_PC                | Texto |     |       |
| `IDIncidenteCompra_PC`   | IDIncidenteCompra_PC   | Texto |     |       |
| `ObservacionRecibida_PC` | ObservacionRecibida_PC | Texto |     |       |

### 06.DetalleCompra

**Nombre interno (Graph):** `06DetalleCompra` · **Template:** genericList · **Columnas de negocio:** 12

| Interno (Graph)        | Display              | Tipo  | Req | Notas |
| ---------------------- | -------------------- | ----- | :-: | ----- |
| `Title`                | Título               | Texto |     |       |
| `Item_DC`              | Item_DC              | Texto |     |       |
| `IDCompra_DC`          | IDCompra_DC          | Texto |     |       |
| `Status_DC`            | Status_DC            | Texto |     |       |
| `Cantidad_DC`          | Cantidad_DC          | Texto |     |       |
| `Segmento_DC`          | Segmento_DC          | Texto |     |       |
| `Fecha_DC`             | Fecha_DC             | Texto |     |       |
| `FechaMesAno_DC`       | FechaMesAno_DC       | Texto |     |       |
| `FechaAno_DC`          | FechaAno_DC          | Texto |     |       |
| `CantidadIngresada_DC` | CantidadIngresada_DC | Texto |     |       |
| `Rechazada_DC`         | Rechazada_DC         | Texto |     |       |
| `Marca_DC`             | Marca_DC             | Texto |     |       |

### 07.Aprobaciones

**Nombre interno (Graph):** `07Aprobaciones` · **Template:** genericList · **Columnas de negocio:** 33

| Interno (Graph)             | Display                   | Tipo  | Req | Notas |
| --------------------------- | ------------------------- | ----- | :-: | ----- |
| `Title`                     | Título                    | Texto |     |       |
| `TipoAprobacion_AP`         | TipoAprobacion_AP         | Texto |     |       |
| `Status_AP`                 | Status_AP                 | Texto |     |       |
| `ItemAprobacion_AP`         | ItemAprobacion_AP         | Texto |     |       |
| `ConcatAprobacion_AP`       | ConcatAprobacion_AP       | Texto |     |       |
| `IDCompra_AP`               | IDCompra_AP               | Texto |     |       |
| `Rechazada_AP`              | Rechazada_AP              | Texto |     |       |
| `IDMaquina_AP`              | IDMaquina_AP              | Texto |     |       |
| `InfoRechazo_AP`            | InfoRechazo_AP            | Texto |     |       |
| `Fecha_AP`                  | Fecha_AP                  | Texto |     |       |
| `FechaMes_AP`               | FechaMes_AP               | Texto |     |       |
| `FechaMesAno_AP`            | FechaMesAno_AP            | Texto |     |       |
| `FechaAno_AP`               | FechaAno_AP               | Texto |     |       |
| `User_AP`                   | User_AP                   | Texto |     |       |
| `FechaGen_AP`               | FechaGen_AP               | Texto |     |       |
| `FechaMesGen_AP`            | FechaMesGen_AP            | Texto |     |       |
| `FechaMesAnoGen_AP`         | FechaMesAnoGen_AP         | Texto |     |       |
| `FechaAnoGen_AP`            | FechaAnoGen_AP            | Texto |     |       |
| `UserGen_AP`                | UserGen_AP                | Texto |     |       |
| `HoraGen_AP`                | HoraGen_AP                | Texto |     |       |
| `Hora_AP`                   | Hora_AP                   | Texto |     |       |
| `VersionGen_AP`             | VersionGen_AP             | Texto |     |       |
| `Version_AP`                | Version_AP                | Texto |     |       |
| `Aprobada_AP`               | Aprobada_AP               | Texto |     |       |
| `MaquinaAprobacion_AP`      | MaquinaAprobacion_AP      | Texto |     |       |
| `Motivo_AP`                 | Motivo_AP                 | Texto |     |       |
| `EdificioDestino_AP`        | EdificioDestino_AP        | Texto |     |       |
| `SegmentoTranferir_AP`      | SegmentoTranferir_AP      | Texto |     |       |
| `SegMarcMod_AP`             | SegMarcMod_AP             | Texto |     |       |
| `TipoEncendido_AP`          | TipoEncendido_AP          | Texto |     |       |
| `EdificioSelect_AP`         | EdificioSelect_AP         | Texto |     |       |
| `IDMaquinaTransferencia_AP` | IDMaquinaTransferencia_AP | Texto |     |       |
| `IDRegistroDM_AP`           | IDRegistroDM_AP           | Texto |     |       |

### 08.DetalleMaquina

**Nombre interno (Graph):** `08DetalleMaquina` · **Template:** genericList · **Columnas de negocio:** 21

| Interno (Graph)             | Display                   | Tipo  | Req | Notas |
| --------------------------- | ------------------------- | ----- | :-: | ----- |
| `Title`                     | Título                    | Texto |     |       |
| `Marca_DM`                  | Marca_DM                  | Texto |     |       |
| `Segmentp_DM`               | Segmento_DM               | Texto |     |       |
| `Edificio_DM`               | Edificio_DM               | Texto |     |       |
| `Encendido_DM`              | Encendido_DM              | Texto |     |       |
| `NroSerie_DM`               | NroSerie_DM               | Texto |     |       |
| `FechaIngreso_DM`           | FechaIngreso_DM           | Texto |     |       |
| `Status_DM`                 | Status_DM                 | Texto |     |       |
| `ConcatMaquina_DM`          | ConcatMaquina_DM          | Texto |     |       |
| `Modelo_DM`                 | Modelo_DM                 | Texto |     |       |
| `IDMaquina_DM`              | IDMaquina_DM              | Texto |     |       |
| `Destino_DM`                | Destino_DM                | Texto |     |       |
| `Bocas_DM`                  | Bocas_DM                  | Texto |     |       |
| `CodigoEdificio_DM`         | CodigoEdificio_DM         | Texto |     |       |
| `Motr_DM`                   | Motr_DM                   | Texto |     |       |
| `Bomba_DM`                  | Bomba_DM                  | Texto |     |       |
| `Timer_DM`                  | Timer_DM                  | Texto |     |       |
| `ConcatMaquinaIncidente_DM` | ConcatMaquinaIncidente_DM | Texto |     |       |
| `FechaMesAnoIngreso_DM`     | FechaMesAnoIngreso_DM     | Texto |     |       |
| `Motivo_DM`                 | Motivo_DM                 | Texto |     |       |
| `EncendidoPropuesto_AP`     | EncendidoPropuesto_AP     | Texto |     |       |

### 09.HistorialMaquina

**Nombre interno (Graph):** `09HistorialMaquina` · **Template:** genericList · **Columnas de negocio:** 15

| Interno (Graph)    | Display          | Tipo  | Req | Notas |
| ------------------ | ---------------- | ----- | :-: | ----- |
| `Title`            | Título           | Texto |     |       |
| `IDMaquina_HM`     | IDMaquina_HM     | Texto |     |       |
| `Edificio_HM`      | Edificio_HM      | Texto |     |       |
| `Repuesto_HM`      | Repuesto_HM      | Texto |     |       |
| `User_HM`          | User_HM          | Texto |     |       |
| `Detalle_HM`       | Detalle_HM       | Texto |     |       |
| `Fecha_HM`         | Fecha_HM         | Texto |     |       |
| `FechaMes_HM`      | FechaMes_HM      | Texto |     |       |
| `FechaMesAno_HM`   | FechaMesAno_HM   | Texto |     |       |
| `FechaAno_HM`      | FechaAno_HM      | Texto |     |       |
| `Hora_HM`          | Hora_HM          | Texto |     |       |
| `Version_HM`       | Version_HM       | Texto |     |       |
| `Status_HM`        | Status_HM        | Texto |     |       |
| `TecnicoAsig_HM`   | TecnicoAsig_HM   | Texto |     |       |
| `ConcatMaquina_HM` | ConcatMaquina_HM | Texto |     |       |

### 10.Incidentes

**Nombre interno (Graph):** `10Incidentes` · **Template:** genericList · **Columnas de negocio:** 33

| Interno (Graph)          | Display                | Tipo  | Req | Notas |
| ------------------------ | ---------------------- | ----- | :-: | ----- |
| `Title`                  | Título                 | Texto |     |       |
| `IDMaquina_IN`           | IDMaquina_IN           | Texto |     |       |
| `Categoria_IN`           | Categoria_IN           | Texto |     |       |
| `NoResuelto_IN`          | NoResuelto_IN          | Texto |     |       |
| `Repuesto_IN`            | Repuesto_IN            | Texto |     |       |
| `Descripcion_IN`         | Descripcion_IN         | Texto |     |       |
| `Status_IN`              | Status_IN              | Texto |     |       |
| `TecnicoAsignado_IN`     | TecnicoAsignado_IN     | Texto |     |       |
| `Fecha_IN`               | Fecha_IN               | Texto |     |       |
| `FechaMes_IN`            | FechaMes_IN            | Texto |     |       |
| `FechaMesAno_IN`         | FechaMesAno_IN         | Texto |     |       |
| `FechaAno_IN`            | FechaAno_IN            | Texto |     |       |
| `FechaResuelto_IN`       | FechaResuelto_IN       | Texto |     |       |
| `User_IN`                | User_IN                | Texto |     |       |
| `Hora_IN`                | Hora_IN                | Texto |     |       |
| `HoraResuelto_IN`        | HoraResuelto_IN        | Texto |     |       |
| `Version_IN`             | Version_IN             | Texto |     |       |
| `ConcatMaquina_IN`       | ConcatMaquina_IN       | Texto |     |       |
| `CodigoEdifcio_IN`       | CodigoEdifcio_IN       | Texto |     |       |
| `CodigoRepuesto_IN`      | CodigoRepuesto_IN      | Texto |     |       |
| `NombreEdificio_IN`      | NombreEdificio_IN      | Texto |     |       |
| `FechaAsignada_IN`       | FechaAsignada_IN       | Texto |     |       |
| `Resuelto_IN`            | Resuelto_IN            | Texto |     |       |
| `MaquinaAsignada_IN`     | MaquinaAsignada_IN     | Texto |     |       |
| `CantidadRepuestos_IN`   | CantidadRepuestos_IN   | Texto |     |       |
| `UserSolicitado_IN`      | UserSolicitado_IN      | Texto |     |       |
| `DescripcionCarga_IN`    | DescripcionCarga_IN    | Texto |     |       |
| `DescripcionResuelto_IN` | DescripcionResuelto_IN | Texto |     |       |
| `ConcatAux_IN`           | ConcatAux_IN           | Texto |     |       |
| `DescripcionAnulado_IN`  | DescripcionAnulado_IN  | Texto |     |       |
| `VersionResuelto_IN`     | VersionResuelto_IN     | Texto |     |       |
| `MotivoTransferencia_IN` | MotivoTransferencia_IN | Texto |     |       |
| `AppOrigen_IN`           | AppOrigen_IN           | Texto |     |       |

### 11.Respuestos

**Nombre interno (Graph):** `11Respuestos` · **Template:** genericList · **Columnas de negocio:** 7

| Interno (Graph)     | Display           | Tipo  | Req | Notas |
| ------------------- | ----------------- | ----- | :-: | ----- |
| `Title`             | Título            | Texto |     |       |
| `Nombre_RP`         | Nombre_RP         | Texto |     |       |
| `Codigo_RP`         | Codigo_RP         | Texto |     |       |
| `Marca_RP`          | Marca_RP          | Texto |     |       |
| `Stock_RP`          | Stock_RP          | Texto |     |       |
| `Status_RP`         | Status_RP         | Texto |     |       |
| `ConcatRepuesto_RP` | ConcatRepuesto_RP | Texto |     |       |

### 12.FotoIncidentes

**Nombre interno (Graph):** `12FotoIncidentes` · **Template:** genericList · **Columnas de negocio:** 3

| Interno (Graph)  | Display        | Tipo  | Req | Notas      |
| ---------------- | -------------- | ----- | :-: | ---------- |
| `Title`          | Título         | Texto |     |            |
| `IDIncidente_FI` | IDIncidente_FI | Texto |     |            |
| `Foto_FI`        | Foto_FI        | Texto |     | multilínea |

### 13.RepuestosIncidentes

**Nombre interno (Graph):** `13RepuestosIncidentes` · **Template:** genericList · **Columnas de negocio:** 6

| Interno (Graph)  | Display        | Tipo  | Req | Notas |
| ---------------- | -------------- | ----- | :-: | ----- |
| `Title`          | Título         | Texto |     |       |
| `IDIncidente_IN` | IDIncidente_RI | Texto |     |       |
| `Repuesto_RI`    | Repuesto_RI    | Texto |     |       |
| `FechaMes_RI`    | FechaMes_RI    | Texto |     |       |
| `Status_RI`      | Status_RI      | Texto |     |       |
| `Cantidad_RI`    | Cantidad_RI    | Texto |     |       |

### 14.HorasDescanso

**Nombre interno (Graph):** `14HorasDescanso` · **Template:** genericList · **Columnas de negocio:** 11

| Interno (Graph)     | Display           | Tipo  | Req | Notas |
| ------------------- | ----------------- | ----- | :-: | ----- |
| `Title`             | Título            | Texto |     |       |
| `HoraInicio_HD`     | HoraInicio_HD     | Texto |     |       |
| `HoraFin_HD`        | HoraFin_HD        | Texto |     |       |
| `DifHora_HD`        | DifHora_HD        | Texto |     |       |
| `Fecha_HD`          | Fecha_HD          | Texto |     |       |
| `User_HD`           | User_HD           | Texto |     |       |
| `FechaMes_HD`       | FechaMes_HD       | Texto |     |       |
| `FechaAno_HD`       | FechaAno_HD       | Texto |     |       |
| `Version_HD`        | Version_HD        | Texto |     |       |
| `Status_HD`         | Status_HD         | Texto |     |       |
| `DifHoraMinutos_HD` | DifHoraMinutos_HD | Texto |     |       |

### 15.ResumenPlanificaciones

**Nombre interno (Graph):** `15ResumenPlanificaciones` · **Template:** genericList · **Columnas de negocio:** 14

| Interno (Graph)    | Display          | Tipo   | Req | Notas |
| ------------------ | ---------------- | ------ | :-: | ----- |
| `Title`            | Título           | Texto  |     |       |
| `Mes_RP`           | Mes_RP           | Texto  |     |       |
| `Status_RP`        | Status_RP        | Texto  |     |       |
| `Fecha_RP`         | Fecha_RP         | Texto  |     |       |
| `FechaMesAno_RP`   | FechaMesAno_RP   | Texto  |     |       |
| `FechaAno_RP`      | FechaAno_RP      | Texto  |     |       |
| `MesAnoRuta_RP`    | MesAnoRuta_RP    | Texto  |     |       |
| `IDUnivocoRuta_RP` | IDUnivocoRuta_RP | Texto  |     |       |
| `Version_RP`       | Version_RP       | Texto  |     |       |
| `User_RP`          | User_RP          | Texto  |     |       |
| `Circuitos_RP`     | Circuitos_RP     | Número |     |       |
| `Tecnico_RP`       | Tecnico_RP       | Texto  |     |       |
| `NroRuta_RP`       | NroRuta_RP       | Texto  |     |       |
| `Hora_RP`          | Hora_RP          | Texto  |     |       |

### 16.DetallePlanificaciones

**Nombre interno (Graph):** `16DetallePlanificaciones` · **Template:** genericList · **Columnas de negocio:** 12

| Interno (Graph)          | Display                | Tipo   | Req | Notas |
| ------------------------ | ---------------------- | ------ | :-: | ----- |
| `Title`                  | Título                 | Texto  |     |       |
| `IDUnivoco_DP`           | IDUnivoco_DP           | Texto  |     |       |
| `NroRuta_DP`             | NroRuta_DP             | Número |     |       |
| `CantidadEdificios_DP`   | CantidadEdificios_DP   | Número |     |       |
| `Status_DP`              | Status_DP              | Texto  |     |       |
| `Tecnico_DP`             | Tecnico_DP             | Texto  |     |       |
| `MesAno_DP`              | MesAno_DP              | Texto  |     |       |
| `Mes_DP`                 | Mes_DP                 | Texto  |     |       |
| `IDUnivocoCircuito_DP`   | IDUnivocoCircuito_DP   | Texto  |     |       |
| `NroCircuito_DP`         | NroCircuito_DP         | Número |     |       |
| `Circuito_DP`            | Circuito_DP            | Número |     |       |
| `ObservacionCircuito_DP` | ObservacionCircuito_DP | Texto  |     |       |

### 17.MesesPlanificacion

**Nombre interno (Graph):** `17MesesPlanificacion` · **Template:** genericList · **Columnas de negocio:** 10

| Interno (Graph)        | Display              | Tipo  | Req | Notas |
| ---------------------- | -------------------- | ----- | :-: | ----- |
| `Title`                | Título               | Texto |     |       |
| `MesPlanificado`       | MesPlanificado_MP    | Texto |     |       |
| `RutasTotales_MP`      | RutasTotales_MP      | Texto |     |       |
| `TecnicosTotales_MP`   | TecnicosTotales_MP   | Texto |     |       |
| `MesAnoPlanificado_MP` | MesAnoPlanificado_MP | Texto |     |       |
| `Fecha_MP`             | Fecha_MP             | Texto |     |       |
| `User_MP`              | User_MP              | Texto |     |       |
| `VarVersion_MP`        | VarVersion_MP        | Texto |     |       |
| `Hora_MP`              | Hora_MP              | Texto |     |       |
| `Status_MP`            | Status_MP            | Texto |     |       |

### 18.EdificiosVisitar

**Nombre interno (Graph):** `18EdificiosVisitar` · **Template:** genericList · **Columnas de negocio:** 21

| Interno (Graph)          | Display                | Tipo  | Req | Notas |
| ------------------------ | ---------------------- | ----- | :-: | ----- |
| `Title`                  | Título                 | Texto |     |       |
| `TecnicoAsignado_EV`     | TecnicoAsignado_EV     | Texto |     |       |
| `CodigoEdificio_EV`      | CodigoEdificio_EV      | Texto |     |       |
| `IDUnivocoCircuito_EV`   | IDUnivocoCircuito_EV   | Texto |     |       |
| `Edificio_EV`            | Edificio_EV            | Texto |     |       |
| `Direccion_EV`           | Direccion_EV           | Texto |     |       |
| `ConcatEdificio_EV`      | ConcatEdificio_EV      | Texto |     |       |
| `Estado_EV`              | Estado_EV              | Texto |     |       |
| `MesAno_EV`              | MesAno_EV              | Texto |     |       |
| `NroCircuito_EV`         | NroCircuito_EV         | Texto |     |       |
| `NroRuta_EV`             | NroRuta_EV             | Texto |     |       |
| `HoraSugerida_EV`        | HoraSugerida_EV        | Texto |     |       |
| `ObservacionEdificio_EV` | ObservacionEdificio_EV | Texto |     |       |
| `IDUnivocoRuta_EV`       | IDUnivocoRuta_EV       | Texto |     |       |
| `Latitud_EV`             | Latitud_EV             | Texto |     |       |
| `Longitud_EV`            | Longitud_EV            | Texto |     |       |
| `Mail_EV`                | Mail_EV                | Texto |     |       |
| `Encargado_EV`           | Encargado_EV           | Texto |     |       |
| `Celular_EV`             | Celular_EV             | Texto |     |       |
| `Latitud2_EV`            | Latitud2_EV            | Texto |     |       |
| `Longitud2_EV`           | Longitud2_EV           | Texto |     |       |

### 19.Ventilaciones

**Nombre interno (Graph):** `19Ventilaciones` · **Template:** genericList · **Columnas de negocio:** 26

| Interno (Graph)              | Display                    | Tipo   | Req | Notas |
| ---------------------------- | -------------------------- | ------ | :-: | ----- |
| `Title`                      | Título                     | Texto  |     |       |
| `Estado_VE`                  | Estado_VE                  | Texto  |     |       |
| `Edificio_VE`                | Edificio_VE                | Texto  |     |       |
| `IDEdificio_VE`              | IDEdificio_VE              | Número |     |       |
| `Grupo_VE`                   | Grupo_VE                   | Texto  |     |       |
| `FechaUltima_VE`             | FechaUltima_VE             | Texto  |     |       |
| `ProximaLimpieza_VE`         | ProximaLimpieza_VE         | Texto  |     |       |
| `Frecuencia_VE`              | Frecuencia_VE              | Número |     |       |
| `Asignado_VE`                | Asignado_VE                | Texto  |     |       |
| `FechaProgramada_VE`         | FechaProgramada_VE         | Texto  |     |       |
| `ObservacionAdelanto_VE`     | ObservacionAdelanto_VE     | Texto  |     |       |
| `FechaFinalizacion_VE`       | FechaFinalizacion_VE       | Texto  |     |       |
| `HoraFinalizacion_VE`        | HoraFinalizacion_VE        | Texto  |     |       |
| `EsIncidente_VE`             | EsIncidente_VE             | Texto  |     |       |
| `FechaMesAnoProxima_VE`      | FechaMesAnoProxima_VE      | Texto  |     |       |
| `FechaMesAnoFinalizacion_VE` | FechaMesAnoFinalizacion_VE | Texto  |     |       |
| `DireccionEdificio_VE`       | DireccionEdificio_VE       | Texto  |     |       |
| `IDAsignado_VE`              | IDAsignado_VE              | Número |     |       |
| `ObservacionResuelto_VE`     | ObservacionResuelto_VE     | Texto  |     |       |
| `FechaAsignado_VE`           | FechaAsignado_VE           | Texto  |     |       |
| `HoraAsignado_VE`            | HoraAsignado_VE            | Texto  |     |       |
| `VersionAsignado_VE`         | VersionAsignado_VE         | Texto  |     |       |
| `VersionResuelto_VE`         | VersionResuelto_VE         | Texto  |     |       |
| `FechaAnoFinalizacion_VE`    | FechaAnoFinalizacion_VE    | Texto  |     |       |
| `FechaAnoProxima_VE`         | FechaAnoProxima_VE         | Texto  |     |       |
| `Orden_VE`                   | Orden_VE                   | Texto  |     |       |

### 99.ABM_DetalleCircuito

**Nombre interno (Graph):** `99ABM_DetalleCircuito` · **Template:** genericList · **Columnas de negocio:** 16

| Interno (Graph)     | Display           | Tipo   | Req | Notas |
| ------------------- | ----------------- | ------ | :-: | ----- |
| `Title`             | Título            | Texto  |     |       |
| `NroCircuito_DC`    | NroCircuito_DC    | Número |     |       |
| `CodigoEdificio_DC` | CodigoEdificio_DC | Texto  |     |       |
| `Edificio_DC`       | Edificio_DC       | Texto  |     |       |
| `Direccion_DC`      | Direccion_DC      | Texto  |     |       |
| `Horario_DC`        | Horario_DC        | Texto  |     |       |
| `ConcatContacto_DC` | ConcatContacto_DC | Texto  |     |       |
| `NroCelular_DC`     | NroCelular_DC     | Texto  |     |       |
| `Status_DC`         | Status_DC         | Texto  |     |       |
| `MailEdificio_DC`   | MailEdificio_DC   | Texto  |     |       |
| `Encargado_DC`      | Encargado_DC      | Texto  |     |       |
| `Latitud_DC`        | Latitud_DC        | Texto  |     |       |
| `Longitud_DC`       | Longitud_DC       | Texto  |     |       |
| `Observaciones_DC`  | Observaciones_DC  | Texto  |     |       |
| `Latitud2_DC`       | Latitud2_DC       | Texto  |     |       |
| `Longitud2_DC`      | Longitud2_DC      | Texto  |     |       |

### 99.ABM_Emails

**Nombre interno (Graph):** `99ABM_Emails` · **Template:** genericList · **Columnas de negocio:** 4

| Interno (Graph)  | Display        | Tipo  | Req | Notas |
| ---------------- | -------------- | ----- | :-: | ----- |
| `Title`          | Título         | Texto |     |       |
| `MailSumar_EM`   | MailSumar_EM   | Texto |     |       |
| `MailWashinn_EM` | MailWashinn_EM | Texto |     |       |
| `Modulo_EM`      | Modulo_EM      | Texto |     |       |

### 99.ABM_Encendedores

**Nombre interno (Graph):** `99ABM_Encendedores` · **Template:** genericList · **Columnas de negocio:** 4

| Interno (Graph) | Display   | Tipo  | Req | Notas |
| --------------- | --------- | ----- | :-: | ----- |
| `Title`         | Título    | Texto |     |       |
| `Modelo_EC`     | Modelo_EC | Texto |     |       |
| `Status_EC`     | Status_EC | Texto |     |       |
| `Marca_EC`      | Marca_EC  | Texto |     |       |

### 99.ABM_Frecuencias

**Nombre interno (Graph):** `99ABM_Frecuencias` · **Template:** genericList · **Columnas de negocio:** 3

| Interno (Graph) | Display       | Tipo   | Req | Notas |
| --------------- | ------------- | ------ | :-: | ----- |
| `Title`         | Título        | Texto  |     |       |
| `Frecuencia_FE` | Frecuencia_FE | Número |     |       |
| `Status_FE`     | Status_FE     | Texto  |     |       |

### 99.ABM_GruposVent

**Nombre interno (Graph):** `99ABM_GruposVent` · **Template:** genericList · **Columnas de negocio:** 3

| Interno (Graph) | Display   | Tipo  | Req | Notas |
| --------------- | --------- | ----- | :-: | ----- |
| `Title`         | Título    | Texto |     |       |
| `Grupo_GVE`     | Grupo_GVE | Texto |     |       |
| `Status_VE`     | Status_VE | Texto |     |       |

### 99.ABM_ItemCompras

**Nombre interno (Graph):** `99ABM_ItemCompras` · **Template:** genericList · **Columnas de negocio:** 3

| Interno (Graph) | Display   | Tipo  | Req | Notas |
| --------------- | --------- | ----- | :-: | ----- |
| `Title`         | Título    | Texto |     |       |
| `Item_IC`       | Item_IC   | Texto |     |       |
| `Status_IC`     | Status_IC | Texto |     |       |

### 99.ABM_MaquinasCompra

**Nombre interno (Graph):** `99ABM_MaquinasCompra` · **Template:** genericList · **Columnas de negocio:** 6

| Interno (Graph) | Display     | Tipo  | Req | Notas |
| --------------- | ----------- | ----- | :-: | ----- |
| `Title`         | Título      | Texto |     |       |
| `Concat_MC`     | Concat_MC   | Texto |     |       |
| `Marca_MC`      | Marca_MC    | Texto |     |       |
| `Status_MC`     | Status_MC   | Texto |     |       |
| `Segmento_MC`   | Segmento_MC | Texto |     |       |
| `Modelo_MC`     | Modelo_MC   | Texto |     |       |

### 99.ABM_ResumenCircuito

**Nombre interno (Graph):** `99ABM_ResumenCircuito` · **Template:** genericList · **Columnas de negocio:** 6

| Interno (Graph)       | Display             | Tipo   | Req | Notas |
| --------------------- | ------------------- | ------ | :-: | ----- |
| `Title`               | Título              | Texto  |     |       |
| `NroRuta_RC`          | NroRuta_RC          | Número |     |       |
| `CantidadEdificio_RC` | CantidadEdificio_RC | Número |     |       |
| `Status_RC`           | Status_RC           | Texto  |     |       |
| `NroCircuito_RC`      | NroCircuito_RC      | Número |     |       |
| `DetalleCircuito_RC`  | DetalleCircuito_RC  | Texto  |     |       |

### 99.ABM_Rutas

**Nombre interno (Graph):** `99ABM_Rutas` · **Template:** genericList · **Columnas de negocio:** 5

| Interno (Graph)        | Display              | Tipo   | Req | Notas |
| ---------------------- | -------------------- | ------ | :-: | ----- |
| `Title`                | Título               | Texto  |     |       |
| `NroRuta_RT`           | NroRuta_RT           | Número |     |       |
| `CantidadCircuitos_RT` | CantidadCircuitos_RT | Número |     |       |
| `CantEdificios_RT`     | CantEdificios_RT     | Número |     |       |
| `Status_RT`            | Status_RT            | Texto  |     |       |

### 99.ABM_TipoABM

**Nombre interno (Graph):** `99ABM_TipoABM` · **Template:** genericList · **Columnas de negocio:** 4

| Interno (Graph) | Display    | Tipo  | Req | Notas |
| --------------- | ---------- | ----- | :-: | ----- |
| `Title`         | Título     | Texto |     |       |
| `Nombre_ABM`    | Nombre_ABM | Texto |     |       |
| `Status_ABM`    | Status_ABM | Texto |     |       |
| `Order_ABM`     | Order_ABM  | Texto |     |       |

### 99.ABMRepuestos_Tecnico

**Nombre interno (Graph):** `99ABMRepuestos_Tecnico` · **Template:** genericList · **Columnas de negocio:** 7

| Interno (Graph) | Display     | Tipo  | Req | Notas |
| --------------- | ----------- | ----- | :-: | ----- |
| `Title`         | Título      | Texto |     |       |
| `Repuesto_RT`   | Repuesto_RT | Texto |     |       |
| `Tecnico_RT`    | Tecnico_RT  | Texto |     |       |
| `Cantidad_RT`   | Cantidad_RT | Texto |     |       |
| `Status_RT`     | Status_RT   | Texto |     |       |
| `Codigo_RT`     | Codigo_RT   | Texto |     |       |
| `Concat_RT`     | Concat_RT   | Texto |     |       |

### 99.ListaPermisosDesktop

**Nombre interno (Graph):** `99ListaPermisosDesktop` · **Template:** genericList · **Columnas de negocio:** 13

| Interno (Graph)       | Display             | Tipo  | Req | Notas      |
| --------------------- | ------------------- | ----- | :-: | ---------- |
| `Title`               | Título              | Texto |     |            |
| `Modulo_LPP`          | Modulo_LPP          | Texto |     |            |
| `Admin_LPP`           | Admin_LPP           | Texto |     |            |
| `Status_LPP`          | Status_LPP          | Texto |     |            |
| `Orden_LPP`           | Orden_LPP           | Texto |     |            |
| `SuperVisor_LPP`      | SuperVisor_LPP      | Texto |     |            |
| `ACliente_LPP`        | ACliente_LPP        | Texto |     |            |
| `JefeTaller_LPP`      | JefeTaller_LPP      | Texto |     |            |
| `ImgON_LPP`           | ImgON_LPP           | Texto |     | multilínea |
| `ImgOFF_LPP`          | ImgOFF_LPP          | Texto |     | multilínea |
| `SupervisorMNT_LPP`   | SupervisorMNT_LPP   | Texto |     |            |
| `SupervisorVTC_LPP`   | SupervisorVTC_LPP   | Texto |     |            |
| `SupervisorLider_LPP` | SupervisorLider_LPP | Texto |     |            |

### 99.ListaPermisosMobile

**Nombre interno (Graph):** `99ListaPermisosMobile` · **Template:** genericList · **Columnas de negocio:** 12

| Interno (Graph)       | Display             | Tipo  | Req | Notas      |
| --------------------- | ------------------- | ----- | :-: | ---------- |
| `Title`               | Título              | Texto |     |            |
| `Modulo_LPM`          | Modulo_LPM          | Texto |     |            |
| `Orden_LPM`           | Orden_LPM           | Texto |     |            |
| `Admin_LPM`           | Admin_LPM           | Texto |     |            |
| `Tecnico_LPM`         | Tecnico_LPM         | Texto |     |            |
| `Supervisor_LPM`      | Supervisor_LPM      | Texto |     |            |
| `IMG_LPM`             | IMG_LPM             | Texto |     | multilínea |
| `IMGBlocked_LPM`      | IMGBlocked_LPM      | Texto |     | multilínea |
| `JefeTaller_LPP`      | JefeTaller_LPP      | Texto |     |            |
| `AtencionCliente_LPP` | AtencionCliente_LPP | Texto |     |            |
| `NuevaImagen_LPM`     | NuevaImagen_LPM     | Texto |     | multilínea |
| `Status_LPP`          | Status_LPP          | Texto |     |            |

### 99.LPPDesktop

**Nombre interno (Graph):** `99LPPDesktop` · **Template:** genericList · **Columnas de negocio:** 8

| Interno (Graph)       | Display             | Tipo  | Req | Notas      |
| --------------------- | ------------------- | ----- | :-: | ---------- |
| `Title`               | Título              | Texto |     |            |
| `Modulo_LPPD`         | Modulo_LPPD         | Texto |     |            |
| `JefeTaller_LPP`      | JefeTaller_LPP      | Texto |     |            |
| `Admin_LPP`           | Admin_LPP           | Texto |     |            |
| `Supervisor_LPP`      | Supervisor_LPP      | Texto |     |            |
| `AtencionCliente_LPP` | AtencionCliente_LPP | Texto |     |            |
| `ImgOn_LPPD`          | ImgOn_LPPD          | Texto |     | multilínea |
| `ImgOff_LPPD`         | ImgOff_LPPD         | Texto |     | multilínea |

### 99.MotivosCancelacion

**Nombre interno (Graph):** `99MotivosCancelacion` · **Template:** genericList · **Columnas de negocio:** 3

| Interno (Graph) | Display   | Tipo  | Req | Notas |
| --------------- | --------- | ----- | :-: | ----- |
| `Title`         | Título    | Texto |     |       |
| `Motivo_MC`     | Motivo_MC | Texto |     |       |
| `Status_MC`     | Status_MC | Texto |     |       |

### ABM.Checklist

**Nombre interno (Graph):** `ABMChecklist` · **Template:** genericList · **Columnas de negocio:** 5

| Interno (Graph) | Display     | Tipo  | Req | Notas |
| --------------- | ----------- | ----- | :-: | ----- |
| `Title`         | Título      | Texto |     |       |
| `Check`         | Check       | Texto |     |       |
| `Si`            | Si          | Texto |     |       |
| `No`            | No          | Texto |     |       |
| `Observacion`   | Observacion | Texto |     |       |

### ABM.Edificios

**Nombre interno (Graph):** `ABMEdificios` · **Template:** genericList · **Columnas de negocio:** 21

| Interno (Graph)             | Display                   | Tipo   | Req | Notas |
| --------------------------- | ------------------------- | ------ | :-: | ----- |
| `Title`                     | Título                    | Texto  |     |       |
| `Micasa`                    | Edificio                  | Texto  |     |       |
| `Latitud`                   | Latitud                   | Número |     |       |
| `Longitud`                  | Longitud                  | Número |     |       |
| `Direccion`                 | Direccion                 | Texto  |     |       |
| `C_x00f3_digo`              | Codigo                    | Texto  |     |       |
| `Concat_Edificio_Direccion` | Concat_Edificio_Direccion | Texto  |     |       |
| `Status`                    | Status                    | Texto  |     |       |
| `Correo`                    | Correo                    | Texto  |     |       |
| `Latitud_ED`                | Latitud_ED                | Texto  |     |       |
| `Longitud_ED`               | Longitud_ED               | Texto  |     |       |
| `Celular`                   | Celular                   | Número |     |       |
| `Encargado`                 | Encargado                 | Texto  |     |       |
| `HoraVisita`                | HoraVisita                | Texto  |     |       |
| `Observaciones`             | Observaciones             | Texto  |     |       |
| `NroCircuito_ED`            | NroCircuito_ED            | Texto  |     |       |
| `Latitud2_ED`               | Latitud2_ED               | Texto  |     |       |
| `Longitud2_ED`              | Longitud2_ED              | Texto  |     |       |
| `Frecuencia_ED`             | Frecuencia_ED             | Número |     |       |
| `GrupoVentilacion_ED`       | GrupoVentilacion_ED       | Texto  |     |       |
| `Ventilaciones_ED`          | Ventilaciones_ED          | Texto  |     |       |

### ABM.Roles

**Nombre interno (Graph):** `ABMRoles` · **Template:** genericList · **Columnas de negocio:** 3

| Interno (Graph) | Display | Tipo  | Req | Notas |
| --------------- | ------- | ----- | :-: | ----- |
| `Title`         | Título  | Texto |     |       |
| `Rol`           | Rol     | Texto |     |       |
| `Estado`        | Status  | Texto |     |       |

### Usuarios

**Nombre interno (Graph):** `Usuarios` · **Template:** genericList · **Columnas de negocio:** 12

| Interno (Graph)          | Display                | Tipo  | Req | Notas |
| ------------------------ | ---------------------- | ----- | :-: | ----- |
| `Title`                  | Legajo                 | Texto |     |       |
| `field_1`                | Usuario                | Texto |     |       |
| `field_4`                | Password               | Texto |     |       |
| `Status`                 | Status                 | Texto |     |       |
| `Nombre`                 | Nombre                 | Texto |     |       |
| `Apellido`               | Apellido               | Texto |     |       |
| `Concat_Nombre_Apellido` | Concat_Nombre_Apellido | Texto |     |       |
| `Telefono`               | Telefono               | Texto |     |       |
| `Cumplea_x00f1_os`       | Cumpleaños             | Texto |     |       |
| `Correo`                 | Correo                 | Texto |     |       |
| `Rol`                    | Rol                    | Texto |     |       |
| `FechaNac_USR`           | FechaNac_USR           | Texto |     |       |

## Listas adicionales (vistas en el `.msapp`, no introspectadas acá)

El export de PowerApps (`docs/powerapps/References/DataSources.json`) referencia dos
listas que no figuran en la introspección de arriba. No están en el camino crítico de
la reconstrucción (son de festividades/feriados para popups del `App.OnStart`), así que
se documentan por nombre; sus columnas se pueden derivar de `DataSources.json` si hicieran falta.

- **`99.ABM_FechasFestivas`** — fechas festivas. Usada en `App.OnStart`:
  `Filter('99.ABM_FechasFestivas', (AppPopUp_FF = "TODAS" Or AppPopUp_FF = "Washinn") And Status_FF = "Inactivo")`.
- **`01.BackLog_Festividades`** — backlog de festividades.

Además, las data sources NO-SharePoint del `.msapp` (efectos a replicar en el backend, ver plan):
`Office365Outlook` (mails) y los flujos Power Automate `WashInn-FotoVentilacion`,
`WashinnVisita`, `WashinnIncidente`, `Washinniniciodescanso`, `Washinn`, `WashinnIncidente`.
