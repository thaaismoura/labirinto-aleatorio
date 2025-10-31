/*
  © 2025 Thaís Moura — Licenciado sob MIT. Código-fonte no GitHub.
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
  const bgm = document.getElementById('bgm'); // 🎵 sua faixa MP3

  // ---------- CONFIG DE NÍVEIS ----------
  const LEVELS = [
    { cols: 15, rows: 11, delay: 110 }, // bem fácil
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
  let grid = [];
  let W = 15, H = 11;
  let tile = 16;
  let player = {x:1, y:1};
  let goal = {x: W-2, y: H-2};

  // Movimento contínuo
  const holdState = {
    dir: null,
    intId: null,
    delay: 90,
    running: false
  };

  // ---------- UTILIDADES ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const choice = arr => arr[(Math.random() * arr.length) | 0];
  const odd = n => n % 2 ? n : n-1;

  // tema/cores por nível
  function setThemeForLevel(level) {
    const baseHue = (level * 47) % 360;
    const wall = `hsl(${baseHue}, 22%, 18%)`;
    const path = `hsl(${baseHue}, 30%, 8%)`;
    const player = `hsl(${(baseHue+40)%360}, 90%, 55%)`;
    const goal = `hsl(${(baseHue+320)%360}, 80%, 55%)`;
    const ring = `hsla(${baseHue}, 100%, 100%, 0.07)`;
    const root = document.documentElement.style;
    root.setProperty('--wall', wall);
    root.setProperty('--path', path);
    root.setProperty('--player', player);
    root.setProperty('--goal', goal);
    root.setProperty('--ring', ring);
  }

  function dimsForAutoLevel() {
    const idx = clamp(currentLevel-1, 0, LEVELS.length-1);
    return { cols: LEVELS[idx].cols, rows: LEVELS[idx].rows, delay: LEVELS[idx].delay };
  }

  // ---------- GERAÇÃO (DFS Backtracker) ----------
  function makeGrid(w, h, fill=1) {
    const g = new Array(h);
    for (let y=0; y<h; y++) g[y] = new Array(w).fill(fill);
    return g;
  }

  function neighborsCarvables(x, y, g) {
    const dirs = [[0,-2],[2,0],[0,2],[-2,0]];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = (Math.random()* (i+1))|0;
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    const res = [];
    for (const [dx,dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (ny > 0 && ny < g.length-1 && nx > 0 && nx < g[0].length-1) {
        if (g[ny][nx] === 1) res.push([nx, ny, dx, dy]);
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
      const [cx, cy] = stack[stack.length - 1];
      const ns = neighborsCarvables(cx, cy, g);
      if (!ns.length) stack.pop();
      else {
        const [nx, ny, dx, dy] = choice(ns);
        g[cy + dy/2][cx + dx/2] = 0;
        g[ny][nx] = 0;
        stack.push([nx, ny]);
      }
    }
    return g;
  }

  // ---------- RENDER ----------
  function fitCanvas() {
    const pad = 24;
    const availW = stage.clientWidth - pad*2;
    const availH = stage.clientHeight - pad*2;
    tile = Math.floor(Math.min(availW / W, availH / H));
    tile = Math.max(tile, 6);
    canvas.width = tile * W;
    canvas.height = tile * H;
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function draw() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y=0; y<H; y++) {
      for (let x=0; x<W; x++) {
        ctx.fillStyle = grid[y][x] ? cssVar('--wall') : cssVar('--path');
        ctx.fillRect(x*tile, y*tile, tile, tile);
      }
    }

    ctx.fillStyle = cssVar('--goal');
    roundRect(ctx, goal.x*tile+1, goal.y*tile+1, tile-2, tile-2, Math.min(8, tile/3), true);

    ctx.fillStyle = cssVar('--player');
    roundRect(ctx, player.x*tile+2, player.y*tile+2, tile-4, tile-4, Math.min(10, tile/2.5), true);

    ctx.globalAlpha = 1;
    ctx.fillStyle = cssVar('--ring');
    ctx.beginPath();
    ctx.arc(player.x*tile + tile/2, player.y*tile + tile/2, tile*2.2, 0, Math.PI*2);
    ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    if (fill) ctx.fill();
  }

  // ---------- LÓGICA ----------
  function canMove(nx, ny) {
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return false;
    return grid[ny][nx] === 0;
  }

  function move(dx, dy) {
    const nx = player.x + dx, ny = player.y + dy;
    if (canMove(nx, ny)) {
      player.x = nx; player.y = ny;
      draw();
      checkWin();
    }
  }

  function checkWin() {
    if (player.x === goal.x && player.y === goal.y) {
      winTitle.textContent = `🎉 Nível ${currentLevel} concluído!`;
      winDesc.textContent = `Excelente! Prepare-se para o nível ${currentLevel + 1}.`;
      winOverlay.classList.add('show');
      stopHold();
      playWinJingle(); // efeito de vitória
    }
  }

  function applyLevel(levelNum) {
    currentLevel = levelNum;
    levelTag.textContent = `Nível ${currentLevel}`;
    setThemeForLevel(currentLevel);

    const mode = sizeSel.value;
    if (mode === 'AUTO') {
      const cfg = dimsForAutoLevel();
      W = odd(cfg.cols);
      H = odd(cfg.rows);
      holdState.delay = cfg.delay;
    } else {
      const map = { S:[21,15], M:[35,25], G:[51,35], X:[69,49] };
      const [cols, rows] = map[mode] || [35,25];
      W = odd(cols); H = odd(rows);
      const idx = clamp(currentLevel-1, 0, LEVELS.length-1);
      holdState.delay = LEVELS[idx].delay;
    }

    grid = generateMaze(W, H);
    player = {x:1, y:1};
    goal = {x: W-2, y: H-2};
    winOverlay.classList.remove('show');
    fitCanvas();
    draw();
  }

  function newGame() {
    applyLevel(currentLevel);
  }

  function nextLevel() {
    applyLevel(currentLevel + 1);
  }

  // ---------- MOVIMENTO CONTÍNUO ----------
  function startHold(dir) {
    holdState.dir = dir;
    if (holdState.running) return;
    holdState.running = true;
    move(dir[0], dir[1]); // passo inicial
    holdState.intId = setInterval(() => move(dir[0], dir[1]), holdState.delay);
  }

  function stopHold() {
    holdState.running = false;
    holdState.dir = null;
    if (holdState.intId) {
      clearInterval(holdState.intId);
      holdState.intId = null;
    }
  }

  underControls.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.uc-btn');
    if (!btn) return;
    e.preventDefault();
    const d = btn.getAttribute('data-d');
    const dir = d === 'up' ? [0,-1] : d === 'down' ? [0,1] : d === 'left' ? [-1,0] : [1,0];
    startHold(dir);
    tryAutoplay(); // tenta tocar se ainda não estiver
  });
  ['pointerup','pointercancel','pointerleave'].forEach(t => underControls.addEventListener(t, stopHold));

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

  // ---------- ÁUDIO ----------
  // Fundo: HTMLAudioElement (seu mp3). Efeitos: Web Audio (para toques curtos).
  let actx = null, masterGain = null;

  function initSfx() {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = actx.createGain();
    masterGain.gain.value = parseFloat(vol.value);
    masterGain.connect(actx.destination);
  }

  // volume controla fundo + sfx
  vol.addEventListener('input', () => {
    const v = parseFloat(vol.value);
    bgm.volume = v;
    if (masterGain) masterGain.gain.value = v;
  });

  // alternar música
  function updateMusicBtn(isOn) {
    musicToggle.setAttribute('aria-pressed', String(isOn));
    musicToggle.textContent = isOn ? '🎵 Música: Ligada' : '🎵 Música: Desligada';
  }
  musicToggle.addEventListener('click', () => {
    if (bgm.paused) { tryAutoplay(); }
    else { bgm.pause(); updateMusicBtn(false); }
  });

  // tentar autoplay com fallbacks
  function tryAutoplay() {
    bgm.volume = parseFloat(vol.value);
    const playPromise = bgm.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(() => {
        updateMusicBtn(true);
      }).catch(() => {
        // se bloqueado, destrava na próxima interação
        const unlock = () => {
          bgm.play().then(()=>{ updateMusicBtn(true); removeUnlock(); }).catch(()=>{});
        };
        const events = ['pointerdown','touchstart','keydown','click','visibilitychange','focus'];
        function removeUnlock(){ events.forEach(ev=>window.removeEventListener(ev, unlock, true)); }
        events.forEach(ev=>window.addEventListener(ev, unlock, true));
        setTimeout(unlock, 800);
      });
    } else {
      updateMusicBtn(!bgm.paused);
    }
  }

  // SFX helpers (Web Audio)
  function playTone(type, freq, t0, dur, gain=0.35, a=0.01, r=0.06) {
    initSfx();
    const osc = actx.createOscillator();
    const g  = actx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + a);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(g).connect(masterGain);
    osc.start(t0); osc.stop(t0 + dur + r);
  }

  // efeitos de vitória (3 variações aleatórias)
  const NOTE = { C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88, C5:523.25, E5:659.25 };
  function playWinJingle() {
    initSfx();
    const t = actx.currentTime + 0.02;
    const pick = (Math.random()*3)|0;
    if (pick === 0) {
      [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5, NOTE.E5].forEach((f,i)=>
        playTone('triangle', f, t + i*0.08, 0.12, 0.4, 0.005, 0.05));
    } else if (pick === 1) {
      for (let i=0;i<6;i++) playTone('sine', i%2?NOTE.G4:NOTE.A4, t + i*0.05, 0.07, 0.28);
      playTone('triangle', NOTE.C5, t + 0.3, 0.20, 0.36);
    } else {
      playTone('sawtooth', NOTE.G4, t, 0.18, 0.28);
      playTone('sawtooth', NOTE.D4, t, 0.18, 0.22);
      setTimeout(()=> [NOTE.C4, NOTE.E4, NOTE.G4].forEach(f => playTone('triangle', f, actx.currentTime, 0.22, 0.34)), 180);
    }
  }

  // ---------- UI ----------
  newBtn.addEventListener('click', () => newGame());
  againBtn.addEventListener('click', () => { winOverlay.classList.remove('show'); newGame(); });
  nextBtn.addEventListener('click', () => { winOverlay.classList.remove('show'); nextLevel(); });
  sizeSel.addEventListener('change', () => newGame());

  // ---------- INICIALIZAÇÃO ----------
  setThemeForLevel(currentLevel);
  applyLevel(currentLevel);

  let resizeTO;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(() => { fitCanvas(); draw(); }, 120);
  });

  // Tenta tocar automaticamente após carregar
  window.addEventListener('load', () => setTimeout(tryAutoplay, 300));
})();
