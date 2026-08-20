// ── Borradores de formulario: parte PURA ───────────────────────────────────────────────────
//
// POR QUÉ EXISTE ESTO (defensa nueva del port, NO hay equivalente en PowerApps):
// La mobile es una PWA y `PhotoCapture` abre la cámara NATIVA del sistema
// (`<input type="file" capture="environment">`, PhotoCapture.tsx). Mientras el técnico saca la
// foto el navegador queda en segundo plano y, en un celular con poca RAM, el sistema DESCARTA la
// pestaña: al volver, la PWA arranca de cero y se pierde todo lo cargado. PowerApps era una app
// nativa y no sufría esto, así que el PowerFx de docs/powerapps/Src/*.pa.yaml no especifica nada
// al respecto. Lo ÚNICO con paridad PA es la idea de persistir el avance del checklist
// (`SaveData(CollectOBSGenerales, …)` / `SaveData(CollectChecklistSV, …)` y su `ClearData()` al
// cerrar, ScreenCheckList.pa.yaml:110,414,646,967). El resto — el gancho de ciclo de vida, el
// scoping por técnico, el TTL y el aviso al restaurar — es defensa nueva.
//
// Este archivo NO toca `window`, `document`, `localStorage` ni IndexedDB: es todo funciones puras
// para poder testearlo offline con  `npx tsx src/lib/borrador.test.ts`.
// El acceso a disco vive en borrador-store.ts y el cableado a React en hooks/use-borrador.ts.

/** Formularios que persisten borrador. Un scope por pantalla/flujo. */
export type BorradorScope = "checklist" | "incidente" | "ventilacion" | "resolver";

/** Prefijo común de todas las claves en localStorage (permite podar por barrido). */
export const PREFIJO_BORRADOR = "washinn:borrador:";

/**
 * TTL corto, del orden de una jornada de trabajo. Un borrador de anteayer no sirve y confunde:
 * el técnico ya no se acuerda qué había cargado y restaurarlo es peor que perderlo.
 */
export const TTL_BORRADOR_MS = 12 * 60 * 60 * 1000; // 12 h

/** Versión del FORMATO del sobre (no de la app). Si cambia la forma del sobre, se sube. */
export const VERSION_SOBRE = 1;

/** Sobre serializado en localStorage. La foto NUNCA viaja acá (ver borrador-store.ts). */
export interface SobreBorrador<T> {
  v: number;
  scope: BorradorScope;
  /** Epoch ms del último guardado. Base del TTL y del "hace X" del aviso. */
  guardadoEn: number;
  /** Versión de la app que lo escribió. Diagnóstico: NO se rechaza por mismatch (ver abajo). */
  appVersion: string;
  /** Si hay una foto asociada guardada aparte, en IndexedDB. */
  tieneFoto: boolean;
  valor: T;
}

/**
 * Clave de un borrador.
 *
 * CRITERIO NO NEGOCIABLE: el borrador está ACOTADO A SU CONTEXTO. La clave lleva el scope, el
 * TÉCNICO logueado y el ID de lo que se estaba cargando (incidente / ventilación / visita).
 * Restaurar un borrador en el formulario equivocado —otro edificio, otro incidente, otro técnico
 * en el mismo celular compartido— es PEOR que perderlo: se escribiría el trabajo de un registro
 * sobre otro, y en ventilaciones eso es irreversible desde la mobile.
 *
 * Devuelve null si falta el técnico o el id: sin contexto completo NO se persiste nada. Es
 * deliberado que un checklist "manual" (sin visita en curso) no guarde borrador — tampoco se
 * puede guardar en SharePoint sin visita, así que el borrador no tendría a dónde ir.
 */
export function claveBorrador(
  scope: BorradorScope,
  id: string | number | null | undefined,
  usuarioId: string | number | null | undefined,
): string | null {
  const sid = id === null || id === undefined ? "" : String(id).trim();
  const uid =
    usuarioId === null || usuarioId === undefined ? "" : String(usuarioId).trim();
  if (!sid || !uid) return null;
  return `${PREFIJO_BORRADOR}${scope}:${encodeURIComponent(uid)}:${encodeURIComponent(sid)}`;
}

/** ¿La clave pertenece al sistema de borradores? (para el barrido de poda). */
export function esClaveBorrador(clave: string): boolean {
  return clave.startsWith(PREFIJO_BORRADOR);
}

/** Descompone una clave de borrador. null si no tiene la forma esperada. */
export function partesDeClave(
  clave: string,
): { scope: string; usuarioId: string; id: string } | null {
  if (!esClaveBorrador(clave)) return null;
  const resto = clave.slice(PREFIJO_BORRADOR.length);
  const partes = resto.split(":");
  if (partes.length !== 3) return null;
  const [scope, usuarioId, id] = partes;
  if (!scope || !usuarioId || !id) return null;
  try {
    return {
      scope,
      usuarioId: decodeURIComponent(usuarioId),
      id: decodeURIComponent(id),
    };
  } catch {
    return null;
  }
}

/** Serializa el sobre. Lanza solo si `valor` no es serializable (referencias cíclicas). */
export function empaquetar<T>(
  scope: BorradorScope,
  valor: T,
  opts: { ahora: number; appVersion: string; tieneFoto: boolean },
): string {
  const sobre: SobreBorrador<T> = {
    v: VERSION_SOBRE,
    scope,
    guardadoEn: opts.ahora,
    appVersion: opts.appVersion,
    tieneFoto: opts.tieneFoto,
    valor,
  };
  return JSON.stringify(sobre);
}

