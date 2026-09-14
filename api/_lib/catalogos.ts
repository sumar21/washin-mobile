// Catálogos compartidos por varias pantallas. Equivalen a las colecciones que el
// App.OnStart de PowerApps precarga:
//   CollectEdificios     = Filter('ABM.Edificios', Status = "ALTA")
//   CollectMarcaModelo   = Filter('99.ABM_MaquinasCompra', Status_MC = "Activo")
//   CollectMotivosCancelar = Filter('99.MotivosCancelacion', Status_MC = "Activo")
//   CollectUsuarios      = Filter(Usuarios, Status = "ALTA")   (ver _lib/users.ts)
import {
  resolveListId,
  getListItems,
  getListItemsFiltered,
  escapeODataValue,
  type ListItem,
} from "./sharepoint.js";

const L_EDIFICIOS = "ABM.Edificios";
const L_MAQUINAS_COMPRA = "99.ABM_MaquinasCompra";
const L_MOTIVOS = "99.MotivosCancelacion";

// --- Edificios (ABM.Edificios). Nombres internos: Micasa=Edificio, C_x00f3_digo=Codigo. ---
interface EdificioFields {
  Micasa?: string;
  C_x00f3_digo?: string;
  Direccion?: string;
  Correo?: string;
  Encargado?: string;
  Celular?: number | string;
  Status?: string;
  Latitud?: number;
  Longitud?: number;
  // Segundo par de coordenadas (ABM.Edificios.Latitud2_ED/Longitud2_ED, texto): PA evalúa los 2
  // pares en la verificación geo de la visita espontánea (img_registroVisita).
  Latitud2_ED?: string;
  Longitud2_ED?: string;
  // Hora sugerida y observación del edificio (las usa la visita espontánea: PA lee
  // First(CollectTempEdificios).HoraVisita / .Observaciones para el Patch a 01.Registros).
  HoraVisita?: string;
  Observaciones?: string;
}

export interface Edificio {
  ID: number;
  Codigo: string;
  Edificio: string;
  Direccion: string;
  Correo: string;
  Encargado: string;
  Celular: string;
  Status: string;
  Latitud: number; // 0 si no está cargada
  Longitud: number;
  Latitud2: number; // segundo par (0 si no está cargado)
  Longitud2: number;
  HoraVisita: string; // hora sugerida del edificio (para la visita espontánea)
  Observaciones: string; // observación del edificio (para la visita espontánea)
}

const EDIFICIO_FIELDS = [
  "Micasa",
  "C_x00f3_digo",
  "Direccion",
  "Correo",
  "Encargado",
  "Celular",
  "Status",
  "Latitud",
  "Longitud",
  "Latitud2_ED",
  "Longitud2_ED",
  "HoraVisita",
  "Observaciones",
];

