/*
  © 2025 Thaís Moura — Licenciado sob MIT.
*/
(() => {
  // ---------- ELEMENTOS ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const sizeSel = document.getElementById('sizeSel');
  const newBtn = document.getElementById('newBtn');
  const againBtn = document.getElementById('againBtn');
  const nextBtn = document.getElementById('nextBtn');
  const winOverlay = document.getElementById('winOverlay');
  const winTitle = document.getElementById('winTitle');
  const winDesc = document.getElementById('winDesc');
  const levelTag = document.getElementById('levelTag');
  const stage = document.getElementById('stage');
  const underControls = document.getElementById('underControls');
  const musicToggle = document.getElementById('musicToggle');
  const vol = document.getElementById('vol');
  const bgm = document.getElementById('bgm'); // pode não tocar; tratamos

  // ---------- CONFIG DE NÍVEIS ----------
  const LEVELS = [
    { cols: 15, rows: 11, delay: 110 },
    { cols: 21, rows: 15, delay: 95  },
    { cols: 27, rows: 19, delay: 85  },
    { cols: 33, rows: 23, delay: 75  },
    { cols: 41, rows: 31, delay: 70  },
    { cols: 51, rows: 35, delay: 65  },
    { cols: 61, rows: 45, delay: 60  },
    { cols: 71, rows: 51, delay: 55  }
  ];
  let currentLevel = 1;

  // ---------- ESTADO DO JOGO ----------
  let grid = [];        // 0 caminho | 1 parede
  let W = 15, H = 11;   // colunas x linhas (ímpares)
  let tile = 16;        // tamanho do bloco
  let player = {x:1, y:1};
  let goal = {x: W-2, y: H-2};

  // Movimento contínuo
  const holdState = { dir: null, intId: null, delay: 90, running: false };

  // ---------- UTILIDADES ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const choice = arr => arr[(Math.random() * arr.length) | 0];
  const odd = n => n % 2 ? n : n-1;
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // Tema por nível
  function setThemeForLevel(level){
    const baseHue=(level*47)%360;
    const root=document.documentElement.style;
    root.setProperty('--wall',  `hsl(${baseHue},22%,18%)`);
    root.setProperty('--path',  `hsl(${baseHue},30%,8%)`);
    root.setProperty('--player',`hsl(${(baseHue+40)%360},90%,55%)`);
    root.setProperty('--goal',  `hsl(${(baseHue+320)%360},80%,55%)`);
    root.setProperty('--ring',  `hsla(${baseHue},100%,100%,0.07)`);
  }

  function dimsForAutoLevel(){
    const idx = clamp(currentLevel-1, 0, LEVELS.length-1);
    return { cols: LEVELS[idx].cols, rows: LEVELS[idx].rows, delay: LEVELS[idx].delay };
  }

  // ---------- GERAÇÃO (DFS Backtracker) ----------
  function makeGrid(w, h, fill=1) {
    return Array.from({length:h}, () => Array(w).fill(fill));
  }
  function neighborsCarvables(x, y, g) {
    const dirs = [[0,-2],[2,0],[0,2],[-2,0]];
    // embaralha direções
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = (Math.random()*(i+1))|0; [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    const res = [];
    for (const [dx,dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (ny > 0 && ny < g.length-1 && nx > 0 && nx < g[0].length-1 && g[ny][nx] === 1) {
        res.push([nx, ny, dx, dy]);
      }
    }
    return res;
  }
  function generateMaze(w, h) {
    const g = makeGrid(w, h, 1);
    let sx = 1, sy = 1;
    g[sy][sx] = 0;
    const stack = [[sx, sy]];
    while (stack.length) {
      const last = stack[stack.length - 1];   // <- sem .at(-1)
      const cx = last[0], cy = last[1];
      const ns = neighborsCarvables(cx, cy, g);
      if (!ns.length) {
        stack.pop();
      } else {
        const [nx, ny, dx, dy] = choice(ns);
        g[cy + dy/2][cx + dx/2] = 0; // abre parede entre as células
        g[ny][nx] = 0;
        stack.push([nx, ny]);
      }
    }
    return g;
  }

  // ---------- DESENHO ----------
  function fitCanvas() {
    const pad = 24;
    const sw = Math.max(0, stage?.clientWidth  || 0);
    const sh = Math.max(0, stage?.clientHeight || 0);
    const availW = Math.max(200, sw - pad * 2);
    const availH = Math.max(200, sh - pad * 2);
    tile = Math.floor(Math.min(availW / W, availH / H));
    tile = Math.max(tile, 10);
    canvas.width = Math.max(100, tile * W);
    canvas.height = Math.max(100, tile * H);
  }

  function roundRect(ctx, x, y, w, h, r, fill) {
    const rr = Math.max(2, Math.min(r, Math.min(w, h)/2));
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y,   x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x,   y+h, rr);
    ctx.arcTo(x,   y+h, x,   y,   rr);
    ctx.arcTo(x,   y,   x+w, y,   rr);
    if (fill) ctx.fill();
  }
  function drawStar(cx, cy, outerR, innerR, points) {
    const R = Math.max(2, outerR);
    const r = Math.max(1, innerR);
    ctx.beginPath();
    const step = Math.PI / points;
    for (let i=0; i<points*2; i++) {
      const rr = i % 2 === 0 ? R : r;
      const a = i * step - Math.PI/2;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  function drawPolygon(cx, cy, r, sides) {
    const R = Math.max(2, r);
    ctx.beginPath();
    for (let i=0; i<sides; i++) {
      const a = (i / sides) * Math.PI*2 - Math.PI/2;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawPlayerShape(level, x, y, size) {
    const idx = (level - 1) % 6;
    const s   = 15;
    const r   = Math.max(3, Math.min(10, s / 2.5));
    const cx  = x + s/2, cy = y + s/2;

    ctx.save();
    ctx.shadowBlur  = Math.min(s * 0.9, 20);
    ctx.shadowColor = cssVar('--player');
    ctx.fillStyle   = cssVar('--player');

    switch (idx) {
      case 0: ctx.beginPath(); ctx.arc(cx, cy, Math.max(3, (s - 4) / 2), 0, Math.PI*2); ctx.fill(); break;
      case 1: roundRect(ctx, x + 2, y + 2, s - 4, s - 4, r, true); break;
      case 2:
        ctx.beginPath();
        ctx.moveTo(cx, y + 2);
        ctx.lineTo(x + s - 2, cy);
        ctx.lineTo(cx, y + s - 2);
        ctx.lineTo(x + 2, cy);
        ctx.closePath();
        ctx.fill();
        break;
      case 3:
        ctx.beginPath();
        ctx.moveTo(cx, y + 2);
        ctx.lineTo(x + s - 2, y + s - 2);
        ctx.lineTo(x + 2, y + s - 2);
        ctx.closePath();
        ctx.fill();
        break;
      case 4: drawStar(cx, cy, (s - 4) / 2, (s - 8) / 4, 5); ctx.fill(); break;
      case 5: drawPolygon(cx, cy, (s - 4) / 2, 6); ctx.fill(); break;
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black'; // seu tema mantém fundo escuro aqui
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // paredes
    ctx.save();
    ctx.shadowBlur  = Math.max(2, tile * 0.25);
    ctx.shadowColor = 'rgba(255,255,255,0.06)';
    for (let y=0; y<H; y++) {
      for (let x=0; x<W; x++) {
        if (grid[y][x]) {
          ctx.fillStyle = cssVar('--wall');
          ctx.fillRect(x*tile, y*tile, tile, tile);
        }
      }
    }
    ctx.restore();

    // caminhos
    for (let y=0; y<H; y++) {
      for (let x=0; x<W; x++) {
        if (!grid[y][x]) {
          ctx.fillStyle = cssVar('--path');
          ctx.fillRect(x*tile, y*tile, tile, tile);
        }
      }
    }

    // objetivo
    ctx.save();
    ctx.shadowBlur  = Math.min(tile * 0.8, 14);
    ctx.shadowColor = cssVar('--goal');
    ctx.fillStyle   = cssVar('--goal');
    roundRect(ctx, goal.x * tile + 1, goal.y * tile + 1, tile - 2, tile - 2, Math.min(8, tile / 3), true);
    ctx.restore();

    // player
    const px = player.x * tile + 2;
    const py = player.y * tile + 2;
    const ps = Math.max(6, tile - 4);
    drawPlayerShape(currentLevel, px, py, ps);
  }

  // ---------- LÓGICA DE JOGO ----------
  function canMove(nx, ny) {
    return nx >= 0 && ny >= 0 && nx < W && ny < H && grid[ny][nx] === 0;
  }
  function move(dx, dy) {
    const nx = player.x + dx, ny = player.y + dy;
    if (canMove(nx,ny)) {
      player.x = nx; player.y = ny;
      draw();
      checkWin();
    }
  }
  function checkWin() {
    if (player.x === goal.x && player.y === goal.y) {
      if (winTitle) winTitle.textContent = `🎉 Nível ${currentLevel} concluído!`;
      if (winDesc)  winDesc.textContent  = `Excelente! Prepare-se para o nível ${currentLevel + 1}.`;
      winOverlay?.classList.add('show');
      stopHold();
      playWinJingle();
    }
  }

  function applyLevel(levelNum) {
    currentLevel = levelNum;
    if (levelTag) levelTag.textContent = `Nível ${currentLevel}`;
    setThemeForLevel(currentLevel);

    const mode = sizeSel?.value || 'AUTO';
    if (mode === 'AUTO') {
      const cfg = dimsForAutoLevel();
      W = odd(cfg.cols); H = odd(cfg.rows);
      holdState.delay = cfg.delay;
    } else {
      const map = { S:[21,15], M:[35,25], G:[51,35], X:[69,49] };
      const preset = map[mode] || [35,25];
      W = odd(preset[0]); H = odd(preset[1]);
      const idx = clamp(currentLevel-1, 0, LEVELS.length-1);
      holdState.delay = LEVELS[idx].delay;
    }

    grid = generateMaze(W, H);
    player = {x:1, y:1};
    goal   = {x: W-2, y: H-2};
    winOverlay?.classList.remove('show');
    fitCanvas();
    draw();
  }

  function newGame()  { applyLevel(currentLevel); }
  function nextLevel(){ applyLevel(currentLevel + 1); }

  // ---------- CONTROLES CONTÍNUOS ----------
  function startHold(dir) {
    if (!dir) return;
    holdState.dir = dir;
    if (holdState.running) return;
    holdState.running = true;
    move(dir[0], dir[1]); // passo inicial
    holdState.intId = setInterval(() => move(dir[0], dir[1]), holdState.delay);
  }
  function stopHold() {
    holdState.running = false;
    if (holdState.intId) { clearInterval(holdState.intId); holdState.intId = null; }
  }

  // Controles visuais (se existirem)
  if (underControls) {
    underControls.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest?.('.uc-btn'); if (!btn) return;
      e.preventDefault();
      const d = btn.getAttribute('data-d');
      const dir = d === 'up' ? [0,-1] : d === 'down' ? [0,1] : d === 'left' ? [-1,0] : [1,0];
      startHold(dir);
      tryAutoplay();
    });
    ['pointerup','pointercancel','pointerleave'].forEach(t => {
      underControls.addEventListener(t, stopHold);
    });
  }

  // Teclado
  const dirByKey = new Map([
    ['ArrowUp',[0,-1]],  ['KeyW',[0,-1]],
    ['ArrowDown',[0,1]], ['KeyS',[0,1]],
    ['ArrowLeft',[-1,0]],['KeyA',[-1,0]],
    ['ArrowRight',[1,0]],['KeyD',[1,0]],
  ]);
  window.addEventListener('keydown', (e) => {
    const dir = dirByKey.get(e.code);
    if (!dir) return;
    e.preventDefault();
    if (!holdState.running || (holdState.dir && (holdState.dir[0] !== dir[0] || holdState.dir[1] !== dir[1]))) {
      stopHold();
      startHold(dir);
    }
    tryAutoplay();
  }, { passive:false });
  window.addEventListener('keyup', (e) => { if (dirByKey.has(e.code)) stopHold(); }, { passive:true });

  // ---------- ÁUDIO (opcional) ----------
  let actx = null, masterGain = null;
  function initSfx(){
    if (actx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // navegador sem WebAudio
    actx = new AC();
    masterGain = actx.createGain();
    masterGain.connect(actx.destination);
    if (vol) masterGain.gain.value = parseFloat(vol.value) || 0.5;
  }
  function tryAutoplay(){
    if (!bgm) return;
    bgm.volume = (vol && parseFloat(vol.value)) || 0.5;
    const p = bgm.play?.();
    if (p && typeof p.then === 'function') {
      p.then(refreshMusicBtn).catch(()=>{/* ignorado */});
    } else {
      refreshMusicBtn();
    }
  }
  function setMusicBtn(on){
    if (!musicToggle) return;
    musicToggle.setAttribute('aria-pressed', String(on));
    musicToggle.textContent = on ? '🎵 Música: Ligada' : '🎵 Música: Desligada';
  }
  function refreshMusicBtn(){ setMusicBtn(!!(bgm && !bgm.paused && !bgm.ended)); }
  musicToggle?.addEventListener('click', async () => {
    if (!bgm) return;
    try { if (bgm.paused) { await bgm.play(); } else { bgm.pause(); } }
    catch(_) {}
    refreshMusicBtn();
  });
  vol?.addEventListener('input', () => {
    if (bgm) bgm.volume = parseFloat(vol.value) || 0.5;
    if (masterGain) masterGain.gain.value = parseFloat(vol.value) || 0.5;
  });

  function playTone(freq, t0, dur=0.14, volu=0.35, a=0.005, r=0.06) {
    initSfx(); if (!actx || !masterGain) return;
    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(volu, t0+a);
    g.gain.linearRampToValueAtTime(0, t0+dur);
    osc.connect(g).connect(masterGain);
    osc.start(t0); osc.stop(t0+dur+r);
  }
  const NOTE = { C4:261.63, E4:329.63, G4:392.00, C5:523.25, E5:659.25 };
  function playWinJingle(){
    if (!actx) initSfx();
    const t = actx ? actx.currentTime + 0.03 : 0.03;
    [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5, NOTE.E5].forEach((f,i)=> playTone(f, t + i*0.08));
  }

  // ---------- UI ----------
  newBtn?.addEventListener('click', () => newGame());
  againBtn?.addEventListener('click', () => { winOverlay?.classList.remove('show'); newGame(); });
  nextBtn?.addEventListener('click', () => { winOverlay?.classList.remove('show'); nextLevel(); });
  sizeSel?.addEventListener('change', () => newGame());

  // ---------- INICIALIZAÇÃO ----------
  setThemeForLevel(currentLevel);
  applyLevel(currentLevel);

  // autoplay best-effort
  window.addEventListener('load', () => setTimeout(tryAutoplay, 300));

  // resize com debounce
  let resizeTO;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(() => { fitCanvas(); draw(); }, 120);
  });
})();
