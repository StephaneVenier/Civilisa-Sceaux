// Config
const GAME = {
  title: "Aventure Égyptienne",
  gm: "Stefanubis",
  words: ["ANUBIS","PAPYRUS","SCARABEE","SPHINX","NIL","PHARAON","ANKH","BASTET","PYRAMIDE","OSIRIS"],
  cutoffHour: 16
};
// Keys
const KEY_META="civ_game_meta", KEY_PLAYERS="civ_players", KEY_SESSION="civ_session";
// Utils
const $=s=>document.querySelector(s);
function esc(s){return (s||"").replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function now(){return new Date()}
function toISO(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,19)+getTZISO()}
function getTZISO(){const off=-new Date().getTimezoneOffset(),sign=off>=0?"+":"-";const abs=Math.abs(off),h=String(Math.floor(abs/60)).padStart(2,"0"),m=String(abs%60).padStart(2,"0");return sign+h+":"+m}
function nextFridayAt(hour=16){const d=new Date(),day=d.getDay(),t=new Date(d);let add=5-day;if(add<0)add+=7;if(add===0){if(d.getHours()>hour||(d.getHours()===hour&&(d.getMinutes()>0||d.getSeconds()>0)))add=7}t.setDate(d.getDate()+add);t.setHours(hour,0,0,0);return t}
function ensureMeta(){let m=loadMeta();if(!m){m={startAt:toISO(now()),endAt:toISO(nextFridayAt(GAME.cutoffHour))};saveMeta(m)}return m}
function loadMeta(){try{return JSON.parse(localStorage.getItem(KEY_META)||"null")}catch(e){return null}}
function saveMeta(m){localStorage.setItem(KEY_META,JSON.stringify(m))}
function loadPlayers(){try{return JSON.parse(localStorage.getItem(KEY_PLAYERS)||"{}")}catch(e){return {}}}
function savePlayers(o){localStorage.setItem(KEY_PLAYERS,JSON.stringify(o))}
function setSession(p){localStorage.setItem(KEY_SESSION,p)}
function getSession(){return localStorage.getItem(KEY_SESSION)||""}
function sanitize(s){return (s||"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function msToDHMS(ms){ if(ms<0) return {d:0,h:0,m:0,s:0}; const s=Math.floor(ms/1000), d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60), sec=s%60; return {d,h,m,sec};}
function startTimer(el){ const meta=ensureMeta(); function tick(){ const ms=new Date(meta.endAt)-now(); const t=msToDHMS(ms); el.textContent = ms<=0? "⏳ Jeu en pause (fin atteinte)" : `⏳ Il reste : ${t.d}j ${String(t.h).padStart(2,'0')}h ${String(t.m).padStart(2,'0')}m ${String(t.s).padStart(2,'0')}s`; } tick(); const id=setInterval(tick,1000); return ()=>clearInterval(id); }

// Leaderboard compute
function computeLeaderboard(players){
  const list=Object.entries(players).map(([pseudo,st])=>({pseudo,found:(st.found||[]).length,score:st.score||0,lastTs:st.lastTs||null}));
  list.sort((a,b)=>b.score-a.score || (a.lastTs&&b.lastTs? new Date(a.lastTs)-new Date(b.lastTs) : (a.lastTs? -1 : b.lastTs? 1 : a.pseudo.localeCompare(b.pseudo))));
  return list;
}

// Export XLSX
function exportXLSX(){
  if(typeof XLSX==='undefined'){ alert("Module XLSX non chargé."); return; }
  const players=loadPlayers();
  const leaderboard=computeLeaderboard(players);
  const meta=ensureMeta();
  const s1=[["pseudo","total_codes","score","last_update"]];
  leaderboard.forEach(r=>s1.push([r.pseudo,r.found,r.score,r.lastTs||""]));
  const s2=[["pseudo","code","timestamp"]];
  Object.entries(players).forEach(([p,st])=> (st.journal||[]).forEach(j=> s2.push([p,j.word,j.ts])));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s1),"Leaderboard");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s2),"Journal");
  const fname=`aventures-egyptiennes_${(meta.endAt||"").slice(0,10)}.xlsx`;
  XLSX.writeFile(wb,fname);
}

// Admin reset
function adminResetAll(pwd){
  if(pwd!=="Stephane"){ alert("Mot de passe incorrect."); return; }
  if(!confirm("Effacer TOUTES les données locales (joueurs, méta, session) ?")) return;
  localStorage.removeItem(KEY_META);
  localStorage.removeItem(KEY_PLAYERS);
  localStorage.removeItem(KEY_SESSION);
  alert("Réinitialisé.");
  location.reload();
}

