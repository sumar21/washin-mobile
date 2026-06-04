# PowerApps — fuente de referencia (read-only)

Esta carpeta contiene el **código fuente extraído** del export de PowerApps
`Washinn App.msapp` (la app original que estamos reconstruyendo en React).

Es la **spec autoritativa**: cuando portamos una pantalla al backend/React, la
lógica exacta (filtros, `Patch`, validaciones, estados) se lee de acá.

## Contenido

- `Src/*.pa.yaml` — una pantalla por archivo, con todas sus fórmulas
  (`OnSelect`, `OnVisible`, `OnStart`, `ClearCollect`, `Patch`, etc.).
  - `Src/App.pa.yaml` → `App.OnStart`: colecciones globales precargadas.
  - `Src/ScreenHome.pa.yaml` → el `OnSelect` de los botones de módulo define
    los fetches iniciales de cada pantalla (los "ClearCollect ... ; Navigate").
- `References/DataSources.json` — todas las data sources: listas SharePoint,
  `Office365Outlook` (mails) y flujos Power Automate (`WashInn-FotoVentilacion`,
  `WashinnVisita`, `WashinnIncidente`, `Washinniniciodescanso`, ...).
- `References/Properties.json` — propiedades de la app.

## Reglas

- **NO editar a mano** lo de esta carpeta. Es generado.
- Regenerar tras actualizar el `.msapp`:

  ```bash
  python scripts/extract-msapp.py
  ```

- El `.msapp` binario está en `.gitignore` (pesa ~12 MB). Lo versionado es esta
  fuente extraída, que es greppable y diffeable.

## Cómo se usa al reconstruir

1. Identificar la pantalla → abrir su `Src/Screen_*.pa.yaml`.
2. Para los datos iniciales, buscar el `OnSelect` del módulo en
   `Src/ScreenHome.pa.yaml` (el `ClearCollect(...)` previo al `Navigate`).
3. Para las escrituras, buscar los `Patch(...)` / `Collect(...)` de los controles
   de la pantalla.
4. Mapear nombres de columna internos con [`../sharepoint-schema.md`](../sharepoint-schema.md).
5. Portar al patrón backend (`api/_lib/<x>.ts` → `api/<x>.ts` → `src/lib/api-client.ts`
   → pantalla). Ver `api/_lib/ventilaciones.ts` como template.
