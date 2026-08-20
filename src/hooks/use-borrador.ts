// ── useBorrador: borrador local de un formulario a medio cargar ─────────────────────────────
//
// DEFENSA NUEVA DEL PORT (no hay equivalente en PowerApps; ver el encabezado de lib/borrador.ts).
// Un solo hook para los CUATRO formularios que sacan foto (checklist, alta/revisión de incidente,
// finalizar ventilación, resolver incidente asignado). No se copia la lógica cuatro veces.
//
// Qué resuelve, en orden de importancia:
//
//  1. `PhotoCapture` abre la CÁMARA NATIVA del sistema y manda la PWA al fondo. En un celular con
//     poca RAM el sistema descarta la pestaña y, al volver, React arranca de cero. Persistimos en
//     cada cambio, así que para cuando la cámara toma el control el trabajo ya está en disco.
//
//  2. Además enganchamos `visibilitychange`→hidden y `pagehide`, que son el ÚLTIMO instante
//     garantizado antes del descarte. No usamos `beforeunload`: iOS Safari lo ignora y encima
//     rompe el bfcache.
//
//  3. Al restaurar, el técnico SE ENTERA (toast no bloqueante con opción de descartar). Nunca se
//     rellenan campos en silencio: en ventilaciones, una observación que aparece sola en el
//     edificio equivocado se escribe en SharePoint y no se puede deshacer desde la mobile.
//
// Lo que este hook NO hace: sincronizar con SharePoint. El borrador es local y muere cuando el
// registro se guarda bien (o cuando vence).

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  claveBorrador,
  desempaquetar,
  describirAntiguedad,
  empaquetar,
  type BorradorScope,
} from "@/lib/borrador";
import {
  borrarBorrador,
  borrarCampos,
  borrarFoto,
  escribirCampos,
  escribirFoto,
  leerCampos,
  leerFoto,
  podarBorradores,
} from "@/lib/borrador-store";
import { APP_VERSION } from "@/lib/version";
import { useSession } from "@/stores/sessionStore";

/** La poda de vencidos/huérfanos corre UNA vez por sesión de app, no por formulario. */
let podadoEnEstaSesion = false;

export interface OpcionesBorrador<T> {
  /** Formulario. Junto con `id` y el técnico arma la clave (ver claveBorrador). */
  scope: BorradorScope;
  /**
   * ID de LO QUE SE ESTÁ CARGANDO: incidente, ventilación, visita, o "nuevo" para un alta.
   * Si es null/undefined el hook queda INERTE (no lee ni escribe nada). Es la salida correcta
   * para un formulario sin contexto: mejor no persistir que persistir en un bucket compartido.
   */
  id: string | number | null | undefined;
  /** Campos serializables. NUNCA la foto (va aparte, a IndexedDB). */
  valor: T;
  /** Foto capturada (data URL). Se escribe a IndexedDB apenas cambia. */
  foto?: string | null;
  /**
   * ¿Hay algo que valga la pena guardar? Con `false` el borrador se BORRA: así un formulario que
   * el técnico vació a mano no reaparece después.
   */
  sucio: boolean;
  /**
   * ¿El TÉCNICO editó de verdad? Por defecto es `sucio`, que alcanza para los formularios que
   * arrancan vacíos.
   *
   * CONTRATO (no negociable): `tocado` NO puede incluir valores AUTOCOMPLETADOS. Es lo único que
   * mira la guarda anti-pisada de la restauración, y un formulario que se precarga solo (p. ej.
   * la revisión de incidente, que copia máquina y categoría del incidente en el mismo commit del
   * montaje) nacería "tocado" sin que el técnico haya escrito nada: la restauración se abortaría
   * en silencio y —peor— el borrador bueno quedaría pisado por el formulario vacío. Si tu
   * pantalla precarga campos, pasá un `tocado` que los EXCLUYA.
   */
  tocado?: boolean;
  /** `false` mientras el formulario no está en pantalla (diálogo cerrado). No borra el borrador. */
  activo?: boolean;
  /** Restaura el borrador en el estado del formulario. Se llama UNA vez, y solo si estaba limpio. */
  aplicar: (valor: T, foto: string | null) => void;
  /** Vuelve el formulario a vacío. Lo dispara el botón "Descartar" del aviso. */
  descartar: () => void;
  /** Contexto para el aviso ("Torre Belgrano", "Incidente #482"). Ayuda a reconocer qué volvió. */
  descripcion?: string;
}

export interface ControlBorrador {
  /** Borrar el borrador porque el registro SE GUARDÓ BIEN. Llamar en el camino de éxito. */
  limpiar: () => void;
}

function serializar(valor: unknown): string | null {
  try {
    return JSON.stringify(valor ?? null);
  } catch {
    return null; // valor no serializable: no persistimos (mejor eso que romper el formulario)
  }
}

