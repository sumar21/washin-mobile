// Guard de la invariante que hace que los borradores tengan sentido: LA APP NO SE RECARGA SOLA.
//
// Todo el trabajo de useBorrador es recuperar un formulario cuando el sistema descarta la
// pestaña. Si además la app se recargara sola al detectar un deploy, tendríamos una SEGUNDA
// fuente de pérdida — y con `registerType:"autoUpdate"` alcanza con que alguien importe
// `virtual:pwa-register` para encenderla: ese módulo trae un `window.location.reload()`
// incondicional en el evento "activated"
// (node_modules/vite-plugin-pwa/dist/client/build/register.js:38-42).
//
// Este test NO pinea `registerType`: assertar `=== "autoUpdate"` fijaría el valor equivocado
// (es justo el que enciende skipWaiting/clientsClaim y arma el reload) y dejaría en rojo a un
// futuro `registerType:"prompt"`, que sería MÁS seguro. Lo que se verifica es la invariante real:
// que nadie importe el módulo virtual y que no haya recargas programáticas en el front.
//
// Correr:  npx tsx src/lib/pwa-sin-reload.test.ts
import assert from "node:assert";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function archivosDe(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const full = path.join(dir, nombre);
    if (statSync(full).isDirectory()) out.push(...archivosDe(full));
    else if (/\.(ts|tsx|js|jsx|html)$/.test(nombre)) out.push(full);
  }
  return out;
}

const fuentes = [
  ...archivosDe(path.join(raiz, "src")),
  path.join(raiz, "index.html"),
  path.join(raiz, "vite.config.ts"),
];

const rel = (f: string) => path.relative(raiz, f);
const esEsteTest = (f: string) => path.basename(f) === "pwa-sin-reload.test.ts";

/**
 * Quita comentarios de bloque, de línea y de HTML. Sin esto el test se dispara contra los
 * comentarios que DOCUMENTAN la invariante (vite.config.ts explica por qué no hay que importar
 * el módulo virtual, y ese texto no es código).
 */
function sinComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

for (const f of fuentes) {
  if (esEsteTest(f)) continue;
  const codigo = sinComentarios(readFileSync(f, "utf8"));

  // 1. Nadie importa el módulo virtual: es lo ÚNICO que bundlea el reload de autoUpdate.
  assert.ok(
    !/virtual:pwa-register/.test(codigo),
    `${rel(f)} importa "virtual:pwa-register": eso bundlea el window.location.reload() ` +
      `incondicional de vite-plugin-pwa y le borra el formulario al técnico en cada deploy. ` +
      `Si hace falta forzar la actualización, usar registerType:"prompt" y llamar a ` +
      `updateServiceWorker() SOLO con el formulario limpio (y reescribir este test).`,
  );

  // 2. Nada de recargas programáticas en el front (mismo efecto, escrito a mano).
  assert.ok(
    !/location\s*\.\s*(reload|assign|replace)\s*\(/.test(codigo),
    `${rel(f)} recarga la página por código: se pierde el formulario a medio cargar.`,
  );

  // 3. Nadie registra el service worker a mano con un listener de controllerchange.
  assert.ok(
    !/controllerchange/.test(codigo),
    `${rel(f)} escucha "controllerchange": ese es el gancho por el que se cuela el reload.`,
  );
}

// 4. Y que el propio registerSW.js NO haya sido reemplazado a mano en public/ (el plugin solo
//    genera el suyo si no existe uno ahí, y ese override no aparecería en ningún grep de src/).
let hayOverride = true;
try {
  statSync(path.join(raiz, "public", "registerSW.js"));
} catch {
  hayOverride = false;
}
assert.equal(
  hayOverride,
  false,
  "public/registerSW.js pisa el script generado por vite-plugin-pwa: revisar que no recargue.",
);

console.log(`✓ pwa-sin-reload.test.ts OK (${fuentes.length} archivos revisados)`);
