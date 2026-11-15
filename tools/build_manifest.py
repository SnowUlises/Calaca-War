#!/usr/bin/env python3
"""Genera manifest.json: la lista de archivos que el launcher tiene que bajar.

Uso:  python tools/build_manifest.py
Correrlo desde la raiz del repo cada vez que cambien mods, configs o shaders.

GitHub no acepta archivos de mas de 100 MB. Si encuentra uno, este script lo
parte en pedazos dentro de partes/ (misma ruta + .001, .002, ...) y lo saca de
su carpeta. El launcher baja los pedazos y lo vuelve a armar.
"""
import hashlib, json, os, re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARPETAS = ["mods", "config", "shaderpacks", "resourcepacks", "datapacks"]
PARTES = "partes"
LIMITE = 95_000_000
PACK = json.load(open(os.path.join(RAIZ, "pack.json"), encoding="utf-8"))
RAW = f"https://raw.githubusercontent.com/{PACK['repo']}/main/"


def rel(ruta):
    return os.path.relpath(ruta, RAIZ).replace(os.sep, "/")


def sha1(rutas):
    h = hashlib.sha1()
    for ruta in rutas:
        with open(ruta, "rb") as f:
            for bloque in iter(lambda: f.read(1 << 20), b""):
                h.update(bloque)
    return h.hexdigest()


def recorrer(base):
    for dirpath, dirs, nombres in os.walk(base):
        dirs[:] = sorted(d for d in dirs if not d.startswith("."))  # caches como mods/.connector
        for n in sorted(nombres):
            yield os.path.join(dirpath, n)


def partir(completo):
    destino = os.path.join(RAIZ, PARTES, rel(completo))
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    for viejo in os.listdir(os.path.dirname(destino)):
        if re.fullmatch(re.escape(os.path.basename(destino)) + r"\.\d{3}", viejo):
            os.remove(os.path.join(os.path.dirname(destino), viejo))
    with open(completo, "rb") as f:
        i = 1
        while bloque := f.read(LIMITE):
            open(f"{destino}.{i:03d}", "wb").write(bloque)
            i += 1
    os.remove(completo)
    print(f"partido en {i - 1}: {rel(completo)}")


archivos = []
for carpeta in CARPETAS:
    for completo in list(recorrer(os.path.join(RAIZ, carpeta))):
        if os.path.getsize(completo) > LIMITE:
            partir(completo)
            continue
        archivos.append({"path": rel(completo), "size": os.path.getsize(completo), "sha1": sha1([completo])})

grupos = {}
for completo in recorrer(os.path.join(RAIZ, PARTES)):
    m = re.fullmatch(r"(.+)\.(\d{3})", completo)
    if m:
        grupos.setdefault(m.group(1), []).append(completo)
for base, piezas in grupos.items():
    piezas.sort()
    archivos.append({
        "path": os.path.relpath(base, os.path.join(RAIZ, PARTES)).replace(os.sep, "/"),
        "size": sum(os.path.getsize(p) for p in piezas),
        "sha1": sha1(piezas),
        "parts": [{"path": rel(p), "size": os.path.getsize(p), "sha1": sha1([p])} for p in piezas],
    })

archivos.sort(key=lambda a: a["path"])
manifest = {
    "formato": 1,
    "nombre": PACK["nombre"],
    "version": PACK["version"],
    "minecraft": PACK["minecraft"],
    "forge": PACK["forge"],
    "base_url": RAW,
    "novedades": RAW + "novedades.md",
    "archivos": archivos,
}
json.dump(manifest, open(os.path.join(RAIZ, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"manifest.json: {len(archivos)} archivos, {sum(a['size'] for a in archivos) / 1e6:.0f} MB")
