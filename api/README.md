# Backend (Vercel Serverless Functions)

API en `/api`, desplegada como funciones serverless en Vercel. Lee datos de SharePoint
vía Microsoft Graph (ver [docs/sharepoint-schema.md](../docs/sharepoint-schema.md)).

## Endpoints

| Método | Ruta          | Descripción                                             |
| ------ | ------------- | ------------------------------------------------------- |
| `GET`  | `/api/health` | Chequeo de conectividad con Graph/SharePoint.           |
| `POST` | `/api/login`  | Login contra la lista `Usuarios`. Body `{ usuario, password }`. |

`POST /api/login` → `200 { user, token }` | `401 { error }` | `400/502 { error }`.
El `user` no incluye password; `token` es un JWT HS256 (12 h) firmado con `AUTH_SECRET`.

Login: compara `field_1` (usuario, case-insensitive) y `field_4` (password) y exige
`Status` ∈ {ALTA, Activo}. La lista es chica, se filtra en memoria.

## Estructura

```
api/
  _lib/
    env.ts          # lee/valida env (process.env)
    graph.ts        # token Graph cacheado + fetch helpers
    sharepoint.ts   # resolveListId, getListItems, getSiteInfo
    users.ts        # authenticateUser contra "Usuarios" (mapeo a AuthUser)
    jwt.ts          # firma/verifica JWT HS256 (node:crypto, sin deps)
    http.ts         # helpers send()/readJsonBody() agnósticos al runtime
  login.ts          # POST /api/login
  health.ts         # GET  /api/health
  tsconfig.json     # typecheck aislado del backend (NodeNext)
```

## Variables de entorno

`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `SHAREPOINT_SITE_ID`, `AUTH_SECRET`.
Ver [`.env.example`](../.env.example). En Vercel se configuran en Project Settings.

## Desarrollo local

- Full-stack: `vercel dev` (sirve front + `/api`). Requiere `.env` en la raíz o `vercel env pull`.
- Solo front: `npm run dev` (Vite proxya `/api` → `http://localhost:3000`, donde debe correr `vercel dev`).

## Verificación

- Typecheck backend: `npx tsc -p api/tsconfig.json --noEmit`
- Prueba real de login (no imprime contraseñas): `npx tsx scripts/test-login.ts`
