/* Constelación ×: student app. Username + password, plays offline, syncs to Supabase. */
(function(){
"use strict";
const {DAY,OPS,OP_LIST,FACTS,parts,keyOf,ORDER,hint,tierOf,fmtTokens,esc,dayKey,mastered,streak,flameSVG}=window.T;
const $=s=>document.querySelector(s);
const KEY='constelacion.app.v3', FAST=4000, STREAK_MS=3000, ROUND=20;
const INTERVAL={1:0,2:DAY,3:3*DAY,4:7*DAY,5:21*DAY};
const sb=window.T.client();

/* ---------- local storage ---------- */
let storeOK=true, S={users:{},current:null};
try{const raw=localStorage.getItem(KEY);if(raw){const d=JSON.parse(raw);if(d&&d.users)S=d}}catch(e){storeOK=false}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){storeOK=false;$('#storeWarn').hidden=false}}
if(!storeOK)$('#storeWarn').hidden=false;
function blankUser(username){return{username,token:null,id:null,goal:10,facts:{},dirty:[],pending:[],log:[],srv:{tokens:3,best_run:0,best_streak:0},op:'m',infOps:['m']}}

let cur='auth', U=null, G=null;
function show(v){document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!=='v-'+v);cur=v;window.scrollTo(0,0)}

/* ---------- derived numbers ---------- */
function tokensOf(u){let t=u.srv.tokens;u.pending.forEach(s=>{if(s.pf)t+=.5;t-=s.tu||0});if(G&&u===U)t-=G.tu;return Math.max(0,t)}
const bestRun=u=>Math.max(u.srv.best_run,...u.pending.filter(s=>s.mode==='inf').map(s=>s.c),0);
const bestStreak=u=>Math.max(u.srv.best_streak,...u.pending.map(s=>s.mk||0),0);
const minutesToday=u=>u.log.filter(s=>dayKey(s.s)===dayKey()).reduce((a,s)=>a+Math.max(0,(s.e-s.s)/6e4),0);
function tokenHTML(t){return`<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffd36e"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="#b8860b" stroke-width="1.6"/><path d="M12 7.5l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" fill="#b8860b"/></svg><b>${fmtTokens(t)}</b>`}
function flameFor(n){const t=tierOf(n);return flameSVG(t?(t.id==='rainbow'?'rainbow':t.color):'#5b6699')}

/* ---------- sync ---------- */
let syncing=false, again=false, syncTimer=null, syncStatus='wait';
function setSync(st,text){syncStatus=st;const el=$('#syncState');el.className='sync '+st;
  el.lastChild.textContent=text||(st==='on'?'Tu tutor ve tu progreso':st==='off'?'Sin conexión, se guarda aquí':'Sincronizando…')}
function mergeServer(u,facts){if(!facts)return;Object.keys(facts).forEach(k=>{const s=facts[k],l=u.facts[k];if(!l||(s.l||0)>(l.l||0))u.facts[k]=s})}
function applyServer(u,data){mergeServer(u,data.facts);u.id=data.id;u.goal=data.goal;u.srv={tokens:+data.tokens,best_run:data.best_run,best_streak:data.best_streak}}
function queueSync(ms=1500){if(syncTimer)return;syncTimer=setTimeout(()=>{syncTimer=null;sync()},ms)}
async function sync(){const u=U;if(!u||!u.token||!sb)return;if(syncing){again=true;return}
  syncing=true;
  const sentFacts={},sentL={};u.dirty.forEach(k=>{if(u.facts[k]){sentFacts[k]=u.facts[k];sentL[k]=u.facts[k].l}});
  const sessions=u.pending.slice(0,50);
  const live=G?{mode:G.mode,ops:G.ops.join(''),i:G.idx,n:G.mode==='round'?ROUND:null,c:G.results.filter(r=>r.ok).length,st:G.streak,at:Date.now()}:null;
  try{
    const {data,error}=await sb.rpc('student_sync',{p_token:u.token,p_facts:sentFacts,p_sessions:sessions,p_live:live});
    if(error)throw error;
    u.dirty=u.dirty.filter(k=>!(k in sentL)||!u.facts[k]||u.facts[k].l!==sentL[k]);
    const ids=new Set(sessions.map(s=>s.id));u.pending=u.pending.filter(s=>!ids.has(s.id));
    applyServer(u,data);save();setSync('on');
    if(cur==='home'&&U===u)renderHome();
  }catch(err){
    if(String(err&&err.message).includes('sesion_invalida')){u.token=null;save();if(U===u&&!G){U=null;S.current=null;save();renderAuth('Tu sesión se cerró. Entra otra vez con tu usuario y contraseña.');show('auth')}}
    else setSync('off')}
  finally{syncing=false;if(again){again=false;queueSync(800)}}}
