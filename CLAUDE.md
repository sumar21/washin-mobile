# Washinn Mobile — Guía de diseño y responsive

> Este archivo se carga automáticamente como contexto en cada sesión de Claude Code.
> Mantenerlo corto y operativo. Si una regla deja de aplicarse, actualizarla aquí.

## Principio rector

**Mobile-first, 100% responsive.** La app se diseña pensando primero en el celular (uso principal), pero debe verse bien y ser usable en tablet y desktop. Nunca asumir que solo se usa en mobile.

- Diseñar siempre desde el viewport más chico hacia arriba.
- Usar breakpoints de Tailwind para escalar — no para "arreglar" desktop al final.
- Aprovechar el espacio extra en pantallas grandes (más columnas, sidebar visible, mejor densidad de información) — no estirar componentes mobile a 1920px de ancho.
- El contenido principal debe llenar bien el desktop sin estirarse en monitores gigantes. Anchos de referencia:
  - **Dashboards / tablas / listas densas:** hasta `max-w-[1600px]`, centrado, con gutters **ajustados** `px-4 md:px-6` (no `lg:px-8`). Priorizar densidad: el contenido tiene que usar el ancho, no dejar franjas vacías a los costados.
  - **Formularios y lectura:** `max-w-2xl`.
  - El **shell** (`AppShell`) es full-width en desktop (`md:max-w-none`); cada pantalla define su propio `max-w` de contenido. No reintroducir un cap angosto en el shell (causaba la "columna mobile flotante" en desktop).

### Optimizar espacio en desktop/tablet (regla general)
> Responsive **no** es "la vista mobile más ancha". Los layouts tienen que cambiar y aprovechar la pantalla.

- **Gaps laterales:** minimizar las franjas vacías a los costados. Para listas/dashboards usar `max-w-[1600px]` + gutters `px-4 md:px-6` (no estirar gutters con `lg:px-8` que regalan ancho). El contenido manda; el aire sobrante no.
- **Headers finos:** los encabezados de módulo en desktop deben ser **compactos**, no copiar la altura del header mobile centrado. Padding vertical chico (`pt-4 pb-3` o menos), título `text-lg lg:text-xl`, subtítulo/contador en `text-xs`. Nada de `pt-7`/títulos `text-2xl` que inflan la barra.
- **Más columnas, no componentes estirados:** ganar densidad sumando columnas en el grid (`xl:grid-cols-4`+), no agrandando cada card.

## Desktop ≠ mobile — playbook obligatorio

> **Regla de oro:** el desktop NO es la vista mobile estirada a lo ancho. Es un layout distinto.
> Antes de dar por terminada una pantalla, preguntarse: "¿en desktop esto es solo más ancho, o
> realmente cambia?". Si es solo más ancho, está mal. Estos patrones ya están resueltos en
> componentes reusables — usarlos siempre, no reinventar.

### Encabezado de cada pantalla (mobile vs desktop)
Dos componentes, uno por viewport — **no** usar el header centrado de mobile en desktop:
- **Mobile:** [ScreenHeader](src/components/layout/ScreenHeader.tsx) con `className="md:hidden"`
  (título + back + acciones, centrado y compacto).
- **Desktop/tablet:** [ModuleHeader](src/components/layout/ModuleHeader.tsx) (`hidden md:block`) —
  título a la izquierda + contador en `text-xs` + controles a la derecha. Compacto (`py-2.5`,
  **sin `safe-top`** que es solo para el notch mobile). Tiene prop `back` para subpáginas de detalle.
- **Buscador / filtros:** en mobile van en el **contenido** (debajo del header); en desktop van
  **dentro del ModuleHeader** (a la derecha). Patrón de referencia: [ScreenDetalleMaquina](src/screens/ScreenDetalleMaquina.tsx).

### Modales y sheets → SIEMPRE responsive
**Nunca** un bottom-sheet (Drawer) a todo el ancho en desktop. Usar
[ResponsiveDialog](src/components/ui/responsive-dialog.tsx): **Dialog centrado** (`max-w-sm/md`) en
desktop, **Drawer (bottom sheet)** en mobile. Mismo contenido, distinto contenedor. Para contenido
con padding propio usar `className="p-0"` + `desktopClassName="max-w-md rounded-2xl"` y padding por
sección. Referencias: modales de [ScreenHM](src/screens/ScreenHM.tsx) y [ScreenVentilaciones](src/screens/ScreenVentilaciones.tsx).

### Listas densas (dashboards, máquinas, ventilaciones, incidentes)
`max-w-[1600px]` + gutters `px-4 md:px-6` + grid `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
Filtro de muchas opciones (p. ej. 400+ edificios) = **Combobox buscable**
([src/components/shared/Combobox.tsx](src/components/shared/Combobox.tsx)), no un `<select>` plano.
Botón de filtros = [MaquinaFilterButton](src/components/shared/MaquinaFilterButton.tsx) (Popover en
desktop / Drawer en mobile), no dropdowns inline estirados.

### Páginas de detalle (subpáginas)
Layout de **2 columnas en desktop** (contexto sticky a la izquierda + contenido/timeline a la
derecha), apilado en mobile. Flecha de volver con `ModuleHeader back={ruta}` (preserva filtros vía
`location.state`). Ej.: historial de máquina en [ScreenHM](src/screens/ScreenHM.tsx).

### shadcn primero (tarjetas, íconos, inputs)
- **Tarjetas:** `Card`/`CardContent`/`CardFooter`. **Íconos:** `lucide-react`. Nada hecho a mano si
  existe el componente shadcn.
- **Fechas:** date picker = `Calendar` de shadcn **inline** ([src/components/ui/calendar.tsx](src/components/ui/calendar.tsx)),
  grande y en español, **nunca** `<input type="date">` nativo. Pensar en el usuario (técnico en obra,
  ajeno a la tecnología): mostrar la fecha elegida en palabras ("Martes 17 de junio de 2026").
- SharePoint guarda fechas como texto `dd/mm/yyyy`; convertir con [src/lib/fecha.ts](src/lib/fecha.ts).

### Verificar antes de declarar terminado
Ver en ~375px (mobile), ~768px (tablet) y ~1280px+ (desktop). En desktop confirmar: header fino, sin
franjas vacías a los costados, modales centrados (no sheets estirados), y que el layout **cambie**
respecto de mobile (no solo se ensanche).

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
