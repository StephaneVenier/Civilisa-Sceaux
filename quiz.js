
const ADMIN_NAME = "Stephane";
const ADMIN_PIN  = "Sceaux2025";
function storageKey(slug){ return "civilisasceaux_mp_" + slug; }
function qs(sel){ return document.querySelector(sel); }
function getAll(slug){ return JSON.parse(localStorage.getItem(storageKey(slug)) || "{}"); }
function saveState(slug, pseudo, obj){ const all=getAll(slug); all[pseudo]=obj; localStorage.setItem(storageKey(slug), JSON.stringify(all)); }
function loadState(slug, pseudo){ const all=getAll(slug); return all[pseudo]||null; }
function top10(slug){ const rows=Object.entries(getAll(slug)).map(([n,o])=>({name:n, score:(o?.best)|0, t:o?.t|0})); rows.sort((a,b)=> b.score-a.score || a.t-b.t); return rows.slice(0,10); }
function renderLeaderboard(slug, el){ const top=top10(slug); if(!top.length){ el.innerHTML='<p class="muted" style="margin:0">Aucun score pour le moment.</p>'; return; } el.innerHTML = top.map((r,i)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#0b1421"><div style="display:flex;align-items:center;gap:10px"><div class="pill">${i+1}</div><strong>${r.name}</strong></div><div><span class="pill">🏆 ${r.score}</span></div></div>`).join(""); }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function setupQuizPage(meta){
  const slug=meta.slug;
  qs("body").style.setProperty("--themeGrad", meta.theme||"linear-gradient(90deg,#7c4dff,#f6c453)");
  qs("#banner-emoji").textContent = meta.icon||"🏛️";
  qs("#banner-title").textContent = meta.title||"Quiz";
  renderLeaderboard(slug, qs("#leaderboard"));
  function updateAdmin(){
    const name=(qs("#pseudo").value||"").trim();
    qs("#adminBlock").classList.toggle("hidden", name!==ADMIN_NAME);
    qs("#adminTools").classList.toggle("hidden", !(name===ADMIN_NAME && window.__adminUnlocked));
  }
  let state={idx:0, score:0, pseudo:"", items:(window.QUIZ_ITEMS||[])};
  function start(){
    const name=(qs("#pseudo").value||"").trim();
    if(!name){qs("#pseudo").focus();return;}
    state.pseudo=name;
    if(!state.items.length){ alert("Pas encore de questions : importe un CSV ou reviens plus tard 🙂"); return; }
    qs("#screen-setup").classList.add("hidden");
    qs("#screen-quiz").classList.remove("hidden");
    renderQuestion();
  }
  function renderQuestion(){
    const q=state.items[state.idx];
    qs("#qPos").textContent=`Question ${state.idx+1}/${state.items.length}`;
    qs("#qText").textContent=q.q;
    const answers=shuffle(q.choices.map((t,i)=>({t, correct:i===q.correct})));
    const box=qs("#answers"); box.innerHTML="";
    answers.forEach((a,i)=>{const b=document.createElement("button"); b.className="answer"; b.type="button"; b.dataset.correct=a.correct?"1":"0"; b.innerHTML=`<span>${String.fromCharCode(65+i)}.</span> ${a.t}`; b.addEventListener("click",()=>selectAnswer(b)); box.appendChild(b);});
    qs("#progress").style.width=`${(state.idx)/state.items.length*100}%`;
    qs("#feedback").textContent=""; qs("#btnNext").disabled=true;
  }
  function lock(){ [...qs("#answers").children].forEach(b=>b.setAttribute("disabled","")); }
  function selectAnswer(btn){
    lock(); const ok=btn.dataset.correct==="1";
    if(ok){ btn.classList.add("correct"); qs("#feedback").textContent="Bravo !"; qs("#feedback").style.color="var(--good)"; state.score+=1;}
    else{ btn.classList.add("wrong"); const good=[...qs("#answers").children].find(b=>b.dataset.correct==="1"); if(good) good.classList.add("correct"); qs("#feedback").textContent="Non, ce n'est pas ça."; qs("#feedback").style.color="var(--bad)"; }
    qs("#btnNext").disabled=false;
  }
  function next(){
    if(state.idx<state.items.length-1){ state.idx+=1; renderQuestion(); }
    else{
      const prev=loadState(slug, state.pseudo)||{best:0};
      const best=Math.max(prev.best|0, state.score|0);
      saveState(slug, state.pseudo, {best, t:Date.now()});
      qs("#screen-quiz").classList.add("hidden"); qs("#screen-end").classList.remove("hidden");
      qs("#endLine").textContent=`${state.pseudo}, tu as obtenu ${state.score}/${state.items.length}.`;
      renderLeaderboard(slug, qs("#leaderboard"));
    }
  }
  function parseCSVtext(text){
    const lines=text.trim().split(/\r?\n/); const out=[];
    let start=0; const header=lines[0].split(";"); if(/question/i.test(header[0])) start=1;
    for(let i=start;i<lines.length;i++){ const cols=lines[i].split(";"); if(cols.length<5) continue; out.push({q:cols[0], choices:[cols[1],cols[2],cols[3]], correct: parseInt(cols[4],10)||0}); }
    return out;
  }
  function handleFile(e){
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader(); r.onload=()=>{ try{ state.items=parseCSVtext(r.result); alert(`Questions chargées : ${state.items.length}`);}catch(err){ alert("CSV invalide"); } }; r.readAsText(file,"utf-8");
  }
  function adminUnlock(){ const pin=prompt("Code PIN admin :"); if(pin===ADMIN_PIN){ window.__adminUnlocked=true; alert("Mode admin activé."); updateAdmin(); } else { alert("Code incorrect."); } }
  function resetMe(){ const name=(qs("#pseudo").value||"").trim(); if(!(name===ADMIN_NAME && window.__adminUnlocked)) return; saveState(slug, name, {best:0, t:Date.now()}); alert("Score réinitialisé pour "+name); renderLeaderboard(slug, qs("#leaderboard")); }
  function resetAll(){ if(!window.__adminUnlocked) return; if(confirm("Effacer tous les scores de ce quiz ?")){ localStorage.removeItem(storageKey(slug)); alert("Scores supprimés."); renderLeaderboard(slug, qs("#leaderboard")); } }
  qs("#btnStart").addEventListener("click", start);
  qs("#fileCSV").addEventListener("change", handleFile);
  qs("#btnNext").addEventListener("click", next);
  qs("#btnCatalogue").addEventListener("click", ()=>location.href="catalogue.html");
  qs("#btnHome").addEventListener("click", ()=>location.href="index.html");
  qs("#btnAdmin").addEventListener("click", adminUnlock);
  qs("#btnResetMe").addEventListener("click", resetMe);
  qs("#btnResetAll").addEventListener("click", resetAll);
  qs("#pseudo").addEventListener("input", updateAdmin);
  updateAdmin();
}
