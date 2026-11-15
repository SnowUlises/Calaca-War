# Calaca War — modpack

Archivos del modpack de **Calaca War** (Minecraft Forge 1.20.1 · 47.4.0). El launcher de Calaca War baja siempre lo que está en la rama `main`.

## Qué hay acá

| Carpeta / archivo | Qué es |
|---|---|
| `mods/` | Los mods del pack. |
| `config/` | Configuración de los mods. |
| `shaderpacks/` | Shaders incluidos. |
| `partes/` | Archivos de más de 100 MB, partidos en pedazos (GitHub no los acepta enteros). El launcher los rearma. |
| `pack.json` | Nombre, versión, Minecraft y Forge. |
| `novedades.md` | Lo que muestra el launcher en Novedades. La versión más nueva va arriba. |
| `manifest.json` | Lista de todos los archivos con tamaño y sha1. Es lo que lee el launcher. **Se genera solo**, no editarlo a mano. |
| `tools/build_manifest.py` | Genera `manifest.json` y parte los archivos de más de 100 MB. |

## Publicar una versión nueva

1. Cambiar lo que haga falta en `mods/`, `config/` o `shaderpacks/`.
2. Subir el número de `version` en `pack.json`.
3. Agregar la versión arriba de todo en `novedades.md` (`## X.Y.Z — fecha`, y adentro `### Nuevo`, `### Cambios`, `### Arreglos`).
4. Correr `python tools/build_manifest.py`.
5. Subir todo a `main`.

## Qué no va en el repo

Nada propio del jugador: `options.txt`, mundos, capturas, grabaciones, logs ni cuentas.
