/* Sandwich Runner — تم نارنجی + تغییر کاراکتر هر 200 امتیاز
   - آسان، ریسپانسیو و بدون باگ
   - Restart فیکس
   - Coyote Time + Jump Buffer
   - کاراکتر: ساندویچ → هات‌داگ → برگر → پیتزا (هر 200 امتیاز چنج) */

(() => {
  const $ = (q) => document.querySelector(q);
  const modal = $('#gameModal');
  const openBtn = $('#openGameBtn');
  const closeBtn = $('#closeGameBtn');
  const canvas = $('#gameCanvas');
  const scoreEl = $('#score');
  const hiEl = $('#highScore');
  const levelEl = $('#level');
  const jumpBtn = $('#jumpBtn');
  const restartBtn = $('#restartBtn');
  const musicBtn = document.getElementById('musicBtn'); // <- بعد از تعریف همه المان‌ها


  // موزیک Ambient (ملایم)
  const gameMusic = new Audio('Forget-Me-Not (DnB Remix)   Samuel Petra.mp3');
gameMusic.loop = true;
gameMusic.volume = 0.3;
let musicOn = false;

musicBtn.addEventListener('click', () => {
  if (musicOn) {
    gameMusic.pause();
    musicBtn.textContent = '🎵 موزیک';
  } else {
    gameMusic.play().catch(e=>{});
    musicBtn.textContent = '🔇 قطع موزیک';
  }
  musicOn = !musicOn;
});


  // وضعیت
  const S = {
    running: false,
    rafId: 0,
    dpr: 1,
    w: 0, h: 0, groundY: 0,
    // فیزیک
    speed: 0, baseSpeed: 160,
    gravity: 1500,
    jumpVel: -720,
    lastTime: 0,
    // امتیاز
    score: 0, high: Number(localStorage.getItem('sandwichHighScore') || 0),
    level: 1,
    // اسپان
    tNextObs: 0, tNextCoin: 0,
    // اشیا
    obstacles: [], coins: [], particles: [], clouds: [], hills: [],
    // بازیکن
    player: { x: 0, y: 0, w: 52, h: 44, vy: 0, onGround: true },
    // پرش بخشنده
    coyoteTime: 0, jumpBuffer: 0, jumpPressed: false,
    // کاراکتر
    char: 'sandwich', charIndex: 0
  };

const CHAR_ORDER = [
  'sandwich',   // ساندویچ با نان، پنیر، گوشت، کاهو
  'soda',       // نوشابه با شفافیت و نی
  'hotdog',     // هات‌داگ با سوسیس و خردل موجی
  'sushi',      // رول سوشی با برنج و ماهی
  'burger',     // برگر با گوشت، پنیر، سبزیجات
  'pizza',      // پیتزا با تاپینگ و کراست
  'fries',      // سیب‌زمینی سرخ‌کرده با رنگ واقعی
  'taco',       // تاکو با گوشت و سبزیجات
  'donut',      // دونات با گلِیز و شکلات
  'icecream',   // بستنی قیفی با رنگ واقعی
  'cookie'      // کوکی با شکلات چیپس
];

  const SPAWN = {
    obsMin: 1.4, obsMax: 2.2,
    coinMin: 2.0, coinMax: 3.2,
    coinSafeGapX: 180
  };

  const rand = (a,b)=> a + Math.random()*(b-a);

  function resizeCanvas() {
    const holder = canvas.parentElement.getBoundingClientRect();
    S.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    S.w = Math.floor(holder.width);
    S.h = Math.floor(holder.height);
    canvas.width = Math.floor(S.w * S.dpr);
    canvas.height = Math.floor(S.h * S.dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(S.dpr,0,0,S.dpr,0,0);

    S.groundY = S.h - 58;
    S.player.x = Math.round(S.w * 0.18);
    S.player.y = S.groundY - S.player.h;
  }

  function buildHills() {
    S.hills = [
      { y: S.groundY - 80, color:'#99cfb6', speed: 8, points: genHill(6) },
      { y: S.groundY - 50, color:'#8bc7ae', speed: 16, points: genHill(8) }
    ];
    function genHill(n){
      const pts=[]; const step = S.w/ (n-1);
      for(let i=0;i<n;i++){ pts.push({ x: i*step, h: rand(12,26)}); }
      return pts;
    }
  }

  function spawnObstacle() {
    const last = S.obstacles[S.obstacles.length - 1];
    if (last && last.x > S.w - 20) { S.tNextObs = .4; return; }
    const type = Math.random() < 0.6 ? 'cactus' : 'rock';
    const h = (type === 'cactus') ? rand(38, 55) : rand(30, 42);
    const w = (type === 'cactus') ? 26 : 40;
    S.obstacles.push({ type, x: S.w + 10, y: S.groundY - h, w, h });
    S.tNextObs = rand(SPAWN.obsMin, SPAWN.obsMax);
  }

  function spawnCoin() {
    const anyNear = S.obstacles.some(o => o.x > S.w - 160);
    if (anyNear) { S.tNextCoin = .8; return; }
    const x = S.w + 10;
    let y = rand(S.groundY - 140, S.groundY - 90);
    const front = S.obstacles.find(o => o.x > x - 40);
    if (front) y = Math.min(y, front.y - 20);
    S.coins.push({ x, y, r: 14, collected: false });
    S.tNextCoin = rand(SPAWN.coinMin, SPAWN.coinMax);
  }

  // ترسیم آسمان/ابر/تپه/زمین
  function drawSky(ctx) {
    const g = ctx.createLinearGradient(0,0,0,S.h);
    g.addColorStop(0, '#86c5ee'); g.addColorStop(.6, '#9ad9c9'); g.addColorStop(1, '#8fe08f');
    ctx.fillStyle = g; ctx.fillRect(0,0,S.w,S.h);
    ctx.fillStyle = 'rgba(255,255,255,.94)';
    S.clouds.forEach(cl=>{
      ctx.beginPath();
      const r = cl.s;
      ctx.arc(cl.x, cl.y, r, 0, 2*Math.PI);
      ctx.arc(cl.x - r*.6, cl.y+4, r*.8, 0, 2*Math.PI);
      ctx.arc(cl.x + r*.6, cl.y+6, r*.7, 0, 2*Math.PI);
      ctx.fill();
    });
    S.hills.forEach(h=>{
      ctx.fillStyle = h.color;
      ctx.beginPath();
      ctx.moveTo(0, S.groundY);
      for (let i=0;i<h.points.length;i++){
        const p = h.points[i];
        const x = (p.x - (performance.now()/50 * h.speed)%S.w + S.w) % S.w;
        const y = h.y - p.h;
        ctx.lineTo(x,y);
      }
      ctx.lineTo(S.w, S.groundY);
      ctx.closePath(); ctx.fill();
    });
  }

  function drawGround(ctx) {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, S.groundY, S.w, S.h - S.groundY);
    ctx.fillStyle = '#78d96f';
    ctx.fillRect(0, S.groundY, S.w, 5);
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  function drawShadow(ctx, x, y, w) {
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath();
    ctx.ellipse(x + w/2, S.groundY + 10, w*0.6, 8, 0, 0, 2*Math.PI);
    ctx.fill();
  }

  // کاراکترها
  function drawSandwich(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    // نان پایین
    ctx.fillStyle = '#F2C88F';
    roundRect(ctx, x, y + h*0.55, w, h*0.45, 10); ctx.fill();
    ctx.strokeStyle = '#BD854A'; ctx.stroke();
    // کاهو
    ctx.fillStyle = '#58b368';
    ctx.beginPath();
    const ly = y + h*0.55;
    ctx.moveTo(x+6, ly);
    for(let i=0;i<6;i++){
      const px = x + 6 + i*(w-12)/5;
      ctx.quadraticCurveTo(px+5, ly+10, px+12, ly);
    }
    ctx.lineTo(x+w-6, ly+6); ctx.lineTo(x+6, ly+6); ctx.closePath(); ctx.fill();
    // پنیر
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.moveTo(x + w*0.38, y + h*0.48);
    ctx.lineTo(x + w*0.62, y + h*0.48);
    ctx.lineTo(x + w*0.5, y + h*0.68);
    ctx.closePath(); ctx.fill();
    // نان بالا
    ctx.fillStyle = '#F8DEA9';
    roundRect(ctx, x, y + h*0.2, w, h*0.4, 12); ctx.fill();
    ctx.strokeStyle = '#BD854A'; ctx.stroke();
  }

  function drawHotdog(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    // نان بالا
    ctx.fillStyle = '#F7D08A';
    roundRect(ctx, x, y + h*0.18, w, h*0.28, 14); ctx.fill();
    ctx.strokeStyle = '#C07A3D'; ctx.stroke();
    // سوسیس
    ctx.fillStyle = '#C84C31';
    roundRect(ctx, x+4, y + h*0.35, w-8, h*0.22, 12); ctx.fill();
    // خردل موجی
    ctx.strokeStyle = '#FFD54F'; ctx.lineWidth = 3;
    ctx.beginPath();
    let yy = y + h*0.44;
    ctx.moveTo(x+8, yy);
    for (let i=1;i<=6;i++){
      const xx = x + 8 + i*(w-16)/6;
      ctx.quadraticCurveTo(xx-6, yy-6*(i%2?1:-1), xx, yy);
    }
    ctx.stroke();
    // نان پایین
    ctx.fillStyle = '#F2C88F';
    roundRect(ctx, x, y + h*0.56, w, h*0.26, 14); ctx.fill();
    ctx.strokeStyle = '#C07A3D'; ctx.stroke();
  }

  function drawBurger(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    // نان بالا
    ctx.fillStyle = '#F8DEA9';
    roundRect(ctx, x, y + h*0.16, w, h*0.28, 12); ctx.fill();
    ctx.strokeStyle = '#BD854A'; ctx.stroke();
    // کنجد
    ctx.fillStyle = '#FFF3CD';
    for (let i=0;i<6;i++){ ctx.fillRect(x+10+i*10, y+h*0.22+(i%2?4:0), 3, 2); }
    // پنیر
    ctx.fillStyle = '#FFD54F';
    ctx.fillRect(x + w*0.25, y + h*0.46, w*0.5, 6);
    // کاهو
    ctx.fillStyle = '#58b368'; ctx.fillRect(x+6, y+h*0.5, w-12, 6);
    // گوشت
    ctx.fillStyle = '#5C3D2E'; ctx.fillRect(x+6, y+h*0.56, w-12, 10);
    // نان پایین
    ctx.fillStyle = '#F2C88F';
    roundRect(ctx, x, y + h*0.66, w, h*0.2, 10); ctx.fill();
    ctx.strokeStyle = '#BD854A'; ctx.stroke();
  }

  function drawPizza(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    // برش پیتزا (مثلث)
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.moveTo(x + w*0.15, y + h*0.2);
    ctx.lineTo(x + w*0.85, y + h*0.45);
    ctx.lineTo(x + w*0.15, y + h*0.7);
    ctx.closePath(); ctx.fill();
    // کراست
    ctx.strokeStyle = '#BD854A'; ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x + w*0.15, y + h*0.2);
    ctx.lineTo(x + w*0.35, y + h*0.28);
    ctx.stroke(); ctx.lineWidth = 1;
    // تاپینگ (پپرونی)
    ctx.fillStyle = '#C84C31';
    const peps = [
      {px: .35, py: .42}, {px:.55, py:.48}, {px:.45, py:.58}
    ];
    peps.forEach(p=>{
      ctx.beginPath();
      ctx.arc(x+w*p.px, y+h*p.py, 4, 0, 2*Math.PI);
      ctx.fill();
    });
  }

  function drawCharacter(ctx, x, y, w, h) {
    switch (S.char) {
      case 'hotdog': return drawHotdog(ctx, x, y, w, h);
      case 'burger': return drawBurger(ctx, x, y, w, h);
      case 'pizza':  return drawPizza(ctx, x, y, w, h);
      default:       return drawSandwich(ctx, x, y, w, h);
    }
  }

  function drawCactus(ctx, o) {
    ctx.fillStyle = '#2e8b57';
    roundRect(ctx, o.x, o.y, o.w, o.h, 8); ctx.fill();
    roundRect(ctx, o.x - 10, o.y + o.h*0.3, 12, 22, 6); ctx.fill();
    roundRect(ctx, o.x + o.w - 2, o.y + o.h*0.45, 12, 22, 6); ctx.fill();
    ctx.strokeStyle = '#1f5e3a'; ctx.lineWidth = 2;
    for(let i=0;i<5;i++){ ctx.beginPath(); ctx.moveTo(o.x+4+i*(o.w-8)/4, o.y+6); ctx.lineTo(o.x+4+i*(o.w-8)/4, o.y+14); ctx.stroke(); }
    ctx.lineWidth = 1;
  }

  function drawRock(ctx, o) {
    ctx.fillStyle = '#6e6e6e';
    ctx.beginPath();
    ctx.moveTo(o.x, o.y+o.h*0.6);
    ctx.quadraticCurveTo(o.x+o.w*0.2, o.y, o.x+o.w*0.6, o.y+o.h*0.2);
    ctx.quadraticCurveTo(o.x+o.w, o.y+o.h*0.4, o.x+o.w*0.9, o.y+o.h);
    ctx.lineTo(o.x+o.w*0.1, o.y+o.h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9c9c9c';
    ctx.fillRect(o.x+o.w*0.4, o.y+o.h*0.4, 6, 4);
  }

  function drawObstacle(ctx, o) { if (o.type==='cactus') drawCactus(ctx,o); else drawRock(ctx,o); }

  function drawStar(ctx, c) {
    ctx.save(); ctx.translate(c.x, c.y);
    ctx.rotate((performance.now()/700) % (Math.PI*2));
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const ang = (i * 2 * Math.PI) / 5;
      const x1 = Math.cos(ang) * c.r, y1 = Math.sin(ang) * c.r;
      const x2 = Math.cos(ang + Math.PI/5) * (c.r*0.5), y2 = Math.sin(ang + Math.PI/5) * (c.r*0.5);
      if (i===0) ctx.moveTo(x1,y1); else ctx.lineTo(x1,y1);
      ctx.lineTo(x2,y2);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawParticles(ctx) {
    S.particles.forEach(p => { ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 3, 3); }); ctx.globalAlpha = 1;
  }

  function updateCharacterByScore() {
    const idx = Math.floor(S.score / 150) % CHAR_ORDER.length;
    if (idx !== S.charIndex) {
      S.charIndex = idx;
      S.char = CHAR_ORDER[idx];
    }
  }

  // منطق
  function resetGameVars() {
    S.speed = S.baseSpeed;
    S.player.vy = 0; S.player.onGround = true;
    S.obstacles.length = 0; S.coins.length = 0; S.particles.length = 0; S.clouds.length = 0;
    S.score = 0; S.level = 1;
    S.tNextObs = rand(1.4, 2.2);
    S.tNextCoin = rand(2.0, 3.2);
    for(let i=0;i<5;i++) S.clouds.push({ x: rand(0,S.w), y: rand(20,120), s: rand(16,28), v: rand(10,18) });
    buildHills();
    scoreEl.textContent = '0'; levelEl.textContent = '1'; hiEl.textContent = S.high;
    S.coyoteTime = 0; S.jumpBuffer = 0; S.jumpPressed = false;
    S.charIndex = 0; S.char = 'sandwich';
  }

  function openGame() {
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    resizeCanvas(); resetGameVars();
    S.running = true; S.lastTime = performance.now();
    S.rafId = requestAnimationFrame(loop);
  }
  function closeGame() {
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    S.running = false;
    cancelAnimationFrame(S.rafId);
  }
  function restartGame() {
    resizeCanvas(); resetGameVars();
    S.running = true; S.lastTime = performance.now();
    cancelAnimationFrame(S.rafId);
    S.rafId = requestAnimationFrame(loop);
  }

  

  function update(dt) {
    if (S.coyoteTime > 0) S.coyoteTime -= dt;
    if (S.jumpBuffer > 0) { S.jumpBuffer -= dt; if (tryJump()) S.jumpBuffer = 0; }

    S.clouds.forEach(cl => { cl.x -= cl.v*dt; if (cl.x < -60) { cl.x = S.w + 40; cl.y = rand(20,120); } });

    S.player.vy += S.gravity * dt;
    S.player.y += S.player.vy * dt;
    if (S.player.y >= S.groundY - S.player.h) {
      if (!S.player.onGround) S.coyoteTime = 0.12;
      S.player.y = S.groundY - S.player.h; S.player.vy = 0; S.player.onGround = true;
    }

    S.tNextObs -= dt; if (S.tNextObs <= 0) spawnObstacle();
    S.tNextCoin -= dt; if (S.tNextCoin <= 0) spawnCoin();

    for (let i=S.obstacles.length-1;i>=0;i--){
      const o = S.obstacles[i]; o.x -= S.speed * dt;
      if (o.x + o.w < 0) { S.obstacles.splice(i,1); addScore(10); }
    }

    for (let i=S.coins.length-1;i>=0;i--){
      const c = S.coins[i]; c.x -= S.speed * dt;
      if (!c.collected && aabb(S.player.x+6, S.player.y+6, S.player.w-12, S.player.h-10, c.x-c.r, c.y-c.r, c.r*2, c.r*2)) {
        c.collected = true; addScore(50);
        for(let j=0;j<12;j++) S.particles.push({ x:c.x, y:c.y, vx: Math.cos(j*Math.PI/6)*220, vy: Math.sin(j*Math.PI/6)*220, a:1, c:'#FFD700' });
      }
      if (c.x + c.r < 0 || c.collected) S.coins.splice(i,1);
    }

    for(let i=S.particles.length-1;i>=0;i--){
      const p=S.particles[i]; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 600*dt; p.a -= 1.2*dt; if (p.a<=0) S.particles.splice(i,1);
    }

    const px = S.player.x+6, py = S.player.y+6, pw = S.player.w-12, ph = S.player.h-10;
    for (let i=0;i<S.obstacles.length;i++) {
      const o = S.obstacles[i];
      if (aabb(px,py,pw,ph, o.x,o.y,o.w,o.h)) { gameOver(); break; }
    }

    const target = S.baseSpeed + Math.min(80, S.score*0.25);
    S.speed += (target - S.speed) * 0.02;
  }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function addScore(v){
    S.score += v; scoreEl.textContent = S.score;
    updateCharacterByScore(); // هر 200 امتیاز کاراکتر رو آپدیت کن
    let lvl = 1;
    if (S.score >= 350) lvl = 5;
    else if (S.score >= 220) lvl = 4;
    else if (S.score >= 140) lvl = 3;
    else if (S.score >= 60) lvl = 2;
    if (lvl !== S.level) { S.level = lvl; levelEl.textContent = lvl; }
  }

  function gameOver() {
    S.running = false;
    if (S.score > S.high) { S.high = S.score; localStorage.setItem('sandwichHighScore', String(S.high)); hiEl.textContent = S.high; }
    setTimeout(()=>{ if (!S.running) restartGame(); }, 1200);
  }

  function render() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,S.w,S.h);
    drawSky(ctx);
    drawGround(ctx);
    S.obstacles.forEach(o => drawObstacle(ctx,o));
    S.coins.forEach(c => drawStar(ctx,c));
    drawCharacter(ctx, S.player.x, S.player.y, S.player.w, S.player.h);
    drawParticles(ctx);
  }

  function loop(t) {
    if (!S.running) return;
    const dt = Math.min(.033, (t - S.lastTime)/1000);
    S.lastTime = t;
    update(dt);
    render();
    S.rafId = requestAnimationFrame(loop);
  }

  // رویدادها
  openBtn.addEventListener('click', openGame);
  closeBtn.addEventListener('click', () => { closeGame(); });
  restartBtn.addEventListener('click', () => { restartGame(); });
  jumpBtn.addEventListener('click', () => queueJump());
  canvas.addEventListener('pointerdown', (e)=>{ e.preventDefault(); queueJump(); }, {passive:false});
  window.addEventListener('pointerup', ()=>{ if(S.player.vy < -240) S.player.vy = -240; });
  window.addEventListener('keydown', (e)=>{
    if (modal.getAttribute('aria-hidden') === 'false') {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); queueJump(); }
      if (e.code === 'KeyM') musicBtn.click();
    }
  });
  window.addEventListener('keyup', (e)=>{
    if (e.code === 'Space' || e.code === 'ArrowUp') { if(S.player.vy < -240) S.player.vy = -240; }
  });

  musicBtn.addEventListener('click', ()=>{
    if (Ambient.isOn()) { Ambient.stop(); musicBtn.textContent = '🎵 موزیک'; }
    else { Ambient.start(); musicBtn.textContent = '🔇 قطع موزیک'; }
  });
 const safeResize = () => { const run = S.running; resizeCanvas(); if(!run) render(); };
  window.addEventListener('resize', safeResize);
  window.addEventListener('orientationchange', ()=> setTimeout(safeResize, 250));

  (function init(){
    resizeCanvas(); buildHills(); render(); hiEl.textContent = S.high;
  })();
  modal.addEventListener('pointerdown', (e) => {
  if (S.running) queueJump();
});
function drawTaco(ctx, x, y, w, h) {
  drawShadow(ctx, x, y, w);
  ctx.fillStyle = '#E2C16D'; // پوسته تاکو
  ctx.beginPath();
  ctx.arc(x + w/2, y + h*0.6, w/2, Math.PI, 2*Math.PI);
  ctx.closePath();
  ctx.fill();

  // مواد داخلی
  ctx.fillStyle = '#6b4c2a'; // گوشت
  ctx.fillRect(x + 8, y + h*0.5, w - 16, 6);
  ctx.fillStyle = '#58b368'; // کاهو
  ctx.fillRect(x + 8, y + h*0.45, w - 16, 4);
  ctx.fillStyle = '#d32f2f'; // گوجه
  ctx.fillRect(x + 8, y + h*0.4, w - 16, 3);
}
function drawDonut(ctx, x, y, w, h) {
  drawShadow(ctx, x, y, w);
  ctx.fillStyle = '#f3c17a'; // بدنه
  ctx.beginPath();
  ctx.arc(x + w/2, y + h/2, w/2.2, 0, 2*Math.PI);
  ctx.fill();
  // سوراخ وسط
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + w/2, y + h/2, w/4.5, 0, 2*Math.PI);
  ctx.fill();
  // رویه
  ctx.strokeStyle = '#d14b8f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x + w/2, y + h/2, w/2.2, 0, 2*Math.PI);
  ctx.stroke();
  ctx.lineWidth = 1;
}
function drawCharacter(ctx, x, y, w, h) {
  switch (S.char) {
    case 'hotdog': return drawHotdog(ctx, x, y, w, h);
    case 'burger': return drawBurger(ctx, x, y, w, h);
    case 'pizza':  return drawPizza(ctx, x, y, w, h);
    case 'taco':   return drawTaco(ctx, x, y, w, h);
    case 'donut':  return drawDonut(ctx, x, y, w, h);
    default:       return drawSandwich(ctx, x, y, w, h);
  }
}
// افزایش سرعت بازی مثل داینو گوگل ولی سریع‌تر
const maxSpeed = 1200;           // حداکثر سرعت واقعی
const acceleration = 85;        // شتاب بیشتر بر ثانیه
S.speed += acceleration * dt;   // افزایش سرعت بر حسب زمان
if (S.speed > maxSpeed) S.speed = maxSpeed; // محدود کردن سرعت
// فقط وقتی روی canvas کلیک شد پرش
canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    queueJump();
}, { passive: false });

