// Test offline del split de destinatarios (bug: 99.ABM_Emails guarda varias
// direcciones separadas por ";", y Graph rechaza el mensaje si no se parten).
// Correr:  npx tsx api/_lib/mail.test.ts
import assert from "node:assert";
import { recipients, repartirDestinatarios } from "./mail.js";

const addrs = (r: ReturnType<typeof recipients>) => r.map((x) => x.emailAddress.address);

// string con ";" y "," → una entrada por dirección
assert.deepStrictEqual(addrs(recipients("a@x.com;b@x.com, c@x.com")), [
  "a@x.com",
  "b@x.com",
  "c@x.com",
]);
// array donde cada elemento es a su vez un blob con ";" (caso incidente resuelto)
assert.deepStrictEqual(addrs(recipients(["a@x.com;b@x.com", "c@x.com"])), [
  "a@x.com",
  "b@x.com",
  "c@x.com",
]);
// vacíos / undefined → sin destinatarios
assert.deepStrictEqual(recipients(undefined), []);
assert.deepStrictEqual(recipients(";  ,"), []);

// ── repartirDestinatarios(): nuestras casillas SIEMPRE en BCC ─────────────────────────
// Regla fija del proyecto. Se aplica en el transporte para que valga también para los mails
// que se agreguen después, sin que nadie tenga que acordarse.

// El caso real del incidente resuelto: Sumar estaba en el To Y en el BCC (visible para Wash Inn).
assert.deepStrictEqual(
  repartirDestinatarios(
    ["notificaciones@sumardigital.com.ar", "info@wash-innsystem.com.ar"],
    "notificaciones@sumardigital.com.ar",
  ),
  { to: ["info@wash-innsystem.com.ar"], bcc: ["notificaciones@sumardigital.com.ar"] },
);
// No se duplica aunque ya viniera en el BCC.
assert.deepStrictEqual(
  repartirDestinatarios("a@sumardigital.com.ar;b@x.com", "a@sumardigital.com.ar"),
  { to: ["b@x.com"], bcc: ["a@sumardigital.com.ar"] },
);
// Varias internas juntas.
assert.deepStrictEqual(
  repartirDestinatarios("a@sumardigital.com.ar;b@sumardigital.com.ar;c@x.com"),
  { to: ["c@x.com"], bcc: ["a@sumardigital.com.ar", "b@sumardigital.com.ar"] },
);
// Case-insensitive: el dominio puede venir en cualquier capitalización desde SharePoint.
assert.deepStrictEqual(
  repartirDestinatarios("A@SumarDigital.com.ar;c@x.com"),
  { to: ["c@x.com"], bcc: ["A@SumarDigital.com.ar"] },
);
// SIN externos no se mueve nada: un mail sin To no se puede enviar, y no hay a quién ocultarle
// la dirección. Este assert es el que evita romper el envío cuando el único destinatario es Sumar.
assert.deepStrictEqual(
  repartirDestinatarios("a@sumardigital.com.ar;b@sumardigital.com.ar"),
  { to: ["a@sumardigital.com.ar", "b@sumardigital.com.ar"], bcc: [] },
);
// Sin internas, el reparto no toca nada.
assert.deepStrictEqual(
  repartirDestinatarios("a@x.com;b@y.com", "c@z.com"),
  { to: ["a@x.com", "b@y.com"], bcc: ["c@z.com"] },
);
// Un dominio que sólo TERMINA parecido no es interno (no-sumardigital.com.ar sí lo es por el @).
assert.deepStrictEqual(
  repartirDestinatarios("a@notsumardigital.com.ar;b@x.com"),
  { to: ["a@notsumardigital.com.ar", "b@x.com"], bcc: [] },
);
// Alguien que ya está visible en el To no se repite en el BCC.
assert.deepStrictEqual(
  repartirDestinatarios("b@x.com", "b@x.com;a@sumardigital.com.ar"),
  { to: ["b@x.com"], bcc: ["a@sumardigital.com.ar"] },
);

console.log(
  "ok — recipients() parte por ';' y ','; repartirDestinatarios() manda las casillas " +
    "@sumardigital.com.ar al BCC salvo que sean los únicos destinatarios.",
);
