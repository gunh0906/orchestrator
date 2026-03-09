/* ══════════════════════════════════════════════════════════════
   Manga Office Scene v8 — Direct canvas, bold outlines, 4×2
   ══════════════════════════════════════════════════════════════ */
const ISO = (() => {
  let TW, TH, S;
  const wz = z => z * TH * 2;
  function toIso(x, y, z) {
    return { sx: (x - y) * TW, sy: (x + y) * TH - wz(z || 0) };
  }

  const COLS = 4, CW = 1.55, CD = 1.25, AISLE = 0.55;
  const MX = 0.55, MY = 0.7;
  const RW = MX * 2 + COLS * CW;
  const RD = MY + CD * 2 + AISLE + 0.4;
  const PH = 0.65, DH = 0.40, DD = 0.55, PT = 0.05;
  const R1 = MY, R2 = MY + CD + AISLE;
  const cX = i => MX + i * CW;

  const SEATS = [];
  for (let i = 0; i < COLS; i++) SEATS.push({ wx: cX(i) + CW / 2, wy: R1 + CD * 0.7 });
  for (let i = 0; i < COLS; i++) SEATS.push({ wx: cX(i) + CW / 2, wy: R2 + CD * 0.7 });

  const OL = 1.3;
  const K = '#2a2a2a';  // outline color

  function shade(hex, amt) {
    let c = String(hex||'#888').replace('#','');
    if (c.length===3) c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    const n=parseInt(c,16);
    return `rgb(${Math.min(255,Math.max(0,(n>>16)+amt))},${Math.min(255,Math.max(0,((n>>8)&0xFF)+amt))},${Math.min(255,Math.max(0,(n&0xFF)+amt))})`;
  }
  function roundRect(ctx,x,y,w,h,r){
    r=Math.min(r,w/2,h/2); ctx.beginPath();
    ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
  }
  function quad(ctx,a,b,c,d,fill,stroke,lw){
    ctx.beginPath();ctx.moveTo(a.sx,a.sy);ctx.lineTo(b.sx,b.sy);
    ctx.lineTo(c.sx,c.sy);ctx.lineTo(d.sx,d.sy);ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||OL;ctx.stroke();}
  }

  // ══════════ ROOM ══════════
  function drawRoom(ctx){
    const wH=1.7;
    const ftl=toIso(0,0,0),ftr=toIso(RW,0,0),fbl=toIso(0,RD,0),fbr=toIso(RW,RD,0);
    const wtl=toIso(0,0,wH),wtr=toIso(RW,0,wH),wbl=toIso(0,RD,wH);
    quad(ctx,wtl,wtr,ftr,ftl,'#eae5dd',K,OL);
    quad(ctx,wtl,wbl,fbl,ftl,'#ddd7ce',K,OL);
    ctx.strokeStyle=K;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(ftl.sx,ftl.sy);ctx.lineTo(wtl.sx,wtl.sy);ctx.stroke();
    // baseboard
    quad(ctx,toIso(0,0,0.05),toIso(RW,0,0.05),ftr,ftl,'#b5afa5',K,0.6);
    quad(ctx,toIso(0,0,0.05),toIso(0,RD,0.05),fbl,ftl,'#a8a298',K,0.6);
    // window
    drawWindow(ctx,0.55,0.82,wH);
    // floor
    quad(ctx,ftl,ftr,fbr,fbl,'#d5ccbc');
    ctx.strokeStyle='rgba(0,0,0,0.06)';ctx.lineWidth=0.7;
    for(let x=0;x<=RW;x+=0.6){const a=toIso(x,0,0),b=toIso(x,RD,0);ctx.beginPath();ctx.moveTo(a.sx,a.sy);ctx.lineTo(b.sx,b.sy);ctx.stroke();}
    for(let y=0;y<=RD;y+=0.6){const a=toIso(0,y,0),b=toIso(RW,y,0);ctx.beginPath();ctx.moveTo(a.sx,a.sy);ctx.lineTo(b.sx,b.sy);ctx.stroke();}
  }
  function drawWindow(ctx,t0,t1,wH){
    const ftl=toIso(0,0,0),ftr=toIso(RW,0,0);
    const dx=ftr.sx-ftl.sx,dy=ftr.sy-ftl.sy;
    const x0=ftl.sx+dx*t0,x1=ftl.sx+dx*t1;
    const yb0=ftl.sy+dy*t0,yb1=ftl.sy+dy*t1;
    const yt0=yb0-wz(wH*0.78),yt1=yb1-wz(wH*0.78);
    const ybot0=yb0-wz(wH*0.18),ybot1=yb1-wz(wH*0.18);
    ctx.fillStyle='#888';ctx.strokeStyle=K;ctx.lineWidth=OL;
    ctx.beginPath();ctx.moveTo(x0-2,yt0-2);ctx.lineTo(x1+2,yt1-2);ctx.lineTo(x1+2,ybot1+2);ctx.lineTo(x0-2,ybot0+2);ctx.closePath();ctx.fill();ctx.stroke();
    const sg=ctx.createLinearGradient(0,Math.min(yt0,yt1),0,Math.max(ybot0,ybot1));
    sg.addColorStop(0,'#85c8ea');sg.addColorStop(0.45,'#b0ddf2');sg.addColorStop(0.55,'#c0d8c0');sg.addColorStop(1,'#80aa80');
    ctx.fillStyle=sg;ctx.beginPath();ctx.moveTo(x0,yt0);ctx.lineTo(x1,yt1);ctx.lineTo(x1,ybot1);ctx.lineTo(x0,ybot0);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.15)';
    ctx.beginPath();ctx.moveTo(x0+3,yt0+3);ctx.lineTo(x0+(x1-x0)*0.25,yt0+(yt1-yt0)*0.25+3);ctx.lineTo(x0+(x1-x0)*0.18,ybot0+(ybot1-ybot0)*0.18);ctx.lineTo(x0+3,ybot0);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#888';ctx.lineWidth=1.8;const mx=(x0+x1)/2;
    ctx.beginPath();ctx.moveTo(mx,(yt0+yt1)/2);ctx.lineTo(mx,(ybot0+ybot1)/2);ctx.moveTo(x0,(yt0+ybot0)/2);ctx.lineTo(x1,(yt1+ybot1)/2);ctx.stroke();
  }

  // ══════════ PARTITIONS (green) ══════════
  function drawXWall(ctx,x0,x1,y,h){
    const bl=toIso(x0,y,0),br=toIso(x1,y,0),tl=toIso(x0,y,h),tr=toIso(x1,y,h);
    const tl2=toIso(x0,y+PT,h),tr2=toIso(x1,y+PT,h);
    quad(ctx,tl,tr,br,bl,'#8fbc9e','#3d5e47',OL);
    quad(ctx,tl,tr,tr2,tl2,'#7ba88a','#3d5e47',0.7);
    const ml=toIso(x0,y,h*0.55),mr=toIso(x1,y,h*0.55);
    ctx.strokeStyle='#3d5e47';ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(ml.sx,ml.sy);ctx.lineTo(mr.sx,mr.sy);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(tl.sx+1,tl.sy);ctx.lineTo(tr.sx-1,tr.sy);ctx.stroke();
  }
  function drawYWall(ctx,x,y0,y1,h){
    const ft=toIso(x,y0,h),fb=toIso(x,y0,0),bt=toIso(x,y1,h),bb=toIso(x,y1,0);
    const ft2=toIso(x+PT,y0,h),bt2=toIso(x+PT,y1,h);
    quad(ctx,ft,bt,bb,fb,'#6d9a7c','#3d5e47',OL);
    quad(ctx,ft,bt,bt2,ft2,'#7ba88a','#3d5e47',0.7);
    const mt=toIso(x,y0,h*0.55),mb=toIso(x,y1,h*0.55);
    ctx.strokeStyle='#3d5e47';ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(mt.sx,mt.sy);ctx.lineTo(mb.sx,mb.sy);ctx.stroke();
  }
  function drawShelf(ctx,x0,x1,y,h){
    const cc=['#c0392b','#2980b9','#27ae60','#8e44ad','#f39c12','#34495e','#e67e22'];
    const n=Math.min(7,Math.floor((x1-x0)/0.16));
    for(let i=0;i<n;i++){
      const bx=x0+0.08+i*0.15,bw=0.06,bh=0.12+(i%3)*0.02;
      const c=cc[(i*3+Math.floor(x0*7))%cc.length];
      quad(ctx,toIso(bx,y+PT,h+bh),toIso(bx+bw,y+PT,h+bh),toIso(bx+bw,y+PT,h),toIso(bx,y+PT,h),c,K,0.6);
      quad(ctx,toIso(bx+bw,y,h+bh),toIso(bx+bw,y+PT,h+bh),toIso(bx+bw,y+PT,h),toIso(bx+bw,y,h),shade(c,-15),K,0.4);
    }
  }

  // ══════════ DESK ══════════
  function drawDesk(ctx,col,rowY){
    const x0=cX(col)+0.08,x1=cX(col)+CW-0.08,y0=rowY+0.06,y1=y0+DD;
    quad(ctx,toIso(x0,y0,DH),toIso(x1,y0,DH),toIso(x1,y1,DH),toIso(x0,y1,DH),'#d8b280','#6b5030',OL);
    quad(ctx,toIso(x0,y1,DH),toIso(x1,y1,DH),toIso(x1,y1,0),toIso(x0,y1,0),'#c49858','#6b5030',OL);
    quad(ctx,toIso(x1,y0,DH),toIso(x1,y1,DH),toIso(x1,y1,0),toIso(x1,y0,0),'#b88e4e','#6b5030',OL);
    const dx0=x1-0.38,dx1=x1-0.05;
    for(let i=0;i<3;i++){
      const z0=0.04+(DH-0.08)*i/3,z1=0.04+(DH-0.08)*(i+1)/3;
      quad(ctx,toIso(dx0,y1,z1),toIso(dx1,y1,z1),toIso(dx1,y1,z0),toIso(dx0,y1,z0),'#c8a060','#6b5030',0.6);
      const hp=toIso((dx0+dx1)/2,y1,(z0+z1)/2);
      ctx.fillStyle='#888';ctx.strokeStyle=K;ctx.lineWidth=0.4;
      ctx.beginPath();ctx.arc(hp.sx,hp.sy,S*0.8,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
  }

  // ══════════ MONITOR ══════════
  function drawMonitor(ctx,col,rowY,active){
    const mx=cX(col)+CW*0.45,my=rowY+0.18,base=toIso(mx,my,DH);
    ctx.fillStyle='#444';ctx.strokeStyle=K;ctx.lineWidth=0.6;
    ctx.beginPath();ctx.ellipse(base.sx,base.sy,3.5*S,1.5*S,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#555';ctx.fillRect(base.sx-S*0.6,base.sy-wz(0.04),S*1.2,wz(0.04));
    const sw=0.48,sh=0.27,sB=DH+0.04,sT=sB+sh;
    const sl=toIso(mx-sw/2,my,sB),sr=toIso(mx+sw/2,my,sB),tl=toIso(mx-sw/2,my,sT),tr=toIso(mx+sw/2,my,sT);
    ctx.fillStyle='#1e1e1e';ctx.beginPath();
    ctx.moveTo(tl.sx-2,tl.sy-2);ctx.lineTo(tr.sx+2,tr.sy-2);ctx.lineTo(sr.sx+2,sr.sy+2);ctx.lineTo(sl.sx-2,sl.sy+2);
    ctx.closePath();ctx.fill();ctx.strokeStyle=K;ctx.lineWidth=OL;ctx.stroke();
    ctx.beginPath();ctx.moveTo(tl.sx,tl.sy);ctx.lineTo(tr.sx,tr.sy);ctx.lineTo(sr.sx,sr.sy);ctx.lineTo(sl.sx,sl.sy);ctx.closePath();
    if(active){
      const g=ctx.createLinearGradient(0,tl.sy,0,sl.sy);g.addColorStop(0,'#1a2535');g.addColorStop(1,'#0f1923');ctx.fillStyle=g;ctx.fill();
      const cc=['#61afef','#98c379','#e5c07b','#c678dd','#56b6c2'];
      const lH=Math.abs(sr.sy-tl.sy),lW=Math.abs(tr.sx-tl.sx);
      for(let i=0;i<5;i++){const t=(i+0.5)/6;const ly=tl.sy+lH*t+(tr.sy-tl.sy)*t;const w=lW*(0.2+((i*37+col*17)%60)/100);
        ctx.fillStyle=cc[i%5];ctx.globalAlpha=0.7;ctx.fillRect(tl.sx+2*S,ly,Math.min(w,lW-3*S),Math.max(1,0.8*S));}
      ctx.globalAlpha=1;
    }else{ctx.fillStyle='#1a1a22';ctx.fill();}
  }

  // ══════════ DESK ACCESSORIES ══════════
  function drawAccessories(ctx,col,rowY){
    const dx=cX(col)+CW*0.5,dy=rowY+0.35;
    // keyboard
    const kb=toIso(dx-0.02,dy-0.13,DH);ctx.fillStyle='#333';ctx.strokeStyle=K;ctx.lineWidth=0.6;
    const kw=5.5*S,kh=2*S;ctx.beginPath();ctx.moveTo(kb.sx,kb.sy-kh);ctx.lineTo(kb.sx+kw,kb.sy);ctx.lineTo(kb.sx,kb.sy+kh);ctx.lineTo(kb.sx-kw,kb.sy);ctx.closePath();ctx.fill();ctx.stroke();
    // mouse
    const mp=toIso(dx+0.3,dy-0.05,DH);ctx.fillStyle='#444';ctx.strokeStyle=K;ctx.lineWidth=0.5;
    ctx.beginPath();ctx.ellipse(mp.sx,mp.sy,1.3*S,0.9*S,-0.4,0,Math.PI*2);ctx.fill();ctx.stroke();
    // lamp on some desks
    if(col===0||col===3){
      const lp=toIso(cX(col)+0.2,rowY+0.12,DH);
      ctx.fillStyle='#555';ctx.strokeStyle=K;ctx.lineWidth=0.5;
      ctx.beginPath();ctx.ellipse(lp.sx,lp.sy,1.5*S,0.8*S,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      const at=lp.sy-wz(0.2);ctx.strokeStyle='#777';ctx.lineWidth=S*0.5;
      ctx.beginPath();ctx.moveTo(lp.sx,lp.sy);ctx.lineTo(lp.sx-2*S,at);ctx.stroke();
      ctx.fillStyle='#888';ctx.strokeStyle=K;ctx.lineWidth=0.5;
      ctx.beginPath();ctx.moveTo(lp.sx-5*S,at+S);ctx.lineTo(lp.sx-2*S,at-1.5*S);ctx.lineTo(lp.sx+S,at+S);ctx.closePath();ctx.fill();ctx.stroke();
    }
    // mug on others
    if(col===1||col===2){
      const mg=toIso(dx-0.28,dy-0.2,DH);ctx.fillStyle='#e8ddd0';ctx.strokeStyle=K;ctx.lineWidth=0.5;
      ctx.beginPath();ctx.ellipse(mg.sx,mg.sy,1.4*S,0.7*S,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#ddd2c2';ctx.fillRect(mg.sx-1.4*S,mg.sy,2.8*S,2.2*S);ctx.strokeStyle=K;ctx.lineWidth=0.4;ctx.strokeRect(mg.sx-1.4*S,mg.sy,2.8*S,2.2*S);
    }
  }

  // ══════════ CHAIR ══════════
  function drawChair(ctx,wx,wy,color){
    const p=toIso(wx,wy,0),cx=p.sx,cy=p.sy;
    ctx.strokeStyle='#666';ctx.lineWidth=Math.max(0.8,0.5*S);const br=4*S;
    for(let a=0;a<5;a++){const ang=a*Math.PI*2/5-Math.PI/2;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(ang)*br,cy+Math.sin(ang)*br*0.5);ctx.stroke();
      ctx.fillStyle='#555';ctx.strokeStyle=K;ctx.lineWidth=0.3;
      ctx.beginPath();ctx.arc(cx+Math.cos(ang)*br,cy+Math.sin(ang)*br*0.5,0.7*S,0,Math.PI*2);ctx.fill();ctx.stroke();}
    ctx.fillStyle='#666';ctx.fillRect(cx-0.5*S,cy-wz(0.22),S,wz(0.22));
    const sY=cy-wz(0.24),sw=5*S,sh=2.5*S;
    ctx.fillStyle=color;ctx.strokeStyle=K;ctx.lineWidth=0.7;
    ctx.beginPath();ctx.moveTo(cx,sY-sh);ctx.lineTo(cx+sw,sY);ctx.lineTo(cx,sY+sh);ctx.lineTo(cx-sw,sY);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle=shade(color,-15);ctx.beginPath();ctx.moveTo(cx-sw,sY);ctx.lineTo(cx,sY+sh);ctx.lineTo(cx,sY+sh+1.5*S);ctx.lineTo(cx-sw,sY+1.5*S);ctx.closePath();ctx.fill();ctx.strokeStyle=K;ctx.lineWidth=0.5;ctx.stroke();
    ctx.fillStyle=shade(color,-25);ctx.beginPath();ctx.moveTo(cx+sw,sY);ctx.lineTo(cx,sY+sh);ctx.lineTo(cx,sY+sh+1.5*S);ctx.lineTo(cx+sw,sY+1.5*S);ctx.closePath();ctx.fill();ctx.stroke();
    const bH=10*S,bW=4.5*S;
    ctx.fillStyle=shade(color,5);ctx.beginPath();ctx.moveTo(cx-bW,sY-bH);ctx.quadraticCurveTo(cx,sY-bH-1.5*S,cx+bW,sY-bH);ctx.lineTo(cx+bW,sY-S);ctx.lineTo(cx-bW,sY-S);ctx.closePath();ctx.fill();ctx.strokeStyle=K;ctx.lineWidth=0.8;ctx.stroke();
    ctx.fillStyle=shade(color,-20);ctx.beginPath();ctx.moveTo(cx+bW,sY-bH);ctx.lineTo(cx+bW+1.5*S,sY-bH+S);ctx.lineTo(cx+bW+1.5*S,sY);ctx.lineTo(cx+bW,sY-S);ctx.closePath();ctx.fill();ctx.stroke();
  }

  // ══════════ CHARACTER (direct canvas, bold manga lines) ══════════
  function drawCharacter(ctx,wx,wy,rowY,roster,state,frame){
    const pos=toIso(wx,wy-0.12,0),cx=pos.sx,cy=pos.sy;
    const run=state==='RUNNING',done=state==='DONE'||state==='EXITED';
    const bob=run&&frame%2===0?-0.3*S:0;
    const skin=roster.skin,shirt=roster.shirt,hair=roster.hairColor,hairT=roster.hair;
    const pants='#3a3d4a',shoes='#2a2a2e';

    const headR=3.8*S,neckW=1.8*S,shoulderW=7.5*S,torsoH=8*S,armW=2*S;
    const legW=2.2*S,kneeSpread=3.5*S,shoeW=3*S,shoeH=1.5*S;
    const seatLv=cy-wz(0.22),floorLv=cy+2*S;
    const headCY=seatLv-torsoH-2.5*S-headR*0.7+bob;
    const neckTop=headCY+headR*0.85,neckBot=neckTop+2*S;
    const shY=neckBot,tBot=shY+torsoH,kneeY=tBot+1.5*S;

    // shadow
    ctx.fillStyle='rgba(0,0,0,0.07)';ctx.beginPath();ctx.ellipse(cx,floorLv+S,7*S,2.5*S,0,0,Math.PI*2);ctx.fill();

    // shoes
    ctx.fillStyle=shoes;ctx.strokeStyle=K;ctx.lineWidth=0.7;
    roundRect(ctx,cx-kneeSpread-shoeW*0.6,floorLv-shoeH,shoeW,shoeH,S*0.4);ctx.fill();ctx.stroke();
    roundRect(ctx,cx+kneeSpread-shoeW*0.4,floorLv-shoeH,shoeW,shoeH,S*0.4);ctx.fill();ctx.stroke();

    // calves
    ctx.strokeStyle=pants;ctx.lineWidth=legW;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(cx-kneeSpread,kneeY);ctx.lineTo(cx-kneeSpread,floorLv-shoeH);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx+kneeSpread,kneeY);ctx.lineTo(cx+kneeSpread,floorLv-shoeH);ctx.stroke();
    // calf outlines
    ctx.strokeStyle=K;ctx.lineWidth=0.7;
    for(const side of[-1,1]){const sx=cx+side*kneeSpread;
      ctx.beginPath();ctx.moveTo(sx-legW/2,kneeY);ctx.lineTo(sx-legW/2,floorLv-shoeH);ctx.stroke();
      ctx.beginPath();ctx.moveTo(sx+legW/2,kneeY);ctx.lineTo(sx+legW/2,floorLv-shoeH);ctx.stroke();}
    ctx.lineCap='butt';

    // thighs
    ctx.fillStyle=pants;ctx.strokeStyle=K;ctx.lineWidth=0.7;
    ctx.beginPath();ctx.moveTo(cx-shoulderW*0.35,tBot);ctx.quadraticCurveTo(cx-kneeSpread-legW*0.3,tBot-S,cx-kneeSpread-legW/2,kneeY-legW*0.3);ctx.lineTo(cx-kneeSpread+legW/2,kneeY+legW*0.3);ctx.quadraticCurveTo(cx-kneeSpread+legW*0.3,tBot+S,cx-shoulderW*0.1,tBot+S);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx+shoulderW*0.35,tBot);ctx.quadraticCurveTo(cx+kneeSpread+legW*0.3,tBot-S,cx+kneeSpread+legW/2,kneeY-legW*0.3);ctx.lineTo(cx+kneeSpread-legW/2,kneeY+legW*0.3);ctx.quadraticCurveTo(cx+kneeSpread-legW*0.3,tBot+S,cx+shoulderW*0.1,tBot+S);ctx.closePath();ctx.fill();ctx.stroke();

    // torso
    const tG=ctx.createLinearGradient(cx-shoulderW/2,shY,cx+shoulderW/2,tBot);tG.addColorStop(0,shirt);tG.addColorStop(1,shade(shirt,-18));
    ctx.fillStyle=tG;ctx.strokeStyle=K;ctx.lineWidth=0.8;
    ctx.beginPath();ctx.moveTo(cx-shoulderW/2,shY);ctx.quadraticCurveTo(cx-shoulderW/2-S,shY+torsoH*0.3,cx-shoulderW*0.4,tBot);ctx.lineTo(cx+shoulderW*0.4,tBot);ctx.quadraticCurveTo(cx+shoulderW/2+S,shY+torsoH*0.3,cx+shoulderW/2,shY);ctx.closePath();ctx.fill();ctx.stroke();
    // collar
    ctx.fillStyle=shade(shirt,15);ctx.strokeStyle=K;ctx.lineWidth=0.5;
    ctx.beginPath();ctx.moveTo(cx-neckW-S,shY);ctx.lineTo(cx,shY+2.5*S);ctx.lineTo(cx+neckW+S,shY);ctx.closePath();ctx.fill();ctx.stroke();

    // ── ARMS (상태별 포즈) ──
    const kbY=tBot+2*S; // 키보드 높이 (허벅지 위, 책상면)
    if(done){
      // DONE: 팔을 책상 위에 올려놓고 자는 자세
      for(const side of[-1,1]){
        const shX=cx+side*shoulderW/2,shYp=shY+S;
        const handX=cx+side*2*S, handY=kbY+2*S;
        ctx.strokeStyle=shirt;ctx.lineWidth=armW;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(shX,shYp);ctx.quadraticCurveTo(shX,handY-2*S,handX,handY);ctx.stroke();
        ctx.strokeStyle=skin;ctx.lineWidth=armW*0.8;
        ctx.beginPath();ctx.moveTo(handX,handY);ctx.lineTo(cx+side*1.5*S,handY+S);ctx.stroke();
        ctx.strokeStyle=K;ctx.lineWidth=0.5;
        ctx.beginPath();ctx.moveTo(shX,shYp);ctx.quadraticCurveTo(shX,handY-2*S,cx+side*1.5*S,handY+S);ctx.stroke();
        ctx.fillStyle=skin;ctx.strokeStyle=K;ctx.lineWidth=0.4;
        ctx.beginPath();ctx.arc(cx+side*1.5*S,handY+S,1.3*S,0,Math.PI*2);ctx.fill();ctx.stroke();
      }
    }else if(run){
      // RUNNING: 키보드 타이핑 자세 (팔을 앞쪽 아래로)
      const typOff=Math.sin(frame*0.5)*0.8*S; // 타이핑 미세 움직임
      for(const side of[-1,1]){
        const shX=cx+side*shoulderW/2,shYp=shY+S;
        const handX=cx+side*3*S+(side===-1?typOff:-typOff);
        const handY=kbY;
        const elbX=shX+side*1*S,elbY=(shYp+handY)*0.5+2*S;
        ctx.strokeStyle=shirt;ctx.lineWidth=armW;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(shX,shYp);ctx.quadraticCurveTo(elbX,elbY,elbX,elbY+S);ctx.stroke();
        ctx.strokeStyle=skin;ctx.lineWidth=armW*0.85;
        ctx.beginPath();ctx.moveTo(elbX,elbY+S);ctx.lineTo(handX,handY);ctx.stroke();
        ctx.strokeStyle=K;ctx.lineWidth=0.5;
        ctx.beginPath();ctx.moveTo(shX,shYp);ctx.quadraticCurveTo(elbX,elbY,handX,handY);ctx.stroke();
        ctx.fillStyle=skin;ctx.strokeStyle=K;ctx.lineWidth=0.4;
        ctx.beginPath();ctx.arc(handX,handY,1.2*S,0,Math.PI*2);ctx.fill();ctx.stroke();
      }
    }else{
      // IDLE: 팔을 자연스럽게 내려 무릎 위에
      for(const side of[-1,1]){
        const shX=cx+side*shoulderW/2,shYp=shY+S;
        const handX=cx+side*kneeSpread*0.6, handY=tBot+3*S;
        const elbX=shX+side*1*S,elbY=(shYp+handY)*0.5+S;
        ctx.strokeStyle=shirt;ctx.lineWidth=armW;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(shX,shYp);ctx.quadraticCurveTo(elbX,elbY,elbX,elbY+2*S);ctx.stroke();
        ctx.strokeStyle=skin;ctx.lineWidth=armW*0.85;
        ctx.beginPath();ctx.moveTo(elbX,elbY+2*S);ctx.lineTo(handX,handY);ctx.stroke();
        ctx.strokeStyle=K;ctx.lineWidth=0.5;
        ctx.beginPath();ctx.moveTo(shX,shYp);ctx.quadraticCurveTo(elbX,elbY,handX,handY);ctx.stroke();
        ctx.fillStyle=skin;ctx.strokeStyle=K;ctx.lineWidth=0.4;
        ctx.beginPath();ctx.arc(handX,handY,1.3*S,0,Math.PI*2);ctx.fill();ctx.stroke();
      }
    }
    ctx.lineCap='butt';

    // ── NECK ──
    ctx.fillStyle=skin;ctx.strokeStyle=K;ctx.lineWidth=0.4;
    if(done){
      // 자는 중: 목이 앞으로 숙여짐
      ctx.fillRect(cx-neckW/2,neckTop+2*S,neckW,neckBot-neckTop-S);
    }else{
      ctx.fillRect(cx-neckW/2,neckTop,neckW,neckBot-neckTop+S);ctx.strokeRect(cx-neckW/2,neckTop,neckW,neckBot-neckTop+S);
    }

    // ── HEAD ──
    const headDrawY=done?headCY+4*S:headCY; // DONE: 고개 숙임
    // ears
    ctx.fillStyle=shade(skin,-8);ctx.strokeStyle=K;ctx.lineWidth=0.5;
    ctx.beginPath();ctx.ellipse(cx+headR*0.88,headDrawY+S*0.5,1.1*S,1.8*S,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.ellipse(cx-headR*0.88,headDrawY+S*0.5,1.1*S,1.8*S,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    // head circle
    ctx.fillStyle=skin;ctx.strokeStyle=K;ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(cx,headDrawY,headR,0,Math.PI*2);ctx.fill();ctx.stroke();

    // hair
    drawHair(ctx,cx,headDrawY,headR,hairT,hair,S);

    // ── FACE ──
    const eyeY=headDrawY+headR*0.05,eyeSp=headR*0.42,eyeW=2*S,eyeH=1.6*S;
    if(done){
      // 자는 얼굴: 눈 감고 입 살짝 벌림
      ctx.strokeStyle='#444';ctx.lineWidth=1;ctx.lineCap='round';
      ctx.beginPath();ctx.arc(cx-eyeSp,eyeY,eyeW*0.5,0.1,Math.PI-0.1);ctx.stroke();
      ctx.beginPath();ctx.arc(cx+eyeSp,eyeY,eyeW*0.5,0.1,Math.PI-0.1);ctx.stroke();ctx.lineCap='butt';
    }else{
      const po=run?Math.sin(frame*0.12)*0.5*S:0;
      // whites
      ctx.fillStyle='#fff';ctx.strokeStyle=K;ctx.lineWidth=0.6;
      ctx.beginPath();ctx.ellipse(cx-eyeSp,eyeY,eyeW,eyeH,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.ellipse(cx+eyeSp,eyeY,eyeW,eyeH,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      // bold upper lid
      ctx.strokeStyle='#1a1a2a';ctx.lineWidth=1.4;ctx.lineCap='round';
      ctx.beginPath();ctx.arc(cx-eyeSp,eyeY,eyeW,-Math.PI*0.85,-Math.PI*0.15);ctx.stroke();
      ctx.beginPath();ctx.arc(cx+eyeSp,eyeY,eyeW,-Math.PI*0.85,-Math.PI*0.15);ctx.stroke();ctx.lineCap='butt';
      // iris + pupil + highlights
      for(const sd of[-1,1]){
        const ix=cx+sd*eyeSp+po;
        const ig=ctx.createRadialGradient(ix,eyeY-eyeH*0.15,0,ix,eyeY,eyeH*0.75);
        ig.addColorStop(0,'#6b4423');ig.addColorStop(0.6,'#4a3018');ig.addColorStop(1,'#2a1a0e');
        ctx.fillStyle=ig;ctx.beginPath();ctx.arc(ix,eyeY,eyeH*0.75,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#0a0a12';ctx.beginPath();ctx.arc(ix,eyeY,eyeH*0.35,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.92)';ctx.beginPath();ctx.arc(ix+0.5*S,eyeY-0.5*S,eyeH*0.25,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.55)';ctx.beginPath();ctx.arc(ix-0.3*S,eyeY+0.35*S,eyeH*0.12,0,Math.PI*2);ctx.fill();
      }
      // eyebrows
      ctx.strokeStyle=shade(hair,-10);ctx.lineWidth=1.1;ctx.lineCap='round';
      const bY=eyeY-eyeH-1.2*S;
      ctx.beginPath();ctx.moveTo(cx-eyeSp-eyeW*0.7,bY+0.4*S);ctx.quadraticCurveTo(cx-eyeSp,bY-0.3*S,cx-eyeSp+eyeW*0.7,bY+0.3*S);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx+eyeSp-eyeW*0.7,bY+0.3*S);ctx.quadraticCurveTo(cx+eyeSp,bY-0.3*S,cx+eyeSp+eyeW*0.7,bY+0.4*S);ctx.stroke();ctx.lineCap='butt';
    }
    // nose
    ctx.fillStyle=shade(skin,-10);ctx.beginPath();ctx.moveTo(cx-0.5*S,eyeY+eyeH+S);ctx.lineTo(cx,eyeY+eyeH+2*S);ctx.lineTo(cx+0.5*S,eyeY+eyeH+S);ctx.closePath();ctx.fill();
    // mouth
    const mY=headDrawY+headR*0.58;
    if(done){
      // 자는 중: 작은 열린 입 (쿨쿨)
      ctx.fillStyle='#c08070';ctx.strokeStyle=K;ctx.lineWidth=0.4;
      ctx.beginPath();ctx.ellipse(cx,mY,0.8*S,0.5*S,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    }else if(run){
      // 일하는 중: 다문 입 (집중)
      ctx.strokeStyle='#a07060';ctx.lineWidth=0.7;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(cx-1.2*S,mY);ctx.lineTo(cx+1.2*S,mY);ctx.stroke();ctx.lineCap='butt';
    }else{
      // IDLE: 약간 미소
      ctx.strokeStyle='#a07060';ctx.lineWidth=0.7;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(cx-1.2*S,mY);ctx.quadraticCurveTo(cx,mY+0.3*S,cx+1.2*S,mY);ctx.stroke();ctx.lineCap='butt';
    }
  }

  function drawHair(ctx,cx,cy,R,type,color,s){
    ctx.fillStyle=color;ctx.strokeStyle=K;ctx.lineWidth=0.8;
    if(type==='hair-short'){ctx.beginPath();ctx.arc(cx,cy,R+0.5*s,-Math.PI*0.92,-Math.PI*0.08);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=shade(color,-8);ctx.fillRect(cx-R-0.3*s,cy-R*0.2,0.8*s,R*0.5);ctx.fillRect(cx+R-0.5*s,cy-R*0.2,0.8*s,R*0.5);}
    else if(type==='hair-long'){ctx.beginPath();ctx.arc(cx,cy,R+s,-Math.PI*0.88,-Math.PI*0.12);ctx.lineTo(cx+R+s,cy+R*0.8);ctx.quadraticCurveTo(cx+R*0.5,cy+R*1.1,cx,cy+R*0.9);ctx.quadraticCurveTo(cx-R*0.5,cy+R*1.1,cx-R-s,cy+R*0.8);ctx.closePath();ctx.fill();ctx.stroke();}
    else if(type==='hair-spiky'){ctx.beginPath();ctx.arc(cx,cy,R+0.5*s,-Math.PI,0);ctx.closePath();ctx.fill();ctx.stroke();for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(cx+i*R*0.28-s,cy-R*0.35);ctx.lineTo(cx+i*R*0.28,cy-R*1.35-Math.abs(i)*0.5*s);ctx.lineTo(cx+i*R*0.28+s,cy-R*0.35);ctx.closePath();ctx.fill();ctx.stroke();}}
    else if(type==='hair-curly'){for(let i=-2;i<=2;i++){ctx.beginPath();ctx.arc(cx+i*R*0.32,cy-R*0.5,R*0.38,0,Math.PI*2);ctx.fill();ctx.stroke();}for(let i=-1;i<=1;i++){ctx.beginPath();ctx.arc(cx+i*R*0.38,cy-R*0.82,R*0.3,0,Math.PI*2);ctx.fill();ctx.stroke();}}
    else if(type==='hair-mohawk'){ctx.beginPath();ctx.arc(cx,cy,R+0.5*s,-Math.PI*0.82,-Math.PI*0.18);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(cx-2*s,cy-R*0.4);ctx.quadraticCurveTo(cx,cy-R*1.8,cx+2*s,cy-R*0.4);ctx.closePath();ctx.fill();ctx.stroke();}
    else if(type==='hair-bun'){ctx.beginPath();ctx.arc(cx,cy,R+0.5*s,-Math.PI,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(cx,cy-R-2*s,2.5*s,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle=shade(color,-20);ctx.lineWidth=0.6;ctx.beginPath();ctx.arc(cx,cy-R-0.5*s,1.5*s,0,Math.PI*2);ctx.stroke();}
    else if(type==='hair-parted'){ctx.beginPath();ctx.arc(cx,cy,R+0.5*s,-Math.PI*0.92,-0.08);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle=shade(color,18);ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(cx+R*0.2,cy-R);ctx.lineTo(cx+R*0.25,cy-R*0.25);ctx.stroke();}
    else if(type==='hair-ponytail'){ctx.beginPath();ctx.arc(cx,cy,R+0.5*s,-Math.PI,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(cx+R*0.35,cy-R*0.15);ctx.quadraticCurveTo(cx+R*1.5,cy-R*0.4,cx+R*1.4,cy+R*0.45);ctx.quadraticCurveTo(cx+R*1.1,cy+R*0.55,cx+R*0.5,cy+R*0.15);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#cc4444';ctx.beginPath();ctx.arc(cx+R*0.45,cy-R*0.05,1.2*s,0,Math.PI*2);ctx.fill();}
  }

  // ══════════ OVERLAYS ══════════
  function drawBubble(ctx,cx,cy,text){
    const fs=Math.max(7,4.5*S);ctx.font=`bold ${fs}px 'Segoe UI',sans-serif`;
    const tw=ctx.measureText(text).width;const bw=tw+10,bh=fs+8;
    const bx=cx-bw/2,by=cy-wz(0.75);
    roundRect(ctx,bx+1,by+1,bw,bh,4);ctx.fillStyle='rgba(0,0,0,0.08)';ctx.fill();
    roundRect(ctx,bx,by,bw,bh,4);ctx.fillStyle='rgba(255,255,255,0.96)';ctx.fill();ctx.strokeStyle=K;ctx.lineWidth=0.8;ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.96)';ctx.beginPath();ctx.moveTo(cx-4,by+bh);ctx.lineTo(cx,by+bh+5);ctx.lineTo(cx+4,by+bh);ctx.closePath();ctx.fill();
    ctx.strokeStyle=K;ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(cx-4,by+bh);ctx.lineTo(cx,by+bh+5);ctx.lineTo(cx+4,by+bh);ctx.stroke();
    ctx.fillStyle='#222';ctx.textAlign='center';ctx.fillText(text,cx,by+bh-4);ctx.textAlign='start';
  }
  function drawZzz(ctx,cx,cy,frame){
    const zy=cy-wz(0.7),d=Math.sin(frame*0.2)*2*S;
    ctx.font=`bold ${6*S}px 'Segoe UI',sans-serif`;ctx.fillStyle='rgba(80,90,120,0.5)';ctx.fillText('z',cx+5*S,zy+d);
    ctx.font=`bold ${9*S}px 'Segoe UI',sans-serif`;ctx.fillStyle='rgba(80,90,120,0.3)';ctx.fillText('Z',cx+10*S,zy-6*S+d*0.6);
  }
  function drawProgress(ctx,cx,cy,pct,running){
    const pw=16*S,ph=2*S,x0=cx-pw/2,y0=cy+3*S;
    roundRect(ctx,x0,y0,pw,ph,ph/2);ctx.fillStyle='rgba(0,0,0,0.08)';ctx.fill();ctx.strokeStyle=K;ctx.lineWidth=0.3;ctx.stroke();
    if(pct>0){roundRect(ctx,x0,y0,Math.max(ph,pw*pct/100),ph,ph/2);
      if(running){const pg=ctx.createLinearGradient(x0,0,x0+pw*pct/100,0);pg.addColorStop(0,'#10b981');pg.addColorStop(1,'#34d399');ctx.fillStyle=pg;}else{ctx.fillStyle='#94a3b8';}ctx.fill();}
  }

  // ══════════ MAIN RENDER ══════════
  let animFrame=0;
  function render(canvas,roster,assigned,bubbleMsgs){
    const ctx=canvas.getContext('2d');const dpr=window.devicePixelRatio||1;
    const W=canvas.width/dpr,H=canvas.height/dpr;
    TW=Math.max(16,Math.round(W*0.82/(RW+RD)));TH=Math.round(TW/2);S=TW/32;
    ctx.clearRect(0,0,W,H);
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#dcd5ca');bg.addColorStop(1,'#d0c9b5');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    const fc=toIso(RW/2,RD/2,0),ox=W/2-fc.sx,oy=H*0.52-fc.sy;
    ctx.save();ctx.translate(ox,oy);
    drawRoom(ctx);

    // ── X-WALL at R1 (뒷줄 모니터 앞 가림벽) ──
    drawXWall(ctx,cX(0),cX(COLS),R1,PH);
    drawShelf(ctx,cX(0),cX(COLS),R1,PH);

    // ── BACK ROW ──
    for(let c=0;c<COLS;c++){
      if(c>0) drawYWall(ctx,cX(c),R1,R1+CD,PH);
      const r=roster[c],a=assigned[c],state=a?a.state:'IDLE';
      drawDesk(ctx,c,R1);drawMonitor(ctx,c,R1,state==='RUNNING');drawAccessories(ctx,c,R1);
      drawChair(ctx,SEATS[c].wx,SEATS[c].wy,r.chair);
      drawCharacter(ctx,SEATS[c].wx,SEATS[c].wy,R1,r,state,animFrame);
    }
    drawYWall(ctx,cX(COLS),R1,R1+CD,PH);

    // ── CENTER AISLE (R1+CD ~ R2 개방, 출입 통로) ──

    // ── X-WALL at R2 (앞줄 모니터 앞 가림벽) ──
    drawXWall(ctx,cX(0),cX(COLS),R2,PH);
    drawShelf(ctx,cX(0),cX(COLS),R2,PH);

    // ── FRONT ROW ──
    for(let c=0;c<COLS;c++){
      if(c>0) drawYWall(ctx,cX(c),R2,R2+CD,PH);
      const idx=COLS+c,r=roster[idx],a=assigned[idx],state=a?a.state:'IDLE';
      drawDesk(ctx,c,R2);drawMonitor(ctx,c,R2,state==='RUNNING');drawAccessories(ctx,c,R2);
      drawChair(ctx,SEATS[idx].wx,SEATS[idx].wy,r.chair);
      drawCharacter(ctx,SEATS[idx].wx,SEATS[idx].wy,R2,r,state,animFrame);
    }
    drawYWall(ctx,cX(COLS),R2,R2+CD,PH);

    // ── OVERLAYS (only bubbles, zzz, progress — no badge/label) ──
    for(let i=0;i<8;i++){
      const r=roster[i],a=assigned[i],state=a?a.state:'IDLE';
      const prog=a?Math.max(0,Math.min(100,a.progress)):0;
      const run=state==='RUNNING',done=state==='DONE'||state==='EXITED';
      const p=toIso(SEATS[i].wx,SEATS[i].wy-0.15,0);
      if(run){
        const msgs=bubbleMsgs[r.engine]||bubbleMsgs['default']||['...'];
        const msg=msgs[Math.floor((Date.now()/4000+i)%msgs.length)];
        drawBubble(ctx,p.sx,p.sy,`${r.engine.toUpperCase()} ${r.ver}: ${msg}`);
      }else if(done){drawZzz(ctx,p.sx,p.sy,animFrame);}
      if(prog>0) drawProgress(ctx,p.sx,p.sy,prog,run);
    }

    ctx.restore();animFrame++;
  }

  return {render,SEATS};
})();
