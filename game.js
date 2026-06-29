'use strict';

const TERRAIN = {
  PLAINS: 0,
  FOREST: 1,
  MOUNTAIN: 2,
  WATER: 3
};
const TERRAIN_NAMES = ['Равнина','Лес','Горы','Вода'];
const TERRAIN_CONFIG = {
  0:{ income:1, baseCost:2, label:'P' },
  1:{ income:2, baseCost:3, label:'F' },
  2:{ income:3, baseCost:4, label:'M' },
  3:{ income:0, baseCost:Infinity, label:'~' },
};
const TERRAIN_FALLBACK = ['#4a7c3f','#1e4d1a','#6b5b45','#1a3a6b'];
function getTerrainColor(t){
  if (typeof getComputedStyle==='undefined') return TERRAIN_FALLBACK[t];
  return getComputedStyle(document.body).getPropertyValue(
    ['--col-plains','--col-forest','--col-mountain','--col-water'][t]).trim() || TERRAIN_FALLBACK[t];
}
function getPlayerColor(p){
  const fb = PLAYER_COLORS[p];
  if (typeof getComputedStyle==='undefined') return fb;
  const v = getComputedStyle(document.body).getPropertyValue('--border-' + p).trim();
  return { ...fb, border: v || fb.border, dot: v || fb.dot };
}
const TINT_ALPHA = 0.55;

const EVENTS = {
  FROST:    { name:'❄️ Заморозки',          terrain:1, delta:-99, duration:3,
              desc:'Леса замерзают.', tint:[120,200,255], cssClass:'frost' },
  HARVEST:  { name:'🌾 Урожайный год',      terrain:0, delta:+2,  duration:2,
              desc:'Равнины дают двойной урожай.', tint:[120,220,100], cssClass:'harvest' },
  DROUGHT:  { name:'🏜️ Засуха и голод',     terrain:0, delta:-1,  duration:3,
              desc:'Равнины иссушены.', tint:[200,140,60], cssClass:'drought' },
  GOLD_RUSH:{ name:'⛰️ Золотая лихорадка',  terrain:2, delta:+5,  duration:2,
              desc:'Горы богаты золотом.', tint:[255,215,80], cssClass:'goldrush' },
  ERUPTION: { name:'🌋 Извержение',         terrain:2, delta:-99, duration:4,
              desc:'Гора стала бесплодной.', tint:[200,60,60], cssClass:'eruption', target:'random_one' },
  FLOOD:    { name:'🌊 Наводнение', special:'flood',
              desc:'Клетка затоплена.', tint:[80,130,220], cssClass:'flood' },
  LOCUST:   { name:'🦌 Нашествие саранчи',  terrain:0, delta:-2,  duration:3,
              desc:'Равнины опустошены.', tint:[210,170,40], cssClass:'locust' },
  MAGNETIC: { name:'⚡ Магнитная буря',     allTerrain:true, delta:-1, duration:2,
              desc:'Все типы подавлены помехами.', tint:[140,80,220], cssClass:'magnetic', globalFx:true },
  FEAST:    { name:'🎉 Праздник', special:'feast', globalFx:true,
              desc:'Каждая фракция получает +3 золота!', tint:[255,200,60], cssClass:'feast' },
  PLAGUE:   { name:'🦠 Эпидемия', special:'plague', duration:3,
              desc:'Одна фракция теряет половину дохода.', tint:[180,40,80], cssClass:'plague' },
};
const EVENT_CHANCE = 0.40;

const PLAYER_COLORS = {
  1:{ tint:[0.20,0.30,0.90], border:'#3b82f6', dot:'#3b82f6', name:'Игрок',     logClass:'player' },
  2:{ tint:[0.90,0.20,0.20], border:'#ef4444', dot:'#ef4444', name:'Красные',   logClass:'ai' },
  3:{ tint:[0.65,0.20,0.85], border:'#a855f7', dot:'#a855f7', name:'Фиолетовые',logClass:'ai-3' },
  4:{ tint:[0.95,0.70,0.15], border:'#f59e0b', dot:'#f59e0b', name:'Янтарные',  logClass:'ai-4' }
};
const HEX_DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const settings = { numPlayers:4, mapRadius:13, difficulty:'normal' };
let cells = new Map();
let gold = {1:0,2:0,3:0,4:0};
let turnNumber=1, currentPlayer=1, gameOver=false, capturesThisTurn=0, mapSeed=0;
let hoveredKey=null;
let hexSize=32, offsetX=0, offsetY=0;

