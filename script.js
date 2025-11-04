(() => {
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
  let grid = [], W = 15, H = 11, tile = 16;
  let player = {x:1, y:1};
  let goal = {x: W-2, y: H-2};

  const holdState = { dir: null, intId: null, delay: 90, running: false };

  // Tamanho fixo do jogador (não diminui conforme o labirinto aumenta)
  const FIXED_PLAYER_PX = (Math.min(window.innerWidth, window.innerHeight) < 640) ? 16 : 20;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const choice = arr => arr[(Math.random()*arr.length)|0];
  const cssVar = (name)=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function setThemeForLevel(level){
    const baseHue=(level*47)%360;
    const root=document.documentElement.style;
    root.setProperty('--bg', `hsl(${baseHue},28%,94%)`);
    root.setProperty('--wall', `hsl(${baseHue},22%,18%)`);
    root.setProperty('--path', `hsl(${baseHue},30%,8%)`);
    root.setProperty('--player', `hsl(${(baseHue+40)%360},90%,55%)`);
    root.setProperty('--goal', `hsl(${(baseHue+320)%360},80%,55%)`);
  }

  function makeGrid(w,h,fill=1){return Array.from({length:h},()=>Array(w).fill(fill));}

  function generateMaze(w,h){
    const g=makeGrid(w,h,1);
    let sx=1,sy=1; g[sy][sx]=0;
    const stack=[[sx,sy]];
    const dirs=[[0,-2],[2,0],[0,2],[-2,0]];
    while(stack.length){
      const [cx,cy]=stack.at(-1);
      const options=dirs.map(([dx,dy])=>[cx+dx,cy+dy,dx,dy]).filter(([nx,ny])=>
        ny>0&&ny<h-1&&nx>0&&nx<w-1&&g[ny][nx]===1);
      if(!options.length) stack.pop();
      else{
        const [nx,ny,dx,dy]=choice(options);
        g[cy+dy/2][cx+dx/2]=0; g[ny][nx]=0; stack.push([nx,ny]);
      }
    }
    return g;
  }

  function fitCanvas(){
    const pad=24;
    const availW=stage.clientWidth-pad*2;
    const availH=stage.clientHeight-pad*2;
    tile=Math.floor(Math.min(availW/W,availH/H));
    tile=Math.max(tile,10);
    canvas.width=tile*W; canvas.height=tile*H;
  }

  function drawPlayerShape(level,x,y,size){
    const idx=(level-1)%6;
    const s=Math.max(6,size);
    const cx=x+s/2,cy=y+s/2;
    ctx.save();
    ctx.fillStyle=cssVar('--player');
    switch(idx){
      case 0: ctx.beginPath(); ctx.arc(cx,cy,s/2-2,0,Math.PI*2); ctx.fill(); break;
      case 1: ctx.fillRect(x+2,y+2,s-4,s-4); break;
      case 2: ctx.beginPath(); ctx.moveTo(cx,y); ctx.lineTo(x+s,cy); ctx.lineTo(cx,y+s); ctx.lineTo(x,cy); ctx.fill(); break;
      case 3: ctx.beginPath(); ctx.moveTo(cx,y); ctx.lineTo(x+s,y+s); ctx.lineTo(x,y+s); ctx.fill(); break;
      case 4: ctx.beginPath(); for(let i=0;i<10;i++){const a=Math.PI/5*i-Math.PI/2;const r=i%2?s/2-2:s/4;ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}ctx.fill();break;
      case 5: ctx.beginPath(); for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/2;ctx.lineTo(cx+Math.cos(a)*(s/2-2),cy+Math.sin(a)*(s/2-2));}ctx.fill();break;
    }
    ctx.restore();
  }

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle=cssVar('--bg');
    ctx.fillRect(0,0,canvas.width,canvas.height);

    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      ctx.fillStyle=grid[y][x]?cssVar('--wall'):cssVar('--path');
      ctx.fillRect(x*tile,y*tile,tile,tile);
    }

    ctx.fillStyle=cssVar('--goal');
    ctx.fillRect(goal.x*tile+2,goal.y*tile+2,tile-4,tile-4);

    const px=player.x*tile+2,py=player.y*tile+2;
    const ps=Math.max(6,Math.min(tile-4,FIXED_PLAYER_PX));
    drawPlayerShape(currentLevel,px,py,ps);
  }

  function applyLevel(n){
    currentLevel=n;
    levelTag.textContent=`Nível ${n}`;
    setThemeForLevel(n);
    const cfg=LEVELS[Math.min(n-1,LEVELS.length-1)];
    W=cfg.cols; H=cfg.rows; holdState.delay=cfg.delay;
    grid=generateMaze(W,H);
    player={x:1,y:1}; goal={x:W-2,y:H-2};
    fitCanvas(); draw();
  }

  newBtn.onclick=()=>applyLevel(currentLevel);
  nextBtn.onclick=()=>applyLevel(currentLevel+1);
  againBtn.onclick=()=>applyLevel(currentLevel);

  window.addEventListener('resize',()=>{fitCanvas();draw();});
  applyLevel(1);
})();
