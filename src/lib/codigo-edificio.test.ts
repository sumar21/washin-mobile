// npx tsx src/lib/codigo-edificio.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mismoCodigo, normCodigo } from "./codigo-edificio";

// Caso real: Camargo 915. El ABM tenía " C-2593" (espacio adelante), las máquinas lo heredaron, y
// el incidente creado desde el escritorio guardó "C-2593". Con === no aparecía ninguna máquina.
assert.equal(mismoCodigo(" C-2593", "C-2593"), true);
assert.equal(mismoCodigo("C-2593 ", " C-2593"), true);
assert.equal(mismoCodigo("c-2593", "C-2593"), true);
assert.equal(normCodigo("  c-2744 "), "C-2744");

// Distintos siguen siendo distintos.
assert.equal(mismoCodigo("C-2593", "C-2594"), false);
// Un código vacío no matchea con nada: si no, un incidente sin edificio "encontraría" todas las
// máquinas sin edificio cargado.
assert.equal(mismoCodigo("", ""), false);
assert.equal(mismoCodigo(undefined, ""), false);
assert.equal(mismoCodigo(null, "   "), false);

// CANARIO: ninguna pantalla vuelve a comparar códigos de edificio con === crudo. Es exactamente
// la regresión que dejaba a Camargo 915 sin máquinas, y se reintroduce sin que nadie lo note.
for (const archivo of ["ScreenIncidenteForm.tsx", "ScreenIncidentes.tsx", "ScreenEdificios.tsx"]) {
  const src = readFileSync(new URL(`../screens/${archivo}`, import.meta.url), "utf8");
  // === y !== en cualquiera de los dos lados. `.Codigo` y `.codigo` (el de la visita en curso).
  const crudo = src.match(
    /(CodigoEdificio_DM|CodigoEdifcio_IN|\.[Cc]odigo)\s*!?==|!?==\s*[\w.?]*(CodigoEdificio_DM|CodigoEdifcio_IN|\.[Cc]odigo)\b/,
  );
  assert.equal(
    crudo,
    null,
    `${archivo} compara un código de edificio con ===/!== ("${crudo?.[0]}"): usá mismoCodigo()`,
  );
}

// CANARIO backend: el cruce 01.Registros ↔ 18.EdificiosVisitar no vuelve a usar la clave cruda.
// Con clave cruda, un espacio en UNA sola de las dos listas deja las visitas sin su registro, sin
// ningún error (pasó al limpiar Camargo 915 y Vidal 2962).
{
  const plan = readFileSync(new URL("../../api/_lib/planificaciones.ts", import.meta.url), "utf8");
  const cruda = plan.match(/(ultimaEdificioByCodigo|lastByCodigo|finalizadasByCodigo)\.(get|set|has)\((codigo|f\.|r\.fields)/);
  assert.equal(
    cruda,
    null,
    `planificaciones.ts cruza por código con la clave cruda ("${cruda?.[0]}"): usá claveCodigo()`,
  );
}

// CANARIO backend: cancelar la visita y buscar el contacto del edificio (mails de cancelación y de
// mantenimiento) comparan con claveCodigo, no crudo. La QA mostró que el canario de arriba no los
// cubría: volver a `it.fields.Codigo === input.codigo` pasaba sin que ningún test fallara.
{
  const archivos = {
    "planificaciones.ts": readFileSync(new URL("../../api/_lib/planificaciones.ts", import.meta.url), "utf8"),
    "catalogos.ts": readFileSync(new URL("../../api/_lib/catalogos.ts", import.meta.url), "utf8"),
  };
  // Un campo de código (con o sin .trim()/.toUpperCase() encadenados) a un lado de ===/!==.
  const campo = String.raw`(?:[\w.]*fields\.(?:Codigo|C_x00f3_digo)|input\.codigo|\bcodigo)(?:\??\.\w+\(\))*`;
  const comparacionCruda = new RegExp(String.raw`${campo}\s*!?==|!?==\s*${campo}`);
  for (const [nombre, src] of Object.entries(archivos)) {
    const cruda = src.match(comparacionCruda);
    assert.equal(cruda, null, `${nombre} compara un código de edificio crudo ("${cruda?.[0]}"): usá claveCodigo()`);
  }
  assert.match(
    archivos["planificaciones.ts"],
    /claveCodigo\(it\.fields\.Codigo\) === buscado/,
    "cancelarVisita tiene que elegir el registro comparando con claveCodigo()",
  );
  assert.match(
    archivos["catalogos.ts"],
    /claveCodigo\(it\.fields\.C_x00f3_digo\) === clave/,
    "getEdificioContacto perdió el barrido normalizado del ABM: con un código con espacios el mail va a la casilla de respaldo y no al consorcio",
  );
}

console.log("ok — mismoCodigo(): tolera espacios y mayúsculas, vacío no matchea, ninguna pantalla compara códigos con ===/!== crudo, y el backend (cruce de visitas, cancelar visita, contacto del edificio) usa clave normalizada.");
