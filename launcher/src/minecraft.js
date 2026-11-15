// Perfil "Calaca War" en el launcher oficial de Minecraft, y abrirlo.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const WIN = process.platform === 'win32';
const STORE_APP = 'Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft';
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

function openOfficialLauncher() {
  if (!WIN) return false;
  const env = process.env;
  const exes = [
    env['ProgramFiles(x86)'] && path.join(env['ProgramFiles(x86)'], 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    env.ProgramFiles && path.join(env.ProgramFiles, 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    'C:\\XboxGames\\Minecraft Launcher\\Content\\Minecraft.exe',
  ].filter((p) => p && fs.existsSync(p));
  if (exes.length) spawn(exes[0], [], { detached: true, stdio: 'ignore' }).unref();
  else spawn('explorer.exe', [`shell:AppsFolder\\${STORE_APP}`], { detached: true, stdio: 'ignore' }).unref();
  return true;
}

module.exports = { mcDir, writeProfile, openOfficialLauncher, cerrarLauncherOficial };
