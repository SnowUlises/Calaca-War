const $ = (id) => document.getElementById(id);
const api = window.launcher;
const PIP = '<svg class="pip" viewBox="0 0 28 44"><g class="fl"><polygon points="14,1 19,11 14,18 9,11" fill="#FF9B2F"/><polygon points="14,7 16.5,12 14,16 11.5,12" fill="#FFE9A8"/></g><rect x="13" y="17" width="2" height="4" fill="#221E19"/><rect class="body" x="9" y="21" width="10" height="17"/><rect class="shade" x="16" y="21" width="3" height="17"/><rect class="hold" x="5" y="38" width="18" height="4"/></svg>';

let listo = false;
let enError = false;
let version = '';

// ---- velas y escena
$('tray').innerHTML = PIP.repeat(8);
$('scene').innerHTML = Array.from({ length: 9 }, (_, i) => `<img src="scenes/${i}.svg" alt="" data-n="${i}">`).join('');
function velas(n) {
  n = Math.max(0, Math.min(8, n));
  [...$('tray').children].forEach((p, i) => p.classList.toggle('lit', i < n));
  [...$('scene').children].forEach((img, i) => img.classList.toggle('on', i === n));
  $('count').textContent = `${n} / 8`;
  if (window.fx) window.fx.velas(n);
  $('tray').setAttribute('aria-label', `${n} de 8 velas encendidas`);
}
function estado(titulo, sub, clase = 'gold') {
  $('status').textContent = titulo;
  $('status').className = clase;
  $('sub').textContent = sub || '\u00a0';
}
function boton(texto, activo) {
  $('playTxt').textContent = texto;
  $('play').disabled = !activo;
  $('play').classList.toggle('ready', activo && listo && !enError);
}
const mb = (b) => `${Math.round(b / 1e6)} MB`;

// ---- preparar el modpack
api.onProgress((p) => {
  if (p.phase === 'selfupdate') { estado('NUEVO LAUNCHER', 'Actualizando el launcher\u2026'); return; }
  if (p.phase === 'check') { estado('BUSCANDO NOVEDADES', 'Revisando el modpack\u2026'); return; }
  if (p.phase === 'download') {
    if (!p.count) return;
    estado('ENCENDIENDO VELAS', `Bajando archivos \u00b7 ${p.done} de ${p.count} \u00b7 ${mb(p.bytes)} de ${mb(p.total)}`);
    velas(Math.min(7, Math.floor(p.frac * 8 / 0.85 * 0.875)));
    return;
  }
  if (p.phase === 'forge') { estado('ENCENDIENDO VELAS', `${p.text}\u2026`); velas(7); }
});

async function preparar(repair = false) {
  listo = false; enError = false;
  boton('JUGAR', false);
  velas(0);
  estado('BUSCANDO NOVEDADES', 'Revisando el modpack\u2026');
  const r = await api.prepare({ repair });
  if (r.ok) {
    listo = true; version = r.version;
    velas(8);
    estado('EL TRONO ESPERA', `Modpack al d\u00eda \u00b7 v${r.version}`);
    boton('JUGAR', true);
    pintarVersion();
  } else {
    enError = true;
    estado('SE APAGARON LAS VELAS', r.error, 'err');
    $('sub').title = r.error;
    boton('REINTENTAR', true);
  }
}

$('play').addEventListener('click', async () => {
  if (enError) return preparar();
  if (!listo) return;
  boton('JUGAR', false);
  estado('EL TRONO ESPERA', 'Abriendo Minecraft\u2026');
  const r = await api.play();
  if (!r.ok) { estado(r.manual ? 'ABR\u00cd MINECRAFT' : 'SE APAGARON LAS VELAS', r.error, r.manual ? 'gold' : 'err'); $('sub').title = r.error; boton('JUGAR', true); return; }
  setTimeout(() => { estado('EL TRONO ESPERA', 'Eleg\u00ed el perfil Calaca War y dale a Jugar'); boton('JUGAR', true); }, 6000);
});

