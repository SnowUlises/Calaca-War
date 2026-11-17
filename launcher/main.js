const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const settings = require('./src/settings');
const auth = require('./src/auth');
const { syncPack } = require('./src/sync');
const { javaPath } = require('./src/java');
const { lanzar, borrarJarsRotos } = require('./src/game');
const { fetchText } = require('./src/net');

const REPO = 'SnowUlises/Calaca-War';
const MANIFEST = `https://raw.githubusercontent.com/${REPO}/main/manifest.json`;
const NOVEDADES = `https://raw.githubusercontent.com/${REPO}/main/novedades.md`;

let win = null;
let pack = null;      // resultado de la ultima sincronizacion
let ocupado = false;
let jugando = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

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
    if (repair) {
      send('progress', { phase: 'check' });
      await borrarJarsRotos(settings.get().gameDir);
      await fs.promises.rm(path.join(app.getPath('userData'), 'java'), { recursive: true, force: true });
    }
    const r = await syncPack({
      manifestUrl: MANIFEST, gameDir: settings.get().gameDir, repair,
      onProgress: (p) => send('progress', { ...p, frac: p.phase === 'download' && p.total ? p.bytes / p.total : 0 }),
    });
    pack = r;
    return { ok: true, version: r.version, forge: r.forge, minecraft: r.minecraft, sinConexion: !!r.sinConexion };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  } finally {
    ocupado = false;
  }
}

async function jugar() {
  if (!pack) return { ok: false, error: 'El modpack todavía no está listo.' };
  if (jugando) return { ok: false, error: 'Minecraft ya está abierto.' };
  if (ocupado) return { ok: false, error: 'Ya hay una tarea en curso.' };
  ocupado = true;
  try {
    const cfg = settings.get();
    send('play', { text: 'Iniciando sesión' });
    const autorizacion = await auth.sesion();
    send('account', auth.cuenta());
    send('play', { text: 'Buscando Java' });
    const java = await javaPath(path.join(app.getPath('userData'), 'java'), (text) => send('play', { text }));
    jugando = true;
    await lanzar({
      gameDir: cfg.gameDir, minecraft: pack.minecraft, forge: pack.forge, auth: autorizacion, java, ram: cfg.ram,
      onEstado: (e) => {
        send('play', e);
        if (e.abierto && win) win.hide();
      },
      onCerrado: (code, motivo) => {
        jugando = false;
        if (settings.get().closeOnLaunch && code === 0) return app.quit();
        if (win) { win.show(); win.focus(); }
        send('closed', { code, motivo });
      },
    });
    return { ok: true };
  } catch (e) {
    jugando = false;
    return { ok: false, error: e.message || String(e) };
  } finally {
    ocupado = false;
  }
}

ipcMain.handle('init', () => ({ settings: settings.get(), launcher: app.getVersion() }));
ipcMain.handle('prepare', (_e, opts) => preparar(!!(opts && opts.repair)));
ipcMain.handle('play', () => jugar());
ipcMain.handle('account:check', () => auth.revisar());
ipcMain.handle('account:switch', async () => {
  try { await auth.sesion({ forzarLogin: true }); return { ok: true, cuenta: auth.cuenta() }; } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('account:logout', () => { auth.salir(); return null; });
ipcMain.handle('settings:set', (_e, cambios) => settings.set(cambios || {}));
ipcMain.handle('settings:pickDir', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Carpeta del juego', properties: ['openDirectory', 'createDirectory'], defaultPath: settings.get().gameDir });
  return r.canceled || !r.filePaths[0] ? settings.get() : settings.set({ gameDir: r.filePaths[0] });
});
ipcMain.handle('openDir', async () => {
  const dir = settings.get().gameDir;
  await fs.promises.mkdir(dir, { recursive: true });
  const err = await shell.openPath(dir);
  return err ? { ok: false, error: err } : { ok: true };
});
ipcMain.handle('news', async () => { try { return await fetchText(NOVEDADES); } catch { return null; } });
ipcMain.on('win:min', () => win && win.minimize());
ipcMain.on('win:close', () => app.quit());

app.whenReady().then(async () => {
  settings.init(app.getPath('userData'));
  auth.init(app.getPath('userData'));
  crearVentana();
  win.webContents.once('did-finish-load', async () => {
    await actualizarLauncher();
    send('start');
  });
});
app.on('window-all-closed', () => { if (!jugando) app.quit(); });
