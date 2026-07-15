// Test offline del acote del historial por edificio (bug: los códigos de edificio se reciclan —
// C-2276 era Torre Huergo y hoy es Dorrego 1865 — así que el incidente viejo guarda un código que
// ya no coincide con el código actual de su máquina, y quedaba fuera del historial).
// Correr:  npx tsx api/_lib/maquinas.test.ts
import assert from "node:assert";
import { mismoEdificio } from "./maquinas.js";

const TH = { cod: "C-2800", nom: "TORRE HUERGO" }; // código actual de Torre Huergo

// código actual de la máquina → entra
assert.equal(
  mismoEdificio({ CodigoEdifcio_IN: "C-2800", NombreEdificio_IN: "Torre Huergo" }, TH.cod, TH.nom),
  true,
);
// código RECICLADO (el viejo de Torre Huergo, hoy de Dorrego) + nombre correcto → entra por nombre
assert.equal(
  mismoEdificio({ CodigoEdifcio_IN: "C-2276", NombreEdificio_IN: "Torre Huergo" }, TH.cod, TH.nom),
  true,
);
// incidente real de Dorrego 1865 visto desde una máquina de Torre Huergo → NO entra
assert.equal(
  mismoEdificio({ CodigoEdifcio_IN: "C-2276", NombreEdificio_IN: "Dorrego 1865" }, TH.cod, TH.nom),
  false,
);
// sin código (dato viejo) → no lo ocultamos, aunque el nombre no acompañe
assert.equal(
  mismoEdificio({ CodigoEdifcio_IN: "", NombreEdificio_IN: "Otro" }, TH.cod, TH.nom),
  true,
);
// sin edificio pedido → no acotamos
assert.equal(mismoEdificio({ CodigoEdifcio_IN: "C-9999" }, undefined, undefined), true);
// drift de espacios/capitalización en el nombre → sigue entrando
assert.equal(
  mismoEdificio({ CodigoEdifcio_IN: "C-2276", NombreEdificio_IN: "  torre huergo " }, TH.cod, TH.nom),
  true,
);
// sin nombre pedido (deeplink viejo: sólo código) → se comporta como antes
assert.equal(
  mismoEdificio({ CodigoEdifcio_IN: "C-2276", NombreEdificio_IN: "Torre Huergo" }, TH.cod, undefined),
  false,
);

console.log("ok — mismoEdificio(): el nombre desempata cuando el código fue reciclado");
