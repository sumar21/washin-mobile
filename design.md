# Washinn Mobile — Sistema de diseño

> Decisiones de diseño "sentadas" (colores, tipografía, tamaños, componentes clave).
> Para reglas de **responsive / layout** ver [CLAUDE.md](CLAUDE.md). Para los **tokens**
> fuente de verdad ver [src/index.css](src/index.css) y [tailwind.config.ts](tailwind.config.ts):
> este archivo documenta el _porqué_ y el _cómo se usan_, no los reemplaza.

## Color

Todos los colores viven como **CSS vars HSL** en [src/index.css](src/index.css) y se exponen
como utilities semánticas en Tailwind (`bg-primary`, `text-muted-foreground`, etc.). **Nunca
hardcodear hex en componentes** — usar siempre el token semántico para que dark mode funcione.

### Azul de marca (primary)

Es el color identitario de la app (header/hero, KPIs, links, estados activos, focus ring).

| Token                  | Light          | Dark           | Aproximado             |
| ---------------------- | -------------- | -------------- | ---------------------- |
| `--primary`            | `212 100% 40%` | `212 100% 55%` | `#005FCC` / `#1A85FF`  |
| `--primary-foreground` | `0 0% 100%`    | `240 5.9% 10%` | blanco / casi negro    |
| `--accent`             | `212 100% 95%` | `212 60% 20%`  | azul muy claro (tints) |
| `--ring`               | `212 100% 40%` | `212 100% 55%` | = primary              |

