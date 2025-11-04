/*
  Build robusto: responsivo + D-Pad + tamanho fixo do jogador + tema por nível.
*/
(() => {
  // ---------- ELEMENTOS ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });

  const sizeSel = document.getElementById('sizeSel');
  const newBtn  = document.getElementById('newBtn');
  const againBtn= document.getElementById('againBtn');
  const nextBtn = document.getElementById('nextBtn');

  const winOverlay = document.getElementById('winOverlay');
  const winTitle   = document.getElementById('winTitle');
  const winDesc    = document.getElementById('winDesc');
  const levelTag   = document.getElementById('levelTag');
  const stage      = document.getElementById('stage');
  const dpad       = document.getElementById('dpad');

  // ---------- CONFIG ----------
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
  let player = { x: 1, y: 1 };
  let goal   = { x: W-2, y: H-2 };

  // mov. contínuo
  const holdState = { dir: null, running: false, delay: 90, intId: null };

  // ---------- UTIL ----------
  const FIXED_PLAYER_PX = (Math.min(window.innerWidth, window.innerHeight) < 640) ? 16 : 20;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const choice = arr => arr[(Math.random()*arr.length)|0];
  const odd = n => n % 2 ? n : n-1;
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function setThemeForLevel(level){
    const baseHue = (level * 47) % 360;
    const root = document.documentElement.style;
    root.setProperty('--bg',     `hsl(${baseHue}, 28%, 94%)`); // fundo claro
    root.setProperty('--wall',   `hsl(${baseHue}, 22%, 18%)`);
    root.setProperty('--path',   `hsl(${baseHue}, 30%, 8%)`);
    root.setProperty('--player', `hsl(${(baseHue+40)%360}, 90%, 55%)`);
    root.setProperty('--goal',   `hsl(${(baseHue+320)%360}, 80%, 55%)`);
    root.setProperty('--ring',   `hsla(${baseHue}, 100%, 100%, 0.07)`);
  }

  // ---------- GERAÇÃO ----------
  function makeGrid(w,h,fill=1){ return Array.from({length:h},()=>Array(w).fill(fill)); }
  function neighborsCarvables(x,y,g){
    const dirs = [[0,-2],[2,0],[0,2],[-2,0]];
    for (let i=dirs.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [dirs[i],dirs[j]]=[dirs[j],dirs[i]]; }
    const res=[];
    for (const [dx,dy] of dirs){
      const nx=x+dx, ny=y+dy;
      if (ny>0 && ny<g.length-1 && nx>0 && nx<g[0].length-1 && g[ny][nx]===1) res.push([nx,ny,dx,dy]);
    }
    return res;
  }
  function generateMaze(w,h){
    const g = makeGrid(w,h,1);
    let sx = 1, sy = 1;
    g[sy][sx] = 0;
    const stack = [[sx,sy]];
    while (stack.length){
      const [cx,cy] = stack.at(-1);
      const ns = neighborsCarvables(cx,cy,g);
      if (!ns.length){ stack.pop(); continue; }
      const [nx,ny,dx,dy] = choice(ns);
      g[cy+dy/2][cx+dx/2] = 0;   // quebra a parede
      g[ny][nx] = 0;             // abre a célula
      stack.push([nx,ny]);
    }
    return g;
  }

  // ---------- LAYOUT À PROVA DE FALHA ----------
  function safeStageHeightPx(){
    // mede área real descontando header/footer (evita bugs de vh no mobile)
    const header = document.querySelector('header.bar');
    const footer = document.querySelector('footer.bar');
    const hHead = header ? header.getBoundingClientRect().height : 0;
    const hFoot = footer ? footer.getBoundingClientRect().height : 0;
    const extra = 40; // padding+gaps
    const inner = window.innerHeight || document.documentElement.clientHeight || 700;
    const raw = inner - hHead - hFoot - extra;
    // entre 320px e 90% da janela
    return clamp(Math.floor(raw * 0.9), 320, Math.floor(inner * 0.92));
  }

  function fitCanvas(){
    // 1) garantir altura do palco
    const stageH = safeStageHeightPx();
    if (stageH && Number.isFinite(stageH)) stage.style.height = stageH + 'px';
    // fallback final, se algo falhar:
    if (!stage.style.height) stage.style.height = '480px';

    // 2) medir área interna
    const pad = 12;
    const rect = stage.getBoundingClientRect();
    let availW = Math.max(200, (rect.width  || stage.clientWidth  || 800) - pad*2);
    let availH = Math.max(200, (rect.height || stage.clientHeight || 480) - pad*2);

    // 3) calcular tile
    const tileRaw = Math.min(availW / W, availH / H);
    const isMobile = Math.min(window.innerWidth, window.innerHeight) < 820;
    const tileMin = 10;
    const tileMax = isMobile ? 36 : 48;
    tile = clamp(Math.floor(tileRaw || 16), tileMin, tileMax);

    // 4) aplicar no canvas
    canvas.width  = Math.max(100, Math.floor(tile * W));
    canvas.height = Math.max(100, Math.floor(tile * H));
  }

  // ---------- DRAW ----------
  function roundRect(ctx, x, y, w, h, r, fill){
    const rr = Math.max(2, Math.min(r, Math.min(w,h)/2));
    ctx.
