// Deja la carpeta del juego igual al modpack del repo, sin tocar lo que es del jugador.
//
// - mods/, shaderpacks/, resourcepacks/, datapacks/: se bajan los que falten o hayan cambiado.
//   Solo se borran archivos que este launcher instalo antes y que ya no estan en el pack.
//   Lo que el jugador agrego por su cuenta no se toca.
// - config/: se pisa un archivo solo si cambio en el repo desde la ultima vez (o si falta).
// - Nada fuera de esas carpetas se toca (options.txt, saves, screenshots, etc.).
const fs = require('fs');
const path = require('path');
const { fetchJson, download, sha1File } = require('./net');

const CARPETAS = ['mods', 'config', 'shaderpacks', 'resourcepacks', 'datapacks'];
const BORRABLES = ['mods', 'shaderpacks', 'resourcepacks', 'datapacks'];
const SIMULTANEAS = 4;

const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const top = (p) => p.split('/')[0];

function rutaSegura(p) {
  if (typeof p !== 'string' || !p || p.includes('\\') || path.isAbsolute(p)) return false;
  const partes = p.split('/');
  return !partes.some((x) => x === '..' || x === '.' || x === '') && CARPETAS.includes(partes[0]);
}

function leerEstado(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { files: {} }; }
}

async function tamano(file) {
  try { return (await fs.promises.stat(file)).size; } catch { return -1; }
}

async function syncPack({ manifestUrl, gameDir, repair = false, onProgress = () => {} }) {
  onProgress({ phase: 'check' });
  const manifest = await fetchJson(manifestUrl);
  if (manifest.formato !== 1) throw new Error('Este launcher es viejo para el modpack. Actualizalo.');
  const estadoFile = path.join(gameDir, '.calacawar', 'state.json');
  const estado = leerEstado(estadoFile);
  await fs.promises.mkdir(path.dirname(estadoFile), { recursive: true });

  const archivos = manifest.archivos.filter((a) => rutaSegura(a.path));
  const pendientes = [];
  for (const a of archivos) {
    const local = path.join(gameDir, a.path);
    const size = await tamano(local);
    const previo = estado.files[a.path];
    let bajar;
    if (size < 0) bajar = true;
    else if (top(a.path) === 'config' && !repair) bajar = !previo || previo.sha1 !== a.sha1;
    else if (!repair && previo && previo.sha1 === a.sha1 && size === a.size) bajar = false;
    else bajar = size !== a.size || (await sha1File(local)) !== a.sha1;
    if (bajar) pendientes.push(a);
    else estado.files[a.path] = { sha1: a.sha1, size: a.size };
  }

  // Lo que instalamos antes y ya no esta en el pack.
  const vigentes = new Set(archivos.map((a) => a.path));
  for (const viejo of Object.keys(estado.files)) {
    if (vigentes.has(viejo)) continue;
    if (rutaSegura(viejo) && BORRABLES.includes(top(viejo))) await fs.promises.rm(path.join(gameDir, viejo), { force: true });
    delete estado.files[viejo];
  }

  const total = pendientes.reduce((n, a) => n + a.size, 0);
  let bytes = 0;
  let hechos = 0;
  const avisar = () => onProgress({ phase: 'download', bytes, total, done: hechos, count: pendientes.length });
  const onBytes = (n) => { bytes += n; avisar(); };
  const guardar = () => fs.promises.writeFile(estadoFile, JSON.stringify({ version: manifest.version, files: estado.files }));

  async function bajarUno(a) {
    const dest = path.join(gameDir, a.path);
    if (a.parts) {
      const piezas = [];
      for (const p of a.parts) {
        const tmp = path.join(gameDir, '.calacawar', 'partes', path.basename(p.path));
        await download(manifest.base_url + enc(p.path), tmp, { sha1: p.sha1, onBytes });
        piezas.push(tmp);
      }
      const armado = `${dest}.part`;
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.rm(armado, { force: true });
      for (const p of piezas) await fs.promises.appendFile(armado, await fs.promises.readFile(p));
      if ((await sha1File(armado)) !== a.sha1) throw new Error(`No se pudo armar ${path.basename(dest)}`);
      await fs.promises.rm(dest, { force: true });
      await fs.promises.rename(armado, dest);
      for (const p of piezas) await fs.promises.rm(p, { force: true });
    } else {
      await download(a.url || manifest.base_url + enc(a.path), dest, { sha1: a.sha1, onBytes });
    }
    estado.files[a.path] = { sha1: a.sha1, size: a.size };
    hechos++;
    avisar();
  }

  avisar();
  const cola = pendientes.slice();
  let fallo = null;
  await Promise.all(Array.from({ length: SIMULTANEAS }, async () => {
    while (cola.length && !fallo) {
      try { await bajarUno(cola.shift()); } catch (e) { fallo = e; }
    }
  }));
  await guardar();
  if (fallo) throw fallo;
  return { version: manifest.version, minecraft: manifest.minecraft, forge: manifest.forge, novedades: manifest.novedades, bajados: pendientes.length };
}

module.exports = { syncPack };
