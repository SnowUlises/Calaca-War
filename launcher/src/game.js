// Arranca Minecraft + Forge directamente (sin el launcher oficial), como hace Modrinth.
const fs = require('fs');
const path = require('path');
const { Client } = require('minecraft-launcher-core');
const { download, fetchText } = require('./net');

// Un .jar sano termina con el indice del zip ("PK\\5\\6"). Si una descarga quedo cortada no lo tiene.
function zipSano(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const n = Math.min(size, 65557);
    const buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, size - n);
    return buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) >= 0;
  } catch { return false; } finally { if (fd !== undefined) fs.closeSync(fd); }
}

// Borra los .jar rotos de libraries/ y versions/: minecraft-launcher-core baja de nuevo lo que falta.
async function borrarJarsRotos(gameDir) {
  let n = 0;
  const recorrer = async (dir) => {
    let items = [];
    try { items = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const it of items) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) await recorrer(p);
      else if (it.name.endsWith('.jar') && !zipSano(p)) { await fs.promises.rm(p, { force: true }); n++; }
    }
  };
  await recorrer(path.join(gameDir, 'libraries'));
  await recorrer(path.join(gameDir, 'versions'));
  return n;
}

// Explica en criollo los errores tipicos al arrancar.
function explicar(log) {
  if (/zip END header|ZipException|invalid LOC header/i.test(log)) return 'Hay un archivo roto. Toc\u00e1 Reparar en Ajustes y volv\u00e9 a jugar.';
  if (/Could not reserve enough space|Invalid maximum heap size|OutOfMemoryError/i.test(log)) return 'No alcanz\u00f3 la memoria. Baj\u00e1 la RAM en Ajustes.';
  if (/UnsupportedClassVersionError/i.test(log)) return 'La versi\u00f3n de Java no sirve. Toc\u00e1 Reparar.';
  if (/Missing or unsupported mandatory dependencies|Mod .* requires/i.test(log)) return 'Falta un mod o hay uno incompatible. Si agregaste mods propios, sacalos.';
  return null;
}

async function lanzar({ gameDir, minecraft, forge, auth, java, ram, onEstado = () => {}, onCerrado = () => {} }) {
  if (gameDir.includes('!')) throw new Error('La carpeta del juego tiene un "!" y Java no la puede usar. Cambiala en Ajustes.');
  const instalador = path.join(gameDir, '.calacawar', `forge-${minecraft}-${forge}-installer.jar`);
  if (!fs.existsSync(instalador) || !zipSano(instalador)) {
    onEstado({ text: `Bajando Forge ${forge}` });
    const url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${minecraft}-${forge}/forge-${minecraft}-${forge}-installer.jar`;
    let sha1;
    try { sha1 = (await fetchText(`${url}.sha1`)).trim().slice(0, 40); } catch { sha1 = undefined; }
    await download(url, instalador, { sha1 });
  }
  onEstado({ text: 'Revisando archivos del juego' });
  const rotos = await borrarJarsRotos(gameDir);
  if (rotos) onEstado({ text: `Rebajando ${rotos} archivos rotos` });
  const cliente = new Client();
  let ultimo = 0;
  cliente.on('progress', (p) => {
    const ahora = Date.now();
    if (ahora - ultimo < 150) return;
    ultimo = ahora;
    const que = { assets: 'Bajando sonidos y texturas', 'assets-copy': 'Copiando recursos', natives: 'Bajando librerías', classes: 'Bajando librerías', 'classes-custom': 'Preparando Forge', 'classes-maven-custom': 'Preparando Forge' }[p.type] || 'Preparando Minecraft';
    onEstado({ text: que, frac: p.total ? p.task / p.total : 0 });
  });
  let abierto = false;
  const log = [];
  cliente.on('data', (d) => {
    const s = String(d);
    log.push(s); if (log.length > 300) log.shift();
    if (!abierto && /Backend library|LWJGL|Setting user/i.test(s)) { abierto = true; onEstado({ text: 'Abriendo Minecraft', abierto: true }); }
  });
  cliente.on('close', (code) => {
    fs.mkdirSync(path.join(gameDir, '.calacawar'), { recursive: true });
    const texto = log.join('');
    fs.writeFileSync(path.join(gameDir, '.calacawar', 'ultimo-juego.log'), texto);
    onCerrado(code, code === 0 ? null : explicar(texto));
  });
  onEstado({ text: 'Preparando Minecraft', frac: 0 });
  const proc = await cliente.launch({
    authorization: auth,
    root: gameDir,
    version: { number: minecraft, type: 'release' },
    forge: instalador,
    javaPath: java,
    memory: { max: `${ram}G`, min: `${Math.min(2, ram)}G` },
    overrides: { detached: false },
  });
  if (!proc) throw new Error('No se pudo arrancar Minecraft. Probá con Reparar.');
  return proc;
}

module.exports = { lanzar, borrarJarsRotos };
