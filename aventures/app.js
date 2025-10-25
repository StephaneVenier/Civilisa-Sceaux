// =========================
// app.js — Aventures (QR) + permission caméra
// =========================

const $  = (s)=>document.querySelector(s);

async function waitForFb(max=80){
  while (max-- > 0){
    if (window.fb && window.fb.db) return true;
    await new Promise(r=>setTimeout(r, 100));
  }
  console.warn("Firebase not ready — continuing UI only.");
  return false;
}

// Session pseudo
function getSession(){ return (localStorage.getItem('civ_session')||'').trim().toLowerCase(); }
function setSession(v){ localStorage.setItem('civ_session',(v||'').trim().toLowerCase()); }

// Timer -> prochain vendredi 16:00
function nextFriday1600(from){
  const d=new Date(from||Date.now()), t=new Date(d);
  const diff=(5 - d.getDay() + 7) % 7;
  t.setDate(d.getDate()+diff); t.setHours(16,0,0,0);
  if (t<=d) t.setDate(t.getDate()+7); return t;
}
function getDeadline(){
  const raw=localStorage.getItem('aventures_deadline'), now=Date.now();
  if (raw){ const t=+raw; if(!isNaN(t)&&t>now) return new Date(t); }
  const n=nextFriday1600(); localStorage.setItem('aventures_deadline', String(n.getTime())); return n;
}
function resetDeadline(){ const n=nextFriday1600(); localStorage.setItem('aventures_deadline', String(n.getTime())); return n; }
function fmt(ms){ if(ms<=0) return "⏳ Terminé"; const s=Math.floor(ms/1000), d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60), ss=s%60; return `${d}j ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
function startTimer(el){ const loop=()=>{ const dl=getDeadline().getTime(), left=dl-Date.now(); el.textContent= left>0 ? `Fin : ${new Date(dl).toLocaleString('fr-FR')} — ${fmt(left)}` : "⏳ Terminé"; setTimeout(loop,1000); }; loop(); }

// Classement live
async function fbLiveLeaderboard(fill){
  const col = window.fb.collection(window.fb.db,'finds');
  window.fb.onSnapshot(col,(snap)=>{
    const map=new Map();
    snap.forEach(d=>{ const x=d.data(); if(!x?.nickname) return; map.set(x.nickname,(map.get(x.nickname)||0)+1); });
    const rows=[...map.entries()].map(([nickname,score])=>({nickname,score}));
    rows.sort((a,b)=> b.score-a.score || a.nickname.localeCompare(b.nickname));
    fill(rows);
  });
}

// Progress perso
const TOTAL=10;
function setProgress(n){ const pct=Math.min(100,Math.round(n/TOTAL*100)); const bar=$("#progressBar"), txt=$("#progressTxt"); if(bar) bar.style.width=pct+"%"; if(txt) txt.textContent=`${n}/${TOTAL} codes`; }
function renderFound(list){ const box=$("#checklist"); if(!box) return; box.innerHTML = list.length ? list.map(t=>`<div style="text-decoration:line-through;opacity:.7">${t}</div>`).join("") : `<div class="smallmuted">Aucun code validé pour l’instant.</div>`; }
function subscribeMine(nickname){
  const col=window.fb.collection(window.fb.db,'finds');
  const q=window.fb.query(col, window.fb.where('nickname','==',nickname));
  window.fb.onSnapshot(q,(snap)=>{ const toks=[]; snap.forEach(d=>{ const x=d.data(); if(x?.token) toks.push(x.token); }); setProgress(toks.length); renderFound(toks); });
}

// ======== Scanner via html5-qrcode + autorisation/picker ========
const TOKEN_RE=/[A-Z0-9]{2,5}-[A-Z0-9]{6,8}-[A-Z0-9]{2}/;
let h5q=null;
let preferredDeviceId = null;

function handleScanResult(raw){
  try{
    raw=(raw||"").trim(); if(!raw) return;
    if(/^https?:\/\//i.test(raw)){ const url=new URL(raw, location.origin);
      const t=url.searchParams.get('token') || (raw.match(TOKEN_RE)||[])[0];
      location.href= t ? `redeem.html?token=${encodeURIComponent(t)}` : raw; return; }
    const token=(raw.match(TOKEN_RE)||[])[0];
    if(token){ location.href=`redeem.html?token=${encodeURIComponent(token)}`; return; }
    alert("QR non reconnu.");
  }catch(e){ console.error(e); }
}

async function requestCameraPermission(){
  const msg=$("#permMsg");
  try{
    const stream = await navigator.mediaDevices.getUserMedia({video:true});
    // stop immediately (we only wanted the permission prompt)
    stream.getTracks().forEach(t=>t.stop());
    msg.textContent = "✅ Caméra autorisée. Tu peux lancer le scan.";
    msg.className = "smallmuted";
    await populateCameraList();
  }catch(e){
    console.error(e);
    msg.textContent = "🚫 Caméra inaccessible. Vérifie : HTTPS, autorisation navigateur, ou paramètres iOS (Réglages > Safari > Caméra).";
    msg.className = "smallmuted";
  }
}

async function populateCameraList(){
  const sel = $("#cameraSelect");
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter(d=>d.kind==="videoinput");
  sel.innerHTML = "";
  if (!cams.length){
    const opt = document.createElement('option'); opt.value=""; opt.textContent="Aucune caméra détectée";
    sel.appendChild(opt); sel.disabled = true; return;
  }
  cams.forEach((c,i)=>{
    const opt=document.createElement('option');
    opt.value=c.deviceId;
    opt.textContent=c.label || `Caméra ${i+1}`;
    sel.appendChild(opt);
  });
  sel.disabled = false;
  if (preferredDeviceId){
    const found = [...sel.options].find(o=>o.value===preferredDeviceId);
    if (found) sel.value = preferredDeviceId;
  }
}

async function startScan(){
  const box=$("#scanBox"); const hint=$("#scanHint"); box.style.display='block';
  try{
    if(h5q){ try{await h5q.stop();}catch{} try{await h5q.clear();}catch{} }
    h5q=new Html5Qrcode("qrRegion", false);
    const config={ fps:12, qrbox:{width:280, height:280}, aspectRatio:1.777 };

    // deviceId preferred ? else facingMode
    const camSel = $("#cameraSelect");
    const chosen = camSel && camSel.value ? camSel.value : preferredDeviceId;
    const cameraParam = chosen ? { deviceId: { exact: chosen } } : { facingMode: "environment" };

    await h5q.start(
      cameraParam,
      config,
      (decodedText)=>{ stopScan(); handleScanResult(decodedText); },
      (err)=>{/* ignore */}
    );
  }catch(e){
    console.error(e);
    hint.textContent="🚫 Impossible d’accéder à la caméra. Clique d’abord sur “Autoriser la caméra”, puis réessaie.";
  }
}

async function stopScan(){
  const box=$("#scanBox"); box.style.display='none';
  if(h5q){ try{await h5q.stop();}catch{} try{await h5q.clear();}catch{} h5q=null; }
}

// -------- Pages --------
async function pageIndex(){
  await waitForFb();
  const tbody=$("#board");
  if(window.fb && window.fb.db){
    fbLiveLeaderboard(rows=>{
      tbody.innerHTML = rows.length
        ? rows.map(r=>`<tr><td>${r.nickname}</td><td>—</td><td>${r.score}</td><td>live</td></tr>`).join("")
        : `<tr><td colspan="4" class="smallmuted">Aucun joueur pour l’instant.</td></tr>`;
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="4" class="smallmuted">Classement indisponible (Firebase).</td></tr>`;
  }
  $("#btnStart").onclick=()=>{ const p=getSession(); location.href=p?"jeu.html":"intro.html"; };
  $("#btnIntro").onclick=()=> location.href="intro.html";
  startTimer($("#timer"));
  $("#adminResetTimer").onclick=()=>{
    const pwd=prompt("Mot de passe admin :");
    if(pwd==="Stephane"){ const n=resetDeadline(); alert("Timer réinitialisé jusqu’au : "+n.toLocaleString('fr-FR')); }
    else if(pwd!==null){ alert("Mot de passe incorrect."); }
  };
}

