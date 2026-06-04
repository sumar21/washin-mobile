// Autenticación contra la lista SharePoint "Usuarios".
// Recordatorio de columnas internas (ver docs/sharepoint-schema.md):
//   field_1 = Usuario (user log, ej. "Agufernandez")
//   field_4 = Password
//   Status  = ALTA / Activo (solo estos pueden ingresar)
import { getListItems, resolveListId, type ListItem } from "./sharepoint.js";

// Id conocido de la lista Usuarios (rápido). Si cambia, se resuelve por nombre.
const USUARIOS_LIST_ID = "abe151cc-f0cc-4ff2-a79e-fc0121c3dd41";
const USUARIOS_LIST_NAME = "Usuarios";

const FIELDS = [
  "field_1",
  "field_4",
  "Status",
  "Nombre",
  "Apellido",
  "Concat_Nombre_Apellido",
  "Telefono",
  "Correo",
  "Rol",
  "FechaNac_USR",
  "Title",
] as const;

interface UsuarioFields {
  field_1?: string;
  field_4?: string;
  Status?: string;
  Nombre?: string;
  Apellido?: string;
  Concat_Nombre_Apellido?: string;
  Telefono?: string;
  Correo?: string;
  Rol?: string;
  FechaNac_USR?: string;
  Title?: string;
}

// Usuario expuesto al front (sin password). Compatible con el tipo Usuario del front.
export interface AuthUser {
  ID: number;
  Usuario: string;
  Nombre: string;
  Apellido: string;
  Concat_Nombre_Apellido: string;
  Correo: string;
  Telefono: string;
  Rol: string;
  FechaNac_USR: string;
  Legajo: string;
  Status: string;
}

function isActive(status: string | undefined): boolean {
  const s = (status ?? "").trim().toUpperCase();
  return s === "ALTA" || s === "ACTIVO";
}

function mapUser(item: ListItem<UsuarioFields>): AuthUser {
  const f = item.fields;
  return {
    ID: Number(item.id),
    Usuario: f.field_1 ?? "",
    Nombre: f.Nombre ?? "",
    Apellido: f.Apellido ?? "",
    Concat_Nombre_Apellido: f.Concat_Nombre_Apellido ?? "",
    Correo: f.Correo ?? "",
    Telefono: f.Telefono ?? "",
    Rol: f.Rol ?? "",
    FechaNac_USR: f.FechaNac_USR ?? "",
    Legajo: f.Title ?? "",
    Status: f.Status ?? "",
  };
}

async function fetchUsuarios(): Promise<ListItem<UsuarioFields>[]> {
  try {
    return await getListItems<UsuarioFields>(USUARIOS_LIST_ID, [...FIELDS]);
  } catch {
    // Fallback: resolver el id por nombre (por si la lista fue recreada).
    const id = await resolveListId(USUARIOS_LIST_NAME);
    return getListItems<UsuarioFields>(id, [...FIELDS]);
  }
}

// Lista de usuarios activos (ALTA/Activo), sin password. Para catálogos del front
// (asignación de técnicos, etc.). Equivale a CollectUsuarios del App.OnStart de PowerApps.
export async function listActiveUsuarios(): Promise<AuthUser[]> {
  const items = await fetchUsuarios();
  return items.filter((i) => isActive(i.fields.Status)).map(mapUser);
}

// La lista de usuarios es chica (personal): se traen todos y se filtra en memoria,
// evitando problemas de columnas no indexadas en $filter de Graph.
export async function authenticateUser(
  usuario: string,
  password: string,
): Promise<AuthUser | null> {
  const target = usuario.trim().toLowerCase();
  if (!target || !password) return null;

  const items = await fetchUsuarios();
  const match = items.find(
    (i) =>
      (i.fields.field_1 ?? "").trim().toLowerCase() === target &&
      isActive(i.fields.Status),
  );
  if (!match) return null;
  if ((match.fields.field_4 ?? "") !== password) return null;
  return mapUser(match);
}
