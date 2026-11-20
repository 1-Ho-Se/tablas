/* Constelación ×: tutor panel. Live view of every student via Supabase Realtime. */
(function(){
"use strict";
const {DAY,OPS,OP_LIST,FACTS,parts,keyOf,esc,dayKey,mastered,cat,streak,tierOf,fmtTokens,flameSVG}=window.T;
const $=s=>document.querySelector(s);
const sb=window.T.client();
let students=[], sessions=[], stuId=null, cur='login', channel=null, reloadTimer=null, classCode='', heatOp='m';
function show(v){document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!=='v-'+v);cur=v;window.scrollTo(0,0)}
const fmtDate=new Intl.DateTimeFormat('es-DO',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
const ago=t=>{if(!t)return'nunca';const m=Math.floor((Date.now()-t)/6e4);if(m<2)return'ahora mismo';if(m<60)return'hace '+m+' min';const h=Math.floor(m/60);if(h<24)return'hace '+h+' h';const d=Math.floor(h/24);return d===1?'ayer':'hace '+d+' días'};
const isLive=s=>s.live&&s.live.at&&Date.now()-s.live.at<120000;
const label=s=>s.real_name?`${s.real_name} (${s.username})`:s.username;
const flameFor=n=>{const t=tierOf(n);return flameSVG(t?(t.id==='rainbow'?'rainbow':t.color):'#5b6699')};
const opsName=o=>o.split('').map(x=>OPS[x]?OPS[x].sym:'').join(' ');

/* ---------- auth ---------- */
function msg(el,text,ok){el.className='status '+(ok?'ok':'bad');el.textContent=text}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();if(!sb)return;
  const {error}=await sb.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});
  if(error)msg($('#loginMsg'),error.message.includes('Email not confirmed')?'Confirma tu correo primero: revisa tu bandeja de entrada.':'Correo o contraseña incorrectos.')});
$('#signupBtn').addEventListener('click',async()=>{if(!sb)return;const email=$('#email').value.trim(),password=$('#password').value;
  if(!email||password.length<6)return msg($('#loginMsg'),'Escribe tu correo y una contraseña de al menos 6 caracteres.');
  const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.href}});
  if(error)return msg($('#loginMsg'),error.message);
  if(!data.session)msg($('#loginMsg'),'Listo. Te envié un correo para confirmar la cuenta. Ábrelo y vuelve aquí.',true)});
$('#logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut()});

/* ---------- data ---------- */
async function load(){
  const [a,b]=await Promise.all([
    sb.from('students').select('id,username,real_name,daily_goal_min,facts,live,last_seen_at,created_at').order('username'),
    sb.from('sessions').select('id,student_id,started_at,ended_at,mode,ops,n,correct,fast,avg_ms,new_facts,max_streak,tokens_used,perfect').order('started_at',{ascending:false}).limit(20000)]);
  if(a.error||b.error){setLive('off');return}
  students=a.data.map(s=>({...s,facts:s.facts||{},last:s.last_seen_at?Date.parse(s.last_seen_at):0}));
  sessions=b.data.map(s=>({...s,s:Date.parse(s.started_at),e:Date.parse(s.ended_at)}));
  render()}
function reloadSoon(){clearTimeout(reloadTimer);reloadTimer=setTimeout(load,700)}
function setLive(st){const el=$('#liveState');el.className='sync '+st;el.lastChild.textContent=st==='on'?'En vivo':st==='off'?'Sin conexión':'Conectando…'}
function subscribe(){if(channel)sb.removeChannel(channel);
  channel=sb.channel('tutor-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'students'},reloadSoon)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'sessions'},reloadSoon)
    .subscribe(st=>setLive(st==='SUBSCRIBED'?'on':st==='CHANNEL_ERROR'||st==='TIMED_OUT'?'off':'wait'))}
setInterval(()=>{if(cur!=='login')load()},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&cur!=='login')load()});
async function loadClass(){const {data,error}=await sb.rpc('tutor_class_code');if(!error){classCode=data;$('#classCode').textContent=data}}

