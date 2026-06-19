// /api/planificaciones — módulo Visitas por rutas/circuitos.
//   GET ?circuitos        -> { circuitos: [...] }     (16.DetallePlanificaciones del técnico, mes actual)
//   GET ?edificios        -> { edificios: [...] }     (18.EdificiosVisitar + estado derivado de 01.Registros)
//   GET ?checklist        -> { items: [...] }         (ABM.Checklist)
//   GET ?detalle=<IDUnico>-> { registro }             (01.Registros + sus ítems 02.Detalles; scope técnico)
//   POST action:"iniciar"   -> { idUnico, hora, fecha }   (crea 01.Registros)
//   POST action:"cancelar"  -> { ok: true }
//   POST action:"finalizar" -> { ok: true }           (guardado del checklist: 01.Registros + 02.Detalles)
import {
  listCircuitos,
  listEdificiosAVisitar,
  listChecklistItems,
  visitaEnCurso,
  iniciarVisita,
  cancelarVisita,
  finalizarVisita,
  getRegistroDetalle,
  mesAnoActual,
  type IniciarVisitaInput,
  type ItemResuelto,
} from "./_lib/planificaciones.js";
import {
  getAuth,
  readJsonBody,
  send,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/http.js";

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const auth = getAuth(req);
  if (!auth) {
    send(res, 401, { error: "No autorizado" });
    return;
  }
  try {
    if (req.method === "GET") {
      const sp = new URL(req.url ?? "", "http://localhost").searchParams;
      const mesAno = sp.get("mesAno") || mesAnoActual();
      if (sp.has("checklist")) {
        send(res, 200, { items: await listChecklistItems() });
        return;
      }
      if (sp.has("detalle")) {
        const idUnico = (sp.get("detalle") ?? "").trim();
        if (!idUnico) {
          send(res, 400, { error: "Falta el IDUnico del registro" });
          return;
        }
        const registro = await getRegistroDetalle(idUnico, {
          rol: auth.rol,
          usuario: auth.usuario,
        });
        if (!registro) {
          send(res, 404, { error: "Registro no encontrado" });
          return;
        }
        send(res, 200, { registro });
        return;
      }
      if (sp.has("edificios")) {
        send(res, 200, {
          edificios: await listEdificiosAVisitar(
            auth.nombre,
            auth.usuario,
            mesAno,
          ),
        });
        return;
      }
      if (sp.has("enCurso")) {
        send(res, 200, {
          visita: await visitaEnCurso(auth.usuario, mesAno),
        });
        return;
      }
      // default / ?circuitos
      send(res, 200, { circuitos: await listCircuitos(auth.nombre, mesAno) });
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody<{
        action?: string;
        // iniciar
        codigo?: string;
        edificio?: string;
        direccion?: string;
        idUnivocoCircuito?: string;
        idUnivocoRuta?: string;
        nroCircuito?: string;
        nroRuta?: string;
        horaSugerida?: string;
        observacion?: string;
        // cancelar
        mesAno?: string;
        motivo?: string;
        // finalizar
        idUnico?: string;
        items?: ItemResuelto[];
        okCount?: number;
        noCount?: number;
        horaInicio?: string;
        horaFinal?: string;
        observacionGeneral?: string;
        fotoGeneral?: string;
      }>(req);

      if (body.action === "iniciar") {
        if (!body.codigo) {
          send(res, 400, { error: "Falta el código de edificio" });
          return;
        }
        const input: IniciarVisitaInput = {
          codigo: body.codigo,
          edificio: body.edificio ?? "",
          direccion: body.direccion ?? "",
          idUnivocoCircuito: body.idUnivocoCircuito ?? "",
          idUnivocoRuta: body.idUnivocoRuta ?? "",
          nroCircuito: body.nroCircuito ?? "",
          nroRuta: body.nroRuta ?? "",
          horaSugerida: body.horaSugerida,
          observacion: body.observacion,
        };
        const result = await iniciarVisita(input, {
          nombre: auth.nombre,
          usuario: auth.usuario,
        });
        send(res, 200, result);
        return;
      }

      if (body.action === "cancelar") {
        if (!body.codigo || !body.motivo) {
          send(res, 400, { error: "Falta el código o el motivo" });
          return;
        }
        await cancelarVisita(
          {
            codigo: body.codigo,
            mesAno: body.mesAno || mesAnoActual(),
            motivo: body.motivo,
            observacion: body.observacion,
          },
          { nombre: auth.nombre, usuario: auth.usuario },
          body.edificio
            ? { edificio: body.edificio, direccion: body.direccion ?? "" }
            : undefined,
        );
        send(res, 200, { ok: true });
        return;
      }

      if (body.action === "finalizar") {
        if (!body.idUnico) {
          send(res, 400, { error: "Falta el idUnico de la visita" });
          return;
        }
        await finalizarVisita({
          idUnico: body.idUnico,
          items: body.items ?? [],
          okCount: body.okCount ?? 0,
          noCount: body.noCount ?? 0,
          horaInicio: body.horaInicio,
          horaFinal: body.horaFinal,
          observacionGeneral: body.observacionGeneral,
          fotoGeneral: body.fotoGeneral,
        });
        send(res, 200, { ok: true });
        return;
      }

      send(res, 400, {
        error: 'action inválida (usar "iniciar", "cancelar" o "finalizar")',
      });
      return;
    }

    send(res, 405, { error: "Método no permitido" });
  } catch (err) {
    console.error(
      "[planificaciones] error:",
      err instanceof Error ? err.message : err,
    );
    send(res, 502, { error: "Error con las planificaciones" });
  }
}
