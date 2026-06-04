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
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
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
  SelectGroup,
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
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 p-2.5 pb-3 md:p-4 md:pb-5">
        {/* Preview con back integrado a la izquierda */}
        <div className="relative overflow-hidden rounded-xl border bg-card p-3 shadow-sm">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-violet-200/40 blur-2xl dark:bg-violet-500/10"
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
            <div className="relative flex size-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-100 to-fuchsia-200 text-violet-700 ring-1 ring-violet-200/60 dark:from-violet-500/20 dark:to-fuchsia-500/10 dark:text-violet-300 dark:ring-violet-500/20">
              <UserCircle
                aria-hidden
                className="absolute right-0.5 top-0.5 size-2.5 opacity-40"
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
                <Shield className="size-2.5 shrink-0" />
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
            <FormField label="Nombre" htmlFor="nombre" required>
              <InputGroup className="h-11 md:h-10">
                <InputGroupAddon>
                  <IdCard />
                </InputGroupAddon>
                <InputGroupInput
                  id="nombre"
                  placeholder="Juan"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="text-sm"
                />
              </InputGroup>
            </FormField>
            <FormField label="Apellido" htmlFor="apellido" required>
              <InputGroup className="h-11 md:h-10">
                <InputGroupAddon>
                  <IdCard />
                </InputGroupAddon>
                <InputGroupInput
                  id="apellido"
                  placeholder="Pérez"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="text-sm"
                />
              </InputGroup>
            </FormField>
          </div>
          <FormField label="Fecha de nacimiento" htmlFor="fechaNac" required>
            <InputGroup className="h-11 md:h-10">
              <InputGroupAddon>
                <CalendarDays />
              </InputGroupAddon>
              <InputGroupInput
                id="fechaNac"
                type="date"
                value={fechaNac}
                onChange={(e) => setFechaNac(e.target.value)}
                className="text-sm"
              />
            </InputGroup>
          </FormField>
        </FormSection>

        {/* Sección: Contacto */}
        <FormSection
          title="Contacto"
          description="Cómo comunicarse con esta persona."
          icon={AtSign}
        >
          <FormField label="Correo" htmlFor="correo">
            <InputGroup className="h-11 md:h-10">
              <InputGroupAddon>
                <Mail />
              </InputGroupAddon>
              <InputGroupInput
                id="correo"
                type="email"
                placeholder="ejemplo@dominio.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="text-sm"
              />
            </InputGroup>
          </FormField>
          <FormField label="Teléfono" htmlFor="telefono" required>
            <InputGroup className="h-11 md:h-10">
              <InputGroupAddon>
                <Phone />
              </InputGroupAddon>
              <InputGroupInput
                id="telefono"
                type="tel"
                inputMode="tel"
                placeholder="+54 11 1234-5678"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="text-sm"
              />
            </InputGroup>
          </FormField>
        </FormSection>

        {/* Sección: Acceso al sistema */}
        <FormSection
          title="Acceso al sistema"
          description="Rol y credenciales auto-generadas."
          icon={Shield}
        >
          <FormField label="Rol" htmlFor="rol" required>
            <Select value={rol} onValueChange={(v) => setRol(v as Rol)}>
              <SelectTrigger id="rol" className="h-11 text-sm md:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {roles.map((r) => (
                    <SelectItem key={r.ID} value={r.Rol}>
                      {r.Rol}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FormField>

          {/* Credenciales preview */}
          <div className="flex flex-col gap-1.5 rounded-lg border border-dashed bg-muted/30 p-3">
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
            <X />
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onPedirGuardar}
            disabled={saving}
            className="h-10 flex-1 bg-gradient-to-br from-primary to-blue-700 shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30"
          >
            <Save />
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
              className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-violet-500/15 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-violet-500/5 text-violet-600 ring-1 ring-violet-200/60 dark:text-violet-300 dark:ring-violet-500/20">
                <UserCircle className="size-5" />
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
          <div className="flex flex-col gap-2 px-5 py-4">
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
              {saving ? <Spinner /> : <Save />}
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
      <div className="flex flex-col gap-2 p-2.5 md:p-3.5">{children}</div>
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
        <Icon className="size-3" />
        {label}
      </span>
      <span className="truncate font-mono text-sm font-semibold text-primary">{value}</span>
      <span className="truncate text-[10px] text-muted-foreground">{hint}</span>
    </div>
  );
}