// دکمه‌ها نباید پرش بدهند، پس چیزی اضافه نمی‌کنیم
jumpBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // جلوگیری از رسیدن رویداد به canvas
    queueJump();
});
function queueJump() {
    tryJump();   // فقط یکبار پرش بزن
}

// مطمئن شو در tryJump مقدار vy ثابت و کافی است
function tryJump() {
    if (S.player.onGround || S.coyoteTime > 0) {
        S.player.vy = -750;  // سرعت پرش را افزایش بده
        S.player.onGround = false;
        S.coyoteTime = 0;
        for(let i=0;i<10;i++)
            S.particles.push({ x: S.player.x + S.player.w/2, y: S.groundY, vx: rand(-90,90), vy: rand(-250,-50), a:1, c:'#FFC107' });
        return true;
    }
    return false;
}

// موزیک از فایل محلی




musicBtn.addEventListener('click', () => {
  if (musicOn) {
    gameMusic.pause();
    musicBtn.textContent = '🎵 موزیک';
  } else {
    gameMusic.play().catch(e => {}); // جلوگیری از خطا در مرورگر
    musicBtn.textContent = '🔇 قطع موزیک';
  }
  musicOn = !musicOn;
});

// CHAR_ORDER: sandwich, sushi, soda, fries, hotdog, burger, pizza, taco, donut, icecream, cookie

