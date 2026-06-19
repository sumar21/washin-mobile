import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell, AuthShell } from "@/components/layout/AppShell";
import { AuthGuard, RoleGuard } from "@/components/layout/Guards";

import ScreenStart from "@/screens/ScreenStart";
import ScreenLogin from "@/screens/ScreenLogin";
import ScreenHome from "@/screens/ScreenHome";
import ScreenCheckList from "@/screens/ScreenCheckList";
import ScreenEdificios from "@/screens/ScreenEdificios";
import ScreenCrearEdificios from "@/screens/ScreenCrearEdificios";
import ScreenPlanificaciones from "@/screens/ScreenPlanificaciones";
import ScreenRegistroDetalle from "@/screens/ScreenRegistroDetalle";
import ScreenVentilaciones from "@/screens/ScreenVentilaciones";
import ScreenHM from "@/screens/ScreenHM";
import ScreenDetalleMaquina from "@/screens/ScreenDetalleMaquina";
import ScreenCrearPersona from "@/screens/ScreenCrearPersona";
import ScreenIncidentes from "@/screens/ScreenIncidentes";
import ScreenIncidenteForm from "@/screens/ScreenIncidenteForm";
import ScreenABM from "@/screens/ScreenABM";
import ScreenMails from "@/screens/ScreenMails";

export const router = createBrowserRouter([
  {
    element: <AuthShell />,
    children: [
      { path: "/", element: <ScreenStart /> },
      { path: "/login", element: <ScreenLogin /> },
    ],
  },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/home", element: <ScreenHome /> },
          { path: "/checklist", element: <ScreenCheckList /> },
          { path: "/edificios", element: <ScreenEdificios /> },
          { path: "/planificaciones", element: <ScreenPlanificaciones /> },
          { path: "/registros", element: <ScreenRegistroDetalle /> },
          { path: "/ventilaciones", element: <ScreenVentilaciones /> },
          { path: "/maquinas", element: <ScreenDetalleMaquina /> },
          { path: "/maquinas/:id/historial", element: <ScreenHM /> },
          { path: "/incidentes", element: <ScreenIncidentes /> },
          { path: "/incidentes/nuevo", element: <ScreenIncidenteForm /> },
          {
            path: "/incidentes/:id/revisar",
            element: <ScreenIncidenteForm />,
          },
        ],
      },
      {
        element: <RoleGuard roles={["Admin"]} />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: "/abm", element: <ScreenABM /> },
              { path: "/edificios/nuevo", element: <ScreenCrearEdificios /> },
              { path: "/personas/nueva", element: <ScreenCrearPersona /> },
              { path: "/mails", element: <ScreenMails /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
