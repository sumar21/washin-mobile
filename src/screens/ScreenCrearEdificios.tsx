import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ChevronLeft,
  Hash,
  MapPin,
  Mail,
  User,
  Phone,
  Save,
  Crosshair,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/data/api";
import { isValidEmail } from "@/lib/format";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ScreenCrearEdificios() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [correo, setCorreo] = useState("");
  const [encargado, setEncargado] = useState("");
  const [celular, setCelular] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [lat2, setLat2] = useState("");
  const [lng2, setLng2] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gps2Loading, setGps2Loading] = useState(false);
  const [saving, setSaving] = useState(false);

  function detectGpsFor(target: "main" | "alt") {
    if (!("geolocation" in navigator)) {
      toast.error("Tu dispositivo no soporta GPS");
      return;
    }
    const setLoading = target === "main" ? setGpsLoading : setGps2Loading;
    const setLatFor = target === "main" ? setLat : setLat2;
    const setLngFor = target === "main" ? setLng : setLng2;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        setLatFor(pos.coords.latitude.toFixed(6));
        setLngFor(pos.coords.longitude.toFixed(6));
        toast.success("Ubicación detectada");
      },
      (err) => {
        setLoading(false);
        toast.error("No se pudo obtener la ubicación", { description: err.message });
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function onGuardar() {
    if (!codigo.trim() || !nombre.trim() || !direccion.trim() || !lat || !lng) {
      toast.error("Faltan campos obligatorios");
      return;
    }
    if (correo && !isValidEmail(correo)) {
      toast.error("Email inválido");
      return;
    }
    const latN = Number(lat.replace(",", "."));
    const lngN = Number(lng.replace(",", "."));
    if (Number.isNaN(latN) || Number.isNaN(lngN)) {
      toast.error("Coordenadas principales inválidas");
      return;
    }
    // Coordenadas secundarias (edificio): si no se ingresaron, usar las principales
    const lat2N = lat2 ? Number(lat2.replace(",", ".")) : latN;
    const lng2N = lng2 ? Number(lng2.replace(",", ".")) : lngN;
    if (Number.isNaN(lat2N) || Number.isNaN(lng2N)) {
      toast.error("Coordenadas del edificio inválidas");
      return;
    }
    setSaving(true);
    await api.upsertEdificio({
      ID: 0,
      Codigo: codigo.trim(),
      Edificio: nombre.trim(),
      Direccion: direccion.trim().toUpperCase(),
      Correo: correo.trim(),
      Encargado: encargado.trim(),
      Celular: celular.trim(),
      Latitud: latN,
      Longitud: lngN,
      Latitud_ED: Number(lat2N.toFixed(6)),
      Longitud_ED: Number(lng2N.toFixed(6)),
      Status: "ALTA",
    });
    qc.invalidateQueries({ queryKey: ["edificios"] });
    setSaving(false);
    toast.success("Edificio creado");
    navigate("/edificios");
  }

  const hasPreview = !!(nombre.trim() || codigo.trim() || direccion.trim());

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-3 pb-24 md:p-5 md:pb-28">
        {/* Preview con back integrado a la izquierda */}
        <div className="relative overflow-hidden rounded-xl border bg-card p-3 shadow-sm">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-cyan-200/40 blur-2xl dark:bg-cyan-500/10"
          />
          <div className="relative flex items-center gap-2.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="Volver"
              className="size-9 shrink-0 rounded-lg bg-white/60 backdrop-blur-sm hover:bg-white dark:bg-card/60 dark:hover:bg-card"
            >
              <ChevronLeft />
            </Button>
            <div className="relative flex size-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-100 to-sky-200 text-cyan-700 ring-1 ring-cyan-200/60 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-300 dark:ring-cyan-500/20">
              <Building2 aria-hidden className="absolute right-0.5 top-0.5 size-2.5 opacity-40" />
              <span className="text-sm font-bold tracking-tight">
                {hasPreview ? initialsOf(nombre || codigo) : "??"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">
                {nombre.trim() || (
                  <span className="text-muted-foreground/60">Nombre del edificio</span>
                )}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="size-2.5 shrink-0" />
                <span className="truncate">{direccion.trim() || "Dirección"}</span>
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/50 px-1.5 py-0 font-mono font-semibold text-foreground/80">
                  {codigo.trim() || "CÓDIGO"}
                </span>
                {encargado.trim() ? (
                  <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                    <User className="size-2.5 shrink-0" />
                    <span className="truncate">{encargado}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Sección: Identificación */}
        <FormSection
          title="Identificación"
          description="Cómo se identifica el edificio en el sistema."
          icon={Hash}
        >
          <FormField label="Código" htmlFor="codigo" required>
            <InputGroup className="h-11 md:h-10">
              <InputGroupAddon>
                <Hash />
              </InputGroupAddon>
              <InputGroupInput
                id="codigo"
                placeholder="EDF-001"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                className="font-mono text-sm uppercase"
              />
            </InputGroup>
          </FormField>
          <FormField label="Nombre" htmlFor="nombre" required>
            <InputGroup className="h-11 md:h-10">
              <InputGroupAddon>
                <Building2 />
              </InputGroupAddon>
              <InputGroupInput
                id="nombre"
                placeholder="Torre Sumar"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="text-sm"
              />
            </InputGroup>
          </FormField>
        </FormSection>

        {/* Sección: Ubicación */}
        <FormSection
          title="Ubicación"
          description="Dirección y coordenadas GPS del edificio."
          icon={MapPin}
        >
          <FormField label="Dirección" htmlFor="direccion" required>
            <Textarea
              id="direccion"
              placeholder="Av. Corrientes 1234, CABA"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              rows={2}
              className="min-h-0 resize-none py-2"
            />
          </FormField>

          {/* Coordenadas principales (Acceso) */}
          <div className="flex flex-col gap-1.5">
            <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              Acceso
            </p>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <FormField label="Latitud" htmlFor="lat" required>
                <Input
                  id="lat"
                  inputMode="decimal"
                  placeholder="-34.604"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="font-mono text-sm md:h-10"
                />
              </FormField>
              <FormField label="Longitud" htmlFor="lng" required>
                <Input
                  id="lng"
                  inputMode="decimal"
                  placeholder="-58.389"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="font-mono text-sm md:h-10"
                />
              </FormField>
              <div className="flex flex-col justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => detectGpsFor("main")}
                  disabled={gpsLoading}
                  aria-label="Detectar ubicación de acceso"
                  title="Detectar ubicación de acceso"
                  className="size-11 md:size-10"
                >
                  {gpsLoading ? <Spinner /> : <Crosshair />}
                </Button>
              </div>
            </div>
          </div>

          {/* Coordenadas secundarias (Edificio) */}
          <div className="flex flex-col gap-1.5">
            <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              Edificio
            </p>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <FormField label="Latitud" htmlFor="lat2">
                <Input
                  id="lat2"
                  inputMode="decimal"
                  placeholder="-34.604"
                  value={lat2}
                  onChange={(e) => setLat2(e.target.value)}
                  className="font-mono text-sm md:h-10"
                />
              </FormField>
              <FormField label="Longitud" htmlFor="lng2">
                <Input
                  id="lng2"
                  inputMode="decimal"
                  placeholder="-58.389"
                  value={lng2}
                  onChange={(e) => setLng2(e.target.value)}
                  className="font-mono text-sm md:h-10"
                />
              </FormField>
              <div className="flex flex-col justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => detectGpsFor("alt")}
                  disabled={gps2Loading}
                  aria-label="Detectar ubicación del edificio"
                  title="Detectar ubicación del edificio"
                  className="size-11 md:size-10"
                >
                  {gps2Loading ? <Spinner /> : <Crosshair />}
                </Button>
              </div>
            </div>
          </div>
        </FormSection>

        {/* Sección: Contacto */}
        <FormSection
          title="Contacto"
          description="Datos opcionales del encargado del edificio."
          icon={User}
        >
          <FormField label="Correo" htmlFor="correo">
            <InputGroup className="h-11 md:h-10">
              <InputGroupAddon>
                <Mail />
              </InputGroupAddon>
              <InputGroupInput
                id="correo"
                type="email"
                placeholder="admin@edificio.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="text-sm"
              />
            </InputGroup>
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Encargado" htmlFor="encargado">
              <InputGroup className="h-11 md:h-10">
                <InputGroupAddon>
                  <User />
                </InputGroupAddon>
                <InputGroupInput
                  id="encargado"
                  placeholder="Nombre y apellido"
                  value={encargado}
                  onChange={(e) => setEncargado(e.target.value)}
                  className="text-sm"
                />
              </InputGroup>
            </FormField>
            <FormField label="Celular" htmlFor="celular">
              <InputGroup className="h-11 md:h-10">
                <InputGroupAddon>
                  <Phone />
                </InputGroupAddon>
                <InputGroupInput
                  id="celular"
                  type="tel"
                  inputMode="tel"
                  placeholder="+54 11 1234-5678"
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                  className="text-sm"
                />
              </InputGroup>
            </FormField>
          </div>
        </FormSection>
      </div>

      {/* Footer sticky con acciones */}
      <div className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-3 py-2 md:px-5 md:py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={saving}
            className="h-10 flex-1 sm:flex-none"
          >
            <X />
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onGuardar}
            disabled={saving}
            className="h-10 flex-1 bg-gradient-to-br from-primary to-blue-700 shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30"
          >
            {saving ? <Spinner /> : <Save />}
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FormSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 md:px-4">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-tight">{title}</h2>
          {description ? (
            <p className="text-[11px] leading-tight text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <div className="flex flex-col gap-2.5 p-3 md:p-4">{children}</div>
    </section>
  );
}

// Wrapper fino sobre Field/FieldLabel de shadcn, preservando el estilo de label
// (uppercase, muted, asterisco requerido) usado en toda la app.
function FormField({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Field className="gap-1.5">
      <FieldLabel
        htmlFor={htmlFor}
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      {children}
    </Field>
  );
}
