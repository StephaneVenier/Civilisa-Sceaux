// =========================
// app.js — Aventures (QR)
// =========================

// Helpers DOM
const $  = (s)=>document.querySelector(s);

// Wait until firebase-init set window.fb
async function waitForFb(max=80){
  while (max-- > 0){
    if (window.fb && window.fb.db) return true;
    await new Promise(r=>setTimeout(r, 100));
  }
  console.warn("Firebase not ready — continuing without it (UI only).");
  return false;
}

// Session (pseudo)
function getSession(){ return (localStorage.getItem('civ_session')||'').trim().toLowerCase(); }
function setSession(v){ localStorage.setItem('civ_session', (v||'').trim().toLowerCase()); }

// -------- Timer : prochain vendredi 16:00 --------
function nextFriday1600(from){
  const d = new Date(from||Date.now());
  const day = d.getDay(); // 0=dim, 5=vendredi
  const t = new Date(d);
  const diff = (5 - day + 7) % 7;
  t.setDate(d.getDate() + diff);
  t.setHours(16,0,0,0);
  if (t <= d) t.setDate(t.getDate()+7);
  return t;
}
function getDeadline(){
  const raw = localStorage.getItem('aventures_deadline'), now = Date.now();
  if (raw){
    const t = +raw;
    if (!isNaN(t) && t > now) return new Date(t);
  }
  const n = nextFriday1600();
  localStorage.setItem('aventures_deadline', String(n.getTime()));
  return n;
}
function resetDeadline(){
  const n = nextFriday1600();
  localStorage.setItem('aventures_deadline', String(n.getTime()));
  return n;
}
function fmt(ms){
  if (ms<=0) return "⏳ Terminé";
  const s=Math.floor(ms/1000), d=Math.floor(s/86400),
        h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60), ss=s%60;
  return `${d}j ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}
function startTimer(el){
  const loop=()=>{ const dl=getDeadline().getTime(), left=dl-Date.now();
    el.textContent = left>0 ? `Fin : ${new Date(dl).toLocaleString('fr-FR')} — ${fmt(left)}` : "⏳ Terminé";
    setTimeout(loop, 1000);
  }; loop();
}

// -------- Firestore : classement partagé (live) --------
async function fbLiveLeaderboard(fill){
  const col = window.fb.collection(window.fb.db, 'finds');
  window.fb.onSnapshot(col, (snap)=>{
    const map = new Map(); // nickname -> score
    snap.forEach(d=>{ const x=d.data(); if (!x?.nickname) return; map.set(x.nickname, (map.get(x.nickname)||0) + 1); });
    const rows = [...map.entries()].map(([nickname,score])=>({ nickname, score }));
    rows.sort((a,b)=> b.score - a.score || a.nickname.localeCompare(b.nickname));
    fill(rows);
  });
}

// -------- Progression perso (live) --------
const TOTAL = 10;
function setProgress(n){
  const pct = Math.min(100, Math.round(n / TOTAL * 100));
  const bar = $("#progressBar"), txt = $("#progressTxt");
  if (bar) bar.style.width = pct + "%";
  if (txt) txt.textContent = `${n}/${TOTAL} codes`;
}
function renderFound(list){
  const box = $("#checklist"); if (!box) return;
  box.innerHTML = list.length
    ? list.map(t=>`<div style="text-decoration:line-through;opacity:.7">${t}</div>`).join("")
    : `<div class="muted">Aucun code validé pour l’instant.</div>`;
}
function subscribeMine(nickname){
  const col = window.fb.collection(window.fb.db, 'finds');
  const q   = window.fb.query(col, window.fb.where('nickname','==',nickname));
  window.fb.onSnapshot(q, (snap)=>{
    const toks=[]; snap.forEach(d=>{ const x=d.data(); if (x?.token) toks.push(x.token); });
    setProgress(toks.length); renderFound(toks);
  });
}

// ======== Scanner universel via html5-qrcode ========
const TOKEN_RE = /[A-Z0-9]{2,5}-[A-Z0-9]{6,8}-[A-Z0-9]{2}/;
let h5q = null;

function handleScanResult(raw){
  try{
    raw = (raw || "").trim();
    if (!raw) return;

    if (/^https?:\/\//i.test(raw)){
      const url = new URL(raw, location.origin);
      const t = url.searchParams.get('token') || (raw.match(TOKEN_RE)||[])[0];
      if (t) location.href = `redeem.html?token=${encodeURIComponent(t)}`;
      else   location.href = raw;
      return;
    }
    const token = (raw.match(TOKEN_RE)||[])[0];
    if (token) { location.href = `redeem.html?token=${encodeURIComponent(token)}`; return; }

    alert("QR non reconnu.");
  }catch(e){
    console.error(e);
  }
}

async function startScan(){
  const box  = document.getElementById('scanBox');
  const hint = document.getElementById('scanHint');
  const regionId = "qrRegion";
  box.style.display = 'block';

  try{
    if (h5q) { try{ await h5q.stop(); }catch{} try{ await h5q.clear(); }catch{} }
    // html5-qrcode lib must be already loaded from jeu.html
    h5q = new Html5Qrcode(regionId, /* verbose */ false);

    const config = { fps: 12, qrbox: { width: 280, height: 280 }, aspectRatio: 1.777 };
    await h5q.start(
      { facingMode: "environment" },
      config,
      (decodedText) => { stopScan(); handleScanResult(decodedText); },
      (errMsg) => { /* ignore not-found */ }
    );
  }catch(err){
    console.error(err);
    hint.textContent = "🚫 Caméra inaccessible. Autorise l’accès ou scanne avec l’appareil photo (le QR ouvrira la page).";
  }
}

async function stopScan(){
  const box = document.getElementById('scanBox');
  box.style.display = 'none';
  if (h5q){
    try{ await h5q.stop(); }catch{} 
    try{ await h5q.clear(); }catch{}
    h5q = null;
  }
}

// -------- Pages --------
async function pageIndex(){
  await waitForFb();
  const tbody = $("#board");
  if (window.fb && window.fb.db){
    fbLiveLeaderboard(rows=>{
      tbody.innerHTML = rows.length
        ? rows.map(r=>`<tr><td>${r.nickname}</td><td>—</td><td>${r.score}</td><td>live</td></tr>`).join("")
        : `<tr><td colspan="4" class="muted">Aucun joueur pour l’instant.</td></tr>`;
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Classement indisponible (Firebase).</td></tr>`;
  }

  $("#btnStart").onclick = ()=>{ const p=getSession(); location.href = p ? "jeu.html" : "intro.html"; };
  $("#btnIntro").onclick = ()=> location.href="intro.html";

  startTimer($("#timer"));

  $("#adminResetTimer").onclick = ()=>{
    const pwd = prompt("Mot de passe admin :");
    if (pwd === "Stephane"){
      const n = resetDeadline();
      alert("Timer réinitialisé jusqu’au : " + n.toLocaleString('fr-FR'));
    } else if (pwd !== null){
      alert("Mot de passe incorrect.");
    }
  };
}

async function pageIntro(){
  await waitForFb();
  const input = $("#pseudo");
  input.addEventListener('keydown', (e)=>{ if (e.key === "Enter") $("#btnSave").click(); });
  $("#btnSave").onclick = ()=>{
    const v = input.value.trim();
    if (!v){ alert("Entre un pseudo / prénom"); return; }
    setSession(v);
    location.href = "jeu.html";
  };
  $("#btnBack").onclick = ()=> history.back();
}

async function pagePlay(){
  await waitForFb();
  const p = getSession();
  if (!p){ location.href="intro.html"; return; }

  const el = $("#player"); if (el) el.textContent = p;

  startTimer($("#timer"));
  if (window.fb && window.fb.db) subscribeMine(p);

  $("#btnScan").onclick = startScan;
  $("#btnStopScan").onclick = stopScan;
}

// Router
document.addEventListener('DOMContentLoaded', ()=>{
  const page = document.body.getAttribute('data-page') || '';
  if (page === "index") pageIndex();
  else if (page === "intro") pageIntro();
  else if (page === "play") pagePlay();
});
