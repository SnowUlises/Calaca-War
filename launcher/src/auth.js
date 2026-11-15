// Cuenta de Microsoft. La primera vez abre la ventana de login de Microsoft; despues se
// guarda el token de renovacion (cifrado con el almacen seguro de Windows) y no se pide mas.
const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');
const { Auth } = require('msmc');

let archivo = null;
const manager = new Auth('select_account');

const ERRORES = {
  'error.gui.closed': 'Cerraste la ventana de Microsoft antes de terminar.',
  'error.auth.minecraft.profile': 'Esa cuenta no tiene Minecraft Java comprado.',
  'error.auth.minecraft.entitlements': 'Esa cuenta no tiene Minecraft Java comprado.',
  'error.auth.xsts.user': 'Esa cuenta de Microsoft no tiene perfil de Xbox. Entrá una vez a xbox.com y volvé a intentar.',
  'error.auth.xsts.child': 'Es una cuenta de menor: un adulto tiene que agregarla a una familia de Microsoft.',
  'error.auth.xsts.banned': 'Esa cuenta está bloqueada por Xbox.',
};

function mensaje(e) {
  const code = typeof e === 'string' ? e : (e && (e.name || e.message)) || '';
  const clave = Object.keys(ERRORES).find((k) => code.startsWith(k));
  return clave ? ERRORES[clave] : `No se pudo iniciar sesión (${code || 'error desconocido'}).`;
}

function init(userData) { archivo = path.join(userData, 'cuenta.dat'); }

function guardar(xbox) {
  const datos = Buffer.from(xbox.save(), 'utf8');
  fs.writeFileSync(archivo, safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(datos.toString()) : datos);
}

function leer() {
  try {
    const b = fs.readFileSync(archivo);
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(b) : b.toString();
  } catch { return null; }
}

let cache = null; // { name, uuid } de la ultima sesion buena

function cuenta() { return cache; }

// Devuelve la autorizacion para el juego. Si no hay cuenta guardada o vencio, pide login.
async function sesion({ forzarLogin = false } = {}) {
  let xbox = null;
  const guardado = forzarLogin ? null : leer();
  if (guardado) {
    try { xbox = await manager.refresh(guardado); } catch { xbox = null; }
  }
  if (!xbox) {
    try {
      xbox = await manager.launch('electron', { width: 500, height: 650, resizable: false, title: 'Iniciar sesión' });
    } catch (e) { throw new Error(mensaje(e)); }
  }
  let mc;
  try { mc = await xbox.getMinecraft(); } catch (e) { throw new Error(mensaje(e)); }
  guardar(xbox);
  const auth = mc.mclc();
  cache = { name: auth.name, uuid: auth.uuid };
  return auth;
}

// Solo consulta si hay una cuenta guardada (sin abrir ventanas).
async function revisar() {
  const guardado = leer();
  if (!guardado) return null;
  try {
    const xbox = await manager.refresh(guardado);
    const mc = await xbox.getMinecraft();
    guardar(xbox);
    const a = mc.mclc();
    cache = { name: a.name, uuid: a.uuid };
  } catch { cache = null; }
  return cache;
}

function salir() { cache = null; try { fs.rmSync(archivo, { force: true }); } catch { /* nada */ } }

module.exports = { init, sesion, revisar, cuenta, salir };
