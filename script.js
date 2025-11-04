/*
  © 2025 — Mod responsivo + D-Pad
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
  const musicToggle = document.getElementById('musicToggle');
  const vol = document.getElementById('vol');
  const bgm = document.getElementById('bgm');
  const dpad = document.getElementById('dpad');

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

  // ---------- ESTADO ----------
  let grid = [];        // 0 caminho | 1 parede
  let W = 15, H = 11;   // colunas x linhas (ímpares)
  let tile = 16;        // tamanho do bloco (recalculado)
  let player = {x:1, y:1};
  let goal   = {x: W-2, y: H-2};

  // ---------- CONTROLES CONTÍNUOS ----------
  const holdState = { dir: null, running: false, delay: 90, intId: null };

  // ---------- UTILITÁRIOS ----------
  // Bolinha fixa (responsiva): mesma ideia, mas não encolhe demais
  const FIXED_PLAYER_PX = (Math.min(window.innerWidth, window.innerHeight) < 640) ? 16 : 20;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const choice = arr => arr[(Math.random()*arr.length)|0];
  const odd = n => n % 2 ? n : n-1;
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // Tema por nível
  function setThemeForLevel(level){
    const baseHue=(level*47)%360;
    const root=document.documentElement.style;
    root.setProperty('--bg',    `hsl(${baseHue}, 28%, 94%)`);   // fundo claro
    root.setProperty('--wall',  `hsl(${baseHue}, 22%, 18%)`);
    root.setProperty('--path',  `hsl(${baseHue}, 30%, 8%)`);
    root.setProperty('--player',`hsl(${(baseHue+40)%360}, 90%, 55%)`);
    root.setProperty('--goal',  `hsl(${(baseHue+320)%360}, 80%, 55%)`);
    root.setProperty('--ring',  `hsla(${baseHue}, 100%, 100%, 0.07)`);
  }

  // ---------- GERAÇÃO ----------
  function makeGrid(w,h,fill=1){ return Array.from({length:h},()=>Array(w).fill(fill)); }
  function neighborsCarvables(x,y,g){
    const dirs=[[0,-2],[2,0],[0,2],[-2,0]];
    for(let i=dirs.length-1;i>0;i--){const j=(Math.random()*(i+1))|0; [dirs[i],dirs[j]]=[dirs[j],dirs[i]];}
    const res=[];
    for(const [dx,dy] of dirs){
      const nx=x+dx, ny=y+dy;
      if(ny>0 && ny<g.length-1 && nx>0 && nx<g[0].length-1 && g[ny][nx]===1){ res.push([nx,ny,dx,dy]); }
    }
    return res;
  }
  function generateMaze(w,h){
    const g=makeGrid(w,h,1);
    let sx=1,sy=1; g[sy][sx]=0;
    const stack=[[sx,sy]];
    while(stack.length){
      const [cx,cy]=stack.at(-1);
      const ns=neighborsCarvables(cx,cy,g);
      if(!ns.length){ stack.pop(); continue; }
      const [nx,ny,dx,dy]=choice(ns);
      g[cy+dy/2][cx+dx/2]=0; g[ny][nx]=0; stack.push([nx,ny]);
    }
    return g;
  }

  // ---------- MEDIÇÃO RESPONSIVA (sem confiar em vh) ----------
  function setStageHeight(){
    const header = document.querySelector('header.bar');
    const footer = document.querySelector('footer.bar');

    const hHead = header ? header.getBoundingClientRect().height : 0;
    const hFoot = footer ? footer.getBoundingClientRect().height : 0;
    const pad   = 10 /*wrap*/ + 12 /*gap aproximado*/;

    // espaço realmente disponível na janela agora (corrige barras do navegador no mobile)
    const avail = Math.max(300, window.innerHeight - hHead - hFoot - pad*2);

    // limita para não ocupar 100% (deixa respiro) e não ficar pequeno
    const target = clamp(Math.floor(avail * 0.86), 320, Math.floor(window.innerHeight*0.9));
    stage.style.height = target + 'px';
  }

  // ---------- AJUSTE DO CANVAS ----------
  function fitCanvas(){
    // garantir que o stage já tenha altura válida
    setStageHeight();

    const pad = 12; // padding visual (.canvas-wrap)
    const rect = stage.getBoundingClientRect();

    const availW = Math.max(200, rect.width  - pad*2);
    const availH = Math.max(200, rect.height - pad*2);

    const tileRaw = Math.min(availW / W, availH / H);

    // Limites práticos (desktop e mobile)
    const isMobile = Math.min(window.innerWidth, window.innerHeight) < 820;
    const tileMin = 10;
    const tileMax = isMobile ? 36 : 48;  // reduz no celular

    tile = clamp(Math.floor(tileRaw), tileMin, tileMax);

    canvas.width  = Math.floor(tile * W);
    canvas.height = Math.floor(tile * H);
  }

  // ---------- DRAW ----------
  function roundRect(ctx, x, y, w, h, r, fill){
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
      const a = -Math.PI/2 + i*step;
      const d = (i % 2 === 0) ? R : r;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
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
        ctx.moveTo(cx, y + 2); ctx.lineTo(x + s - 2, cy); ctx.lineTo(cx, y + s - 2); ctx.lineTo(x + 2, cy);
        ctx.closePath(); ctx.fill(); break;
      case 3:
        ctx.beginPath();
        ctx.moveTo(cx, y + 2); ctx.lineTo(x + s - 2, y + s - 2); ctx.lineTo(x + 2, y + s - 2);
        ctx.closePath(); ctx.fill(); break;
      case 4: drawStar(cx, cy, (s - 4) / 2, (s - 4) / 4, 5); ctx.fill(); break;
      case 5:
        ctx.beginPath();
        for(let i=0;i<6;i++){ const a=-Math.PI/2 + i*Math.PI/3;
          const px=cx+Math.cos(a)*((s-4)/2), py=cy+Math.sin(a)*((s-4)/2);
          if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath(); ctx.fill(); break;
    }
    ctx.restore();
  }

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = cssVar('--bg');
    ctx.fillRect(0,0,canvas.width,canvas.height);

    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        ctx.fillStyle = grid[y][x]? cssVar('--wall') : cssVar('--path');
        ctx.fillRect(x*tile, y*tile, tile, tile);
      }
    }

    ctx.save();
    ctx.shadowBlur  = Math.min(tile * 0.8, 14);
    ctx.shadowColor = cssVar('--goal');
    ctx.fillStyle   = cssVar('--goal');
    roundRect(ctx, goal.x * tile + 1, goal.y * tile + 1, tile - 2, tile - 2, Math.min(8, tile/3), true);
    ctx.restore();

    const px = player.x * tile + 2;
    const py = player.y * tile + 2;
    const ps = Math.max(6, Math.min(tile - 4, FIXED_PLAYER_PX));
    drawPlayerShape(currentLevel, px, py, ps);
  }

  // ---------- LÓGICA ----------
  function canMove(nx, ny){ return nx>=0 && ny>=0 && nx<W && ny<H && grid[ny][nx]===0; }
  function move(dx, dy){
    const nx=player.x+dx, ny=player.y+dy;
    if(!canMove(nx,ny)) return;
    player.x=nx; player.y=ny;
    if(nx===goal.x && ny===goal.y){
      winTitle.textContent = `🎉 Nível ${currentLevel} concluído!`;
      winDesc.textContent  = `Excelente! Pronto(a) para o próximo?`;
      winOverlay.classList.add('show');
      winOverlay.setAttribute('aria-hidden','false');
    }
    draw();
  }

  function dimsForAutoLevel(){
    const idx = clamp(currentLevel-1, 0, LEVELS.length-1);
    return { cols: LEVELS[idx].cols, rows: LEVELS[idx].rows, delay: LEVELS[idx].delay };
  }

  function applyLevel(n){
    currentLevel=n;
    levelTag.textContent=`Nível ${n}`;
    setThemeForLevel(n);

    let dims = dimsForAutoLevel();
    if(sizeSel.value!=='AUTO'){
      const preset = { S:[15,11], M:[27,19], G:[41,31], X:[61,45] }[sizeSel.value];
      if(preset) dims={ cols:preset[0], rows:preset[1], delay:dims.delay };
    }
    W = odd(dims.cols); H = odd(dims.rows);
    holdState.delay = dims.delay;

    grid = generateMaze(W,H);
    player = {x:1, y:1};
    goal   = {x:W-2, y:H-2};

    fitCanvas();
    winOverlay.classList.remove('show');
    winOverlay.setAttribute('aria-hidden','true');
    draw();
  }

  // ---------- ENTRADAS ----------
  function startHold(dir){
    if(holdState.running) return;
    holdState.dir = dir; holdState.running = true;
    move(dir[0],dir[1]); // passo inicial
    holdState.intId = setInterval(()=>move(dir[0],dir[1]), holdState.delay);
  }
  function stopHold(){
    holdState.running=false;
    if(holdState.intId){ clearInterval(holdState.intId); holdState.intId=null; }
  }

  // Teclado
  window.addEventListener('keydown', e=>{
    const k=e.key.toLowerCase();
    if(['arrowup','w'].includes(k)) startHold([0,-1]);
    if(['arrowdown','s'].includes(k)) startHold([0, 1]);
    if(['arrowleft','a'].includes(k)) startHold([-1,0]);
    if(['arrowright','d'].includes(k)) startHold([ 1,0]);
  });
  window.addEventListener('keyup', stopHold);

  // Toque / D-Pad
  if (dpad){
    const bind = (btn) => {
      const [dx,dy] = btn.getAttribute('data-dir').split(',').map(n=>parseInt(n,10));
      const start = () => startHold([dx,dy]);
      const stop  = () => stopHold();
      btn.addEventListener('touchstart', e=>{ e.preventDefault(); start(); }, {passive:false});
      btn.addEventListener('touchend',   stop);
      btn.addEventListener('touchcancel',stop);
      btn.addEventListener('mousedown',  start);
      btn.addEventListener('mouseup',    stop);
      btn.addEventListener('mouseleave', stop);
    };
    dpad.querySelectorAll('.key').forEach(bind);
  }

  newBtn.addEventListener('click', ()=>applyLevel(currentLevel));
  againBtn.addEventListener('click', ()=>applyLevel(currentLevel));
  nextBtn.addEventListener('click', ()=>applyLevel(currentLevel+1));

  // Música
  function tryAutoplay(){
    if(!bgm) return;
    bgm.volume = parseFloat(vol.value||'0.5');
    bgm.play().then(()=>{
      musicToggle.setAttribute('aria-pressed','true');
      musicToggle.textContent='🎵 Música: Ligada';
    }).catch(()=>{ /* navegador pode bloquear, sem problemas */ });
  }
  musicToggle?.addEventListener('click', ()=>{
    if(!bgm) return;
    if(bgm.paused){ bgm.play(); musicToggle.textContent='🎵 Música: Ligada'; }
    else { bgm.pause(); musicToggle.textContent='🎵 Música: Desligada'; }
  });
  vol?.addEventListener('input', ()=>{ if(bgm) bgm.volume=parseFloat(vol.value||'0.5'); });

  // ---------- INICIALIZAÇÃO ----------
  function refresh(){
    setStageHeight();
    fitCanvas();
    draw();
  }

  // use ResizeObserver para reagir a mudanças reais de layout
  const ro = new ResizeObserver(()=>{ fitCanvas(); draw(); });
  ro.observe(stage);

  setThemeForLevel(currentLevel);
  applyLevel(currentLevel); // chama fitCanvas e desenha

  window.addEventListener('load', () => setTimeout(tryAutoplay, 300));

  // também reage a rotação / resize da janela com debounce
  let resizeTO;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(refresh, 120);
  });
})();