// =======================================================================
//  توابع جدید و با جزئیات برای ترسیم کاراکترها (این بلوک را جایگزین کنید)
// =======================================================================

function drawSandwich(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    ctx.save();
    ctx.translate(x, y);

    // نان پایین
    let breadGradient = ctx.createLinearGradient(0, h * 0.6, 0, h);
    breadGradient.addColorStop(0, '#FADCA5');
    breadGradient.addColorStop(1, '#EAC276');
    ctx.fillStyle = breadGradient;
    roundRect(ctx, 0, h * 0.6, w, h * 0.4, 8);
    ctx.fill();
    ctx.strokeStyle = '#C59A58';
    ctx.stroke();

    // گوشت (ژامبون)
    ctx.fillStyle = '#E57373';
    roundRect(ctx, w * 0.1, h * 0.55, w * 0.8, h * 0.15, 5);
    ctx.fill();

    // پنیر ذوب شده
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(w * 0.05, h * 0.5);
    ctx.lineTo(w * 0.95, h * 0.45);
    ctx.lineTo(w * 0.8, h * 0.65);
    ctx.lineTo(w * 0.2, h * 0.7);
    ctx.closePath();
    ctx.fill();

    // کاهوی فرفری
    ctx.fillStyle = '#8BC34A';
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.45);
    ctx.quadraticCurveTo(w * 0.25, h * 0.35, w * 0.4, h * 0.45);
    ctx.quadraticCurveTo(w * 0.55, h * 0.55, w * 0.7, h * 0.45);
    ctx.quadraticCurveTo(w * 0.85, h * 0.35, w * 0.9, h * 0.45);
    ctx.lineTo(w * 0.8, h * 0.55);
    ctx.lineTo(w * 0.2, h * 0.55);
    ctx.closePath();
    ctx.fill();

    // نان بالا
    ctx.fillStyle = breadGradient;
    roundRect(ctx, 0, h * 0.1, w, h * 0.4, 12);
    ctx.fill();
    ctx.strokeStyle = '#C59A58';
    ctx.stroke();

    ctx.restore();
}

