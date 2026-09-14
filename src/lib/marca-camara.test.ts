// npx tsx src/lib/marca-camara.test.ts
import assert from "node:assert/strict";

// sessionStorage de mentira (node no lo trae). Por pestaña, sobrevive a "recargas" del módulo.
const store = new Map<string, string>();
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

const { marcarCamaraAbierta, limpiarMarcaCamara, camaraSeLlevoLaApp, MARCA_CAMARA } =
  await import("./marca-camara");

// 1) Caso reportado: abre la cámara, el celular descarta la pestaña, la página se recarga.
//    Ningún handler de la página vieja llegó a limpiar la marca → al montar hay que avisar.
marcarCamaraAbierta();
assert.equal(camaraSeLlevoLaApp(), true, "la pestaña murió con la cámara abierta: hay que avisar");
// …y una sola vez: la marca se consume.
assert.equal(camaraSeLlevoLaApp(), false, "no repetir el aviso en el próximo montaje");

// 2) La foto volvió bien (handleFile limpia la marca) → nada que avisar.
marcarCamaraAbierta();
limpiarMarcaCamara();
assert.equal(camaraSeLlevoLaApp(), false, "foto recibida: sin aviso");

// 3) Canceló la cámara sin recargarse (evento cancel / foco) → nada que avisar.
marcarCamaraAbierta();
limpiarMarcaCamara();
assert.equal(camaraSeLlevoLaApp(), false, "cancelación: sin aviso");

// 4) Una marca vieja (se fue a comer con la cámara abierta y volvió a la hora) no dispara un aviso
//    fuera de contexto sobre una foto de hace rato.
store.set(MARCA_CAMARA, String(Date.now() - 6 * 60_000));
assert.equal(camaraSeLlevoLaApp(), false, "marca vencida: sin aviso");
assert.equal(store.has(MARCA_CAMARA), false, "y la marca vencida igual se borra");

// 5) Basura en la marca no rompe nada.
store.set(MARCA_CAMARA, "no-es-un-numero");
assert.equal(camaraSeLlevoLaApp(), false);

// 6) Sin sessionStorage (modo privado estricto) no revienta: se pierde sólo el aviso.
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
  getItem: () => { throw new Error("SecurityError"); },
  setItem: () => { throw new Error("SecurityError"); },
  removeItem: () => { throw new Error("SecurityError"); },
};
assert.doesNotThrow(() => marcarCamaraAbierta());
assert.doesNotThrow(() => limpiarMarcaCamara());
assert.equal(camaraSeLlevoLaApp(), false);

console.log("ok — marca de cámara: avisa si la pestaña murió con la cámara abierta, una sola vez; no avisa si la foto volvió, si canceló, si la marca es vieja o si no hay sessionStorage.");
