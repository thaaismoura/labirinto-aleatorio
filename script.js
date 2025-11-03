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
  const bgm = document.getElementById('bgm');

  // ---------- CONFIG DE NÍVEIS ----------
  const LEVELS = [
    { cols: 15, rows: 11, delay: 110 },
    { cols: 21, rows: 15, delay: 95 },
    { cols: 27, rows: 19, delay: 85 },
    { cols: 33, rows: 23, delay: 75 },
    { cols: 41, rows: 31, delay: 70 },
    { cols: 51, rows: 35, delay: 65 },
    { cols: 61, rows: 45, delay: 60 },
    { cols: 71, rows: 51, delay: 55 }
  ];
  let currentLevel = 1;

  // ---------- ESTADO DO JOGO ----------
  let grid = [];
  let W = 15, H = 11;
  let tile = 16;
  let player = {x:1, y:1};
  let goal = {x: W-2, y: H-2};

  // Movimento contínuo
  const holdState = { dir: null, intId: null, delay: 90, running: false };

  // ---------- UTILIDADES ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const choice = arr => arr[(Math.random() * arr.length) | 0];
  const odd = n => n % 2 ? n : n-1;
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function setThemeForLevel(level){
    const baseHue=(level*47)%360;
    const root=document.documentElement.style;
    root.setProperty('--wall',  `hsl(${baseHue},22%,18%)`);
    root.setProperty('--path',  `hsl(${baseHue},30%,8%)`);
    root.setProperty('--player',`hsl(${(baseHue+40)%360},90%,55%)`);
    root.setProperty('--goal',  `hsl(${(baseHue+320)%360},80%,55%)`);
  }

  function dimsForAutoLevel(){
    const idx = clamp(currentLevel-1, 0, LEVELS.length-1);
    return { cols: LEVELS[idx].cols, rows: LEVELS[idx].rows, delay: LEVELS[idx].delay };
  }

  // ---------- GERAÇÃO DE LABIRINTO ----------
  function makeGrid(w, h, fill=1) {
    return Array.from({length:h}, () => Array(w).fill(fill));
  }

  function neighborsCarvables(x, y, g) {
    const dirs = [[0,-2],[2,0],[0,2],[-2,0]];
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
      const [cx, cy] = stack.at(-1);
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

  // ---------- DESENHO ----------
  function fitCanvas() {
    const pad = parseFloat(getComputedStyle(stage).paddingLeft) || 16;
    const availW = stage.clientWidth  - pad * 2;
    const availH = stage.clientHeight - pad * 2;

    tile = Math.floor(Math.min(availW / W, availH / H));
    tile = Math.max(tile, 12);

    const cssW = tile * W;
    const cssH = tile * H;

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    const s   = Math.max(6, size);
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
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.shadowBlur  = Math.max(2, tile * 0.25);
    ctx.shadowColor = 'rgba(255,255,255,0.06)';
    for (let y=0; y<H; y++) for (let x=0; x<W; x++) if (grid[y][x]) {
      ctx.fillStyle = cssVar('--wall');
      ctx.fillRect(x*tile, y*tile, tile, tile);
    }
    ctx.restore();

    for (let y=0; y<H; y++) for (let x=0; x<W; x++) if (!grid[y][x]) {
      ctx.fillStyle = cssVar('--path');
      ctx.fillRect(x*tile, y*tile, tile, tile);
    }

    ctx.save();
    ctx.shadowBlur  = Math.min(tile * 0.8, 14);
    ctx.shadowColor = cssVar('--goal');
    ctx.fillStyle   = cssVar('--goal');
    roundRect(ctx, goal.x * tile + 1, goal.y * tile + 1, tile - 2, tile - 2, Math.min(8, tile / 3), true);
    ctx.restore();

    const px = player.x * tile + 2;
    const py = player.y * tile + 2;
    const ps = Math.max(6, tile - 4);
    drawPlayerShape(currentLevel, px, py, ps);
  }

  // ---------- LÓGICA ----------
  function canMove(nx, ny) { return nx>=0 && ny>=0 && nx<W && ny<H && grid[ny][nx]===0; }
  function move(dx, dy) { const nx=player.x+dx, ny=player.y+dy; if(canMove(nx,ny)){player.x=nx;player.y=ny;draw();checkWin();} }

  function checkWin() {
    if (player.x === goal.x && player.y === goal.y) {
      winTitle.textContent = `🎉 Nível ${currentLevel} concluído!`;
      winDesc.textContent  = `Excelente! Prepare-se para o nível ${currentLevel + 1}.`;
      winOverlay.classList.add('show');
      stopHold();
      playWinJingle();
    }
  }

  function applyLevel(levelNum) {
    currentLevel = levelNum;
    levelTag.textContent = `Nível ${currentLevel}`;
    setThemeForLevel(currentLevel);

    const mode = sizeSel.value;
    if (mode === 'AUTO') {
      const cfg = dimsForAutoLevel();
      W = odd(cfg.cols); H = odd(cfg.rows); holdState.delay = cfg.delay;
    } else {
      const map = { S:[21,15], M:[35,25], G:[51,35], X:[69,49] };
      const [cols, rows] = map[mode] || [35,25];
      W = odd(cols); H = odd(rows);
      const idx = clamp(currentLevel-1, 0, LEVELS.length-1);
      holdState.delay = LEVELS[idx].delay;
    }

    grid = generateMaze(W, H);
    player = {x:1, y:1}; goal = {x:W-2, y:H-2};
    winOverlay.classList.remove('show');
    fitCanvas(); draw();
  }

  function newGame() { applyLevel(currentLevel); }
  function nextLevel() { applyLevel(currentLevel + 1); }

  // ---------- MOVIMENTO ----------
  function startHold(dir){holdState.dir=dir;if(holdState.running)return;holdState.running=true;move(dir[0],dir[1]);holdState.intId=setInterval(()=>move(dir[0],dir[1]),holdState.delay);}
  function stopHold(){holdState.running=false;if(holdState.intId){clearInterval(holdState.intId);holdState.intId=null;}}

  underControls.addEventListener('pointerdown', e=>{
    const btn=e.target.closest('.uc-btn');if(!btn)return;e.preventDefault();
    const d=btn.getAttribute('data-d');
    const dir=d==='up'?[0,-1]:d==='down'?[0,1]:d==='left'?[-1,0]:[1,0];
    startHold(dir);tryAutoplay();
  });
  ['pointerup','pointercancel','pointerleave'].forEach(t=>underControls.addEventListener(t,stopHold));
  const dirByKey=new Map([['ArrowUp',[0,-1]],['KeyW',[0,-1]],['ArrowDown',[0,1]],['KeyS',[0,1]],['ArrowLeft',[-1,0]],['KeyA',[-1,0]],['ArrowRight',[1,0]],['KeyD',[1,0]]]);
  window.addEventListener('keydown',e=>{
    const dir=dirByKey.get(e.code);if(!dir)return;e.preventDefault();
    if(!holdState.running||(holdState.dir&&(holdState.dir[0]!==dir[0]||holdState.dir[1]!==dir[1]))){stopHold();startHold(dir);}
    tryAutoplay();
  },{passive:false});
  window.addEventListener('keyup',e=>{if(dirByKey.has(e.code))stopHold();},{passive:true});

  // ---------- ÁUDIO ----------
  let actx=null, masterGain=null;
  function initSfx(){if(actx)return;actx=new(window.AudioContext||window.webkitAudioContext)();masterGain=actx.createGain();masterGain.connect(actx.destination);masterGain.gain.value=parseFloat(vol.value);}
  vol.addEventListener('input',()=>{const v=parseFloat(vol.value);bgm.volume=v;if(masterGain)masterGain.gain.value=v;});

  function setMusicBtn(on){musicToggle.setAttribute('aria-pressed',String(on));musicToggle.textContent=on?'🎵 Música: Ligada':'🎵 Música: Desligada';}
  function refreshMusicBtn(){setMusicBtn(!bgm.paused&&!bgm.ended);}
  bgm.addEventListener('play',refreshMusicBtn);
  bgm.addEventListener('pause',refreshMusicBtn);
  bgm.addEventListener('ended',refreshMusicBtn);
  musicToggle.addEventListener('click',async()=>{try{if(bgm.paused){await bgm.play();}else{bgm.pause();}}catch(_){try{bgm.muted=true;await bgm.play();bgm.muted=false;}catch{}}finally{refreshMusicBtn();}});

  function tryAutoplay(){
    bgm.volume=parseFloat(vol.value);
    const p=bgm.play();
    if(p&&typeof p.then==='function'){
      p.then(refreshMusicBtn).catch(()=>{
        const unlock=async()=>{try{await bgm.play();refreshMusicBtn();removeUnlock();}catch{}};
        const evs=['pointerdown','touchstart','keydown','click','visibilitychange','focus'];
        function removeUnlock(){evs.forEach(ev=>window.removeEventListener(ev,unlock,true));}
        evs.forEach(ev=>window.addEventListener(ev,unlock,true));
        setTimeout(unlock,800);
      });
    }else{refreshMusicBtn();}
  }

  function playTone(freq,t0,dur=0.14,vol=0.35,a=0.005,r=0.06){
    initSfx();const osc=actx.createOscillator();const g=actx.createGain();
    osc.type='triangle';osc.frequency.setValueAtTime(freq,t0);
    g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+a);g.gain.linearRampToValueAtTime(0,t0+dur);
    osc.connect(g).connect(masterGain);osc.start(t0);osc.stop(t0+dur+r);
  }
  const NOTE={C4:261.63,E4:329.63,G4:392.00,C5:523.25,E5:659.25};
  function playWinJingle(){
    const t=actx?actx.currentTime+0.03:0.03;
    [NOTE.C4,NOTE.E4,NOTE.G4,NOTE.C
