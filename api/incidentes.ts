// /api/incidentes — módulo Incidentes (10.Incidentes). Ver docs/powerapps/incidentes.md.
//   GET ?resuelto=NO|SI            -> { incidentes: [...] }  (NO = activos; scopeado por técnico)
//   POST { action:"crear", ... }   -> { id }                (alta de incidente)
//   POST { action:"anular", id, motivo } -> { ok: true }
import {
  listIncidentes,
  getIncidente,
  crearIncidente,
  crearIncidenteCompleto,
  anularIncidente,
  resolverIncidente,
  listStockTecnico,
  listRepuestosCatalogo,
  type ResolverModo,
  type RepuestoUsado,
} from "./_lib/incidentes.js";
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
      // Sub-recursos para el flujo de resolución.
      if (sp.has("stockTecnico")) {
        const stock = await listStockTecnico(auth.nombre);
        send(res, 200, { stock });
        return;
      }
      if (sp.has("catalogoRepuestos")) {
        const repuestos = await listRepuestosCatalogo();
        send(res, 200, { repuestos });
        return;
      }
      if (sp.has("id")) {
        const id = Number(sp.get("id"));
        if (!Number.isFinite(id) || id <= 0) {
          send(res, 400, { error: "id inválido" });
          return;
        }
        const incidente = await getIncidente(id, {
          rol: auth.rol,
          usuario: auth.usuario,
          nombre: auth.nombre,
        });
        if (!incidente) {
          send(res, 404, { error: "Incidente no encontrado" });
          return;
        }
        send(res, 200, { incidente });
        return;
      }
      const resuelto = sp.get("resuelto") === "SI" ? "SI" : "NO";
      // ?mes=mm/yyyy[,mm/yyyy] limita por mes-año (Cerrados trae solo el mes pedido, no todo).
      const mesParam = sp.get("mes");
      const meses = mesParam
        ? mesParam
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
      const incidentes = await listIncidentes({
        rol: auth.rol,
        usuario: auth.usuario,
        nombre: auth.nombre,
        resuelto,
        meses,
      });
      send(res, 200, { incidentes });
      return;
    }
    if (req.method === "POST") {
      const body = await readJsonBody<{
        action?: string;
        id?: number | string;
        motivo?: string;
        IDMaquina_IN?: string;
        ConcatMaquina_IN?: string;
        CodigoEdifcio_IN?: string;
        NombreEdificio_IN?: string;
        TecnicoAsignado_IN?: string;
        Descripcion?: string;
        Categoria?: string;
        // resolver / crearCompleto
        modo?: ResolverModo;
        maquinaAsignada?: string;
        repuestos?: RepuestoUsado[];
        categoria?: string;
        fotoBase64?: string;
        // resolver (Continuar)
        concatMaquina?: string;
        idMaquina?: string;
        nombreEdificio?: string;
        notificar?: boolean;
      }>(req);
      if (body.action === "crear") {
        if (!body.Descripcion?.trim()) {
          send(res, 400, { error: "Falta la descripción" });
          return;
        }
        const { id } = await crearIncidente(
          {
            IDMaquina_IN: body.IDMaquina_IN ?? "",
            ConcatMaquina_IN: body.ConcatMaquina_IN ?? "",
            CodigoEdifcio_IN: body.CodigoEdifcio_IN ?? "",
            NombreEdificio_IN: body.NombreEdificio_IN ?? "",
            TecnicoAsignado_IN: body.TecnicoAsignado_IN ?? "",
            Descripcion: body.Descripcion,
            Categoria: body.Categoria,
          },
          { usuario: auth.usuario },
        );
        send(res, 200, { id });
        return;
      }
      if (body.action === "anular") {
        const id = Number(body.id);
        if (!Number.isFinite(id) || id <= 0) {
          send(res, 400, { error: "id inválido" });
          return;
        }
        if (!body.motivo?.trim()) {
          send(res, 400, { error: "Falta el motivo de anulación" });
          return;
        }
        await anularIncidente(id, body.motivo);
        send(res, 200, { ok: true });
        return;
      }
      if (body.action === "resolver") {
        const id = Number(body.id);
        if (!Number.isFinite(id) || id <= 0) {
          send(res, 400, { error: "id inválido" });
          return;
        }
        const MODOS: ResolverModo[] = [
          "Cambio Repuesto",
          "Resuelto Sin Repuesto",
          "Requiere Repuesto",
          "Cambio de Maquina",
        ];
        if (!body.modo || !MODOS.includes(body.modo)) {
          send(res, 400, { error: "modo de resolución inválido" });
          return;
        }
        if (
          (body.modo === "Cambio Repuesto" ||
            body.modo === "Requiere Repuesto") &&
          !(body.repuestos && body.repuestos.length)
        ) {
          send(res, 400, { error: "Falta al menos un repuesto" });
          return;
        }
        const result = await resolverIncidente(
          {
            id,
            modo: body.modo,
            descripcion: body.Descripcion ?? "",
            categoria: body.Categoria ?? body.categoria,
            maquinaAsignada: body.maquinaAsignada,
            repuestos: body.repuestos,
            concatMaquina: body.concatMaquina,
            idMaquina: body.idMaquina,
            nombreEdificio: body.nombreEdificio,
            fotoBase64: body.fotoBase64,
            notificar: body.notificar,
          },
          { nombre: auth.nombre },
        );
        send(res, 200, result);
        return;
      }
      if (body.action === "crearCompleto") {
        if (!body.categoria?.trim()) {
          send(res, 400, { error: "Falta la categoría" });
          return;
        }
        const MODOS: ResolverModo[] = [
          "Cambio Repuesto",
          "Resuelto Sin Repuesto",
          "Requiere Repuesto",
          "Cambio de Maquina",
        ];
        if (!body.modo || !MODOS.includes(body.modo)) {
          send(res, 400, { error: "Acción inválida" });
          return;
        }
        if (
          (body.modo === "Cambio Repuesto" ||
            body.modo === "Requiere Repuesto") &&
          !(body.repuestos && body.repuestos.length)
        ) {
          send(res, 400, { error: "Falta al menos un repuesto" });
          return;
        }
        const result = await crearIncidenteCompleto(
          {
            IDMaquina_IN: body.IDMaquina_IN ?? "",
            ConcatMaquina_IN: body.ConcatMaquina_IN ?? "",
            CodigoEdifcio_IN: body.CodigoEdifcio_IN ?? "",
            NombreEdificio_IN: body.NombreEdificio_IN ?? "",
            categoria: body.categoria,
            modo: body.modo,
            descripcion: body.Descripcion ?? "",
            repuestos: body.repuestos,
            fotoBase64: body.fotoBase64,
          },
          { usuario: auth.usuario, nombre: auth.nombre },
        );
        send(res, 200, result);
        return;
      }
      send(res, 400, {
        error:
          'action inválida (usar "crear", "crearCompleto", "anular" o "resolver")',
      });
      return;
    }
    send(res, 405, { error: "Método no permitido" });
  } catch (err) {
    console.error(
      "[incidentes] error:",
      err instanceof Error ? err.message : err,
    );
    send(res, 502, { error: "Error con los incidentes" });
  }
}
