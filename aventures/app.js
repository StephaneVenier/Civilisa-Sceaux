// --- Config ---
const GAME = {
  gameId: "egypt-local-001",
  title: "Aventure Égyptienne",
  gm: "Stefanubis",
  steps: [
    {id:"egy1", word:"ANUBIS", points:1, msg:"Stefanubis chuchote : le sable garde les secrets…"},
    {id:"egy2", word:"PAPYRUS", points:1, msg:"Les dieux observent. Un code de plus, courage !"},
    {id:"egy3", word:"SCARABEE", points:1, msg:"Tu marches dans les pas d’un scribe habile."},
    {id:"egy4", word:"SPHINX", points:1, msg:"Le Nil t’encourage, continue l’exploration !"},
    {id:"egy5", word:"NIL", points:1, msg:"Le vent du désert porte ton nom au panthéon…"},
    {id:"egy6", word:"PHARAON", points:1, msg:"Le scarabée roule… ta chance aussi."},
    {id:"egy7", word:"ANKH", points:1, msg:"Ton papyrus se dévoile, signe après signe."},
    {id:"egy8", word:"BASTET", points:1, msg:"La lumière de Râ éclaire ta piste."},
    {id:"egy9", word:"PYRAMIDE", points:1, msg:"Plus que quelques symboles à graver…"},
    {id:"egy10", word:"OSIRIS", points:1, msg:"Le dernier secret t’attend, va au bout !"}
  ],
  cutoffHour: 16
};

// Keys & Utils (same)
const KEY_META = "civ_game_meta";
const KEY_PLAYERS = "civ_players";
const KEY_SESSION = "civ_session";
const $ = (s)=>document.querySelector(s);
function esc(s){return (s||"").replace(/[&<>\"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m]))}
function now(){ return new Date(); }
function toISO(d){ return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,19)+getTZISO(); }
function getTZISO(){ const off=-new Date().getTimezoneOffset(); const sign=off>=0?"+":"-"; const abs=Math.abs(off); const h=String(Math.floor(abs/60)).padStart(2,"0"); const m=String(abs%60).padStart(2,"0"); return sign+h+":"+m; }
function loadMeta(){ try{return JSON.parse(localStorage.getItem(KEY_META)||"null")}catch(e){return null} }
function saveMeta(m){ localStorage.setItem(KEY_META, JSON.stringify(m)); }
function ensureMeta(){ let m=loadMeta(); if(!m){ m={gameId:GAME.gameId,gm:GAME.gm,startAt:toISO(now()),endAt:toISO(nextFridayAt(GAME.cutoffHour))}; saveMeta(m);} return m; }
function resetMetaStartIfNewWeek(){ let m=loadMeta(); if(!m) return ensureMeta(); if(now()>new Date(m.endAt)){ m.startAt=toISO(now()); m.endAt=toISO(nextFridayAt(GAME.cutoffHour)); saveMeta(m);} return m; }
function loadPlayers(){ try{return JSON.parse(localStorage.getItem(KEY_PLAYERS)||"{}")}catch(e){return {}} }
function savePlayers(o){ localStorage.setItem(KEY_PLAYERS, JSON.stringify(o)); }
function setSession(p){ localStorage.setItem(KEY_SESSION, p); }
function getSession(){ return localStorage.getItem(KEY_SESSION)||""; }
function sanitize(s){ return (s||"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
function nextFridayAt(hour=16){ const d=new Date(); const day=d.getDay(); const t=new Date(d); let add=5-day; if(add<0) add+=7; if(add===0){ if(d.getHours()>hour || (d.getHours()===hour && (d.getMinutes()>0 || d.getSeconds()>0))){ add=7; } } t.setDate(d.getDate()+add); t.setHours(hour,0,0,0); return t; }
function msToDHMS(ms){ if(ms<0) return {d:0,h:0,m:0,s:0}; const s=Math.floor(ms/1000), d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60), sec=s%60; return {d,h,m,sec}; }
function isEnded(m){ return now()>new Date(m.endAt); }
function computeLeaderboard(players){ const list=Object.entries(players).map(([pseudo,st])=>({pseudo,found:(st.found||[]).length,score:st.score|| (st.found||[]).length,lastTs:st.lastTs||null})); list.sort((a,b)=> b.score-a.score || (a.lastTs&&b.lastTs? new Date(a.lastTs)-new Date(b.lastTs): (a.lastTs? -1 : b.lastTs? 1 : a.pseudo.localeCompare(b.pseudo)))); return list; }

function exportXLSX(){ if(typeof XLSX==='undefined'){ alert('Module XLSX non chargé.'); return; } const players=loadPlayers(); const leaderboard=computeLeaderboard(players); const meta=loadMeta()||ensureMeta(); const s1=[['pseudo','total_codes','score','last_update']]; leaderboard.forEach(r=>s1.push([r.pseudo,r.found,r.score,r.lastTs||''])); const s2=[['pseudo','stepId','word','timestamp']]; Object.entries(players).forEach(([p,st])=> (st.journal||[]).forEach(j=> s2.push([p,j.stepId,j.word,j.ts]))); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s1),'Leaderboard'); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s2),'Journal'); const fname=`aventures-egyptiennes_${(meta.endAt||'').slice(0,10)}.xlsx`; XLSX.writeFile(wb,fname); }

