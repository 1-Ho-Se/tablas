/* Constelación ×: cartoon streak fire around the whole screen edge, and the frost that puts it out.
   The fire canvas sits behind the game UI, so flames hug the border and never cover the controls.
   Colors blend smoothly between tiers; the background crossfades with them.
   Snow and steam use a second canvas above everything (freeze animation). */
(function(){
"use strict";
const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const TIER_IDS=['red','orange','blue','platinum','rainbow'];
const fireCv=document.createElement('canvas');fireCv.id='fire';fireCv.setAttribute('aria-hidden','true');
const cv=document.createElement('canvas');cv.id='fx';cv.setAttribute('aria-hidden','true');
const frost=document.createElement('div');frost.id='frost';frost.setAttribute('aria-hidden','true');
const bg=document.createElement('div');bg.id='firebg';bg.setAttribute('aria-hidden','true');
bg.innerHTML=TIER_IDS.map(t=>`<div class="fb-${t}"></div>`).join('');
document.addEventListener('DOMContentLoaded',()=>{document.body.prepend(fireCv);document.body.prepend(bg);document.body.appendChild(cv);document.body.appendChild(frost);resize()});
const fctx=fireCv.getContext('2d'), ctx=cv.getContext('2d');let W=0,H=0,dpr=1;
let tongues=[];
function resize(){dpr=Math.min(2,window.devicePixelRatio||1);W=innerWidth;H=innerHeight;
  for(const [c,g] of [[fireCv,fctx],[cv,ctx]]){c.width=W*dpr;c.height=H*dpr;g.setTransform(dpr,0,0,dpr,0,0)}
  buildTongues()}
addEventListener('resize',resize);

/* ---------- flame layout: a row of tongues along each edge, pointing inward ---------- */
const PER=Math.PI*2;
function buildTongues(){tongues=[];const per=2*(W+H);let off=0;
  const sides=[['top',W],['right',H],['bottom',W],['left',H]];
  for(const [side,len] of sides){const step=32;const n=Math.max(2,Math.round(len/step));
    for(let i=0;i<=n;i++){const pos=i/n*len;
      tongues.push({side,pos,along:(off+pos)/per,w:34+Math.random()*16,hm:.75+Math.random()*.5,ph:Math.random()*PER,sp:2.2+Math.random()*1.8,big:i%3===1})}
    off+=len}}
function toScreen(t,x,y){switch(t.side){case'top':return[t.pos+x,y];case'bottom':return[t.pos-x,H-y];case'left':return[y,t.pos-x];default:return[W-y,t.pos+x]}}
function tonguePath(g,t,w,h,sway,lean){const P=(x,y)=>toScreen(t,x,y);
  const a=P(-w/2,-4),c1=P(-w*.8,h*.36),c2=P(sway-w*.42+lean,h*.78),tip=P(sway,h),c3=P(sway+w*.3+lean,h*.74),c4=P(w*.8,h*.32),b=P(w/2,-4);
  g.moveTo(a[0],a[1]);g.bezierCurveTo(c1[0],c1[1],c2[0],c2[1],tip[0],tip[1]);g.bezierCurveTo(c3[0],c3[1],c4[0],c4[1],b[0],b[1]);g.closePath()}

/* ---------- palettes per streak tier, as RGB so they can blend ---------- */
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const PAL={
  red:     {o:hex('#c91d10'),m:hex('#ff3f1f'),c:hex('#ffb12e')},
  orange:  {o:hex('#ff4f12'),m:hex('#ff8c17'),c:hex('#ffe94d')},
  blue:    {o:hex('#1238ff'),m:hex('#2e8cff'),c:hex('#c8f3ff')},
  platinum:{o:hex('#8e9bb0'),m:hex('#dfe6ef'),c:hex('#fff8e8')}};
function hsl2rgb(h,s,l){h=((h%360)+360)%360/360;s/=100;l/=100;const f=n=>{const k=(n+h*12)%12,a=s*Math.min(l,1-l);return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))))};return[f(0),f(8),f(4)]}
function raw(t,tg,T){if(t!=='rainbow')return PAL[t];const h=tg.along*360+T*90;return{o:hsl2rgb(h,92,48),m:hsl2rgb(h+25,96,58),c:hsl2rgb(h+50,100,82)}}
const mix=(a,b,k)=>`rgb(${Math.round(a[0]+(b[0]-a[0])*k)},${Math.round(a[1]+(b[1]-a[1])*k)},${Math.round(a[2]+(b[2]-a[2])*k)})`;
const ease=k=>k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;