function hexKey(q,r){ return q+','+r; }
function hexNeighbors(q,r){ return HEX_DIRS.map(([dq,dr])=>[q+dq,r+dr]); }
function axialToPixel(q,r,size){ return [size*(Math.sqrt(3)*q + Math.sqrt(3)/2*r), size*1.5*r]; }
function cubeRound(qf,rf){
  const sf=-qf-rf; let qi=Math.round(qf),ri=Math.round(rf),si=Math.round(sf);
  const dq=Math.abs(qi-qf), dr=Math.abs(ri-rf), ds=Math.abs(si-sf);
  if (dq>dr&&dq>ds) qi=-ri-si; else if (dr>ds) ri=-qi-si; return [qi,ri];
}
function pixelToAxial(px,py,size){
  const q=(Math.sqrt(3)/3*px - 1/3*py)/size; const r=(2/3*py)/size; return cubeRound(q,r);
}
function hexCorners(cx,cy,size){
  const pts=[]; for (let i=0;i<6;i++){ const a=Math.PI/180*(60*i-30);
    pts.push([cx+size*Math.cos(a), cy+size*Math.sin(a)]); } return pts;
}
function hash2d(x,y,seed){
  let h=(x*374761393 + y*668265263 + seed*1274126177) | 0;
  h=(h^(h>>>13))*1274126177; h=h^(h>>>16); return (h>>>0)/4294967295;
}
function noise2d(x,y,seed){
  const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
  const tl=hash2d(xi,yi,seed), tr=hash2d(xi+1,yi,seed),
        bl=hash2d(xi,yi+1,seed), br=hash2d(xi+1,yi+1,seed);
  const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
  return (tl*(1-u)+tr*u)*(1-v) + (bl*(1-u)+br*u)*v;
}
function fbm(x,y,seed){
  let s=0, amp=0.5, freq=1;
  for (let i=0;i<4;i++){ s+=amp*noise2d(x*freq,y*freq,seed+i*17); amp*=0.5; freq*=2; }
  return s;
}
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hexToRgb(hex){ const n=parseInt(hex.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function lerp(a,b,t){ return a+(b-a)*t; }
function tintColor(baseHex,tint,alpha){
  const [r,g,b]=hexToRgb(baseHex), [tr,tg,tb]=tint;
  return `rgb(${Math.round(lerp(r/255,tr,alpha)*255)},${Math.round(lerp(g/255,tg,alpha)*255)},${Math.round(lerp(b/255,tb,alpha)*255)})`;
}
function getCellsByOwner(o){ return [...cells.values()].filter(c=>c.owner===o); }
function captureCost(cell, attacker){
  if (cell.terrain===TERRAIN.WATER) return Infinity;
  const base=TERRAIN_CONFIG[cell.terrain].baseCost;
  return cell.owner===0 ? base : base*2;
}
function hasAdjacentOwned(q,r,o){
  return hexNeighbors(q,r).some(([nq,nr])=>{
    const c=cells.get(hexKey(nq,nr)); return c && c.owner===o;
  });
}

function maxCaptures(o){
  let base;
  if      (turnNumber < 25) base = 3 + Math.floor(getCellsByOwner(o).length / 3);
  else if (turnNumber < 55) base = 12;
  else if (turnNumber < 85) base = 16;
  else                     base = 20;                              // потолок, больше не растёт
  if (o > 1){
    if (settings.difficulty === 'easy') base = Math.max(2, base - 1);
    if (settings.difficulty === 'hard') base = Math.min(20, base + 2);
  }
  return Math.min(20, base);                                     // хард-cap 20
}
function isHumanTurn(){ return !gameOver && currentPlayer===1; }
function playerDisplayName(){ return (window.profileData && window.profileData.playerName) || 'Игрок'; }

function getEffectiveIncome(cell){
  if (cell.terrain===TERRAIN.WATER) return 0;
  let base = TERRAIN_CONFIG[cell.terrain].income;
  for (const m of cell.modifiers){
    const ev = EVENTS[m.key];
    if (!ev) continue;
    if (m.key === 'PLAGUE' && cell.owner === m.affectedFaction){
      base = Math.floor(base / 2);
      continue;
    }
    if (ev.allTerrain) base += ev.delta;
    else if (ev.terrain === cell.terrain) base += ev.delta;
  }
  return Math.max(0, base);
}
function accumulateIncome(o){ let s=0; for (const c of getCellsByOwner(o)) s+=getEffectiveIncome(c); return s; }

function buildMap(){
  cells.clear();
  const R=settings.mapRadius, seed=mapSeed;
  let raw = new Map();
  for (let q=-R; q<=R; q++){
    const r1=Math.max(-R, -q-R), r2=Math.min(R, -q+R);
    for (let r=r1; r<=r2; r++){
      const elev=fbm(q*0.09, r*0.09, seed);
      const moist=fbm(q*0.09+50, r*0.09+50, seed+9);
      const fire=fbm(q*0.07+100, r*0.07+100, seed+21);
      let t=0;
      if (elev<0.30) t=3;
      else if (elev>0.62 && fire>0.50) t=2;
      else if (moist>0.55 && elev<0.70) t=1;
      raw.set(hexKey(q,r), t);
    }
  }
  const rngC = mulberry32(seed+7777);
  const seedCount = Math.max(3, Math.floor(R/3));
  const biomeSeeds = [];
  for (let i=0;i<seedCount;i++){
    biomeSeeds.push({
      q: Math.floor((rngC()*2-1)*R*0.85),
      r: Math.floor((rngC()*2-1)*R*0.85),
      type: [1,1,2,3][Math.floor(rngC()*4)]
    });
  }
  for (const [key] of raw){
    const [q,r] = key.split(',').map(Number);
    let bestDist = Infinity, bestType = raw.get(key);
    for (const s of biomeSeeds){
      const d = Math.hypot(s.q-q, s.r-r);
      if (d < bestDist){ bestDist=d; bestType=s.type; }
    }
    const influence = Math.max(0, 1 - bestDist/(R*0.4));
    if (Math.random() < influence*0.6) raw.set(key, bestType);
  }
  for (let pass=0; pass<2; pass++){
    const newRaw = new Map(raw);
    for (let q=-R; q<=R; q++){
      const r1=Math.max(-R, -q-R), r2=Math.min(R, -q+R);
      for (let r=r1; r<=r2; r++){
        const key=hexKey(q,r);
        const counts=[0,0,0,0];
        for (const [nq,nr] of hexNeighbors(q,r)){
          const nk=hexKey(nq,nr); if (raw.has(nk)) counts[raw.get(nk)]++;
        }
        const maxCount=Math.max(...counts);
        if (maxCount>=4){ const dom=counts.indexOf(maxCount); newRaw.set(key, dom); }
      }
    }
    raw=newRaw;
  }
  for (const [key, t] of raw){
    const [q,r] = key.split(',').map(Number);
    cells.set(key, { q, r, terrain:t, owner:0, modifiers:[] });
  }
  const startPositions = settings.numPlayers===2
    ? [[-R+3,0],[R-3,0]]
    : [[-R+3,0],[R-3,0],[0,-R+3],[0,R-3]];
  startPositions.forEach(([q,r],idx)=>{
    const c=cells.get(hexKey(q,r)); if (c) c.owner=idx+1;
  });
}

function showEventBanner(name, desc, cls){
  const b = document.getElementById('event-banner');
  if (!b) return;
  b.className = 'event-banner ' + cls;
  b.innerHTML = `${name}<div class="eb-sub">${desc}</div>`;
  void b.offsetWidth;
  b.classList.add('active');
  setTimeout(() => b.classList.remove('active'), 3200);
}
function triggerRandomEvent(){
  if (Math.random()>EVENT_CHANCE) return null;
  const keys=Object.keys(EVENTS);
  triggerEvent(keys[Math.floor(Math.random()*keys.length)]);
}
function triggerEvent(key){
  const ev=EVENTS[key];
  showEventBanner(ev.name, ev.desc, ev.cssClass);
  addLog(`⚡ ${ev.name}! ${ev.desc}`,'system');

  if (ev.special === 'feast'){
    for (let p=1; p<=settings.numPlayers; p++){
      if (getCellsByOwner(p).length>0) gold[p] = (gold[p]||0) + 3;
    }
    addLog('🍻 Каждая фракция получает +3 золота!','system');
    return;
  }
  if (ev.special === 'flood'){
    const cands=[...cells.values()].filter(c=>{
      if (c.terrain===TERRAIN.WATER) return false;
      return hexNeighbors(c.q,c.r).some(([nq,nr])=>{
        const n=cells.get(hexKey(nq,nr));
        return n && n.terrain===TERRAIN.WATER;
      });
    });
    if (!cands.length){ addLog('Но наводнению некуда распространиться.','system'); return; }
    const t=cands[Math.floor(Math.random()*cands.length)];
    const prevOwner=t.owner;
    t.terrain=TERRAIN.WATER; t.owner=0; t.modifiers=[];
    if (prevOwner>0) addLog(`Клетка (${t.q},${t.r}) фракции ${PLAYER_COLORS[prevOwner].name} затоплена!`, PLAYER_COLORS[prevOwner].logClass);
    else addLog(`Нейтральная клетка (${t.q},${t.r}) превратилась в воду.`,'system');
    return;
  }
  if (ev.special === 'plague'){
    const alive=[];
    for (let p=1; p<=settings.numPlayers; p++) if (getCellsByOwner(p).length>0) alive.push(p);
    if (!alive.length){ addLog('Эпидемии некого поражать.','system'); return; }
    const victim=alive[Math.floor(Math.random()*alive.length)];
    for (const cell of cells.values()){
      if (cell.owner===victim){
        cell.modifiers = cell.modifiers.filter(m=>m.key!=='PLAGUE');
        cell.modifiers.push({ key:'PLAGUE', remaining:ev.duration, affectedFaction:victim });
      }
    }
    addLog(`🦠 Фракция «${PLAYER_COLORS[victim].name}» поражена! Их доход уменьшен вдвое на ${ev.duration} раунда.`, PLAYER_COLORS[victim].logClass);
    return;
  }

  let targets;
  if (ev.allTerrain){
    targets = [...cells.values()].filter(c => c.terrain !== TERRAIN.WATER);
  } else if (ev.target === 'random_one'){
    const cands = [...cells.values()].filter(c => c.terrain === ev.terrain);
    if (!cands.length){ addLog('Но подходящих клеток не нашлось.','system'); return; }
    targets = [cands[Math.floor(Math.random()*cands.length)]];
  } else {
    targets = [...cells.values()].filter(c => c.terrain === ev.terrain);
  }
  if (!targets.length){ addLog('Но подходящих клеток не нашлось.','system'); return; }

  for (const t of targets){
    t.modifiers = t.modifiers.filter(m=>m.key!==key);
    t.modifiers.push({ key, remaining:ev.duration });
  }
  if (ev.target === 'random_one' && targets[0].owner>0){
    addLog(`Затронута (${targets[0].q},${targets[0].r}) фракции ${PLAYER_COLORS[targets[0].owner].name}.`, PLAYER_COLORS[targets[0].owner].logClass);
  }
}
function tickModifiers(){
  for (const cell of cells.values()){
    cell.modifiers = cell.modifiers.filter(m=>{ m.remaining--; return m.remaining>0; });
  }
}
function activeEventPills(){
  const map=new Map();
  for (const cell of cells.values()){
    for (const m of cell.modifiers){
      if (m.remaining<=0) continue;
      const cur=map.get(m.key);
      if (!cur || cur.remaining<m.remaining) map.set(m.key,{remaining:m.remaining,cells:0});
      map.get(m.key).cells++;
    }
  }
  return [...map.entries()].map(([key,info])=>({key,...info}));
}
function activeGlobalFx(){
  for (const cell of cells.values()){
    for (const m of cell.modifiers){
      const ev = EVENTS[m.key];
      if (ev && ev.globalFx) return ev;
    }
  }
  return null;
}

function aiTakeTurn(owner){
  if (gameOver) return;
  const limit=maxCaptures(owner);
  let actions=0;
  const pc=settings.numPlayers;
  while (actions<limit){
    const myCells=getCellsByOwner(owner);
    const cands=new Set();
    for (const cell of myCells){
      for (const [nq,nr] of hexNeighbors(cell.q,cell.r)){
        const n=cells.get(hexKey(nq,nr));
        if (n && n.terrain!==TERRAIN.WATER && n.owner!==owner) cands.add(hexKey(nq,nr));
      }
    }
    let best=null, bestScore=-Infinity;
    for (const key of cands){
      const t=cells.get(key);
      const cost=captureCost(t, owner);
      if (cost>gold[owner]) continue;
      const inc=getEffectiveIncome(t);
      let score = inc*10 - cost;
      if (t.owner===0) score += 5;
      if (t.owner>0){
        score += (getCellsByOwner(t.owner).length < getCellsByOwner(owner).length ? 3 : -4);
        score -= cost*0.4;
      }
      for (let p=1;p<=pc;p++){
        if (p!==owner && hasAdjacentOwned(t.q,t.r,p)) score += 2;
      }
      if (score>bestScore){ bestScore=score; best=t; }
    }
    if (!best) break;
    const cost=captureCost(best, owner);
    gold[owner]-=cost; best.owner=owner; actions++;
    const who=PLAYER_COLORS[owner];
    addLog(`${who.name} захватили ${TERRAIN_NAMES[best.terrain]} (${best.q},${best.r}) за ${cost}g`, who.logClass);
  }
  if (actions===0){
    const who=PLAYER_COLORS[owner];
    addLog(`${who.name} пропустили ход.`, who.logClass);
  }
}

function initGame(){
  gold={1:12,2:12,3:12,4:12};
  turnNumber=1; currentPlayer=1; gameOver=false;
  hoveredKey=null; capturesThisTurn=0;
  mapSeed=Math.floor(Math.random()*1e9);
  buildMap();
  clearLog();
  const pname=playerDisplayName();
  addLog(`Игра началась! ${pname} против ${settings.numPlayers-1} фракций на карте ${[...cells.values()].length} клеток.`,'system');
  document.getElementById('overlay').classList.remove('active');
  document.getElementById('start-menu').classList.remove('active');
  fitMapToCanvas();
  updateUI(); drawGrid();
}
function onEndTurn(){
  if (gameOver || currentPlayer!==1) return;
  tickModifiers();
  const inc=accumulateIncome(1); gold[1]+=inc;
  addLog(`Ваш доход: +${inc} золота.`,'system');
  triggerRandomEvent();
  updateUI(); drawGrid();
  advance();
}
function advance(){
  if (gameOver) return;
  let next=currentPlayer+1;
  if (next>settings.numPlayers) next=1;
  let safety=0;
  while (getCellsByOwner(next).length===0 && safety<8){
    next=next+1>settings.numPlayers?1:next+1; safety++;
  }
  currentPlayer=next; capturesThisTurn=0;
  updateUI(); drawGrid();
  if (currentPlayer===1) return;
  setTimeout(()=>{
    if (gameOver) return;
    const inc=accumulateIncome(currentPlayer); gold[currentPlayer]+=inc;
    aiTakeTurn(currentPlayer);
    advance();
  }, 700);
}
function checkWin(){
  const alive=[];
  for (let p=1;p<=settings.numPlayers;p++) if (getCellsByOwner(p).length>0) alive.push(p);
  if (alive.length===1){ endGame(alive[0]===1?'win':'lose', alive[0]); return; }
  if (alive.length===0){ endGame('draw', 0); }
}
function endGame(kind, winnerOwner){
  gameOver=true;
  const ot=document.getElementById('overlay-title');
  const os=document.getElementById('overlay-sub');
  if (kind==='win'){
    ot.className='overlay-title win'; ot.textContent='🏆 Победа!';
    os.textContent=`${playerDisplayName()} завоевал всю карту за ${turnNumber} раундов.`;
    addLog('ПОБЕДА!','system');
  } else if (kind==='lose'){
    const wn=PLAYER_COLORS[winnerOwner]?.name||'враги';
    ot.className='overlay-title lose'; ot.textContent='💀 Поражение';
    os.textContent=`Победила фракция «${wn}».`;
    addLog(`ПОРАЖЕНИЕ. Победили ${wn}.`,'system');
  } else {
    ot.className='overlay-title draw'; ot.textContent='🤝 Ничья';
    os.textContent='Все фракции уничтожены.';
    addLog('НИЧЬЯ.','system');
  }
  document.getElementById('overlay').classList.add('active');
}

const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
function fitMapToCanvas(){
  const area=document.querySelector('.canvas-area');
  if (!area) return;
  const W=area.clientWidth, H=area.clientHeight;
  canvas.width=W; canvas.height=H;
  if (!cells.size) return;
  const HW = Math.sqrt(3)/2;
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for (const cell of cells.values()){
    const [px,py]=axialToPixel(cell.q,cell.r,1);
    if (px-HW<minX) minX=px-HW;
    if (px+HW>maxX) maxX=px+HW;
    if (py-1<minY)  minY=py-1;
    if (py+1>maxY)  maxY=py+1;
  }
  const mapW=maxX-minX, mapH=maxY-minY;
  hexSize = Math.min(W/mapW, H/mapH) * 0.95;
  const cX=(minX+maxX)/2, cY=(minY+maxY)/2;
  offsetX = W/2 - cX*hexSize;
  offsetY = H/2 - cY*hexSize;
}
function drawHex(q,r,fill,stroke,alpha=1){
  const [px,py]=axialToPixel(q,r,hexSize);
  const cx=px+offsetX, cy=py+offsetY;
  const pts=hexCorners(cx,cy,hexSize-1.5);
  ctx.save(); ctx.globalAlpha=alpha;
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  for (let i=1;i<6;i++) ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.closePath(); ctx.fillStyle=fill; ctx.fill();
  ctx.strokeStyle=stroke; ctx.lineWidth=1.5; ctx.stroke();
  ctx.restore();
}
function cellColor(cell, highlight=false){
  const base = getTerrainColor(cell.terrain);
  let color;
  if (cell.owner>0) color=tintColor(base, PLAYER_COLORS[cell.owner].tint, TINT_ALPHA);
  else color=base;
  if (highlight){
    const [r,g,b]=hexToRgb(base);
    return `rgb(${Math.min(255,r+40)},${Math.min(255,g+40)},${Math.min(255,b+40)})`;
  }
  return color;
}
function drawEventRing(cx,cy,ev){
  const t = Date.now();
  const pulse = 0.5 + 0.5 * Math.sin(t / 350);
  ctx.save();
  ctx.lineWidth = Math.max(2, hexSize * 0.10);
  let dashPattern = [];
  if (ev.cssClass === 'magnetic')  dashPattern = [hexSize*0.4, hexSize*0.2];
  if (ev.cssClass === 'locust')    dashPattern = [hexSize*0.25, hexSize*0.15, hexSize*0.05, hexSize*0.15];
  if (ev.cssClass === 'plague')    dashPattern = [hexSize*0.35, hexSize*0.1];
  if (ev.cssClass === 'goldrush')  dashPattern = [hexSize*0.15, hexSize*0.1];
  ctx.setLineDash(dashPattern);

  ctx.strokeStyle = `rgba(${ev.tint[0]},${ev.tint[1]},${ev.tint[2]},${0.50 + 0.40*pulse})`;
  ctx.beginPath();
  const pts = hexCorners(cx,cy,hexSize-2);
  ctx.moveTo(pts[0][0],pts[0][1]);
  for (let i=1;i<6;i++) ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.closePath(); ctx.stroke();
  ctx.setLineDash([]);

  if (ev.cssClass === 'frost' || ev.cssClass === 'eruption'){
    ctx.strokeStyle = `rgba(${ev.tint[0]},${ev.tint[1]},${ev.tint[2]},${0.20 + 0.20*pulse})`;
    ctx.lineWidth = Math.max(2, hexSize * 0.05);
    ctx.beginPath();
    const pts2 = hexCorners(cx,cy,hexSize - hexSize*0.5);
    ctx.moveTo(pts2[0][0],pts2[0][1]);
    for (let i=1;i<6;i++) ctx.lineTo(pts2[i][0],pts2[i][1]);
    ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}
function drawGrid(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#0a0e15'; ctx.fillRect(0,0,canvas.width,canvas.height);

  const globalFx = activeGlobalFx();
  if (globalFx){
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 600);
    const a = 0.03 + 0.05 * pulse;
    ctx.fillStyle = `rgba(${globalFx.tint[0]},${globalFx.tint[1]},${globalFx.tint[2]},${a})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const capturables=new Set();
  if (isHumanTurn() && capturesThisTurn<maxCaptures(1)){
    for (const cell of getCellsByOwner(1)){
      for (const [nq,nr] of hexNeighbors(cell.q,cell.r)){
        const n=cells.get(hexKey(nq,nr));
        if (n && n.terrain!==TERRAIN.WATER && n.owner!==1) capturables.add(hexKey(nq,nr));
      }
    }
  }
  for (const [key,cell] of cells){
    const [px,py]=axialToPixel(cell.q,cell.r,hexSize);
    const cx=px+offsetX, cy=py+offsetY;
    const hovered=key===hoveredKey;
    const isCap=capturables.has(key);
    const fill=cellColor(cell, hovered);
    const pc = cell.owner>0 ? getPlayerColor(cell.owner) : null;
    let stroke='#0a0e15';
    if (cell.owner>0) stroke = pc.border;
    if (hovered && isCap) stroke='#fbbf24';
    else if (hovered) stroke='#58a6ff';
    drawHex(cell.q, cell.r, fill, stroke);

    if (cell.modifiers.length){
      const m=cell.modifiers[cell.modifiers.length-1];
      const ev=EVENTS[m.key];
      if (ev && ev.tint) drawEventRing(cx, cy, ev);
    }
    if (isCap && !hovered){
      ctx.save();
      ctx.strokeStyle='rgba(251,191,36,.30)';
      ctx.lineWidth=Math.max(2, hexSize*0.08);
      ctx.beginPath();
      const pts=hexCorners(cx,cy,hexSize-2);
      ctx.moveTo(pts[0][0],pts[0][1]);
      for (let i=1;i<6;i++) ctx.lineTo(pts[i][0],pts[i][1]);
      ctx.closePath(); ctx.stroke();
      ctx.restore();
    }

    const fs=Math.max(8,Math.round(hexSize*.30));
    const fs2=Math.max(7,Math.round(hexSize*.26));
    const fs3=Math.max(6,Math.round(hexSize*.22));
    ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle';
    if (cell.terrain===TERRAIN.WATER){
      ctx.font=`bold ${fs}px Inter, sans-serif`;
      ctx.fillStyle='rgba(255,255,255,.55)';
      ctx.fillText('~', cx, cy);
    } else {
      const label=TERRAIN_CONFIG[cell.terrain].label;
      const cost=captureCost(cell, 1);
      ctx.font=`bold ${fs}px Inter, sans-serif`;
      ctx.fillStyle='rgba(255,255,255,.6)';
      ctx.fillText(label, cx, cy-hexSize*.14);
      if (cost!==Infinity){
        ctx.font=`${fs2}px Inter, sans-serif`;
        ctx.fillStyle='rgba(255,255,255,.4)';
        ctx.fillText(cost+'g', cx, cy+hexSize*.2);
      }
      const eff=getEffectiveIncome(cell);
      const base=TERRAIN_CONFIG[cell.terrain].income;
      if (cell.owner>0 && eff!==base){
        ctx.font=`${fs3}px Inter, sans-serif`;
        ctx.fillStyle=eff>base?'#fbbf24':'#fca5a5';
        ctx.fillText((eff>base?'+':'')+(eff-base), cx+hexSize*.32, cy-hexSize*.32);
      }
      if (cell.modifiers.length){
        const m=cell.modifiers[cell.modifiers.length-1];
        const ev=EVENTS[m.key];
        if (ev){
          ctx.font = `${Math.max(8,Math.round(hexSize*0.26))}px sans-serif`;
          ctx.fillStyle = `rgba(${ev.tint[0]},${ev.tint[1]},${ev.tint[2]},0.85)`;
          ctx.textAlign = 'right';
          ctx.fillText(`${m.remaining}`, cx + hexSize*0.32, cy - hexSize*0.05);
          ctx.textAlign = 'center';
        }
      }
    }
    if (cell.owner>0){
      ctx.beginPath();
      ctx.arc(cx-hexSize*.35, cy-hexSize*.35, hexSize*.12, 0, Math.PI*2);
      ctx.fillStyle = pc.dot; ctx.fill();
    }
    ctx.restore();
  }
}
function getCellAt(px,py){
  const x=px-offsetX, y=py-offsetY;
  const q=(Math.sqrt(3)/3*x - 1/3*y)/hexSize;
  const r=(2/3*y)/hexSize;
  const [qi,ri]=cubeRound(q,r);
  return cells.get(hexKey(qi,ri)) || null;
}

canvas.addEventListener('mousemove', e=>{
  const rect=canvas.getBoundingClientRect();
  const cell=getCellAt(e.clientX-rect.left, e.clientY-rect.top);
  const key=cell ? hexKey(cell.q,cell.r) : null;
  if (key!==hoveredKey){ hoveredKey=key; drawGrid(); }
  if (cell){ showTooltip(e.clientX, e.clientY, cell); updateCellInfo(cell); }
  else hideTooltip();
});
canvas.addEventListener('mouseleave', ()=>{ hoveredKey=null; drawGrid(); hideTooltip(); });
canvas.addEventListener('click', e=>{
  if (gameOver || !isHumanTurn()) return;
  const rect=canvas.getBoundingClientRect();
  const cell=getCellAt(e.clientX-rect.left, e.clientY-rect.top);
  if (!cell) return;
  if (cell.terrain===TERRAIN.WATER){ addLog('Нельзя захватить воду!','error'); return; }
  if (cell.owner===1){ addLog('Клетка уже ваша.','error'); return; }
  if (!hasAdjacentOwned(cell.q,cell.r,1)){ addLog('Нужно захватывать смежные клетки.','error'); return; }
  const limit=maxCaptures(1);
  if (capturesThisTurn>=limit){ addLog(`Лимит захватов ${limit} — сначала завершите ход.`,'error'); return; }
  const cost=captureCost(cell,1);
  if (gold[1]<cost){ addLog(`Недостаточно золота.`,'error'); return; }
  gold[1]-=cost; cell.owner=1; capturesThisTurn++;
  addLog(`Захвачено: ${TERRAIN_NAMES[cell.terrain]} (${cell.q},${cell.r}) за ${cost}g`,'player');
  checkWin(); updateUI(); drawGrid();
});

function updateUI(){
  document.getElementById('turn-num').textContent=turnNumber;
  document.getElementById('player-gold').textContent=gold[1];
  document.getElementById('player-income').textContent='+'+accumulateIncome(1)+'/ход';
  const lim=maxCaptures(1);
  const cl=document.getElementById('captures-info');
  cl.textContent=`${capturesThisTurn}/${lim}`;
  cl.style.color=capturesThisTurn>=lim?'#f85149':'var(--gold)';
  const list=document.getElementById('factions-list');
  list.innerHTML='';
  const pname=playerDisplayName();
  for (let p=1;p<=settings.numPlayers;p++){
    const cs=getCellsByOwner(p).length;
    const row=document.createElement('div');
    row.className='faction-row'+(p===currentPlayer?' active':'');
    row.dataset.owner=p;
    const pc=getPlayerColor(p);
    const label = p===1 ? `${pname} (Вы)` : PLAYER_COLORS[p].name;
    row.innerHTML=`<span class="dot" style="width:11px;height:11px;border-radius:50%;background:${pc.dot}"></span><span class="name">${label}</span><span class="cells">${cs}</span>`;
    list.appendChild(row);
  }
  const nc=getCellsByOwner(0).length;
  const nRow=document.createElement('div');
  nRow.className='faction-row'; nRow.dataset.owner='0';
  nRow.innerHTML=`<span class="dot" style="width:11px;height:11px;border-radius:50%;background:var(--muted)"></span><span class="name" style="color:var(--muted)">Нейтрал</span><span class="cells" style="color:var(--muted)">${nc}</span>`;
  list.appendChild(nRow);
  const pill=document.getElementById('turn-pill');
  pill.dataset.owner=currentPlayer;
  document.getElementById('turn-pill-text').textContent=currentPlayer===1?`Ход: ${pname}`:`Ход: ${PLAYER_COLORS[currentPlayer].name} (ИИ)`;
  document.getElementById('end-turn-btn').disabled=!isHumanTurn();
  const evDiv=document.getElementById('active-events');
  const pills=activeEventPills();
  if (!pills.length){ evDiv.innerHTML='<div class="muted-italic">Нет активных событий</div>'; }
  else { evDiv.innerHTML=pills.map(p=>{
    const ev=EVENTS[p.key]; const t=p.remaining;
    return `<div class="event-pill ${ev.cssClass}"><span>${ev.name}</span><span class="event-time">${p.cells} кл · ${t} х${t===1?'':'од'}</span></div>`;
  }).join(''); }
  const hint=document.getElementById('hint-bar');
  if (gameOver){ hint.style.display='none'; }
  else if (!isHumanTurn()){ hint.textContent=`ИИ ${PLAYER_COLORS[currentPlayer].name} думает...`; hint.style.color=''; }
  else {
    let cheap=Infinity;
    if (capturesThisTurn<lim){
      for (const cell of getCellsByOwner(1)){
        for (const [nq,nr] of hexNeighbors(cell.q,cell.r)){
          const n=cells.get(hexKey(nq,nr));
          if (n && n.terrain!==TERRAIN.WATER && n.owner!==1){
            const c=captureCost(n,1); if (c<cheap) cheap=c;
          }
        }
      }
    }
    const stage = turnNumber < 25  ? '' :
                  turnNumber < 55  ? ' · лимит 12' :
                  turnNumber < 85  ? ' · лимит 16' :
                                      ' · лимит 20';
    if (capturesThisTurn>=lim){
      hint.textContent=`Лимит ${lim}${stage} — завершите ход`; hint.style.color='#f85149';
    } else if (cheap<Infinity){
      hint.textContent=`Мин. стоимость: ${cheap}g | Золото: ${gold[1]}g | Осталось: ${lim-capturesThisTurn}/${lim}${stage}`;
      hint.style.color='';
    } else {
      hint.textContent='Нет доступных клеток.'; hint.style.color='';
    }
  }
}
function updateCellInfo(cell){
  const panel=document.getElementById('cell-info');
  const cfg=TERRAIN_CONFIG[cell.terrain];
  const cost=captureCost(cell,1);
  const ownerName=cell.owner>0?PLAYER_COLORS[cell.owner].name:'Нейтрал';
  const ownerColor=cell.owner>0?getPlayerColor(cell.owner).border:'var(--muted)';
  const adj=hasAdjacentOwned(cell.q,cell.r,1);
  const lim=maxCaptures(1);
  const limOk=capturesThisTurn<lim;
  const eff=getEffectiveIncome(cell), base=cfg.income;
  const modLines=[];
  for (const m of cell.modifiers){
    const ev=EVENTS[m.key]; if (!ev) continue;
    const tint = `rgb(${ev.tint[0]},${ev.tint[1]},${ev.tint[2]})`;
    if (m.key === 'PLAGUE'){
      modLines.push(`<div class="info-row"><span>🦠 Эпидемия</span><span class="info-val" style="color:${tint}">доход ÷ 2 (${m.remaining}х)</span></div>`);
    } else {
      modLines.push(`<div class="info-row"><span>${ev.name}</span><span class="info-val" style="color:${tint}">${ev.delta>=0?'+':''}${ev.delta} (${m.remaining}х)</span></div>`);
    }
  }
  const effNote = eff!==base ? `<div class="info-row"><span>Эффект</span><span class="info-val" style="color:${eff>base?'#fbbf24':'#fca5a5'}">+${eff}/ход</span></div>` : '';
  panel.innerHTML=`
    <strong>${TERRAIN_NAMES[cell.terrain]}</strong>
    <div class="info-row"><span>Коорд.</span><span class="info-val">(${cell.q}, ${cell.r})</span></div>
    <div class="info-row"><span>Владелец</span><span class="info-val" style="color:${ownerColor}">${ownerName}</span></div>
    <div class="info-row"><span>Доход</span><span class="info-val">+${eff}/ход</span></div>
    ${effNote}
    ${modLines.join('')}
    ${cell.terrain!==TERRAIN.WATER ? `<div class="info-row"><span>Захват</span><span class="info-val">${cost}g</span></div>` : ''}
    ${cell.owner!==1 && cell.terrain!==TERRAIN.WATER ? `<div class="info-row"><span>Смежная</span><span class="info-val" style="color:${adj?'#4ade80':'#f85149'}">${adj?'✓ Да':'✗ Нет'}</span></div>` : ''}
    ${cell.owner!==1 && cell.terrain!==TERRAIN.WATER && adj && gold[1]>=cost && limOk && isHumanTurn() ? '<div style="margin-top:8px;font-size:.72rem;color:#fbbf24">Нажмите для захвата</div>' : ''}
    ${cell.owner!==1 && cell.terrain!==TERRAIN.WATER && adj && !limOk ? '<div style="margin-top:8px;font-size:.72rem;color:#f85149">Лимит захватов!</div>' : ''}
  `;
}
function showTooltip(mx,my,cell){
  const tt=document.getElementById('tooltip');
  const cost=captureCost(cell,1), eff=getEffectiveIncome(cell);
  document.getElementById('tt-title').textContent=TERRAIN_NAMES[cell.terrain];
  document.getElementById('tt-terrain').textContent=TERRAIN_NAMES[cell.terrain];
  document.getElementById('tt-owner').textContent=cell.owner>0?PLAYER_COLORS[cell.owner].name:'Нейтрал';
  document.getElementById('tt-income').textContent='+'+eff+'g/ход';
  document.getElementById('tt-cost').textContent=cost===Infinity?'Нельзя':cost+'g';
  const pad=14;
  let left=mx+pad, top=my+pad;
  if (left+170>window.innerWidth) left=mx-170-pad;
  if (top+120>window.innerHeight) top=my-120-pad;
  tt.style.left=left+'px'; tt.style.top=top+'px'; tt.style.display='block';
}
function hideTooltip(){
  document.getElementById('tooltip').style.display='none';
  document.getElementById('cell-info').innerHTML='<em class="muted-italic">Наведите на клетку для информации</em>';
}
function addLog(msg,type=''){
  const list=document.getElementById('log-list');
  const div=document.createElement('div');
  div.className='log-entry '+type;
  div.textContent=msg;
  list.prepend(div);
  while (list.children.length>100) list.removeChild(list.lastChild);
}
function clearLog(){ document.getElementById('log-list').innerHTML=''; }

function setupStartMenu(){
  document.querySelectorAll('.seg-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      const group=b.parentElement;
      group.querySelectorAll('.seg-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      if (b.dataset.players) settings.numPlayers=parseInt(b.dataset.players);
      if (b.dataset.size)    settings.mapRadius=parseInt(b.dataset.size);
      if (b.dataset.diff)   settings.difficulty=b.dataset.diff;
    });
  });
  document.getElementById('start-btn').addEventListener('click', initGame);
}
function showStartMenu(){
  document.getElementById('start-menu').classList.add('active');
  document.getElementById('overlay').classList.remove('active');
}

document.getElementById('end-turn-btn').addEventListener('click', onEndTurn);
document.getElementById('restart-btn').addEventListener('click', showStartMenu);
document.getElementById('overlay-restart').addEventListener('click', showStartMenu);
window.addEventListener('resize', fitMapToCanvas);

setupStartMenu();
showStartMenu();

function rafLoop(){
  if (!gameOver && cells.size>0) drawGrid();
  requestAnimationFrame(rafLoop);
}
requestAnimationFrame(rafLoop);
