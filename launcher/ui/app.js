const $ = (id) => document.getElementById(id);
const api = window.launcher;
const ALTOS = [22, 30, 26, 34, 34, 26, 30, 22];
const vela = (h) => `<svg class="vela" width="18" height="${h + 14}" viewBox="0 0 18 ${h + 14}" shape-rendering="crispEdges"><g class="fl"><rect x="7" y="0" width="4" height="4" fill="#FF4A2A"/><rect x="6" y="4" width="6" height="6" fill="#FF4A2A"/><rect x="8" y="5" width="2" height="5" fill="#FFC27A"/></g><rect x="8" y="10" width="2" height="3" fill="#1A1416"/><rect class="cuerpo" x="5" y="13" width="8" height="${h}"/><rect class="sombra" x="10" y="13" width="3" height="${h}"/></svg>`;

let listo = false;
let enError = false;
let version = '';

// ---- velas y escena
$('tray').innerHTML = ALTOS.map(vela).join('');
function velas(n) {
  n = Math.max(0, Math.min(8, n));
  [...$('tray').children].forEach((p, i) => p.classList.toggle('lit', i < n));
  $('count').textContent = n ? `${n} de 8` : '';
  if (window.fx) window.fx.velas(n);
  $('tray').setAttribute('aria-label', `${n} de 8 velas encendidas`);
}
function estado(titulo, sub, clase = 'hot') {
  $('status').textContent = titulo;
  $('status').className = clase;
  $('sub').textContent = sub || '\u00a0';
  $('sub').classList.toggle('full', clase === 'err');
}
function boton(texto, activo) {
  $('playTxt').textContent = texto;
  $('play').disabled = !activo;
  $('play').classList.toggle('ready', activo && listo && !enError);
}
const mb = (b) => `${Math.round(b / 1e6)} MB`;

// ---- preparar el modpack
api.onProgress((p) => {
  if (p.phase === 'selfupdate') { estado('Nuevo launcher', 'Actualizando el launcher\u2026'); return; }
  if (p.phase === 'check') { estado('Buscando novedades', 'Revisando el modpack\u2026'); return; }
  if (p.phase === 'download') {
    if (!p.count) return;
    estado('Encendiendo velas', `Bajando archivos \u00b7 ${p.done} de ${p.count} \u00b7 ${mb(p.bytes)} de ${mb(p.total)}`);
    velas(Math.min(7, Math.floor(p.frac * 8)));
    return;
  }
});

async function preparar(repair = false) {
  listo = false; enError = false;
  boton('JUGAR', false);
  velas(0);
  estado('Buscando novedades', 'Revisando el modpack\u2026');
  const r = await api.prepare({ repair });
  if (r.ok) {
    listo = true; version = r.version;
    velas(8);
    estado('El trono te espera', r.sinConexion ? `Sin conexi\u00f3n con GitHub \u00b7 jug\u00e1s con la v${r.version}` : `Modpack al d\u00eda \u00b7 v${r.version}`);
    boton('JUGAR', true);
    pintarVersion();
  } else {
    enError = true;
    estado('Se apagaron las velas', r.error, 'err');
    $('sub').title = r.error;
    boton('REINTENTAR', true);
  }
}

$('play').addEventListener('click', async () => {
  if (enError) return preparar();
  if (!listo) return;
  boton('JUGAR', false);
  estado('El trono te espera', 'Preparando\u2026');
  const r = await api.play();
  if (!r.ok) { estado('Se apagaron las velas', r.error, 'err'); $('sub').title = r.error; boton('JUGAR', true); }
});
api.onPlay((p) => {
  const pct = p.frac ? ` \u00b7 ${Math.round(p.frac * 100)}%` : '';
  estado(p.abierto ? 'A jugar' : 'Despertando al trono', `${p.text}\u2026${pct}`);
});
api.onClosed((c) => {
  if (c.code === 0) estado('El trono te espera', `Modpack al d\u00eda \u00b7 v${version}`);
  else estado('Minecraft se cerr\u00f3', c.motivo || 'Se cerr\u00f3 con un error. El detalle est\u00e1 en .calacawar/ultimo-juego.log (Ajustes \u2192 Abrir).', 'err');
  boton('JUGAR', true);
});

// ---- cuenta
function pintarCuenta(c) {
  $('acct').textContent = c ? c.name : 'Sin cuenta (se pide al tocar Jugar)';
  $('acctBtn').textContent = c ? 'Cambiar' : 'Entrar';
}
api.onAccount(pintarCuenta);
$('acctBtn').addEventListener('click', async () => {
  $('acctBtn').disabled = true;
  const r = await api.switchAccount();
  $('acctBtn').disabled = false;
  if (r.ok) pintarCuenta(r.cuenta); else $('acct').textContent = r.error;
});
api.checkAccount().then(pintarCuenta);

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
const COLOR = { nuevo: 'var(--hot)', cambios: '#C9BFB2', arreglos: '#E0A050' };
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
    head.append(el('span', 'head2', i ? resto.join(' ') : `\u00daLTIMA VERSI\u00d3N${resto.length ? ` \u00b7 ${resto.join(' ')}` : ''}`), el('span', 'chip', `v${num}`));
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
$('open').addEventListener('click', () => api.openDir());
$('repair').addEventListener('click', () => { ir('home'); preparar(true); });

$('min').addEventListener('click', () => api.minimize());
$('close').addEventListener('click', () => api.close());

velas(0);
api.onSettings((s) => pintarAjustes(s));
api.init().then((d) => { launcherVer = d.launcher; pintarAjustes(d.settings); pintarVersion(); });
api.onStart(() => preparar());
