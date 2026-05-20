import { Outlet } from "react-router-dom";
import { PhoneFrame } from "@/components/layout/PhoneFrame";
import { Sidebar } from "@/components/layout/Sidebar";

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <div className="flex min-w-0 flex-1 justify-center md:bg-background">
        {/* Mobile: PhoneFrame; desktop: panel ancho con max-w para legibilidad */}
        <div className="relative flex w-full max-w-[480px] flex-col bg-gradient-to-br from-slate-50 via-background to-sky-50/40 shadow-2xl sm:my-4 sm:rounded-3xl sm:overflow-hidden md:my-0 md:max-w-5xl md:rounded-none md:bg-background md:shadow-none dark:from-slate-950 dark:via-background dark:to-blue-950/30">
          {/* Glow decorativo arriba */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 left-1/2 -z-0 h-56 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"
          />
          {/* Glow decorativo abajo */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 right-0 -z-0 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl dark:bg-cyan-500/5"
          />
          <main className="relative flex-1 overflow-y-auto pb-2">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export function AuthShell() {
  return (
    <PhoneFrame>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </PhoneFrame>
  );
}