window.addEventListener('online',()=>queueSync(300));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')queueSync(300)});
setInterval(()=>{if(U&&(U.dirty.length||U.pending.length||G))sync()},30000);

/* ---------- auth ---------- */
function authTab(which){const login=which==='login';$('#tabLogin').classList.toggle('on',login);$('#tabSignup').classList.toggle('on',!login);
  $('#tabLogin').setAttribute('aria-selected',login);$('#tabSignup').setAttribute('aria-selected',!login);$('#loginForm').hidden=!login;$('#signupForm').hidden=login}
$('#tabLogin').addEventListener('click',()=>authTab('login'));$('#tabSignup').addEventListener('click',()=>authTab('signup'));
function renderAuth(note){const known=Object.keys(S.users);
  $('#knownUsers').innerHTML=known.length?'<span class="small muted" style="width:100%">En este dispositivo:</span>'+known.map(n=>`<button type="button" class="chip pick" data-u="${esc(n)}">${esc(n)}</button>`).join(''):'';
  const m=$('#lMsg');m.className='status bad';m.textContent=note||(!sb?'La app todavía no está conectada. Avísale a tu tutor.':'');
  if(!known.length)authTab('signup');else authTab('login')}
$('#knownUsers').addEventListener('click',e=>{const b=e.target.closest('[data-u]');if(b){$('#lUser').value=b.dataset.u;$('#lPass').focus()}});
const cleanUser=v=>v.trim().toLowerCase();
$('#sUser').addEventListener('input',e=>{e.target.value=e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g,'')});
$('#lUser').addEventListener('input',e=>{e.target.value=e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g,'')});
$('#sClass').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'')});
const ERR={credenciales:'Usuario o contraseña incorrectos.',bloqueado:'Demasiados intentos. Espera 10 minutos o pide a tu tutor una contraseña nueva.',
  clase_invalida:'Ese código de tutor no existe. Revísalo.',usuario_existe:'Ese usuario ya existe. Inventa otro.',usuario_invalido:'El usuario debe tener de 3 a 20 letras o números, sin espacios.',clave_corta:'La contraseña debe tener al menos 4 caracteres.'};
function errText(err){const m=String(err&&err.message||'');for(const k in ERR)if(m.includes(k))return ERR[k];return'No hay conexión. Necesitas internet para entrar.'}
async function enter(username,token){const u=S.users[username]||blankUser(username);u.token=token;S.users[username]=u;S.current=username;U=u;save();
  await sync();renderHome();show('home')}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const m=$('#lMsg');if(!sb)return;
  const user=cleanUser($('#lUser').value),pass=$('#lPass').value;$('#lBtn').disabled=true;m.className='status';m.textContent='Entrando…';
  try{const {data,error}=await sb.rpc('student_login',{p_username:user,p_password:pass});if(error)throw error;$('#lPass').value='';m.textContent='';await enter(user,data)}
  catch(err){m.className='status bad';m.textContent=errText(err)}finally{$('#lBtn').disabled=false}});
