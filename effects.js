/* Constelación ×: streak fire in the four corners, and the frost that puts it out. */
(function(){
"use strict";
const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const cv=document.createElement('canvas');cv.id='fx';cv.setAttribute('aria-hidden','true');
const frost=document.createElement('div');frost.id='frost';frost.setAttribute('aria-hidden','true');
document.addEventListener('DOMContentLoaded',()=>{document.body.appendChild(cv);document.body.appendChild(frost);resize()});
const ctx=cv.getContext('2d');let W=0,H=0,dpr=1;
function resize(){dpr=Math.min(2,window.devicePixelRatio||1);W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener('resize',resize);

const PAL={red:['#fff3b0','#ff5a2e','#d1100b'],orange:['#fff7c9','#ffb03a','#ff6a00'],blue:['#f0f9ff','#6cc0ff','#1d54ff'],platinum:['#ffffff','#e6edf6','#8fa3bd']};
const sprites={};
function sprite(key,cols){if(sprites[key])return sprites[key];const s=document.createElement('canvas');s.width=s.height=64;const g=s.getContext('2d');
  const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,cols[0]);r.addColorStop(.35,cols[1]);r.addColorStop(.7,cols[2]+'88');r.addColorStop(1,cols[2]+'00');
  g.fillStyle=r;g.fillRect(0,0,64,64);return sprites[key]=s}
function hsl(h,l){return`hsl(${h},100%,${l}%)`}
function hueSprite(h){h=Math.round(h/15)*15%360;const key='h'+h;if(sprites[key])return sprites[key];
  const s=document.createElement('canvas');s.width=s.height=64;const g=s.getContext('2d');const r=g.createRadialGradient(32,32,0,32,32,32);
  r.addColorStop(0,'#ffffff');r.addColorStop(.35,hsl(h,62));r.addColorStop(.7,`hsla(${h},100%,45%,.5)`);r.addColorStop(1,`hsla(${h},100%,40%,0)`);g.fillStyle=r;g.fillRect(0,0,64,64);return sprites[key]=s}
const steamS=()=>sprite('steam',['#ffffff','#c9d6e6','#8899aa']);
const snowS=()=>sprite('snow',['#ffffff','#e3f4ff','#9fd4ff']);

let tier=null, level=0, parts=[], flakes=[], running=false, t0=performance.now(), hueT=0;
function spawn(){const n=Math.round(2+Math.min(level,25)*.35);const sz=Math.min(W,H);const base=sz*.07+Math.min(level,25)*sz*.0035;
  for(let i=0;i<n;i++){for(const c of [[0,1],[1,1],[0,0],[1,0]]){const[cx,cy]=c;const bottom=cy===1;
    const inward=(cx?-1:1);
    parts.push({x:cx*W+inward*Math.random()*base*.6,y:cy*H+(bottom?-1:1)*Math.random()*base*.3,
      vx:inward*(.3+Math.random()*1.4)*(bottom?.5:1.4),vy:bottom?-(1.4+Math.random()*2.2):(.3+Math.random()*1.1),
      life:1,decay:.012+Math.random()*.02,size:base*(.45+Math.random()*.7),h:hueT+Math.random()*60,kind:'f',t:tier})}}}
function frame(now){const dt=Math.min(3,(now-t0)/16.7);t0=now;hueT=(hueT+2*dt)%360;
  ctx.clearRect(0,0,W,H);ctx.globalCompositeOperation='lighter';
  if(tier&&!reduce)spawn();
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=p.decay*dt;
    if(p.kind==='f'){p.vx*=.985;p.size*=.992}else{p.vy-=.02*dt;p.size*=1.006}
    if(p.life<=0){parts.splice(i,1);continue}
    let img;if(p.kind==='s')img=steamS();else if(p.t==='rainbow')img=hueSprite(p.h);else img=sprite(p.t,PAL[p.t]);
    ctx.globalAlpha=Math.max(0,Math.min(1,p.life))*(p.kind==='s'?.35:.9);const s=p.size;ctx.drawImage(img,p.x-s/2,p.y-s/2,s,s)}
  ctx.globalCompositeOperation='source-over';
  for(let i=flakes.length-1;i>=0;i--){const f=flakes[i];f.y+=f.vy*dt;f.x+=Math.sin((now/400)+f.ph)*.6*dt;f.life-=.008*dt;
    if(f.life<=0||f.y>H+20){flakes.splice(i,1);continue}
    ctx.globalAlpha=Math.min(1,f.life);ctx.drawImage(snowS(),f.x-f.s/2,f.y-f.s/2,f.s,f.s)}
  ctx.globalAlpha=1;
  if(tier||parts.length||flakes.length){requestAnimationFrame(frame)}else{running=false;ctx.clearRect(0,0,W,H)}}
function loop(){if(!running){running=true;t0=performance.now();requestAnimationFrame(frame)}}

function set(t,n){level=n||0;const id=t?t.id:null;
  document.body.classList.toggle('onfire',!!id);
  ['red','orange','blue','platinum','rainbow'].forEach(x=>document.body.classList.toggle('fire-'+x,x===id));
  tier=id;if(id&&!reduce)loop()}
function toSteam(){parts.forEach(p=>{if(p.kind==='f'){p.kind='s';p.vy=-(0.5+Math.random());p.vx*=.3;p.decay=.015;p.life=Math.min(p.life,.8)}})}
function freeze(){toSteam();set(null);frost.classList.remove('on');void frost.offsetWidth;frost.classList.add('on');
  document.body.classList.add('freezing');setTimeout(()=>document.body.classList.remove('freezing'),1800);
  if(!reduce){for(let i=0;i<70;i++)flakes.push({x:Math.random()*W,y:-20-Math.random()*H*.5,vy:1.2+Math.random()*2.2,s:6+Math.random()*12,life:1.6,ph:Math.random()*6});loop()}}
function fizzle(){toSteam();set(null);if(!reduce)loop()}
window.FX={set,freeze,fizzle};
})();
