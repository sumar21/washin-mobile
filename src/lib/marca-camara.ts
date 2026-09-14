// ── La app se cerró antes de guardar la foto ───────────────────────────────────────────────
// Abrir la cámara nativa manda el navegador al fondo. En celulares con poca memoria el sistema
// DESCARTA la pestaña mientras tanto: cuando la cámara vuelve, la página se recarga desde cero y
// la foto se pierde, porque el resultado del <input> iba a la página vieja. Lo mismo si la pestaña
// muere mientras la foto se procesa. Eso no se puede recuperar desde JS; lo que sí se puede es
// darse cuenta y decírselo al técnico, en vez de dejarlo frente a un formulario sin foto.
//
// Mecánica: al abrir la cámara se guarda una marca en sessionStorage (por pestaña, sobrevive a la
// recarga). Si la foto llega y se procesa, o si el técnico cancela, la marca se borra. Si al montar
// la marca sigue ahí Y FUE PUESTA POR OTRA CARGA DE PÁGINA, la pestaña murió en el medio.
//
// Por qué el id de carga de página: el aviso se evalúa al montar PhotoCapture, y un componente se
// puede volver a montar SIN recargar (el técnico cambia de modo y vuelve). Comparar sólo "la marca
// existe" daba falsos positivos en ese caso. `PAGINA` se genera una vez por carga del módulo, o sea
// una vez por carga de página.
//
// Por qué el token: el listener de foco limpia la marca con un retardo. Si en ese intervalo el
// técnico vuelve a abrir la cámara, el timer viejo no debe borrar la marca NUEVA.

export const MARCA_CAMARA = "washinn:camara-abierta";
const VIGENCIA_MARCA_MS = 5 * 60_000;

/** Id de esta carga de página. Distinto en cada recarga. */
const PAGINA = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

interface Marca {
  token: string;
  pagina: string;
  t: number;
}

function leer(): Marca | null {
  try {
    const v = sessionStorage.getItem(MARCA_CAMARA);
    if (!v) return null;
    const m = JSON.parse(v) as Partial<Marca>;
    if (typeof m.token !== "string" || typeof m.pagina !== "string" || typeof m.t !== "number") {
      return null;
    }
    return m as Marca;
  } catch {
    return null;
  }
}

function borrar() {
  try {
    sessionStorage.removeItem(MARCA_CAMARA);
  } catch {
    // Sin sessionStorage (modo privado estricto) se pierde sólo el aviso, no la foto.
  }
}

/** Pone la marca. Devuelve su token, para poder limpiar sólo ESTA marca más tarde. */
export function marcarCamaraAbierta(): string {
  const token = `${PAGINA}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  try {
    sessionStorage.setItem(
      MARCA_CAMARA,
      JSON.stringify({ token, pagina: PAGINA, t: Date.now() } satisfies Marca),
    );
  } catch {
    /* idem */
  }
  return token;
}

/**
 * Borra la marca. Con `token`, sólo si la marca guardada sigue siendo esa: un timer viejo no
 * puede borrar una marca puesta después.
 */
export function limpiarMarcaCamara(token?: string) {
  if (token !== undefined && leer()?.token !== token) return;
  borrar();
}

/**
 * true si una carga de página ANTERIOR dejó la cámara abierta (o una foto a medio procesar) y la
 * pestaña se murió en el medio. Consume la marca: avisa una sola vez.
 */
export function camaraSeLlevoLaApp(): boolean {
  let crudo: string | null = null;
  try {
    crudo = sessionStorage.getItem(MARCA_CAMARA);
  } catch {
    return false;
  }
  if (crudo === null) return false;
  const m = leer();
  if (!m) {
    borrar(); // basura o formato viejo: se descarta sin avisar
    return false;
  }
  // Misma carga de página: el componente se volvió a montar sin recargar. No hubo descarte; la
  // marca quedó colgada porque no llegó ni change, ni cancel, ni foco. Se descarta sin avisar.
  if (m.pagina === PAGINA) {
    borrar();
    return false;
  }
  borrar();
  const edad = Date.now() - m.t;
  // edad < 0: reloj del celular movido hacia atrás. No se confía en esa marca.
  return edad >= 0 && edad < VIGENCIA_MARCA_MS;
}
