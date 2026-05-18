// Tipos TS que reflejan el esquema de las 30 listas SharePoint de la app PowerApps original.
// Los nombres de campo se mantienen lo más cerca posible del original (`*_IN`, `*_VE`, etc.)
// para que la migración a backend real sea directa.

export type Rol = "Admin" | "Supervisor" | "Tecnico";
export type EstadoStatus = "ALTA" | "BAJA" | "Activo" | "Inactivo";
export type EstadoRegistro = "Pendiente" | "En Proceso" | "Finalizado" | "Anulado";
export type EstadoIncidente = "Pendiente" | "En proceso" | "Resuelto" | "Anulado";
export type EstadoVentilacion = "Asignada" | "Programada" | "Realizada" | "Pendiente";
export type SiNo = "SI" | "NO";

export interface Usuario {
  ID: number;
  Usuario: string;
  Password: string;
  Nombre: string;
  Apellido: string;
  Concat_Nombre_Apellido: string;
  Correo: string;
  Telefono: string;
  Rol: Rol;
  FechaNac_USR: string; // dd/mm/yyyy
  Status: EstadoStatus;
}

export interface Edificio {
  ID: number;
  Codigo: string;
  Edificio: string;
  Direccion: string;
  Correo: string;
  Encargado?: string;
  Celular?: string;
  Latitud: number;
  Longitud: number;
  Latitud_ED: number;
  Longitud_ED: number;
  Status: EstadoStatus;
}

export interface Registro {
  ID: number;
  IDUnico: string;
  Codigo: string;
  Edificio: string;
  Direccion: string;
  Nombre: string; // técnico
  Estado: EstadoRegistro;
  HoraInicio: string;
  HoraFinal: string;
  HoraVisita: string;
  Fecha: string; // dd/mm/yyyy
  MesAño: string;
}

export interface ChecklistItemDef {
  ID: number;
  Descripcion: string;
  Orden: number;
}

export interface ChecklistResponse {
  ID: number;
  Si: "Ok" | "";
  No: "Ok" | "";
  Observacion?: string;
  Foto?: string;
}

export interface Incidente {
  ID: number;
  IDIncidente: number;
  IDMaquina_IN: string;
  ConcatMaquina_IN: string;
  CodigoEdifcio_IN: string;
  NombreEdificio_IN: string;
  TecnicoAsignado_IN: string;
  Descripcion_IN: string;
  Fecha_IN: string;
  Status_IN: EstadoIncidente;
  Resuelto_IN: SiNo;
  RequiereRepuesto_IN?: SiNo;
  Foto?: string;
  DescripcionAnulado_IN?: string;
}

export interface FotoIncidente {
  ID: number;
  IDIncidente_FI: number;
  Imagen_FI: string;
}

export interface RepuestoIncidente {
  ID: number;
  IDIncidente_RI: number;
  Repuesto_RI: string;
  Cantidad_RI: number;
  Estado_RI: "Pendiente" | "Aprobado" | "Entregado";
}

export interface RepuestoTecnico {
  ID: number;
  Tecnico: string;
  Repuesto: string;
  CantidadDisponible: number;
}

export interface Stock {
  ID: number;
  Repuesto: string;
  CantidadGlobal: number;
  Status: "Activo" | "Inactivo";
}

export interface Aprobacion {
  ID: number;
  IDIncidente: number;
  Aprobador: string;
  Fecha: string;
  Observacion?: string;
}

// Modo de operación de la máquina: "App", "Fichas" o ambos.
export type ModoEncendido = "App" | "Fichas" | "App / Fichas";
export type EstadoRepuestoHist = "Sin Repuesto" | "Pendiente de Revision" | "Ver Repuestos";
export type EstadoHistorial = "A Revisar" | "Cerrado";

export interface DetalleMaquina {
  ID: number;
  IDMaquina_DM: string;
  ConcatMaquina_DM: string;
  Marca_DM: string;
  Modelo_DM: string;
  NroSerie_DM: string;
  IDExterno_DM: number;
  Encendido_DM: ModoEncendido;
  Edificio_DM: string;
  CodigoEdificio_DM: string;
}

