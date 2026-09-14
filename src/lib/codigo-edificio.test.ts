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

console.log("ok — mismoCodigo(): tolera espacios y mayúsculas, vacío no matchea, ninguna pantalla compara códigos con ===/!== crudo, y el cruce de visitas del backend usa clave normalizada.");
