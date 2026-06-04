#!/usr/bin/env python3
"""Extrae el código fuente del export de PowerApps (`Washinn App.msapp`) a
`docs/powerapps/` para usarlo como referencia versionada (read-only) de la app
que estamos reconstruyendo en React.

El `.msapp` es un ZIP. Volcamos:
  - Src/*.pa.yaml            -> docs/powerapps/Src/        (lógica por pantalla)
  - References/DataSources.json, Properties.json -> docs/powerapps/References/

Uso:
    python scripts/extract-msapp.py ["Washinn App.msapp"]

Regenerar cada vez que se actualice el .msapp. NO editar a mano lo extraído.
"""
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MSAPP = os.path.join(ROOT, "Washinn App.msapp")
OUT_DIR = os.path.join(ROOT, "docs", "powerapps")

# Qué sacamos del archivo (prefijos de nombre interno, con separador normalizado).
WANT_PREFIXES = ("Src/",)
WANT_EXACT = ("References/DataSources.json", "References/Properties.json", "Properties.json")


def main() -> int:
    msapp = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MSAPP
    if not os.path.exists(msapp):
        print(f"No se encontró el .msapp: {msapp}", file=sys.stderr)
        return 1

    count = 0
    with zipfile.ZipFile(msapp) as z:
        for info in z.infolist():
            # Los nombres internos usan '\' como separador; normalizamos a '/'.
            name = info.filename.replace("\\", "/")
            if not (name.startswith(WANT_PREFIXES) or name in WANT_EXACT):
                continue
            dest = os.path.join(OUT_DIR, *name.split("/"))
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with z.open(info) as src, open(dest, "wb") as out:
                out.write(src.read())
            count += 1
            print(f"  {name}")

    print(f"\nListo: {count} archivos -> {os.path.relpath(OUT_DIR, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
