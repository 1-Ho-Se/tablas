/* Constelación ×: shared helpers for the student app and the tutor panel. */
(function(){
"use strict";
const DAY=864e5;
/* Each operation has 45 fact families: pairs a<=b from 2..10. Key: op + a + '_' + b, e.g. "m7_8". */
const OPS={
  m:{name:'Multiplicación',fun:'Supernova',tag:'Multiplica y haz explotar las estrellas',sym:'×',res:(a,b)=>a*b},
  d:{name:'División',fun:'Lluvia de meteoros',tag:'Divide y parte los meteoros',sym:'÷',res:(a,b)=>a*b},
  a:{name:'Suma',fun:'Fusión estelar',tag:'Suma y junta la energía',sym:'+',res:(a,b)=>a+b},
  s:{name:'Resta',fun:'Agujero negro',tag:'Resta antes de que te trague',sym:'−',res:(a,b)=>a+b}
};
const OP_LIST=['m','d','a','s'];
const PAIRS=[];for(let a=2;a<=10;a++)for(let b=a;b<=10;b++)PAIRS.push([a,b]);
const FACTS={};OP_LIST.forEach(op=>FACTS[op]=PAIRS.map(([a,b])=>op+a+'_'+b));
const ALL_FACTS=OP_LIST.flatMap(op=>FACTS[op]);
const parts=k=>{const m=k.match(/^([masd])(\d+)_(\d+)$/);return[m[1],+m[2],+m[3]]};
const keyOf=(op,a,b)=>op+Math.min(a,b)+'_'+Math.max(a,b);
/* teaching order: easy families first */
const ORDER={};
(function(){
  const inc=n=>([a,b])=>a===n||b===n, sq=([a,b])=>a===b, near=([a,b])=>b-a===1;
  const mul=[inc(2),inc(10),inc(5),sq,inc(3),inc(9),inc(4),()=>true];
  const add=[inc(10),sq,inc(2),near,inc(9),inc(3),()=>true];
  const build=(op,tests,val)=>{const out=[];tests.forEach(t=>PAIRS.filter(p=>!out.includes(op+p[0]+'_'+p[1])&&t(p)).sort((x,y)=>val(x)-val(y)).forEach(p=>out.push(op+p[0]+'_'+p[1])));return out};
  ORDER.m=build('m',mul,([a,b])=>a*b);ORDER.d=build('d',mul,([a,b])=>a*b);
  ORDER.a=build('a',add,([a,b])=>a+b);ORDER.s=build('s',add,([a,b])=>a+b);
})();
function multHint(x,y){if(x>y)[x,y]=[y,x];const p=x*y,o=n=>x===n?y:x;
  if(x===7&&y===8)return '5, 6, 7, 8: 56 = 7 × 8.';
  if(x===2)return `Es el doble de ${y}: ${y} + ${y} = ${p}.`;
  if(y===10)return `Ponle un 0 al ${x}: ${p}.`;
  if(x===5||y===5)return `${o(5)} × 10 = ${o(5)*10}, y la mitad es ${p}.`;
  if(x===9||y===9)return `${o(9)} × 10 = ${o(9)*10}, menos ${o(9)} da ${p}.`;
  if(x===y)return `Cuadrado: ${x} × ${x} = ${p}. Apréndelo como pareja.`;
  if(x===4||y===4)return `Doble del doble: ${o(4)} × 2 = ${o(4)*2}, y otra vez × 2 = ${p}.`;
  if(x===3||y===3)return `${o(3)} × 2 = ${o(3)*2}, más ${o(3)} = ${p}.`;
  if(x===6||y===6)return `${o(6)} × 5 = ${o(6)*5}, más ${o(6)} = ${p}.`;
  if(x===8||y===8)return `Doble, doble, doble: ${o(8)} → ${o(8)*2} → ${o(8)*4} → ${p}.`;
  return `${x} × ${y-1} = ${x*(y-1)}, más ${x} = ${p}.`}
function addHint(x,y){if(x>y)[x,y]=[y,x];const s=x+y;
  if(y===10)return `10 + ${x} es ${s}: el ${x} se queda en las unidades.`;
  if(x===y)return `Doble de ${x}: ${s}.`;
  if(y-x===1)return `Casi doble: ${x} + ${x} = ${2*x}, más 1 = ${s}.`;
  if(y===9)return `9 es 10 menos 1: ${x} + 10 = ${x+10}, menos 1 = ${s}.`;
  const need=10-y;return `Completa 10: ${y} + ${need} = 10, te quedan ${x-need}, entonces ${s}.`}
/* q = {op,a,b,shownA,shownB,ans} : hint for exactly what was shown */
function hint(q){const{op,a,b}=q;
  if(op==='m')return multHint(a,b);
  if(op==='a')return addHint(a,b);
  if(op==='s'){const tot=a+b,sub=q.x,ans=tot-sub;return `Piensa en suma: ${sub} + ? = ${tot}. Como ${sub} + ${ans} = ${tot}, la respuesta es ${ans}.`}
  if(op==='d'){const p=a*b,div=q.x,ans=p/div;return `Piensa en multiplicar: ${div} × ? = ${p}. ${div} × ${ans} = ${p}, entonces ${p} ÷ ${div} = ${ans}.`}
  return ''}
/* streak fire tiers */
const TIERS=[{min:20,id:'rainbow',name:'arcoíris',color:'#ff5ec8'},{min:15,id:'platinum',name:'platino',color:'#e8eef7'},{min:10,id:'blue',name:'azul',color:'#4da3ff'},{min:5,id:'orange',name:'anaranjado',color:'#ff9a1f'},{min:3,id:'red',name:'rojo',color:'#ff3b30'}];
const tierOf=n=>TIERS.find(t=>n>=t.min)||null;
const fmtTokens=t=>{const w=Math.floor(t+1e-9),h=t-w>=.5-1e-9;return(w||!h?String(w):'')+(h?'½':'')};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayKey=(t=Date.now())=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const mastered=(facts,op)=>FACTS[op].filter(k=>facts[k]&&facts[k].b>=4).length;
function cat(r){if(!r)return'none';if(r.b>=4)return'dom';if(r.b>=2)return'mej';return'ref'}
function streak(daySet){let n=0,t=Date.now();if(!daySet.has(dayKey(t)))t-=DAY;while(daySet.has(dayKey(t))){n++;t-=DAY}return n}
/* kid-facing day streak: one rest day per 7 days keeps it alive (never two misses in a row).
   Today does not break it until it is over. Returns {n: days played, rest: Set of rest-day keys, today: played today} */
function dayStreak(has){const rest=new Set();let n=0,t=Date.now(),i=0,lastRest=-99;const today=has.has(dayKey(t));
  if(!today){t-=DAY;i=1}
  for(let g=0;g<800;g++,i++,t-=DAY){const k=dayKey(t);
    if(has.has(k)){n++;continue}
    if(i-lastRest>=7&&has.has(dayKey(t-DAY))&&(n>0||i===1)){rest.add(k);lastRest=i;continue}
    break}
  return{n,rest,today}}
function client(){const c=window.TABLAS_CONFIG||{};if(!c.supabaseUrl||!c.supabaseKey||!window.supabase)return null;
  return window.supabase.createClient(c.supabaseUrl,c.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}})}
function uuid(){if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;
  const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`}
/* small inline flame icon, colored per tier */
function flameSVG(color,cls){const rb=color==='rainbow';const id='fg'+Math.random().toString(36).slice(2,7);
  const fill=rb?`url(#${id})`:color;
  return`<svg class="${cls||'flame'}" viewBox="0 0 24 28" aria-hidden="true">${rb?`<defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ff3b30"/><stop offset=".3" stop-color="#ffcc00"/><stop offset=".55" stop-color="#34c759"/><stop offset=".8" stop-color="#4da3ff"/><stop offset="1" stop-color="#af52de"/></linearGradient></defs>`:''}<path fill="${fill}" d="M12 1c1 4 6 7 6 13a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3 0-6 1-9z"/><path fill="#fff" opacity=".55" d="M12 14c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.3 1 .8 1.5 1.5 1.5 0-1.2-.3-2.3 0-3.5z"/></svg>`}
window.T={DAY,OPS,OP_LIST,PAIRS,FACTS,ALL_FACTS,parts,keyOf,ORDER,hint,TIERS,tierOf,fmtTokens,esc,dayKey,mastered,cat,streak,dayStreak,client,uuid,flameSVG};
})();