// Pages
function pageIndex(){
  ensureMeta();
  const players=loadPlayers();
  const leaderboard=computeLeaderboard(players);
  const tbody=$("#board");
  tbody.innerHTML = leaderboard.length? leaderboard.map(r=>`<tr><td>${esc(r.pseudo)}</td><td>${r.found}/${GAME.words.length}</td><td>${r.score}</td><td>${r.lastTs? new Date(r.lastTs).toLocaleString('fr-FR'):''}</td></tr>`).join("") : `<tr><td colspan="4" class="muted">Aucun joueur pour l’instant.</td></tr>`;
  $("#btnStart").onclick=()=>{ const p=getSession(); location.href = p? "jeu.html" : "intro.html"; };
  $("#btnIntro").onclick=()=> location.href="intro.html";
  $("#btnExport").onclick=exportXLSX;
  // Timer
  const stop = startTimer($("#timer"));
  // Admin
  $("#adminBtn").onclick=()=>{
    const pwd = prompt("Mot de passe admin :");
    if(pwd!==null) adminResetAll(pwd);
  };
}
function pageIntro(){
  const input=$("#pseudo"); input.value=getSession();
  $("#btnSave").onclick=()=>{
    const p=input.value.trim(); if(!p){alert("Entre un pseudo/prénom."); return;}
    setSession(p);
    const players=loadPlayers(); if(!players[p]) players[p]={found:[],score:0,lastTs:null,journal:[]}; savePlayers(players);
    location.href="jeu.html";
  };
  $("#btnBack").onclick=()=> history.back();
}
function renderChecklist(container, foundSet){
  const ul=document.createElement("ul"); ul.className="codes";
  GAME.words.forEach(w=>{
    const li=document.createElement("li");
    if(foundSet.has(w)){ li.classList.add("found"); li.innerHTML = `<span>${esc(w)}</span><span>✔</span>`; }
    else{ const dots="•".repeat(Math.max(4, Math.min(9, w.length))); li.innerHTML = `<span class="placeholder">${dots}</span><span>—</span>`; }
    ul.appendChild(li);
  });
  container.innerHTML=""; container.appendChild(ul);
}
function pagePlay(){
  ensureMeta();
  const p=getSession(); if(!p){ location.href="intro.html"; return; }
  const players=loadPlayers(); const st=players[p]||{found:[],score:0,journal:[]};
  const foundSet=new Set(st.found||[]);
  // header info
  $("#player").textContent=p;
  const total=GAME.words.length, val=foundSet.size; const pct=Math.round(val/total*100);
  $("#progressBar").style.width=pct+"%"; $("#progressTxt").textContent=`${val}/${total} codes`;
  // timer
  startTimer($("#timer"));
  // checklist initial
  renderChecklist($("#checklist"), foundSet);
  // handlers
  $("#btnHome").onclick=()=> location.href="index.html";
  const fb=$("#feedback");
  $("#btnValider").onclick=()=>{
    const entered=sanitize($("#codeInput").value);
    if(!entered){ fb.textContent="Entre un mot-code."; fb.className="bad"; return; }
    const match = GAME.words.find(w=> sanitize(w)===entered );
    if(!match){ fb.textContent="❌ Code inconnu."; fb.className="bad"; return; }
    if(foundSet.has(match)){ fb.textContent=`⚠️ « ${match} » déjà validé.`; fb.className="bad"; return; }
    const nowISO=toISO(now());
    foundSet.add(match);
    st.found=Array.from(foundSet);
    st.score=(st.score||0)+1;
    st.lastTs=nowISO;
    st.journal=[...(st.journal||[]), {word:match, ts:nowISO}];
    players[p]=st; savePlayers(players);
    $("#codeInput").value="";
    const newPct=Math.round(foundSet.size/total*100);
    $("#progressBar").style.width=newPct+"%"; $("#progressTxt").textContent=`${foundSet.size}/${total} codes`;
    renderChecklist($("#checklist"), foundSet);
    fb.textContent=`✅ « ${match} » validé (+1)`; fb.className="ok";
  };
}

// Auto init
document.addEventListener("DOMContentLoaded", ()=>{
  const page=document.body.dataset.page;
  if(page==="index") pageIndex();
  else if(page==="intro") pageIntro();
  else if(page==="play") pagePlay();
});