function drawHotdog(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    ctx.save();
    ctx.translate(x, y);

    // نان
    let bunGradient = ctx.createLinearGradient(0, 0, w, 0);
    bunGradient.addColorStop(0, '#F8DDA9');
    bunGradient.addColorStop(1, '#EABF7A');
    ctx.fillStyle = bunGradient;
    roundRect(ctx, 0, h * 0.3, w, h * 0.6, 15);
    ctx.fill();
    ctx.fillStyle = '#FFF5E1'; // قسمت داخلی نان
    roundRect(ctx, 5, h * 0.35, w - 10, h * 0.2, 10);
    ctx.fill();

    // سوسیس
    let sausageGradient = ctx.createLinearGradient(0, h * 0.3, 0, h * 0.7);
    sausageGradient.addColorStop(0, '#d95e4a');
    sausageGradient.addColorStop(1, '#a63c2b');
    ctx.fillStyle = sausageGradient;
    roundRect(ctx, 8, h * 0.25, w - 16, h * 0.4, 12);
    ctx.fill();

    // هایلایت سوسیس
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    roundRect(ctx, 12, h * 0.28, w - 24, h * 0.1, 6);
    ctx.fill();

    // سس خردل
    ctx.strokeStyle = '#FFC107';
    ctx.lineWidth = 4;
    ctx.beginPath();
    let yy = h * 0.45;
    ctx.moveTo(15, yy);
    for (let i = 1; i <= 5; i++) {
        const xx = 15 + i * (w - 30) / 5;
        ctx.quadraticCurveTo(xx - 5, yy - 10 * (i % 2 ? 1 : -1), xx, yy);
    }
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.restore();
}