// Coord en texto ("-34,60" o "-34.60") → número (0 si vacío/inválido).
function numCoord(v?: number | string): number {
  if (v == null) return 0;
  const n = Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function listEdificios(): Promise<Edificio[]> {
  const listId = await resolveListId(L_EDIFICIOS);
  const items = await getListItemsFiltered<EdificioFields>(
    listId,
    EDIFICIO_FIELDS,
    `fields/Status eq 'ALTA'`,
  );
  return items.map((it: ListItem<EdificioFields>) => {
    const f = it.fields;
    return {
      ID: Number(it.id),
      Codigo: f.C_x00f3_digo ?? "",
      Edificio: f.Micasa ?? "",
      Direccion: f.Direccion ?? "",
      Correo: f.Correo ?? "",
      Encargado: f.Encargado ?? "",
      Celular: f.Celular != null ? String(f.Celular) : "",
      Status: f.Status ?? "",
      Latitud: Number(f.Latitud ?? 0) || 0,
      Longitud: Number(f.Longitud ?? 0) || 0,
      Latitud2: numCoord(f.Latitud2_ED),
      Longitud2: numCoord(f.Longitud2_ED),
      HoraVisita: f.HoraVisita ?? "",
      Observaciones: f.Observaciones ?? "",
    };
  });
}

/**
 * Clave de cruce por código de edificio entre listas (01.Registros ↔ 18.EdificiosVisitar ↔
 * ABM.Edificios).
 *
 * Nunca cruzar con el código crudo: basta un espacio de más en UNA de las dos listas para que la
 * visita no encuentre su registro, y la mobile deja de ver la visita en curso y la cuenta de
 * finalizadas — sin ningún error. Pasó de verdad: Camargo 915 (" C-2593") y Vidal 2962
 * (" C-2744") tenían el espacio en las dos listas y cruzaban; al limpiar 18.EdificiosVisitar pero
 * no 01.Registros el cruce se rompió. Mismo criterio que mismoCodigo() del front.
 */
export const claveCodigo = (codigo: string | null | undefined) =>
  String(codigo ?? "").trim().toUpperCase();

// Datos de contacto del edificio por código (para los mails de Visitas). PA usa
// LookUp('ABM.Edificios', VarCodigo=Codigo, {Correo, Edificio}). Devuelve null si no existe.
//
// El LookUp de PA compara exacto, y acá también se hacía así (`eq` con el código tal cual): con un
// espacio de más en la visita o en el ABM no encontraba el edificio y los mails de cancelación y de
// mantenimiento salían a la casilla de respaldo en vez de al consorcio (hallazgo de QA). Primero se
// busca exacto con el código recortado —el caso normal, una fila—, y sólo si no aparece se trae el
// ABM y se compara con claveCodigo. Sin filtro de Status, como el LookUp de PA.
export async function getEdificioContacto(
  codigo: string,
): Promise<{ edificio: string; correo: string; direccion: string } | null> {
  const clave = claveCodigo(codigo);
  if (!clave) return null;
  const listId = await resolveListId(L_EDIFICIOS);
  const campos = ["Micasa", "Correo", "Direccion", "C_x00f3_digo"];
  let items = await getListItemsFiltered<EdificioFields>(
    listId,
    campos,
    `fields/C_x00f3_digo eq '${escapeODataValue(codigo.trim())}'`,
  );
  if (!items.length) {
    items = (await getListItems<EdificioFields>(listId, campos)).filter(
      (it) => claveCodigo(it.fields.C_x00f3_digo) === clave,
    );
  }
  if (!items.length) return null;
  const f = items[0].fields;
  return {
    edificio: f.Micasa ?? "",
    correo: (f.Correo ?? "").trim(),
    direccion: f.Direccion ?? "",
  };
}

// --- Marcas/Modelos (99.ABM_MaquinasCompra). ---
interface MaquinaCompraFields {
  Marca_MC?: string;
  Modelo_MC?: string;
  Segmento_MC?: string;
  Concat_MC?: string;
  Status_MC?: string;
}

export interface MaquinaModelo {
  ID: number;
  Marca: string;
  Modelo: string;
  Segmento: string;
  Concat: string;
  Status_MC: string;
}

const MAQUINA_FIELDS = [
  "Marca_MC",
  "Modelo_MC",
  "Segmento_MC",
  "Concat_MC",
  "Status_MC",
];

export async function listMarcasModelos(): Promise<MaquinaModelo[]> {
  const listId = await resolveListId(L_MAQUINAS_COMPRA);
  const items = await getListItemsFiltered<MaquinaCompraFields>(
    listId,
    MAQUINA_FIELDS,
    `fields/Status_MC eq 'Activo'`,
  );
  return items.map((it: ListItem<MaquinaCompraFields>) => {
    const f = it.fields;
    return {
      ID: Number(it.id),
      Marca: f.Marca_MC ?? "",
      Modelo: f.Modelo_MC ?? "",
      Segmento: f.Segmento_MC ?? "",
      Concat: f.Concat_MC ?? "",
      Status_MC: f.Status_MC ?? "",
    };
  });
}

// --- Motivos de cancelación (99.MotivosCancelacion). ---
interface MotivoFields {
  Motivo_MC?: string;
  Status_MC?: string;
}

export interface MotivoCancelacion {
  ID: number;
  Motivo: string;
  Status_MC: string;
}

export async function listMotivosCancelacion(): Promise<MotivoCancelacion[]> {
  const listId = await resolveListId(L_MOTIVOS);
  const items = await getListItemsFiltered<MotivoFields>(
    listId,
    ["Motivo_MC", "Status_MC"],
    `fields/Status_MC eq 'Activo'`,
  );
  return items.map((it: ListItem<MotivoFields>) => ({
    ID: Number(it.id),
    Motivo: it.fields.Motivo_MC ?? "",
    Status_MC: it.fields.Status_MC ?? "",
  }));
}
