import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";

export function AppShell() {
  return (
    // h-screen (altura fija del viewport) + overflow-hidden: el scroll vive SOLO en <main>,
    // así el header sticky de cada pantalla queda realmente fijo arriba.
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <Sidebar />
      {/* Canvas fluido a todo ancho. Gradiente sutil <md; bg-background en md+ (el Sidebar da el marco).
          min-h-0 en <main> es clave: permite scroll interno (header sticky queda fijo). */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-slate-50 to-sky-50/30 md:bg-background dark:from-slate-950 dark:to-blue-950/20">
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AuthShell() {
  // Sin PhoneFrame: cada pantalla de auth (Login/Start) trae su propio fondo full-bleed
  // y centra su contenido. Así en desktop el gradiente llena el viewport (no una tarjeta
  // mobile flotante) y en mobile se ve igual que antes.
  return (
    <main className="min-h-dvh overflow-x-hidden">
      <Outlet />
    </main>
  );
}
