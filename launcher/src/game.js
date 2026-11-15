// Arranca Minecraft + Forge directamente (sin el launcher oficial), como hace Modrinth.
const fs = require('fs');
const path = require('path');
const { Client } = require('minecraft-launcher-core');
const { download } = require('./net');

async function lanzar({ gameDir, minecraft, forge, auth, java, ram, onEstado = () => {}, onCerrado = () => {} }) {
  const instalador = path.join(gameDir, '.calacawar', `forge-${minecraft}-${forge}-installer.jar`);
  if (!fs.existsSync(instalador)) {
    onEstado({ text: `Bajando Forge ${forge}` });
    await download(`https://maven.minecraftforge.net/net/minecraftforge/forge/${minecraft}-${forge}/forge-${minecraft}-${forge}-installer.jar`, instalador);
  }
  const cliente = new Client();
  let ultimo = 0;
  cliente.on('progress', (p) => {
    const ahora = Date.now();
    if (ahora - ultimo < 150) return;
    ultimo = ahora;
    const que = { assets: 'Bajando sonidos y texturas', 'assets-copy': 'Copiando recursos', natives: 'Bajando librerías', classes: 'Bajando librerías', 'classes-custom': 'Preparando Forge', 'classes-maven-custom': 'Preparando Forge' }[p.type] || 'Preparando Minecraft';
    onEstado({ text: que, frac: p.total ? p.task / p.total : 0 });
  });
  let abierto = false;
  const log = [];
  cliente.on('data', (d) => {
    const s = String(d);
    log.push(s); if (log.length > 300) log.shift();
    if (!abierto && /Backend library|LWJGL|Setting user/i.test(s)) { abierto = true; onEstado({ text: 'Abriendo Minecraft', abierto: true }); }
  });
  cliente.on('close', (code) => {
    fs.mkdirSync(path.join(gameDir, '.calacawar'), { recursive: true });
    fs.writeFileSync(path.join(gameDir, '.calacawar', 'ultimo-juego.log'), log.join(''));
    onCerrado(code);
  });
  onEstado({ text: 'Preparando Minecraft', frac: 0 });
  const proc = await cliente.launch({
    authorization: auth,
    root: gameDir,
    version: { number: minecraft, type: 'release' },
    forge: instalador,
    javaPath: java,
    memory: { max: `${ram}G`, min: `${Math.min(2, ram)}G` },
    overrides: { detached: false },
  });
  if (!proc) throw new Error('No se pudo arrancar Minecraft. Probá con Reparar.');
  return proc;
}

module.exports = { lanzar };
