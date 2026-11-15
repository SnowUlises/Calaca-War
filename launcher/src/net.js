// Descargas con verificacion de sha1 y reintentos.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const UA = { 'User-Agent': 'CalacaWarLauncher' };

async function fetchText(url) {
  const sep = url.includes('?') ? '&' : '?';
  const r = await fetch(`${url}${sep}t=${Date.now()}`, { headers: UA, cache: 'no-store' });
  if (!r.ok) throw new Error(`No se pudo leer ${url} (${r.status})`);
  return r.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

function sha1File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha1');
    fs.createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

// Baja url a dest (via dest.part). Si se pasa sha1, lo verifica antes de dejar el archivo en su lugar.
async function download(url, dest, { sha1, onBytes, tries = 3 } = {}) {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  let lastErr;
  for (let i = 0; i < tries; i++) {
    let got = 0;
    try {
      const r = await fetch(url, { headers: UA, redirect: 'follow' });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const src = Readable.fromWeb(r.body);
      src.on('data', (d) => { got += d.length; if (onBytes) onBytes(d.length); });
      await pipeline(src, fs.createWriteStream(tmp));
      // Se verifica lo que quedo escrito en el disco, no lo que paso por la red.
      if (sha1 && (await sha1File(tmp)) !== sha1) throw new Error('el archivo llego corrupto');
      await fs.promises.rm(dest, { force: true });
      await fs.promises.rename(tmp, dest);
      return;
    } catch (e) {
      lastErr = e;
      if (onBytes && got) onBytes(-got);
      await fs.promises.rm(tmp, { force: true });
      await new Promise((ok) => setTimeout(ok, 800 * (i + 1)));
    }
  }
  throw new Error(`No se pudo bajar ${path.basename(dest)}: ${lastErr.message}`);
}

module.exports = { fetchText, fetchJson, download, sha1File };
