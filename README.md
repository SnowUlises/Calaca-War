# Calaca War — modpack

Archivos del modpack de **Calaca War** (Minecraft Forge 1.20.1 · 47.4.0). El launcher de Calaca War baja siempre lo que está en la rama `main`.

## Qué hay acá

| Carpeta / archivo | Qué es |
|---|---|
| `mods/` | Los mods del pack. |
| `config/` | Configuración de los mods. |
| `shaderpacks/` | Shaders incluidos. |
| `pack.json` | Nombre, versión, Minecraft, Forge y los archivos externos (más de 100 MB). |
| `manifest.json` | Lista de todos los archivos con tamaño y sha1. Es lo que lee el launcher. **Se genera solo**, no editarlo a mano. |
| `tools/build_manifest.py` | Genera `manifest.json`. |

## Publicar una versión nueva

1. Cambiar lo que haga falta en `mods/`, `config/` o `shaderpacks/`.
2. Subir el número de `version` en `pack.json`.
3. Correr `python tools/build_manifest.py`.
4. Subir todo a `main`.
5. Crear una release `vX.Y.Z` con el texto de novedades: es lo que muestra el launcher.

Los archivos de más de 100 MB no entran en el repo: se suben como adjuntos de la release `archivos-grandes` y se anotan en `externos` dentro de `pack.json`.

## Qué no va en el repo

Nada propio del jugador: `options.txt`, mundos, capturas, grabaciones, logs ni cuentas.
