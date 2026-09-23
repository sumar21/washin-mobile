// Modal con los datos de contacto del edificio (código, nombre, dirección, supervisor, horario,
// celular, correo y observaciones). Paridad PowerApps: al tocar el edificio subrayado se abría este
// popup (Screen_Incidentes). Vive acá porque lo usan Incidentes y Ventilaciones: el técnico necesita
// los mismos datos para golpear la puerta, sea por un reclamo o por una limpieza de ventilaciones.
//
// Los datos salen de ABM.Edificios (getEdificios, solo ALTA). Si el edificio no está en el catálogo,
// se muestra igual el encabezado con lo que traiga el registro (nombre y código) y el aviso de que
// no hay datos de contacto.
import * as React from "react";
import {
  Building2,
  Clock,
  FileText,
  Hash,
  Mail,
  MapPin,
  Phone,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import type { Edificio } from "@/lib/api-client";

export function EdificioDialog({
  open,
  edificio,
  nombre: nombreFallback,
  codigo: codigoFallback,
  onClose,
}: {
  open: boolean;
  edificio?: Edificio;
  /** Nombre y código del propio registro: se usan si el edificio no está en el catálogo. */
  nombre?: string;
  codigo?: string;
  onClose: () => void;
}) {
  const codigo = edificio?.Codigo || codigoFallback || "";
  const nombre = edificio?.Edificio || nombreFallback || "";
  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent
        className="overflow-hidden p-0"
        desktopClassName="max-w-md rounded-3xl sm:rounded-3xl"
        mobileClassName="rounded-t-3xl"
      >
        {/* Hero. pr extra en desktop para no chocar con la X del Dialog. */}
        <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4 md:pr-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/20 dark:text-cyan-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <ResponsiveDialogTitle className="text-base font-semibold leading-tight">
                {nombre || "Edificio"}
              </ResponsiveDialogTitle>
              {codigo ? (
                <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-muted-foreground">
                  <Hash className="h-3 w-3" />
                  {codigo}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 px-5 py-4">
          {edificio ? (
            <>
              <EdificioRow icon={MapPin} label="Dirección" value={edificio.Direccion} />
              <EdificioRow icon={UserCog} label="Supervisor" value={edificio.Encargado} />
              <EdificioRow icon={Clock} label="Horario" value={edificio.HoraVisita} />
              <EdificioRow icon={Phone} label="Celular" value={edificio.Celular} />
              <EdificioRow icon={Mail} label="Correo" value={edificio.Correo} />
              <EdificioRow
                icon={FileText}
                label="Observaciones"
                value={edificio.Observaciones}
              />
            </>
          ) : (
            <p className="rounded-lg border border-dashed bg-card/50 p-3 text-center text-xs text-muted-foreground">
              Sin datos de contacto para este edificio.
            </p>
          )}
        </div>

        <ResponsiveDialogFooter className="border-t bg-background px-5 py-3 sm:justify-end">
          <ResponsiveDialogClose asChild>
            <Button variant="outline" className="h-10 w-full sm:w-auto">
              Cerrar
            </Button>
          </ResponsiveDialogClose>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function EdificioRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm text-foreground/90">{value?.trim() || "—"}</p>
      </div>
    </div>
  );
}

/** Nombre del edificio como link: abre el modal. Mismo gesto en Incidentes y en Ventilaciones. */
export function EdificioLink({
  nombre,
  onClick,
  className = "",
}: {
  nombre: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`rounded-sm text-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${className}`}
    >
      {nombre}
    </button>
  );
}
