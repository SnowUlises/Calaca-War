// Descargas con verificacion de sha1 y reintentos.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

// Baja url a dest (via dest.part). Escribe pedazo por pedazo esperando cada escritura y,
// si se pasa sha1, verifica lo que quedo en el disco antes de dejar el archivo en su lugar.
async function download(url, dest, { sha1, onBytes, tries = 4 } = {}) {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  let lastErr;
  for (let i = 0; i < tries; i++) {
    let got = 0;
    let fh = null;
    try {
      const r = await fetch(url, { headers: UA, redirect: 'follow', cache: 'no-store' });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      await fs.promises.rm(tmp, { force: true });
      fh = await fs.promises.open(tmp, 'w');
      const reader = r.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        let off = 0;
        while (off < value.length) {
          const { bytesWritten } = await fh.write(value, off, value.length - off);
          off += bytesWritten;
        }
        got += value.length;
        if (onBytes) onBytes(value.length);
      }
      await fh.sync();
      await fh.close();
      fh = null;
      const largo = Number(r.headers.get('content-length'));
      if (largo && !r.headers.get('content-encoding') && got !== largo) throw new Error(`se corto la descarga (${got} de ${largo} bytes)`);
      if (sha1) {
        const real = await sha1File(tmp);
        if (real !== sha1) throw new Error(`llego distinto (${real.slice(0, 8)} en vez de ${sha1.slice(0, 8)}, ${got} bytes)`);
      }
      await fs.promises.rm(dest, { force: true });
      await fs.promises.rename(tmp, dest);
      return;
    } catch (e) {
      lastErr = e;
      if (fh) await fh.close().catch(() => {});
      if (onBytes && got) onBytes(-got);
      await fs.promises.rm(tmp, { force: true }).catch(() => {});
      await new Promise((ok) => setTimeout(ok, 1000 * (i + 1)));
    }
  }
  const causa = lastErr && lastErr.cause ? ` (${lastErr.cause.code || lastErr.cause.message})` : '';
  throw new Error(`No se pudo bajar ${path.basename(dest)}: ${lastErr.message}${causa}`);
}

module.exports = { fetchText, fetchJson, download, sha1File };