/* ---------- per-student derived ---------- */
function info(s){const mine=sessions.filter(x=>x.student_id===s.id);const byDay={};
  mine.forEach(x=>{const k=dayKey(x.s);(byDay[k]=byDay[k]||{r:0,min:0}).r++;byDay[k].min+=Math.max(0,(x.e-x.s)/6e4)});
  const today=byDay[dayKey()]||{r:0,min:0};
  let days7=0,min7=0;for(let i=0;i<7;i++){const d=byDay[dayKey(Date.now()-i*DAY)];if(d){days7++;min7+=d.min}}
  const tokens=Math.max(0,3+.5*mine.filter(x=>x.perfect).length-mine.reduce((a,x)=>a+x.tokens_used,0));
  const bestRun=Math.max(0,...mine.filter(x=>x.mode==='inf').map(x=>x.correct));
  const bestStreak=Math.max(0,...mine.map(x=>x.max_streak));
  return{mine,byDay,today,days7,min7,tokens,bestRun,bestStreak,streak:streak(new Set(Object.keys(byDay)))}}
function todayPill(s,I){const g=s.daily_goal_min,m=Math.round(I.today.min);
  if(m>=g)return`<span class="pill ok">Hoy ✓ ${m}/${g} min</span>`;
  if(I.today.r>0)return`<span class="pill part">Hoy ${m}/${g} min</span>`;
  return`<span class="pill bad">No ha practicado hoy</span>`}
function livePill(s){const l=s.live;if(!isLive(s))return'';
  return l.mode==='inf'?`<span class="pill live">Infinito ${opsName(l.ops||'')} · ${l.c}${l.st>=3?' · racha '+l.st:''}</span>`
                       :`<span class="pill live">${OPS[(l.ops||'m')[0]].name} ${l.i}/${l.n}${l.st>=3?' · racha '+l.st:''}</span>`}

