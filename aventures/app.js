
// Small DOM helpers
const $ = (sel)=>document.querySelector(sel);
const $$ = (sel)=>Array.from(document.querySelectorAll(sel));

function getSession(){ return (localStorage.getItem('civ_session')||'').trim().toLowerCase(); }
function setSession(p){ localStorage.setItem('civ_session', (p||'').trim().toLowerCase()); }
function ensureMeta(){}

function nextFriday1600(fromDate){
  const d = new Date(fromDate||Date.now());
  const day = d.getDay();
  const target = new Date(d);
  const diffToFri = (5 - day + 7) % 7;
  target.setDate(d.getDate() + diffToFri);
  target.setHours(16,0,0,0);
  if (target.getTime() <= d.getTime()) target.setDate(target.getDate()+7);
  return target;
}
function getDeadline(){
  const raw = localStorage.getItem('aventures_deadline');
  const now = Date.now();
  if (raw){
    const t = Number(raw);
    if (!isNaN(t) && t > now) return new Date(t);
  }
  const n = nextFriday1600();
  localStorage.setItem('aventures_deadline', String(n.getTime()));
  return n;
}
function resetDeadlineToNextFriday(){
  const n = nextFriday1600();
  localStorage.setItem('aventures_deadline', String(n.getTime()));
  return n;
}
function formatCountdown(ms){
  if (ms<=0) return "⏳ Terminé";
  const s = Math.floor(ms/1000);
  const d = Math.floor(s/86400);
  const h = Math.floor((s%86400)/3600);
  const m = Math.floor((s%3600)/60);
  const ss= s%60;
  return `${d}j ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}
function startTimer(el){
  function tick(){
    const dl = getDeadline().getTime();
    const left = dl - Date.now();
    el.textContent = left>0 ? `Fin : ${new Date(dl).toLocaleString('fr-FR')} — ${formatCountdown(left)}` : "⏳ Terminé";
    requestAnimationFrame(()=>setTimeout(tick, 1000));
  }
  tick();
}

async function fbLiveLeaderboard(fillTable) {
  const colRef = window.fb.collection(window.fb.db, 'finds');
  window.fb.onSnapshot(colRef, (snap) => {
    const map = new Map();
    snap.forEach(docSnap => {
      const d = docSnap.data();
      if (!d || !d.nickname) return;
      map.set(d.nickname, (map.get(d.nickname)||0) + 1);
    });
    const rows = [...map.entries()].map(([nickname, score]) => ({ nickname, score }));
    rows.sort((a,b)=> b.score - a.score || a.nickname.localeCompare(b.nickname));
    fillTable(rows);
  });
}

const TOTAL_TOKENS = 10;
function setProgress(foundCount, total) {
  const pct = Math.min(100, Math.round((foundCount / total) * 100));
  const bar = document.getElementById('progressBar');
  const txt = document.getElementById('progressTxt');
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = `${foundCount}/${total} codes`;
}
function renderChecklist(tokensFound) {
  const box = document.getElementById('checklist');
  if (!box) return;
  box.innerHTML = tokensFound.length
    ? tokensFound.map(t => `<div style="text-decoration:line-through;opacity:.7">${t}</div>`).join('')
    : `<div class="muted">Aucun code validé pour l’instant.</div>`;
}
function subscribeMyProgress(nickname) {
  const col = window.fb.collection(window.fb.db, 'finds');
  const q = window.fb.query(col, window.fb.where('nickname', '==', nickname));
  window.fb.onSnapshot(q, (snap) => {
    const tokens = [];
    snap.forEach(doc => { const d = doc.data(); if (d?.token) tokens.push(d.token); });
    setProgress(tokens.length, TOTAL_TOKENS);
    renderChecklist(tokens);
  });
}

const TOKEN_RE = /[A-Z0-9]{2,5}-[A-Z0-9]{6,8}-[A-Z0-9]{2}/;
let scanStream = null, scanTimer = null;
async function startQRScan(){
  const hasDetector = ('BarcodeDetector' in window);
  const scanBox = document.getElementById('scanBox');
  const video   = document.getElementById('scanVideo');
  const hint    = document.getElementById('scanHint');
  scanBox.style.display = 'block';
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = scanStream;
    if (!hasDetector) {
      hint.innerHTML = "💡 Navigateur sans scan intégré. Utilise l’appareil photo : le QR ouvrira la page de validation.";
      return;
    }
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const tick = async () => {
      if (!video.readyState || video.readyState < 2) { scanTimer = requestAnimationFrame(tick); return; }
      try {
        const codes = await detector.detect(video);
        if (codes && codes.length) {
          const raw = (codes[0].rawValue || '').trim();
          stopQRScan();
          if (/^https?:\/\//i.test(raw)) {
            const url = new URL(raw, location.origin);
            const t = url.searchParams.get('token') || (raw.match(TOKEN_RE) || [])[0];
            if (t) location.href = `redeem.html?token=${encodeURIComponent(t)}`;
            else   location.href = raw;
            return;
          }
          const token = (raw.match(TOKEN_RE) || [])[0];
          if (token) { location.href = `redeem.html?token=${encodeURIComponent(token)}`; return; }
          startQRScan(); return;
        }
      } catch(e){}
      scanTimer = requestAnimationFrame(tick);
    };
    tick();
  } catch (err) {
    hint.innerHTML = "🚫 Caméra inaccessible. Autorise l’accès, ou scanne avec l’appareil photo.";
    console.error(err);
  }
}
function stopQRScan(){
  const scanBox = document.getElementById('scanBox');
  scanBox.style.display = 'none';
  if (scanTimer) cancelAnimationFrame(scanTimer), scanTimer = null;
  if (scanStream){ scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
}

function pageIndex(){
  ensureMeta();
  const tbody = document.getElementById('board');
  fbLiveLeaderboard((rows) => {
    tbody.innerHTML = rows.length
      ? rows.map(r => `<tr><td>${r.nickname}</td><td>—</td><td>${r.score}</td><td>live</td></tr>`).join("")
      : `<tr><td colspan="4" class="muted">Aucun joueur pour l’instant.</td></tr>`;
  });
  document.getElementById('btnStart').onclick=()=>{ const p=getSession(); location.href = p? "jeu.html" : "intro.html"; };
  document.getElementById('btnIntro').onclick=()=> location.href="intro.html";
  startTimer(document.getElementById('timer'));
  document.getElementById('adminResetTimer').onclick=()=>{
    const pwd = prompt("Mot de passe admin :");
    if (pwd === "Stephane") {
      const n = resetDeadlineToNextFriday();
      alert("Timer réinitialisé jusqu’au : " + n.toLocaleString('fr-FR'));
    } else if (pwd!==null) {
      alert("Mot de passe incorrect.");
    }
  };
}
function pageIntro(){
  ensureMeta();
  document.getElementById('btnSave').onclick=()=>{
    const p = (document.getElementById('pseudo').value||"").trim();
    if (!p) { alert("Entre un pseudo/prénom"); return; }
    setSession(p);
    location.href="jeu.html";
  };
  document.getElementById('btnBack').onclick=()=> history.back();
}
function pagePlay(){
  ensureMeta();
  const player = getSession();
  if (!player) { location.href="intro.html"; return; }
  const el = document.getElementById('player'); if (el) el.textContent = player;
  startTimer(document.getElementById('timer'));
  subscribeMyProgress(player);
  const b1 = document.getElementById('btnScan'); if (b1) b1.onclick = startQRScan;
  const b2 = document.getElementById('btnStopScan'); if (b2) b2.onclick = stopQRScan;
}
document.addEventListener('DOMContentLoaded', ()=>{
  const page = document.body.getAttribute('data-page')||'';
  if (page==="index") pageIndex();
  else if (page==="intro") pageIntro();
  else if (page==="play") pagePlay();
});
