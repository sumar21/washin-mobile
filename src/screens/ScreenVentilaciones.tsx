import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wind, Calendar, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PhotoCapture } from "@/components/shared/PhotoCapture";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { useSession } from "@/stores/sessionStore";
import { api } from "@/data/api";
import type { Ventilacion } from "@/data/types";

export default function ScreenVentilaciones() {
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: ventilaciones = [], isLoading } = useQuery({
    queryKey: ["ventilaciones"],
    queryFn: () => api.listVentilaciones(),
  });

  const myVent = ventilaciones.filter((v) => (user?.Rol === "Tecnico" ? v.IDAsignado_VE === user.ID : true));

  const [programar, setProgramar] = useState<Ventilacion | null>(null);
  const [finalizar, setFinalizar] = useState<Ventilacion | null>(null);
  const [fechaProg, setFechaProg] = useState("");
  const [obsFin, setObsFin] = useState("");
  const [foto, setFoto] = useState<string | null>(null);

  async function confirmProgramar() {
    if (!programar || !fechaProg) {
      toast.error("Seleccioná una fecha");
      return;
    }
    await api.patchVentilacion(programar.ID, {
      Estado_VE: "Programada",
      FechaProgramada_VE: fechaProg,
      Orden_VE: "2",
    });
    setProgramar(null);
    setFechaProg("");
    qc.invalidateQueries({ queryKey: ["ventilaciones"] });
    toast.success("Ventilación programada");
  }

  async function confirmFinalizar() {
    if (!finalizar) return;
    if (!obsFin.trim()) {
      toast.error("Agregá una observación");
      return;
    }
    await api.patchVentilacion(finalizar.ID, {
      Estado_VE: "Realizada",
      ObservacionResuelto_VE: obsFin,
      FechaFinalizacion_VE: new Date().toLocaleDateString("es-AR"),
      Orden_VE: "1",
      Foto: foto ?? undefined,
    });
    await api.runFlow("WashInn-FotoVentilacion", { id: finalizar.ID, foto });
    setFinalizar(null);
    setObsFin("");
    setFoto(null);
    qc.invalidateQueries({ queryKey: ["ventilaciones"] });
    toast.success("Ventilación finalizada");
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title="Ventilaciones" subtitle="Mantenimiento de aires y conductos" />

      <div className="space-y-3 p-4">
        {isLoading ? <InlineLoader /> : null}

        {!isLoading && myVent.length === 0 ? (
          <EmptyState icon={Wind} title="Sin ventilaciones" description="No tenés ventilaciones asignadas." />
        ) : null}

        {myVent.map((v) => (
          <Card key={v.ID}>
            <CardContent className="space-y-2 pt-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{v.Edificio_VE}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.Grupo_VE} · {v.Frecuencia_VE}
                  </p>
                </div>
                <StatusBadge status={v.Estado_VE} />
              </div>
              {v.FechaProgramada_VE ? (
                <p className="text-xs text-muted-foreground">
                  Programada: <strong>{v.FechaProgramada_VE}</strong>
                </p>
              ) : null}
              {v.ObservacionResuelto_VE ? (
                <p className="rounded-md bg-muted px-2 py-1.5 text-xs italic text-muted-foreground">
                  “{v.ObservacionResuelto_VE}”
                </p>
              ) : null}
              {v.Estado_VE !== "Realizada" ? (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setProgramar(v)}>
                    <Calendar className="mr-1 h-4 w-4" /> Programar
                  </Button>
                  <Button size="sm" onClick={() => setFinalizar(v)}>
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Finalizar
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Drawer open={!!programar} onOpenChange={(o) => !o && setProgramar(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Programar visita</DrawerTitle>
            <DrawerDescription>{programar?.Edificio_VE}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <Label htmlFor="fecha-prog">Fecha programada</Label>
            <Input
              id="fecha-prog"
              type="date"
              value={fechaProg}
              onChange={(e) => setFechaProg(e.target.value)}
              className="mt-1"
            />
          </div>
          <DrawerFooter>
            <Button onClick={confirmProgramar}>Confirmar</Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={!!finalizar} onOpenChange={(o) => !o && setFinalizar(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Finalizar ventilación</DrawerTitle>
            <DrawerDescription>{finalizar?.Edificio_VE}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-2">
            <div>
              <Label htmlFor="obs-fin">Observación</Label>
              <Textarea
                id="obs-fin"
                value={obsFin}
                onChange={(e) => setObsFin(e.target.value)}
                placeholder="Detalle del trabajo realizado..."
                rows={3}
                className="mt-1"
              />
            </div>
            <PhotoCapture label="Foto de la ventilación" value={foto} onChange={setFoto} />
          </div>
          <DrawerFooter>
            <Button onClick={confirmFinalizar}>Finalizar</Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