$('#signupForm').addEventListener('submit',async e=>{e.preventDefault();const m=$('#sMsg');if(!sb)return;
  const cls=$('#sClass').value.trim(),user=cleanUser($('#sUser').value),pass=$('#sPass').value;
  if(pass!==$('#sPass2').value){m.className='status bad';m.textContent='Las contraseñas no son iguales.';return}
  $('#sBtn').disabled=true;m.className='status';m.textContent='Creando…';
  try{const {data,error}=await sb.rpc('student_register',{p_class_code:cls,p_username:user,p_password:pass});if(error)throw error;
    $('#sPass').value=$('#sPass2').value='';m.textContent='';await enter(user,data)}
  catch(err){m.className='status bad';m.textContent=errText(err)}finally{$('#sBtn').disabled=false}});
$('#logoutBtn').addEventListener('click',async()=>{const u=U;if(!u)return;
  if(u.dirty.length||u.pending.length)await sync();
  if(sb&&u.token){try{await sb.rpc('student_logout',{p_token:u.token})}catch(e){}}
  u.token=null;U=null;S.current=null;save();
  renderAuth(u.pending.length?'Quedó progreso sin subir. Se sube cuando vuelvas a entrar con internet.':'');$('#lMsg').className='status';show('auth')});

/* ---------- home ---------- */
function skyLevel(r,now){if(!r)return's0';let c=r.b>=4?'s3':r.b>=2?'s2':'s1';if(r.b>=2&&r.d<=now)c+=' due';return c}
function renderHome(){const u=U,now=Date.now();
  $('#homeUser').textContent=u.username;$('#homeTokens').innerHTML=tokenHTML(tokensOf(u));
  const st=streak(new Set(u.log.map(s=>dayKey(s.s))));$('#streakDays').textContent=st>1?st+' días seguidos':'';
  const mins=Math.round(minutesToday(u)),goal=u.goal||10;
  $('#goalFill').style.width=Math.min(100,mins/goal*100)+'%';$('#goalFill').classList.toggle('done',mins>=goal);
  $('#goalText').textContent=mins>=goal?`¡Cumplida! ${mins} de ${goal} min`:`${mins} de ${goal} min`;
  $('#opTabs').innerHTML=OP_LIST.map(op=>`<button type="button" class="opbtn${u.op===op?' on':''}" data-op="${op}"><span class="sym">${OPS[op].sym}</span><span>${OPS[op].name}</span><span class="small muted">${mastered(u.facts,op)}/45 ★</span></button>`).join('');
  const op=u.op;$('#skyTitle').textContent=OPS[op].name;$('#litCount').textContent=mastered(u.facts,op);
  let h='';for(let r=2;r<=10;r++)for(let c=2;c<=10;c++){const k=keyOf(op,r,c),rec=u.facts[k];h+=`<div class="cell ${skyLevel(rec,now)}" title="${r} ${OPS[op].sym} ${c}">${rec?OPS[op].res(r,c):''}</div>`}
  $('#sky').innerHTML=h;$('#playBtn').textContent='Jugar ronda de '+OPS[op].name.toLowerCase();
  $('#recRun').textContent=bestRun(u);const bs=bestStreak(u);$('#recStreak').innerHTML=`${flameFor(bs)}<span>${bs}</span>`;
  $('#infOps').innerHTML=OP_LIST.map(o=>`<button type="button" class="chip toggle${u.infOps.includes(o)?' on':''}" data-io="${o}" aria-pressed="${u.infOps.includes(o)}">${OPS[o].sym} ${OPS[o].name}</button>`).join('');
  $('#infBtn').disabled=!u.infOps.length;
  if(!u.token)setSync('off','Sin sesión');else setSync(syncStatus)}