function drawBurger(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    ctx.save();
    ctx.translate(x, y);

    // نان پایین
    ctx.fillStyle = '#F2C88F';
    roundRect(ctx, 0, h * 0.7, w, h * 0.25, 8);
    ctx.fill();
    ctx.fillStyle = '#FFF5E1';
    ctx.fillRect(0, h * 0.7, w, 5);

    // گوشت برگر
    let pattyGradient = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.7);
    pattyGradient.addColorStop(0, '#795548');
    pattyGradient.addColorStop(1, '#5D4037');
    ctx.fillStyle = pattyGradient;
    roundRect(ctx, 3, h * 0.5, w - 6, h * 0.25, 8);
    ctx.fill();

    // پنیر
    ctx.fillStyle = '#FFC107';
    ctx.beginPath();
    ctx.moveTo(2, h * 0.48);
    ctx.lineTo(w - 2, h * 0.48);
    ctx.lineTo(w - 5, h * 0.6);
    ctx.lineTo(5, h * 0.6);
    ctx.closePath();
    ctx.fill();

    // کاهو
    ctx.fillStyle = '#8BC34A';
    ctx.fillRect(5, h * 0.43, w - 10, h * 0.1);

    // نان بالا
    let bunGradient = ctx.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, w * 0.6);
    bunGradient.addColorStop(0, '#FADCA5');
    bunGradient.addColorStop(1, '#E7A854');
    ctx.fillStyle = bunGradient;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.35, w / 2, Math.PI, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();

    // کنجد
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let i = 0; i < 10; i++) {
        ctx.save();
        ctx.translate(w * 0.2 + Math.random() * w * 0.6, h * 0.2 + Math.random() * h * 0.15);
        ctx.rotate(Math.random() * Math.PI);
        ctx.fillRect(-2, -1, 4, 2);
        ctx.restore();
    }
    ctx.restore();
}

