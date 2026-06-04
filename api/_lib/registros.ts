// Acciones sobre la lista 01.Registros (escritura).
import { resolveListId, patchItemFields } from "./sharepoint.js";

const L_REGISTROS = "01.Registros";

// Anula un registro: Estado -> "Anulado". Equivale al Patch de PowerApps
//   Patch('01.Registros'; LookUp(...; ID = ThisItem.ID); {Estado: "Anulado"})
export async function anularRegistro(id: number): Promise<void> {
  const listId = await resolveListId(L_REGISTROS);
  await patchItemFields(listId, String(id), { Estado: "Anulado" });
}
