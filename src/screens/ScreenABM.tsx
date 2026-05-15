import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, User, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchBar } from "@/components/shared/SearchBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/data/api";
import type { Edificio, Usuario } from "@/data/types";

type Tab = "edificios" | "personas";

export default function ScreenABM() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("edificios");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<{ kind: Tab; id: number; nuevo: string } | null>(null);

  const { data: edificios = [], isLoading: lE } = useQuery({
    queryKey: ["edificios"],
    queryFn: () => api.listEdificios(),
  });
  const { data: usuarios = [], isLoading: lU } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => api.listUsuarios(),
  });

  const fEdif = useMemo(() => {
    const t = q.trim().toLowerCase();
    return edificios.filter(
      (e) =>
        !t ||
        e.Edificio.toLowerCase().includes(t) ||
        e.Codigo.toLowerCase().includes(t) ||
        e.Direccion.toLowerCase().includes(t),
    );
  }, [edificios, q]);

  const fUsr = useMemo(() => {
    const t = q.trim().toLowerCase();
    return usuarios.filter(
      (u) =>
        u.Usuario !== "admin" &&
        (!t || u.Concat_Nombre_Apellido.toLowerCase().includes(t) || u.Usuario.toLowerCase().includes(t)),
    );
  }, [usuarios, q]);

  function pedirCambioEstado(kind: Tab, item: Edificio | Usuario) {
    const actual = item.Status;
    const nuevo = actual === "ALTA" || actual === "Activo" ? "BAJA" : "ALTA";
    setConfirm({ kind, id: item.ID, nuevo });
  }

  async function aplicarCambio() {
    if (!confirm) return;
    if (confirm.kind === "edificios") {
      await api.setEdificioStatus(confirm.id, confirm.nuevo as Edificio["Status"]);
      qc.invalidateQueries({ queryKey: ["edificios"] });
    } else {
      await api.setUsuarioStatus(confirm.id, confirm.nuevo as Usuario["Status"]);
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    }
    setConfirm(null);
    toast.success("Estado actualizado");
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader
        title="ABM"
        subtitle="Administración"
        action={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(tab === "edificios" ? "/edificios/nuevo" : "/personas/nueva")}
          >
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-3 p-4 md:p-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edificios">
              <Building2 className="mr-1 h-4 w-4" /> Edificios
            </TabsTrigger>
            <TabsTrigger value="personas">
              <User className="mr-1 h-4 w-4" /> Personas
            </TabsTrigger>
          </TabsList>

          <SearchBar
            containerClassName="mt-3"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "edificios" ? "Buscar edificio..." : "Buscar persona..."}
          />

          <TabsContent value="edificios" className="grid gap-2 md:grid-cols-2">
            {lE ? <InlineLoader /> : null}
            {!lE && fEdif.length === 0 ? (
              <EmptyState icon={Building2} title="Sin edificios" className="md:col-span-2" />
            ) : null}
            {fEdif.map((e) => (
              <Card key={e.ID}>
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.Edificio}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.Codigo} · {e.Direccion}
                    </p>
                  </div>
                  <StatusBadge status={e.Status} />
                  <Button variant="ghost" size="icon" onClick={() => toast.info("Editar (mock)")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => pedirCambioEstado("edificios", e)}>
                    <Power className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="personas" className="grid gap-2 md:grid-cols-2">
            {lU ? <InlineLoader /> : null}
            {!lU && fUsr.length === 0 ? (
              <EmptyState icon={User} title="Sin personas" className="md:col-span-2" />
            ) : null}
            {fUsr.map((u) => (
              <Card key={u.ID}>
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.Concat_Nombre_Apellido}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{u.Usuario} · {u.Rol}
                    </p>
                  </div>
                  <StatusBadge status={u.Status} />
                  <Button variant="ghost" size="icon" onClick={() => toast.info("Editar (mock)")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => pedirCambioEstado("personas", u)}>
                    <Power className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar estado</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirmás pasar este registro a estado <b>{confirm?.nuevo}</b>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={aplicarCambio}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
