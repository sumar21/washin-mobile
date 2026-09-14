import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { router } from "@/routes";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 2 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* El Toaster va ANTES que el router, no después. Los efectos de hermanos corren en orden:
          con el Toaster al final, su suscripción arrancaba DESPUÉS de los efectos de las pantallas,
          y un toast disparado sincrónicamente ahí se perdía. Caso real: al recargar tras un
          descarte, useBorrador restauraba los campos y avisaba "Recuperamos lo que tenías
          cargado" — pero si el borrador no tenía foto (sin await de por medio) el aviso nunca se
          veía. Justo el caso de la cámara que se lleva la app, que nunca tiene foto. */}
      <Toaster position="top-center" richColors closeButton />
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
