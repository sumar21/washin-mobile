// Novedades del edificio (20.Novedades): lo que hoy los técnicos mandan por WhatsApp —tacho roto,
// sticker despegado, cartelería— para que el back-office lo compre y dé el OK.
//
// NO es un incidente: no toca máquinas ni stock. Si el técnico quiere reportar una falla de
// máquina, va por /incidentes.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Paperclip, CheckCircle2, Clock, Ban } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Button } from "@/components/ui/button";
import { DataTable, CellTitleSubtitle } from "@/components/shared/DataTable";
import { Pill } from "@/components/shared/Pill";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { DialogNuevaNovedad } from "@/components/novedades/DialogNuevaNovedad";
import { getNovedades, type Novedad } from "@/lib/api-client";

const tonoEstado = (e: string) =>
  e === "Resuelto" ? "success" : e === "Anulado" ? "neutral" : "warning";

const iconoEstado = (e: string) =>
  e === "Resuelto" ? CheckCircle2 : e === "Anulado" ? Ban : Clock;

export default function ScreenNovedades() {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);

  const { data: novedades = [], isLoading } = useQuery({
    queryKey: ["novedades"],
    queryFn: getNovedades,
  });

  const pendientes = novedades.filter((n) => n.estado === "Pendiente").length;
  const subtitulo = `${novedades.length} ${novedades.length === 1 ? "novedad" : "novedades"}${
    pendientes ? ` · ${pendientes} pendiente${pendientes === 1 ? "" : "s"}` : ""
  }`;

  const botonNueva = (
    <Button onClick={() => setAbierto(true)} className="h-10 md:h-9">
      <Plus />
      Nueva novedad
    </Button>
  );

  const vacio = (
    <EmptyState
      icon={Megaphone}
      title="Todavía no cargaste novedades"
      description="Reportá lo que veas en el edificio: un tacho roto, un sticker despegado, cartelería."
      action={botonNueva}
    />
  );

  return (
    <div className="flex h-full w-full flex-col">
      <ScreenHeader
        className="md:hidden"
        back="/home"
        title="Novedades"
        subtitle={subtitulo}
      />
      <ModuleHeader title="Novedades" subtitle={subtitulo}>
        {botonNueva}
      </ModuleHeader>

      <div className="mx-auto w-full max-w-[1600px] flex-1 overflow-y-auto px-4 pb-24 pt-3 md:px-6">
        {/* En mobile el botón va arriba del listado: el header mobile es compacto y no lo lleva. */}
        {novedades.length > 0 && (
          <div className="mb-3 md:hidden">{botonNueva}</div>
        )}

        {isLoading ? (
          <InlineLoader />
        ) : novedades.length === 0 ? (
          vacio
        ) : (
          <>
            {/* MOBILE: cards apiladas */}
            <div className="flex flex-col gap-2 md:hidden">
              {novedades.map((n) => (
                <CardNovedad key={n.id} n={n} />
              ))}
            </div>

            {/* DESKTOP: tabla */}
            <DataTable
              className="hidden md:block"
              data={novedades}
              getRowKey={(n: Novedad) => n.id}
              columns={[
                {
                  key: "edificio",
                  header: "Edificio",
                  primary: true,
                  sortable: true,
                  sortAccessor: (n: Novedad) => n.edificio,
                  cell: (n: Novedad) => (
                    <CellTitleSubtitle
                      title={n.edificio || n.codigoEdificio}
                      subtitle={n.descripcion}
                    />
                  ),
                },
                {
                  key: "evidencia",
                  header: "Evidencia",
                  align: "center",
                  cell: (n: Novedad) =>
                    n.cantidadEvidencia > 0 ? (
                      <Pill tone="neutral">
                        <Paperclip className="h-3 w-3" /> {n.cantidadEvidencia}
                      </Pill>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ),
                },
                {
                  key: "fecha",
                  header: "Fecha",
                  sortable: true,
                  sortAccessor: (n: Novedad) => n.id,
                  cell: (n: Novedad) => `${n.fecha} ${n.hora}`,
                },
                {
                  key: "estado",
                  header: "Estado",
                  sortable: true,
                  sortAccessor: (n: Novedad) => n.estado,
                  cell: (n: Novedad) => (
                    <Pill tone={tonoEstado(n.estado)}>{n.estado}</Pill>
                  ),
                },
              ]}
            />
          </>
        )}
      </div>

      <DialogNuevaNovedad
        open={abierto}
        onOpenChange={setAbierto}
        onListo={() => void qc.invalidateQueries({ queryKey: ["novedades"] })}
      />
    </div>
  );
}

function CardNovedad({ n }: { n: Novedad }) {
  const Icono = iconoEstado(n.estado);
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {n.edificio || n.codigoEdificio}
          </p>
          <p className="text-xs text-muted-foreground">
            {n.fecha} · {n.hora}
          </p>
        </div>
        <Pill tone={tonoEstado(n.estado)}>
          <Icono className="h-3 w-3" />
          {n.estado}
        </Pill>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-[13.5px] leading-snug">
        {n.descripcion}
      </p>
      {n.cantidadEvidencia > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <Pill tone="neutral">
            <Paperclip className="h-3 w-3" /> {n.cantidadEvidencia}
          </Pill>
        </div>
      )}
      {/* La respuesta del back-office: es lo que el técnico vuelve a mirar. */}
      {n.descripcionResuelto && (
        <p className="mt-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
          <span className="font-semibold">Respuesta:</span> {n.descripcionResuelto}
        </p>
      )}
    </div>
  );
}
