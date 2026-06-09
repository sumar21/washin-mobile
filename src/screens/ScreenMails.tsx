import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { getEmails, enviarMail } from "@/lib/api-client";

export default function ScreenMails() {
  // Destinatarios por módulo desde 99.ABM_Emails (MailWashinn = destino, MailSumar = Bcc).
  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["emails-abm"],
    queryFn: getEmails,
  });

  const [moduloId, setModuloId] = useState<string>("");
  const [destinatario, setDestinatario] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [bcc, setBcc] = useState(true);

  const sel = useMemo(
    () => emails.find((t) => String(t.ID) === moduloId),
    [emails, moduloId],
  );

  function aplicarModulo(id: string) {
    setModuloId(id);
    const t = emails.find((x) => String(x.ID) === id);
    if (t) setDestinatario(t.MailWashinn || "");
  }

  const [sending, setSending] = useState(false);

  async function enviar() {
    if (!destinatario.trim() || !asunto.trim() || !cuerpo.trim()) {
      toast.error("Faltan campos");
      return;
    }
    setSending(true);
    try {
      await enviarMail({
        to: destinatario.trim(),
        subject: asunto.trim(),
        html: cuerpo.replace(/\n/g, "<br>"),
        bcc: bcc && sel?.MailSumar ? sel.MailSumar : undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el correo");
      return;
    } finally {
      setSending(false);
    }
    toast.success("Correo enviado", { description: destinatario });
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title="Mails" subtitle="Envío de notificaciones" hamburger={false} />
      <div className="mx-auto w-full max-w-3xl space-y-3 p-4 md:p-6">
        {isLoading ? <InlineLoader /> : null}

        <Card>
          <CardContent className="space-y-3 pt-4">
            <div>
              <Label>Módulo</Label>
              <Select value={moduloId} onValueChange={aplicarModulo}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar módulo" />
                </SelectTrigger>
                <SelectContent>
                  {emails.map((t) => (
                    <SelectItem key={t.ID} value={String(t.ID)}>
                      {t.Modulo}
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
              <Input
                id="asunto"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cuerpo">Cuerpo</Label>
              <Textarea
                id="cuerpo"
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                rows={6}
                className="mt-1 text-sm"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Copia oculta a Wash-Inn</p>
                <p className="text-[11px] text-muted-foreground">
                  {sel?.MailSumar || "—"}
                </p>
              </div>
              <Switch checked={bcc} onCheckedChange={setBcc} />
            </div>
          </CardContent>
        </Card>

        <Button size="lg" className="w-full" onClick={enviar} disabled={sending}>
          <Send className="mr-2 h-4 w-4" /> {sending ? "Enviando…" : "Enviar email"}
        </Button>
      </div>
    </div>
  );
}
