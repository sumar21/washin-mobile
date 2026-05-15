import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/data/api";
import { genUsername, genPassword, isValidEmail } from "@/lib/format";
import type { Rol } from "@/data/types";

export default function ScreenCrearPersona() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: () => api.listRoles() });

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rol, setRol] = useState<Rol>("Tecnico");
  const [fechaNac, setFechaNac] = useState("");

  const usuario = nombre && apellido ? genUsername(nombre, apellido) : "";
  const fechaArg = fechaNac ? fechaNac.split("-").reverse().join("/") : "";
  const password = fechaArg ? genPassword(fechaArg) : "";

  async function onGuardar() {
    if (!nombre.trim() || !apellido.trim() || !telefono.trim() || !rol || !fechaNac) {
      toast.error("Faltan campos obligatorios");
      return;
    }
    if (correo && !isValidEmail(correo)) {
      toast.error("Email inválido");
      return;
    }
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
    toast.success("Usuario creado", {
      description: `Usuario: ${usuario} · Contraseña: ${password}`,
    });
    navigate("/abm");
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title="Nueva persona" />
      <div className="p-4">
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="nombre">Nombre *</Label>
                <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="apellido">Apellido *</Label>
                <Input id="apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="correo">Correo</Label>
              <Input
                id="correo"
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="telefono">Teléfono *</Label>
              <Input
                id="telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Rol *</Label>
              <Select value={rol} onValueChange={(v) => setRol(v as Rol)}>
                <SelectTrigger className="mt-1">
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
            </div>
            <div>
              <Label htmlFor="fechaNac">Fecha de nacimiento *</Label>
              <Input
                id="fechaNac"
                type="date"
                value={fechaNac}
                onChange={(e) => setFechaNac(e.target.value)}
                className="mt-1"
              />
            </div>
            {usuario || password ? (
              <div className="rounded-md bg-muted p-3 text-xs">
                <p className="text-muted-foreground">Credenciales generadas automáticamente:</p>
                <p>
                  Usuario: <span className="font-mono font-medium">{usuario || "—"}</span>
                </p>
                <p>
                  Contraseña: <span className="font-mono font-medium">{password || "—"}</span>
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Button size="lg" className="mt-4 w-full" onClick={onGuardar}>
          <Save className="mr-2 h-4 w-4" /> Guardar persona
        </Button>
      </div>
    </div>
  );
}
