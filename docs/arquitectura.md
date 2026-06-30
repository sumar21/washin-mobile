# Arquitectura — Washinn Mobile

> Referencia técnica interna. Para guía de diseño y responsive ver [../CLAUDE.md](../CLAUDE.md).
> Para el mapa de pantallas y endpoints ver [mapa-app.md](mapa-app.md).

---

## Stack y capas

```
React SPA (Vite)
  └─ src/lib/api-client.ts   (authFetch, adjunta JWT, hace logout en 401)
       └─ /api/*             (funciones serverless Vite — api/*.ts)
            └─ api/_lib/graph.ts  (Graph API: getListItemsFiltered, resolveListId, escapeODataValue…)
                 └─ SharePoint Online (listas del tenant)
```

| Capa | Tecnología | Dónde vive |
|---|---|---|
| UI | React 18 + TypeScript | `src/screens/`, `src/components/` |
| Estado cliente | Zustand + TanStack React Query | `src/stores/`, hooks inline |
| Routing | React Router v6 | [`src/routes.tsx`](../src/routes.tsx) |
| API (serverless dev) | Vite custom middleware | `api/*.ts` |
| Helpers SharePoint | Graph API helpers | [`api/_lib/graph.ts`](../api/_lib/graph.ts) |
| Auth tokens | JWT HS256 | [`api/_lib/jwt.ts`](../api/_lib/jwt.ts) |
| Shell responsive | AppShell + Guards | [`src/components/layout/AppShell.tsx`](../src/components/layout/AppShell.tsx) |

---

## Autenticación y sesión

**Flujo JWT:**

1. `POST /api/login` con `{usuario, password}` → [`api/_lib/users.ts`](../api/_lib/users.ts) valida contra la lista SharePoint `Usuarios`.
2. Si OK, [`api/_lib/jwt.ts`](../api/_lib/jwt.ts) firma un JWT HS256 (12h), claims: `{sub, usuario, rol, nombre}`.
3. El cliente almacena `{user, token}` en [`src/stores/sessionStore.ts`](../src/stores/sessionStore.ts) (Zustand, persist en `localStorage` key `"washinn-session"`).
4. Cada request posterior pasa por `authFetch` ([`src/lib/api-client.ts`](../src/lib/api-client.ts)): adjunta `Authorization: Bearer <token>`. Un 401 llama a `logout()` y redirige a `/login`.
5. El servidor verifica el token en `getAuth` ([`api/_lib/http.ts`](../api/_lib/http.ts)), leído del header `Authorization: Bearer`.

**Stores:**

- `sessionStore` — `user`, `token`, `currentVisit` `{IDUnico, Codigo, Edificio, Direccion, Fecha, HoraInicio, qrScanned}`, `currentBreak`. Persist localStorage.
- Server-state de listas → **TanStack React Query** (cada pantalla tiene sus `queryKey`; las mutaciones llaman a `invalidateQueries` para refrescar).

---

## Flujo de datos: lectura y escritura

**Patrón general (lectura):**

```
pantalla (useQuery)
  → authFetch("GET /api/<módulo>?...")
    → api/<módulo>.ts: llama api/_lib/<módulo>.ts
      → getListItemsFiltered(listId, filter, columns)  // graph.ts
        → Graph API $filter + $select → SP list items
          → mapeo interno → JSON response
```

**Patrón general (escritura):**

```
pantalla (useMutation)
  → authFetch("POST /api/<módulo>", { action, ...payload })
    → api/<módulo>.ts: llama api/_lib/<módulo>.ts
      → patchListItem / createListItem  // graph.ts
        → Graph API PATCH/POST → SP list item
```

**Helpers clave en [`api/_lib/graph.ts`](../api/_lib/graph.ts):**

- `resolveListId(listName)` — resuelve nombre de lista (constante `L_XXX`) → ID de SP.
- `getListItemsFiltered(listId, filter, columns)` — GET con `$filter` + `$select`. El helper `escapeODataValue()` sanitiza strings en filtros OData.
- Campos con sufijo `_XX` (p.ej. `IDMaquina_DM`, `Edificio_RV`) son nombres internos de columnas Graph; las interfaces TypeScript los mapean con el mismo nombre o a un campo limpio.

**Ejemplo concreto — ciclo de visita:**

