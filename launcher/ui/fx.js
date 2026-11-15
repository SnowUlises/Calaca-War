// Fondo animado: estrellas que titilan arriba y brasas que suben desde el trono.
// Todo en pixeles cuadrados para que se vea como Minecraft.
(function () {
  const cv = document.getElementById('fx');
  const ctx = cv.getContext('2d');
  const W = cv.width;
  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const COLORES = ['#FFC66B', '#FF9B2F', '#F5A623', '#FFE9A8'];

  const estrellas = Array.from({ length: 34 }, () => ({
    x: Math.floor(rnd(0, W / 2)) * 2, y: Math.floor(rnd(20, 230) / 2) * 2,
    s: Math.random() < 0.18 ? 3 : 2, f: rnd(0, Math.PI * 2), v: rnd(0.6, 1.8),
  }));
  let brasas = [];
  let nivel = 0;      // 0..8 velas prendidas
  let dentro = false; // en Novedades o Ajustes

  function nueva() {
    const izq = Math.random() < 0.5;
    return {
      x: izq ? rnd(60, 200) : rnd(240, 380), y: rnd(330, 420),
      vx: rnd(-0.15, 0.15), vy: -rnd(0.35, 0.9), vida: 0, max: rnd(140, 260),
      s: Math.random() < 0.3 ? 3 : 2, c: COLORES[Math.floor(rnd(0, COLORES.length))], w: rnd(0, 6),
    };
  }

  let t = 0;
  let ultimo = 0;
  function cuadro(ahora) {
    requestAnimationFrame(cuadro);
    if (ahora - ultimo < 33) return; // ~30 fps alcanza
    ultimo = ahora;
    t += 1 / 30;
    ctx.clearRect(0, 0, W, cv.height);

    for (const e of estrellas) {
      const a = 0.25 + 0.6 * Math.max(0, Math.sin(t * e.v + e.f));
      ctx.globalAlpha = a > 0.7 ? 0.95 : a > 0.45 ? 0.6 : 0.3; // por escalones, no suave
      ctx.fillStyle = '#F4EBDC';
      ctx.fillRect(e.x, e.y, e.s, e.s);
    }

    const objetivo = dentro ? 4 : 6 + nivel * 3;
    if (brasas.length < objetivo && Math.random() < 0.25) brasas.push(nueva());
    brasas = brasas.filter((b) => b.vida < b.max);
    for (const b of brasas) {
      b.vida += 1;
      b.x += b.vx + Math.sin((t + b.w) * 2) * 0.25;
      b.y += b.vy;
      const resto = 1 - b.vida / b.max;
      ctx.globalAlpha = resto > 0.6 ? 0.9 : resto > 0.3 ? 0.55 : 0.25;
      ctx.fillStyle = b.c;
      ctx.fillRect(Math.round(b.x / 2) * 2, Math.round(b.y / 2) * 2, b.s, b.s);
    }
    ctx.globalAlpha = 1;
  }

  window.fx = {
    velas(n) { nivel = n; },
    adentro(v) { dentro = v; },
  };
  if (!quieto) requestAnimationFrame(cuadro);
}());
