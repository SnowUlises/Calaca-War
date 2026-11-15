// Juega a traves de Modrinth App: crea (una sola vez) un perfil "Calaca War" importando un
// .mrpack minimo con Minecraft + Forge, y despues el launcher sincroniza el modpack dentro de
// la carpeta de ese perfil. Modrinth se encarga de la cuenta de Microsoft y de abrir el juego.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { shell } = require('electron');
const AdmZip = require('adm-zip');

const NOMBRE = 'Calaca War';

function carpetaPerfiles() {
  const base = process.env.APPDATA || '';
  for (const d of ['ModrinthApp', 'com.modrinth.theseus']) {
    const p = path.join(base, d, 'profiles');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function exe() {
  const env = process.env;
  const cands = [
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Modrinth App', 'Modrinth App.exe'),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'Modrinth App', 'Modrinth App.exe'),
    env.ProgramFiles && path.join(env.ProgramFiles, 'Modrinth App', 'Modrinth App.exe'),
    env['ProgramFiles(x86)'] && path.join(env['ProgramFiles(x86)'], 'Modrinth App', 'Modrinth App.exe'),
  ].filter(Boolean);
  return cands.find((c) => fs.existsSync(c)) || null;
}

const instalado = () => !!(carpetaPerfiles() && exe());

function listar(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
}

async function crearPerfil({ minecraft, forge, version, tmpDir, onText = () => {} }) {
  const perfiles = carpetaPerfiles();
  const antes = new Set(listar(perfiles));
  fs.mkdirSync(tmpDir, { recursive: true });
  const archivo = path.join(tmpDir, 'Calaca War.mrpack');
  const zip = new AdmZip();
  zip.addFile('modrinth.index.json', Buffer.from(JSON.stringify({
    formatVersion: 1, game: 'minecraft', versionId: version, name: NOMBRE,
    summary: 'Modpack de Calaca War. Lo mantiene actualizado el launcher de Calaca War.',
    files: [], dependencies: { minecraft, forge },
  }, null, 1)));
  zip.writeZip(archivo);
  onText('Creá el perfil en Modrinth (aceptalo si te lo pregunta)');
  const err = await shell.openPath(archivo);
  if (err) throw new Error('No se pudo abrir Modrinth para crear el perfil.');
  for (let i = 0; i < 180; i++) {
    await new Promise((ok) => setTimeout(ok, 1000));
    const nueva = listar(perfiles).find((n) => !antes.has(n) && n.toLowerCase().startsWith('calaca war'));
    if (nueva) return path.join(perfiles, nueva);
  }
  throw new Error('Modrinth no creó el perfil. Abrí Modrinth y volvé a intentar.');
}

function abrir() {
  const e = exe();
  if (!e) return false;
  spawn(e, [], { cwd: path.dirname(e), detached: true, stdio: 'ignore' }).unref();
  return true;
}

module.exports = { instalado, crearPerfil, abrir, carpetaPerfiles };
