// =========================
// app.js — Aventures (QR)
// =========================

// Helpers DOM
const $  = (s)=>document.querySelector(s);

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
    snap.forEach(d=>{
      const x = d.data();
      if (!x?.nickname) return;
      map.set(x.nickname, (map.get(x.nickname)||0) + 1);
    });
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

// -------- Scanner QR hybride (BarcodeDetector -> ZXing fallback) --------
const TOKEN_RE = /[A-Z0-9]{2,5}-[A-Z0-9]{6,8}-[A-Z0-9]{2}/;
let scanStream=null, scanTimer=null, zxingReader=null, zxingStop=null;

async function startScan(){
  const scanBox = document.getElementById('scanBox');
  const video   = document.getElementById('scanVideo');
  const hint    = document.getElementById('scanHint');
  scanBox.style.display='block';

  const hasBD = ('BarcodeDetector' in window);
  try{
    scanStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } });
    video.srcObject = scanStream;

    if (hasBD){
      const detector = new window.BarcodeDetector({ formats:['qr_code'] });
      const tick = async ()=>{
        if (!video.readyState || video.readyState < 2){ scanTimer = requestAnimationFrame(tick); return; }
        try{
          const codes = await detector.detect(video);
          if (codes && codes.length){
            const raw = (codes[0].rawValue || '').trim();
            stopScan();
            handleScanResult(raw);
            return;
          }
        }catch(e){/* continue */}
        scanTimer = requestAnimationFrame(tick);
      };
      tick();
      return;
    } else {
      hint.textContent = "Mode compatibilité activé…";
      await startZXing(video, hint);
      return;
    }
  }catch(err){
    console.error(err);
    hint.textContent = "🚫 Caméra inaccessible. Autorise l’accès, ou scanne avec l’appareil photo (le QR ouvrira la page).";
  }
}

function stopScan(){
  const scanBox = document.getElementById('scanBox');
  scanBox.style.display='none';

  if (scanTimer) cancelAnimationFrame(scanTimer), scanTimer=null;
  if (scanStream){ scanStream.getTracks().forEach(t=>t.stop()); scanStream=null; }

  if (zxingStop) { try{ zxingStop(); }catch{} zxingStop=null; }
  zxingReader = null;
}

function handleScanResult(raw){
  if (/^https?:\/\//i.test(raw)){
    const url = new URL(raw, location.origin);
    const t = url.searchParams.get('token') || (raw.match(TOKEN_RE)||[])[0];
    if (t) location.href = `redeem.html?token=${encodeURIComponent(t)}`;
    else   location.href = raw;
  } else {
    const token = (raw.match(TOKEN_RE)||[])[0];
    if (token) location.href = `redeem.html?token=${encodeURIComponent(token)}`;
    else alert("QR non reconnu.");
  }
}

async function startZXing(videoEl, hintEl){
  if (!window.ZXingBrowser){
    hintEl.textContent = "Compatibilité indisponible. Recharge la page.";
    return;
  }
  const { BrowserMultiFormatReader } = window.ZXingBrowser;
  zxingReader = new BrowserMultiFormatReader();

  const devices = await window.ZXingBrowser.BrowserCodeReader.listVideoInputDevices();
  const deviceId = (devices && devices[0] && devices[0].deviceId) || undefined;

  zxingStop = await zxingReader.decodeFromVideoDevice(
    deviceId,
    videoEl,
    (result, err) => {
      if (result && result.getText){
        const raw = result.getText().trim();
        stopScan();
        handleScanResult(raw);
      }
      // err=NotFound -> on continue à scanner
    }
  );
}

// -------- Pages --------
function pageIndex(){
  const tbody = document.getElementById('board');
  fbLiveLeaderboard(rows=>{
    tbody.innerHTML = rows.length
      ? rows.map(r=>`<tr><td>${r.nickname}</td><td>—</td><td>${r.score}</td><td>live</td></tr>`).join("")
      : `<tr><td colspan="4" class="muted">Aucun joueur pour l’instant.</td></tr>`;
  });

  document.getElementById('btnStart').onclick = ()=>{ const p=getSession(); location.href = p ? "jeu.html" : "intro.html"; };
  document.getElementById('btnIntro').onclick = ()=> location.href="intro.html";

  startTimer(document.getElementById('timer'));

  // Admin reset timer
  document.getElementById('adminResetTimer').onclick = ()=>{
    const pwd = prompt("Mot de passe admin :");
    if (pwd === "Stephane"){
      const n = resetDeadline();
      alert("Timer réinitialisé jusqu’au : " + n.toLocaleString('fr-FR'));
    } else if (pwd !== null){
      alert("Mot de passe incorrect.");
    }
  };
}

function pageIntro(){
  const input = document.getElementById('pseudo');
  input.addEventListener('keydown', (e)=>{ if (e.key === "Enter") document.getElementById('btnSave').click(); });
  document.getElementById('btnSave').onclick = ()=>{
    const v = input.value.trim();
    if (!v){ alert("Entre un pseudo / prénom"); return; }
    setSession(v);
    location.href = "jeu.html";
  };
  document.getElementById('btnBack').onclick = ()=> history.back();
}

function pagePlay(){
  const p = getSession();
  if (!p){ location.href="intro.html"; return; }

  const el = document.getElementById('player'); if (el) el.textContent = p;

  startTimer(document.getElementById('timer'));
  subscribeMine(p);

  document.getElementById('btnScan').onclick = startScan;
  document.getElementById('btnStopScan').onclick = stopScan;
}

// Router
document.addEventListener('DOMContentLoaded', ()=>{
  const page = document.body.getAttribute('data-page') || '';
  if (page === "index") pageIndex();
  else if (page === "intro") pageIntro();
  else if (page === "play") pagePlay();
});
