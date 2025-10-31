(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const sizeSel = document.getElementById('sizeSel');
  const newBtn = document.getElementById('newBtn');
  const againBtn = document.getElementById('againBtn');
  const winOverlay = document.getElementById('winOverlay');
  const dpad = document.getElementById('dpad');
  const stage = document.getElementById('stage');

  // Estado do jogo
  let grid = [];        // matriz de 0 (caminho) e 1 (parede)
  let W = 41, H = 31;   // dimensões ímpares (colunas x linhas)
  let tile = 16;        // tamanho do bloco em px (ajustado dinamicamente)
  let player = {x:1, y:1};
  let goal = {x: W-2, y: H-2};

  // ============================
  // Utilidades
  // ============================
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const choice = arr => arr[(Math.random() * arr.length) | 0];
  const odd = n => n % 2 ? n : n-1;

  function dimsFor(sizeKey) {
    // Escolhe dimensões com base no tamanho e na tela atual
    const vw = stage.clientWidth;
    const vh = stage.clientHeight;

    // Alvos aproximados de colunas/linhas
    let targetCols, targetRows;
    if (sizeKey === 'S') { targetCols = 21; targetRows = 15; }
    else if (sizeKey === 'M') { targetCols = 35; targetRows = 25; }
    else if (sizeKey === 'G') { targetCols = 51; targetRows = 35; }
    else { targetCols = 69; targetRows = 49; } // 'X'

    // Mantém proporção aproximada da área disponível
    const ratio = vw / vh;
    if (ratio > 1) { // paisagem
      targetCols = Math.round(targetCols * ratio);
    } else {
      targetRows = Math.round(targetRows / ratio);
    }
    return { cols: odd(clamp(targetCols, 15, 199)), rows: odd(clamp(targetRows, 11, 199)) };
  }

  // ============================
  // Geração do labirinto (DFS)
  // ============================
  function makeGrid(w, h, fill=1) {
    const g = new Array(h);
    for (let y=0; y<h; y++) {
      g[y] = new Array(w).fill(fill);
    }
    return g;
  }

  function neighborsCarvables(x, y, g) {
    const dirs = [
      [0, -2], [2, 0], [0, 2], [-2, 0]
    ];
    // Embaralhar direções
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
    // Ponto inicial em coordenada ímpar
    let sx = 1, sy = 1;
    g[sy][sx] = 0;

    const stack = [[sx, sy]];
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const ns = neighborsCarvables(cx, cy, g);
      if (!ns.length) {
        stack.pop();
      } else {
        const [nx, ny, dx, dy] = choice(ns);
        // abre parede entre (cx,cy) e (nx,ny)
        g[cy + dy/2][cx + dx/2] = 0;
        g[ny][nx] = 0;
        stack.push([nx, ny]);
      }
    }
    return g;
  }

  // ============================
  // Renderização
  // ============================
  function fitCanvas() {
    // Calcula o tamanho do tile para caber com margens
    const pad = 24; // px
    const availW = stage.clientWidth - pad*2;
    const availH = stage.clientHeight - pad*2;
    tile = Math.floor(Math.min(availW / W, availH / H));
    tile = Math.max(tile, 6);
    const cw = tile * W;
    const ch = tile * H;
    canvas.width = cw;
    canvas.height = ch;
  }

  function draw() {
    // Fundo
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Labirinto
    for (let y=0; y<H; y++) {
      for (let x=0; x<W; x++) {
        ctx.fillStyle = getComputedStyle(document.documentElement)
          .getPropertyValue(grid[y][x] ? '--wall' : '--path').trim();
        ctx.fillRect(x*tile, y*tile, tile, tile);
      }
    }

    // Objetivo
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--goal').trim();
    roundRect(ctx, goal.x*tile+1, goal.y*tile+1, tile-2, tile-2, Math.min(8, tile/3), true);

    // Player
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--player').trim();
    roundRect(ctx, player.x*tile+2, player.y*tile+2, tile-4, tile-4, Math.min(10, tile/2.5), true);

    // “brilho” sobre o player
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

  // ============================
  // Lógica de jogo
  // ============================
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

  // ============================
  // Entradas (teclado / toque / dpad)
  // ============================
  const keys = new Map([
    ['ArrowUp', [0,-1]], ['KeyW', [0,-1]],
    ['ArrowDown', [0,1]], ['KeyS', [0,1]],
    ['ArrowLeft', [-1,0]], ['KeyA', [-1,0]],
    ['ArrowRight', [1,0]], ['KeyD', [1,0]],
  ]);

  window.addEventListener('keydown', (e) => {
    const m = keys.get(e.code);
    if (m) {
      e.preventDefault();
      move(m[0], m[1]);
    }
    if ((e.code === 'Enter' || e.code === 'Space') && winOverlay.classList.contains('show')) {
      newGame();
    }
  }, { passive:false });

  // Touch swipe
  let tStart = null;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length) {
      const t = e.touches[0];
      tStart = { x: t.clientX, y: t.clientY, time: Date.now() };
    }
  }, { passive:true });

  canvas.addEventListener('touchend', (e) => {
    if (!tStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - tStart.x;
    const dy = t.clientY - tStart.y;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    const TH = 24; // limiar em px
    if (ax > ay && ax > TH) move(dx>0?1:-1, 0);
    else if (ay > TH) move(0, dy>0?1:-1);
    tStart = null;
  });

  // D-Pad
  dpad.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-d]');
    if (!btn) return;
    const d = btn.getAttribute('data-d');
    if (d === 'up') move(0,-1);
    else if (d === 'down') move(0,1);
    else if (d === 'left') move(-1,0);
    else if (d === 'right') move(1,0);
  });

  // Botões UI
  newBtn.addEventListener('click', newGame);
  againBtn.addEventListener('click', newGame);
  sizeSel.addEventListener('change', newGame);

  // Ajusta ao redimensionar
  let resizeTO;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(() => {
      // Reajusta apenas o canvas (mantém o mesmo labirinto)
      fitCanvas();
      draw();
    }, 120);
  });

  // Inicializa
  if (Math.min(window.innerWidth, window.innerHeight) < 640) {
    sizeSel.value = 'S';
  }
  newGame();
})();
