# Identidad de máquina en incidentes (reporte "incidentes por máquina")

> Cómo relacionar de forma **consistente** un incidente (`10.Incidentes`) con una máquina
> (`08.DetalleMaquina`). Aplica a la mobile (historial de máquina) y a cualquier reporte futuro
> "incidentes por máquina" (repo de gerentes/administradores).

## El problema

`IDMaquina_DM` (display `IDMaquina_DM`, en incidentes `IDMaquina_IN`) **NO es único**. La misma
numeración se repite entre segmentos y edificios: hay lavadoras con el mismo `IDMaquina` que las
encendedoras. Además, en `08.DetalleMaquina` puede haber **varias filas** con el mismo `IDMaquina_DM`
(distinto edificio/segmento). El único identificador realmente único de una máquina es el **id de
ítem de SharePoint** (`ID`), pero **los incidentes NO lo guardan** — sólo guardan `IDMaquina_IN` (el
id de negocio, ambiguo) junto con `CodigoEdifcio_IN` y `ConcatMaquina_IN`.

Consecuencia: filtrar incidentes sólo por `IDMaquina_IN` mezcla el historial de dos máquinas
distintas que comparten el número.

## Clave consistente: `IDMaquina` + `Edificio`

No hay FK limpia, así que la clave más consistente que se puede derivar de **ambas** tablas es la
**compuesta**:

| Máquina (`08.DetalleMaquina`) | Incidente (`10.Incidentes`) |
| ----------------------------- | --------------------------- |
| `IDMaquina_DM`                | `IDMaquina_IN`              |
| `CodigoEdificio_DM`           | `CodigoEdifcio_IN` (sic, typo interno) |

Regla: **un incidente pertenece a la máquina `(IDMaquina_IN, CodigoEdifcio_IN)`**. Esto elimina las
colisiones entre edificios (el caso común, porque la numeración se reusa por edificio).

### Implementación en la mobile

- El historial se abre desde `ScreenDetalleMaquina`, que conoce la máquina exacta. Pasa por la URL:
  - `mid` = `ID` de ítem (único) → `ScreenHM` levanta la máquina **exacta** (no la primera que
    matchee `IDMaquina_DM`) para la card de contexto.
  - `edificio` = `CodigoEdificio_DM` → acota el historial.
- `listHistorialMaquina(idMaquina, codigoEdificio?)` filtra en OData por `IDMaquina_IN` (indexado) y
  aplica el edificio **en memoria**, dejando pasar los incidentes **sin** `CodigoEdifcio_IN` (datos
  viejos) para no ocultarlos. Ver [api/_lib/maquinas.ts](../api/_lib/maquinas.ts).

> **Normalización:** el match de edificio se hace con `trim` + case-insensitive, porque el código
> puede venir con espacios o distinta capitalización según qué app cargó el incidente vs la máquina.
> Un `===` crudo ocultaría incidentes válidos.

### Residuales conocidos (documentados, no resueltos)

1. **Misma-ID en el mismo edificio, distinto segmento.** Si en el **mismo edificio** conviven dos
   máquinas con el mismo `IDMaquina` en distinto segmento (p. ej. lavadora y encendedora), la clave
   `(IDMaquina, Edificio)` todavía las mezcla. La `card` de contexto sale bien (usa `mid`, único),
   pero el historial puede traer ambos.
2. **Máquina mudada de edificio.** Si una máquina física estuvo en el edificio A y hoy está en el B,
   abrir su historial (acotado a B) **no** muestra los incidentes que tuvo en A. Es el costo de usar
   el edificio como desambiguador: sin un id único de máquina en el incidente, esos incidentes de A
   son indistinguibles de los de otra máquina con el mismo `IDMaquina` en A.

Desambiguar del todo (y capturar el historial completo de una máquina que se mudó) requeriría que el
incidente guarde el `ID` de ítem de la máquina (cambio en la app de escritorio / Power Apps que
crea/asigna incidentes). Mientras tanto, el segmento **no** es confiable en el incidente (no hay
columna de segmento; `ConcatMaquina_IN` no siempre coincide entre apps).

## Dos máquinas por incidente

Un incidente puede referenciar **dos** máquinas distintas:

1. **Máquina con el problema** → `IDMaquina_IN` (+ `ConcatMaquina_IN`). Es la máquina reportada.
2. **Máquina de reemplazo** → `MaquinaAsignada_IN`, que se completa **sólo** cuando la resolución es
   `NoResuelto_IN = "Cambio de Maquina"`. La asignación del reemplazo vive en la **app de escritorio**
   (la mobile no asigna máquinas — ver el límite en memoria del proyecto).

Para un reporte "incidentes por máquina" **completo**, una máquina debería aparecer en un incidente
si es la del problema **o** la asignada como reemplazo:

```
incidentesDeMaquina(m) =
  Filter('10.Incidentes',
    (IDMaquina_IN = m.IDMaquina_DM And CodigoEdifcio_IN = m.CodigoEdificio_DM)   // como problema
    Or MaquinaAsignada_IN = m.<clave de reemplazo>)                               // como reemplazo
```

> **Ojo con `MaquinaAsignada_IN`:** su formato lo define la escritorio (suele ser un `ConcatMaquina`
> o el `IDMaquina`, no el `ID` de ítem). Antes de usarlo en el reporte, verificar contra datos reales
> qué guarda exactamente y matchear con el mismo criterio.

La mobile hoy muestra **sólo** el rol "máquina con el problema" (`IDMaquina_IN`), que es lo que el
técnico espera en el historial. La inclusión del rol "reemplazo" queda para el reporte de gerentes.
