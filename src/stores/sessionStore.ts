import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Usuario } from "@/data/types";
import { purgarBorradores } from "@/lib/borrador-store";

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
  /**
   * Cierra la sesión. `purgarBorradores: true` SOLO desde el botón de "Cerrar sesión" (Sidebar /
   * HamburgerMenu). Ver el comentario de la implementación.
   */
  logout: (opts?: { purgarBorradores?: boolean }) => void;
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
      logout: (opts) => {
        // La purga de borradores va SOLO en el logout EXPLÍCITO (el botón de "Cerrar sesión").
        // NO en el logout automático: `authFetch` llama a esto ante CUALQUIER 401 (lib/api-client.ts)
        // y el JWT dura 12 h, o sea que vence a mitad de la jornada del técnico —justo con el
        // checklist a medio cargar—. Purgar ahí le borraba el formulario que tenía abierto en ese
        // mismo momento, que es exactamente lo que el borrador existe para evitar.
        // El caso "celular compartido" ya está cubierto sin purgar: la clave lleva el ID del
        // técnico (lib/borrador.ts) y `podarBorradores({ usuarioId })` barre lo de cualquier otro
        // en el primer montaje después del login (hooks/use-borrador.ts), más el TTL de 12 h.
        if (opts?.purgarBorradores) purgarBorradores();
        set({ user: null, token: null, currentVisit: null, currentBreak: null });
      },
    }),
    { name: "washinn-session" },
  ),
);
