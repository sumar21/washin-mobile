import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Usuario } from "@/data/types";

export interface CurrentVisit {
  IDUnico: string;
  Codigo: string;
  Edificio: string;
  Direccion: string;
  Fecha: string;
  HoraInicio: string;
  qrScanned?: boolean;
}

export interface CurrentBreak {
  startedAt: string; // ISO timestamp
}

interface SessionState {
  user: Usuario | null;
  currentVisit: CurrentVisit | null;
  currentBreak: CurrentBreak | null;
  setUser: (u: Usuario | null) => void;
  setCurrentVisit: (v: CurrentVisit | null) => void;
  startBreak: () => void;
  endBreak: () => void;
  logout: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      currentVisit: null,
      currentBreak: null,
      setUser: (u) => set({ user: u }),
      setCurrentVisit: (v) => set({ currentVisit: v }),
      startBreak: () => set({ currentBreak: { startedAt: new Date().toISOString() } }),
      endBreak: () => set({ currentBreak: null }),
      logout: () => set({ user: null, currentVisit: null, currentBreak: null }),
    }),
    { name: "washinn-session" },
  ),
);
