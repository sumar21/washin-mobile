# `/mails` — Previsualización de los correos que envía la app

Esta carpeta contiene una **previsualización renderizada** de los correos automáticos que
dispara washin-mobile. **No se envía nada desde acá**: son archivos HTML para que puedas ver
exactamente cómo le llega cada mail al destinatario.

## Cómo verlos

Abrí **`index.html`** en cualquier navegador (doble clic). Es una galería con miniaturas de los
4 correos; cada uno muestra De / Para / CCO / Asunto / disparador + el **cuerpo real renderizado**.

- `index.html` → galería con miniaturas (`.png`).
- `NN-<nombre>.html` → página de preview (sobre + cuerpo en un iframe).
- `NN-<nombre>.email.html` → el cuerpo **crudo**, byte-a-byte igual a lo que se envía.
- `NN-<nombre>.png` → captura del correo (para el index y para verlo rápido).

Para PDF: abrí el `.html` en el navegador y usá *Imprimir → Guardar como PDF*.

## Diseño

Moderno y minimalista. El **shell de marca** (`api/_lib/mail-layout.ts`) arma: barra de acento
fina + encabezado con el **logo de Wash-Inn** (`public/Logoapp.png`, embebido en base64) y el
texto `WASH INN SYSTEM` al lado + eyebrow + título + cuerpo + **lista de datos con hairlines**
(sin cajas pesadas) + tabla de repuestos minimalista + firma + pie con `[ sumar ]`.

Es la **única imagen** del correo (Gmail/Outlook suelen bloquear imágenes): si el cliente la
bloquea, el texto `WASH INN SYSTEM` sigue llevando la marca. Todo lo demás es HTML/CSS. Layout de
**tablas con estilos inline** (email-safe), paleta neutra slate + un azul de marca, y *preheader*
(texto de preview en la bandeja).

## Cómo se regeneran

```bash
npx tsx scripts/build-mail-assets.ts   # logo Logoapp.png → base64 (api/_lib/mail-assets.ts)
npx tsx scripts/render-mails.ts        # renderiza los HTML de /mails
node scripts/shot-mails.mjs            # (opcional) capturas PNG para las miniaturas del index
```

`render-mails.ts` importa las **mismas funciones de plantilla** que usa el backend
(`api/_lib/mail-visitas.ts`, `api/_lib/mail-incidentes.ts`), así que el preview es fiel.

## Cómo se envían de verdad

- Vía **Microsoft Graph `sendMail`** (`api/_lib/mail.ts`), casilla emisora
  **`notificaciones@sumardigital.com.ar`** (`AZURE_MAIL_FROM`). Requiere permiso de app
  `Mail.Send` en Azure. Si `AZURE_MAIL_FROM` está vacío, el envío se saltea en silencio.
- **Best-effort**: si el mail falla, **nunca** rompe el flujo principal (visita/incidente);
  solo se loguea el error.
- Destinatarios desde **`99.ABM_Emails`** (por módulo), no hardcodeados — equivale al
  `LookUp(CollectMails, Modulo_EM=…)` de PowerApps.

## Los 4 correos

| # | Correo | Disparador | Plantilla PowerApps |
|---|--------|-----------|---------------------|
| 1 | **Mantenimiento** | Al finalizar el checklist de una visita | `HtmlText_Mantenimiento` |
| 2 | **Visita cancelada** | Al cancelar una visita (no se pudo ingresar) | `html_visitaCancelada` (+ `_Espontanea`) |
| 3 | **Incidente resuelto** | Al resolver un incidente con cambio de repuesto | `html_IncidenteResuelto(_1)` |
| 4 | **Incidente anulado** | Al anular un incidente | `html_inicidenteAnulado` |

> Nota de paridad: el texto y los datos coinciden con PowerApps. React usa un único cuerpo
> moderno (solo el logo como imagen; no necesita variante "Gmail"); la cancelación **agrega**
> una línea "Motivo:" que PA no tiene.
