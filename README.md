# Washinn — PWA Mobile

Réplica en React + shadcn/ui de la app PowerApps **Washinn** (gestión de mantenimiento técnico de edificios y lavanderías Wash-Inn). Esta es la **fase 1**: las 15 pantallas con UI completa, navegación funcional, multi-rol, y **datos mock** (sin backend real).

## Stack

- **Vite 5 + React 18 + TypeScript** (strict)
- **Tailwind CSS 3 + shadcn/ui** (estilo `new-york`, tema neutral con accent azul Wash-Inn)
- **React Router v6** (data routers, guards por rol)
- **Zustand** + persist (sesión)
- **TanStack Query** (cache + mock fetcher)
- **React Hook Form + Zod** (forms)
- **lucide-react**, **date-fns/es**, **recharts**, **vaul** (Drawer), **sonner** (toasts)
- **vite-plugin-pwa** (manifest + service worker)
- **@yudiel/react-qr-scanner** (QR vía getUserMedia)
- **localforage** (cache offline para futura cola)

## Scripts

```bash
npm install        # instalar dependencias
npm run dev        # http://localhost:5173 (mobile-first)
npm run build      # build de producción + PWA
npm run preview    # servir el build
npm run typecheck  # tsc --noEmit
```

## Usuarios mock

| Usuario | Contraseña | Rol | Ve |
|---|---|---|---|
| `admin` | `admin` | Admin | Todos los módulos (incluye ABM, Mails, alta de edificios/personas) |
| `super` | `1234` | Supervisor | Operativos + Métricas + Edificios |
| `tecnico1` | `1234` | Tecnico | Solo módulos operativos (sus propios registros) |

## Pantallas

| Ruta | Componente | Descripción |
|---|---|---|
| `/` | ScreenStart | Splash con timer 1.8 s |
| `/login` | ScreenLogin | Auth contra `usuarios.json` (mock) |
| `/home` | ScreenHome | Hub con módulos filtrados por rol + registros del día |
| `/checklist` | ScreenCheckList | Items Sí/No con observación obligatoria, foto general, progreso |
| `/edificios` | ScreenEdificios | Lista buscable, GPS coords |
| `/edificios/nuevo` | ScreenCrearEdificios | Form alta con validación email + GPS button (Admin) |
| `/planificaciones` | ScreenPlanificaciones | Circuitos del mes con QR scanner + GPS |
| `/ventilaciones` | ScreenVentilaciones | Programar / Finalizar con foto + observación |
| `/maquinas` | ScreenDetalleMaquina | Filtros marca / modelo / encendido |
| `/maquinas/:id/historial` | ScreenHM | Historial de incidentes de una máquina |
| `/personas/nueva` | ScreenCrearPersona | Form alta con generación auto de usuario/password (Admin) |
| `/incidentes` | ScreenIncidentes | Tabs Abiertos/Cerrados, crear, anular con notificación |
| `/abm` | ScreenABM | Tabs Edificios / Personas con CRUD y cambio de estado (Admin) |
| `/mails` | ScreenMails | Plantillas HTML, preview, envío mock (Admin) |
| `/metricas` | ScreenMetricas | Chart de estados + reporte de problemas + export CSV |

## Estructura

```
src/
├── components/
│   ├── ui/         ← shadcn primitives (button, input, card, dialog, drawer, sheet, ...)
│   ├── layout/     ← PhoneFrame, ScreenHeader, BottomNav, HamburgerMenu, AppShell, Guards
│   └── shared/     ← StatusBadge, EmptyState, PhotoCapture, QrScannerButton, GpsButton, SearchBar
├── screens/        ← Las 15 pantallas
├── stores/         ← sessionStore (zustand + persist)
├── data/
│   ├── types.ts    ← Interfaces TS de las 30 listas SharePoint
│   ├── mock/       ← JSON con datos representativos en español argentino
│   └── api.ts      ← mockFetch / mockMutation; reemplazar por SP / Graph en fase 2
├── lib/
│   ├── auth.ts        ← validación contra usuarios.json
│   ├── permissions.ts ← Collect_LPP → módulos visibles por rol
│   ├── format.ts      ← genUsername(), genPassword(ddmm), isValidEmail(), fechas
│   └── utils.ts       ← cn() (shadcn)
├── routes.tsx      ← rutas + AuthGuard + RoleGuard
├── main.tsx        ← QueryClient + RouterProvider + Toaster
└── index.css       ← tema shadcn (zinc + accent azul)
```

## Migración del backend (fase 2)

Todos los Patch / Filter / Run de la app PowerApps original están encapsulados en `src/data/api.ts`. Para conectar SharePoint real:

1. Reemplazar las funciones de `api` por llamadas a Microsoft Graph (`@microsoft/microsoft-graph-client`) o `@pnp/sp`.
2. Mantener las mismas `queryKey` y los mismos retornos para no tocar las pantallas.
3. Agregar autenticación MSAL (`@azure/msal-react`) en lugar de `lib/auth.ts` mock.
4. Implementar los 5 flujos Power Automate (Washinn, Washinn Visita, Washinn Incidente, Washinn inicio descanso, WashInn-FotoVentilacion) o sus equivalentes vía API.

## Notas

- Los íconos `icon-192.png` / `icon-512.png` son **placeholders** (copia del logo JPG renombrada). Reemplazar por PNGs reales antes de publicar para que el manifest pase validación estricta.
- El logo `logo-washinn.jpg` se extrajo del archivo `Washinn App.msapp` original (`Resources/uipqlnb1.jpg`).
- Los textos de la UI están en **español argentino**, espejando los de la app PowerApps original.
- Toda la app está pensada en formato celular (480 px). En desktop se muestra centrada en un marco con sombra.
- No se implementa lógica de negocio: los Patch/Send/Run son stubs que loguean en consola y muestran toasts.