let tier=null,prev=null,blend=1,level=0,grow=0,growTarget=0,embers=[],sparks=[],steam=[],flakes=[],running=false,t0=performance.now(),time=0;
function depth(){const s=Math.min(W,H);return Math.min(46,Math.max(30,s*.085))*(1+Math.min(level,25)*.012)}
/* how much of tier x is showing right now (0..1) */
const weight=x=>(tier===x?ease(blend):0)+(prev===x&&prev!==tier?1-ease(blend):0);
function colorOf(tg,key,T){return mix(raw(prev||tier,tg,T)[key],raw(tier,tg,T)[key],ease(blend))}

function drawFire(dt){fctx.clearRect(0,0,W,H);if(grow<=.01||!tier)return;
  const D=depth()*grow, T=reduce?0:time;
  const perTongue=tier==='rainbow'||prev==='rainbow';
  /* blue: neon halo pulsing around the flames */
  const wb=weight('blue');
  if(wb>.01){fctx.globalCompositeOperation='lighter';fctx.globalAlpha=(.28+.14*Math.sin(T*6))*wb;fctx.fillStyle='#3aa0ff';fctx.beginPath();
    for(const tg of tongues){const h=D*tg.hm*1.35*(.75+.25*Math.sin(T*tg.sp+tg.ph));tonguePath(fctx,tg,tg.w*1.5,h,Math.sin(T*tg.sp*1.3+tg.ph*2)*tg.w*.35,0)}
    fctx.fill();fctx.globalAlpha=1;fctx.globalCompositeOperation='source-over'}
  for(const [key,ws,hs] of [['o',1,1],['m',.66,.68],['c',.36,.4]]){
    if(!perTongue){fctx.fillStyle=colorOf(tongues[0],key,T);fctx.beginPath()}
    for(const tg of tongues){const h=D*tg.hm*hs*(.74+.26*Math.sin(T*tg.sp+tg.ph))*(tg.big?1.12:1);
      const sway=Math.sin(T*tg.sp*1.3+tg.ph*2+hs)*tg.w*.33,lean=Math.sin(T*tg.sp*.7+tg.ph)*tg.w*.12;
      if(perTongue){fctx.fillStyle=colorOf(tg,key,T);fctx.beginPath();tonguePath(fctx,tg,tg.w*ws,h,sway,lean);fctx.fill()}
      else tonguePath(fctx,tg,tg.w*ws,h,sway,lean)}
    if(!perTongue)fctx.fill()}
  /* solid hot band right at the edge */
  const band=D*.22;fctx.fillStyle=perTongue?'#ffffff':colorOf(tongues[0],'c',T);
  fctx.fillRect(0,0,W,band);fctx.fillRect(0,H-band,W,band);fctx.fillRect(0,0,band,H);fctx.fillRect(W-band,0,band,H);
  /* platinum: metallic shine sweeping around the border + twinkling glints */
  const wp=weight('platinum');
  if(wp>.01){const sweep=(T*.18)%1;fctx.globalCompositeOperation='lighter';
    for(const tg of tongues){let d=Math.abs(tg.along-sweep);d=Math.min(d,1-d);if(d>.06)continue;
      fctx.globalAlpha=(1-d/.06)*.9*wp;fctx.fillStyle='#ffffff';fctx.beginPath();tonguePath(fctx,tg,tg.w*.5,D*tg.hm*.8,0,0);fctx.fill()}
    fctx.globalAlpha=1;fctx.globalCompositeOperation='source-over';
    if(!reduce&&Math.random()<.35*dt*wp){const tg=tongues[Math.floor(Math.random()*tongues.length)];const p=toScreen(tg,(Math.random()-.5)*tg.w,D*(.3+Math.random()*.7));sparks.push({x:p[0],y:p[1],life:1,s:5+Math.random()*7})}}
  for(let i=sparks.length-1;i>=0;i--){const s=sparks[i];s.life-=.04*dt;if(s.life<=0){sparks.splice(i,1);continue}
    const r=s.s*Math.sin(s.life*Math.PI);fctx.fillStyle='#ffffff';fctx.beginPath();
    fctx.moveTo(s.x,s.y-r);fctx.quadraticCurveTo(s.x,s.y,s.x+r,s.y);fctx.quadraticCurveTo(s.x,s.y,s.x,s.y+r);fctx.quadraticCurveTo(s.x,s.y,s.x-r,s.y);fctx.quadraticCurveTo(s.x,s.y,s.x,s.y-r);fctx.fill()}
  /* cartoon embers that break off the tips and float inward */
  if(!reduce&&grow>.9&&Math.random()<(.5+level*.04)*dt){const tg=tongues[Math.floor(Math.random()*tongues.length)];const p=toScreen(tg,0,D*tg.hm);
    const q=toScreen(tg,0,D*tg.hm+1);embers.push({x:p[0],y:p[1],vx:(q[0]-p[0])*.9+(Math.random()-.5)*.4,vy:(q[1]-p[1])*.9+(Math.random()-.5)*.4,r:3+Math.random()*4,life:1,tg})}
  for(let i=embers.length-1;i>=0;i--){const e=embers[i];e.x+=e.vx*dt;e.y+=e.vy*dt;e.life-=.025*dt;if(e.life<=0){embers.splice(i,1);continue}
    fctx.fillStyle=colorOf(e.tg,e.life>.5?'m':'o',T);fctx.beginPath();fctx.arc(e.x,e.y,e.r*e.life,0,PER);fctx.fill()}}

