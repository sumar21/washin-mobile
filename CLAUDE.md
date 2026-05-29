# Washinn Mobile — Guía de diseño y responsive

> Este archivo se carga automáticamente como contexto en cada sesión de Claude Code.
> Mantenerlo corto y operativo. Si una regla deja de aplicarse, actualizarla aquí.

## Principio rector

**Mobile-first, 100% responsive.** La app se diseña pensando primero en el celular (uso principal), pero debe verse bien y ser usable en tablet y desktop. Nunca asumir que solo se usa en mobile.

- Diseñar siempre desde el viewport más chico hacia arriba.
- Usar breakpoints de Tailwind para escalar — no para "arreglar" desktop al final.
- Aprovechar el espacio extra en pantallas grandes (más columnas, sidebar visible, mejor densidad de información) — no estirar componentes mobile a 1920px de ancho.
- El contenido principal debe llenar bien el desktop sin estirarse en monitores gigantes. Anchos de referencia:
  - **Dashboards / tablas / listas densas:** hasta `max-w-[1400px]` (≈`max-w-7xl`), centrado, con gutters progresivos `px-4 md:px-6 lg:px-8`.
  - **Formularios y lectura:** `max-w-2xl`.
  - El **shell** (`AppShell`) es full-width en desktop (`md:max-w-none`); cada pantalla define su propio `max-w` de contenido. No reintroducir un cap angosto en el shell (causaba la "columna mobile flotante" en desktop).

## Breakpoints (Tailwind)

Usar siempre los breakpoints estándar de Tailwind. No inventar tamaños custom salvo necesidad clara.

| Prefijo  | Min width | Target                          |
|----------|-----------|---------------------------------|
| (base)   | 0px       | Mobile portrait (diseño base)   |
| `sm:`    | 640px     | Mobile landscape / phablet      |
| `md:`    | 768px     | Tablet portrait                 |
| `lg:`    | 1024px    | Tablet landscape / laptop chico |
| `xl:`    | 1280px    | Desktop                         |
| `2xl:`   | 1536px    | Desktop grande                  |

> Nota: en `tailwind.config.ts` el container override usa `sm: 480px` para el shell mobile. Eso es solo para `container`; el resto de utilities usan los defaults arriba.

## Patrones obligatorios

### Layout
- **Containers fluidos:** usar `w-full` + `max-w-*` + `mx-auto`. Nunca anchos fijos en `px` salvo en el `PhoneFrame` simulado.
- **Spacing escalable:** `p-4 md:p-6 lg:p-8` en vez de un padding fijo.
- **Grid antes que flex** para layouts de listas/cards multi-columna: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- **Navegación:** `BottomNav` en mobile, `Sidebar` en `md:` en adelante. Nunca mostrar ambas a la vez.
- **AppShell** ([src/components/layout/AppShell.tsx](src/components/layout/AppShell.tsx)) es el shell responsive — toda pantalla nueva debe encajar dentro de él, no romperlo.

### Tipografía
- Base mobile: `text-sm` / `text-base`. Escalar arriba: `text-base md:text-lg`.
- Títulos: `text-xl md:text-2xl lg:text-3xl`. Nunca `text-5xl` en mobile.
- `leading-*` siempre explícito en bloques de texto largo.

### Touch targets
- Mínimo **44×44px** para cualquier elemento clickeable en mobile (`min-h-11 min-w-11` o equivalente con padding).
- Inputs: `h-11` mínimo en mobile, opcional `md:h-10` en desktop.

### Imágenes y media
- Siempre `max-w-full h-auto` o `object-cover` con contenedor con aspect ratio.
- Usar `aspect-*` utilities (`aspect-video`, `aspect-square`) en vez de heights fijos.

### Forms
- Mobile: una columna, inputs `w-full`.
- Desktop (`md:` o `lg:`): grid de 2 columnas cuando ayude (`md:grid-cols-2`), nunca forzar.
- Botones de acción primaria full-width en mobile, `md:w-auto` en desktop.

### Tablas y listas densas
- En mobile: convertir a cards apiladas (no scroll horizontal salvo último recurso).
- En `md:` o `lg:` en adelante: tabla real con todas las columnas.

## Anti-patrones (NO hacer)

- ❌ Anchos en `px` fijos para layout (`w-[400px]` para un container).
- ❌ Esconder funcionalidad importante en desktop con `hidden md:hidden`.
- ❌ Diseñar primero en desktop y "achicar" para mobile.
- ❌ Forzar el `PhoneFrame` mobile en desktop como única vista — el desktop tiene que sentirse desktop (sidebar, más densidad).
- ❌ Usar `100vh` sin pensar en mobile (problemas con barras de browser). Usar `min-h-screen` o `dvh`.
- ❌ Tocar elementos < 44px en mobile.

## Cómo verificar responsive antes de declarar terminado

Cuando se modifica una pantalla:
1. Ver en mobile (~375px de ancho) — uso principal.
2. Ver en tablet (~768px) — transición.
3. Ver en desktop (~1280px+) — sidebar visible, contenido bien distribuido.
4. Probar interacciones con touch targets (no solo mouse).

## Stack y referencias del proyecto

- **Vite + React + TypeScript** ([package.json](package.json))
- **Tailwind** con tokens HSL en CSS vars ([src/index.css](src/index.css), [tailwind.config.ts](tailwind.config.ts))
- **shadcn/ui** en [src/components/ui/](src/components/ui/) — preferir extender estos componentes antes que crear nuevos.
- **React Router** ([src/routes.tsx](src/routes.tsx))
- Las pantallas viven en [src/screens/](src/screens/) y consumen el shell responsive [AppShell](src/components/layout/AppShell.tsx).
