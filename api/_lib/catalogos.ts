// Catálogos compartidos por varias pantallas. Equivalen a las colecciones que el
// App.OnStart de PowerApps precarga:
//   CollectEdificios     = Filter('ABM.Edificios', Status = "ALTA")
//   CollectMarcaModelo   = Filter('99.ABM_MaquinasCompra', Status_MC = "Activo")
//   CollectMotivosCancelar = Filter('99.MotivosCancelacion', Status_MC = "Activo")
//   CollectUsuarios      = Filter(Usuarios, Status = "ALTA")   (ver _lib/users.ts)
import {
  resolveListId,
  getListItemsFiltered,
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
}

const EDIFICIO_FIELDS = [
  "Micasa",
  "C_x00f3_digo",
  "Direccion",
  "Correo",
  "Encargado",
  "Celular",
  "Status",
];

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
    };
  });
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
