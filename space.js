/* Constelación ×: space background for the start screens.
   Famous constellations drawn with the operation symbols × ÷ + − as their stars. */
(function(){
"use strict";
const host=document.getElementById('space');if(!host)return;
const SYM=[['×','#ffd36e'],['÷','#8fc3ff'],['+','#6ee8b4'],['−','#ff9ad5']];
/* star positions are normalized to the shape's own box; m = magnitude (1 bright, 3 faint) */
const C={
  orion:{name:'Orión',ar:.62,stars:[[.45,0,3],[.12,.14,1],[.82,.2,2],[.36,.5,2],[.5,.46,2],[.64,.42,2],[.2,.95,2],[.9,.88,1]],
    lines:[[0,1],[0,2],[1,3],[2,5],[3,4],[4,5],[3,6],[5,7]]},
  osa:{name:'Osa Mayor',ar:1.7,stars:[[0,.12,2],[.17,.22,2],[.33,.3,2],[.5,.38,3],[.56,.78,2],[.94,.86,2],[.98,.42,1]],
    lines:[[0,1],[1,2],[2,3],[3,6],[6,5],[5,4],[4,3]]},
  casiopea:{name:'Casiopea',ar:2.1,stars:[[0,.25,2],[.25,.85,2],[.5,.5,1],[.75,.95,2],[1,.1,2]],lines:[[0,1],[1,2],[2,3],[3,4]]},
  cruz:{name:'Cruz del Sur',ar:.8,stars:[[.5,0,2],[.48,1,1],[.05,.45,1],[.92,.36,2],[.72,.64,3]],lines:[[0,1],[2,3]]}
};
/* where each one sits, as fractions of the screen {x,y,w,h} */
const LAYOUT={
  tall:{casiopea:[.06,.265,.42,.075],osa:[.50,.30,.44,.11],orion:[.07,.725,.28,.175],cruz:[.70,.75,.22,.14]},
  wide:{casiopea:[.70,.08,.24,.12],osa:[.04,.10,.24,.16],orion:[.06,.56,.16,.36],cruz:[.80,.60,.13,.26]}
};
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
function draw(){
  const W=innerWidth,H=innerHeight,u=Math.min(W,H);seed=7;const L=Object.assign({},W/H<.9?LAYOUT.tall:LAYOUT.wide);
  /* on the home menu, fit the constellations into the empty gaps around the buttons */
  const r=sel=>{const e=document.querySelector(sel);return e&&e.offsetParent?e.getBoundingClientRect():null};
  const logo=r('#v-home .logo'),m1=r('#v-home .modes'),m2=r('#v-home .rail'),sync=r('#syncState');
  const menu=m1&&m2?{top:Math.min(m1.top,m2.top),bottom:Math.max(m1.bottom,m2.bottom)}:null;
  if(logo&&menu&&W/H<.9){const top=logo.bottom+6,gap1=menu.top-6-top;
    if(gap1>55){L.casiopea=[.05,top/H,.43,gap1*.62/H];L.osa=[.5,(top+gap1*.28)/H,.45,gap1*.7/H]}
    const bot=menu.bottom+6,gap2=(sync?sync.top-4:H-20)-bot;
    if(gap2>70){const lab=Math.min(u*.06,gap2*.25);L.orion=[.07,bot/H,.3,(gap2-lab)/H];L.cruz=[.68,(bot+gap2*.1)/H,.24,(gap2*.9-lab)/H]}}
  let s=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  /* background dust */
  const n=Math.round(W*H/5200);
  for(let i=0;i<n;i++){const r=rnd()<.9?.6+rnd()*.7:1.4+rnd()*.8,o=(.35+rnd()*.6).toFixed(2);
    s+=`<circle class="tw" cx="${(rnd()*W).toFixed(1)}" cy="${(rnd()*H).toFixed(1)}" r="${r.toFixed(2)}" fill="#dfe6ff" style="--o:${o};--d:${(2.5+rnd()*4).toFixed(1)}s;--l:-${(rnd()*6).toFixed(1)}s" opacity="${o}"/>`}
  /* constellations */
  let k=0;
  for(const id in L){const c=C[id],[bx,by,bw,bh]=L[id];let w=bw*W,h=bh*H;
    if(w/h>c.ar)w=h*c.ar;else h=w/c.ar;const x0=bx*W+(bw*W-w)/2,y0=by*H+(bh*H-h)/2;
    const k2=Math.min(1,Math.max(.55,Math.min(w,h)/(u*.2)));const P=c.stars.map(([x,y,m])=>[x0+x*w,y0+y*h,m]);
    s+=c.lines.map(([a,b])=>`<line class="cline" x1="${P[a][0].toFixed(1)}" y1="${P[a][1].toFixed(1)}" x2="${P[b][0].toFixed(1)}" y2="${P[b][1].toFixed(1)}"/>`).join('');
    P.forEach(([x,y,m])=>{const[ch,col]=SYM[k++%4],fs=k2*u*(m===1?.062:m===2?.046:.034);
      s+=`<text class="csym cstar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${fs.toFixed(1)}" fill="${col}" filter="url(#glow)" style="--d:${(3+rnd()*4).toFixed(1)}s;--l:-${(rnd()*5).toFixed(1)}s">${ch}</text>`});
    const ly=Math.max(...P.map(p=>p[1]))+u*.05*k2;
    s+=`<text class="cname" x="${(x0+w/2).toFixed(1)}" y="${Math.min(H-6,ly).toFixed(1)}" text-anchor="middle">${c.name}</text>`}
  host.innerHTML=s+'</svg>'}
let t=null;addEventListener('resize',()=>{clearTimeout(t);t=setTimeout(draw,150)});
draw();
window.SPACE={draw};
})();
