import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { api } from "@/data/api";

export default function ScreenMails() {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["emails"],
    queryFn: () => api.listEmails(),
  });

  const [moduloId, setModuloId] = useState<string>("");
  const [destinatario, setDestinatario] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [bcc, setBcc] = useState(true);

  const tpl = useMemo(() => templates.find((t) => String(t.ID) === moduloId), [templates, moduloId]);

  function aplicarPlantilla(id: string) {
    setModuloId(id);
    const t = templates.find((x) => String(x.ID) === id);
    if (!t) return;
    setAsunto(t.Asunto_EM);
    setCuerpo(t.Cuerpo_EM);
    setDestinatario(t.MailDestino_EM);
  }

  async function enviar() {
    if (!destinatario.trim() || !asunto.trim() || !cuerpo.trim()) {
      toast.error("Faltan campos");
      return;
    }
    await api.sendEmail({
      to: destinatario,
      subject: asunto,
      html: cuerpo,
      bcc: bcc && tpl ? tpl.MailSumar_EM : undefined,
    });
    toast.success("Email enviado (mock)", { description: destinatario });
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title="Mails" subtitle="Envío de notificaciones" hamburger={false} />
      <div className="mx-auto w-full max-w-3xl space-y-3 p-4 md:p-6">
        {isLoading ? <InlineLoader /> : null}

        <Card>
          <CardContent className="space-y-3 pt-4">
            <div>
              <Label>Plantilla / Módulo</Label>
              <Select value={moduloId} onValueChange={aplicarPlantilla}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar plantilla" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.ID} value={String(t.ID)}>
                      {t.Modulo_EM}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="destinatario">Destinatario</Label>
              <Input
                id="destinatario"
                type="email"
                value={destinatario}
                onChange={(e) => setDestinatario(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="asunto">Asunto</Label>
              <Input id="asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="cuerpo">Cuerpo (HTML)</Label>
              <Textarea
                id="cuerpo"
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                rows={6}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Enviar copia oculta a Wash-Inn</p>
                <p className="text-[11px] text-muted-foreground">{tpl?.MailSumar_EM ?? "—"}</p>
              </div>
              <Switch checked={bcc} onCheckedChange={setBcc} />
            </div>
          </CardContent>
        </Card>

        {cuerpo ? (
          <Card>
            <CardContent className="pt-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Mail className="h-4 w-4" /> Vista previa
              </p>
              <div
                className="prose prose-sm max-w-none rounded-md border bg-card p-3"
                dangerouslySetInnerHTML={{ __html: cuerpo }}
              />
            </CardContent>
          </Card>
        ) : null}

        <Button size="lg" className="w-full" onClick={enviar}>
          <Send className="mr-2 h-4 w-4" /> Enviar email
        </Button>
      </div>
    </div>
  );
}
