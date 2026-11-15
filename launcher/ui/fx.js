// Animacion de fondo: brasas rojas que suben despacio y un parpadeo leve de luz de fuego sobre el trono.
(function () {
  const cv = document.getElementById('fx');
  const ctx = cv.getContext('2d');
  const img = document.getElementById('trono');
  const W = cv.width;
  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const COLORES = ['#C21826', '#FF4A2A', '#8E1222', '#FF6B5A'];
  let brasas = [];
  let nivel = 0;
  let dentro = false;

  const nueva = () => ({
    x: rnd(40, 400), y: rnd(470, 560), vx: rnd(-0.12, 0.12), vy: -rnd(0.25, 0.6),
    vida: 0, max: rnd(220, 380), s: Math.random() < 0.25 ? 3 : 2,
    c: COLORES[Math.floor(rnd(0, COLORES.length))], w: rnd(0, 6),
  });

  // Parpadeo de fuego: brillo por escalones, a intervalos irregulares.
  const BRILLOS = [0.9, 0.95, 1, 1, 1.04];
  function parpadeo() {
    if (img) img.style.filter = `brightness(${BRILLOS[Math.floor(Math.random() * BRILLOS.length)] + nivel * 0.008})`;
    setTimeout(parpadeo, rnd(90, 260));
  }

  let t = 0;
  let ultimo = 0;
  function cuadro(ahora) {
    requestAnimationFrame(cuadro);
    if (ahora - ultimo < 33) return;
    ultimo = ahora;
    t += 1 / 30;
    ctx.clearRect(0, 0, W, cv.height);
    const objetivo = dentro ? 0 : 4 + nivel * 2;
    if (brasas.length < objetivo && Math.random() < 0.15) brasas.push(nueva());
    brasas = brasas.filter((b) => b.vida < b.max);
    for (const b of brasas) {
      b.vida += 1;
      b.x += b.vx + Math.sin((t + b.w) * 1.6) * 0.2;
      b.y += b.vy;
      const resto = 1 - b.vida / b.max;
      ctx.globalAlpha = resto > 0.6 ? 0.85 : resto > 0.3 ? 0.5 : 0.2;
      ctx.fillStyle = b.c;
      ctx.fillRect(Math.round(b.x / 2) * 2, Math.round(b.y / 2) * 2, b.s, b.s);
    }
    ctx.globalAlpha = 1;
  }

  window.fx = { velas(n) { nivel = n; }, adentro(v) { dentro = v; } };
  if (!quieto) { requestAnimationFrame(cuadro); parpadeo(); }
}());