async function pageIntro(){
  await waitForFb();
  const input=$("#pseudo");
  input.addEventListener('keydown',e=>{ if(e.key==="Enter") $("#btnSave").click(); });
  $("#btnSave").onclick=()=>{
    const v=input.value.trim(); if(!v){ alert("Entre un pseudo / prénom"); return; }
    setSession(v); location.href="jeu.html";
  };
  $("#btnBack").onclick=()=> history.back();
}

async function pagePlay(){
  await waitForFb();
  const p=getSession(); if(!p){ location.href="intro.html"; return; }
  const el=$("#player"); if(el) el.textContent=p;
  startTimer($("#timer")); if(window.fb && window.fb.db) subscribeMine(p);

  // Buttons
  $("#btnScan").onclick=startScan;
  $("#btnStopScan").onclick=stopScan;
  $("#btnPerm").onclick=requestCameraPermission;
  $("#cameraSelect").addEventListener('change',(e)=>{ preferredDeviceId = e.target.value || null; });

  // Populate picker (if user already granted permission, labels will be visible)
  populateCameraList().catch(()=>{});
}

document.addEventListener('DOMContentLoaded', ()=>{
  const page=document.body.getAttribute('data-page')||'';
  if(page==="index") pageIndex();
  else if(page==="intro") pageIntro();
  else if(page==="play") pagePlay();
});
