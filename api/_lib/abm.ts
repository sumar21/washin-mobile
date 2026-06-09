// ABM (administración): alta/baja y creación de Edificios (ABM.Edificios) y Usuarios (Usuarios),
// y catálogo de mails (99.ABM_Emails). Reemplaza al mock del front. Solo Admin.
import {
  resolveListId,
  getListItems,
  createItem,
  patchItemFields,
  type ListItem,
} from "./sharepoint.js";

const L_EDIFICIOS = "ABM.Edificios";
const L_USUARIOS = "Usuarios";
const L_EMAILS = "99.ABM_Emails";

// ── Edificios ──────────────────────────────────────────────────────────────
interface EdificioFields {
  Micasa?: string;
  C_x00f3_digo?: string;
  Direccion?: string;
  Correo?: string;
  Encargado?: string;
  Celular?: number | string;
  Latitud?: number;
  Longitud?: number;
  Status?: string;
}

export interface EdificioABM {
  ID: number;
  Codigo: string;
  Edificio: string;
  Direccion: string;
  Correo: string;
  Encargado: string;
  Celular: string;
  Status: string;
}

const EDIF_FIELDS = [
  "Micasa",
  "C_x00f3_digo",
  "Direccion",
  "Correo",
  "Encargado",
  "Celular",
  "Latitud",
  "Longitud",
  "Status",
];

function mapEdificio(it: ListItem<EdificioFields>): EdificioABM {
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
}

// Todos los edificios (cualquier status) — el ABM muestra ALTA y BAJA.
export async function listEdificiosTodos(): Promise<EdificioABM[]> {
  const listId = await resolveListId(L_EDIFICIOS);
  const items = await getListItems<EdificioFields>(listId, EDIF_FIELDS);
  return items.map(mapEdificio).sort((a, b) => a.Edificio.localeCompare(b.Edificio));
}

export async function setEdificioStatus(
  id: number,
  status: string,
): Promise<void> {
  const listId = await resolveListId(L_EDIFICIOS);
  await patchItemFields(listId, String(id), { Status: status });
}

export interface CrearEdificioInput {
  codigo: string;
  edificio: string;
  direccion: string;
  correo?: string;
  encargado?: string;
  celular?: string;
  latitud?: number;
  longitud?: number;
}

export async function crearEdificio(
  input: CrearEdificioInput,
): Promise<{ id: string }> {
  const listId = await resolveListId(L_EDIFICIOS);
  const fields: Record<string, unknown> = {
    Title: input.edificio,
    Micasa: input.edificio,
    C_x00f3_digo: input.codigo,
    Direccion: input.direccion,
    Correo: input.correo ?? "",
    Encargado: input.encargado ?? "",
    Celular: input.celular ?? "",
    Status: "ALTA",
  };
  if (input.latitud != null) fields.Latitud = input.latitud;
  if (input.longitud != null) fields.Longitud = input.longitud;
  return createItem(listId, fields);
}

// ── Usuarios ───────────────────────────────────────────────────────────────
interface UsuarioFields {
  field_1?: string; // Usuario
  Status?: string;
  Nombre?: string;
  Apellido?: string;
  Concat_Nombre_Apellido?: string;
  Telefono?: string;
  Correo?: string;
  Rol?: string;
  FechaNac_USR?: string;
  Title?: string; // Legajo
}

export interface UsuarioABM {
  ID: number;
  Usuario: string;
  Nombre: string;
  Apellido: string;
  Concat_Nombre_Apellido: string;
  Correo: string;
  Telefono: string;
  Rol: string;
  Legajo: string;
  Status: string;
}

const USR_FIELDS = [
  "field_1",
  "Status",
  "Nombre",
  "Apellido",
  "Concat_Nombre_Apellido",
  "Telefono",
  "Correo",
  "Rol",
  "FechaNac_USR",
  "Title",
];

function mapUsuario(it: ListItem<UsuarioFields>): UsuarioABM {
  const f = it.fields;
  return {
    ID: Number(it.id),
    Usuario: f.field_1 ?? "",
    Nombre: f.Nombre ?? "",
    Apellido: f.Apellido ?? "",
    Concat_Nombre_Apellido: f.Concat_Nombre_Apellido ?? "",
    Correo: f.Correo ?? "",
    Telefono: f.Telefono ?? "",
    Rol: f.Rol ?? "",
    Legajo: f.Title ?? "",
    Status: f.Status ?? "",
  };
}

export async function listUsuariosTodos(): Promise<UsuarioABM[]> {
  const listId = await resolveListId(L_USUARIOS);
  const items = await getListItems<UsuarioFields>(listId, USR_FIELDS);
  return items
    .map(mapUsuario)
    .sort((a, b) =>
      a.Concat_Nombre_Apellido.localeCompare(b.Concat_Nombre_Apellido),
    );
}

export async function setUsuarioStatus(
  id: number,
  status: string,
): Promise<void> {
  const listId = await resolveListId(L_USUARIOS);
  await patchItemFields(listId, String(id), { Status: status });
}

export interface CrearUsuarioInput {
  usuario: string;
  password: string;
  nombre: string;
  apellido: string;
  correo?: string;
  telefono?: string;
  fechaNac?: string;
  rol: string;
}

export async function crearUsuario(
  input: CrearUsuarioInput,
): Promise<{ id: string }> {
  const listId = await resolveListId(L_USUARIOS);
  return createItem(listId, {
    Title: input.usuario,
    field_1: input.usuario, // Usuario (login)
    field_4: input.password, // Password
    Nombre: input.nombre,
    Apellido: input.apellido,
    Concat_Nombre_Apellido: `${input.apellido}, ${input.nombre}`,
    Correo: input.correo ?? "",
    Telefono: input.telefono ?? "",
    FechaNac_USR: input.fechaNac ?? "",
    Rol: input.rol,
    Status: "ALTA",
  });
}

// ── Mails (99.ABM_Emails) — destinatarios/Bcc por módulo ─────────────────────
interface EmailFields {
  Modulo_EM?: string;
  MailSumar_EM?: string;
  MailWashinn_EM?: string;
}

export interface EmailModulo {
  ID: number;
  Modulo: string;
  MailSumar: string;
  MailWashinn: string;
}

export async function listEmails(): Promise<EmailModulo[]> {
  const listId = await resolveListId(L_EMAILS);
  const items = await getListItems<EmailFields>(listId, [
    "Modulo_EM",
    "MailSumar_EM",
    "MailWashinn_EM",
  ]);
  return items.map((it) => ({
    ID: Number(it.id),
    Modulo: it.fields.Modulo_EM ?? "",
    MailSumar: it.fields.MailSumar_EM ?? "",
    MailWashinn: it.fields.MailWashinn_EM ?? "",
  }));
}
