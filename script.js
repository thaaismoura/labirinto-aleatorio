(() => {
  const canvas=document.getElementById("game"),ctx=canvas.getContext("2d",{alpha:false});
  const newBtn=document.getElementById("newBtn"),againBtn=document.getElementById("againBtn"),nextBtn=document.getElementById("nextBtn");
  const winOverlay=document.getElementById("winOverlay"),winTitle=document.getElementById("winTitle"),winDesc=document.getElementById("winDesc");
  const levelTag=document.getElementById("levelTag"),stage=document.getElementById("stage"),sizeSel=document.getElementById("sizeSel"),dpad=document.getElementById("dpad");
  let grid=[],W=15,H=11,tile=16,player={x:1,y:1},goal={x:13,y:9},currentLevel=1;
  const LEVELS=[{cols:15,rows:11,delay:110},{cols:21,rows:15,delay:95},{cols:27,rows:19,delay:85},{cols:33,rows:23,delay:75},{cols:41,rows:31,delay:70},{cols:51,rows:35,delay:65},{cols:61,rows:45,delay:60},{cols:71,rows:51,delay:55}];
  const holdState={dir:null,run:false,delay:90,id:null};
  const FIXED_PLAYER_PX=(Math.min(window.innerWidth,window.innerHeight)<640)?16:20;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),choice=a=>a[(Math.random()*a.length)|0],odd=n=>n%2?n:n-1;
  const cssVar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function setThemeForLevel(l){const h=(l*47)%360,r=document.documentElement.style;
    r.setProperty("--bg",`hsl(${h},28%,94%)`);
    r.setProperty("--wall",`hsl(${h},22%,18%)`);
    r.setProperty("--path",`hsl(${h},30%,8%)`);
    r.setProperty("--player",`hsl(${(h+40)%360},90%,55%)`);
    r.setProperty("--goal",`hsl(${(h+320)%360},80%,55%)`);
    r.setProperty("--ring",`hsla(${h},100%,100%,0.07)`);}
  function makeGrid(w,h,f=1){return Array.from({length:h},()=>Array(w).fill(f))}
  function neighbors(x,y,g){const d=[[0,-2],[2,0],[0,2],[-2,0]];for(let i=d.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[d[i],d[j]]=[d[j],d[i]];}const r=[];for(const[dx,dy]of d){const nx=x+dx,ny=y+dy;if(ny>0&&ny<g.length-1&&nx>0&&nx<g[0].length-1&&g[ny][nx]===1)r.push([nx,ny,dx,dy])}return r}
  function genMaze(w,h){const g=makeGrid(w,h,1);let sx=1,sy=1;g[sy][sx]=0;const st=[[sx,sy]];while(st.length){const[cx,cy]=st.at(-1);const ns=neighbors(cx,cy,g);if(!ns.length){st.pop();continue;}const[nx,ny,dx,dy]=choice(ns);g[cy+dy/2][cx+dx/2]=0;g[ny][nx]=0;st.push([nx,ny]);}return g}
  function setStageHeight(){const hd=document.querySelector("header.bar"),ft=document.querySelector("footer.bar");const hh=hd?.getBoundingClientRect().height||0,hf=ft?.getBoundingClientRect().height||0;const avail=Math.max(300,window.innerHeight-hh-hf-40);stage.style.height=Math.min(avail,window.innerHeight*0.9)+"px";}
  function fitCanvas(){setStageHeight();const r=stage.getBoundingClientRect();const aw=Math.max(200,r.width-24),ah=Math.max(200,r.height-24);const raw=Math.min(aw/W,ah/H);const mob=Math.min(window.innerWidth,window.innerHeight)<820;tile=clamp(Math.floor(raw),10,mob?36:48);canvas.width=Math.floor(tile*W);canvas.height=Math.floor(tile*H);}
  function drawPlayerShape(l,x,y,s){const i=(l-1)%6,cx=x+s/2,cy=y+s/2;ctx.save();ctx.fillStyle=cssVar("--player");switch(i){case 0:ctx.beginPath();ctx.arc(cx,cy,s/2-2,0,Math.PI*2);ctx.fill();break;case 1:ctx.fillRect(x+2,y+2,s-4,s-4);break;case 2:ctx.beginPath();ctx.moveTo(cx,y);ctx.lineTo(x+s,cy);ctx.lineTo(cx,y+s);ctx.lineTo(x,cy);ctx.fill();break;case 3:ctx.beginPath();ctx.moveTo(cx,y);ctx.lineTo(x+s,y+s);ctx.lineTo(x,y+s);ctx.fill();break;case 4:ctx.beginPath();for(let i=0;i<10;i++){const a=Math.PI/5*i-Math.PI/2,r=i%2?s/2-2:s/4;ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}ctx.fill();break;case 5:ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/2;ctx.lineTo(cx+Math.cos(a)*(s/2-2),cy+Math.sin(a)*(s/2-2));}ctx.fill();break;}ctx.restore();}
  function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle=cssVar("--bg");ctx.fillRect(0,0,canvas.width,canvas.height);for(let y=0;y<H;y++){for(let x=0;x<W;x++){ctx.fillStyle=grid[y][x]?cssVar("--wall"):cssVar("--path");ctx.fillRect(x*tile,y*tile,tile,tile);}}ctx.fillStyle=cssVar("--goal");ctx.fillRect(goal.x*tile+2,goal.y*tile+2,tile-4,tile-4);const px=player.x*tile+2,py=player.y*tile+2,ps=Math.max(6,Math.min(tile-4,FIXED_PLAYER_PX));drawPlayerShape(currentLevel,px,py,ps);}
  function canMove(nx,ny){return nx>=0&&ny>=0&&nx<W&&ny<H&&grid[ny][nx]===0}
  function move(dx,dy){const nx=player.x+dx,ny=player.y+dy;if(!canMove(nx,ny))return;player.x=nx;player.y=ny;if(nx===goal.x&&ny===goal.y){winTitle.textContent=`🎉 Nível ${currentLevel} concluído!`;winDesc.textContent="Excelente!";winOverlay.classList.add("show");}draw();}
  function dimsForAuto(){const i=clamp(currentLevel-1,0,LEVELS.length-1);return{cols:LEVELS[i].cols,rows:LEVELS[i].rows,delay:LEVELS[i].delay}}
  function applyLevel(n){currentLevel=n;levelTag.textContent=`Nível ${n}`;setThemeForLevel(n);let d=dimsForAuto();if(sizeSel.value!=="AUTO"){const p={S:[15,11],M:[27,19],G:[41,31],X:[61,45]}[sizeSel.value];if(p)d={cols:p[0],rows:p[1],delay:d.delay};}W=odd(d.cols);H=odd(d.rows);holdState.delay=d.delay;grid=genMaze(W,H);player={x:1,y:1};goal={x:W-2,y:H-2};fitCanvas();winOverlay.classList.remove("show");draw();}
  function startHold(dir){if(holdState.run)return;holdState.run=true;holdState.dir=dir;move(dir[0],dir[1]);holdState.id=setInterval(()=>move(dir[0],dir[1]),holdState.delay);}
  function stopHold(){holdState.run=false;if(holdState.id){clearInterval(holdState.id);holdState.id=null;}}
  window.addEventListener("keydown",e=>{const k=e.key.toLowerCase();if(["arrowup","w"].includes(k))startHold([0,-1]);if(["arrowdown","s"].includes(k))startHold([0,1]);if(["arrowleft","a"].includes(k))startHold([-1,0]);if(["arrowright","d"].includes(k))startHold([1,0]);});
  window.addEventListener("keyup",stopHold);
  if(dpad){dpad.querySelectorAll(".key").forEach(b=>{const[dx,dy]=b.dataset.dir.split(",").map(Number);b.onmousedown=()=>startHold([dx,dy]);b.onmouseup=stopHold;b.ontouchstart=e=>{e.preventDef
