const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const settings = require('./src/settings');
const { syncPack } = require('./src/sync');
const { ensureForge, versionId } = require('./src/forge');
const mc = require('./src/minecraft');
const { fetchText } = require('./src/net');

const REPO = 'SnowUlises/Calaca-War';
const MANIFEST = `https://raw.githubusercontent.com/${REPO}/main/manifest.json`;
const NOVEDADES = `https://raw.githubusercontent.com/${REPO}/main/novedades.md`;

let win = null;
let pack = null;      // resultado de la ultima sincronizacion
let ocupado = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function send(canal, datos) { if (win && !win.isDestroyed()) win.webContents.send(canal, datos); }

function crearVentana() {
  win = new BrowserWindow({
    width: 440, height: 720, useContentSize: true, resizable: false, maximizable: false, fullscreenable: false,
    frame: false, show: false, backgroundColor: '#0E0A14', title: 'Calaca War',
    icon: path.join(__dirname, 'ui', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

// Actualizacion del propio launcher (solo instalado, no en desarrollo).
function actualizarLauncher() {
  return new Promise((resolve) => {
    if (!app.isPackaged) return resolve(false);
    let au;
    try { au = require('electron-updater').autoUpdater; } catch { return resolve(false); }
    const fin = setTimeout(() => resolve(false), 15000);
    au.autoDownload = true;
    au.on('update-available', () => { clearTimeout(fin); send('progress', { phase: 'selfupdate' }); });
    au.on('update-not-available', () => { clearTimeout(fin); resolve(false); });
    au.on('error', () => { clearTimeout(fin); resolve(false); });
    au.on('update-downloaded', () => { au.quitAndInstall(true, true); });
    au.checkForUpdates().catch(() => { clearTimeout(fin); resolve(false); });
  });
}

async function preparar(repair) {
  if (ocupado) return { ok: false, error: 'Ya hay una tarea en curso.' };
  ocupado = true;
  pack = null;
  try {
    const cfg = settings.get();
    const r = await syncPack({
      manifestUrl: MANIFEST, gameDir: cfg.gameDir, repair,
      onProgress: (p) => send('progress', { ...p, frac: p.phase === 'download' && p.total ? 0.85 * (p.bytes / p.total) : 0 }),
    });
    send('progress', { phase: 'forge', frac: 0.88, text: `Revisando Forge ${r.forge}` });
    await ensureForge({
      mcDir: mc.mcDir(), dataDir: path.join(app.getPath('userData'), 'forge'), mc: r.minecraft, forge: r.forge,
      onText: (text) => send('progress', { phase: 'forge', frac: 0.9, text }),
    });
    pack = r;
    return { ok: true, version: r.version, forge: r.forge, minecraft: r.minecraft };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  } finally {
    ocupado = false;
  }
}

ipcMain.handle('init', () => ({ settings: settings.get(), launcher: app.getVersion() }));
ipcMain.handle('prepare', (_e, opts) => preparar(!!(opts && opts.repair)));
ipcMain.handle('play', async () => {
  if (!pack) return { ok: false, error: 'El modpack todavia no esta listo.' };
  try {
    const cfg = settings.get();
    mc.cerrarLauncherOficial();
    mc.writeProfile({ versionId: versionId(pack.minecraft, pack.forge), gameDir: cfg.gameDir, ram: cfg.ram });
    const r = await mc.openOfficialLauncher();
    if (!r.ok) return { ok: false, manual: true, error: 'No encontr\u00e9 el launcher de Minecraft. El perfil Calaca War ya est\u00e1 listo: abrilo vos y eleg\u00ed ese perfil.' };
    if (cfg.closeOnLaunch) setTimeout(() => app.quit(), 2500);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});
ipcMain.handle('settings:set', (_e, cambios) => settings.set(cambios || {}));
ipcMain.handle('settings:pickDir', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Carpeta del juego', properties: ['openDirectory', 'createDirectory'], defaultPath: settings.get().gameDir });
  return r.canceled || !r.filePaths[0] ? settings.get() : settings.set({ gameDir: r.filePaths[0] });
});
ipcMain.handle('news', async () => { try { return await fetchText(NOVEDADES); } catch { return null; } });
ipcMain.on('win:min', () => win && win.minimize());
ipcMain.on('win:close', () => app.quit());

app.whenReady().then(async () => {
  settings.init(app.getPath('userData'));
  crearVentana();
  win.webContents.once('did-finish-load', async () => {
    await actualizarLauncher();
    send('start');
  });
});
app.on('window-all-closed', () => app.quit());