- **Hero / header de la home:** gradiente `from-primary via-primary to-blue-700`
  (en dark `dark:to-blue-900`). El `blue-700` (#1d4ed8) de Tailwind es el único azul "crudo"
  permitido, y solo como parada final del gradiente del hero.
- **Sobre fondo azul** (hero): textos en `text-primary-foreground` y superficies traslúcidas
  `bg-white/15` + `backdrop-blur-sm` + `ring-white/25`.

### Colores de estado (semánticos)

| Token                            | Light                               | Uso                               |
| -------------------------------- | ----------------------------------- | --------------------------------- |
| `--success`                      | `142 71% 36%`                       | Finalizado / Activo / Resuelto    |
| `--warning`                      | `32 92% 44%`                        | Pendiente / Programada / Asignada |
| `--destructive`                  | `0 84.2% 60.2%`                     | Anular / errores / Anulado        |
| `--muted` / `--muted-foreground` | `240 4.8% 95.9%` / `240 3.8% 46.1%` | fondos suaves, texto secundario   |

- **Pills suaves** (badges de estado y de % completitud): patrón `bg-<token>/10 text-<token>`
  (tint al 10% + texto a color pleno). Ver [StatusBadge](src/components/shared/StatusBadge.tsx)
  y `completitudSoft()` en [ScreenHome](src/screens/ScreenHome.tsx).
- **KPIs de la home:** cada tarjeta lleva un gradiente sutil `from-<color>/15 to-<color>/5`.

## Tipografía

- **Familia:** font stack del sistema (no se carga webfont):
  `-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif`.
  Definido en `body` de [src/index.css](src/index.css). Se ve nativo en cada plataforma y evita
  CLS por carga de fuentes.
- `antialiased` activado a nivel `body`.

### Escala de tamaños (mobile-first, escalar hacia arriba)

| Rol                         | Clases                                                                    |
| --------------------------- | ------------------------------------------------------------------------- |
| Título de pantalla / hero   | `text-lg` → `md:text-2xl` (nombre en hero)                                |
| Título de sección / card    | `text-base` (CardTitle) + `font-semibold`                                 |
| Encabezado de grupo (label) | `text-sm font-semibold uppercase tracking-wide text-muted-foreground`     |
| Dato protagonista (ej. KPI) | `text-2xl` → `md:text-3xl` → `lg:text-4xl`, `font-bold`                   |
| Cuerpo / fila de lista      | `text-sm` (base mobile)                                                   |
| Item destacado en fila      | `text-[15px] font-semibold leading-tight` (ej. **Edificio** en Registros) |
| Metadatos / secundario      | `text-xs text-muted-foreground`                                           |
| Micro (badges, %)           | `text-[10px]` / `text-[11px]`                                             |

- Pesos: `font-semibold` para títulos y lo accionable; `font-bold` reservado a números/KPIs.
- En texto largo o apilado, `leading-tight` / `leading-*` explícito.
- Números (horas, contadores): `tabular-nums` para que no "bailen".

## Forma y elevación

- **Radio base** (`--radius`): `0.75rem` (12px) → mapea a `rounded-lg` en Tailwind
  (`md` y `sm` derivan de ahí). Token único; no inventar radios sueltos.
- **Cards de contenido:** `rounded-2xl` (16px). Es el radio "grande" de la app (KPIs,
  Registros, módulos, hero card de desktop).
- **Botones / inputs / chips:** `rounded-lg` o `rounded-xl`. Pills de estado: `rounded-full`.
- **Elevación:** `shadow-lg` para el hero; `hover:shadow-md` + `hover:-translate-y-0.5` como
  micro-feedback en tarjetas clickeables.

## Diálogos / modales (estándar)

El estándar vive en los **componentes base** y aplica a TODOS los diálogos de la app:
[src/components/ui/dialog.tsx](src/components/ui/dialog.tsx) (`Dialog`/`DialogFooter`) y
[src/components/ui/alert-dialog.tsx](src/components/ui/alert-dialog.tsx) (`AlertDialog`). Ambos
comparten el mismo footer y overlay — no hay que repetirlo en cada pantalla.

- **Esquinas:** `rounded-xl` (12px) o más, en **todos** los viewports — nunca esquinas vivas.
- **Fondo (overlay):** `bg-black/50` **+ `backdrop-blur-sm`** → el contenido de atrás queda
  desenfocado, no solo oscurecido.
- **Botones SIEMPRE en fila** (uno al lado del otro, **nunca uno arriba del otro**), en
  `Dialog` y `AlertDialog`: footer `flex flex-row` con `[&>*]:flex-1` (lo maneja el componente).
  - En **mobile** reparten el ancho a 50/50: cada botón con `flex-1`.
  - En **sm+** se alinean a la derecha con ancho natural (`sm:flex-none`, footer `sm:justify-end`).
  - Orden: **Cancelar a la izquierda, acción primaria a la derecha**.
- **Acción destructiva** (ej. Anular): botón en `bg-destructive text-destructive-foreground
hover:bg-destructive/90`. Mientras corre la mutación: deshabilitar ambos botones y mostrar
  estado de carga en el label ("Anulando…").

Referencia de uso: el diálogo "¿Anular este registro?" en [ScreenHome](src/screens/ScreenHome.tsx).

## Navegación — dónde viven los módulos (no duplicar)

Fuente única de qué módulos se muestran y sus labels: [src/lib/nav.ts](src/lib/nav.ts).

- **Desktop / tablet (`md:`+):** los módulos se acceden por el **Sidebar**
  ([src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx)). Por eso el grid de
  módulos de la home es **`md:hidden`** — mostrarlo ahí sería redundante con el Sidebar.
- **Mobile (`< md`):** no hay Sidebar; los módulos se acceden por el **grid de la home**
  (entradas grandes, touch-friendly) y por el menú **hamburguesa**.
- Regla: un módulo no debe aparecer dos veces a la vez en el mismo viewport. Si se agrega un
  punto de entrada nuevo, validar que no duplique al Sidebar en desktop.

## Touch targets

- Mínimo **44×44px** clickeable en mobile (ver CLAUDE.md). Avatares de fila a `size-11` (44px),
  botones de ícono a `size-10`/`size-11`. Inputs `h-11` en mobile.

---

_Si una decisión de diseño cambia, actualizar este archivo (y el token en `index.css` si aplica)._
