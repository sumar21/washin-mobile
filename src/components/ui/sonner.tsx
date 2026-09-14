import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// `pointer-events-auto` va a propósito. Con un diálogo o drawer abierto, Radix le pone
// `pointer-events: none` inline al <body> y todo lo que está afuera del diálogo lo hereda, avisos
// incluidos: el botón "Descartar" de "Recuperamos lo que tenías cargado" se veía pero no se podía
// tocar justo en los formularios que viven en un diálogo (resolver, finalizar ventilación).
// La otra mitad del arreglo está en DialogContent / DrawerContent: `noCerrarAlTocarUnAviso`.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group pointer-events-auto"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

/**
 * Tocar un aviso no es "tocar afuera" del diálogo. Sin esto, habilitar el toque (ver arriba) no
 * alcanzaba: Radix toma el toque como un clic fuera y cierra el diálogo, y el técnico pierde lo que
 * estaba mirando justo cuando quería descartar un borrador. Se engancha en `onPointerDownOutside`.
 */
function noCerrarAlTocarUnAviso(event: Event) {
  const target = event.target;
  if (target instanceof Element && target.closest("[data-sonner-toaster]")) event.preventDefault();
}

export { Toaster, noCerrarAlTocarUnAviso };