$('#opTabs').addEventListener('click',e=>{const b=e.target.closest('[data-op]');if(b){U.op=b.dataset.op;save();renderHome()}});
$('#infOps').addEventListener('click',e=>{const b=e.target.closest('[data-io]');if(!b)return;const o=b.dataset.io;
  U.infOps=U.infOps.includes(o)?U.infOps.filter(x=>x!==o):[...U.infOps,o].sort((a,b)=>OP_LIST.indexOf(a)-OP_LIST.indexOf(b));save();renderHome()});
$('#playBtn').addEventListener('click',()=>start('round',[U.op]));
$('#infBtn').addEventListener('click',()=>{if(U.infOps.length)start('inf',U.infOps.slice())});

/* ---------- game ---------- */
function touch(k){if(!U.dirty.includes(k))U.dirty.push(k)}
let freezeTimer=null, tipTimer=null;
function start(mode,ops){FX.set(null);
  G={id:window.T.uuid(),mode,ops,idx:0,retry:[],recent:[],introduced:[],results:[],ups:0,streak:0,maxStreak:0,tu:0,start:Date.now(),q:null,input:'',locked:false,lastIntro:false,startBest:{run:bestRun(U),streak:bestStreak(U)}};
  $('#dots').hidden=mode!=='round';$('#dots').innerHTML=mode==='round'?'<i></i>'.repeat(ROUND):'';
  show('play');hud();next();queueSync(300)}
function weighted(pool){const f=U.facts;let tot=0;const w=pool.map(k=>{const x=6-(f[k]?f[k].b:0);tot+=x;return x});let r=Math.random()*tot;for(let i=0;i<pool.length;i++){r-=w[i];if(r<=0)return pool[i]}return pool[0]}
function pickRound(){const op=G.ops[0],keys=FACTS[op],f=U.facts,now=Date.now(),notRecent=k=>!G.recent.includes(k);
  const ri=G.retry.findIndex(o=>o.at<=G.idx&&notRecent(o.k));if(ri>=0)return{k:G.retry.splice(ri,1)[0].k};
  const fresh=ORDER[op].find(k=>!f[k]);const learning=keys.filter(k=>f[k]&&f[k].b===1).length;const seen=keys.filter(k=>f[k]).length;
  if(fresh&&!G.lastIntro&&G.introduced.length<3&&(learning<3||seen===0))return{k:fresh,intro:true};
  const due=keys.filter(k=>f[k]&&f[k].d<=now&&notRecent(k)).sort((a,b)=>f[a].b-f[b].b||f[a].d-f[b].d);
  if(due.length)return{k:due[Math.floor(Math.random()*Math.min(3,due.length))]};
  if(fresh&&!G.lastIntro&&G.introduced.length<5)return{k:fresh,intro:true};
  const pool=keys.filter(k=>f[k]&&notRecent(k));
  if(pool.length)return{k:weighted(pool)};
  if(fresh)return{k:fresh,intro:true};
  return{k:keys[Math.floor(Math.random()*keys.length)]}}
function pickInf(){const ri=G.retry.findIndex(o=>o.at<=G.idx&&!G.recent.includes(o.k));if(ri>=0)return{k:G.retry.splice(ri,1)[0].k};
  /* difficulty ramps up: starts with the easiest families and opens more as the run grows */
  const open=Math.min(45,10+Math.floor(G.idx/2));
  const pool=G.ops.flatMap(op=>ORDER[op].slice(0,open)).filter(k=>!G.recent.includes(k));return{k:weighted(pool)}}