```
1. Técnico abre /planificaciones → GET /api/planificaciones?circuitos
   → lista 16.DetallePlanificaciones + 18.EdificiosVisitar

2. Selecciona un edificio → POST /api/planificaciones { action:"iniciar" }
   → crea fila en 15.ResumenPlanificaciones, escribe HoraInicio
   → sessionStore.currentVisit = { IDUnico, Edificio, ... }

3. Completa el checklist → /checklist (lee ABM.Checklist)
   → items marcados se persisten en 02.Detalles

4. Finaliza → POST /api/planificaciones { action:"finalizar" }
   → actualiza fila en 01.Registros (HoraFin, Estado)
   → sessionStore.currentVisit = null
   → invalidateQueries(["/planificaciones"])
```

---

## Estado global

| Store | Qué guarda | Archivo |
|---|---|---|
| `sessionStore` (Zustand) | user, token JWT, visita activa, descanso activo | [`src/stores/sessionStore.ts`](../src/stores/sessionStore.ts) |
| React Query cache | Datos de listas SP (listas, KPIs, incidentes…) | `src/screens/` (hooks inline) |

Zustand es para estado de sesión/navegación (dura entre páginas). React Query es para server-state (se invalida y refetcha).

---

## Navegación y permisos

**Módulos del menú:** vienen de la lista SharePoint `99.ListaPermisosMobile`. Solo las filas con `Activa=true` aparecen. El front filtra además por `NAV_VISIBLE` ([`src/lib/nav.ts`](../src/lib/nav.ts)).

**Ejemplo real — cómo se agregó "Stock Técnico":**

1. Se añadió una fila `Modulo_LPM="Stock Tecnico", Activa=true` en `99.ListaPermisosMobile` en SharePoint.
2. Se agregó `"Stock Tecnico"` a `NAV_VISIBLE` y `MODULE_ROUTE["Stock Tecnico"] = "/stock"` en [`src/lib/nav.ts`](../src/lib/nav.ts).
3. Se creó `ScreenStockTecnico` y se registró la ruta `/stock` en [`src/routes.tsx`](../src/routes.tsx) (bajo `AuthGuard`, sin `RoleGuard`).
4. `ScreenHome` muestra el tile automáticamente al recibir el módulo en la respuesta de `/api/home`.

**Guards en [`src/routes.tsx`](../src/routes.tsx):**

- `AuthGuard` — todas las rutas protegidas (requiere JWT válido).
- `RoleGuard roles=["Admin"]` — rutas `/abm`, `/edificios/nuevo`, `/personas/nueva`, `/mails`.

**Navegación:** `BottomNav` en mobile, `Sidebar` en `md:` en adelante (nunca ambas). Sidebar y hamburguesa consumen `NAV_VISIBLE` / `NAV_LABELS` / `MODULE_ROUTE` de `nav.ts`.

---

## Dev / Build

| Script | Qué hace |
|---|---|
| `npm run dev` | Vite dev server (frontend) |
| `npm run dev:api` | `tsx watch scripts/dev-api.ts` (API serverless local) |
| `npm run dev:all` | `concurrently` front + api |
| `npm run build` | `tsc -b && vite build` |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run preview` | Previsualización del build |

Los scripts en `scripts/*.ts` (ej. `scripts/test-home.ts`) cargan `.env` directamente y corren contra SharePoint real — útiles para probar endpoints sin levantar la app.

---

## Convenciones importantes

- **Mobile-first, cards→tabla:** listas de registros = cards apiladas en mobile (`md:hidden`), tabla (`DataTable`) en desktop (`hidden md:block`). Ver [`CLAUDE.md`](../CLAUDE.md).
- **Modales:** siempre `ResponsiveDialog` ([`src/components/ui/responsive-dialog.tsx`](../src/components/ui/responsive-dialog.tsx)) — Dialog centrado en desktop, Drawer en mobile.
- **Fechas:** SharePoint guarda `dd/mm/yyyy`. Convertir con [`src/lib/fecha.ts`](../src/lib/fecha.ts) (`arToISO`, `isoToAR`, `parseAR`…). El date picker es el `Calendar` de shadcn, no `<input type="date">`.
- **Design system completo:** ver [`../CLAUDE.md`](../CLAUDE.md) (no se duplica aquí).
