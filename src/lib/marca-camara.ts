// ── Cámara que se llevó la app ─────────────────────────────────────────────────────────────
// Abrir la cámara nativa manda el navegador al fondo. En celulares con poca memoria el sistema
// DESCARTA la pestaña mientras tanto: cuando la cámara vuelve, la página se recarga desde cero y
// la foto se pierde, porque el resultado del <input> iba a la página vieja. Eso no se puede
// recuperar desde JS. Lo que sí se puede es darse cuenta y decírselo al técnico, en vez de dejarlo
// frente a un formulario sin foto pensando que la app anda mal.
//
// sessionStorage porque es por pestaña y sobrevive a la recarga de la misma pestaña. La marca se
// pone al abrir la cámara y se saca si vuelve la foto, si cancela, o si la app recupera el foco
// sin haberse recargado. Si al montar todavía está, la pestaña murió con la cámara abierta.
export const MARCA_CAMARA = "washinn:camara-abierta";
const VIGENCIA_MARCA_MS = 5 * 60_000;

export function marcarCamaraAbierta() {
  try {
    sessionStorage.setItem(MARCA_CAMARA, String(Date.now()));
  } catch {
    // Sin sessionStorage (modo privado estricto) se pierde sólo el aviso, no la foto.
  }
}
export function limpiarMarcaCamara() {
  try {
    sessionStorage.removeItem(MARCA_CAMARA);
  } catch {
    /* idem */
  }
}
/** true si la página se recargó con la cámara abierta. Consume la marca: avisa una sola vez. */
export function camaraSeLlevoLaApp(): boolean {
  try {
    const v = sessionStorage.getItem(MARCA_CAMARA);
    if (!v) return false;
    sessionStorage.removeItem(MARCA_CAMARA);
    return Date.now() - Number(v) < VIGENCIA_MARCA_MS;
  } catch {
    return false;
  }
}
