/* ═══════════════════════════════════════════════════════
   Pixel Office Scene v2 — 4×2 Cubicle Layout
   Individual desks with monitors, pixel art RPG style
   ═══════════════════════════════════════════════════════ */
const TAVERN = (() => {
const VW = 190, VH = 120;
let PS, frame = 0;

function px(c,x,y,w,h,col) {
  if (!col) return;
  c.fillStyle=col;
  c.fillRect(x*PS,y*PS,Math.ceil(w*PS),Math.ceil(h*PS));
}
function shade(hex,a) {
  let s=(hex||'#888').replace('#','');
  if (s.length===3) s=s[0]+s[0]+s[1]+s[1]+s[2]+s[2];
  const n=parseInt(s,16);
  return `rgb(${Math.min(255,Math.max(0,(n>>16)+a))},${Math.min(255,Math.max(0,((n>>8)&255)+a))},${Math.min(255,Math.max(0,(n&255)+a))})`;
}

const K='#1a1a2a';
const WALL_C=['#f0ebe4','#e8e2d8','#ddd7cc','#d0c8bc'];
const FLOOR_C=['#c8bfb0','#bdb4a5','#b0a898','#a59d90'];
const DESK=['#d8b280','#c49858','#a07840','#7c5c30','#5c4018'];
const METAL=['#c0c0c0','#a0a0a0','#808080','#606060'];
const GLASS=['#a0c8e0','#88b8d8','#70a8d0','#5898c8'];
const PART=['#7aaa8a','#6a9a7a','#5a8a6a','#4a7a5a']; // partition green

/* ── Layout ── */
const WALL_B=28;
const SEAT_X=[30,68,106,144]; // 4 cubicles
const CW=34; // cubicle width
const PART_X=[13,49,87,125,163]; // partition wall x positions

// Far row (back): desks against wall, chars face north toward monitors (we see backs)
const FAR_DESK_Y=30; // desk top surface y
const FAR_HEAD=42;   // character head y

// Near row (front): desks near aisle, chars face north toward monitors (we see backs)
const NEAR_DESK_Y=62; // desk top surface y
const NEAR_HEAD=72;   // character head y

/* ═══ FLOOR ═══ */
function drawFloor(c) {
  for (let y=WALL_B;y<VH;y+=3) {
    const ci=((y/3)|0)%FLOOR_C.length;
    px(c,0,y,VW,3,FLOOR_C[ci]);
    if (y%6===0) px(c,0,y,VW,1,shade(FLOOR_C[ci],5));
  }
  for (let x=0;x<VW;x+=6) px(c,x,WALL_B,1,VH-WALL_B,shade('#b0a898',-3));
}

/* ═══ WALL ═══ */
function drawWall(c) {
  px(c,0,0,VW,WALL_B,WALL_C[0]);
  for (let x=0;x<VW;x+=38) px(c,x,0,1,WALL_B,WALL_C[2]);
  px(c,0,WALL_B-2,VW,2,'#8a8070'); px(c,0,WALL_B-2,VW,1,'#9a9080');
  px(c,0,0,VW,1,'#e0dcd5');
}

/* ═══ WINDOW ═══ */
function drawWindow(c) {
  const wx=55,wy=3,ww=36,wh=20;
  px(c,wx-1,wy-1,ww+2,wh+2,'#888'); px(c,wx-1,wy-1,ww+2,1,'#aaa');
  px(c,wx,wy,ww,7,'#88c8ee'); px(c,wx,wy+7,ww,6,'#a0d4f0'); px(c,wx,wy+13,ww,7,'#b8e0f5');
  px(c,wx+5,wy+3,8,2,'#ddeeff'); px(c,wx+7,wy+2,4,1,'#ddeeff');
  px(c,wx+20,wy+5,8,2,'#ddeeff'); px(c,wx+22,wy+4,5,1,'#ddeeff');
  px(c,wx+2,wy+15,5,5,'#8090a0'); px(c,wx+9,wy+12,4,8,'#7888a0');
  px(c,wx+24,wy+13,7,7,'#7080a0'); px(c,wx+32,wy+16,4,4,'#8898a8');
  for (const [bx,by] of [[wx+3,wy+16],[wx+10,wy+14],[wx+10,wy+17],[wx+25,wy+15],[wx+27,wy+17]]) px(c,bx,by,1,1,'#e8d880');
  px(c,wx+ww/2,wy,1,wh,'#999'); px(c,wx,wy+wh/2,ww,1,'#999');
  for (let i=0;i<3;i++) px(c,wx,wy+i*2,ww,1,shade(WALL_C[1],5));
}

/* ═══ WHITEBOARD ═══ */
function drawWhiteboard(c) {
  const bx=108,by=3,bw=32,bh=18;
  px(c,bx-1,by-1,bw+2,bh+2,METAL[1]); px(c,bx-1,by-1,bw+2,1,METAL[0]);
  px(c,bx,by,bw,bh,'#f8f8f8');
  px(c,bx+3,by+3,10,1,'#2266cc'); px(c,bx+3,by+5,14,1,'#2266cc');
  px(c,bx+3,by+7,8,1,'#cc3322'); px(c,bx+3,by+9,12,1,'#2266cc');
  px(c,bx+3,by+11,6,1,'#22aa44');
  px(c,bx+2,by+3,1,1,'#22aa44'); px(c,bx+2,by+5,1,1,'#22aa44'); px(c,bx+2,by+7,1,1,'#cc3322');
  px(c,bx+20,by+3,8,4,'#ddeeff'); px(c,bx+20,by+3,8,1,'#88aacc');
  px(c,bx+21,by+9,6,4,'#ffeedd'); px(c,bx+21,by+9,6,1,'#ccaa88');
  px(c,bx+23,by+7,1,2,'#444');
  px(c,bx,by+bh,bw,2,METAL[1]); px(c,bx,by+bh,bw,1,METAL[0]);
  px(c,bx+3,by+bh,3,1,'#cc3322'); px(c,bx+8,by+bh,3,1,'#2266cc'); px(c,bx+13,by+bh,3,1,'#22aa44');
}

/* ═══ CLOCK ═══ */
function drawClock(c) {
  const cx=152,cy=9;
  px(c,cx-4,cy-4,9,9,'#fff');
  px(c,cx-5,cy-4,1,9,'#888'); px(c,cx+5,cy-4,1,9,'#888');
  px(c,cx-4,cy-5,9,1,'#888'); px(c,cx-4,cy+5,9,1,'#888');
  px(c,cx,cy,1,1,'#333'); px(c,cx,cy-3,1,3,'#333'); px(c,cx+1,cy,2,1,'#cc2222');
  for (const [hx,hy] of [[cx,cy-4],[cx,cy+4],[cx-4,cy],[cx+4,cy]]) px(c,hx,hy,1,1,'#555');
}

/* ═══ CEILING LIGHTS ═══ */
function drawLight(c,lx) {
  px(c,lx,0,1,3,'#888');
  px(c,lx-5,3,11,2,METAL[1]); px(c,lx-5,3,11,1,METAL[0]); px(c,lx-4,5,9,1,METAL[2]);
  const fi=Math.sin(frame*0.05+lx)*0.005;
  c.fillStyle=`rgba(255,255,240,${0.025+fi})`;
  c.fillRect((lx-14)*PS,3*PS,29*PS,28*PS);
}

/* ═══ PARTITION WALLS ═══ */
function drawPartitionY(c,x,y0,y1) {
  px(c,x,y0,2,y1-y0,PART[1]);
  px(c,x,y0,2,1,PART[0]);
  px(c,x+1,y0,1,y1-y0,PART[2]);
  px(c,x,y0+Math.floor((y1-y0)/2),2,1,PART[3]); // mid rail
}
function drawPartitionX(c,x0,x1,y) {
  px(c,x0,y,x1-x0,2,PART[1]);
  px(c,x0,y,x1-x0,1,PART[0]);
  // shelf on top
  px(c,x0,y-1,x1-x0,1,PART[0]);
  // books on shelf
  const bColors=['#c0392b','#2980b9','#27ae60','#8e44ad','#f39c12','#34495e'];
  let bx=x0+2;
  for (let i=0;bx<x1-3;i++) {
    const bw=2,bh=2+((i*3)%3);
    px(c,bx,y-1-bh,bw,bh,bColors[i%bColors.length]);
    bx+=bw+1;
  }
}

/* ═══ DESK + MONITOR ═══ */
function drawDeskFar(c,cx,dy) {
  const dw=24, dl=cx-dw/2;
  // Desk surface
  px(c,dl,dy,dw,6,DESK[0]); px(c,dl,dy,dw,1,shade(DESK[0],12));
  px(c,dl+dw-1,dy,1,6,DESK[2]);
  // Desk front face
  px(c,dl,dy+6,dw,3,DESK[2]); px(c,dl,dy+6,dw,1,DESK[1]);
  // Drawer
  px(c,cx+4,dy+6,7,3,DESK[1]); px(c,cx+6,dy+7,3,1,METAL[1]);
  // Monitor (screen faces south = visible)
  const mx=cx-4,my=dy+1;
  px(c,mx-1,my-1,10,7,'#333');
  px(c,mx,my,8,5,'#1a2535');
  // Code lines
  const active=true;
  if (active) {
    px(c,mx+1,my,4,1,'#61afef'); px(c,mx+1,my+1,5,1,'#98c379');
    px(c,mx+1,my+2,3,1,'#e5c07b'); px(c,mx+1,my+3,6,1,'#c678dd');
  }
  // Stand
  px(c,cx-1,dy+6,3,1,'#444'); px(c,cx,dy+5,1,1,'#555');
  // Keyboard
  px(c,cx-4,dy+8,8,2,'#444'); px(c,cx-4,dy+8,8,1,'#555');
  // Mouse
  px(c,cx+5,dy+8,2,2,'#555'); px(c,cx+5,dy+8,2,1,'#666');
}

function drawDeskNear(c,cx,dy) {
  const dw=24, dl=cx-dw/2;
  // Desk surface
  px(c,dl,dy,dw,6,DESK[0]); px(c,dl,dy,dw,1,shade(DESK[0],12));
  px(c,dl+dw-1,dy,1,6,DESK[2]);
  // Desk front face (visible)
  px(c,dl,dy+6,dw,3,DESK[2]); px(c,dl,dy+6,dw,1,DESK[1]);
  // Legs
  px(c,dl+2,dy+9,2,6,DESK[3]); px(c,dl+dw-4,dy+9,2,6,DESK[3]);
  // Monitor (screen faces south = visible to camera and character)
  const mx=cx-4,my=dy+1;
  px(c,mx-1,my-1,10,7,'#333');
  px(c,mx,my,8,5,'#1a2535');
  // Code lines on screen
  px(c,mx+1,my,4,1,'#61afef'); px(c,mx+1,my+1,5,1,'#98c379');
  px(c,mx+1,my+2,3,1,'#e5c07b'); px(c,mx+1,my+3,6,1,'#c678dd');
  // Stand
  px(c,cx-1,dy+6,3,1,'#444'); px(c,cx,dy+5,1,1,'#555');
  // Keyboard (south side of desk, near character)
  px(c,cx-4,dy+8,8,2,'#444'); px(c,cx-4,dy+8,8,1,'#555');
  // Mouse
  px(c,cx+5,dy+8,2,2,'#555'); px(c,cx+5,dy+8,2,1,'#666');
}

/* ═══ DESK ACCESSORIES ═══ */
function drawDeskAccessories(c,cx,dy,col) {
  // Coffee mug (varies position by column index)
  const mugX=cx+9, mugY=dy+2;
  px(c,mugX,mugY,3,3,'#e0d8d0'); px(c,mugX,mugY,3,1,'#e8e0d8');
  px(c,mugX+1,mugY+1,1,1,'#6b3a1a'); px(c,mugX+3,mugY,1,2,'#d8d0c8');
}

/* ═══ SIDE FURNITURE ═══ */
function drawCabinet(c,fx,fy) {
  px(c,fx,fy,8,14,METAL[2]); px(c,fx,fy,8,1,METAL[1]); px(c,fx+7,fy,1,14,METAL[3]);
  for (let i=0;i<3;i++) { const dy=fy+1+i*4; px(c,fx+1,dy,6,3,METAL[1]); px(c,fx+3,dy+1,2,1,METAL[0]); }
}
function drawPlant(c,px2,py) {
  px(c,px2,py,6,5,'#a06030'); px(c,px2,py,6,1,'#b07040'); px(c,px2+1,py+5,4,1,'#905020');
  px(c,px2+1,py-4,4,4,'#44884a'); px(c,px2,py-3,1,2,'#3a7a40'); px(c,px2+5,py-3,1,2,'#3a7a40');
  px(c,px2+2,py-6,2,2,'#55995a'); px(c,px2,py-5,2,2,'#44884a'); px(c,px2+4,py-5,2,2,'#44884a');
}
function drawCooler(c,wx,wy) {
  px(c,wx,wy,6,12,'#e8e8e8'); px(c,wx,wy,6,1,'#f0f0f0'); px(c,wx+5,wy,1,12,'#d0d0d0');
  px(c,wx+1,wy-6,4,6,GLASS[0]); px(c,wx+1,wy-6,4,1,shade(GLASS[0],15)); px(c,wx+1,wy-7,4,1,GLASS[1]);
  px(c,wx-1,wy+4,2,1,'#cc3322'); px(c,wx+5,wy+4,2,1,'#3366cc');
}
function drawPrinter(c,px2,py) {
  px(c,px2,py,10,4,'#e0e0e0'); px(c,px2,py,10,1,'#f0f0f0');
  px(c,px2+1,py+1,8,1,'#333');
  px(c,px2+2,py-1,6,1,'#fff');
  px(c,px2,py+4,10,3,METAL[2]); px(c,px2,py+4,10,1,METAL[1]);
}

/* ═══ HAIR ═══ */
function drawHairFront(c,cx,y,type,col) {
  const d=shade(col,-15);
  if (type==='hair-parted')     { px(c,cx-3,y-2,7,3,col); px(c,cx-4,y-1,1,3,col); px(c,cx+4,y-1,1,3,col); px(c,cx+1,y-2,1,2,d); }
  else if (type==='hair-long')  { px(c,cx-4,y-2,9,3,col); px(c,cx-5,y-1,1,7,col); px(c,cx+5,y-1,1,7,col); px(c,cx-4,y,1,5,d); }
  else if (type==='hair-ponytail'){px(c,cx-3,y-2,7,3,col); px(c,cx-4,y-1,1,3,col); px(c,cx+4,y-1,1,4,col); px(c,cx+5,y,2,3,col); px(c,cx+6,y+3,1,2,col); }
  else if (type==='hair-spiky') { px(c,cx-3,y-1,7,2,col); px(c,cx-2,y-3,2,2,col); px(c,cx+1,y-4,2,3,col); px(c,cx+3,y-3,2,2,col); px(c,cx-4,y,1,2,col); }
  else if (type==='hair-curly') { px(c,cx-4,y-2,9,3,col); px(c,cx-3,y-3,3,1,col); px(c,cx+1,y-3,3,1,col); px(c,cx-5,y,1,3,col); px(c,cx+5,y,1,3,col); }
  else if (type==='hair-mohawk'){ px(c,cx-3,y-1,7,2,col); px(c,cx-1,y-5,3,4,col); px(c,cx,y-6,1,1,d); }
  else if (type==='hair-bun')   { px(c,cx-3,y-2,7,3,col); px(c,cx-1,y-5,3,3,col); px(c,cx,y-5,1,1,d); px(c,cx-4,y,1,2,col); }
  else                           { px(c,cx-3,y-2,7,3,col); px(c,cx-4,y,1,2,col); px(c,cx+4,y,1,2,col); }
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

/* ═══ FAR CHAR (facing camera, at desk) ═══ */
function drawFarChar(c,cx,y0,roster,state,f) {
  const {skin,shirt,hairColor,hair}=roster;
  const run=state==='RUNNING',done=state==='DONE'||state==='EXITED';
  const by=y0+8;

  // Body
  px(c,cx-5,by,11,8,shirt); px(c,cx-5,by,11,1,shade(shirt,15)); px(c,cx+5,by,1,8,shade(shirt,-15));
  px(c,cx-2,by,5,2,'#fff'); px(c,cx,by,1,3,shade(shirt,10));
  px(c,cx,by+2,1,3,roster.badge||'#cc3322');

  if (done) {
    // Head on desk
    px(c,cx-6,by+3,2,5,shirt); px(c,cx+5,by+3,2,5,shirt);
    px(c,cx-5,by-3,3,2,skin); px(c,cx+3,by-3,3,2,skin);
  } else if (run) {
    const bob=f%4<2?0:1;
    px(c,cx-6,by+2,2,5,shirt); px(c,cx+5,by+2,2,5,shirt);
    px(c,cx-6,by-2,3,2,skin); px(c,cx+4,by-2+bob,3,2,skin);
  } else {
    px(c,cx-6,by+2,2,6,shirt); px(c,cx+5,by+2,2,6,shirt);
    px(c,cx-6,by+7,2,2,skin); px(c,cx+5,by+7,2,2,skin);
  }

  px(c,cx-1,y0+6,3,2,skin);
  const hy=done?y0+3:y0;
  px(c,cx-3,hy,7,7,skin); px(c,cx-3,hy,7,1,shade(skin,8));
  px(c,cx-4,hy+2,1,2,shade(skin,-8)); px(c,cx+4,hy+2,1,2,shade(skin,-8));
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
      px(c,cx-1,hy+2,1,1,'rgba(255,255,255,0.5)'); px(c,cx+2,hy+2,1,1,'rgba(255,255,255,0.5)');
    }
    if (run) px(c,cx-1,hy+5,3,1,shade(skin,-20));
    else { px(c,cx-1,hy+5,3,1,shade(skin,-15)); px(c,cx,hy+5,1,1,shade(skin,-25)); }
  }
}

/* ═══ NEAR CHAR (back to camera, at desk) ═══ */
function drawNearChar(c,cx,y0,roster,state,f) {
  const {skin,shirt,hairColor,hair}=roster;
  const run=state==='RUNNING',done=state==='DONE'||state==='EXITED';
  const by=y0+8;

  px(c,cx-5,by,11,10,shirt); px(c,cx-5,by,11,1,shade(shirt,10)); px(c,cx+5,by,1,10,shade(shirt,-15));
  px(c,cx,by+2,1,6,shade(shirt,-8));
  px(c,cx-2,by,5,1,'#fff');

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

  px(c,cx-1,y0+6,3,2,skin);
  const hy=done?y0+3:y0;
  px(c,cx-3,hy,7,7,skin);
  drawHairBack(c,cx,hy,hair,hairColor);
  px(c,cx-4,hy+2,1,2,shade(skin,-8)); px(c,cx+4,hy+2,1,2,shade(skin,-8));
}

/* ═══ OFFICE CHAIR ═══ */
function drawChairFar(c,sx,sy,color) {
  px(c,sx-4,sy,9,3,color); px(c,sx-4,sy,9,1,shade(color,15));
  px(c,sx,sy+3,1,3,METAL[2]);
  for (const dx of [-3,-1,1,3]) { px(c,sx+dx,sy+6,1,1,METAL[2]); px(c,sx+dx,sy+7,1,1,METAL[3]); }
}
function drawChairNear(c,sx,sy,color) {
  // Chair back visible (character sits in it)
  px(c,sx-4,sy-6,9,6,shade(color,-10)); px(c,sx-4,sy-6,9,1,shade(color,5));
  px(c,sx-4,sy,9,3,color); px(c,sx-4,sy,9,1,shade(color,15));
  px(c,sx,sy+3,1,3,METAL[2]);
  for (const dx of [-3,-1,1,3]) { px(c,sx+dx,sy+6,1,1,METAL[2]); px(c,sx+dx,sy+7,1,1,METAL[3]); }
}

/* ═══ OVERLAYS ═══ */
function drawBubble(c,cx,cy,text) {
  const fs=Math.max(7,Math.round(4.5*PS));
  c.font=`bold ${fs}px 'Segoe UI',sans-serif`;
  const tw=c.measureText(text).width;
  const bw=tw+8,bh=fs+6;
  const bx=cx*PS-bw/2,by=(cy-6)*PS-bh;
  c.fillStyle='rgba(0,0,0,0.08)'; c.fillRect(bx+1,by+1,bw,bh);
  c.fillStyle='#fff'; c.fillRect(bx,by,bw,bh);
  c.fillStyle=K;
  c.fillRect(bx,by,bw,1); c.fillRect(bx,by+bh-1,bw,1);
  c.fillRect(bx,by,1,bh); c.fillRect(bx+bw-1,by,1,bh);
  c.fillStyle='#fff'; c.fillRect(cx*PS-2,by+bh,4,3);
  c.fillStyle=K; c.fillRect(cx*PS-3,by+bh,1,3); c.fillRect(cx*PS+2,by+bh,1,3);
  c.fillStyle='#1a1a2a'; c.textAlign='center'; c.fillText(text,cx*PS,by+bh-4); c.textAlign='start';
}
function drawZzz(c,cx,cy,f) {
  const d=Math.sin(f*0.15)*2;
  c.font=`bold ${Math.max(6,3*PS)}px monospace`;
  c.fillStyle='rgba(100,110,140,0.5)'; c.fillText('z',(cx+4)*PS,(cy-4+d)*PS);
  c.font=`bold ${Math.max(8,4.5*PS)}px monospace`;
  c.fillStyle='rgba(100,110,140,0.3)'; c.fillText('Z',(cx+7)*PS,(cy-8+d*0.6)*PS);
}
function drawProgress(c,cx,cy,pct,running) {
  const pw=14,ph=2,x0=cx-pw/2,y0=cy;
  px(c,x0,y0,pw,ph,'#e0e0e0'); px(c,x0,y0,pw,1,'#eee');
  if (pct>0) {
    const fw=Math.max(1,Math.round(pw*pct/100));
    const fi=Math.sin(frame*0.15)*8;
    px(c,x0,y0,fw,ph,running?shade('#2d4b9b',Math.round(fi)):'#94a3b8');
  }
  px(c,x0,y0,pw,1,K); px(c,x0,y0+ph,pw,1,K); px(c,x0,y0,1,ph,K); px(c,x0+pw,y0,1,ph,K);
}

/* ═══ LIGHTING ═══ */
function drawLighting(c) {
  const grd=c.createRadialGradient(VW/2*PS,VH*0.4*PS,VW*0.2*PS,VW/2*PS,VH*0.4*PS,VW*0.7*PS);
  grd.addColorStop(0,'rgba(255,255,250,0.02)');
  grd.addColorStop(0.6,'rgba(240,240,235,0.01)');
  grd.addColorStop(1,'rgba(20,20,30,0.06)');
  c.fillStyle=grd; c.fillRect(0,0,VW*PS,VH*PS);
}

/* ═══ MAIN RENDER ═══ */
function render(canvas,roster,assigned,bubbleMsgs) {
  const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  const cw=canvas.width/dpr,ch=canvas.height/dpr;
  PS=Math.max(2,Math.min(Math.floor(cw/VW),Math.floor(ch/VH)));
  const ox=Math.floor((cw-VW*PS)/2),oy=Math.floor((ch-VH*PS)/2);
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,cw,ch);
  ctx.fillStyle='#2a2a3a'; ctx.fillRect(0,0,cw,ch);
  ctx.save(); ctx.translate(ox,oy);

  // 1. Background
  drawFloor(ctx); drawWall(ctx);

  // 2. Wall decor
  drawWindow(ctx); drawWhiteboard(ctx); drawClock(ctx);
  drawLight(ctx,30); drawLight(ctx,68); drawLight(ctx,106); drawLight(ctx,144);

  // 3. Side furniture
  drawCabinet(ctx,2,34); drawCooler(ctx,2,55);
  drawCabinet(ctx,170,34); drawPlant(ctx,172,72);
  drawPrinter(ctx,170,56);

  // ──── FAR ROW (Row 1) ────
  // Back partition wall (along wall base)
  drawPartitionX(ctx,PART_X[0],PART_X[4],FAR_DESK_Y-1);
  // Vertical partitions
  for (const px2 of PART_X) drawPartitionY(ctx,px2,FAR_DESK_Y-1,FAR_DESK_Y+26);

  // Far row desks + chars (back to camera, facing monitors on wall)
  for (let i=0;i<4;i++) {
    const r=roster[i],a=assigned[i],st=a?String(a.state||'').toUpperCase():'IDLE';
    drawDeskFar(ctx,SEAT_X[i],FAR_DESK_Y);
    drawDeskAccessories(ctx,SEAT_X[i],FAR_DESK_Y,i);
    drawChairNear(ctx,SEAT_X[i],FAR_HEAD+15,r.chair);
    drawNearChar(ctx,SEAT_X[i],FAR_HEAD,r,st,frame);
  }

  // ──── AISLE ────
  // Aisle floor is already drawn

  // ──── NEAR ROW (Row 2) ────
  // Back partition wall (aisle side)
  drawPartitionX(ctx,PART_X[0],PART_X[4],NEAR_DESK_Y-1);
  // Vertical partitions
  for (const px2 of PART_X) drawPartitionY(ctx,px2,NEAR_DESK_Y-1,NEAR_DESK_Y+26);

  // Near row desks + chars
  for (let i=0;i<4;i++) {
    const idx=4+i,r=roster[idx],a=assigned[idx],st=a?String(a.state||'').toUpperCase():'IDLE';
    drawDeskNear(ctx,SEAT_X[i],NEAR_DESK_Y);
    drawChairNear(ctx,SEAT_X[i],NEAR_HEAD+16,r.chair);
    drawNearChar(ctx,SEAT_X[i],NEAR_HEAD,r,st,frame);
  }

  // 7. Lighting
  drawLighting(ctx);

  // 8. Overlays
  for (let i=0;i<8;i++) {
    const r=roster[i],a=assigned[i];
    const st=a?String(a.state||'').toUpperCase():'IDLE';
    const prog=a?Math.max(0,Math.min(100,Number(a.progress||0))):0;
    const run=st==='RUNNING',done=st==='DONE'||st==='EXITED';
    const sx=SEAT_X[i<4?i:i-4];
    const sy=i<4?FAR_HEAD:NEAR_HEAD;

    if (run) {
      const msgs=bubbleMsgs[r.engine]||bubbleMsgs['default']||['...'];
      const msg=msgs[Math.floor((Date.now()/4000+i)%msgs.length)];
      drawBubble(ctx,sx,sy-3,`${r.engine.toUpperCase()} ${r.ver}: ${msg}`);
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
