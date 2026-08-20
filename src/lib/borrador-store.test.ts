// Test OFFLINE de la capa de disco de los borradores (src/lib/borrador-store.ts).
// No toca red, ni SharePoint, ni un browser real: se le inyecta un localStorage FALSO que puede
// portarse mal a pedido. Correr:  npx tsx src/lib/borrador-store.test.ts
//
// QUÉ SE ESTÁ PROTEGIENDO ACÁ
// El bug original es que al técnico se le borra el formulario cuando saca la foto. Un guardado
// que LANZA una excepción en medio de ese formulario sería peor que el bug: en vez de perder los
// campos, se le cae la pantalla. Por eso toda esta capa es best-effort — devuelve false o no
// hace nada, pero NUNCA propaga. Los modos hostiles de abajo son reales, no hipotéticos:
//   • "quota"     → QuotaExceededError. localStorage son ~5 MB para TODO el origen y ya vivía
//                   ahí la foto base64 del checklist viejo (~380 KB por captura).
//   • "bloqueado" → Safari en modo privado / cookies bloqueadas: hasta `getItem` lanza.
import assert from "node:assert";

// ── localStorage falso, instalado ANTES de importar el módulo bajo prueba ───────────────────
type Modo = "ok" | "quota" | "bloqueado";
let modo: Modo = "ok";
const datos = new Map<string, string>();

function siBloqueado() {
  if (modo === "bloqueado") throw new Error("SecurityError: acceso a localStorage denegado");
}
function errorDeCuota(): Error {
  // El error real del browser. `name` es lo que mira cualquier manejo por tipo.
  const e = new Error("QuotaExceededError: no queda espacio");
  e.name = "QuotaExceededError";
  return e;
}

const localStorageFalso = {
  get length() {
    siBloqueado();
    return datos.size;
  },
  key(i: number) {
    siBloqueado();
    return Array.from(datos.keys())[i] ?? null;
  },
  getItem(k: string) {
    siBloqueado();
    return datos.get(k) ?? null;
  },
  setItem(k: string, v: string) {
    siBloqueado();
    if (modo === "quota") throw errorDeCuota();
    datos.set(k, v);
  },
  removeItem(k: string) {
    siBloqueado();
    datos.delete(k);
  },
  clear() {
    siBloqueado();
    datos.clear();
  },
};
(globalThis as unknown as { localStorage: unknown }).localStorage = localStorageFalso;

const AHORA = 1_770_000_000_000;
const TEC = 7;