function drawPizza(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    ctx.save();
    ctx.translate(x, y);

    // خمیر پیتزا (مثلث)
    let cheeseGradient = ctx.createLinearGradient(0, 0, w, h);
    cheeseGradient.addColorStop(0, '#FFEB3B');
    cheeseGradient.addColorStop(1, '#FFC107');
    ctx.fillStyle = cheeseGradient;
    ctx.beginPath();
    ctx.moveTo(w * 0.95, h * 0.5);
    ctx.lineTo(w * 0.1, h * 0.85);
    ctx.lineTo(w * 0.1, h * 0.15);
    ctx.closePath();
    ctx.fill();

    // کراست (نان دور)
    let crustGradient = ctx.createLinearGradient(0, 0, w * 0.2, h);
    crustGradient.addColorStop(0, '#F5D58A');
    crustGradient.addColorStop(1, '#D6A854');
    ctx.fillStyle = crustGradient;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.15);
    ctx.quadraticCurveTo(w * 0.05, h * 0.5, w * 0.1, h * 0.85);
    ctx.quadraticCurveTo(w * 0.15, h * 0.5, w * 0.1, h * 0.15);
    ctx.fill();


    // پپرونی
    const peps = [{ px: .3, py: .4 }, { px: .6, py: .5 }, { px: .4, py: .65 }];
    peps.forEach(p => {
        let pepperoniGradient = ctx.createRadialGradient(w * p.px, h * p.py, 1, w * p.px, h * p.py, 8);
        pepperoniGradient.addColorStop(0, '#E53935');
        pepperoniGradient.addColorStop(1, '#B71C1C');
        ctx.fillStyle = pepperoniGradient;
        ctx.beginPath();
        ctx.arc(w * p.px, h * p.py, 8, 0, 2 * Math.PI);
        ctx.fill();
        // هایلایت چربی
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(w * p.px - 2, h * p.py - 2, 2, 0, 2 * Math.PI);
        ctx.fill();
    });
    ctx.restore();
}

