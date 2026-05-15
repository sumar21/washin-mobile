import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, Wrench, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { HamburgerMenu } from "@/components/layout/HamburgerMenu";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PhotoCapture } from "@/components/shared/PhotoCapture";
import { SearchBar } from "@/components/shared/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { useSession } from "@/stores/sessionStore";
import { api } from "@/data/api";
import type { Incidente } from "@/data/types";

export default function ScreenIncidentes() {
  const qc = useQueryClient();
  const { user } = useSession();
  const [tab, setTab] = useState<"abiertos" | "cerrados">("abiertos");
  const [q, setQ] = useState("");
  const [crear, setCrear] = useState(false);
  const [anular, setAnular] = useState<Incidente | null>(null);
  const [obsAnular, setObsAnular] = useState("");

  const { data: incidentes = [], isLoading } = useQuery({
    queryKey: ["incidentes"],
    queryFn: () => api.listIncidentes(),
  });
  const { data: edificios = [] } = useQuery({ queryKey: ["edificios"], queryFn: () => api.listEdificios() });
  const { data: maquinas = [] } = useQuery({ queryKey: ["detalle-maquina"], queryFn: () => api.listDetalleMaquina() });
  const { data: usuarios = [] } = useQuery({ queryKey: ["usuarios"], queryFn: () => api.listUsuarios() });

  const myName = user?.Concat_Nombre_Apellido;
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return incidentes
      .filter((i) => (user?.Rol === "Tecnico" ? i.TecnicoAsignado_IN === myName : true))
      .filter((i) =>
        tab === "abiertos" ? !["Resuelto", "Anulado"].includes(i.Status_IN) : ["Resuelto", "Anulado"].includes(i.Status_IN),
      )
      .filter(
        (i) =>
          !t ||
          i.NombreEdificio_IN.toLowerCase().includes(t) ||
          i.ConcatMaquina_IN.toLowerCase().includes(t) ||
          i.Descripcion_IN.toLowerCase().includes(t),
      )
      .sort((a, b) => b.IDIncidente - a.IDIncidente);
  }, [incidentes, q, tab, user, myName]);

  // formulario crear
  const [edif, setEdif] = useState<string>("");
  const [maq, setMaq] = useState<string>("");
  const [tec, setTec] = useState<string>(myName ?? "");
  const [desc, setDesc] = useState<string>("");
  const [foto, setFoto] = useState<string | null>(null);

  async function onCrear() {
    if (!edif || !maq || !desc.trim()) {
      toast.error("Faltan campos", { description: "Edificio, máquina y descripción son obligatorios" });
      return;
    }
    const m = maquinas.find((x) => x.IDMaquina_DM === maq);
    const e = edificios.find((x) => x.Codigo === edif);
    await api.createIncidente({
      IDMaquina_IN: maq,
      ConcatMaquina_IN: m?.ConcatMaquina_DM ?? maq,
      CodigoEdifcio_IN: edif,
      NombreEdificio_IN: e?.Edificio ?? "",
      TecnicoAsignado_IN: tec,
      Descripcion_IN: desc,
      Fecha_IN: new Date().toLocaleDateString("es-AR"),
      Status_IN: "Pendiente",
      Resuelto_IN: "NO",
      RequiereRepuesto_IN: "NO",
      Foto: foto ?? undefined,
    });
    setCrear(false);
    setEdif("");
    setMaq("");
    setDesc("");
    setFoto(null);
    qc.invalidateQueries({ queryKey: ["incidentes"] });
    toast.success("Incidente creado");
  }

  async function onAnular() {
    if (!anular) return;
    if (!obsAnular.trim()) {
      toast.error("Indicá el motivo de anulación");
      return;
    }
    await api.patchIncidente(anular.ID, {
      Status_IN: "Anulado",
      Resuelto_IN: "SI",
      DescripcionAnulado_IN: obsAnular,
    });
    await api.sendEmail({
      to: "paul.risau@wash-innsystem.com.ar",
      subject: `Incidente N: ${anular.IDIncidente} Anulado`,
      html: `<p>El incidente <b>${anular.IDIncidente}</b> fue anulado.</p><p>Motivo: ${obsAnular}</p>`,
    });
    setAnular(null);
    setObsAnular("");
    qc.invalidateQueries({ queryKey: ["incidentes"] });
    toast.success("Incidente anulado", { description: "Se envió la notificación" });
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader
        title="Incidentes"
        back={false}
        action={
          <>
            <Button variant="ghost" size="icon" onClick={() => setCrear(true)} aria-label="Nuevo incidente">
              <Plus className="h-5 w-5" />
            </Button>
            <HamburgerMenu />
          </>
        }
      />

      <div className="space-y-3 p-4">
        <SearchBar value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por edificio, máquina..." />

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="abiertos">Abiertos</TabsTrigger>
            <TabsTrigger value="cerrados">Cerrados</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-3 space-y-2">
            {isLoading ? <InlineLoader /> : null}
            {!isLoading && filtered.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="Sin incidentes" />
            ) : null}
            {filtered.map((i) => (
              <Card key={i.ID}>
                <CardContent className="space-y-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        #{i.IDIncidente} · {i.ConcatMaquina_IN}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{i.NombreEdificio_IN}</p>
                    </div>
                    <StatusBadge status={i.Status_IN} />
                  </div>
                  <p className="text-sm">{i.Descripcion_IN}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {i.Fecha_IN} · {i.TecnicoAsignado_IN}
                  </p>
                  {i.Status_IN !== "Anulado" && i.Status_IN !== "Resuelto" ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => toast.info("Ver repuestos (mock)")}>
                        <Wrench className="mr-1 h-4 w-4" /> Repuestos
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toast.info("Notificar (mock)")}>
                        <Mail className="mr-1 h-4 w-4" /> Notificar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setAnular(i)}>
                        <Trash2 className="mr-1 h-4 w-4" /> Anular
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <Drawer open={crear} onOpenChange={setCrear}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Nuevo incidente</DrawerTitle>
            <DrawerDescription>Registrar problema en una máquina</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 overflow-y-auto px-4 pb-2">
            <div>
              <Label>Edificio</Label>
              <Select value={edif} onValueChange={setEdif}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar edificio" />
                </SelectTrigger>
                <SelectContent>
                  {edificios
                    .filter((e) => e.Status === "ALTA")
                    .map((e) => (
                      <SelectItem key={e.ID} value={e.Codigo}>
                        {e.Edificio}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Máquina</Label>
              <Select value={maq} onValueChange={setMaq} disabled={!edif}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={edif ? "Seleccionar máquina" : "Elegí un edificio primero"} />
                </SelectTrigger>
                <SelectContent>
                  {maquinas
                    .filter((m) => m.CodigoEdificio_DM === edif)
                    .map((m) => (
                      <SelectItem key={m.ID} value={m.IDMaquina_DM}>
                        {m.ConcatMaquina_DM}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Técnico asignado</Label>
              <Select value={tec} onValueChange={setTec}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar técnico" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios
                    .filter((u) => u.Rol === "Tecnico" && u.Status === "ALTA")
                    .map((u) => (
                      <SelectItem key={u.ID} value={u.Concat_Nombre_Apellido}>
                        {u.Concat_Nombre_Apellido}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                placeholder="Detalle del problema..."
                className="mt-1"
              />
            </div>
            <PhotoCapture label="Foto del incidente" value={foto} onChange={setFoto} />
          </div>
          <DrawerFooter>
            <Button onClick={onCrear}>Crear incidente</Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={!!anular} onOpenChange={(o) => !o && setAnular(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Anular incidente #{anular?.IDIncidente}</DrawerTitle>
            <DrawerDescription>Indicá el motivo. Se enviará una notificación.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <Textarea
              value={obsAnular}
              onChange={(e) => setObsAnular(e.target.value)}
              placeholder="Motivo de anulación..."
              rows={4}
            />
          </div>
          <DrawerFooter>
            <Button variant="destructive" onClick={onAnular}>
              Confirmar anulación
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