export type ResultadoDesempaque<T> =
  | { estado: "ok"; sobre: SobreBorrador<T> }
  | { estado: "vacio" }
  | { estado: "vencido"; guardadoEn: number }
  | { estado: "corrupto" };

/**
 * Lee un sobre crudo y decide si sirve.
 *
 * Nota deliberada sobre `appVersion`: NO se rechaza el borrador cuando lo escribió otra versión
 * de la app. El escenario que más importa es justo ese —deploy nuevo mientras el técnico tenía el
 * formulario a medio llenar— y descartarlo ahí sería reproducir a mano el bug que se está
 * arreglando. La compatibilidad de forma la resuelve cada `aplicar` leyendo los campos con
 * default (`?? ""`), no un gate de versión. El campo queda para diagnóstico.
 */
export function desempaquetar<T>(
  raw: string | null | undefined,
  ahora: number,
  ttlMs: number = TTL_BORRADOR_MS,
): ResultadoDesempaque<T> {
  if (!raw) return { estado: "vacio" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { estado: "corrupto" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { estado: "corrupto" };
  }
  const sobre = parsed as Partial<SobreBorrador<T>>;
  if (sobre.v !== VERSION_SOBRE) return { estado: "corrupto" };
  if (typeof sobre.guardadoEn !== "number" || !Number.isFinite(sobre.guardadoEn)) {
    return { estado: "corrupto" };
  }
  if (sobre.valor === undefined) return { estado: "corrupto" };
  if (estaVencido(sobre.guardadoEn, ahora, ttlMs)) {
    return { estado: "vencido", guardadoEn: sobre.guardadoEn };
  }
  return {
    estado: "ok",
    sobre: {
      v: sobre.v,
      scope: (sobre.scope ?? "checklist") as BorradorScope,
      guardadoEn: sobre.guardadoEn,
      appVersion: typeof sobre.appVersion === "string" ? sobre.appVersion : "",
      tieneFoto: sobre.tieneFoto === true,
      valor: sobre.valor as T,
    },
  };
}

/**
 * ¿Caducó? También caduca un sobre "del futuro" (más de un TTL adelantado): pasa cuando el reloj
 * del celular estaba mal al guardarlo, y un sobre así jamás vencería por sí solo.
 */
export function estaVencido(
  guardadoEn: number,
  ahora: number,
  ttlMs: number = TTL_BORRADOR_MS,
): boolean {
  const delta = ahora - guardadoEn;
  return delta > ttlMs || delta < -ttlMs;
}

/**
 * Barrido de poda: dadas las claves presentes en disco y un lector, devuelve las que hay que
 * borrar (vencidas, corruptas o de OTRO técnico). `usuarioId` opcional: si se pasa, todo lo que
 * no sea de ese técnico se marca para borrar (celular compartido → no dejamos su trabajo ahí).
 */
export function clavesAPodar(
  claves: string[],
  leer: (clave: string) => string | null,
  ahora: number,
  opts: { ttlMs?: number; usuarioId?: string | number | null } = {},
): string[] {
  const ttl = opts.ttlMs ?? TTL_BORRADOR_MS;
  const uid =
    opts.usuarioId === null || opts.usuarioId === undefined
      ? null
      : String(opts.usuarioId).trim();
  const out: string[] = [];
  for (const clave of claves) {
    if (!esClaveBorrador(clave)) continue;
    const partes = partesDeClave(clave);
    if (!partes) {
      out.push(clave);
      continue;
    }
    if (uid && partes.usuarioId !== uid) {
      out.push(clave);
      continue;
    }
    const r = desempaquetar(leer(clave), ahora, ttl);
    if (r.estado !== "ok") out.push(clave);
  }
  return out;
}

/**
 * Cantidad EFECTIVA de una línea de repuesto restaurada de un borrador, contra el stock que el
 * técnico tiene AHORA.
 *
 * Un borrador puede tener horas: mientras tanto el técnico pudo consumir ese mismo repuesto
 * resolviendo otro incidente. La cantidad guardada queda por encima del stock real y hay que
 * clampearla en TODOS los puntos de lectura —lo que se muestra, lo que se emite y lo que suman
 * los botones—, no solo al emitir: si el Stepper muestra 3 y se descargan 2, el técnico anota una
 * cosa y 99.ABM_Repuestos_Tecnico descuenta otra. Con stock 0 devuelve 0, y una línea en 0 no se
 * envía (si no, quedaría una fila fantasma con Cantidad_RI "0" en 13.RepuestosIncidentes).
 *
 * Tolerante a basura: NaN/negativos/undefined colapsan a 0.
 */
export function cantidadContraStock(
  pedida: number | undefined | null,
  disponible: number | undefined | null,
): number {
  const p = Number(pedida);
  const d = Number(disponible);
  if (!Number.isFinite(p) || p <= 0) return 0;
  if (!Number.isFinite(d) || d <= 0) return 0;
  return Math.min(Math.floor(p), Math.floor(d));
}

/**
 * "hace X" en castellano para el aviso de restauración. El técnico tiene que poder decidir de un
 * vistazo si lo recuperado es de recién o de la visita anterior.
 */
export function describirAntiguedad(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60_000);
  if (m < 1) return "recién";
  if (m === 1) return "hace 1 minuto";
  if (m < 60) return `hace ${m} minutos`;
  const h = Math.floor(m / 60);
  if (h === 1) return "hace 1 hora";
  return `hace ${h} horas`;
}
