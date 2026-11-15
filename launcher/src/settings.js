const fs = require('fs');
const path = require('path');
const os = require('os');

let file = null;
let cache = null;

function defaults() {
  const gb = Math.round(os.totalmem() / 2 ** 30);
  const base = process.platform === 'win32' ? process.env.APPDATA : os.homedir();
  return { ram: gb >= 16 ? 6 : gb >= 12 ? 5 : 4, gameDir: path.join(base, '.calacawar'), closeOnLaunch: true };
}

function init(userData) {
  file = path.join(userData, 'settings.json');
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* primera vez */ }
  cache = { ...defaults(), ...saved };
  return cache;
}

function get() { return { ...cache, maxRam: Math.max(4, Math.round(os.totalmem() / 2 ** 30)) }; }

function set(cambios) {
  const maxRam = get().maxRam;
  if (cambios.ram !== undefined) cache.ram = Math.min(maxRam, Math.max(2, Math.round(Number(cambios.ram)) || 4));
  if (typeof cambios.gameDir === 'string' && cambios.gameDir) cache.gameDir = cambios.gameDir;
  if (typeof cambios.modrinthProfile === 'string') cache.modrinthProfile = cambios.modrinthProfile;
  if (cambios.closeOnLaunch !== undefined) cache.closeOnLaunch = !!cambios.closeOnLaunch;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cache, null, 2));
  return get();
}

module.exports = { init, get, set };
