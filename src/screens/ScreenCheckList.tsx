import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X, Camera, MessageSquare, Save } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { PhotoCapture } from "@/components/shared/PhotoCapture";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { api } from "@/data/api";
import type { ChecklistResponse } from "@/data/types";

type Resp = Record<number, ChecklistResponse>;

export default function ScreenCheckList() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["checklist"],
    queryFn: () => api.listChecklist(),
  });
  const [resp, setResp] = useState<Resp>({});
  const [obsItem, setObsItem] = useState<{ id: number; text: string } | null>(null);
  const [generalObs, setGeneralObs] = useState("");
  const [generalPhoto, setGeneralPhoto] = useState<string | null>(null);

  const total = items.length;
  const respondidos = useMemo(
    () => Object.values(resp).filter((r) => r.Si === "Ok" || r.No === "Ok").length,
    [resp],
  );
  const si = Object.values(resp).filter((r) => r.Si === "Ok").length;
  const no = Object.values(resp).filter((r) => r.No === "Ok").length;
  const progreso = total ? (respondidos / total) * 100 : 0;

  function setSi(id: number) {
    setResp((p) => ({ ...p, [id]: { ID: id, Si: "Ok", No: "", Observacion: p[id]?.Observacion ?? "" } }));
  }
  function startNo(id: number) {
    setObsItem({ id, text: resp[id]?.Observacion ?? "" });
  }
  function confirmNo() {
    if (!obsItem) return;
    if (!obsItem.text.trim()) {
      toast.error("La observación es obligatoria al marcar No");
      return;
    }
    setResp((p) => ({ ...p, [obsItem.id]: { ID: obsItem.id, Si: "", No: "Ok", Observacion: obsItem.text } }));
    setObsItem(null);
  }

  function guardar() {
    if (respondidos < total) {
      toast.error("Faltan ítems por responder", { description: `${total - respondidos} pendientes` });
      return;
    }
    toast.success("Checklist guardado", { description: `${si} OK · ${no} con observación` });
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title="Checklist" subtitle="Inspección de máquinas" />
      <div className="mx-auto w-full max-w-3xl space-y-3 p-4 md:p-6">
        <Card>
          <CardContent className="space-y-2 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progreso</span>
              <span className="text-muted-foreground">
                {respondidos} / {total}
              </span>
            </div>
            <Progress value={progreso} />
            <div className="flex gap-2 pt-1">
              <Badge variant="success">Sí: {si}</Badge>
              <Badge variant="destructive">No: {no}</Badge>
            </div>
          </CardContent>
        </Card>

        {isLoading ? <InlineLoader /> : null}

        <div className="space-y-2">
          {items.map((it) => {
            const r = resp[it.ID];
            return (
              <Card key={it.ID}>
                <CardContent className="space-y-2 py-3">
                  <p className="text-sm font-medium leading-snug">{it.Descripcion}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={r?.Si === "Ok" ? "success" : "outline"}
                      onClick={() => setSi(it.ID)}
                    >
                      <Check className="mr-1 h-4 w-4" /> Sí
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={r?.No === "Ok" ? "destructive" : "outline"}
                      onClick={() => startNo(it.ID)}
                    >
                      <X className="mr-1 h-4 w-4" /> No
                    </Button>
                    {r?.No === "Ok" && r?.Observacion ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => startNo(it.ID)}>
                        <MessageSquare className="mr-1 h-4 w-4" /> Editar obs.
                      </Button>
                    ) : null}
                  </div>
                  {r?.Observacion ? (
                    <p className="rounded-md bg-muted px-2 py-1.5 text-xs italic text-muted-foreground">
                      “{r.Observacion}”
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardContent className="space-y-3 pt-4">
            <p className="text-sm font-medium">Observaciones generales</p>
            <Textarea
              placeholder="Comentarios sobre la visita..."
              value={generalObs}
              onChange={(e) => setGeneralObs(e.target.value)}
              rows={3}
            />
            <PhotoCapture label="Tomar foto general" value={generalPhoto} onChange={setGeneralPhoto} />
          </CardContent>
        </Card>

        <Button size="lg" className="w-full" onClick={guardar}>
          <Save className="mr-2 h-4 w-4" />
          Guardar checklist
        </Button>
      </div>

      <Drawer open={!!obsItem} onOpenChange={(o) => !o && setObsItem(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Observación requerida</DrawerTitle>
            <DrawerDescription>Indicá qué problema observaste</DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <Textarea
              placeholder="Detalle del problema..."
              value={obsItem?.text ?? ""}
              onChange={(e) => setObsItem(obsItem ? { ...obsItem, text: e.target.value } : null)}
              rows={4}
              autoFocus
            />
          </div>
          <DrawerFooter>
            <Button onClick={confirmNo}>
              <Camera className="mr-2 h-4 w-4" />
              Confirmar
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
