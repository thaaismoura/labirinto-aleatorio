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

  // ---------- CONFIG NÍVEIS ----------
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

  // ---------- ESTADO ----------
  let grid = [];
  let W = 15, H = 11;
  let tile = 16;
  let player = {x:1, y:1};
  let goal = {x: W-2, y: H-2};

  // Movimento contínuo
  const holdState = { dir: null, intId: null, delay: 90, running: false };

  // ---------- UTIL ----------
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const choice = arr=>arr[(Math.random()*arr.length)|0];
  const odd = n=>n%2?n:n-1;

  // Tema dinâmico por nível
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
    const idx=clamp(currentLevel-1,0,LEVELS.length-1);
    return { cols:LEVELS[idx].cols, rows:LEVELS[idx].rows, delay:LEVELS[idx].delay };
  }

  // ---------- GERAÇÃO LABIRINTO ----------
  function makeGrid(w,h,f=1){return Array.from({length:h},()=>Array(w).fill(f));}
  function neighborsCarvables(x,y,g){
    const dirs=[[0,-2],[2,0],[0,2],[-2,0]];
    for(let i=dirs.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[dirs[i],dirs[j]]=[dirs[j],dirs[i]];}
    const res=[];
    for(const[dx,dy] of dirs){
      const nx=x+dx,ny=y+dy;
      if(ny>0&&ny<g.length-1&&nx>0&&nx<g[0].length-1&&g[ny][nx]===1) res.push([nx,ny,dx,dy]);
    }
    return res;
  }
  function generateMaze(w,h){
    const g=makeGrid(w,h,1); let sx=1, sy=1; g[sy][sx]=0;
    const stack=[[sx,sy]];
    while(stack.length){
      const[cx,cy]=stack.at(-1);
      const ns=neighborsCarvables(cx,cy,g);
      if(!ns.length) stack.pop();
      else{
        const[nx,ny,dx,dy]=choice(ns);
        g[cy+dy/2][cx+dx/2]=0; g[ny][nx]=0; stack.push([nx,ny]);
      }
    }
    return g;
  }

  // ---------- DESENHO (com “iluminação”) ----------
  function fitCanvas(){
    const pad=24;
    const availW=stage.clientWidth-pad*2;
    const availH=stage.clientHeight-pad*2;
    tile=Math.floor(Math.min(availW/W, availH/H));
    tile=Math.max(tile,6);
    canvas.width=tile*W;
    canvas.height=tile*H;
  }
  function cssVar(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim();}

  function draw(){
    // fundo
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='black';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // paredes com leve brilho em volta (iluminação suave)
    ctx.save();
    ctx.shadowBlur = Math.max(4, tile*0.30);
    ctx.shadowColor = 'rgba(255,255,255,0.08)';
    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        if(grid[y][x]){ // parede
          ctx.fillStyle = cssVar('--wall');
          ctx.fillRect(x*tile, y*tile, tile, tile);
        }
      }
    }
    ctx.restore();

    // caminhos (sem sombra, para contraste)
    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        if(!grid[y][x]){
          ctx.fillStyle = cssVar('--path');
          ctx.fillRect(x*tile, y*tile, tile, tile);
        }
      }
    }

    // objetivo com brilho
    ctx.save();
    ctx.shadowBlur = Math.max(8, tile*0.8);
    ctx.shadowColor = cssVar('--goal');
    ctx.fillStyle = cssVar('--goal');
    roundRect(ctx, goal.x*tile+1, goal.y*tile+1, tile-2, tile-2, Math.min(8,tile/3), true);
    ctx.restore();

    // player com brilho
    ctx.save();
    ctx.shadowBlur = Math.max(10, tile*0.9);
    ctx.shadowColor = cssVar('--player');
    ctx.fillStyle = cssVar('--player');
    roundRect(ctx, player.x*tile+2, player.y*tile+2, tile-4, tile-4, Math.min(10,tile/2.5), true);
    ctx.restore();
  }

  function roundRect(ctx,x,y,w,h,r,fill){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    if(fill) ctx.fill();
  }

  // ---------- LÓGICA ----------
  function canMove(nx,ny){return nx>=0&&ny>=0&&nx<W&&ny<H&&grid[ny][nx]===0;}
  function move(dx,dy){
    const nx=player.x+dx, ny=player.y+dy;
    if(canMove(nx,ny)){ player.x=nx; player.y=ny; draw(); checkWin(); }
  }
  function checkWin(){
    if(player.x===goal.x && player.y===goal.y){
      winTitle.textContent = `🎉 Nível ${currentLevel} concluído!`;
      winDesc.textContent = `Excelente! Prepare-se para o nível ${currentLevel + 1}.`;
      winOverlay.classList.add('show');
      stopHold();
      playWinJingle();
    }
  }
  function applyLevel(levelNum){
    currentLevel = levelNum;
    levelTag.textContent = `Nível ${currentLevel}`;
    setThemeForLevel(currentLevel);

    const mode=sizeSel.value;
    if(mode==='AUTO'){
      const cfg=dimsForAutoLevel();
      W=odd(cfg.cols); H=odd(cfg.rows); holdState.delay=cfg.delay;
    } else {
      const map={S:[21,15],M:[35,25],G:[51,35],X:[69,49]};
      const [cols,rows]=map[mode]||[35,25];
      W=odd(cols); H=odd(rows);
      const idx=clamp(currentLevel-1,0,LEVELS.length-1);
      holdState.delay=LEVELS[idx].delay;
    }

    grid=generateMaze(W,H);
    player={x:1,y:1};
    goal={x:W-2,y:H-2};
    winOverlay.classList.remove('show');
    fitCanvas();
    draw();
  }
  function newGame(){ applyLevel(currentLevel); }
  function nextLevel(){ applyLevel(currentLevel+1); }

  // ---------- CONTROLES CONTÍNUOS ----------
  function startHold(dir){
    holdState.dir=dir;
    if(holdState.running) return;
    holdState.running=true;
    move(dir[0],dir[1]);
    holdState.intId=setInterval(()=>move(dir[0],dir[1]), holdState.delay);
  }
  function stopHold(){
    holdState.running=false;
    if(holdState.intId){ clearInterval(holdState.intId); holdState.intId=null; }
  }
  underControls.addEventListener('pointerdown', (e)=>{
    const btn=e.target.closest('.uc-btn'); if(!btn) return;
    const d=btn.getAttribute('data-d');
    const dir=d==='up'?[0,-1]:d==='down'?[0,1]:d==='left'?[-1,0]:[1,0];
    startHold(dir); ensureMusicRunning();
  });
  ['pointerup','pointercancel','pointerleave'].forEach(t=>underControls.addEventListener(t, stopHold));

  const dirByKey=new Map([
    ['ArrowUp',[0,-1]],['KeyW',[0,-1]],
    ['ArrowDown',[0,1]],['KeyS',[0,1]],
    ['ArrowLeft',[-1,0]],['KeyA',[-1,0]],
    ['ArrowRight',[1,0]],['KeyD',[1,0]],
  ]);
  window.addEventListener('keydown', (e)=>{
    const dir=dirByKey.get(e.code); if(!dir) return;
    e.preventDefault();
    if(!holdState.running || holdState.dir?.toString()!==dir.toString()){
      stopHold(); startHold(dir);
    }
    ensureMusicRunning();
  }, { passive:false });
  window.addEventListener('keyup', e=>{ if(dirByKey.has(e.code)) stopHold(); }, { passive:true });

  // ---------- ÁUDIO (Web Audio: música alegre + SFX) ----------
  // Gera uma trilha chiptune animada; botão liga/desliga mutando o ganho mestre.
  let actx=null, masterGain=null, musicGain=null, musicOn=false, beatTimer=null;
  const BEAT = 0.12; // rápido e alegre

  // notas
  const NOTE={ C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196.00, A3:220.00, B3:246.94,
               C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
               C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00 };

  function initAudio(){
    if(actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = actx.createGain();
    masterGain.gain.value = parseFloat(vol.value);
    masterGain.connect(actx.destination);

    musicGain = actx.createGain();
    musicGain.gain.value = 0.8; // relativo ao master
    musicGain.connect(masterGain);
  }

  // Trilhas: baixo + arpejo + chimbal (ruído curto)
  const CHORDS = [
    [NOTE.C4, NOTE.E4, NOTE.G4], // C
    [NOTE.G3, NOTE.D4, NOTE.B4], // G
    [NOTE.A3, NOTE.C4, NOTE.E4], // Am
    [NOTE.F3, NOTE.A3, NOTE.C4], // F
  ];
  const BASS = [NOTE.C3, NOTE.G3, NOTE.A3, NOTE.F3];

  function hat(t0, dur=0.02, vol=0.08){
    const buf = actx.createBuffer(1, actx.sampleRate*dur, actx.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1) * 0.7;
    const src = actx.createBufferSource(); src.buffer = buf;
    const g = actx.createGain(); g.gain.value = vol;
    const hp = actx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value = 8000;
    src.connect(hp).connect(g).connect(musicGain);
    src.start(t0); src.stop(t0+dur);
  }
  function tone(type, freq, t0, dur, vol=0.18, a=0.005, r=0.06, target=musicGain){
    const o=actx.createOscillator(), g=actx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0+a);
    g.gain.linearRampToValueAtTime(0, t0+dur);
    o.connect(g).connect(target);
    o.start(t0); o.stop(t0+dur+r);
  }

  function scheduleBar(bar){
    const t0 = actx.currentTime + 0.03;
    const chord = CHORDS[bar % CHORDS.length];
    const bass  = BASS[bar % BASS.length];

    // chimbal a cada 1/2 beat
    for(let i=0;i<8;i++) hat(t0 + i*BEAT*0.5, 0.02, i%2?0.09:0.07);

    // baixo: serra marcando no início + síncope
    tone('sawtooth', bass, t0, BEAT*1.2, 0.22);
    tone('sawtooth', bass, t0 + BEAT*1.5, BEAT, 0.16);

    // arpejo alegre (triângulo)
    const arp = [0,1,2,1,0,2,1,2];
    arp.forEach((idx,i)=> tone('triangle', chord[idx]*2, t0 + i*BEAT*0.5, BEAT*0.45, 0.22));

    // melodia simples (seno)
    const top=[chord[0]*4, chord[1]*4, chord[2]*4, chord[1]*4];
    top.forEach((f,i)=> tone('sine', f, t0 + i*BEAT, BEAT*0.9, 0.18));
  }

  function startMusic(){
    initAudio();
    if(musicOn) return;
    musicOn = true;
    musicToggle.setAttribute('aria-pressed','true');
    musicToggle.textContent = '🎵 Música: Ligada';

    let bar = 0;
    const run = ()=> scheduleBar(bar++);
    run();
    beatTimer = setInterval(run, Math.round(BEAT*4*1000)); // 1 compasso = 4 beats
  }

  function stopMusic(){
    musicOn = false;
    musicToggle.setAttribute('aria-pressed','false');
    musicToggle.textContent = '🎵 Música: Desligada';
    if(beatTimer){ clearInterval(beatTimer); beatTimer=null; }
  }

  // Botão: alterna a música (liga/desliga)
  musicToggle.addEventListener('click', async ()=>{
    initAudio();
    if(actx.state === 'suspended') await actx.resume();
    if(!musicOn) startMusic(); else stopMusic();
  });

  // Volume (master) — afeta trilha e SFX
  vol.addEventListener('input', ()=>{
    initAudio();
    masterGain.gain.value = parseFloat(vol.value);
  });

  // Garante início após interação se autoplay falhar
  function ensureMusicRunning(){
    initAudio();
    if(!musicOn){
      actx.resume().finally(()=> startMusic());
    }
  }

  // SFX vitória (curto arpejo)
  function playWinJingle(){
    initAudio();
    const t = actx.currentTime + 0.02;
    const winGain = actx.createGain();
    winGain.gain.value = 0.8;
    winGain.connect(masterGain);
    const seq = [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5, NOTE.E5];
    seq.forEach((f,i)=> tone('triangle', f, t + i*0.08, 0.14, 0.35, 0.003, 0.05, winGain));
  }

  // ---------- UI ----------
  newBtn.addEventListener('click', ()=> newGame());
  againBtn.addEventListener('click', ()=> { winOverlay.classList.remove('show'); newGame(); });
  nextBtn.addEventListener('click', ()=> { winOverlay.classList.remove('show'); nextLevel(); });
  sizeSel.addEventListener('change', ()=> newGame());

  // ---------- INICIALIZAÇÃO ----------
  setThemeForLevel(currentLevel);
  applyLevel(currentLevel);

  // tenta iniciar música depois de carregar (se for bloqueado, o primeiro gesto destrava)
  window.addEventListener('load', ()=> {
    try { ensureMusicRunning(); } catch {}
  });

  // resize
  let resizeTO;
  window.addEventListener('resize', ()=>{
    clearTimeout(resizeTO);
    resizeTO = setTimeout(()=>{ fitCanvas(); draw(); }, 120);
  });
})();
