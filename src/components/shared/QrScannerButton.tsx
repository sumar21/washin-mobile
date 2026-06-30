import { useState } from "react";
import { ScanLine, X } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Diálogo del escáner, CONTROLADO. IMPORTANTE: renderizarlo a nivel raíz de la pantalla, nunca
// anidado dentro de un Drawer/ResponsiveDialog. El <Scanner> abre la cámara pero NO decodifica
// frames cuando queda dentro de otro modal (vaul Drawer) → "el scanner ni siquiera lee". Para usos
// dentro de un Drawer: cerrar el Drawer y abrir este diálogo desde la raíz (ver ScreenPlanificaciones).
export function QrScannerDialog({
  open,
  onOpenChange,
  onScan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Escanear código</DialogTitle>
          <DialogDescription>Apuntá la cámara al código QR del edificio</DialogDescription>
        </DialogHeader>
        <div className="aspect-square w-full overflow-hidden bg-black">
          {open ? (
            <Scanner
              onScan={(results) => {
                const text = results?.[0]?.rawValue;
                if (text) {
                  onScan(text);
                  onOpenChange(false);
                }
              }}
              onError={() => undefined}
              constraints={{ facingMode: "environment" }}
            />
          ) : null}
        </div>
        <div className="flex justify-end p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface Props {
  onScan: (code: string) => void;
  label?: string;
  variant?: "default" | "outline" | "secondary";
}

// Botón + escáner para usos NO anidados (top-level). Si vas a usarlo dentro de un Drawer/Dialog,
// NO lo uses: usá QrScannerDialog controlado desde la raíz (el scanner no lee si queda anidado).
export function QrScannerButton({ onScan, label = "Escanear QR", variant = "default" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant={variant} onClick={() => setOpen(true)}>
        <ScanLine className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <QrScannerDialog open={open} onOpenChange={setOpen} onScan={onScan} />
    </>
  );
}
