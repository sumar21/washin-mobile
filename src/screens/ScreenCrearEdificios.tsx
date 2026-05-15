import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GpsButton } from "@/components/shared/GpsButton";
import { api } from "@/data/api";
import { isValidEmail } from "@/lib/format";

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
      toast.error("Coordenadas inválidas");
      return;
    }
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
      Latitud_ED: Number(latN.toFixed(3)),
      Longitud_ED: Number(lngN.toFixed(3)),
      Status: "ALTA",
    });
    qc.invalidateQueries({ queryKey: ["edificios"] });
    toast.success("Edificio creado");
    navigate("/abm");
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title="Nuevo edificio" />
      <div className="mx-auto w-full max-w-2xl p-4 md:p-6">
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div>
              <Label htmlFor="codigo">Código *</Label>
              <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="direccion">Dirección *</Label>
              <Textarea
                id="direccion"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                rows={2}
                className="mt-1"
              />
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="encargado">Encargado</Label>
                <Input
                  id="encargado"
                  value={encargado}
                  onChange={(e) => setEncargado(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="celular">Celular</Label>
                <Input id="celular" value={celular} onChange={(e) => setCelular(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="lat">Latitud *</Label>
                <Input id="lat" value={lat} onChange={(e) => setLat(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="lng">Longitud *</Label>
                <Input id="lng" value={lng} onChange={(e) => setLng(e.target.value)} className="mt-1" />
              </div>
            </div>
            <GpsButton
              label="Detectar ubicación"
              onLocation={(c) => {
                setLat(c.latitude.toFixed(6));
                setLng(c.longitude.toFixed(6));
              }}
            />
          </CardContent>
        </Card>
        <Button size="lg" className="mt-4 w-full" onClick={onGuardar}>
          <Save className="mr-2 h-4 w-4" /> Guardar edificio
        </Button>
      </div>
    </div>
  );
}
