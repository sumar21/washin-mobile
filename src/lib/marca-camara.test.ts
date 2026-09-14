// npx tsx src/lib/marca-camara.test.ts
import assert from "node:assert/strict";

// sessionStorage de mentira (node no lo trae). Por pestaña, sobrevive a recargas.
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

/** Marca dejada por OTRA carga de página (la que se murió). */
const marcaDeOtraPagina = (t = Date.now()) =>
  store.set(MARCA_CAMARA, JSON.stringify({ token: "x", pagina: "pagina-muerta", t }));

// 1) Caso reportado: la pestaña se murió con la cámara abierta (o procesando la foto) y la página
//    se recargó. La marca la dejó otra carga de página → hay que avisar, y UNA sola vez.
marcaDeOtraPagina();
assert.equal(camaraSeLlevoLaApp(), true, "la pestaña murió con la cámara abierta: hay que avisar");
assert.equal(camaraSeLlevoLaApp(), false, "no repetir el aviso en el próximo montaje");

// 2) Falso positivo que encontró QA: el componente se vuelve a montar SIN recargar (el técnico
//    cambia de modo y vuelve) con una marca colgada de ESTA página. No hubo descarte → sin aviso.
marcarCamaraAbierta();
assert.equal(camaraSeLlevoLaApp(), false, "remontar sin recargar no es un descarte");
assert.equal(store.has(MARCA_CAMARA), false, "y la marca colgada se descarta");

// 3) La foto volvió / canceló → se limpia con su token → sin aviso.
{
  const t = marcarCamaraAbierta();
  limpiarMarcaCamara(t);
  assert.equal(store.has(MARCA_CAMARA), false);
}

// 4) Carrera que encontró QA: un timer de foco viejo NO puede borrar una marca puesta después
//    (el técnico descartó la foto y volvió a abrir la cámara dentro de los 1,5 s).
{
  const vieja = marcarCamaraAbierta();
  const nueva = marcarCamaraAbierta();
  limpiarMarcaCamara(vieja);
  assert.equal(store.has(MARCA_CAMARA), true, "el token viejo no borra la marca nueva");
  limpiarMarcaCamara(nueva);
  assert.equal(store.has(MARCA_CAMARA), false, "el token vigente sí");
}

// 5) Sin token (cancelación sin contexto) borra lo que haya.
marcarCamaraAbierta();
limpiarMarcaCamara();
assert.equal(store.has(MARCA_CAMARA), false);

// 6) Marca vieja de otra página: sin aviso fuera de contexto, y se borra.
marcaDeOtraPagina(Date.now() - 6 * 60_000);
assert.equal(camaraSeLlevoLaApp(), false, "marca vencida: sin aviso");
assert.equal(store.has(MARCA_CAMARA), false);
marcaDeOtraPagina(Date.now() - 4.5 * 60_000);
assert.equal(camaraSeLlevoLaApp(), true, "dentro de los 5 minutos sí avisa");

// 7) Reloj movido hacia atrás (timestamp en el futuro): no se confía.
marcaDeOtraPagina(Date.now() + 60_000);
assert.equal(camaraSeLlevoLaApp(), false, "timestamp futuro: sin aviso");

// 8) Basura o formato viejo (timestamp suelto): sin aviso y se descarta.
store.set(MARCA_CAMARA, "no-es-json");
assert.equal(camaraSeLlevoLaApp(), false);
assert.equal(store.has(MARCA_CAMARA), false);
store.set(MARCA_CAMARA, String(Date.now()));
assert.equal(camaraSeLlevoLaApp(), false, "formato viejo: sin aviso");
assert.equal(store.has(MARCA_CAMARA), false);

// 9) Sin sessionStorage (modo privado estricto) no revienta: se pierde sólo el aviso.
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("SecurityError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};
assert.doesNotThrow(() => marcarCamaraAbierta());
assert.doesNotThrow(() => limpiarMarcaCamara("x"));
assert.equal(camaraSeLlevoLaApp(), false);

console.log(
  "ok — marca de cámara: avisa sólo si la marca la dejó OTRA carga de página, una vez; un remontaje sin recargar no avisa; un token viejo no borra una marca nueva; vencida, futura, basura o sin sessionStorage no avisan.",
);
