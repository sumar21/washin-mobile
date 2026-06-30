---
name: update-docs
description: Actualiza los .md de docs/ para que reflejen el estado real del código. Revisa el work tree (git status/diff) o los commits indicados y sincroniza los docs afectados. Usar cuando el usuario diga "update docs", "actualizá los docs", "/update-docs", o tras sumar/cambiar pantallas, endpoints o listas SharePoint.
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Read, Edit, Grep, Glob
---

## Alcance

Por defecto trabaja sobre el **work tree actual**:

1. `git status` → archivos modificados/agregados sin commitear.
2. `git diff HEAD` (staged + unstaged) → qué cambió.

Si el usuario pasa un rango de commits o un SHA (ej. `HEAD~3..HEAD`, `abc123`):

- Usar `git log <rango> --name-only` para ver archivos tocados.
- Usar `git show <commit>` para ver el diff detallado de cada commit.

Si no está claro qué rango aplicar, **preguntar** antes de proceder.

---

## Mapa cambio → doc

| Archivos cambiados | Doc a actualizar | Qué sección |
|---|---|---|
| `src/screens/*.tsx`, `src/routes.tsx` | `docs/mapa-app.md` | Tabla **Pantallas** |
| `api/*.ts` | `docs/mapa-app.md` | Tabla **Endpoints** |
| `api/_lib/*.ts` | `docs/mapa-app.md` | Tabla **Listas SharePoint por lib** |
| `api/_lib/*.ts` con constante `L_XXX` nueva | `docs/mapa-app.md` + **avisar** que `docs/sharepoint-schema.md` quizá necesite esa lista | Ver nota abajo |
| `src/lib/nav.ts` | `docs/arquitectura.md` | Sección **Navegación y permisos** |
| `src/stores/*.ts` | `docs/arquitectura.md` | Sección **Estado global** |
| `api/_lib/incidentes.ts`, `api/_lib/planificaciones.ts`, `api/_lib/ventilaciones.ts`, `api/_lib/break.ts` (lógica de estados/asignación/resolución, comentarios "paridad PA"/"Regla") | `docs/reglas-negocio.md` | Sección del módulo afectado (OT/Incidentes, Visitas, Ventilaciones, Descanso, Stock) |
| `api/login.ts`, `api/_lib/jwt.ts`, `api/_lib/users.ts` | `docs/arquitectura.md` | Sección **Autenticación y sesión** |
| `package.json` (deps o scripts) | `docs/arquitectura.md` | Sección **Stack y capas** / **Dev/Build** |
| `docs/*.md` agregado o eliminado | `docs/README.md` | Tabla del grupo correspondiente |

**Nota sobre listas nuevas (`L_XXX`):** `docs/sharepoint-schema.md` es generado por introspección de Graph API — **NO inventar columnas**. Si aparece una lista nueva, agregarla a la tabla de `mapa-app.md` y dejar un comentario al usuario: "La lista `<nombre>` es nueva; agregar sus columnas a `docs/sharepoint-schema.md` requiere introspección de Graph (revisar manualmente)."

---

## Cómo actualizar

1. **Leer** el doc afectado completo (para entender el formato existente).
2. **Leer** los archivos de código que cambiaron (solo los relevantes al mapa).
3. **Editar** únicamente las filas/secciones afectadas — cirugía, no reescritura.
   - En tablas: agregar/modificar/eliminar filas manteniendo el estilo y el orden existente.
   - En secciones de prosa: actualizar solo el párrafo o lista que cambió.
4. Si un cambio es solo de implementación interna (refactor sin efecto en la interfaz pública del endpoint o la pantalla), **no tocar los docs** — registrarlo en el reporte.

---

## Qué reportar al terminar

- Lista de docs tocados con qué sección se editó.
- Lista de cambios que **no** se reflejaron en docs (refactors internos, etc.) y por qué.
- Cualquier decisión que requiera revisión humana (nueva lista SP sin schema, cambio de guard, ruta nueva sin pantalla, etc.).
- **No hacer commit** salvo que el usuario lo pida explícitamente.

---

## Restricciones

- NO tocar `.agents/` ni `skills-lock.json`.
- NO tocar código de la app (`src/`, `api/`).
- NO reescribir docs completos — solo las secciones afectadas.
- NO inventar datos (columnas de SP, rutas, acciones) que no estén en el código.
