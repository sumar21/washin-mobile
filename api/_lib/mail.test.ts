// Test offline del split de destinatarios (bug: 99.ABM_Emails guarda varias
// direcciones separadas por ";", y Graph rechaza el mensaje si no se parten).
// Correr:  npx tsx api/_lib/mail.test.ts
import assert from "node:assert";
import { recipients } from "./mail.js";

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

console.log("ok — recipients() parte por ';' y ','");
