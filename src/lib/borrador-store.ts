// ── Borradores de formulario: acceso a disco ───────────────────────────────────────────────
//
// Dos almacenes, a propósito:
//
//   • CAMPOS  → localStorage. Es SÍNCRONO, que es lo único que sirve dentro del handler de
//     `visibilitychange`/`pagehide`: cuando el sistema está por descartar la pestaña no hay
//     tiempo para esperar una promesa.
//
//   • FOTO    → IndexedDB (vía localforage, ya era dependencia del proyecto).
//     LA FOTO NO VA A localStorage, NUNCA. Una captura de PhotoCapture pesa ~150-300 KB en
//     base64 (MAX_SIDE 1280 + JPEG_QUALITY 0.65) contra una cuota total de ~5 MB compartida por
//     TODO el origen. Llenarla no rompe solo el borrador: rompe en silencio, con un
//     QuotaExceededError, cualquier otra cosa que escriba ahí — empezando por `washinn-session`
//     (el JWT y la visita en curso del técnico). IndexedDB tiene cuota de otro orden y además es
//     el lugar correcto para binarios.
//     Se eligió PERSISTIR la foto en vez de pedirle al técnico que la vuelva a sacar porque
//     volver a sacarla significa volver a abrir la cámara nativa, que es exactamente el evento
//     que dispara el descarte de la pestaña. Pedirle que reintente el disparador sería un fix
//     que se muerde la cola.
//
// La escritura de la foto se hace APENAS SE CAPTURA (no en el flush de `pagehide`): un write
// asíncrono arrancado durante el descarte de la pestaña puede no llegar a completarse.

import localforage from "localforage";
import {
  clavesAPodar,
  claveBorrador,
  esClaveBorrador,
  VERSION_SOBRE,
  type SobreBorrador,
} from "./borrador";
import { APP_VERSION } from "./version";

const almacenFotos = localforage.createInstance({
  name: "washinn",
  storeName: "borradores_fotos",
  description: "Fotos de formularios a medio cargar (se limpian al guardar o al vencer)",
  // Driver EXPLÍCITO: por defecto localforage degrada a localStorage si no hay IndexedDB, y eso
  // es justo lo que este módulo existe para evitar. Si no hay IndexedDB, no se persiste la foto.
  driver: [localforage.INDEXEDDB, localforage.WEBSQL],
});

// ── Campos (localStorage, síncrono) ────────────────────────────────────────────────────────

export function leerCampos(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

/** Devuelve false si no se pudo escribir (modo privado, cuota llena). Nunca lanza. */
export function escribirCampos(clave: string, raw: string): boolean {
  try {
    localStorage.setItem(clave, raw);
    return true;
  } catch {
    // Sin foto adentro, el sobre pesa unos pocos KB: si esto falla es que el origen ya está
    // lleno por otra cosa. El estado en memoria sigue intacto, así que degradamos en silencio.
    return false;
  }
}

export function borrarCampos(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    /* noop */
  }
}

/**
 * Claves del esquema VIEJO del checklist (`washinn:checklist:<IDUnico>`), que guardaba la foto
 * general en base64 DENTRO de localStorage. Se barren en la primera poda: además de no tener
 * scoping por técnico ni TTL, son las que más cuota ocupan.
 */
const PREFIJO_LEGACY_CHECKLIST = "washinn:checklist:";

function clavesEnDisco(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && esClaveBorrador(k)) out.push(k);
    }
  } catch {
    /* noop */
  }
  return out;
}

// ── Foto (IndexedDB) ───────────────────────────────────────────────────────────────────────

export async function leerFoto(clave: string): Promise<string | null> {
  try {
    return (await almacenFotos.getItem<string>(clave)) ?? null;
  } catch {
    return null;
  }
}

export async function escribirFoto(clave: string, dataUrl: string): Promise<void> {
  try {
    await almacenFotos.setItem(clave, dataUrl);
  } catch {
    /* sin IndexedDB o sin espacio: se pierde solo la foto, los campos siguen a salvo */
  }
}

export async function borrarFoto(clave: string): Promise<void> {
  try {
    await almacenFotos.removeItem(clave);
  } catch {
    /* noop */
  }
}

// ── Borrado y poda ─────────────────────────────────────────────────────────────────────────

/** Borra un borrador completo (campos + foto). Se llama al GUARDAR CON ÉXITO y al descartar. */
export function borrarBorrador(clave: string): void {
  borrarCampos(clave);
  void borrarFoto(clave);
}

/**
 * Barrido de mantenimiento. Borra:
 *   - borradores vencidos por TTL, corruptos o con clave malformada;
 *   - si se pasa `usuarioId`, los de CUALQUIER otro técnico (celular compartido);
 *   - fotos huérfanas en IndexedDB cuyo sobre en localStorage ya no existe.
 *
 * Best-effort y asíncrono: si algo falla, el peor caso es que quede basura, nunca una pérdida.
 */
