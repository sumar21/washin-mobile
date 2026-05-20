import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MapPin, Plus, Building2, X, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/shared/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { useSession } from "@/stores/sessionStore";
import { api } from "@/data/api";
import type { Edificio } from "@/data/types";

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ScreenEdificios() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [q, setQ] = useState("");

  const { data: edificios = [], isLoading } = useQuery({
    queryKey: ["edificios"],
    queryFn: () => api.listEdificios(),
  });

  const activos = useMemo(() => edificios.filter((e) => e.Status === "ALTA"), [edificios]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return activos;
    return activos.filter(
      (e) =>
        e.Edificio.toLowerCase().includes(term) ||
        e.Direccion.toLowerCase().includes(term) ||
        e.Codigo.toLowerCase().includes(term) ||
        (e.Encargado ?? "").toLowerCase().includes(term),
    );
  }, [activos, q]);

  const canCreate = user?.Rol === "Admin";

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      {/* Header: back + buscador + acción "Nuevo edificio" */}
      <header className="safe-top sticky top-0 z-30 flex items-center gap-2 bg-background/85 px-2 pb-2 pt-6 backdrop-blur md:px-4 md:py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label="Volver"
          className="h-9 w-9 shrink-0 md:hidden"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="relative flex-1">
          <SearchBar
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, dirección, código..."
            className="h-9 pr-9"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {canCreate ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate("/edificios/nuevo")}
            aria-label="Nuevo edificio"
            className="h-9 w-9 shrink-0"
          >
            <Plus className="h-5 w-5" />
          </Button>
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-5xl space-y-3 p-3 md:p-6">
        {q ? (
          <p className="px-1 text-xs text-muted-foreground">
            {filtered.length} resultado{filtered.length === 1 ? "" : "s"} ·{" "}
            <span className="font-medium">{activos.length}</span> activos
          </p>
        ) : (
          <p className="px-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{activos.length}</span>{" "}
            edificios activos
          </p>
        )}

        {isLoading ? <InlineLoader /> : null}

        {!isLoading && filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={q ? "Sin coincidencias" : "Sin edificios"}
            description={
              q
                ? "Probá con otro nombre, dirección o código."
                : "Todavía no hay edificios cargados."
            }
          />
        ) : null}

        {filtered.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => (
              <EdificioCard key={e.ID} edificio={e} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EdificioCard({ edificio }: { edificio: Edificio }) {
  return (
    <Card className="group cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <CardContent className="flex items-stretch gap-3 p-3 md:p-4">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-100 to-sky-200 text-cyan-700 ring-1 ring-cyan-200/60 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-300 dark:ring-cyan-500/20 md:h-16 md:w-16">
          <Building2
            aria-hidden
            className="absolute right-1 top-1 h-3 w-3 opacity-40 md:h-3.5 md:w-3.5"
          />
          <span className="text-base font-bold tracking-tight md:text-lg">
            {initials(edificio.Edificio)}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight md:text-base">
              {edificio.Edificio}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{edificio.Direccion}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono font-semibold text-foreground/80">
              {edificio.Codigo}
            </span>
            {edificio.Encargado ? (
              <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">{edificio.Encargado}</span>
              </span>
            ) : null}
          </div>
        </div>

        <ChevronRight className="my-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </CardContent>
    </Card>
  );
}
