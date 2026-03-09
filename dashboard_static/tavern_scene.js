/* ═══════════════════════════════════════════════════════
   Tavern Scene v1 — Pixel Art RPG Style
   8 agents gathered around a tavern table
   ═══════════════════════════════════════════════════════ */
const TAVERN = (() => {
const VW = 180, VH = 115;
let PS, frame = 0;

function px(c, x, y, w, h, col) {
  if (!col) return;
  c.fillStyle = col;
  c.fillRect(x * PS, y * PS, Math.ceil(w * PS), Math.ceil(h * PS));
}
function shade(hex, a) {
  let s = (hex||'#888').replace('#','');
  if (s.length===3) s=s[0]+s[0]+s[1]+s[1]+s[2]+s[2];
  const n=parseInt(s,16);
  return `rgb(${Math.min(255,Math.max(0,(n>>16)+a))},${Math.min(255,Math.max(0,((n>>8)&255)+a))},${Math.min(255,Math.max(0,(n&255)+a))})`;
}

const K='#201810';
const WOOD=['#dbb870','#c49858','#a07840','#7c5c30','#5c4018'];
const STONE=['#908478','#786c60','#605448','#484038','#383028'];
const FLOOR_C=['#8c7458','#7a6448','#6c5840','#5c4c38'];

const WALL_B=30, TABLE_T=50, TABLE_B=60, TBL_L=20, TBL_R=160;
const FAR_HEAD=33, NEAR_HEAD=62;
const SEAT_X=[36,64,100,128];

/* ═══ FLOOR ═══ */
function drawFloor(c) {
  for (let y=WALL_B; y<VH; y+=4) {
    const ci=((y/4)|0)%FLOOR_C.length;
    const fc=FLOOR_C[ci];
    px(c,0,y,VW,4,fc);
    px(c,0,y,VW,1,shade(fc,12));
    px(c,0,y+3,VW,1,shade(fc,-12));
    const off=((y/4)|0)%2===0?0:15;
    for (let x=off;x<VW;x+=30) px(c,x,y,1,4,shade(fc,-20));
  }
  // debris
  for (const [dx,dy,dc] of [[28,95,'#4a6830'],[145,100,'#4a6830'],[85,105,'#5a5040'],[60,108,'#4a6830']]) {
    px(c,dx,dy,2,1,dc); px(c,dx+1,dy+1,1,1,shade(dc,-10));
  }
}

/* ═══ WALL ═══ */
function drawWall(c) {
  for (let y=0;y<WALL_B;y+=5) {
    const ro=((y/5)|0)%2===0?0:5;
    for (let x=-5;x<VW+5;x+=10) {
      const bx=x+ro, ci=((bx*3+y*7)>>3)%3;
      const sc=STONE[ci];
      px(c,bx,y,10,5,sc);
      px(c,bx,y,10,1,shade(sc,10));
      px(c,bx+9,y,1,5,shade(sc,-15));
      px(c,bx,y+4,10,1,shade(sc,-15));
    }
    px(c,0,y+4,VW,1,STONE[4]);
  }
  px(c,0,WALL_B-2,VW,2,WOOD[3]);
  px(c,0,WALL_B-2,VW,1,WOOD[2]);
}

/* ═══ SHELF + BOTTLES ═══ */
function drawShelf(c) {
  // Lower shelf
  const sy=18;
  px(c,15,sy,150,2,WOOD[2]); px(c,15,sy,150,1,WOOD[1]); px(c,15,sy+2,150,1,WOOD[3]);
  for (const bx of [25,75,125,155]) { px(c,bx,sy+2,2,4,WOOD[3]); px(c,bx,sy+2,1,4,WOOD[2]); }
  const bottles=[
    [20,7,3,'#22aa44'],[26,5,2,'#4466cc'],[32,8,3,'#aa2244'],[38,6,2,'#cc8822'],
    [44,7,3,'#22aa44'],[52,5,2,'#8844aa'],[58,7,3,'#cc8822'],[66,6,2,'#4466cc'],
    [110,8,3,'#aa2244'],[116,6,2,'#22aa44'],[122,7,3,'#cc8822'],[128,5,2,'#4466cc'],
    [134,7,3,'#8844aa'],[140,6,2,'#22aa44'],[148,8,3,'#aa2244'],
  ];
  for (const [bx,bh,bw,bc] of bottles) {
    px(c,bx,sy-bh,bw,bh,bc);
    px(c,bx,sy-bh,bw,1,shade(bc,25));
    px(c,bx+bw-1,sy-bh,1,bh,shade(bc,-20));
    px(c,bx,sy-bh-1,bw,1,'#886622');
    px(c,bx,sy-bh+1,1,Math.max(1,bh-2),shade(bc,40));
  }
  // Upper shelf
  px(c,20,9,130,2,WOOD[2]); px(c,20,9,130,1,WOOD[1]);
  for (const [jx,jc] of [[24,'#cc6622'],[32,'#cc8844'],[40,'#88aa44'],[120,'#cc6622'],[130,'#88aa44'],[140,'#cc8844']]) {
    px(c,jx,4,4,5,jc); px(c,jx,4,4,1,shade(jc,20)); px(c,jx,3,4,1,WOOD[2]); px(c,jx+3,4,1,5,shade(jc,-15));
  }
}

/* ═══ LANTERN ═══ */
function drawLantern(c,lx,ly) {
  px(c,lx+1,ly,2,3,STONE[2]); px(c,lx,ly+3,4,1,'#666'); px(c,lx+1,ly+4,1,3,'#888');
  const by=ly+7;
  px(c,lx-1,by,6,1,'#888'); px(c,lx-1,by+1,1,5,'#887766'); px(c,lx+4,by+1,1,5,'#776655');
  px(c,lx-1,by+6,6,1,'#888');
  const fi=Math.sin(frame*0.2+lx)*8;
  px(c,lx,by+1,4,5,'#442200');
  px(c,lx+1,by+2,2,3,shade('#ff8800',Math.round(fi)));
  px(c,lx+1,by+1,2,1,shade('#ffcc44',Math.round(fi)));
  c.fillStyle=`rgba(255,180,60,${0.04+Math.sin(frame*0.2+lx)*0.015})`;
  c.fillRect((lx-8)*PS,(by-5)*PS,20*PS,18*PS);
}

/* ═══ FIREPLACE ═══ */
function drawFireplace(c) {
  const fx=164,fy=WALL_B-16;
  px(c,fx,fy,14,16,STONE[2]); px(c,fx+1,fy+1,12,14,STONE[3]);
  px(c,fx+2,fy+4,10,11,'#1a1008');
  const fi=Math.sin(frame*0.18+5)*10;
  px(c,fx+3,fy+8,8,7,shade('#cc4400',Math.round(fi)));
  px(c,fx+4,fy+6,6,4,shade('#ff8800',Math.round(fi)));
  px(c,fx+5,fy+5,4,2,shade('#ffcc44',Math.round(fi)));
  c.fillStyle=`rgba(255,120,40,${0.03+Math.sin(frame*0.18+5)*0.01})`;
  c.fillRect((fx-10)*PS,(fy-5)*PS,32*PS,25*PS);
  px(c,fx-1,fy-1,16,2,STONE[1]); px(c,fx-1,fy-1,16,1,shade(STONE[1],10));
}

/* ═══ BARREL ═══ */
function drawBarrel(c,bx,by) {
  px(c,bx,by,10,14,WOOD[2]);
  px(c,bx,by,10,1,WOOD[1]); px(c,bx+9,by,1,14,WOOD[3]); px(c,bx,by+13,10,1,WOOD[3]);
  px(c,bx,by+2,10,1,'#888'); px(c,bx,by+7,10,1,'#888'); px(c,bx,by+11,10,1,'#888');
  px(c,bx+1,by-2,8,2,WOOD[1]); px(c,bx+2,by-3,6,1,shade(WOOD[1],10));
  for (let i=2;i<8;i+=3) px(c,bx+i,by,1,14,shade(WOOD[2],-8));
}

/* ═══ COUNTER ═══ */
function drawCounter(c) {
  px(c,10,28,160,3,WOOD[2]); px(c,10,28,160,1,WOOD[1]); px(c,10,30,160,1,WOOD[3]);
  px(c,10,31,160,2,WOOD[3]); px(c,10,31,160,1,WOOD[2]);
}

/* ═══ TABLE ═══ */
function drawTable(c) {
  px(c,TBL_L,TABLE_T,TBL_R-TBL_L,TABLE_B-TABLE_T,WOOD[1]);
  px(c,TBL_L,TABLE_T,TBL_R-TBL_L,1,WOOD[0]);
  px(c,TBL_R-1,TABLE_T,1,TABLE_B-TABLE_T,WOOD[2]);
  for (let x=TBL_L+8;x<TBL_R;x+=14) px(c,x,TABLE_T+1,1,TABLE_B-TABLE_T-2,shade(WOOD[1],-6));
  px(c,TBL_L,TABLE_B,TBL_R-TBL_L,4,WOOD[2]);
  px(c,TBL_L,TABLE_B,TBL_R-TBL_L,1,WOOD[1]);
  px(c,TBL_L,TABLE_B+3,TBL_R-TBL_L,1,WOOD[3]);
  for (const lx of [TBL_L+3,TBL_R-5]) { px(c,lx,TABLE_B+4,3,10,WOOD[3]); px(c,lx,TABLE_B+4,3,1,WOOD[2]); }
}

function drawTableItems(c) {
  // Map center
  px(c,78,TABLE_T+2,16,6,'#e8dcc8'); px(c,78,TABLE_T+2,16,1,'#d8ccb8');
  px(c,80,TABLE_T+3,6,1,'#8888aa'); px(c,80,TABLE_T+5,8,1,'#888888');
  px(c,81,TABLE_T+6,4,1,'#aa6644');
  px(c,95,TABLE_T+3,1,5,'#553322'); px(c,95,TABLE_T+2,2,1,'#886644');
  // Meat pie
  px(c,108,TABLE_T+3,8,5,'#c0b0a0'); px(c,109,TABLE_T+2,6,1,'#c0b0a0');
  px(c,109,TABLE_T+3,6,4,'#cc4433'); px(c,110,TABLE_T+3,4,1,'#dd5544');
  // Bread
  px(c,44,TABLE_T+3,6,4,'#ddb844'); px(c,44,TABLE_T+3,6,1,'#eec855'); px(c,44,TABLE_T+6,6,1,'#bb9933');
  // Gold coins
  for (const [gx,gy] of [[52,TABLE_T+4],[54,TABLE_T+3],[53,TABLE_T+5]]) {
    px(c,gx,gy,2,2,'#ffd700'); px(c,gx,gy,2,1,'#ffe840');
  }
  // Mugs
  for (const [mx,my] of [[30,TABLE_T+2],[48,TABLE_T+1],[120,TABLE_T+2],[138,TABLE_T+1],[150,TABLE_T+3]]) {
    px(c,mx,my,3,4,'#a09080'); px(c,mx,my,3,1,'#b0a090'); px(c,mx,my+3,3,1,'#908070');
    px(c,mx+1,my+1,1,2,'#cc8822'); px(c,mx+3,my+1,1,2,'#a09080');
  }
  // Candle
  const cdx=70,cdy=TABLE_T+1;
  px(c,cdx,cdy+2,2,4,'#e8e0d0');
  const fi=Math.sin(frame*0.25)*6;
  px(c,cdx,cdy+1,2,1,shade('#ffcc44',Math.round(fi)));
  px(c,cdx,cdy,2,1,shade('#ff8800',Math.round(fi)));
  c.fillStyle=`rgba(255,200,80,${0.03+Math.sin(frame*0.25)*0.01})`;
  c.fillRect((cdx-5)*PS,(cdy-5)*PS,12*PS,12*PS);
}

/* ═══ HAIR DRAWING ═══ */
function drawHairFront(c,cx,y,type,col) {
  const d=shade(col,-15);
  if (type==='hair-parted')     { px(c,cx-3,y-2,7,3,col); px(c,cx-4,y-1,1,3,col); px(c,cx+4,y-1,1,3,col); px(c,cx+1,y-2,1,2,d); }
  else if (type==='hair-long')  { px(c,cx-4,y-2,9,3,col); px(c,cx-5,y-1,1,7,col); px(c,cx+5,y-1,1,7,col); px(c,cx-4,y,1,5,d); }
  else if (type==='hair-ponytail'){px(c,cx-3,y-2,7,3,col); px(c,cx-4,y-1,1,3,col); px(c,cx+4,y-1,1,4,col); px(c,cx+5,y,2,3,col); px(c,cx+6,y+3,1,2,col); }
  else if (type==='hair-spiky') { px(c,cx-3,y-1,7,2,col); px(c,cx-2,y-3,2,2,col); px(c,cx+1,y-4,2,3,col); px(c,cx+3,y-3,2,2,col); px(c,cx-4,y,1,2,col); }
  else if (type==='hair-curly') { px(c,cx-4,y-2,9,3,col); px(c,cx-3,y-3,3,1,col); px(c,cx+1,y-3,3,1,col); px(c,cx-5,y,1,3,col); px(c,cx+5,y,1,3,col); }
  else if (type==='hair-mohawk'){ px(c,cx-3,y-1,7,2,col); px(c,cx-1,y-5,3,4,col); px(c,cx,y-6,1,1,d); }
  else if (type==='hair-bun')   { px(c,cx-3,y-2,7,3,col); px(c,cx-1,y-5,3,3,col); px(c,cx,y-5,1,1,d); px(c,cx-4,y,1,2,col); }
  else /* short */               { px(c,cx-3,y-2,7,3,col); px(c,cx-4,y,1,2,col); px(c,cx+4,y,1,2,col); }
}
function drawHairBack(c,cx,y,type,col) {
  const d=shade(col,-15);
  if (type==='hair-long')       { px(c,cx-4,y-2,9,10,col); px(c,cx-3,y-3,7,1,col); px(c,cx-5,y+2,1,5,col); px(c,cx+5,y+2,1,5,col); }
  else if (type==='hair-ponytail'){px(c,cx-3,y-2,7,7,col); px(c,cx+4,y+1,2,3,col); px(c,cx+5,y+4,1,3,col); px(c,cx+4,y+7,1,2,col); }
  else if (type==='hair-spiky') { px(c,cx-3,y-1,7,6,col); px(c,cx-2,y-3,2,2,col); px(c,cx+1,y-4,2,3,col); px(c,cx+3,y-3,2,2,col); }
  else if (type==='hair-bun')   { px(c,cx-3,y-2,7,7,col); px(c,cx-1,y-5,3,3,col); px(c,cx,y-4,1,1,d); }
  else if (type==='hair-mohawk'){ px(c,cx-3,y-1,7,6,col); px(c,cx-1,y-5,3,4,col); }
  else if (type==='hair-curly') { px(c,cx-4,y-2,9,8,col); px(c,cx-3,y-3,3,1,col); px(c,cx+1,y-3,3,1,col); }
  else                           { px(c,cx-3,y-2,7,7,col); }
}

/* ═══ FAR CHARACTER (facing camera) ═══ */
function drawFarChar(c,cx,y0,roster,state,f) {
  const {skin,shirt,hairColor,hair}=roster;
  const run=state==='RUNNING', done=state==='DONE'||state==='EXITED';
  const by=y0+8;

  // Shadow
  px(c,cx-4,TABLE_T-1,9,1,'rgba(0,0,0,0.06)');

  // Body
  px(c,cx-5,by,11,8,shirt);
  px(c,cx-5,by,11,1,shade(shirt,15));
  px(c,cx+5,by,1,8,shade(shirt,-15));
  // Collar
  px(c,cx-2,by,5,2,shade(shirt,20));
  // Belt
  px(c,cx-5,by+7,11,1,shade(shirt,-25));

  // Arms
  if (done) {
    px(c,cx-6,by+3,2,5,shirt); px(c,cx+5,by+3,2,5,shirt);
    px(c,cx-5,TABLE_T-1,3,2,skin); px(c,cx+3,TABLE_T-1,3,2,skin);
  } else if (run) {
    const bob=f%4<2?0:1;
    px(c,cx-6,by+2,2,5,shirt); px(c,cx+5,by+2,2,5,shirt);
    px(c,cx-6,TABLE_T-2,3,2,skin); px(c,cx+4,TABLE_T-2+bob,3,2,skin);
  } else {
    px(c,cx-6,by+2,2,6,shirt); px(c,cx+5,by+2,2,6,shirt);
    px(c,cx-6,by+7,2,2,skin); px(c,cx+5,by+7,2,2,skin);
  }

  // Neck
  px(c,cx-1,y0+6,3,2,skin);

  // Head
  const hy=done?y0+3:y0;
  px(c,cx-3,hy,7,7,skin);
  px(c,cx-3,hy,7,1,shade(skin,8));
  // Ears
  px(c,cx-4,hy+2,1,2,shade(skin,-8));
  px(c,cx+4,hy+2,1,2,shade(skin,-8));

  drawHairFront(c,cx,hy,hair,hairColor);

  if (done) {
    px(c,cx-2,hy+3,2,1,'#444'); px(c,cx+1,hy+3,2,1,'#444');
    px(c,cx,hy+5,1,1,'#c08070');
  } else {
    const blink=f%30===0;
    if (blink) {
      px(c,cx-2,hy+3,2,1,'#333'); px(c,cx+1,hy+3,2,1,'#333');
    } else {
      px(c,cx-2,hy+2,2,2,'#fff'); px(c,cx+1,hy+2,2,2,'#fff');
      const po=run?(f%8<4?0:1):0;
      px(c,cx-2+po,hy+3,1,1,'#1a1a2a'); px(c,cx+1+po,hy+3,1,1,'#1a1a2a');
      // Highlight
      px(c,cx-1,hy+2,1,1,'rgba(255,255,255,0.5)'); px(c,cx+2,hy+2,1,1,'rgba(255,255,255,0.5)');
    }
    // Mouth
    if (run) px(c,cx-1,hy+5,3,1,shade(skin,-20));
    else { px(c,cx-1,hy+5,3,1,shade(skin,-15)); px(c,cx,hy+5,1,1,shade(skin,-25)); }
  }

  // Badge/role indicator
  px(c,cx-5,by+1,1,2,roster.badge||shirt);
}

/* ═══ NEAR CHARACTER (back to camera) ═══ */
function drawNearChar(c,cx,y0,roster,state,f) {
  const {skin,shirt,hairColor,hair}=roster;
  const run=state==='RUNNING', done=state==='DONE'||state==='EXITED';
  const by=y0+8;

  // Body (back)
  px(c,cx-5,by,11,10,shirt);
  px(c,cx-5,by,11,1,shade(shirt,10));
  px(c,cx+5,by,1,10,shade(shirt,-15));
  px(c,cx,by+2,1,6,shade(shirt,-8));
  // Belt
  px(c,cx-5,by+9,11,1,shade(shirt,-25));

  // Arms
  if (done) {
    px(c,cx-6,by+1,2,6,shirt); px(c,cx+5,by+1,2,6,shirt);
    px(c,cx-5,by-1,3,2,skin); px(c,cx+3,by-1,3,2,skin);
  } else if (run) {
    const bob=f%4<2?0:-1;
    px(c,cx-6,by,2,5,shirt); px(c,cx+5,by,2,5,shirt);
    px(c,cx-6,by-1,2,2,skin); px(c,cx+5,by-1+bob,2,2,skin);
  } else {
    px(c,cx-6,by+1,2,7,shirt); px(c,cx+5,by+1,2,7,shirt);
  }

  // Neck
  px(c,cx-1,y0+6,3,2,skin);

  // Head back
  const hy=done?y0+3:y0;
  px(c,cx-3,hy,7,7,skin);
  drawHairBack(c,cx,hy,hair,hairColor);
  // Ears
  px(c,cx-4,hy+2,1,2,shade(skin,-8));
  px(c,cx+4,hy+2,1,2,shade(skin,-8));
}

/* ═══ STOOL ═══ */
function drawStool(c,sx,sy) {
  px(c,sx-3,sy,7,2,WOOD[2]); px(c,sx-3,sy,7,1,WOOD[1]);
  px(c,sx-2,sy+2,1,4,WOOD[3]); px(c,sx+2,sy+2,1,4,WOOD[3]);
}

/* ═══ CRATE ═══ */
function drawCrate(c,cx,cy) {
  px(c,cx,cy,8,8,WOOD[3]); px(c,cx,cy,8,1,WOOD[2]); px(c,cx+7,cy,1,8,WOOD[4]);
  px(c,cx,cy+4,8,1,WOOD[2]); px(c,cx+4,cy,1,8,WOOD[2]);
}

/* ═══ OVERLAYS ═══ */
function drawBubble(c,cx,cy,text) {
  const fs=Math.max(7,Math.round(4.5*PS));
  c.font=`bold ${fs}px 'Segoe UI',sans-serif`;
  const tw=c.measureText(text).width;
  const bw=tw+8, bh=fs+6;
  const bx=cx*PS-bw/2, by=(cy-6)*PS-bh;
  c.fillStyle='rgba(0,0,0,0.1)'; c.fillRect(bx+1,by+1,bw,bh);
  c.fillStyle='#f8f0e0'; c.fillRect(bx,by,bw,bh);
  c.fillStyle=K;
  c.fillRect(bx,by,bw,1); c.fillRect(bx,by+bh-1,bw,1);
  c.fillRect(bx,by,1,bh); c.fillRect(bx+bw-1,by,1,bh);
  c.fillStyle='#f8f0e0'; c.fillRect(cx*PS-2,by+bh,4,3);
  c.fillStyle=K; c.fillRect(cx*PS-3,by+bh,1,3); c.fillRect(cx*PS+2,by+bh,1,3);
  c.fillStyle='#2a1810'; c.textAlign='center'; c.fillText(text,cx*PS,by+bh-4); c.textAlign='start';
}
function drawZzz(c,cx,cy,f) {
  const d=Math.sin(f*0.15)*2;
  c.font=`bold ${Math.max(6,3*PS)}px monospace`;
  c.fillStyle='rgba(120,130,160,0.5)'; c.fillText('z',(cx+4)*PS,(cy-4+d)*PS);
  c.font=`bold ${Math.max(8,4.5*PS)}px monospace`;
  c.fillStyle='rgba(120,130,160,0.3)'; c.fillText('Z',(cx+7)*PS,(cy-8+d*0.6)*PS);
}
function drawProgress(c,cx,cy,pct,running) {
  const pw=14,ph=2,x0=cx-pw/2,y0=cy;
  px(c,x0,y0,pw,ph,'#383028'); px(c,x0,y0,pw,1,'#484038');
  if (pct>0) {
    const fw=Math.max(1,Math.round(pw*pct/100));
    const fi=Math.sin(frame*0.15)*8;
    px(c,x0,y0,fw,ph,running?shade('#10b981',Math.round(fi)):'#94a3b8');
  }
  px(c,x0,y0,pw,1,K); px(c,x0,y0+ph,pw,1,K); px(c,x0,y0,1,ph,K); px(c,x0+pw,y0,1,ph,K);
}

/* ═══ WARM LIGHTING ═══ */
function drawLighting(c) {
  const grd=c.createRadialGradient(VW/2*PS,VH*0.42*PS,VW*0.18*PS,VW/2*PS,VH*0.42*PS,VW*0.72*PS);
  grd.addColorStop(0,'rgba(255,200,120,0.03)');
  grd.addColorStop(0.5,'rgba(255,180,100,0.05)');
  grd.addColorStop(1,'rgba(20,10,0,0.1)');
  c.fillStyle=grd; c.fillRect(0,0,VW*PS,VH*PS);
}

/* ═══ MAIN RENDER ═══ */
function render(canvas,roster,assigned,bubbleMsgs) {
  const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  const cw=canvas.width/dpr, ch=canvas.height/dpr;
  PS=Math.max(2,Math.min(Math.floor(cw/VW),Math.floor(ch/VH)));
  const ox=Math.floor((cw-VW*PS)/2), oy=Math.floor((ch-VH*PS)/2);
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,cw,ch);
  ctx.fillStyle='#1a1008'; ctx.fillRect(0,0,cw,ch);
  ctx.save(); ctx.translate(ox,oy);

  // Background
  drawFloor(ctx); drawWall(ctx);
  // Wall deco
  drawShelf(ctx); drawLantern(ctx,10,3); drawLantern(ctx,162,3); drawFireplace(ctx);
  // Counter
  drawCounter(ctx);
  // Side furniture
  drawBarrel(ctx,2,42); drawBarrel(ctx,170,47); drawCrate(ctx,3,60);

  // Far characters
  for (let i=0;i<4;i++) {
    const r=roster[i], a=assigned[i], st=a?String(a.state||'').toUpperCase():'IDLE';
    drawStool(ctx,SEAT_X[i],TABLE_T+1);
    drawFarChar(ctx,SEAT_X[i],FAR_HEAD,r,st,frame);
  }

  // Table + items
  drawTable(ctx); drawTableItems(ctx);

  // Near characters
  for (let i=0;i<4;i++) {
    const idx=4+i, r=roster[idx], a=assigned[idx], st=a?String(a.state||'').toUpperCase():'IDLE';
    drawStool(ctx,SEAT_X[i],NEAR_HEAD+18);
    drawNearChar(ctx,SEAT_X[i],NEAR_HEAD,r,st,frame);
  }

  // Lighting overlay
  drawLighting(ctx);

  // Overlays (bubbles, zzz, progress)
  for (let i=0;i<8;i++) {
    const r=roster[i], a=assigned[i];
    const st=a?String(a.state||'').toUpperCase():'IDLE';
    const prog=a?Math.max(0,Math.min(100,Number(a.progress||0))):0;
    const run=st==='RUNNING', done=st==='DONE'||st==='EXITED';
    const sx=SEAT_X[i<4?i:i-4];
    const sy=i<4?FAR_HEAD:NEAR_HEAD;

    if (run) {
      const msgs=bubbleMsgs[r.engine]||bubbleMsgs['default']||['...'];
      const msg=msgs[Math.floor((Date.now()/4000+i)%msgs.length)];
      drawBubble(ctx,sx,sy-2,`${r.engine.toUpperCase()} ${r.ver}: ${msg}`);
    } else if (done) {
      drawZzz(ctx,sx,sy,frame);
    }
    if (prog>0) drawProgress(ctx,sx,i<4?FAR_HEAD+19:NEAR_HEAD+21,prog,run);
  }

  ctx.restore();
  frame++;
}

return { render };
})();
