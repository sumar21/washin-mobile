import * as React from "react";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/hooks/use-media-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";

// "Credenza": un solo set de componentes que renderiza Dialog en desktop (md+) y Drawer
// (bottom sheet) en mobile. El breakpoint se comparte por contexto para que todas las partes
// coincidan dentro del mismo render.
const ResponsiveDialogContext = React.createContext<boolean>(true);
const useResponsiveIsDesktop = () => React.useContext(ResponsiveDialogContext);

interface RootProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function ResponsiveDialog({ open, onOpenChange, children }: RootProps) {
  const isDesktop = useIsDesktop();
  const Root = isDesktop ? Dialog : Drawer;
  return (
    <ResponsiveDialogContext.Provider value={isDesktop}>
      <Root open={open} onOpenChange={onOpenChange}>
        {children}
      </Root>
    </ResponsiveDialogContext.Provider>
  );
}

const ResponsiveDialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogContent> & {
    // Clases solo para desktop (Dialog: ancho/centrado) o solo mobile (Drawer: bottom sheet).
    desktopClassName?: string;
    mobileClassName?: string;
  }
>(({ className, desktopClassName, mobileClassName, children, ...props }, ref) => {
  const isDesktop = useResponsiveIsDesktop();
  const Content = isDesktop ? DialogContent : DrawerContent;
  return (
    <Content
      ref={ref}
      className={cn(className, isDesktop ? desktopClassName : mobileClassName)}
      {...props}
    >
      {children}
    </Content>
  );
});
ResponsiveDialogContent.displayName = "ResponsiveDialogContent";

function ResponsiveDialogHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  const isDesktop = useResponsiveIsDesktop();
  const Header = isDesktop ? DialogHeader : DrawerHeader;
  return <Header {...props} />;
}

function ResponsiveDialogFooter(props: React.HTMLAttributes<HTMLDivElement>) {
  const isDesktop = useResponsiveIsDesktop();
  const Footer = isDesktop ? DialogFooter : DrawerFooter;
  return <Footer {...props} />;
}

const ResponsiveDialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof DialogTitle>
>((props, ref) => {
  const isDesktop = useResponsiveIsDesktop();
  const Title = isDesktop ? DialogTitle : DrawerTitle;
  return <Title ref={ref} {...props} />;
});
ResponsiveDialogTitle.displayName = "ResponsiveDialogTitle";

const ResponsiveDialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof DialogDescription>
>((props, ref) => {
  const isDesktop = useResponsiveIsDesktop();
  const Description = isDesktop ? DialogDescription : DrawerDescription;
  return <Description ref={ref} {...props} />;
});
ResponsiveDialogDescription.displayName = "ResponsiveDialogDescription";

function ResponsiveDialogClose(
  props: React.ComponentPropsWithoutRef<typeof DialogClose>,
) {
  const isDesktop = useResponsiveIsDesktop();
  const Close = isDesktop ? DialogClose : DrawerClose;
  return <Close {...props} />;
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogClose,
};