/* ---------- list ---------- */
function render(){if(cur==='student')renderStudent();renderList()}
function renderList(){
  $('#todayLabel').textContent=new Intl.DateTimeFormat('es-DO',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  const rows=students.map(s=>({s,I:info(s)}));const met=r=>r.I.today.min>=r.s.daily_goal_min;
  const done=rows.filter(met).length;
  $('#todaySummary').textContent=students.length?`${done} de ${students.length} cumplieron la meta de hoy.`:'Todavía no hay estudiantes. Comparte el código de tu clase de abajo.';
  rows.sort((a,b)=>(isLive(b.s)-isLive(a.s))||(met(a)-met(b))||a.s.username.localeCompare(b.s.username));
  $('#students').innerHTML=rows.map(({s,I})=>`<button class="scard${I.today.r===0?' alert':''}" type="button" data-sid="${esc(s.id)}">
      <span class="spread" style="width:100%"><b>${esc(label(s))}</b>${livePill(s)}</span>
      <span class="row">${todayPill(s,I)}${I.streak>1?`<span class="pill part">${I.streak} días seguidos</span>`:''}</span>
      <span class="small muted">Practicó ${I.days7} de los últimos 7 días · última vez ${ago(s.last)}</span>
      <span class="chips">${OP_LIST.map(op=>`<span class="chip">${OPS[op].sym} ${mastered(s.facts,op)}/45</span>`).join('')}</span>
    </button>`).join('')}
$('#students').addEventListener('click',e=>{const b=e.target.closest('[data-sid]');if(b){stuId=b.dataset.sid;renderStudent(true);show('student')}});
$('#copyClass').addEventListener('click',()=>{if(!classCode)return;const app=new URL('./',location.href).href;
  const text=`Para practicar matemáticas abre ${app}\nToca "Crear cuenta" y usa el código de la clase: ${classCode}\nInventa tu usuario y contraseña (no pongas tu nombre completo). En el celular, agrégala a la pantalla de inicio.`;
  const fail=()=>msg($('#classMsg'),'No pude copiar. Enlace: '+app+' · Código: '+classCode);
  try{navigator.clipboard.writeText(text).then(()=>msg($('#classMsg'),'Copiado. Pégalo en WhatsApp.',true),fail)}catch(e){fail()}});
$('#stuBack').addEventListener('click',()=>{renderList();show('list')});

/* ---------- student detail ---------- */
let delArmed=false;
function renderStudent(fresh){const s=students.find(x=>x.id===stuId);if(!s){renderList();show('list');return}
  const I=info(s);
  if(fresh){delArmed=false;$('#stuDel').textContent='Eliminar estudiante';$('#goalIn').value=s.daily_goal_min;$('#noteIn').value=s.real_name||'';$('#passIn').value='';$('#acctMsg').textContent=''}
  $('#stuName').textContent=label(s);$('#stuUpdated').textContent='Última actividad '+ago(s.last);
  $('#stuLive').innerHTML=livePill(s)||todayPill(s,I);
  const recent=I.mine.slice(0,5),n=recent.reduce((a,x)=>a+x.n,0),ok=recent.reduce((a,x)=>a+x.correct,0);
  const st=[['Días practicados (7)',I.days7+' de 7'],['Minutos (7 días)',Math.round(I.min7)],['Racha',I.streak+(I.streak===1?' día':' días')],
    ['Aciertos (últimas 5)',n?Math.round(ok/n*100)+'%':'—'],['Récord infinito',I.bestRun],['Récord de racha',`${flameFor(I.bestStreak)}${I.bestStreak}`],['Tokens',fmtTokens(I.tokens)]];
  $('#stuStats').innerHTML=st.map(([a,b])=>`<div class="stat"><span class="small muted">${a}</span><b>${b}</b></div>`).join('');
  $('#stuOps').innerHTML=OP_LIST.map(op=>`<div class="stat"><span class="small muted">${OPS[op].name}</span><b>${mastered(s.facts,op)}/45</b></div>`).join('');
  /* calendar: 5 weeks, Monday first, colored by minutes vs goal */
  const now=new Date();const dow=(now.getDay()+6)%7;const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-dow-28);
  let cal=['L','M','M','J','V','S','D'].map(d=>`<div class="hd">${d}</div>`).join('');
  for(let i=0;i<35;i++){const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i);const k=dayKey(d.getTime());
    if(d>now){cal+=`<div class="cfut"></div>`;continue}
    const v=I.byDay[k];const cls=!v?'c0':v.min>=s.daily_goal_min?'c2':'c1';
    const tip=`${d.toLocaleDateString('es-DO',{weekday:'long',day:'numeric',month:'long'})}: ${v?Math.round(v.min)+' min, '+v.r+(v.r===1?' partida':' partidas'):'no practicó'}`;
    cal+=`<div class="${cls}${k===dayKey()?' ctoday':''}" title="${esc(tip)}">${d.getDate()}</div>`}
  $('#cal').innerHTML=cal;$('#calLegend').textContent='Meta: '+s.daily_goal_min+' min por día';
  /* heat for the chosen operation */
  $('#heatTabs').innerHTML=OP_LIST.map(op=>`<button type="button" class="tab${heatOp===op?' on':''}" data-hop="${op}" title="${OPS[op].name}" style="padding:6px 12px">${OPS[op].sym}</button>`).join('');
  const sym=OPS[heatOp].sym;
  let h=`<div class="ax">${sym}</div>`;for(let x=2;x<=10;x++)h+=`<div class="ax">${x}</div>`;
  for(let r=2;r<=10;r++){h+=`<div class="ax">${r}</div>`;for(let col=2;col<=10;col++){const k=keyOf(heatOp,r,col),rec=s.facts[k];
    const tip=rec?`${fmtFact(k)}: nivel ${rec.b} de 5, ${rec.a} intentos, ${rec.w} fallos${rec.t?', '+(rec.t/1000).toFixed(1)+' s':''}`:`${fmtFact(k)}: sin ver`;
    h+=`<div class="t-${cat(rec)}" title="${tip}">${OPS[heatOp].res(r,col)}</div>`}}
  $('#heat').innerHTML=h;
  const keys=FACTS[heatOp],c={dom:[],mej:[],ref:[]};keys.forEach(k=>{const x=cat(s.facts[k]);if(x!=='none')c[x].push(k)});
  const ref=[...c.ref,...c.mej.filter(k=>{const r=s.facts[k];return r.a>=3&&r.w/r.a>=.34})].sort((a,b)=>s.facts[b].w-s.facts[a].w);
  $('#stuRef').innerHTML=ref.length?ref.map(k=>{const r=s.facts[k];return`<span class="chip bad">${fmtFact(k)}${r.w?' · '+r.w+(r.w===1?' fallo':' fallos'):''}</span>`}).join(''):'<span class="muted small">Nada pendiente.</span>';
  const up=keys.filter(k=>{const r=s.facts[k];return r&&r.up&&r.up>Date.now()-7*DAY});
  $('#stuUp').innerHTML=up.length?up.map(k=>`<span class="chip mej">${fmtFact(k)} → nivel ${s.facts[k].b}</span>`).join(''):'<span class="muted small">Sin cambios esta semana.</span>';
  $('#stuDom').innerHTML=c.dom.length?c.dom.map(k=>`<span class="chip ok">${fmtFact(k)}</span>`).join(''):'<span class="muted small">Todavía ninguna.</span>';
  $('#stuSess').innerHTML=I.mine.slice(0,20).map(x=>`<tr><td>${fmtDate.format(new Date(x.s))}</td><td>${x.mode==='inf'?'Infinito '+opsName(x.ops):OPS[x.ops[0]].name}${x.perfect?' ★':''}</td><td>${Math.max(1,Math.round((x.e-x.s)/6e4))} min</td><td>${x.n}</td><td>${x.n?Math.round(x.correct/x.n*100):0}%</td><td>${x.fast}</td><td>${x.avg_ms?(x.avg_ms/1000).toFixed(1)+' s':'—'}</td><td>${x.max_streak}</td><td>${x.tokens_used||''}</td></tr>`).join('')||'<tr><td colspan="9" class="muted">Sin partidas todavía.</td></tr>'}
