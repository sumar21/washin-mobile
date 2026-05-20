import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus, Building2, User, Pencil, Power, CheckCircle2 } from "lucide-react";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/data/api";
import type { Edificio, Usuario } from "@/data/types";

type Tab = "edificios" | "personas";

export default function ScreenABM() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("edificios");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<{
    kind: Tab;
    id: number;
    actual: string;
    nuevo: string;
    label: string;
    subtitle?: string;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

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
    const label =
      kind === "edificios"
        ? (item as Edificio).Edificio
        : (item as Usuario).Concat_Nombre_Apellido;
    const subtitle =
      kind === "edificios"
        ? `${(item as Edificio).Codigo} · ${(item as Edificio).Direccion}`
        : `@${(item as Usuario).Usuario} · ${(item as Usuario).Rol}`;
    setConfirm({ kind, id: item.ID, actual, nuevo, label, subtitle });
  }

  async function aplicarCambio() {
    if (!confirm) return;
    setConfirming(true);
    if (confirm.kind === "edificios") {
      await api.setEdificioStatus(confirm.id, confirm.nuevo as Edificio["Status"]);
      qc.invalidateQueries({ queryKey: ["edificios"] });
    } else {
      await api.setUsuarioStatus(confirm.id, confirm.nuevo as Usuario["Status"]);
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    }
    setConfirming(false);
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

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          {/* Hero contextual: verde si activa, rojo si da de baja */}
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className={`pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-3xl ${
                confirm?.nuevo === "ALTA" ? "bg-emerald-500/15" : "bg-rose-500/15"
              }`}
            />
            <div className="relative flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${
                  confirm?.nuevo === "ALTA"
                    ? "bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-600 ring-emerald-200/60 dark:text-emerald-400 dark:ring-emerald-500/20"
                    : "bg-gradient-to-br from-rose-500/15 to-rose-500/5 text-rose-600 ring-rose-200/60 dark:text-rose-400 dark:ring-rose-500/20"
                }`}
              >
                {confirm?.nuevo === "ALTA" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Power className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  {confirm?.nuevo === "ALTA" ? "Activar registro" : "Dar de baja"}
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {confirm?.kind === "edificios"
                    ? "El edificio dejará de aparecer en las listas activas."
                    : "La persona ya no podrá ingresar al sistema."}
                </p>
              </div>
            </div>
          </div>

          {/* Resumen del item afectado */}
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  confirm?.kind === "edificios"
                    ? "bg-gradient-to-br from-cyan-100 to-sky-200 text-cyan-700 ring-1 ring-cyan-200/60 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-300 dark:ring-cyan-500/20"
                    : "bg-gradient-to-br from-violet-100 to-fuchsia-200 text-violet-700 ring-1 ring-violet-200/60 dark:from-violet-500/20 dark:to-fuchsia-500/10 dark:text-violet-300 dark:ring-violet-500/20"
                }`}
              >
                {confirm?.kind === "edificios" ? (
                  <Building2 className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">
                  {confirm?.label}
                </p>
                {confirm?.subtitle ? (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {confirm.subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Transición visual: estado actual → nuevo */}
            <div className="flex items-center justify-center gap-2 text-xs">
              <StatusPillSmall status={confirm?.actual ?? ""} />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <StatusPillSmall status={confirm?.nuevo ?? ""} highlight />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button
                variant="outline"
                disabled={confirming}
                className="h-10 flex-1 sm:flex-none"
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button
              onClick={aplicarCambio}
              disabled={confirming}
              className={`h-10 flex-1 sm:flex-none ${
                confirm?.nuevo === "ALTA"
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                  : "bg-gradient-to-br from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700"
              }`}
            >
              {confirm?.nuevo === "ALTA" ? "Activar" : "Dar de baja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusPillSmall({
  status,
  highlight,
}: {
  status: string;
  highlight?: boolean;
}) {
  const isAlta = status === "ALTA" || status === "Activo";
  const base =
    "inline-flex items-center rounded-md px-2 py-1 font-semibold uppercase tracking-wide";
  const tone = isAlta
    ? highlight
      ? "bg-emerald-500 text-white shadow-sm"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    : highlight
      ? "bg-rose-500 text-white shadow-sm"
      : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  return <span className={`${base} ${tone}`}>{status}</span>;
}