async function main() {
  // Import dinámico: el falso de arriba ya está puesto cuando el módulo evalúa su top-level.
  const store = await import("./borrador-store.js");
  const { claveBorrador, empaquetar, TTL_BORRADOR_MS } = await import("./borrador.js");

  const sobre = (ahora: number, tieneFoto = false) =>
    empaquetar("incidente", { descripcion: "pierde agua" }, {
      ahora,
      appVersion: "v20260820_1.0.0",
      tieneFoto,
    });

  const kVivo = claveBorrador("incidente", 482, TEC)!;

  // ── 1. Camino normal ─────────────────────────────────────────────────────────────────────
  modo = "ok";
  datos.clear();
  assert.equal(store.escribirCampos(kVivo, sobre(AHORA)), true);
  assert.equal(store.leerCampos(kVivo), sobre(AHORA));
  store.borrarCampos(kVivo);
  assert.equal(store.leerCampos(kVivo), null);

  // ── 2. QuotaExceededError: NO SE ROMPE NADA ──────────────────────────────────────────────
  // Es el caso que importa: el técnico está a mitad del formulario y el disco se llenó.
  modo = "ok";
  datos.clear();
  store.escribirCampos(kVivo, sobre(AHORA));
  const previo = store.leerCampos(kVivo);

  modo = "quota";
  let lanzo = false;
  let resultado: boolean | undefined;
  try {
    resultado = store.escribirCampos(kVivo, sobre(AHORA + 1_000));
  } catch {
    lanzo = true;
  }
  assert.equal(lanzo, false, "escribirCampos() NUNCA propaga: rompería el formulario en curso");
  assert.equal(resultado, false, "…pero avisa que no pudo guardar");
  // El borrador anterior queda intacto y legible: un guardado fallido no corrompe el previo.
  assert.equal(store.leerCampos(kVivo), previo, "la escritura fallida no pisa lo que ya había");

  // El resto de la capa tampoco se cae con la cuota llena.
  assert.doesNotThrow(() => store.borrarCampos(kVivo));
  assert.doesNotThrow(() => store.purgarBorradores());
  await store.podarBorradores({ ahora: AHORA, usuarioId: TEC });
  await store.escribirFoto(kVivo, "data:image/jpeg;base64,AAAA");
  assert.equal(await store.leerFoto(kVivo), null);

  // ── 3. Storage BLOQUEADO (Safari privado): hasta leer lanza ───────────────────────────────
  modo = "bloqueado";
  assert.doesNotThrow(() => store.leerCampos(kVivo));
  assert.equal(store.leerCampos(kVivo), null, "sin storage se degrada a 'no hay borrador'");
  assert.equal(store.escribirCampos(kVivo, sobre(AHORA)), false);
  assert.doesNotThrow(() => store.borrarCampos(kVivo));
  assert.doesNotThrow(() => store.borrarBorrador(kVivo));
  assert.doesNotThrow(() => store.purgarBorradores());
  // Las asíncronas se resuelven, no rechazan: un `void podarBorradores()` sin catch en el hook
  // se convertiría en un unhandled rejection.
  await assert.doesNotReject(store.podarBorradores({ ahora: AHORA, usuarioId: TEC }));
  await assert.doesNotReject(store.escribirFoto(kVivo, "data:image/jpeg;base64,AAAA"));
  await assert.doesNotReject(store.leerFoto(kVivo));
  await assert.doesNotReject(store.borrarFoto(kVivo));

  // ── 4. LA FOTO NO ATERRIZA EN localStorage, NUNCA ─────────────────────────────────────────
  // Invariante central del diseño: la foto va a IndexedDB. Si alguien le saca el driver
  // explícito a localforage (borrador-store.ts:27-32), degrada solo a localStorage y vuelve a
  // llenar la cuota de ~5 MB que comparte con `washinn-session` (el JWT + la visita en curso).
  modo = "ok";
  datos.clear();
  const fotoGrande = "data:image/jpeg;base64," + "A".repeat(300_000);
  await store.escribirFoto(kVivo, fotoGrande);
  store.escribirCampos(kVivo, sobre(AHORA, true));
  for (const [k, v] of datos) {
    assert.ok(!v.includes("data:image"), `la foto se filtró a localStorage en la clave ${k}`);
    assert.ok(v.length < 10_000, `entrada sospechosamente grande en localStorage: ${k}`);
  }

  // ── 5. Poda: qué barre y qué NO ──────────────────────────────────────────────────────────
  modo = "ok";
  datos.clear();
  const kVencido = claveBorrador("incidente", 12, TEC)!;
  const kOtroTecnico = claveBorrador("ventilacion", 55, 99)!;
  // Claves AJENAS al sistema de borradores. `washinn-session` es la más sensible: borrarla
  // desloguea al técnico en medio del circuito.
  datos.set("washinn-session", '{"token":"jwt"}');
  datos.set("otra-app", "x");
  datos.set(kVivo, sobre(AHORA));
  datos.set(kVencido, sobre(AHORA - TTL_BORRADOR_MS - 1));
  datos.set(kOtroTecnico, sobre(AHORA));
  // Esquema VIEJO del checklist, el que guardaba la foto base64 en localStorage. Se barre en la
  // primera poda. Diez de golpe: si alguien reescribe el barrido borrando DENTRO del `for` sobre
  // localStorage.length, los índices se corren y sobrevive la mitad.
  for (let i = 0; i < 10; i++) {
    datos.set(`washinn:checklist:U-${i}`, `{"foto":"data:image/jpeg;base64,${"A".repeat(500)}"}`);
  }

  await store.podarBorradores({ ahora: AHORA, usuarioId: TEC });

  assert.equal(datos.has("washinn-session"), true, "la poda NO puede desloguear al técnico");
  assert.equal(datos.has("otra-app"), true, "la poda no toca claves ajenas");
  assert.equal(datos.has(kVivo), true, "el borrador vivo del técnico logueado sobrevive");
  assert.equal(datos.has(kVencido), false, "vencido por TTL: se barre");
  assert.equal(datos.has(kOtroTecnico), false, "borrador de otro técnico: se barre");
  const legacyQueQuedan = [...datos.keys()].filter((k) => k.startsWith("washinn:checklist:"));
  assert.deepEqual(legacyQueQuedan, [], "se barren TODAS las claves legacy, no una sí y una no");

  // ── 6. Logout EXPLÍCITO: purga total de borradores, y SOLO de borradores ─────────────────
  // OJO con quién llama a esto: `purgarBorradores()` sale SOLO del botón de "Cerrar sesión"
  // (`logout({ purgarBorradores: true })`), nunca del logout automático por 401 — el token vence
  // a las 12 h, en plena jornada, y ahí el técnico puede tener el checklist abierto. Esa
  // invariante la guarda src/lib/borrador-purga-explicita.test.ts.
  modo = "ok";
  datos.clear();
  datos.set("washinn-session", '{"token":"jwt"}');
  datos.set(kVivo, sobre(AHORA));
  datos.set(kOtroTecnico, sobre(AHORA));
  store.purgarBorradores();
  assert.equal(datos.has(kVivo), false);
  assert.equal(datos.has(kOtroTecnico), false, "el próximo técnico no encuentra nada del anterior");
  assert.equal(
    datos.has("washinn-session"),
    true,
    "purgarBorradores() corre DENTRO del logout (sessionStore.logout): si borrara la sesión, " +
      "se pisaría con el propio flujo de cierre",
  );

  // ── 4. MIGRACIÓN del esquema viejo del checklist ──────────────────────────────────────────
  // El día del deploy hay técnicos con avance real guardado como `washinn:checklist:<IDUnico>`.
  // La poda corre ANTES de que la pantalla lea nada, así que si sólo borrara esas claves el
  // primer técnico que abriera el checklist perdería su visita. Esto protege esa ventana.
  modo = "ok";
  datos.clear();

  const K_VIEJA = "washinn:checklist:VIS-777";
  datos.set(
    K_VIEJA,
    JSON.stringify({
      resp: { "1": "SI", "2": "NO" },
      generalObs: "faltaba una traba",
      horaInicio: "09:15",
      horaFinCheck: "09:48",
      generalPhoto: "data:image/jpeg;base64,ZZZZ",
    }),
  );
  // Balde compartido del esquema viejo: NO se migra (no tenía ni visita ni técnico, restaurarlo
  // en la visita equivocada sería peor que perderlo).
  datos.set("washinn:checklist:manual", JSON.stringify({ generalObs: "de otro día" }));

  await store.podarBorradores({ ahora: AHORA, usuarioId: TEC });

  assert.equal(datos.get(K_VIEJA), undefined, "la clave vieja se borra DESPUÉS de migrar");
  assert.equal(datos.get("washinn:checklist:manual"), undefined, "el balde 'manual' se descarta");

  const kMigrada = `washinn:borrador:checklist:${encodeURIComponent(TEC)}:${encodeURIComponent("VIS-777")}`;
  const migrado = store.leerCampos(kMigrada);
  assert.ok(migrado, "el avance del técnico sobrevivió a la migración");
  const sobreMigrado = JSON.parse(migrado!) as {
    scope: string;
    tieneFoto: boolean;
    valor: Record<string, unknown>;
  };
  assert.equal(sobreMigrado.scope, "checklist");
  assert.deepStrictEqual(sobreMigrado.valor.resp, { "1": "SI", "2": "NO" });
  assert.equal(sobreMigrado.valor.generalObs, "faltaba una traba");
  assert.equal(sobreMigrado.valor.horaInicio, "09:15");
  // La foto se mudó a IndexedDB y el sobre NO la lleva adentro.
  assert.ok(!migrado!.includes("data:image"), "la foto NUNCA queda en localStorage");
  // En Node no hay IndexedDB, así que la foto no se puede guardar: lo que se verifica acá es que
  // el sobre NO MIENTA. `escribirFoto` es best-effort y se traga el error, por eso la migración
  // lee de vuelta antes de declarar `tieneFoto`. Un sobre que promete una foto inexistente le
  // muestra al técnico el aviso de restauración sin restaurarle nada.
  assert.equal(
    sobreMigrado.tieneFoto,
    (await store.leerFoto(kMigrada)) !== null,
    "el sobre declara tieneFoto sólo si la foto realmente quedó guardada",
  );
  // Y lo que importa de la migración: el TEXTO del técnico sobrevivió intacto.
  assert.equal(sobreMigrado.valor.horaFinCheck, "09:48");

  // Sin técnico logueado NO se migra ni se borra: se reintenta en la próxima poda, ya con sesión.
  datos.clear();
  datos.set(K_VIEJA, JSON.stringify({ generalObs: "sin sesión todavía" }));
  await store.podarBorradores({ ahora: AHORA, usuarioId: null });
  assert.ok(datos.get(K_VIEJA), "sin usuario la clave vieja se conserva para el próximo intento");

  console.log("✓ borrador-store.test.ts OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
