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
  const bgm = document.getElementById('bgm'); // 🎵 faixa MP3

  // ---------- CONFIGURAÇÃO DOS NÍVEIS ----------
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
  const holdState = { dir: null, intId: null, delay: 90, running: false };

  // ---------- UTILITÁRIOS ----------
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const choice = arr=>arr[(Math.random()*arr.length)|0];
  const odd = n=>n%2?n:n-1;

  function setThemeForLevel(level){
    const baseHue=(level*47)%360;
    const root=document.documentElement.style;
    root.setProperty('--wall',`hsl(${baseHue},22%,18%)`);
    root.setProperty('--path',`hsl(${baseHue},30%,8%)`);
    root.setProperty('--player',`hsl(${(baseHue+40)%360},90%,55%)`);
    root.setProperty('--goal',`hsl(${(baseHue+320)%360},80%,55%)`);
    root.setProperty('--ring',`hsla(${baseHue},100%,100%,0.07)`);
  }

  function dimsForAutoLevel(){
    const idx=clamp(currentLevel-1,0,LEVELS.length-1);
    return { cols:LEVELS[idx].cols, rows:LEVELS[idx].rows, delay:LEVELS[idx].delay };
  }

  // ---------- GERADOR DO LABIRINTO ----------
  function makeGrid(w,h,f=1){return Array.from({length:h},()=>Array(w).fill(f));}
  function neighborsCarvables(x,y,g){
    const dirs=[[0,-2],[2,0],[0,2],[-2,0]];
    for(let i=dirs.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[dirs[i],dirs[j]]=[dirs[j],dirs[i]];}
    const res=[];
    for(const[dx,dy]of dirs){
      const nx=x+dx,ny=y+dy;
      if(ny>0&&ny<g.length-1&&nx>0&&nx<g[0].length-1&&g[ny][nx]===1)res.push([nx,ny,dx,dy]);
    }return res;
  }
  function generateMaze(w,h){
    const g=makeGrid(w,h,1);let sx=1,sy=1;g[sy][sx]=0;
    const stack=[[sx,sy]];
    while(stack.length){
      const[cx,cy]=stack.at(-1);
      const ns=neighborsCarvables(cx,cy,g);
      if(!ns.length)stack.pop();else{
        const[nx,ny,dx,dy]=choice(ns);
        g[cy+dy/2][cx+dx/2]=0;g[ny][nx]=0;stack.push([nx,ny]);
      }
    }return g;
  }

  // ---------- DESENHO ----------
  function fitCanvas(){
    const pad=24;
    const availW=stage.clientWidth-pad*2;
    const availH=stage.clientHeight-pad*2;
    tile=Math.floor(Math.min(availW/W,availH/H));
    tile=Math.max(tile,6);
    canvas.width=tile*W;canvas.height=tile*H;
  }
  function cssVar(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim();}
  function draw(){
    ctx.fillStyle='black';ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){ctx.fillStyle=grid[y][x]?cssVar('--wall'):cssVar('--path');ctx.fillRect(x*tile,y*tile,tile,tile);}
    ctx.fillStyle=cssVar('--goal');roundRect(ctx,goal.x*tile+1,goal.y*tile+1,tile-2,tile-2,8,true);
    ctx.fillStyle=cssVar('--player');roundRect(ctx,player.x*tile+2,player.y*tile+2,tile-4,tile-4,8,true);
  }
  function roundRect(ctx,x,y,w,h,r,f){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);if(f)ctx.fill();}

  // ---------- JOGO ----------
  function canMove(nx,ny){return nx>=0&&ny>=0&&nx<W&&ny<H&&grid[ny][nx]===0;}
  function move(dx,dy){const nx=player.x+dx,ny=player.y+dy;if(canMove(nx,ny)){player.x=nx;player.y=ny;draw();checkWin();}}
  function checkWin(){
    if(player.x===goal.x&&player.y===goal.y){
      winTitle.textContent=`🎉 Nível ${currentLevel} concluído!`;
      winOverlay.classList.add('show');
      stopHold();
      playWinJingle();
    }
  }
  function applyLevel(lvl){
    currentLevel=lvl;levelTag.textContent=`Nível ${currentLevel}`;setThemeForLevel(currentLevel);
    const mode=sizeSel.value;
    if(mode==='AUTO'){const cfg=dimsForAutoLevel();W=odd(cfg.cols);H=odd(cfg.rows);holdState.delay=cfg.delay;}
    else{const map={S:[21,15],M:[35,25],G:[51,35],X:[69,49]},[cols,rows]=map[mode]||[35,25];W=odd(cols);H=odd(rows);}
    grid=generateMaze(W,H);player={x:1,y:1};goal={x:W-2,y:H-2};winOverlay.classList.remove('show');fitCanvas();draw();
  }
  function newGame(){applyLevel(currentLevel);}
  function nextLevel(){applyLevel(currentLevel+1);}

  // ---------- CONTROLE CONTÍNUO ----------
  function startHold(dir){holdState.dir=dir;if(holdState.running)return;holdState.running=true;move(...dir);holdState.intId=setInterval(()=>move(...dir),holdState.delay);}
  function stopHold(){holdState.running=false;if(holdState.intId){clearInterval(holdState.intId);holdState.intId=null;}}
  underControls.addEventListener('pointerdown',e=>{const b=e.target.closest('.uc-btn');if(!b)return;const d=b.getAttribute('data-d');const dir=d==='up'?[0,-1]:d==='down'?[0,1]:d==='left'?[-1,0]:[1,0];startHold(dir);tryAutoplay();});
  ['pointerup','pointercancel','pointerleave'].forEach(t=>underControls.addEventListener(t,stopHold));
  const dirByKey=new Map([['ArrowUp',[0,-1]],['KeyW',[0,-1]],['ArrowDown',[0,1]],['KeyS',[0,1]],['ArrowLeft',[-1,0]],['KeyA',[-1,0]],['ArrowRight',[1,0]],['KeyD',[1,0]]]);
  window.addEventListener('keydown',e=>{const dir=dirByKey.get(e.code);if(!dir)return;e.preventDefault();if(!holdState.running||holdState.dir?.toString()!==dir.toString()){stopHold();startHold(dir);}tryAutoplay();});
  window.addEventListener('keyup',e=>{if(dirByKey.has(e.code))stopHold();});

  // ---------- ÁUDIO: TRILHA + EFEITOS ----------
  let actx=null, masterGain=null;
  function initSfx(){if(actx)return;actx=new(window.AudioContext||window.webkitAudioContext)();masterGain=actx.createGain();masterGain.connect(actx.destination);masterGain.gain.value=parseFloat(vol.value);}
  vol.addEventListener('input',()=>{const v=parseFloat(vol.value);bgm.volume=v;if(masterGain)masterGain.gain.value=v;});

  function setMusicBtn(on){musicToggle.textContent=on?'🎵 Música: Ligada':'🎵 Música: Desligada';musicToggle.setAttribute('aria-pressed',String(on));}
  function refreshMusicBtn(){setMusicBtn(!bgm.paused);}
  bgm.addEventListener('play',refreshMusicBtn);
  bgm.addEventListener('pause',refreshMusicBtn);
  musicToggle.addEventListener('click',async()=>{if(bgm.paused){try{await bgm.play();}catch{};}else{bgm.pause();}refreshMusicBtn();});

  function tryAutoplay(){if(!bgm.paused)return;bgm.play().then(refreshMusicBtn).catch(()=>{const unlock=async()=>{try{await bgm.play();refreshMusicBtn();remove();}catch{}};const evs=['pointerdown','touchstart','keydown','click'];function remove(){evs.forEach(ev=>window.removeEventListener(ev,unlock,true));}evs.forEach(ev=>window.addEventListener(ev,unlock,true));});}

  // efeitos vitória
  function playTone(f,t,d){initSfx();const o=actx.createOscillator(),g=actx.createGain();o.type='triangle';o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(.3,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(masterGain);o.start(t);o.stop(t+d+.02);}
  const NOTE={C4:261.63,E4:329.63,G4:392.00,C5:523.25,E5:659.25,A4:440.00};
  function playWinJingle(){const t=actx?actx.currentTime+.05:0;[NOTE.C4,NOTE.E4,NOTE.G4,NOTE.C5,NOTE.E5].forEach((f,i)=>playTone(f,t+i*0.1,0.15));}

  // ---------- INICIALIZAÇÃO ----------
  setThemeForLevel(currentLevel);applyLevel(currentLevel);
  newBtn.onclick=()=>newGame();againBtn.onclick=()=>{winOverlay.classList.remove('show');newGame();};nextBtn.onclick=()=>{winOverlay.classList.remove('show');nextLevel();};
  window.addEventListener('resize',()=>setTimeout(()=>{fitCanvas();draw();},120));
  window.addEventListener('load',()=>setTimeout(tryAutoplay,300));
})();
