import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Usuario } from "@/data/types";

interface SessionState {
  user: Usuario | null;
  setUser: (u: Usuario | null) => void;
  logout: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (u) => set({ user: u }),
      logout: () => set({ user: null }),
    }),
    { name: "washinn-session" },
  ),
);