function next(){clearTimeout(freezeTimer);if(G.mode==='round'&&G.idx>=ROUND)return endGame();
  const c=G.mode==='round'?pickRound():pickInf();const k=c.k;G.recent=[k,...G.recent].slice(0,3);G.lastIntro=!!c.intro;
  const[op,a,b]=parts(k);let x=a,y=b;if(Math.random()<.5)[x,y]=[y,x];
  const rec=U.facts[k];const missing=(op==='m'||op==='a')&&rec&&rec.b>=3&&Math.random()<.25;
  const q={k,op,a,b,x,y};const sym=OPS[op].sym;let html,shown;
  if(op==='m'||op==='a'){const r=OPS[op].res(x,y);q.ans=missing?y:r;html=missing?`${x} ${sym} <span class="gap">?</span> = ${r}`:`${x} ${sym} ${y}`;shown=`${x} ${sym} ${y} = ${r}`}
  else if(op==='s'){const tot=a+b;q.ans=y;q.x=x;html=`${tot} − ${x}`;shown=`${tot} − ${x} = ${y}`}
  else{const p=a*b;q.ans=y;q.x=x;html=`${p} ÷ ${x}`;shown=`${p} ÷ ${x} = ${y}`}
  q.shown=shown;G.q=q;G.input='';G.locked=false;
  $('#q').innerHTML=html;$('#ans').textContent='';$('#fb').textContent='';$('#fb').className='fb';$('#card').className='card';
  hud();
  if(c.intro){const now=Date.now();U.facts[k]={b:1,a:0,w:0,t:0,l:now,d:now,up:0};touch(k);G.introduced.push(k);G.retry.push({k,at:G.idx+3});
    $('#introQ').textContent=shown;$('#introHint').textContent=hint(q);$('#intro').hidden=false;G.locked=true;$('#introOk').focus()}
  else shownNow()}
/* while on a streak, taking longer than STREAK_MS freezes the fire right away */
function shownNow(){G.q.t0=performance.now();clearTimeout(freezeTimer);
  if(G.streak>=3)freezeTimer=setTimeout(()=>{if(G&&!G.locked&&G.streak>=3){G.streak=0;FX.freeze();hud(true)}},STREAK_MS)}
$('#introOk').addEventListener('click',()=>{$('#intro').hidden=true;G.locked=false;shownNow()});
function hud(bump){const n=G.streak;$('#streakIcon').innerHTML=flameFor(n);$('#streakNum').textContent=n;
  const t=tierOf(n);const box=$('#streakBox');box.className='streak'+(t?' lit t-'+t.id:'');if(bump){void box.offsetWidth;box.classList.add('bump')}
  $('#tokenBtn').innerHTML=tokenHTML(tokensOf(U));$('#tokenBtn').disabled=tokensOf(U)<1;
  if(G.mode==='round'){const ds=$('#dots').children;for(let i=0;i<ROUND;i++){const r=G.results[i];ds[i].className=r?(r.tok?'tok':r.ok?(r.fast?'ok':'slow'):'bad'):(i===G.idx?'now':'')}
    $('#playInfo').textContent=`${OPS[G.ops[0]].name} · ${Math.min(G.idx+1,ROUND)} de ${ROUND}`}
  else $('#playInfo').textContent=`Operaciones: ${G.results.filter(r=>r.ok).length} · Récord ${G.startBest.run}`}
function press(k){if(cur!=='play'||!G||G.locked)return;
  if(k==='del')G.input=G.input.slice(0,-1);else if(k==='ok'){if(G.input)submit();return}else if(G.input.length<3)G.input+=k;
  $('#ans').textContent=G.input}
$('#pad').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b)press(b.dataset.k)});
document.addEventListener('keydown',e=>{if(cur!=='play'||!G)return;
  if(!$('#intro').hidden&&(e.key==='Enter'||e.key===' ')){e.preventDefault();$('#introOk').click();return}
  if(!$('#wrong').hidden&&(e.key==='Enter'||e.key===' ')){e.preventDefault();$('#wrongOk').click();return}
  if(/^[0-9]$/.test(e.key)){e.preventDefault();press(e.key)}else if(e.key==='Backspace'){e.preventDefault();press('del')}else if(e.key==='Enter'){e.preventDefault();press('ok')}});