function drawFx(dt,now){ctx.clearRect(0,0,W,H);
  for(let i=steam.length-1;i>=0;i--){const p=steam[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=p.decay*dt;p.size*=1.006;if(p.life<=0){steam.splice(i,1);continue}
    ctx.globalAlpha=Math.max(0,Math.min(1,p.life))*.35;ctx.drawImage(steamS(),p.x-p.size/2,p.y-p.size/2,p.size,p.size)}
  for(let i=flakes.length-1;i>=0;i--){const f=flakes[i];f.y+=f.vy*dt;f.x+=Math.sin((now/400)+f.ph)*.6*dt;f.life-=.008*dt;
    if(f.life<=0||f.y>H+20){flakes.splice(i,1);continue}
    ctx.globalAlpha=Math.min(1,f.life);ctx.drawImage(snowS(),f.x-f.s/2,f.y-f.s/2,f.s,f.s)}
  ctx.globalAlpha=1}
function frame(now){const dt=Math.min(3,(now-t0)/16.7);t0=now;time+=dt/60;
  grow+=(growTarget-grow)*Math.min(1,.18*dt);if(Math.abs(growTarget-grow)<.005)grow=growTarget;
  if(blend<1){blend=Math.min(1,blend+dt/50);if(blend>=1)prev=tier}
  drawFire(dt);drawFx(dt,now);
  if(tier||grow>0||embers.length||steam.length||flakes.length||sparks.length)requestAnimationFrame(frame);else{running=false;fctx.clearRect(0,0,W,H);ctx.clearRect(0,0,W,H)}}
function loop(){if(!running){running=true;t0=performance.now();requestAnimationFrame(frame)}}

/* soft sprites for steam and snow (freeze animation) */
const sprites={};
function sprite(key,cols){if(sprites[key])return sprites[key];const s=document.createElement('canvas');s.width=s.height=64;const g=s.getContext('2d');
  const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,cols[0]);r.addColorStop(.35,cols[1]);r.addColorStop(.7,cols[2]+'88');r.addColorStop(1,cols[2]+'00');
  g.fillStyle=r;g.fillRect(0,0,64,64);return sprites[key]=s}
const steamS=()=>sprite('steam',['#ffffff','#c9d6e6','#8899aa']);
const snowS=()=>sprite('snow',['#ffffff','#e3f4ff','#9fd4ff']);

let offTimer=null;
function paintBg(id){bg.querySelectorAll('div').forEach(d=>d.classList.toggle('on',!!id&&d.classList.contains('fb-'+id)))}
function set(t,n){level=n||0;const id=t?t.id:null;
  document.body.classList.toggle('onfire',!!id);
  TIER_IDS.forEach(x=>document.body.classList.toggle('fire-'+x,x===id));
  paintBg(id);
  if(id){clearTimeout(offTimer);
    if(!tier||growTarget===0){tier=id;prev=id;blend=1}
    else if(id!==tier){prev=blend<1?prev:tier;tier=id;blend=0}
    growTarget=1;loop()}
  else{growTarget=0;if(grow>0)loop();offTimer=setTimeout(()=>{if(growTarget===0){tier=null;prev=null}},700)}}
function toSteam(n){if(!tier||grow<.05)return;const D=depth();for(let i=0;i<n;i++){const tg=tongues[Math.floor(Math.random()*tongues.length)];const p=toScreen(tg,0,D*.6);
  steam.push({x:p[0],y:p[1],vx:(Math.random()-.5)*.6,vy:-(0.5+Math.random()),size:30+Math.random()*30,life:.8,decay:.015})}}
function freeze(){toSteam(90);set(null);frost.classList.remove('on');void frost.offsetWidth;frost.classList.add('on');
  document.body.classList.add('freezing');setTimeout(()=>document.body.classList.remove('freezing'),1800);
  if(!reduce){for(let i=0;i<70;i++)flakes.push({x:Math.random()*W,y:-20-Math.random()*H*.5,vy:1.2+Math.random()*2.2,s:6+Math.random()*12,life:1.6,ph:Math.random()*6})}loop()}
function fizzle(){toSteam(40);set(null);loop()}
window.FX={set,freeze,fizzle};
})();
