// Novedades del edificio (20.Novedades): lo que hoy los técnicos mandan por WhatsApp —tacho roto,
// sticker despegado, cartelería— para que el back-office lo compre y dé el OK.
//
// NO es un incidente: no toca máquinas ni stock. Si el técnico quiere reportar una falla de
// máquina, va por /incidentes.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Paperclip } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Button } from "@/components/ui/button";
import { DataTable, CellTitleSubtitle } from "@/components/shared/DataTable";
import { Pill } from "@/components/shared/Pill";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { DialogNuevaNovedad } from "@/components/novedades/DialogNuevaNovedad";
import { DialogDetalleNovedad } from "@/components/novedades/DialogDetalleNovedad";
import { getNovedades, type Novedad } from "@/lib/api-client";

export default function ScreenNovedades() {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [viendo, setViendo] = useState<Novedad | null>(null);

  const { data: novedades = [], isLoading } = useQuery({
    queryKey: ["novedades"],
    queryFn: getNovedades,
    // El QueryClient global cachea 60 s (main.tsx), pero acá la lista la cambia OTRA app: cuando
    // el back-office da el OK, la novedad tiene que desaparecer de la vista del técnico. Con el
    // caché por defecto seguía figurando al reentrar, y en mobile no hay botón de refrescar para
    // forzarlo. Se refresca en cada entrada al módulo.
    staleTime: 0,
    refetchOnMount: "always",
  });

  // El endpoint sólo devuelve las PROPIAS y PENDIENTES, así que el contador ya es "lo abierto".
  const subtitulo = `${novedades.length} ${novedades.length === 1 ? "novedad abierta" : "novedades abiertas"}`;

  // Mismo patrón que ScreenIncidentes: va en el header, primario, y el label recién aparece
  // en lg — en el celular es el "+" solo.
  const botonNueva = (
    <Button
      type="button"
      onClick={() => setAbierto(true)}
      aria-label="Nueva novedad"
      className="h-10 gap-1.5 rounded-xl px-3"
    >
      <Plus />
      <span className="hidden lg:inline">Novedad</span>
    </Button>
  );

  // Sin botón acá: el "+" del header ya está a la vista y repetirlo es ruido.
  const vacio = (
    <EmptyState
      icon={Megaphone}
      title="No tenés novedades abiertas"
      description="Reportá lo que veas en el edificio: un tacho roto, un sticker despegado, cartelería."
    />
  );

  return (
    <div className="flex h-full w-full flex-col">
      <ScreenHeader
        className="md:hidden"
        back="/home"
        title="Novedades"
        subtitle={subtitulo}
        action={botonNueva}
      />
      <ModuleHeader title="Novedades" subtitle={subtitulo}>
        {botonNueva}
      </ModuleHeader>

      <div className="mx-auto w-full max-w-[1600px] flex-1 overflow-y-auto px-4 pb-24 pt-3 md:px-6">
        {isLoading ? (
          <InlineLoader />
        ) : novedades.length === 0 ? (
          vacio
        ) : (
          <>
            {/* MOBILE: cards apiladas */}
            <div className="flex flex-col gap-2 md:hidden">
              {novedades.map((n) => (
                <CardNovedad key={n.id} n={n} onVer={() => setViendo(n)} />
              ))}
            </div>

            {/* DESKTOP: tabla */}
            <DataTable
              className="hidden md:block"
              data={novedades}
              getRowKey={(n: Novedad) => n.id}
              onRowClick={(n: Novedad) => setViendo(n)}
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
              ]}
            />
          </>
        )}
      </div>

      <DialogDetalleNovedad
        novedad={viendo}
        onClose={() => setViendo(null)}
      />

      <DialogNuevaNovedad
        open={abierto}
        onOpenChange={setAbierto}
        onListo={() => void qc.invalidateQueries({ queryKey: ["novedades"] })}
      />
    </div>
  );
}

function CardNovedad({ n, onVer }: { n: Novedad; onVer: () => void }) {
  return (
    <button
      type="button"
      onClick={onVer}
      className="w-full rounded-xl border bg-card p-3 text-left shadow-sm active:scale-[0.99]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {n.edificio || n.codigoEdificio}
          </p>
          <p className="text-xs text-muted-foreground">
            {n.fecha} · {n.hora}
          </p>
        </div>
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
    </button>
  );
}