// ---- pestanas
let noticias = false;
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => ir(b.dataset.tab)));
function ir(tab) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  document.body.classList.toggle('inner', tab !== 'home');
  $('v-news').hidden = tab !== 'news';
  $('v-settings').hidden = tab !== 'settings';
  if (tab === 'news' && !noticias) cargarNovedades();
  if (window.fx) window.fx.adentro(tab !== 'home');
}

// ---- novedades (novedades.md del repo)
const COLOR = { nuevo: 'var(--gold)', cambios: 'var(--alma)', arreglos: 'var(--red)' };
function parsear(md) {
  const vers = [];
  let v = null; let s = null;
  for (const raw of md.split(/\r?\n/)) {
    const l = raw.trim();
    if (l.startsWith('## ')) { v = { titulo: l.slice(3), secciones: [] }; vers.push(v); s = null; }
    else if (l.startsWith('### ') && v) { s = { titulo: l.slice(4), items: [] }; v.secciones.push(s); }
    else if (/^[-*] /.test(l) && v) { if (!s) { s = { titulo: '', items: [] }; v.secciones.push(s); } s.items.push(l.slice(2)); }
  }
  return vers;
}
function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
async function cargarNovedades() {
  const caja = $('news');
  caja.replaceChildren(el('div', 'empty', 'Buscando novedades\u2026'));
  const md = await api.news();
  const vers = md ? parsear(md) : [];
  if (!vers.length) { caja.replaceChildren(el('div', 'empty', 'No se pudieron cargar las novedades.')); return; }
  noticias = true;
  caja.replaceChildren(...vers.map((v, i) => {
    const [num, ...resto] = v.titulo.split(/\s+[\u2014-]\s+/);
    const card = el('section', i ? 'rel old' : 'rel');
    const head = el('div', 'row');
    head.append(el('span', 'head', i ? resto.join(' ') : `\u00daLTIMA VERSI\u00d3N${resto.length ? ` \u00b7 ${resto.join(' ')}` : ''}`), el('span', 'chip', `v${num}`));
    card.append(head);
    for (const s of v.secciones) {
      const d = el('div');
      const color = COLOR[s.titulo.toLowerCase()] || 'var(--ink2)';
      if (s.titulo) { const h = el('h3', '', s.titulo.toUpperCase()); h.style.color = color; d.append(h); }
      const ul = el('ul');
      for (const it of s.items) { const li = el('li'); li.style.color = color; li.append(el('span', '', it)); ul.append(li); }
      d.append(ul); card.append(d);
    }
    return card;
  }));
}

// ---- ajustes
let launcherVer = '';
function pintarVersion() { $('ver').textContent = `LAUNCHER v${launcherVer}${version ? ` \u00b7 MODPACK v${version}` : ''}`; }
function pintarAjustes(s) {
  $('ram').max = s.maxRam; $('ram').value = s.ram;
  $('ramVal').textContent = `${s.ram} GB`; $('ramMax').textContent = `${s.maxRam} GB`;
  $('dir').textContent = s.gameDir; $('dir').title = s.gameDir;
  $('closeOn').checked = s.closeOnLaunch;
}
$('ram').addEventListener('input', () => { $('ramVal').textContent = `${$('ram').value} GB`; });
$('ram').addEventListener('change', async () => pintarAjustes(await api.setSettings({ ram: Number($('ram').value) })));
$('closeOn').addEventListener('change', () => api.setSettings({ closeOnLaunch: $('closeOn').checked }));
$('pick').addEventListener('click', async () => {
  const antes = $('dir').textContent;
  const s = await api.pickDir();
  pintarAjustes(s);
  if (s.gameDir !== antes) { ir('home'); preparar(); }
});
$('repair').addEventListener('click', () => { ir('home'); preparar(true); });

$('min').addEventListener('click', () => api.minimize());
$('close').addEventListener('click', () => api.close());

velas(0);
api.init().then((d) => { launcherVer = d.launcher; pintarAjustes(d.settings); pintarVersion(); });
api.onStart(() => preparar());
