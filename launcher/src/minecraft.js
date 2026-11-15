// Perfil "Calaca War" en el launcher oficial de Minecraft, y abrirlo.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const WIN = process.platform === 'win32';
const PERFIL = 'calaca-war';
const GC = '-XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M';

function mcDir() {
  return WIN ? path.join(process.env.APPDATA, '.minecraft') : path.join(os.homedir(), '.minecraft');
}

function cerrarLauncherOficial() {
  if (!WIN) return;
  for (const exe of ['MinecraftLauncher.exe', 'Minecraft.exe']) {
    const r = spawnSync('tasklist', ['/FI', `IMAGENAME eq ${exe}`, '/NH'], { encoding: 'utf8', windowsHide: true });
    if (r.stdout && r.stdout.toLowerCase().includes(exe.toLowerCase())) spawnSync('taskkill', ['/IM', exe, '/F'], { windowsHide: true });
  }
}

// Crea el perfil o actualiza el que ya existe. De un perfil existente solo se tocan
// version, carpeta, memoria y fecha de uso: nombre, icono y demas quedan como los dejo el jugador.
function writeProfile({ versionId, gameDir, ram, icon }) {
  const dir = mcDir();
  fs.mkdirSync(dir, { recursive: true });
  let archivos = ['launcher_profiles.json', 'launcher_profiles_microsoft_store.json'].map((f) => path.join(dir, f)).filter((f) => fs.existsSync(f));
  if (!archivos.length) archivos = [path.join(dir, 'launcher_profiles.json')];
  const ahora = new Date().toISOString();
  for (const file of archivos) {
    let data = {};
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* archivo nuevo o roto */ }
    if (!data.profiles || typeof data.profiles !== 'object') data.profiles = {};
    const previo = data.profiles[PERFIL];
    const xmx = `-Xmx${ram}G`;
    let javaArgs = `${xmx} ${GC}`;
    if (previo && typeof previo.javaArgs === 'string' && /-Xmx\S+/.test(previo.javaArgs)) javaArgs = previo.javaArgs.replace(/-Xmx\S+/, xmx);
    data.profiles[PERFIL] = {
      created: ahora,
      icon: icon || 'Carved_Pumpkin',
      name: 'Calaca War',
      type: 'custom',
      ...previo,
      lastUsed: ahora,
      lastVersionId: versionId,
      gameDir,
      javaArgs,
    };
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  }
}

// Busca el ejecutable del launcher oficial. Orden: instalador clasico, instalacion de la app
// Xbox (XboxGames en cualquier disco) y, por ultimo, la ubicacion que reporta Windows del paquete.
function exesEn(dir) {
  let items = [];
  try { items = fs.readdirSync(dir); } catch { return []; }
  const exes = items.filter((n) => /\.exe$/i.test(n) && /minecraft/i.test(n) && !/installer|uninstall|crash|helper/i.test(n));
  const puntos = (n) => (/^minecraft\.exe$/i.test(n) ? 3 : /^minecraftlauncher\.exe$/i.test(n) ? 2 : 1);
  return exes.sort((x, y) => puntos(y) - puntos(x)).map((n) => path.join(dir, n));
}

function rutaPaquete() {
  try {
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '(Get-AppxPackage -Name Microsoft.4297127D64EC6 | Select-Object -First 1).InstallLocation'],
    { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    return (r.stdout || '').trim();
  } catch { return ''; }
}

function buscarLauncher() {
  const env = process.env;
  const cands = [];
  for (const pf of [env['ProgramFiles(x86)'], env.ProgramFiles]) {
    if (pf) cands.push(path.join(pf, 'Minecraft Launcher', 'MinecraftLauncher.exe'));
  }
  for (const c of cands) if (fs.existsSync(c)) return c;
  for (const letra of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
    const base = `${letra}:\\XboxGames\\Minecraft Launcher`;
    if (!fs.existsSync(base)) continue;
    const exes = [...exesEn(path.join(base, 'Content')), ...exesEn(base)];
    if (exes.length) return exes[0];
  }
  const paquete = rutaPaquete();
  if (paquete && !/\\WindowsApps\\/i.test(paquete)) {
    const exes = [...exesEn(paquete), ...exesEn(path.join(paquete, 'Content'))];
    if (exes.length) return exes[0];
  }
  return null;
}

function abrir(exe) {
  return new Promise((resolve) => {
    try {
      const p = spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore' });
      p.once('error', () => resolve(false));
      p.once('spawn', () => { p.unref(); resolve(true); });
    } catch { resolve(false); }
  });
}

async function openOfficialLauncher() {
  if (!WIN) return { ok: false };
  const exe = buscarLauncher();
  if (exe && (await abrir(exe))) return { ok: true, exe };
  return { ok: false };
}

module.exports = { mcDir, writeProfile, openOfficialLauncher, cerrarLauncherOficial };