export interface HistorialMaquina {
  ID: number;
  IDMaquina: string;
  Evento: string;
  Fecha: string;
  Tecnico: string;
  Edificio: string;
  Repuestos: EstadoRepuestoHist;
  Status: EstadoHistorial;
  Observacion?: string;
}

export interface RepuestoHistorial {
  ID: number;
  IDHistorial_RH: number;
  Repuesto_RH: string;
  Cantidad_RH: number;
}

export interface Ventilacion {
  ID: number;
  IDAsignado_VE: number;
  Edificio_VE: string;
  Grupo_VE: string;
  Frecuencia_VE: string;
  Estado_VE: EstadoVentilacion;
  Orden_VE?: string;
  FechaProgramada_VE?: string;
  FechaFinalizacion_VE?: string;
  ObservacionResuelto_VE?: string;
  EsIncidente_VE?: SiNo;
  Foto?: string;
}

export interface PermisoMobile {
  ID: number;
  Modulo_LPM: string;
  Orden_LPM: number;
  Roles_LPM: Rol[];
  Status_LPM: "Activo" | "Inactivo";
  ruta: string;
}

export interface RolCatalogo {
  ID: number;
  Rol: string;
  Status: EstadoStatus;
}

export interface TipoABM {
  ID: number;
  Tipo: string;
  Status_ABM: "Activo" | "Inactivo";
}

export interface MotivoCancelacion {
  ID: number;
  Motivo: string;
  Status_MC: "Activo" | "Inactivo";
}

export interface Frecuencia {
  ID: number;
  Frecuencia: string;
  Dias: number;
  Status: EstadoStatus;
}

export interface GrupoVent {
  ID: number;
  Grupo: string;
  Status: EstadoStatus;
}

export interface MaquinaCompra {
  ID: number;
  Marca: string;
  Modelo: string;
  Status_MC: "Activo" | "Inactivo";
}

export interface FechaFestiva {
  ID: number;
  Fecha_FF: string;
  Festividad_FF: string;
  AppPopUp_FF: string;
  Status_FF: "Activo" | "Inactivo";
}

export interface BackLogFestividad {
  ID: number;
  User_BF: string;
  Fecha_FF: string;
  Festividad_FF: string;
  App_BF: string;
}

export interface HoraDescanso {
  ID: number;
  User_HD: string;
  Fecha_HD: string;
  HoraInicio_HD: string;
  HoraFin_HD?: string;
  Status_HD: "Activo" | "Finalizado";
}

export interface EmailTemplate {
  ID: number;
  Modulo_EM: string;
  Asunto_EM: string;
  Cuerpo_EM: string;
  MailDestino_EM: string;
  MailSumar_EM: string;
}

export interface ScanneoCodigo {
  ID: number;
  CodigoEdificio_SC: string;
  Fecha_SC: string;
  Usuario_SC: string;
  Estado_SC: "Pendiente" | "Confirmado";
}

export interface DetalleRegistro {
  ID: number;
  IDUnico: string;
  Item: string;
  Observaciones: string;
  Tecnico: string;
  Fecha: string;
  Edificio: string;
  Estado: "Activo" | "Resuelto";
}

export interface ResumenPlanificacion {
  ID: number;
  NroCircuito_RP: number;
  Mes_RP: string;
  Año_RP: number;
  Tecnico_RP: string;
  Estado_RP: "Pendiente" | "En Proceso" | "Finalizado";
}

export interface DetallePlanificacion {
  ID: number;
  NroCircuito_DP: number;
  Mes_DP: string;
  Año_DP: number;
  Tecnico_DP: string;
  Edificio_DP: string;
  Codigo_DP: string;
  Direccion_DP: string;
  Estado_DP: "Pendiente" | "En Proceso" | "Finalizado";
}

export interface MesPlanificacion {
  ID: number;
  Mes: string;
  Año: number;
  Activo: boolean;
}

export interface EdificioVisitar {
  ID: number;
  NroCircuito_EV: number;
  Edificio_EV: string;
  Codigo_EV: string;
  Direccion_EV: string;
  Mes_EV: string;
  Año_EV: number;
  Estado_EV: "Pendiente" | "Visitada" | "Cancelada";
}
