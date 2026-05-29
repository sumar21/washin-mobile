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

// Renombres de display (no afectan rutas ni permisos).
export const NAV_LABELS: Record<string, string> = {
  "Registro de visita": "Mis Visitas",
  "Detalle Maquina": "Detalle de Máquina",
  ABM: "Configuración",
};
