// Instala Forge en el .minecraft del launcher oficial si todavia no esta.
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const AdmZip = require('adm-zip');
const { download } = require('./net');

const WIN = process.platform === 'win32';
const JAVA = WIN ? 'java.exe' : 'java';
const STORE = 'Microsoft.4297127D64EC6_8wekyb3d8bbwe';

const versionId = (mc, forge) => `${mc}-forge-${forge}`;

function forgeInstalado(mcDir, mc, forge) {
  const id = versionId(mc, forge);
  return fs.existsSync(path.join(mcDir, 'versions', id, `${id}.json`))
    && fs.existsSync(path.join(mcDir, 'libraries', 'net', 'minecraftforge', 'forge', `${mc}-${forge}`));
}

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

function javaDelSistema() {
  try {
    const r = spawnSync('java', ['-version'], { encoding: 'utf8', windowsHide: true });
    const m = /version "(\d+)/.exec(`${r.stderr}${r.stdout}`);
    return m && Number(m[1]) >= 17 ? 'java' : null;
  } catch { return null; }
}

async function javaPropio(dataDir, onText) {
  const dir = path.join(dataDir, 'java17');
  const hallados = [];
  buscar(dir, 4, hallados);
  if (hallados.length) return hallados[0];
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

async function ensureForge({ mcDir, dataDir, mc, forge, onText = () => {} }) {
  if (forgeInstalado(mcDir, mc, forge)) return false;
  await fs.promises.mkdir(mcDir, { recursive: true });
  await fs.promises.mkdir(dataDir, { recursive: true });
  // El instalador de Forge exige que exista el archivo de perfiles del launcher.
  const perfiles = ['launcher_profiles.json', 'launcher_profiles_microsoft_store.json'].map((f) => path.join(mcDir, f));
  if (!perfiles.some((f) => fs.existsSync(f))) fs.writeFileSync(perfiles[0], JSON.stringify({ profiles: {}, settings: {}, version: 3 }, null, 2));

  onText(`Bajando Forge ${forge}`);
  const jar = path.join(dataDir, `forge-${mc}-${forge}-installer.jar`);
  await download(`https://maven.minecraftforge.net/net/minecraftforge/forge/${mc}-${forge}/forge-${mc}-${forge}-installer.jar`, jar);
  const java = javaDelLauncher(mcDir) || javaDelSistema() || (await javaPropio(dataDir, onText));

  onText(`Instalando Forge ${forge}`);
  const salida = await new Promise((resolve, reject) => {
    const p = spawn(java, ['-jar', jar, '--installClient', mcDir], { cwd: dataDir, windowsHide: true });
    let log = '';
    p.stdout.on('data', (d) => { log = (log + d).slice(-4000); });
    p.stderr.on('data', (d) => { log = (log + d).slice(-4000); });
    p.on('error', reject);
    p.on('close', (code) => resolve({ code, log }));
  });
  if (salida.code !== 0 || !forgeInstalado(mcDir, mc, forge)) {
    fs.writeFileSync(path.join(dataDir, 'forge-error.log'), salida.log);
    throw new Error('No se pudo instalar Forge. Abri una vez el launcher de Minecraft y volve a intentar.');
  }
  await fs.promises.rm(jar, { force: true });
  return true;
}

module.exports = { ensureForge, versionId };
