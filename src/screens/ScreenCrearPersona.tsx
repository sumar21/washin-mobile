import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  CalendarDays,
  ChevronLeft,
  Hash,
  IdCard,
  Key,
  Loader2,
  Mail,
  Phone,
  Save,
  Shield,
  User,
  UserCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/data/api";
import { genUsername, genPassword, isValidEmail } from "@/lib/format";
import type { Rol } from "@/data/types";

function initialsOf(name: string, lastName: string) {
  const a = name.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  return ((a + b) || "??").toUpperCase();
}

export default function ScreenCrearPersona() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.listRoles(),
  });

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rol, setRol] = useState<Rol>("Tecnico");
  const [fechaNac, setFechaNac] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const usuario = nombre && apellido ? genUsername(nombre, apellido) : "";
  const fechaArg = fechaNac ? fechaNac.split("-").reverse().join("/") : "";
  const password = fechaArg ? genPassword(fechaArg) : "";

  function onPedirGuardar() {
    if (!nombre.trim() || !apellido.trim() || !telefono.trim() || !rol || !fechaNac) {
      toast.error("Faltan campos obligatorios");
      return;
    }
    if (correo && !isValidEmail(correo)) {
      toast.error("Email inválido");
      return;
    }
    setConfirmOpen(true);
  }

  async function doGuardar() {
    setSaving(true);
    await api.upsertUsuario({
      ID: 0,
      Usuario: usuario,
      Password: password,
      Nombre: nombre.trim(),
      Apellido: apellido.trim(),
      Concat_Nombre_Apellido: `${apellido.trim()}, ${nombre.trim()}`,
      Correo: correo.trim(),
      Telefono: telefono.trim(),
      FechaNac_USR: fechaArg,
      Rol: rol,
      Status: "ALTA",
    });
    qc.invalidateQueries({ queryKey: ["usuarios"] });
    setSaving(false);
    setConfirmOpen(false);
    toast.success("Usuario creado", {
      description: `Usuario: ${usuario} · Contraseña: ${password}`,
    });
    navigate("/abm");
  }

  const hasPreview = !!(nombre.trim() || apellido.trim());

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <div className="mx-auto w-full max-w-2xl space-y-2 p-2.5 pb-3 md:p-4 md:pb-5">
        {/* Preview con back integrado a la izquierda */}
        <div className="relative overflow-hidden rounded-xl border bg-card p-3 shadow-sm">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-200/40 blur-2xl dark:bg-violet-500/10"
          />
          <div className="relative flex items-center gap-2.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="Volver"
              className="h-9 w-9 shrink-0 rounded-lg bg-white/60 backdrop-blur-sm hover:bg-white dark:bg-card/60 dark:hover:bg-card"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-100 to-fuchsia-200 text-violet-700 ring-1 ring-violet-200/60 dark:from-violet-500/20 dark:to-fuchsia-500/10 dark:text-violet-300 dark:ring-violet-500/20">
              <UserCircle
                aria-hidden
                className="absolute right-0.5 top-0.5 h-2.5 w-2.5 opacity-40"
              />
              <span className="text-sm font-bold tracking-tight">
                {hasPreview ? initialsOf(nombre, apellido) : "??"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">
                {hasPreview ? (
                  `${apellido.trim() || "Apellido"}${nombre.trim() ? ", " : ""}${nombre.trim()}`
                ) : (
                  <span className="text-muted-foreground/60">Nueva persona</span>
                )}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Shield className="h-2.5 w-2.5 shrink-0" />
                <span>{rol}</span>
                {usuario ? (
                  <>
                    <span className="opacity-50">·</span>
                    <span className="font-mono">{usuario}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>

        {/* Sección: Datos personales */}
        <FormSection
          title="Datos personales"
          description="Nombre, apellido y fecha de nacimiento."
          icon={User}
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nombre" htmlFor="nombre" required>
              <IconInput icon={IdCard}>
                <Input
                  id="nombre"
                  placeholder="Juan"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="h-11 pl-9 text-sm md:h-10"
                />
              </IconInput>
            </Field>
            <Field label="Apellido" htmlFor="apellido" required>
              <IconInput icon={IdCard}>
                <Input
                  id="apellido"
                  placeholder="Pérez"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="h-11 pl-9 text-sm md:h-10"
                />
              </IconInput>
            </Field>
          </div>
          <Field label="Fecha de nacimiento" htmlFor="fechaNac" required>
            <IconInput icon={CalendarDays}>
              <Input
                id="fechaNac"
                type="date"
                value={fechaNac}
                onChange={(e) => setFechaNac(e.target.value)}
                className="h-11 pl-9 text-sm md:h-10"
              />
            </IconInput>
          </Field>
        </FormSection>

        {/* Sección: Contacto */}
        <FormSection
          title="Contacto"
          description="Cómo comunicarse con esta persona."
          icon={AtSign}
        >
          <Field label="Correo" htmlFor="correo">
            <IconInput icon={Mail}>
              <Input
                id="correo"
                type="email"
                placeholder="ejemplo@dominio.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="h-11 pl-9 text-sm md:h-10"
              />
            </IconInput>
          </Field>
          <Field label="Teléfono" htmlFor="telefono" required>
            <IconInput icon={Phone}>
              <Input
                id="telefono"
                type="tel"
                inputMode="tel"
                placeholder="+54 11 1234-5678"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="h-11 pl-9 text-sm md:h-10"
              />
            </IconInput>
          </Field>
        </FormSection>

        {/* Sección: Acceso al sistema */}
        <FormSection
          title="Acceso al sistema"
          description="Rol y credenciales auto-generadas."
          icon={Shield}
        >
          <Field label="Rol" htmlFor="rol" required>
            <Select value={rol} onValueChange={(v) => setRol(v as Rol)}>
              <SelectTrigger id="rol" className="h-11 text-sm md:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.ID} value={r.Rol}>
                    {r.Rol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Credenciales preview */}
          <div className="space-y-1.5 rounded-lg border border-dashed bg-muted/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Credenciales generadas
            </p>
            <div className="grid grid-cols-2 gap-2">
              <CredentialRow
                icon={Hash}
                label="Usuario"
                value={usuario || "—"}
                hint="nombre + apellido"
              />
              <CredentialRow
                icon={Key}
                label="Contraseña"
                value={password || "—"}
                hint="día y mes de nacimiento"
              />
            </div>
          </div>
        </FormSection>
      </div>

      {/* Footer sticky — mt-auto lo empuja al fondo del flex column aunque haya poco contenido */}
      <div className="safe-bottom sticky bottom-0 z-20 mt-auto border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-3 py-2 md:px-5 md:py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={saving}
            className="h-10 flex-1 sm:flex-none"
          >
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onPedirGuardar}
            disabled={saving}
            className="h-10 flex-1 bg-gradient-to-br from-primary to-blue-700 shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30"
          >
            <Save className="mr-2 h-4 w-4" />
            Guardar
          </Button>
        </div>
      </div>

      {/* Dialog de confirmación */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-violet-500/15 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-violet-500/5 text-violet-600 ring-1 ring-violet-200/60 dark:text-violet-300 dark:ring-violet-500/20">
                <UserCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Registrar persona
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ¿Confirmás que querés crear este usuario?
                </p>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="space-y-2 px-5 py-4">
            <SummaryRow label="Nombre" value={`${apellido}, ${nombre}`} />
            <SummaryRow label="Rol" value={rol} />
            <SummaryRow label="Teléfono" value={telefono} />
            {correo ? <SummaryRow label="Correo" value={correo} /> : null}
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-dashed bg-muted/30 p-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Usuario
                </span>
                <span className="font-mono text-xs font-semibold text-primary">
                  {usuario}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Contraseña
                </span>
                <span className="font-mono text-xs font-semibold text-primary">
                  {password}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button
                variant="outline"
                disabled={saving}
                className="h-10 flex-1 sm:flex-none"
              >
                Cerrar
              </Button>
            </DialogClose>
            <Button
              onClick={doGuardar}
              disabled={saving}
              className="h-10 flex-1 gap-2 bg-gradient-to-br from-primary to-blue-700 sm:flex-none"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Guardando..." : "Aceptar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground/90">{value}</span>
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
      <header className="flex items-center gap-2 border-b bg-muted/30 px-2.5 py-1.5 md:px-3.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-tight">{title}</h2>
          {description ? (
            <p className="text-[11px] leading-tight text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <div className="space-y-2 p-2.5 md:p-3.5">{children}</div>
    </section>
  );
}

function Field({
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
    <div className="space-y-1">
      <Label
        htmlFor={htmlFor}
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function IconInput({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {children}
    </div>
  );
}

function CredentialRow({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border bg-card p-2">
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className="truncate font-mono text-sm font-semibold text-primary">{value}</span>
      <span className="truncate text-[10px] text-muted-foreground">{hint}</span>
    </div>
  );
}