function fmtFact(k){const[op,a,b]=parts(k);return op==='s'?`${a+b} − ${a}`:op==='d'?`${a*b} ÷ ${a}`:`${a} ${OPS[op].sym} ${b}`}
$('#heatTabs').addEventListener('click',e=>{const b=e.target.closest('[data-hop]');if(b){heatOp=b.dataset.hop;renderStudent()}});
async function saveField(patch,okText){const {error}=await sb.from('students').update(patch).eq('id',stuId);
  if(error)return msg($('#acctMsg'),'No se guardó. Revisa la conexión.');msg($('#acctMsg'),okText,true);await load()}
$('#goalSave').addEventListener('click',()=>{const g=Math.max(1,Math.min(120,parseInt($('#goalIn').value,10)||10));saveField({daily_goal_min:g},'Meta guardada.')});
$('#noteSave').addEventListener('click',()=>saveField({real_name:$('#noteIn').value.trim()||null},'Nombre guardado.'));
$('#passSave').addEventListener('click',async()=>{const p=$('#passIn').value;if(p.length<4)return msg($('#acctMsg'),'La contraseña debe tener al menos 4 caracteres.');
  const {error}=await sb.rpc('tutor_reset_password',{p_student:stuId,p_password:p});
  if(error)return msg($('#acctMsg'),'No se pudo cambiar.');$('#passIn').value='';msg($('#acctMsg'),'Listo. Dile su nueva contraseña: '+p,true)});
$('#stuDel').addEventListener('click',async()=>{if(!delArmed){delArmed=true;$('#stuDel').textContent='Confirmar: borrar la cuenta y todo su progreso';return}
  const {error}=await sb.from('students').delete().eq('id',stuId);if(error)return;stuId=null;await load();show('list')});

/* ---------- boot ---------- */
if(!sb){msg($('#loginMsg'),'Falta configurar la conexión (config.js).');}
else{
  sb.auth.onAuthStateChange((ev,session)=>{
    if(session){if(cur==='login'){show('list');loadClass();load();subscribe()}}
    else{if(channel){sb.removeChannel(channel);channel=null}students=[];sessions=[];show('login')}});
}
})();
