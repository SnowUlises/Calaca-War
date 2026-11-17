// Busca o baja el Java con el que corre el juego.
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { download } = require('./net');

const WIN = process.platform === 'win32';
const JAVA = WIN ? 'java.exe' : 'java';
const STORE = 'Microsoft.4297127D64EC6_8wekyb3d8bbwe';

function buscar(dir, nivel, hallados) {
  if (nivel < 0) return;
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) buscar(p, nivel - 1, hallados);
    else if (it.name === JAVA && path.basename(dir) === 'bin') hallados.push(p);
  }
}

// Java que trae el launcher oficial. Se prefiere Java 17 (gamma) y se evita Java 8 (legacy).
function javaDelLauncher(mcDir) {
  const env = process.env;
  const raices = [
    path.join(mcDir, 'runtime'),
    env['ProgramFiles(x86)'] && path.join(env['ProgramFiles(x86)'], 'Minecraft Launcher', 'runtime'),
    env.ProgramFiles && path.join(env.ProgramFiles, 'Minecraft Launcher', 'runtime'),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Packages', STORE, 'LocalCache', 'Local', 'runtime'),
  ].filter(Boolean);
  const hallados = [];
  for (const r of raices) buscar(r, 6, hallados);
  const puntos = (p) => (/gamma/i.test(p) ? 3 : /delta|epsilon/i.test(p) ? 2 : /legacy|alpha|beta/i.test(p) ? 0 : 1);
  hallados.sort((a, b) => puntos(b) - puntos(a));
  return hallados.length && puntos(hallados[0]) > 0 ? hallados[0] : null;
}

async function javaPropio(dataDir, onText) {
  const dir = path.join(dataDir, 'java17');
  const hallados = [];
  await fs.promises.rm(dir, { recursive: true, force: true });
  if (!WIN) throw new Error('No se encontro Java 17.');
  onText('Bajando Java 17');
  const zip = path.join(dataDir, 'java17.zip');
  await download('https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jre/hotspot/normal/eclipse', zip);
  new AdmZip(zip).extractAllTo(dir, true);
  await fs.promises.rm(zip, { force: true });
  buscar(dir, 4, hallados);
  if (!hallados.length) throw new Error('No se pudo preparar Java 17.');
  return hallados[0];
}

// Version mayor de un Java leyendo el archivo "release" de su carpeta (sin ejecutarlo).
function mayor(javaExe) {
  try {
    const txt = fs.readFileSync(path.join(path.dirname(path.dirname(javaExe)), 'release'), 'utf8');
    const m = /JAVA_VERSION="(\d+)/.exec(txt);
    return m ? Number(m[1]) : 0;
  } catch { return 0; }
}
const es17 = (p) => p && fs.existsSync(p) && mayor(p) === 17;

// Java 17 para Forge 1.20.1: el propio ya bajado, el de Modrinth, el del launcher oficial o uno nuevo.
async function javaPath(dataDir, onText = () => {}) {
  const env = process.env;
  const propios = [];
  buscar(path.join(dataDir, 'java17'), 4, propios);
  const propio = propios.find(es17);
  if (propio) return conW(propio);
  const hallados = [];
  if (env.APPDATA) buscar(path.join(env.APPDATA, 'ModrinthApp', 'meta', 'java_versions'), 4, hallados);
  const mc = javaDelLauncher(env.APPDATA ? path.join(env.APPDATA, '.minecraft') : '');
  if (mc) hallados.push(mc);
  const ok = hallados.find(es17);
  if (ok) return conW(ok);
  return conW(await javaPropio(dataDir, onText));
}

// En Windows, javaw.exe abre el juego sin dejar una consola negra.
function conW(p) {
  const w = p.replace(/java\.exe$/i, 'javaw.exe');
  return WIN && fs.existsSync(w) ? w : p;
}

module.exports = { javaPath };
