import { Outlet } from "react-router-dom";
import { PhoneFrame } from "@/components/layout/PhoneFrame";
import { BottomNav } from "@/components/layout/BottomNav";
import { Sidebar } from "@/components/layout/Sidebar";

export function AppShell({ withBottomNav = true }: { withBottomNav?: boolean }) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <div className="flex min-w-0 flex-1 justify-center md:bg-background">
        {/* Mobile: PhoneFrame; desktop: panel ancho con max-w para legibilidad */}
        <div className="flex w-full max-w-[480px] flex-col bg-background shadow-2xl sm:my-4 sm:rounded-3xl sm:overflow-hidden md:my-0 md:max-w-5xl md:rounded-none md:shadow-none">
          <main className="flex-1 overflow-y-auto pb-2">
            <Outlet />
          </main>
          {withBottomNav ? <BottomNav /> : null}
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