export async function podarBorradores(opts: {
  ahora?: number;
  usuarioId?: string | number | null;
} = {}): Promise<void> {
  const ahora = opts.ahora ?? Date.now();
  const claves = clavesEnDisco();
  for (const k of clavesAPodar(claves, leerCampos, ahora, { usuarioId: opts.usuarioId })) {
    borrarCampos(k);
    void borrarFoto(k);
  }
  // Migración del esquema VIEJO del checklist. NO se puede borrar y listo: hoy hay técnicos con
  // avance real guardado en ese formato, y la poda corre ANTES de que la pantalla lea nada. Si sólo
  // se borrara, el primer técnico que abra el checklist después del deploy perdería su visita.
  // Los nombres de campo son los mismos en los dos esquemas; lo único que se muda es la foto, que
  // pasa de base64 en localStorage a IndexedDB.
  await migrarLegacyChecklist(opts.usuarioId, ahora);
  // Fotos huérfanas: el sobre manda. Si no está el sobre, la foto no se puede restaurar en
  // ningún formulario, así que solo ocupa lugar.
  try {
    const vivas = new Set(clavesEnDisco());
    const clavesFoto = await almacenFotos.keys();
    for (const k of clavesFoto) {
      if (!vivas.has(k)) await almacenFotos.removeItem(k);
    }
  } catch {
    /* noop */
  }
}

/**
 * Purga TOTAL de borradores. Se llama en el logout: el próximo técnico que use el celular no
 * tiene por qué encontrar (ni siquiera en disco) el trabajo a medio cargar del anterior.
 */
export function purgarBorradores(): void {
  for (const k of clavesEnDisco()) borrarCampos(k);
  void almacenFotos.clear().catch(() => {});
}

/**
 * Convierte los borradores del esquema viejo del checklist al nuevo y recién ahí borra el original.
 * Se deja UN release y se saca: pasado ese tiempo ya no queda nadie con claves viejas vivas.
 *
 * Reglas:
 *  - `washinn:checklist:manual` NO se migra: era un balde compartido entre técnicos, edificios y
 *    días (la clave no tenía ni visita ni usuario). Restaurar eso en la visita equivocada sería
 *    peor que perderlo, que es justo el criterio del resto del módulo.
 *  - Si la clave nueva YA existe, gana la nueva: es más reciente por definición.
 *  - Sin técnico logueado no se migra nada y las claves viejas se dejan intactas, para reintentar
 *    en la próxima poda ya con sesión.
 */
async function migrarLegacyChecklist(
  usuarioId: string | number | null | undefined,
  ahora: number,
): Promise<void> {
  try {
    const legacy: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIJO_LEGACY_CHECKLIST)) legacy.push(k);
    }
    if (!legacy.length) return;
    // Sin usuario no hay clave nueva posible: se dejan para la próxima poda.
    if (usuarioId === null || usuarioId === undefined || String(usuarioId).trim() === "") return;

    for (const claveVieja of legacy) {
      const idUnico = claveVieja.slice(PREFIJO_LEGACY_CHECKLIST.length);
      if (!idUnico || idUnico === "manual") {
        borrarCampos(claveVieja);
        continue;
      }
      const claveNueva = claveBorrador("checklist", idUnico, usuarioId);
      if (!claveNueva) continue;

      if (leerCampos(claveNueva) === null) {
        const raw = leerCampos(claveVieja);
        if (raw) {
          try {
            const s = JSON.parse(raw) as {
              resp?: unknown;
              generalObs?: string;
              horaInicio?: string;
              horaFinCheck?: string;
              generalPhoto?: string | null;
            };
            const foto = typeof s.generalPhoto === "string" && s.generalPhoto ? s.generalPhoto : null;
            const sobre: SobreBorrador<Record<string, unknown>> = {
              v: VERSION_SOBRE,
              scope: "checklist",
              // Se conserva `ahora` y no una fecha vieja: no se sabe cuándo se escribió el original
              // (el esquema viejo no guardaba timestamp) y datarlo en el pasado lo haría caducar
              // por TTL en el acto, o sea perderlo igual.
              guardadoEn: ahora,
              appVersion: APP_VERSION,
              tieneFoto: foto !== null,
              valor: {
                resp: s.resp ?? {},
                generalObs: s.generalObs ?? "",
                horaInicio: s.horaInicio ?? "",
                horaFinCheck: s.horaFinCheck ?? "",
              },
            };
            // La foto primero, y se VERIFICA leyéndola de vuelta. No alcanza con que
            // `escribirFoto` no tire: es best-effort y se traga los errores, así que un
            // IndexedDB no disponible (Safari privado, o Node en los tests) devolvería "ok"
            // igual y el sobre prometería una foto que no está. Un sobre que miente hace que el
            // técnico vea el aviso de restauración sin que se le restaure nada.
            let fotoOk = false;
            if (foto) {
              await escribirFoto(claveNueva, foto);
              fotoOk = (await leerFoto(claveNueva)) !== null;
            }
            sobre.tieneFoto = fotoOk;
            escribirCampos(claveNueva, JSON.stringify(sobre));
          } catch {
            /* sobre viejo ilegible: se descarta con la clave */
          }
        }
      }
      borrarCampos(claveVieja);
    }
  } catch {
    /* noop */
  }
}
