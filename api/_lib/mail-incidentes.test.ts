// Test offline de las plantillas de mail de incidentes (funciones puras, sin Graph).
// Cubre el bug reportado por el cliente: el mail de cambio de máquina mostraba UNA sola
// máquina (la retirada) y no se podía saber cuál quedó instalada.
// Correr:  npx tsx api/_lib/mail-incidentes.test.ts
import assert from "node:assert";
import { htmlCambioMaquina, htmlIncidenteResuelto } from "./mail-incidentes.js";

const VIEJA = "Lavarropas LR-100 S/N 111";
const NUEVA = "Lavarropas LR-200 S/N 222";

const html = htmlCambioMaquina({
  id: 4321,
  edificio: "Edificio Belgrano",
  maquinaVieja: VIEJA,
  maquinaNueva: NUEVA,
  fecha: "21/07",
  hora: "14:35",
  tecnico: "Perez, Juan",
  observaciones: "Motor quemado, no reparable en sitio.",
});

// Las DOS máquinas aparecen, cada una con su rótulo.
assert.ok(html.includes(VIEJA), "falta la máquina retirada");
assert.ok(html.includes(NUEVA), "falta la máquina instalada");
assert.ok(html.includes("Máquina retirada"), "falta el rótulo 'Máquina retirada'");
assert.ok(html.includes("Máquina instalada"), "falta el rótulo 'Máquina instalada'");
// La retirada va antes que la instalada (el swap se lee en orden).
assert.ok(html.indexOf(VIEJA) < html.indexOf(NUEVA), "el orden del swap está invertido");
// El preheader lleva el swap, para verlo desde la bandeja sin abrir el mail.
assert.ok(html.includes(`${VIEJA} → ${NUEVA}`), "el preheader no muestra el swap");
// Contexto del incidente + observaciones del técnico.
assert.ok(html.includes("N° 4321") && html.includes("Edificio Belgrano"));
assert.ok(html.includes("Motor quemado"), "faltan las observaciones");

// Sin observaciones → no se renderiza la fila vacía.
const sinObs = htmlCambioMaquina({
  id: 1,
  edificio: "E",
  maquinaVieja: VIEJA,
  maquinaNueva: NUEVA,
  fecha: "21/07",
  hora: "10:00",
  tecnico: "T",
});
assert.ok(!sinObs.includes("Observaciones"), "renderiza Observaciones vacías");

// Campos faltantes (camino de reconstrucción desde SharePoint) → placeholders, no huecos.
const vacio = htmlCambioMaquina({
  id: 2,
  edificio: "",
  maquinaVieja: "",
  maquinaNueva: NUEVA,
  fecha: "21/07",
  hora: "10:00",
  tecnico: "",
});
assert.ok(vacio.includes("—"), "sin placeholder para los campos vacíos");
assert.ok(vacio.includes(NUEVA), "se perdió la máquina instalada");

// El mail de resolución sigue mostrando una sola máquina (no lo tocamos).
const resuelto = htmlIncidenteResuelto({
  id: 9,
  edificio: "E",
  maquina: VIEJA,
  fecha: "21/07",
  hora: "10:00",
  tecnico: "T",
  repuestos: [{ repuesto: "Correa", cantidad: 2 }],
});
assert.ok(resuelto.includes("Incidente resuelto") && resuelto.includes("Correa"));

console.log("ok — htmlCambioMaquina muestra retirada → instalada");
