import { useState } from "react";
import { ScanLine, X } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Props {
  onScan: (code: string) => void;
  label?: string;
  variant?: "default" | "outline" | "secondary";
}

export function QrScannerButton({ onScan, label = "Escanear QR", variant = "default" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant={variant} onClick={() => setOpen(true)}>
        <ScanLine className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
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
                    setOpen(false);
                  }
                }}
                onError={() => undefined}
                constraints={{ facingMode: "environment" }}
              />
            ) : null}
          </div>
          <div className="flex justify-end p-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
