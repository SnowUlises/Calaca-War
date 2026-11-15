#!/usr/bin/env python3
"""Genera manifest.json: la lista de archivos que el launcher tiene que bajar.

Uso:  python tools/build_manifest.py
Correrlo desde la raiz del repo cada vez que cambien mods, configs o shaders.
"""
import hashlib, json, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARPETAS = ["mods", "config", "shaderpacks", "resourcepacks", "datapacks"]
PACK = json.load(open(os.path.join(RAIZ, "pack.json"), encoding="utf-8"))
REPO = PACK["repo"]
RAW = f"https://raw.githubusercontent.com/{REPO}/main/"


def sha1(ruta):
    h = hashlib.sha1()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


archivos = []
for carpeta in CARPETAS:
    base = os.path.join(RAIZ, carpeta)
    for dirpath, _, nombres in os.walk(base):
        for n in sorted(nombres):
            completo = os.path.join(dirpath, n)
            rel = os.path.relpath(completo, RAIZ).replace(os.sep, "/")
            archivos.append({"path": rel, "size": os.path.getsize(completo), "sha1": sha1(completo)})

# Archivos de mas de 100 MB: no entran en el repo, viven como adjuntos de una release.
for ext in PACK.get("externos", []):
    archivos.append({"path": ext["path"], "size": ext["size"], "sha1": ext["sha1"], "url": ext["url"]})

archivos.sort(key=lambda a: a["path"])
manifest = {
    "formato": 1,
    "nombre": PACK["nombre"],
    "version": PACK["version"],
    "minecraft": PACK["minecraft"],
    "forge": PACK["forge"],
    "base_url": RAW,
    "archivos": archivos,
}
json.dump(manifest, open(os.path.join(RAIZ, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"manifest.json: {len(archivos)} archivos, {sum(a['size'] for a in archivos) / 1e6:.0f} MB")
