// Config compartida de navegación: define qué módulos se muestran en el menú
// (sidebar desktop + hamburguesa mobile) y sus labels amigables. Sidebar y
// hamburguesa consumen esto desde un único lugar para no divergir.

export const NAV_VISIBLE = new Set<string>([
  "Registro de visita",
  "Detalle Maquina",
  "Incidentes",
  "Ventilaciones",
  "ABM",
]);

// Módulos cuya RUTA está restringida a Admin (RoleGuard en routes.tsx). No se ofrecen
// en la navegación a otros roles para no mostrar accesos que serían rechazados.
export const ADMIN_ONLY = new Set<string>(["ABM", "Mails"]);

// Renombres de display (no afectan rutas ni permisos).
export const NAV_LABELS: Record<string, string> = {
  "Registro de visita": "Mis Visitas",
  "Detalle Maquina": "Detalle de Máquina",
  ABM: "Configuración",
};

// Mapa módulo → ruta (la lista 99.ListaPermisosMobile no tiene columna de ruta;
// el routing vive en el front). Modulo_LPM tal como viene de SharePoint.
export const MODULE_ROUTE: Record<string, string> = {
  "Registro de visita": "/planificaciones",
  "Detalle Maquina": "/maquinas",
  Incidentes: "/incidentes",
  Ventilaciones: "/ventilaciones",
  Edificios: "/edificios",
  ABM: "/abm",
  Mails: "/mails",
  Checklist: "/checklist",
};