// ---- Pages ----
function pageIndex(){ const meta=resetMetaStartIfNewWeek(); const players=loadPlayers(); const leaderboard=computeLeaderboard(players); const timerEl=document.getElementById('timer'); function tick(){ const ms=new Date(meta.endAt)-now(); const t=msToDHMS(ms); timerEl.textContent = ms<=0? '⏳ Jeu terminé — en pause.' : `⏳ Temps restant : ${t.d}j ${String(t.h).padStart(2,'0')}h ${String(t.m).padStart(2,'0')}m ${String(t.sec).padStart(2,'0')}s`; } tick(); window.__timer && clearInterval(window.__timer); window.__timer=setInterval(tick,1000); document.getElementById('btnStart').onclick=()=>{ const p=getSession(); location.href = p? 'egy1.html' : 'intro.html'; }; document.getElementById('btnIntro').onclick=()=> location.href='intro.html'; document.getElementById('btnExport').onclick=exportXLSX; document.getElementById('btnResetWeek').onclick=()=>{ const m=ensureMeta(); m.startAt=toISO(now()); m.endAt=toISO(nextFridayAt(GAME.cutoffHour)); saveMeta(m); tick(); }; document.getElementById('btnClearAll').onclick=()=>{ if(confirm('Effacer toutes les données locales ?')){ localStorage.removeItem(KEY_META); localStorage.removeItem(KEY_PLAYERS); localStorage.removeItem(KEY_SESSION); location.reload(); } }; const tbody=document.querySelector('#board'); tbody.innerHTML = leaderboard.length? leaderboard.map(r=>`<tr><td>${esc(r.pseudo)}</td><td>${r.found}/${GAME.steps.length}</td><td>${r.score}</td><td>${r.lastTs? new Date(r.lastTs).toLocaleString('fr-FR'):''}</td></tr>`).join('') : `<tr><td colspan=\"4\" class=\"muted\">Aucun joueur pour l’instant.</td></tr>`; }

function pageIntro(){ const meta=ensureMeta(); document.getElementById('deadline').textContent = new Date(meta.endAt).toLocaleString('fr-FR'); const input=document.getElementById('pseudo'); input.value=getSession(); document.getElementById('btnSave').onclick=()=>{ const p=input.value.trim(); if(!p){ alert('Entre un pseudo/prénom.'); return;} setSession(p); const players=loadPlayers(); if(!players[p]) players[p]={found:[],score:0,lastTs:null,journal:[]}; savePlayers(players); location.href='egy1.html'; }; document.getElementById('btnBack').onclick=()=> history.back(); }

// NEW: accept any code on any step
function pageStep(stepId){ const p=getSession(); if(!p){ location.href='intro.html'; return;} const meta=ensureMeta(); const ended=isEnded(meta); const players=loadPlayers(); const st=players[p]||{found:[],score:0}; const found=new Set(st.found||[]); const total=GAME.steps.length; const val=(st.found||[]).length; const pct=Math.round(val/total*100); document.getElementById('player').innerHTML = esc(p); document.getElementById('progressBar').style.width=pct+'%'; document.getElementById('progressTxt').textContent=`${val}/${total} codes`; document.getElementById('deadline').textContent=new Date(meta.endAt).toLocaleString('fr-FR'); document.getElementById('btnPrev').onclick=()=>{ const i=GAME.steps.findIndex(s=>s.id===stepId); location.href=(GAME.steps[i-1]?.id||'egy1')+'.html'; }; document.getElementById('btnNext').onclick=()=>{ const i=GAME.steps.findIndex(s=>s.id===stepId); location.href=(GAME.steps[i+1]?.id||'finale')+'.html'; }; document.getElementById('btnHome').onclick=()=> location.href='index.html'; const fb=document.getElementById('feedback'); if(ended){ document.getElementById('codeInput').disabled=true; document.getElementById('btnValider').disabled=true; fb.textContent='Jeu terminé — en pause.'; fb.className='bad'; return;} document.getElementById('btnValider').onclick=()=>{ const valIn=sanitize(document.getElementById('codeInput').value); if(!valIn){ fb.textContent='Entre un mot-code.'; fb.className='bad'; return;} const match = GAME.steps.find(s=> sanitize(s.word)===valIn ); if(!match){ fb.textContent='❌ Code inconnu. Réessaie.'; fb.className='bad'; return;} const nowISO=toISO(now()); if(found.has(match.id)){ fb.textContent=`⚠️ Le code « ${match.word} » est déjà validé.`; fb.className='bad'; return; } st.found=[...found, match.id]; st.score=(st.score||0)+1; st.lastTs=nowISO; st.journal=[...(st.journal||[]), {stepId:match.id,word:match.word,ts:nowISO}]; players[p]=st; savePlayers(players); document.getElementById('progressBar').style.width=Math.round(st.found.length/total*100)+'%'; document.getElementById('progressTxt').textContent=`${st.found.length}/${total} codes`; fb.textContent=`✅ Code « ${match.word} » validé (+1)`; fb.className='ok'; document.getElementById('codeInput').value=''; }; }

function pageFinale(){ const p=getSession(); const st=(loadPlayers()[p]||{found:[]}); const total=GAME.steps.length; const val=(st.found||[]).length; const ok=val>=total; document.getElementById('progressBar').style.width=Math.round(val/total*100)+'%'; document.getElementById('progressTxt').textContent=`${val}/${total} codes`; if(ok) document.querySelector('.finale').classList.add('unlock'); document.getElementById('btnExport').onclick=exportXLSX; document.getElementById('btnBack').onclick=()=> location.href='egy1.html'; document.getElementById('btnHome').onclick=()=> location.href='index.html'; }

document.addEventListener('DOMContentLoaded', ()=>{ const page=document.body.dataset.page; if(page==='index') pageIndex(); else if(page==='intro') pageIntro(); else if(page==='step') pageStep(document.body.dataset.step); else if(page==='finale') pageFinale(); });