function drawSushi(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    ctx.save();
    ctx.translate(x, y);

    // نوری (جلبک)
    ctx.fillStyle = '#2C3E50';
    roundRect(ctx, 0, h * 0.1, w, h * 0.8, 15);
    ctx.fill();

    // برنج
    ctx.fillStyle = '#F5F5F5';
    roundRect(ctx, 5, h * 0.15, w - 10, h * 0.7, 12);
    ctx.fill();
    // بافت برنج
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.arc(10 + Math.random() * (w - 20), h * 0.2 + Math.random() * (h * 0.6), 1, 0, 2 * Math.PI);
        ctx.fill();
    }

    // ماهی
    let fishGradient = ctx.createLinearGradient(0, 0, w, 0);
    fishGradient.addColorStop(0, '#FF8A65');
    fishGradient.addColorStop(1, '#FF7043');
    ctx.fillStyle = fishGradient;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.25, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
}

function drawSoda(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    ctx.save();
    ctx.translate(x, y);

    // لیوان
    ctx.fillStyle = 'rgba(224, 242, 241, 0.8)'; // شیشه ای
    ctx.beginPath();
    ctx.moveTo(w * 0.1, 0);
    ctx.lineTo(w * 0.9, 0);
    ctx.lineTo(w * 0.75, h * 0.9);
    ctx.lineTo(w * 0.25, h * 0.9);
    ctx.closePath();
    ctx.fill();

    // نوشابه
    ctx.fillStyle = '#C2185B'; // رنگ شاد
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.1);
    ctx.lineTo(w * 0.85, h * 0.1);
    ctx.lineTo(w * 0.72, h * 0.8);
    ctx.lineTo(w * 0.28, h * 0.8);
    ctx.closePath();
    ctx.fill();

    // حباب ها
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(w * 0.3 + Math.random() * w * 0.4, h * 0.2 + Math.random() * h * 0.6, Math.random() * 3 + 1, 0, 2 * Math.PI);
        ctx.fill();
    }

    // نی
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w * 0.6, h * 0.5);
    ctx.lineTo(w * 0.7, -h * 0.05);
    ctx.stroke();
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
}

function drawFries(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    ctx.save();
    ctx.translate(x, y);

    // جعبه
    ctx.fillStyle = '#E53935';
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h);
    ctx.lineTo(w * 0.25, h * 0.3);
    ctx.lineTo(w * 0.75, h * 0.3);
    ctx.lineTo(w * 0.9, h);
    ctx.closePath();
    ctx.fill();

    // لوگوی روی جعبه
    ctx.fillStyle = '#FFC107';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.65, w * 0.15, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.arc(w / 2, h * 0.65, w * 0.1, 0.8 * Math.PI, 0.2 * Math.PI, true);
    ctx.closePath();
    ctx.fill();


    // سیب زمینی ها
    let fryGradient = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.4);
    fryGradient.addColorStop(0, '#FFEB3B');
    fryGradient.addColorStop(1, '#FBC02D');
    ctx.fillStyle = fryGradient;
    ctx.strokeStyle = 'rgba(120, 80, 20, 0.3)';

    for (let i = 0; i < 8; i++) {
        const fryW = 6 + Math.random() * 2;
        const fryH = h * 0.3 + Math.random() * h * 0.2;
        const fryX = w * 0.3 + Math.random() * w * 0.4;
        roundRect(ctx, fryX - fryW / 2, h * 0.4 - fryH, fryW, fryH, 3);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
}

function drawTaco(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    ctx.save();
    ctx.translate(x, y);

    // پوسته تاکو
    let tacoGradient = ctx.createLinearGradient(0, h * 0.2, 0, h);
    tacoGradient.addColorStop(0, '#FFCA28');
    tacoGradient.addColorStop(1, '#F57F17');
    ctx.fillStyle = tacoGradient;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.3, w / 2, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.arc(w / 2, h * 0.3, w * 0.3, 0.8 * Math.PI, 0.2 * Math.PI, true);
    ctx.closePath();
    ctx.fill();

    // گوشت
    ctx.fillStyle = '#8D6E63';
    ctx.fillRect(w * 0.25, h * 0.25, w * 0.5, h * 0.2);

    // کاهو
    ctx.fillStyle = '#7CB342';
    ctx.fillRect(w * 0.25, h * 0.2, w * 0.5, h * 0.1);

    // گوجه
    ctx.fillStyle = '#E53935';
    ctx.fillRect(w * 0.3, h * 0.18, w * 0.1, h * 0.08);
    ctx.fillRect(w * 0.6, h * 0.18, w * 0.1, h * 0.08);

    ctx.restore();
}