function record(ok,fast,el){const now=Date.now(),q=G.q;let rec=U.facts[q.k];
  if(!rec){rec=U.facts[q.k]={b:1,a:0,w:0,t:0,l:now,d:now,up:0};G.introduced.push(q.k)}
  rec.a++;rec.l=now;if(ok)rec.t=rec.t?Math.round(rec.t*.7+el*.3):Math.round(el);
  if(fast){if(rec.d<=now){if(rec.b<5){rec.b++;rec.up=now;G.ups++}rec.d=now+INTERVAL[rec.b]}}
  else if(ok){if(rec.b>=3)rec.b--;rec.b=Math.max(1,rec.b);rec.d=now+INTERVAL[rec.b];if(rec.b===1)G.retry.push({k:q.k,at:G.idx+4})}
  else{rec.w++;rec.b=1;rec.d=now;G.retry.push({k:q.k,at:G.idx+3})}
  touch(q.k)}
function submit(){G.locked=true;clearTimeout(freezeTimer);const el=performance.now()-G.q.t0,q=G.q;
  const ok=parseInt(G.input,10)===q.ans,fast=ok&&el<=FAST,quick=ok&&el<=STREAK_MS;
  record(ok,fast,el);G.results.push({k:q.k,ok,fast,el});G.idx++;
  let bump=false;
  if(quick){const before=tierOf(G.streak);G.streak++;G.maxStreak=Math.max(G.maxStreak,G.streak);const t=tierOf(G.streak);bump=!!t&&t!==before;FX.set(t,G.streak)}
  else{if(G.streak>=3){ok?FX.freeze():FX.fizzle()}G.streak=0}
  save();hud(bump);queueSync();
  const fb=$('#fb');
  if(fast){fb.textContent=G.streak>=10?'¡En llamas!':G.streak>=5?'¡Imparable!':'¡Exacto!';fb.className='fb ok';$('#card').className='card good';setTimeout(next,450)}
  else if(ok){fb.textContent='Bien. La próxima, más rápido.';fb.className='fb slow';$('#card').className='card good';setTimeout(next,1000)}
  else{$('#card').className='card badc';$('#wrongTag').textContent='Era '+q.ans;$('#wrongQ').textContent=q.shown;$('#wrongHint').textContent=hint(q);
    const end=G.mode==='inf';$('#wrongNote').textContent=end?'Se acabó la partida.':'Te la vuelvo a preguntar en un ratito.';$('#wrongOk').textContent=end?'Ver resultado':'Seguir';
    $('#wrong').hidden=false;$('#wrongOk').focus()}}
$('#wrongOk').addEventListener('click',()=>{$('#wrong').hidden=true;if(G.mode==='inf')endGame();else next()});
/* tokens: first tap arms, second tap spends one and reveals the answer. The fact goes back to review. */
let armed=false;
$('#tokenBtn').addEventListener('click',()=>{if(!G||G.locked||tokensOf(U)<1)return;
  if(!armed){armed=true;$('#tokenTip').hidden=false;clearTimeout(tipTimer);tipTimer=setTimeout(()=>{armed=false;$('#tokenTip').hidden=true},2500);return}
  armed=false;$('#tokenTip').hidden=true;clearTimeout(tipTimer);clearTimeout(freezeTimer);
  const q=G.q;G.locked=true;G.tu++;
  const now=Date.now();let rec=U.facts[q.k];if(!rec){rec=U.facts[q.k]={b:1,a:0,w:0,t:0,l:now,d:now,up:0}}
  rec.l=now;rec.b=1;rec.d=now;touch(q.k);if(G.mode==='round')G.retry.push({k:q.k,at:G.idx+4});
  G.results.push({k:q.k,ok:false,tok:true,el:0});G.idx++;save();hud();queueSync();
  $('#ans').textContent=q.ans;$('#fb').textContent='Token usado: '+q.shown;$('#fb').className='fb tokfb';setTimeout(next,1800)});
