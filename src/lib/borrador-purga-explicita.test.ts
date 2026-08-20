// Guard de la SEGUNDA invariante de los borradores: LA PURGA TOTAL ES SOLO DEL LOGOUT EXPLÍCITO.
//
// `purgarBorradores()` borra TODOS los sobres de localStorage y hace `almacenFotos.clear()`.
// `logout()` no lo llama solo el botón de "Cerrar sesión": `authFetch` lo invoca ante CUALQUIER
// 401 (lib/api-client.ts) y el JWT dura 12 h, o sea que vence a mitad de la jornada, con el
// checklist a medio cargar en pantalla. Purgar ahí le borra al técnico el formulario que tiene
// abierto en ese preciso momento — exactamente el caso que useBorrador existe para cubrir.
//
// El "celular compartido" NO depende de esta purga: la clave lleva el ID del técnico
// (lib/borrador.ts) y `podarBorradores({ usuarioId })` barre lo de cualquier otro en el primer
// montaje después del login (hooks/use-borrador.ts), más el TTL de 12 h.
//
// Correr:  npx tsx src/lib/borrador-purga-explicita.test.ts
import assert from "node:assert";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rel = (f: string) => path.relative(raiz, f);

function archivosDe(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const full = path.join(dir, nombre);
    if (statSync(full).isDirectory()) out.push(...archivosDe(full));
    else if (/\.(ts|tsx)$/.test(nombre)) out.push(full);
  }
  return out;
}

/** Sin comentarios: este test no puede dispararse contra el texto que DOCUMENTA la invariante. */
function sinComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const fuentes = archivosDe(path.join(raiz, "src"));
const esTest = (f: string) => /\.test\.tsx?$/.test(path.basename(f));

// ── 1. Quién puede llamar a purgarBorradores ───────────────────────────────────────────────
const PERMITIDOS = new Set(["src/lib/borrador-store.ts", "src/stores/sessionStore.ts"]);
for (const f of fuentes) {
  if (esTest(f)) continue;
  const codigo = sinComentarios(readFileSync(f, "utf8"));
  if (!/purgarBorradores\s*\(/.test(codigo)) continue;
  assert.ok(
    PERMITIDOS.has(rel(f).split(path.sep).join("/")),
    `${rel(f)} llama a purgarBorradores(): la purga TOTAL solo puede salir del logout explícito ` +
      `(sessionStore.logout con { purgarBorradores: true }). Para limpiar UN borrador guardado ` +
      `usar el \`limpiar()\` que devuelve useBorrador.`,
  );
}

// ── 2. En el store, la purga va detrás del flag ────────────────────────────────────────────
const store = sinComentarios(
  readFileSync(path.join(raiz, "src/stores/sessionStore.ts"), "utf8"),
);
assert.ok(
  /if\s*\(\s*opts\?\.\s*purgarBorradores\s*\)\s*purgarBorradores\s*\(\s*\)/.test(store),
  "sessionStore.logout tiene que purgar SOLO con { purgarBorradores: true }. Sin el flag, " +
    "cualquier 401 de authFetch le borra al técnico el formulario que tiene abierto.",
);

// ── 3. El logout automático del 401 NO pasa el flag ────────────────────────────────────────
const apiClient = sinComentarios(
  readFileSync(path.join(raiz, "src/lib/api-client.ts"), "utf8"),
);
const llamadas = apiClient.match(/logout\s*\(([^)]*)\)/g) ?? [];
assert.ok(llamadas.length > 0, "api-client dejó de manejar el 401: revisar este test");
for (const c of llamadas) {
  assert.ok(
    /logout\s*\(\s*\)/.test(c),
    `api-client.ts llama \`${c.trim()}\`: el logout por 401 (token vencido a mitad de jornada) ` +
      `NUNCA debe purgar borradores.`,
  );
}

// ── 4. Los botones de "Cerrar sesión" SÍ lo pasan ──────────────────────────────────────────
for (const p of ["src/components/layout/Sidebar.tsx", "src/components/layout/HamburgerMenu.tsx"]) {
  const codigo = sinComentarios(readFileSync(path.join(raiz, p), "utf8"));
  assert.ok(
    /logout\s*\(\s*\{\s*purgarBorradores:\s*true\s*\}\s*\)/.test(codigo),
    `${p} tiene el botón de cerrar sesión: ahí SÍ va logout({ purgarBorradores: true }) — ` +
      `en un celular compartido el trabajo a medio cargar del técnico anterior no queda en disco.`,
  );
}

console.log(`✓ borrador-purga-explicita.test.ts OK (${fuentes.length} archivos revisados)`);