export function useBorrador<T>({
  scope,
  id,
  valor,
  foto = null,
  sucio,
  tocado,
  activo = true,
  aplicar,
  descartar,
  descripcion,
}: OpcionesBorrador<T>): ControlBorrador {
  const usuarioId = useSession((s) => s.user?.ID ?? null);
  const clave = claveBorrador(scope, id, usuarioId);
  const fotoActual = foto ?? null;

  // Refs "al último valor": los efectos de ciclo de vida se registran una sola vez y necesitan
  // leer lo más reciente sin volver a suscribirse en cada tecla que escribe el técnico.
  const valorRef = useRef(valor);
  valorRef.current = valor;
  const fotoRef = useRef(fotoActual);
  fotoRef.current = fotoActual;
  const sucioRef = useRef(sucio);
  sucioRef.current = sucio;
  // Trabajo REAL del técnico (ver el contrato de `tocado`). Por defecto, `sucio`.
  const tocadoRef = useRef(tocado ?? sucio);
  tocadoRef.current = tocado ?? sucio;
  const aplicarRef = useRef(aplicar);
  aplicarRef.current = aplicar;
  const descartarRef = useRef(descartar);
  descartarRef.current = descartar;
  const descripcionRef = useRef(descripcion);
  descripcionRef.current = descripcion;

  // Clave ya restaurada (evita repetir el aviso, también bajo StrictMode).
  const restauradaRef = useRef<string | null>(null);
  // Recién en true se puede escribir: si no, el estado VACÍO del montaje pisaría el borrador.
  // Es ESTADO (no solo ref) a propósito: los efectos de persistencia se gatean con él y un ref no
  // los vuelve a disparar al prenderse. Con un ref solo, una foto sacada mientras se leía
  // IndexedDB quedaba sin persistir hasta el próximo cambio. El ref espejo lo necesita el handler
  // de `pagehide`, que se registra una sola vez y no puede resuscribirse.
  const [listo, setListo] = useState(false);
  const listoRef = useRef(false);
  const marcarListo = useCallback((v: boolean) => {
    listoRef.current = v;
    setListo(v);
  }, []);
  // Claves ya guardadas en SharePoint: no se vuelven a escribir aunque quede un efecto colgado.
  const suprimidasRef = useRef<Set<string>>(new Set());

  // ── Poda de vencidos, huérfanos y de otros técnicos (una vez por sesión) ──────────────────
  useEffect(() => {
    if (podadoEnEstaSesion || usuarioId === null) return;
    podadoEnEstaSesion = true;
    void podarBorradores({ usuarioId });
  }, [usuarioId]);

  // ── Restaurar ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!clave || !activo) return;
    if (restauradaRef.current === clave) return;
    restauradaRef.current = clave;
    marcarListo(false);

    const r = desempaquetar<T>(leerCampos(clave), Date.now());
    if (r.estado !== "ok") {
      // Vencido (TTL) o corrupto → se borra ahora, con su foto. Un borrador de anteayer no sirve.
      if (r.estado === "vencido" || r.estado === "corrupto") borrarBorrador(clave);
      marcarListo(true);
      return;
    }

    const sobre = r.sobre;
    let cancelado = false;
    void (async () => {
      // La foto se lee de IndexedDB (asíncrono); los campos ya los tenemos.
      const fotoGuardada = sobre.tieneFoto ? await leerFoto(clave) : null;
      if (cancelado) return;
      // Si el técnico ya empezó a cargar mientras leíamos la foto, NO le pisamos el trabajo.
      // Se mira `tocado` y NO `sucio`: un campo que el formulario se autocompletó solo (la
      // precarga de máquina/categoría al revisar un incidente corre en el mismo commit del
      // montaje) ensucia el formulario sin ser trabajo del técnico, y abortar por eso descartaba
      // la restauración justo en el caso caro —el que tiene foto, el único que espera a IndexedDB.
      if (tocadoRef.current) {
        marcarListo(true);
        return;
      }
      aplicarRef.current(sobre.valor, fotoGuardada);
      marcarListo(true);

      const detalles = [
        descripcionRef.current,
        `guardado ${describirAntiguedad(Date.now() - sobre.guardadoEn)}`,
        fotoGuardada ? "con foto" : null,
      ].filter(Boolean);
      toast.info("Recuperamos lo que tenías cargado", {
        // `id` estable: si el efecto se repite (StrictMode) reemplaza el aviso, no lo apila.
        id: `borrador:${clave}`,
        description: `${detalles.join(" · ")}. Revisalo antes de confirmar.`,
        duration: 10_000,
        action: {
          label: "Descartar",
          onClick: () => {
            descartarRef.current();
            borrarBorrador(clave);
          },
        },
      });
    })();

    return () => {
      cancelado = true;
      // Bajar el aviso de ESTE borrador al desmontar/cambiar de formulario. Sin esto el toast de
      // la ventilación A sobrevivía a que el técnico cerrara el drawer y abriera la B: el `onClick`
      // captura la `clave` de A por closure, pero `descartarRef.current` ya apunta al descartar de
      // B, así que tocar "Descartar" le vaciaba el formulario de B Y borraba el borrador de A.
      toast.dismiss(`borrador:${clave}`);
      // Liberar la marca. Importa por dos motivos:
      //  • StrictMode (dev) hace montar → limpiar → montar: sin esto la segunda pasada saldría
      //    por el `return` de arriba y el borrador no se restauraría nunca en desarrollo.
      //  • Si el técnico cierra el diálogo con trabajo sin guardar y lo vuelve a abrir, el
      //    borrador se le ofrece de nuevo (con su aviso), en vez de quedar mudo.
      if (restauradaRef.current === clave) restauradaRef.current = null;
    };
  }, [clave, activo, marcarListo]);

  // ── Persistir campos en cada cambio ──────────────────────────────────────────────────────
  // `valorJson` como dependencia (y no `valor`, que es un objeto nuevo en cada render) para
  // escribir solo cuando el CONTENIDO cambió.
  const valorJson = serializar(valor);
  useEffect(() => {
    if (!clave || !activo || !listo) return;
    if (suprimidasRef.current.has(clave)) return;
    if (!sucio || valorJson === null) {
      // Formulario vacío otra vez → el borrador desaparece (no queremos que reaparezca solo).
      if (!sucio) borrarBorrador(clave);
      return;
    }
    escribirCampos(
      clave,
      empaquetar(scope, valor, {
        ahora: Date.now(),
        appVersion: APP_VERSION,
        tieneFoto: fotoActual !== null,
      }),
    );
    // `valor` y `fotoActual` se leen a propósito fuera de deps: el disparador es el CONTENIDO.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, activo, listo, scope, sucio, valorJson, fotoActual]);

  // ── Persistir la foto en IndexedDB APENAS se captura ─────────────────────────────────────
  // No se difiere al flush de `pagehide`: un write asíncrono arrancado durante el descarte de la
  // pestaña puede no llegar a completarse.
  useEffect(() => {
    if (!clave || !activo || !listo) return;
    if (suprimidasRef.current.has(clave) || !sucio) return;
    if (fotoActual) void escribirFoto(clave, fotoActual);
    // Nunca se borra la foto ANTES de que la restauración de esa clave haya terminado: `listo`
    // es justamente ese gate, y arranca en false en cada cambio de clave.
    else void borrarFoto(clave);
  }, [clave, activo, listo, sucio, fotoActual]);

  // ── Volcado en el ciclo de vida de la página ─────────────────────────────────────────────
  // Último instante antes de que el sistema descarte la pestaña (o de que el SW la reemplace).
  // Escritura SÍNCRONA a localStorage: acá no hay tiempo para promesas.
  useEffect(() => {
    if (!clave || !activo) return;
    const volcar = () => {
      if (!listoRef.current || suprimidasRef.current.has(clave)) return;
      if (!sucioRef.current) return;
      const raw = serializar(valorRef.current);
      if (raw === null) return;
      escribirCampos(
        clave,
        empaquetar(scope, valorRef.current, {
          ahora: Date.now(),
          appVersion: APP_VERSION,
          tieneFoto: fotoRef.current !== null,
        }),
      );
    };
    const alOcultarse = () => {
      if (document.visibilityState === "hidden") volcar();
    };
    document.addEventListener("visibilitychange", alOcultarse);
    window.addEventListener("pagehide", volcar);
    return () => {
      document.removeEventListener("visibilitychange", alOcultarse);
      window.removeEventListener("pagehide", volcar);
    };
  }, [clave, activo, scope]);

  /**
   * Se llama después de guardar con éxito. Borra los CAMPOS pero deja la FOTO en IndexedDB.
   *
   * Es deliberado, y es por una asimetría real del backend: la subida de la foto a
   * `12.FotoIncidentes` es best-effort — si falla, el server solo deja un `console.error` y el
   * técnico ve el toast verde igual (hueco declarado en la §6.7 del CLAUDE.md raíz). Borrar la
   * foto local al recibir el 200 destruiría la única copia que queda justo en el escenario en que
   * el backend la perdió en silencio, y el técnico no tiene forma de sacarla de nuevo: ya se fue
   * del edificio.
   *
   * La foto no queda para siempre: se la lleva la poda por TTL (12 h) en la próxima apertura de
   * la app, y sin su sobre en localStorage no se puede restaurar en ningún formulario — el barrido
   * de fotos huérfanas de `podarBorradores` la limpia igual. O sea: cuesta unos KB en IndexedDB
   * durante una jornada, a cambio de poder recuperarla si el server la perdió.
   */
  const limpiar = useCallback(() => {
    if (!clave) return;
    suprimidasRef.current.add(clave);
    borrarCampos(clave);
  }, [clave]);

  return { limpiar };
}