$('#quitBtn').addEventListener('click',()=>{clearTimeout(freezeTimer);FX.set(null);if(G&&G.results.length)finishSession();G=null;renderHome();show('home');sync()});
function finishSession(){const R=G.results.filter(r=>!r.tok),c=R.filter(r=>r.ok),f=R.filter(r=>r.fast),now=Date.now();
  const n=G.results.length;
  const pf=G.mode==='round'&&n>=ROUND&&c.length===n&&G.tu===0;
  const s={id:G.id,s:G.start,e:now,mode:G.mode,ops:G.ops.join(''),n,c:c.length,f:f.length,ms:c.length?Math.round(c.reduce((a,r)=>a+r.el,0)/c.length):0,nw:G.introduced.length,mk:G.maxStreak,tu:G.tu,pf};
  U.pending.push(s);U.log.push({s:G.start,e:now});if(U.log.length>200)U.log=U.log.slice(-200);save();return s}
function endGame(){clearTimeout(freezeTimer);FX.set(null);const s=finishSession(),inf=G.mode==='inf';
  const banners=[];
  if(s.pf)banners.push('¡Ronda perfecta! Ganaste ½ token.');
  if(inf&&s.c>G.startBest.run)banners.push(`¡Nuevo récord: ${s.c} operaciones!`);
  if(s.mk>G.startBest.streak&&s.mk>=3)banners.push(`¡Nuevo récord de racha: ${s.mk}!`);
  $('#endBanner').hidden=!banners.length;$('#endBanner').innerHTML=banners.map(esc).join('<br>');
  $('#endEyebrow').textContent=inf?'Modo infinito':'Ronda de '+OPS[G.ops[0]].name.toLowerCase();
  $('#endTitle').textContent=inf?`${s.c} operaciones seguidas`:(s.c>=18?'¡Qué ronda, '+U.username+'!':s.c>=14?'Buen trabajo, '+U.username+'.':'Vas sumando, '+U.username+'.');
  const mins=Math.round(minutesToday(U)),goal=U.goal||10;$('#endGoal').textContent=mins>=goal?`Meta de hoy cumplida: ${mins} de ${goal} min.`:`Llevas ${mins} de ${goal} min hoy.`;
  const stats=inf?[['Operaciones',s.c],['Récord',Math.max(s.c,G.startBest.run)],['Mejor racha',`${flameFor(s.mk)}${s.mk}`]]
                 :[['Aciertos',s.c+'/'+s.n],['De memoria',s.f],['Mejor racha',`${flameFor(s.mk)}${s.mk}`]];
  $('#endStats').innerHTML=stats.map(([a,b])=>`<div class="stat"><span class="small muted">${a}</span><b>${b}</b></div>`).join('');
  $('#endTokens').innerHTML=tokenHTML(tokensOf(U));
  const fmt=k=>{const[op,a,b]=parts(k);return op==='s'?`${a+b} − ${a} = ${b}`:op==='d'?`${a*b} ÷ ${a} = ${b}`:`${a} ${OPS[op].sym} ${b} = ${OPS[op].res(a,b)}`};
  $('#eNewWrap').hidden=inf||!G.introduced.length;$('#eNew').innerHTML=[...new Set(G.introduced)].map(k=>`<span class="chip ok">${fmt(k)}</span>`).join('');
  const miss=[...new Set(G.results.filter(r=>!r.ok).map(r=>r.k))];
  $('#eMissWrap').hidden=!miss.length;$('#eMiss').innerHTML=miss.map(k=>`<span class="chip bad">${fmt(k)}</span>`).join('');
  $('#againBtn').dataset.mode=G.mode;$('#againBtn').dataset.ops=G.ops.join('');
  G=null;show('end');sync()}
$('#againBtn').addEventListener('click',e=>start(e.currentTarget.dataset.mode,e.currentTarget.dataset.ops.split('')));
$('#endHome').addEventListener('click',()=>{renderHome();show('home')});

/* ---------- boot ---------- */
setSync(sb?'wait':'off');
if(S.current&&S.users[S.current]&&S.users[S.current].token){U=S.users[S.current];renderHome();show('home');queueSync(200)}
else{renderAuth();show('auth')}
})();
