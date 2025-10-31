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
  const winOverlay = document.getElementById('winOverlay');
  const stage = document.getElementById('stage');
  const underControls = document.getElementById('underControls');
  const musicToggle = document.getElementById('musicToggle');
  const vol = document.getElementById('vol');

  // ---------- ESTADO DO JOGO ----------
  let grid = [];        // 0 caminho | 1 parede
  let W = 41, H = 31;   // colunas x linhas (ímpares)
  let tile = 16;
  let player = {x:1, y:1};
  let goal = {x: W-2, y: H-2};

  // Movimento contínuo
  const holdState = {
    // direção atual pressionada pelos botões abaixo (ou teclado)
    dir: null,          // [dx, dy]
    intId: null,        // setInterval id
    delay: 100,         // ms entre passos
    running: false
  };

  // ---------- UTILIDADES ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const choice = arr => arr[(Math.random() * arr.length) | 0];
  const odd = n => n % 2 ? n : n-1;

  function dimsFor(sizeKey) {
    const vw = stage.clientWidth;
    const vh = stage.clientHeight;

    let targetCols, targetRows;
    if (sizeKey === 'S') { targetCols = 21; targetRows = 15; }
    else if (sizeKey === 'M') { targetCols = 35; targetRows = 25; }
    else if (sizeKey === 'G') { targetCols = 51; targetRows = 35; }
    else { targetCols = 69; targetRows = 49; } // 'X'

    const ratio = vw / vh;
    if (ratio > 1) targetCols = Math.round(targetCols * ratio);
    else targetRows = Math.round(targetRows / ratio);

    return { cols: odd(clamp(targetCols, 15, 199)), rows: odd(clamp(targetRows, 11, 199)) };
  }

  // ---------- GERAÇÃO DE LABIRINTO (DFS Backtracker) ----------
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
        g[cy + dy/2][cx + dx/2] = 0; // abre parede
        g[ny][nx] = 0;
        stack.push([nx, ny]);
      }
    }
    return g;
  }

  // ---------- RENDERIZAÇÃO ----------
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

    ctx.globalAlpha = 0.07;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(player.x*tile + tile/2, player.y*tile + tile/2, tile*2.2, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
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
      winOverlay.classList.add('show');
      stopHold(); // para o movimento contínuo ao vencer
    }
  }

  function newGame() {
    const key = sizeSel.value;
    const { cols, rows } = dimsFor(key);
    W = odd(cols);
    H = odd(rows);
    grid = generateMaze(W, H);
    player = {x:1, y:1};
    goal = {x: W-2, y: H-2};
    winOverlay.classList.remove('show');
    fitCanvas();
    draw();
  }

  // ---------- MOVIMENTO CONTÍNUO (segurar botão/tecla) ----------
  function startHold(dir) {
    holdState.dir = dir;
    if (holdState.running) return;
    holdState.running = true;
    // passo inicial imediato
    move(dir[0], dir[1]);
    holdState.intId = setInterval(() => {
      move(dir[0], dir[1]);
    }, holdState.delay);
  }

  function stopHold() {
    holdState.running = false;
    holdState.dir = null;
    if (holdState.intId) {
      clearInterval(holdState.intId);
      holdState.intId = null;
    }
  }

  // Botões abaixo do jogo (mouse/touch)
  underControls.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.uc-btn');
    if (!btn) return;
    e.preventDefault();
    const d = btn.getAttribute('data-d');
    const dir = d === 'up' ? [0,-1] : d === 'down' ? [0,1] : d === 'left' ? [-1,0] : [1,0];
    startHold(dir);
    // desbloqueia áudio após 1º gesto
    resumeAudioIfNeeded();
  });
  // Encerrar no pointerup/out/cancel fora também
  ['pointerup','pointercancel','pointerleave'].forEach(type => {
    underControls.addEventListener(type, stopHold);
  });

  // Teclado com “hold”
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
    // inicia hold se mudou a direção
    if (!holdState.running || (holdState.dir && (holdState.dir[0] !== dir[0] || holdState.dir[1] !== dir[1]))) {
      stopHold();
      startHold(dir);
    }
    resumeAudioIfNeeded();
    if ((e.code === 'Enter' || e.code === 'Space') && winOverlay.classList.contains('show')) {
      newGame();
    }
  }, { passive:false });

  window.addEventListener('keyup', (e) => {
    if (dirByKey.has(e.code)) {
      stopHold();
    }
  }, { passive:true });

  // ---------- ÁUDIO: MELODIA ALEGRE "CLÁSSICA" (Web Audio API) ----------
  // Gera uma pequena sequência em Dó maior, com arpejos e cadência simples.
  let actx = null, masterGain = null, musicOn = false;

  function initAudio() {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = actx.createGain();
    masterGain.gain.value = parseFloat(vol.value);
    masterGain.connect(actx.destination);
  }

  function resumeAudioIfNeeded() {
    if (!actx) initAudio();
    if (actx.state === 'suspended') actx.resume();
  }

  vol.addEventListener('input', () => {
    if (!masterGain) return;
    masterGain.gain.value = parseFloat(vol.value);
  });

  // Toca nota com envelope curto
  function playNote(freq, startTime, duration=0.28) {
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sine';                 // timbre simples “clássico”
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.6, startTime + 0.02);
    gain.gain.linearRampToValueAtTime(0.0, startTime + duration);

    osc.connect(gain).connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  // Escala C maior (Hz)
  const NOTE = {
    C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
    C5:523.25, D5:587.33, E5:659.25, G5:783.99
  };

  // frase de 2 compassos, alegre (arpejos e passo conjunto), ~ 2.4s e loop
  const phrase = [
    NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5,
    NOTE.B4, NOTE.G4, NOTE.E4, NOTE.C4,
    NOTE.F4, NOTE.A4, NOTE.C5, NOTE.A4,
    NOTE.G4, NOTE.E4, NOTE.D4, NOTE.C4
  ];
  const beatDur = 0.15; // 1 batida ~150ms

  let loopTimer = null;

  function startMusic() {
    initAudio();
    if (musicOn) return;
    musicOn = true;
    musicToggle.setAttribute('aria-pressed', 'true');
    musicToggle.textContent = '🎵 Música: Ligada';

    const schedule = () => {
      const t0 = actx.currentTime + 0.05;
      phrase.forEach((f, i) => {
        playNote(f, t0 + i*beatDur, beatDur*0.95);
      });
    };
    schedule();
    loopTimer = setInterval(schedule, phrase.length * beatDur * 1000);
  }

  function stopMusic() {
    musicOn = false;
    musicToggle.setAttribute('aria-pressed', 'false');
    musicToggle.textContent = '🎵 Música: Desligada';
    if (loopTimer) {
      clearInterval(loopTimer);
      loopTimer = null;
    }
  }

  musicToggle.addEventListener('click', () => {
    resumeAudioIfNeeded();
    if (!musicOn) startMusic();
    else stopMusic();
  });

  // ---------- UI BÁSICA ----------
  newBtn.addEventListener('click', () => { newGame(); });
  againBtn.addEventListener('click', () => { newGame(); });

  sizeSel.addEventListener('change', () => {
    newGame();
  });

  // Ajusta ao redimensionar
  let resizeTO;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(() => {
      fitCanvas();
      draw();
    }, 120);
  });

  // ---------- INICIALIZAÇÃO ----------
  if (Math.min(window.innerWidth, window.innerHeight) < 640) sizeSel.value = 'S';
  newGame();
})();
