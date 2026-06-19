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
  // Gate de PRESENCIA (doble-QR de PA). La verificación GEO abre la visita en "Pendiente"
  // pero NO confirma presencia: solo el escaneo del QR del edificio (qr_scanCheckList /
  // qr_scanCheckList_EAV) marca presencia. Equivale a CollectHoraInicio de PowerApps:
  //   - qrScanned !== true  → hay visita Pendiente pero falta el QR (CollectHoraInicio vacío).
  //   - qrScanned === true   → QR escaneado y matcheado → HoraInicio marcada → entra al checklist.
  qrScanned?: boolean;
}

export interface CurrentBreak {
  startedAt: string; // ISO timestamp
}

interface SessionState {
  user: Usuario | null;
  token: string | null;
  currentVisit: CurrentVisit | null;
  currentBreak: CurrentBreak | null;
  setUser: (u: Usuario | null) => void;
  setToken: (t: string | null) => void;
  setCurrentVisit: (v: CurrentVisit | null) => void;
  setCurrentBreak: (b: CurrentBreak | null) => void;
  startBreak: () => void;
  endBreak: () => void;
  logout: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      currentVisit: null,
      currentBreak: null,
      setUser: (u) => set({ user: u }),
      setToken: (t) => set({ token: t }),
      setCurrentVisit: (v) => set({ currentVisit: v }),
      setCurrentBreak: (b) => set({ currentBreak: b }),
      startBreak: () => set({ currentBreak: { startedAt: new Date().toISOString() } }),
      endBreak: () => set({ currentBreak: null }),
      logout: () =>
        set({ user: null, token: null, currentVisit: null, currentBreak: null }),
    }),
    { name: "washinn-session" },
  ),
);
