// Comparación de CÓDIGOS DE EDIFICIO ("C-2593").
//
// Nunca comparar códigos con `===` crudo. En SharePoint hay edificios cuyo código quedó cargado
// con espacios alrededor (" C-2593"), invisibles a simple vista, y las máquinas lo heredan tal
// cual. Pero otras escrituras SÍ lo recortan —el alta de incidentes del escritorio guarda
// "C-2593"—, así que el mismo edificio aparece con dos códigos distintos según quién lo escribió.
//
// Caso real (Camargo 915, C-2593): un reclamo asignado desde el escritorio no mostraba NINGUNA
// máquina en la mobile, porque " C-2593" !== "C-2593". Al reportar sí aparecían (edificio y
// máquinas venían del catálogo, los dos con el espacio), así que el bug sólo se veía en reclamos
// asignados y costaba reproducirlo.
//
// El escaneo de QR ya comparaba con trim + mayúsculas (ScreenEdificios, ScreenPlanificaciones):
// esto generaliza ese mismo criterio.

/** Normaliza un código de edificio para comparar: sin espacios alrededor y en mayúsculas. */
export function normCodigo(codigo: string | null | undefined): string {
  return String(codigo ?? "").trim().toUpperCase();
}

/** Mismo edificio, tolerando espacios y mayúsculas. Un código vacío no matchea con nada. */
export function mismoCodigo(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normCodigo(a);
  return na !== "" && na === normCodigo(b);
}