function drawDonut(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    ctx.save();
    ctx.translate(x, y);

    // خمیر دونات
    let donutGradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w / 2);
    donutGradient.addColorStop(0, '#FADCA5');
    donutGradient.addColorStop(1, '#D6A854');
    ctx.fillStyle = donutGradient;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2, 0, 2 * Math.PI, false);
    ctx.arc(w / 2, h / 2, w * 0.25, 0, 2 * Math.PI, true); // سوراخ وسط
    ctx.fill();

    // رویه شکلاتی
    ctx.fillStyle = '#EC407A'; // Pink Icing
    ctx.beginPath();
    ctx.moveTo(w * 0.9, h * 0.2);
    ctx.quadraticCurveTo(w, h / 2, w * 0.8, h * 0.8);
    ctx.quadraticCurveTo(w / 2, h, w * 0.2, h * 0.8);
    ctx.quadraticCurveTo(0, h / 2, w * 0.1, h * 0.2);
    ctx.quadraticCurveTo(w / 2, -h * 0.1, w * 0.9, h * 0.2);
    ctx.closePath();
    ctx.fill();

    // ترافل های رنگی
    for (let i = 0; i < 15; i++) {
        ctx.fillStyle = ['#4FC3F7', '#FFF176', '#AED581'][i % 3];
        ctx.save();
        const angle = Math.random() * 2 * Math.PI;
        const radius = w * 0.3 + Math.random() * w * 0.15;
        ctx.translate(w / 2 + Math.cos(angle) * radius, h / 2 + Math.sin(angle) * radius);
        ctx.rotate(Math.random() * Math.PI);
        ctx.fillRect(-3, -1, 6, 2);
        ctx.restore();
    }
    ctx.restore();
}

function drawIcecream(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    ctx.save();
    ctx.translate(x, y);

    // نان قیفی
    let coneGradient = ctx.createLinearGradient(w / 2, h * 0.3, w / 2, h);
    coneGradient.addColorStop(0, '#FBC02D');
    coneGradient.addColorStop(1, '#E65100');
    ctx.fillStyle = coneGradient;
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.3);
    ctx.lineTo(w * 0.85, h * 0.3);
    ctx.lineTo(w / 2, h);
    ctx.closePath();
    ctx.fill();
    // خطوط نان
    ctx.strokeStyle = 'rgba(150, 80, 0, 0.4)';
    for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2 - (w * 0.35 * (i / 5)), h * 0.3 + (h * 0.7 * (i / 5)));
        ctx.lineTo(w / 2 + (w * 0.35 * (i / 5)), h * 0.3 + (h * 0.7 * (i / 5)));
        ctx.stroke();
    }


    // اسکوپ بستنی
    let creamGradient = ctx.createRadialGradient(w / 2, h * 0.3, 5, w / 2, h * 0.3, w * 0.4);
    creamGradient.addColorStop(0, '#FFEBEE'); // Light Pink
    creamGradient.addColorStop(1, '#E91E63'); // Dark Pink
    ctx.fillStyle = creamGradient;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.3, w * 0.35, Math.PI, 2 * Math.PI);
    ctx.quadraticCurveTo(w * 0.9, h * 0.1, w / 2, h * 0.05);
    ctx.quadraticCurveTo(w * 0.1, h * 0.1, w * 0.15, h * 0.3);
    ctx.fill();

    ctx.restore();
}

function drawCookie(ctx, x, y, w, h) {
    drawShadow(ctx, x, y, w);
    ctx.save();
    ctx.translate(x, y);

    // بدنه کوکی
    let cookieGradient = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    cookieGradient.addColorStop(0, '#F5D58A');
    cookieGradient.addColorStop(1, '#C59A58');
    ctx.fillStyle = cookieGradient;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2.1, 0, 2 * Math.PI);
    ctx.fill();

    // چیپس شکلات
    for (let i = 0; i < 7; i++) {
        ctx.fillStyle = '#5D4037';
        ctx.beginPath();
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * w * 0.3;
        const chipSize = 5 + Math.random() * 5;
        ctx.arc(w / 2 + Math.cos(angle) * radius, h / 2 + Math.sin(angle) * radius, chipSize / 2, 0, 2 * Math.PI);
        ctx.fill();
    }
    ctx.restore();
}

// تابع اصلی برای انتخاب کاراکتر
function drawCharacter(ctx, x, y, w, h) {
    switch (S.char) {
      case 'sandwich': return drawSandwich(ctx, x, y, w, h);
      case 'sushi':    return drawSushi(ctx, x, y, w, h);
      case 'soda':     return drawSoda(ctx, x, y, w, h);
      case 'hotdog':   return drawHotdog(ctx, x, y, w, h);
      case 'burger':   return drawBurger(ctx, x, y, w, h);
      case 'pizza':    return drawPizza(ctx, x, y, w, h);
      case 'fries':    return drawFries(ctx, x, y, w, h);
      case 'taco':     return drawTaco(ctx, x, y, w, h);
      case 'donut':    return drawDonut(ctx, x, y, w, h);
      case 'icecream': return drawIcecream(ctx, x, y, w, h);
      case 'cookie':   return drawCookie(ctx, x, y, w, h);
      default:         return drawSandwich(ctx, x, y, w, h);
    }
}

// =======================================================================
//  پایان بلوک جایگزینی
// =======================================================================
// یک drawCharacter کلی
function drawCharacter(ctx, x, y, w, h){
    switch(S.char){
        case 'sandwich': return drawSandwich(ctx,x,y,w,h);
        case 'sushi': return drawSushi(ctx,x,y,w,h);
        case 'soda': return drawSoda(ctx,x,y,w,h);
        case 'fries': return drawFries(ctx,x,y,w,h);
        case 'hotdog': return drawHotdog(ctx,x,y,w,h);
        case 'burger': return drawBurger(ctx,x,y,w,h);
        case 'pizza': return drawPizza(ctx,x,y,w,h);
        case 'taco': return drawTaco(ctx,x,y,w,h);
        case 'donut': return drawDonut(ctx,x,y,w,h);
        case 'icecream': return drawIcecream(ctx,x,y,w,h);
        case 'cookie': return drawCookie(ctx,x,y,w,h);
    }
}


})();