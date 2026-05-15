import { Outlet } from "react-router-dom";
import { PhoneFrame } from "@/components/layout/PhoneFrame";
import { BottomNav } from "@/components/layout/BottomNav";

export function AppShell({ withBottomNav = true }: { withBottomNav?: boolean }) {
  return (
    <PhoneFrame>
      <main className="flex-1 overflow-y-auto pb-2">
        <Outlet />
      </main>
      {withBottomNav ? <BottomNav /> : null}
    </PhoneFrame>
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
