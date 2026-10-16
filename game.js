"use strict";

/* MISI BAKUL NOMBOR — vanilla JavaScript, no login or server.
   Webcam processing is performed by MediaPipe locally in the browser.
   The library and model are downloaded on demand after camera activation. */

const $ = (id) => document.getElementById(id);
const board = $("gameBoard");
const boardWrap = $("boardWrap");
const handOverlay = $("handOverlay");
const handCtx = handOverlay ? handOverlay.getContext("2d") : null;
const starTrailLayer = $("starTrailLayer");
const confettiLayer = $("confettiLayer");
const handCursorSymbol = $("handCursorSymbol");

const MODE_LABELS = {
  touch: { title: "Sentuhan / mouse", hint: "Tekan, pilih atau seret" },
  point: { title: "Point & Select", hint: "Halakan jari dan tunggu bulatan penuh" },
  pinch: { title: "Pinch & Drag", hint: "Cubit untuk pilih atau seret buah" }
};
const LEVELS = {
  1: { title: "Misi 1 · Jom Kira!", sub: "Kira buah dan pilih nombor yang betul." },
  2: { title: "Misi 2 · Isi Bakul!", sub: "Kumpulkan buah mengikut nombor yang dipaparkan." },
  3: { title: "Misi 3 · Padankan!", sub: "Sambungkan nombor dengan kumpulan buah menggunakan garisan." }
};
const ICONS = ["🍎", "🍊", "🍐", "🍓", "🍋"];
const MATCH_COLORS = ["#f05b71", "#2b9de5", "#9554db", "#e29521", "#17896e"];
const state = {
  level: 1, round: 0, max: 5, mode: "touch", sound: true,
  answered: false, errors: 0, hintUsed: false,
  selectedFruit: null, collected: [], records: [], startTime: Date.now(),
  hand: { active: false, landmarker: null, stream: null, raf: null,
    lastVideoTime: -1, lastDetectAt: 0, cursorX: null, cursorY: null,
    pinched: false, dragId: null, hoverKey: "", hoverSince: 0,
    cooldownUntil: 0, busy: false, lastLandmarks: null, drawRaf: null, lastTrailAt: 0 },
  pointerDrag: null, score: 0, lives: 3, maxLives: 3, autoTimer: null, sequence: [3,1,5,2,4], matching: null, matchErrorTimer: null, matchPointer: null
};

function shuffleList(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function buildSequence() {
  return shuffleList(Array.from({ length: state.max }, (_, i) => i + 1));
}
function ensureSequence(force = false) {
  if (force || !Array.isArray(state.sequence) || state.sequence.length !== state.max) {
    state.sequence = buildSequence();
  }
}
function targetSequence() {
  ensureSequence();
  return state.sequence;
}
function currentTarget() {
  const sequence = targetSequence();
  return sequence[Math.min(state.round, sequence.length - 1)] ?? 1;
}
function numberOptions(target) {
  const nums = Array.from({ length: state.max }, (_, i) => i + 1);
  const wrong = nums.filter(n => n !== target);
  if (state.max <= 3) return nums;
  const start = (target + state.round) % wrong.length;
  const selected = [target, wrong[start], wrong[(start + 1) % wrong.length]];
  return selected.sort((a, b) => a - b);
}
function fruit() { return ICONS[(state.round + state.level - 1) % ICONS.length]; }
function clearAutoFlow(){
  if(state.autoTimer){ clearTimeout(state.autoTimer); state.autoTimer=null; }
}
function scheduleAutoFlow(fn, delay=1200){
  clearAutoFlow();
  state.autoTimer=setTimeout(()=>{ state.autoTimer=null; fn(); }, delay);
}
const STAR_COLORS=["#ffd84d","#ff8bc2","#63d8ff","#8cf07a","#ffad5b","#c99dff"];
function syncOverlaySize(){}
function clearHandOverlay(){}
function drawHandOverlay(){}
function emitTrailStar(x,y){
  if(!starTrailLayer || state.mode==="touch" || !state.hand.active) return;
  const layerRect=starTrailLayer.getBoundingClientRect();
  const star=document.createElement("span");
  star.className="trail-star";
  star.textContent=Math.random()>.5?"★":"✦";
  star.style.left=(x-layerRect.left)+"px";
  star.style.top=(y-layerRect.top)+"px";
  star.style.color=STAR_COLORS[Math.floor(Math.random()*STAR_COLORS.length)];
  star.style.setProperty("--dx",`${(Math.random()*24)-12}px`);
  star.style.setProperty("--dy",`${-18-(Math.random()*16)}px`);
  starTrailLayer.appendChild(star);
  setTimeout(()=>star.remove(),820);
}
function maybeEmitTrail(now){
  const h=state.hand;
  if(!h.active || h.cursorX===null || h.cursorY===null) return;
  if(now-(h.lastTrailAt||0)<34) return;
  h.lastTrailAt=now;
  emitTrailStar(h.cursorX,h.cursorY);
  if (Math.random() > 0.35) emitTrailStar(h.cursorX + (Math.random()*28-14), h.cursorY + (Math.random()*24-12));
}
function burstConfetti(count = 44) {
  if (!confettiLayer) return;
  confettiLayer.innerHTML = "";
  const colors = ["#ffd84d", "#ff7ab6", "#55d0ff", "#7be36b", "#ffb25b", "#b992ff"];
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random()*100}%`;
    piece.style.background = colors[Math.floor(Math.random()*colors.length)];
    piece.style.setProperty("--dur", `${1400 + Math.random()*1200}ms`);
    piece.style.transform = `translateY(-20px) rotate(${Math.random()*100}deg)`;
    confettiLayer.appendChild(piece);
    setTimeout(() => piece.remove(), 2600);
  }
}
function cluster(n, cls = "big-fruit") { return Array(n).fill(`<span class="${cls}" aria-label="sebiji buah"><span class="fruit-emoji" aria-hidden="true">${fruit()}</span></span>`).join(""); }
function setInstruction(text) { $("instruction").textContent = text; }
function setFeedback(text, type = "neutral") {
  $("feedbackText").textContent = text;
  $("feedback").className = `feedback ${type}`;
  $("feedback").querySelector(".feedback-icon").textContent = type === "success" ? "🎉" : type === "error" ? "💛" : type === "reward" ? "🏅" : "🌟";
}
function speak(text) {
  if (!state.sound || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ms-MY"; u.rate = .86; u.pitch = 1.03; u.volume = .92;
    window.speechSynthesis.speak(u);
  } catch (err) { console.warn("Speech not available", err); }
}

function updateHud() {
  const full='❤️';
  const empty='🤍';
  if($("livesText")) $("livesText").textContent = full.repeat(Math.max(0,state.lives)) + empty.repeat(Math.max(0,state.maxLives-state.lives));
  if($("scoreText")) $("scoreText").textContent = String(state.score);
  const mode=MODE_LABELS[state.mode] || MODE_LABELS.touch;
  if($("modeText")) $("modeText").textContent = mode.title;
  if($("modeHint")) $("modeHint").textContent = mode.hint;
}
function updateStats() {
  $("correctStat").textContent = state.records.filter(r => r.firstTry === "Ya").length;
  $("completedStat").textContent = state.records.length;
  $("hintsStat").textContent = state.records.filter(r => r.hint === "Ya").length;
}
function roundCount() {
  // Misi 3 is presented in manageable sets of at most five matching pairs.
  return state.level===3 ? Math.ceil(state.max / 5) : targetSequence().length;
}
function matchingBatchValues() {
  return targetSequence().slice(state.round * 5, state.round * 5 + 5);
}
function updateProgress() {
  const total = roundCount();
  const current = Math.min(state.round + 1, total);
  const pct = Math.round((state.round / total) * 100);
  $("roundText").textContent = `${state.level===3 ? "Set padanan" : "Soalan"} ${current} / ${total}`;
  $("progressTrack").innerHTML = Array.from({ length: total }, (_, i) => `<span class="progress-pip ${i < state.round ? "done" : i === state.round ? "current" : ""}"></span>`).join("");
  if($("progressTitle")) $("progressTitle").textContent = `Kemajuan ${LEVELS[state.level].title}`;
  if($("progressMeta")) $("progressMeta").textContent = `${pct}%`;
  if($("progressFill")) $("progressFill").style.width = `${pct}%`;
}
function updateTabs() {
  document.querySelectorAll(".level-tab").forEach(b => {
    const active = Number(b.dataset.level) === state.level;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  $("stageTitle").textContent = LEVELS[state.level].title;
  $("stageSubtitle").textContent = LEVELS[state.level].sub;
}
function updateGame() {
  state.hand.hoverKey = "";
  state.hand.hoverSince = 0;
  syncOverlaySize();
  state.hand.dragId = null;
  $("carriedFruit").textContent = "";
  const total = roundCount();
  updateTabs(); updateProgress(); updateStats(); updateHud();
  $("hintPanel").hidden = !state.hintUsed;
  $("retryBtn").disabled = state.answered || state.round >= total;
  $("nextBtn").hidden = !state.answered;
  $("nextBtn").textContent = state.round === total - 1 ? "Lihat pencapaian →" : "Soalan seterusnya →";
  $("gameStage").classList.toggle("misi2-next-ready",state.level===2 && state.answered);
  if (state.round >= total) return renderFinished();
  if (state.level === 1) renderLevel1();
  else if (state.level === 2) renderLevel2();
  else renderLevel3();
  if (state.hintUsed) showHint();
}
function renderLevel1() {
  const n = currentTarget();
  setInstruction("Berapa biji buah yang kamu lihat?");
  board.innerHTML = `<div class="board-content">
    <span class="board-label">🍃 Kira satu demi satu</span>
    <div class="fruit-cluster" role="img" aria-label="${n} biji buah">${cluster(n)}</div>
    <div class="number-choices" aria-label="Pilihan nombor">
      ${numberOptions(n).map(v => `<button type="button" data-gesture="number" data-value="${v}" class="choice-btn" ${state.answered ? "disabled" : ""} aria-label="Nombor ${v}">${v}</button>`).join("")}
    </div>
  </div>`;
}
function renderLevel2() {
  const n = currentTarget();
  setInstruction(`Masukkan ${n} biji buah ke dalam bakul.`);
  const fruitCount = Math.min(Math.max(state.max + 2, n + 1), 12);
  const collected = state.collected;
  const collectedSet = new Set(collected);
  board.innerHTML = `<div class="board-content orchard-scene orchard-basket-v116">
    <span class="board-label">🤲 Seret atau pilih buah dari pokok ke bakul</span>
    <div class="target-number" aria-label="Nombor ${n}">${n}</div>
    <div class="orchard-tree" aria-label="Pokok buah">
      <img class="tree-image" src="tree-cartoon.svg" alt="Pokok buah kartun" draggable="false">
      <div class="fruit-tree-zone" aria-label="Buah pada pokok">${Array.from({ length: fruitCount }, (_, i) => `<div data-slot="${i}" data-gesture="fruit" data-fruit="${i}" class="fruit-token ${collectedSet.has(i) ? "used" : ""} ${state.selectedFruit === i ? "selected" : ""}" role="button" tabindex="${collectedSet.has(i) || state.answered ? "-1" : "0"}" aria-label="Pilih buah nombor ${i+1}" aria-disabled="${collectedSet.has(i) || state.answered}"><span class="fruit-emoji" aria-hidden="true">${fruit()}</span></div>`).join("")}</div>
    </div>
    <div class="orchard-basket-area">
      <div class="basket-zone basket-open basket-v116" data-gesture="basket" role="button" tabindex="0" aria-label="Masukkan buah yang dipilih ke dalam bakul. Kini ${collected.length} daripada ${n} buah.">
        <span class="basket-count" aria-live="polite">${collected.length} / ${n}</span>
        <div class="basket-visual" aria-hidden="true">
          <span class="basket-handle basket-handle-left"></span>
          <span class="basket-handle basket-handle-right"></span>
          <span class="basket-back"></span>
          <span class="basket-opening"></span>
          <span class="basket-rim"></span>
          <span class="basket-fruit-layer">${collected.map(() => `<span class="basket-fruit">${fruit()}</span>`).join("")}</span>
          <span class="basket-front"></span>
        </div>
        <span class="basket-tap-label">🧺 Letakkan buah di sini</span>
      </div>
      <div class="board-footer">
        <button type="button" class="secondary-button" data-gesture="undo" ${collected.length===0 || state.answered ? "disabled" : ""}>↶ Keluarkan satu buah</button>
      </div>
    </div>
    <span class="tree-helper">Petik buah dari pokok dan bawa ke bakul.</span>
  </div>`;
}

function renderLevel3() {
  setInstruction("Padankan nombor dengan kumpulan buah yang sama bilangannya.");
  if (!state.matching || state.matching.round !== state.round) {
    const values=matchingBatchValues();
    state.matching={round:state.round,values,numbers:shuffleList(values),groups:shuffleList(values),selected:null,matched:[],traces:{},dragging:null,wrong:null};
  }
  const m=state.matching;
  board.innerHTML = `<div class="board-content matching-scene">
    <span class="board-label">✏️ Tarik garisan dari nombor ke kumpulan buah seperti padanan di kertas!</span>
    <div class="matching-progress" id="matchingProgress" role="status">${m.matched.length} / ${m.values.length} padanan siap</div>
    <div class="matching-board" id="matchingBoard" aria-label="Seret dari nombor ke kumpulan buah untuk memadankan">
      <svg class="matching-lines" id="matchingLines" aria-hidden="true" preserveAspectRatio="none"></svg>
      <div class="matching-column" aria-label="Nombor">
        <strong class="matching-heading">NOMBOR</strong>
        ${m.numbers.map(n=>`<button type="button" class="match-number" data-gesture="match-number" data-value="${n}" aria-label="Seret garisan bermula daripada nombor ${n}" aria-pressed="false" ${m.matched.includes(n)||state.answered ? "disabled" : ""}>${n}</button>`).join("")}
      </div>
      <div class="matching-column" aria-label="Kumpulan buah">
        <strong class="matching-heading">BUAH</strong>
        ${m.groups.map((n,i)=>`<button type="button" class="match-group" data-gesture="match-group" data-value="${n}" aria-label="Kumpulan ${n} biji buah" ${m.matched.includes(n)||state.answered ? "disabled" : ""}><span class="match-fruits" aria-hidden="true">${Array.from({length:n},()=>`<span class="match-fruit">${fruit()}</span>`).join("")}</span><small>Pilihan ${i+1}</small></button>`).join("")}
      </div>
    </div>
    <p class="matching-help">🌈 Tarik jari / mouse seperti pen • Garisan betul kekal dengan warna berbeza!</p>
  </div>`;
  updateMatchingVisuals();
  requestAnimationFrame(drawMatchingLines);
}
function updateMatchingVisuals(){
  const m=state.matching;
  if(!m || state.level!==3) return;
  board.querySelectorAll("[data-gesture='match-number']").forEach(button=>{
    const value=Number(button.dataset.value);
    button.classList.toggle("is-picked",value===m.selected || m.dragging?.n===value);
    button.classList.toggle("is-matched",m.matched.includes(value));
    button.disabled=m.matched.includes(value)||state.answered;
    button.setAttribute("aria-pressed",String(value===m.selected));
  });
  board.querySelectorAll("[data-gesture='match-group']").forEach(button=>{
    const value=Number(button.dataset.value);
    button.classList.toggle("is-matched",m.matched.includes(value));
    button.disabled=m.matched.includes(value)||state.answered;
  });
  const counter=$("matchingProgress");
  if(counter) counter.textContent=`${m.matched.length} / ${m.values.length} padanan siap`;
  requestAnimationFrame(drawMatchingLines);
}
function matchBoardPoint(clientX,clientY){
  const rect=$("matchingBoard")?.getBoundingClientRect();
  if(!rect || !rect.width || !rect.height) return null;
  return [Math.max(0,Math.min(1,(clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,(clientY-rect.top)/rect.height))];
}
function matchingAnchor(n,side){
  const grid=$("matchingBoard"), node=grid?.querySelector(`[data-gesture="${side==='left'?'match-number':'match-group'}"][data-value="${n}"]`);
  if(!grid||!node)return null;
  const r=node.getBoundingClientRect();
  return matchBoardPoint(side==='left'?r.right-4:r.left+4,r.top+r.height/2);
}
function matchingPath(points, rect, from=null, to=null){
  if(!points || points.length<2)return "";
  // Anchors stay aligned with their numbers/fruit groups after screen rotation or resize.
  const first=points[0],last=points[points.length-1];
  const a=from||first,b=to||last;
  return points.map((pt,i)=>{
    const t=points.length===1?0:i/(points.length-1);
    const x=pt[0]+(a[0]-first[0])*(1-t)+(b[0]-last[0])*t;
    const y=pt[1]+(a[1]-first[1])*(1-t)+(b[1]-last[1])*t;
    return `${i?'L':'M'} ${(x*rect.width).toFixed(1)} ${(y*rect.height).toFixed(1)}`;
  }).join(" ");
}
function drawMatchingLines(){
  const m=state.matching,container=$("matchingBoard"),svg=$("matchingLines");
  if(state.level!==3||!m||!container||!svg)return;
  const rect=container.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0)return;
  svg.setAttribute("viewBox",`0 0 ${rect.width} ${rect.height}`);
  const makePath=(n,g,points,color,cls)=>{
    const a=matchingAnchor(n,'left'),b=g===null?null:matchingAnchor(g,'right');
    if(!a||!points?.length)return '';
    const all=points.length<2?[a,points[0]]:points;
    const d=matchingPath(all,rect,a,b||null);
    return `<path class="${cls}" d="${d}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
  };
  svg.innerHTML=m.matched.map(n=>makePath(n,n,m.traces[n],MATCH_COLORS[m.numbers.indexOf(n)%MATCH_COLORS.length],"correct-match-line")).join("")
    +(m.wrong?makePath(m.wrong.n,m.wrong.g,m.wrong.points,"#ee4758","wrong-match-line"):"")
    +(m.dragging?makePath(m.dragging.n,null,m.dragging.points,MATCH_COLORS[m.numbers.indexOf(m.dragging.n)%MATCH_COLORS.length],"live-match-line"):"");
}
function startMatchingDrag(value,x,y){
  if(state.level!==3||state.answered||!state.matching)return false;
  const m=state.matching;
  if(m.matched.includes(value)||m.wrong)return false;
  const a=matchingAnchor(value,'left');
  if(!a)return false;
  const p=matchBoardPoint(x,y) || a;
  m.selected=null;
  m.dragging={n:value,points:[a,p]};
  setFeedback(`Tarik garisan dari nombor ${value} ke kumpulan buah yang sama.`);
  updateMatchingVisuals();
  return true;
}
function moveMatchingDrag(x,y){
  const m=state.matching;
  if(!m?.dragging||state.level!==3)return;
  const pt=matchBoardPoint(x,y);
  if(!pt)return;
  const pts=m.dragging.points;
  const last=pts[pts.length-1];
  if(!last || Math.hypot(last[0]-pt[0],last[1]-pt[1])>0.007){
    pts.push(pt);
    // Bound memory on long movements while retaining a hand-drawn look.
    if(pts.length>180)pts.splice(1,1);
    drawMatchingLines();
  }
}
function completeMatchingPair(n,value,points){
  const m=state.matching;
  if(!m||state.answered)return;
  const b=matchingAnchor(value,'right');
  const route=points?.slice()||[];
  if(b)route.push(b);
  if(n===value){
    m.matched.push(n);
    m.traces[n]=route;
    m.selected=null;
    setFeedback(`Hebat! Nombor ${value} berjaya dipadankan!`,"success");
    speak("Bagus! Padanan betul.");
    updateMatchingVisuals();
    if(m.matched.length===m.values.length)completeAnswer();
  }else{
    state.errors++;
    m.wrong={n,g:value,points:route};
    m.selected=null;
    setFeedback("Belum tepat. Cuba tarik garisan semula!","error");
    speak("Cuba lagi.");
    updateMatchingVisuals();
    if(state.matchErrorTimer)clearTimeout(state.matchErrorTimer);
    state.matchErrorTimer=setTimeout(()=>{
      if(state.matching===m){m.wrong=null;updateMatchingVisuals();}
      state.matchErrorTimer=null;
    },850);
  }
}
function finishMatchingDrag(x,y,target=null){
  const m=state.matching;
  if(!m?.dragging)return;
  const drag=m.dragging;
  moveMatchingDrag(x,y);
  m.dragging=null;
  const group=(target || document.elementFromPoint(x,y))?.closest?.('[data-gesture="match-group"]');
  if(!group||!$("matchingBoard")?.contains(group)||group.disabled||m.matched.includes(Number(group.dataset.value))){
    setFeedback("Garisan belum sampai ke buah. Cuba tarik sampai ke kumpulan buah.");
    updateMatchingVisuals();
    return;
  }
  completeMatchingPair(drag.n,Number(group.dataset.value),drag.points);
}
// Alternative only for keyboard and Point & Select webcam mode: drag is the primary interaction.
function handleMatchChoice(node){
  if(state.level!==3||state.answered||!state.matching)return;
  const m=state.matching,value=Number(node.dataset.value);
  if(m.matched.includes(value)||m.wrong)return;
  if(node.dataset.gesture==='match-number'){
    m.selected=value;
    setFeedback(`Nombor ${value} dipilih. Halakan ke kumpulan buah yang sepadan.`);
    updateMatchingVisuals();
    return;
  }
  if(m.selected===null){
    setFeedback("Mulakan garisan pada nombor di sebelah kiri.");
    return;
  }
  const n=m.selected;
  const a=matchingAnchor(n,'left'),b=matchingAnchor(value,'right');
  if(a&&b)completeMatchingPair(n,value,[a,b]);
}
function renderFinished() {
  const byLevel = state.records.filter(r => r.level === state.level);
  const first = byLevel.filter(r => r.firstTry === "Ya").length;
  setInstruction(`Tahniah! Kamu sudah mencuba ${LEVELS[state.level].title.toLowerCase()}.`);
  $("roundText").textContent = "Misi selesai";
  $("progressTrack").innerHTML = Array.from({length:roundCount()},()=>'<span class="progress-pip done"></span>').join("");
  $("nextBtn").hidden = state.level!==2;
  $("nextBtn").textContent = "Pergi ke Misi 3 →";
  $("gameStage").classList.toggle("misi2-next-ready",state.level===2);
  $("retryBtn").hidden = true;
  board.innerHTML = `<div class="board-content"><div class="finished"><div class="finished-emoji">🏆</div><h3>Syabas, peneroka nombor!</h3><p>Kamu sudah menyiapkan misi ini. Ada ${byLevel.length} soalan yang diselesaikan dan ${first} jawapan betul pada cubaan pertama. Skor misi semasa ialah <strong>${state.score}</strong>.</p><p>${state.level===3 ? "Permainan akan bermula semula secara automatik." : "Misi seterusnya akan bermula secara automatik."}</p></div></div>`;
  $("retryBtn").disabled = true;
  burstConfetti(56);
  if (state.level !== 2) scheduleAutoFlow(()=>advance(), 1900);
}
function resetQuestion({ preserveErrors = false } = {}) {
  clearAutoFlow();
  if(state.matchErrorTimer){clearTimeout(state.matchErrorTimer);state.matchErrorTimer=null;}
  state.matching=null;
  state.matchPointer=null;
  state.answered = false;
  $("gameStage").classList.remove("misi2-next-ready");
  if (!preserveErrors) state.errors = 0;
  state.lives = preserveErrors ? Math.max(1, state.maxLives - Math.min(state.errors, state.maxLives - 1)) : state.maxLives;
  state.hintUsed = false; state.selectedFruit = null; state.collected = [];
  state.startTime = Date.now();
  $("hintPanel").hidden = true;
  $("retryBtn").hidden = true;
  $("nextBtn").hidden = true;
  setFeedback("Jom cuba! Tiada had masa.");
  updateGame();
}
function switchLevel(level) {
  clearAutoFlow();
  state.level = level;
  state.round = 0;
  state.sequence = buildSequence();
  state.lives = state.maxLives;
  $("retryBtn").disabled = false;
  syncFullscreenButton();
  resetQuestion();
}
function completeAnswer() {
  if (state.answered) return;
  state.answered = true;
  const earned = Math.max(4, 10 - (state.errors * 2) - (state.hintUsed ? 2 : 0));
  state.score += earned;
  state.records.push({
    at: new Date().toLocaleString("ms-MY"), level: state.level,
    round: state.round + 1, expected: state.level===3 ? state.matching?.values.join(";") : currentTarget(), earned,
    mode: state.mode, firstTry: state.errors === 0 ? "Ya" : "Tidak",
    errors: state.errors, hint: state.hintUsed ? "Ya" : "Tidak",
    seconds: Math.max(0, Math.round((Date.now() - state.startTime) / 1000))
  });
  setFeedback(`Bagus! Kamu berjaya! +${earned} mata`, earned >= 8 ? "reward" : "success");
  speak("Bagus! Kamu berjaya!");
  updateGame();
  window.clearTimeout(state.autoTimer);
  if(state.level !== 2){
    state.autoTimer = window.setTimeout(() => {
      advance();
    }, 1400);
  }
}
function wrongAnswer() {
  if (state.answered) return;
  state.errors += 1;
  setFeedback("Belum tepat. Cuba lagi ya! Soalan akan diulang semula.", "error");
  speak("Belum tepat. Cuba lagi.");
  updateHud();
  window.clearTimeout(state.autoTimer);
  state.autoTimer = window.setTimeout(() => {
    if (!state.answered) resetQuestion();
  }, 1200);
}
function answerChoice(v) {
  if (state.answered) return;
  if (Number(v) === currentTarget()) completeAnswer();
  else wrongAnswer();
}
function selectFruit(id) {
  if (state.level!==2 || state.answered || state.collected.includes(id)) return;
  state.selectedFruit = id;
  renderLevel2();
  setFeedback("Bagus! Sekarang masukkan buah ke dalam bakul.");
}
function depositFruit(id) {
  if (state.level!==2 || state.answered || id === null || id === undefined || state.collected.includes(id)) return;
  state.collected.push(id); state.selectedFruit = null;
  renderLevel2();
  const total = state.collected.length;
  const target = currentTarget();
  if (total < target) {
    setFeedback(`Sudah ada ${total} biji buah dalam bakul. Tambah lagi sehingga cukup ${target}.`);
    return;
  }
  if (total === target) completeAnswer();
  else wrongAnswer();
}
function undoFruit() {
  if (state.level!==2 || state.answered || state.collected.length===0) return;
  state.collected.pop(); state.selectedFruit = null;
  renderLevel2();
  setFeedback("Satu buah telah dikeluarkan. Jom sambung!");
}
function checkBasket() {
  if (state.level!==2 || state.answered || state.collected.length===0) return;
  if (state.collected.length === currentTarget()) completeAnswer();
  else wrongAnswer();
}
function showHint() {
  state.hintUsed = true;
  $("hintPanel").hidden = false;
  const n = currentTarget();
  let hint;
  if (state.level===1) hint = `Sentuh atau kira buah satu demi satu. Cuba sebut: ${Array.from({length:n},(_,i)=>i+1).join(", ")}.`;
  else if (state.level===2) hint = `Lihat nombor ${n}. Ambil buah satu demi satu sehingga ada ${n} buah. Apabila betul, tekan butang Soalan seterusnya.`;
  else hint = "Letakkan jari atau mouse pada nombor, kemudian tarik garisan hingga ke kumpulan buah yang sama banyak. Garisan betul akan kekal dengan warna yang berbeza.";
  $("hintText").textContent = hint;
}
function advance() {
  const total = roundCount();
  if (state.round >= total) {
    if (state.level < 3) switchLevel(state.level + 1);
    else switchLevel(1);
    return;
  }
  if (!state.answered) return;
  state.round++;
  if (state.round >= total) updateGame();
  else syncFullscreenButton();
resetQuestion();
}
function handleAction(target) {
  if (!target || !target.dataset) return;
  if(target.dataset.gesture==='next'){
    if(state.level===2 && state.answered) advance();
    return;
  }
  if(state.answered)return;
  switch (target.dataset.gesture) {
    case "number": case "group": answerChoice(target.dataset.value); break;
    case "match-number": case "match-group": handleMatchChoice(target); break;
    case "fruit": selectFruit(Number(target.dataset.fruit)); break;
    case "basket": depositFruit(state.selectedFruit); break;
    case "check": checkBasket(); break;
    case "undo": undoFruit(); break;
  }
}
// Misi 3: follow the learner's actual finger/mouse path, like drawing with a pen.
board.addEventListener("pointerdown", (ev) => {
  if(state.level!==3 || state.answered || state.matchPointer)return;
  const source=ev.target.closest?.('[data-gesture="match-number"]');
  if(!source || source.disabled || !board.contains(source))return;
  if(!startMatchingDrag(Number(source.dataset.value),ev.clientX,ev.clientY))return;
  state.matchPointer=ev.pointerId;
  ev.preventDefault();
  try{$("matchingBoard")?.setPointerCapture(ev.pointerId);}catch(_){ }
});
board.addEventListener("pointermove", (ev) => {
  if(state.level===3 && state.matchPointer===ev.pointerId)moveMatchingDrag(ev.clientX,ev.clientY);
});
board.addEventListener("pointerup", (ev) => {
  if(state.level!==3||state.matchPointer!==ev.pointerId)return;
  state.matchPointer=null;
  finishMatchingDrag(ev.clientX,ev.clientY);
});
board.addEventListener("pointercancel", (ev) => {
  if(state.matchPointer!==ev.pointerId)return;
  state.matchPointer=null;
  if(state.matching){state.matching.dragging=null;updateMatchingVisuals();}
});
// Click and keyboard both work; Pointer Events also allow dragging a fruit on touchscreens.
board.addEventListener("click", (ev) => {
  const node = ev.target.closest("[data-gesture]");
  if (!node || node.dataset.gesture === "fruit") return;
  if(state.level===3 && (node.dataset.gesture==='match-number'||node.dataset.gesture==='match-group') && ev.detail!==0)return;
  handleAction(node);
});
board.addEventListener("keydown", (ev) => {
  const node = ev.target.closest("[data-gesture='fruit'], [data-gesture='basket']");
  if (!node || !["Enter", " "].includes(ev.key)) return;
  ev.preventDefault(); handleAction(node);
});
board.addEventListener("pointerdown", (ev) => {
  const node = ev.target.closest(".fruit-token");
  if (!node || state.answered || state.level!==2 || node.classList.contains("used")) return;
  if (state.mode!=="touch" && ev.pointerType==="touch") { /* touchscreen remains usable in any mode */ }
  ev.preventDefault();
  const id=Number(node.dataset.fruit);
  state.pointerDrag = { id, x:ev.clientX,y:ev.clientY, moved:false };
  try { board.setPointerCapture(ev.pointerId); } catch (_) {}
});
board.addEventListener("pointermove", (ev) => {
  if (!state.pointerDrag) return;
  const d=state.pointerDrag;
  if (Math.hypot(ev.clientX-d.x,ev.clientY-d.y)>16) d.moved=true;
  board.querySelector(".basket-zone")?.classList.toggle("target-hover", insideBasket(ev.clientX,ev.clientY));
});
board.addEventListener("pointerup", (ev) => {
  if (!state.pointerDrag) return;
  const d=state.pointerDrag; state.pointerDrag=null;
  if (d.moved && insideBasket(ev.clientX,ev.clientY)) depositFruit(d.id);
  else selectFruit(d.id);
  board.querySelector(".basket-zone")?.classList.remove("target-hover");
});
board.addEventListener("pointercancel",()=>{state.pointerDrag=null;board.querySelector(".basket-zone")?.classList.remove("target-hover")});
function insideBasket(x,y) {
  const node=board.querySelector(".basket-zone");
  if (!node) return false;
  const r=node.getBoundingClientRect();
  return x>=r.left-16&&x<=r.right+16&&y>=r.top-16&&y<=r.bottom+16;
}

// ---------- MediaPipe Hand Landmarker camera control ----------
const cursor = $("handCursor");
function cameraMessage(msg) { $("cameraStatus").textContent = msg; const t=$("cameraTag"); if(t) t.textContent = msg; }
function closeHandCursor() {
  cursor.hidden = true; if(handCursorSymbol) handCursorSymbol.textContent = "👆"; $("carriedFruit").textContent="";
  state.hand.hoverKey=""; state.hand.dragId=null; state.hand.pinched=false; state.hand.lastLandmarks=null;
  boardWrap?.classList.remove("webcam-live");
  if(starTrailLayer) starTrailLayer.innerHTML="";
  clearHandOverlay();
}
async function stopCamera() {
  clearAutoFlow();
  const hand=state.hand;
  hand.active=false;
  if(hand.raf) cancelAnimationFrame(hand.raf);
  hand.raf=null;
  if(hand.stream) hand.stream.getTracks().forEach(t=>t.stop());
  hand.stream=null;
  $("cameraVideo").srcObject=null;
  $("cameraPreview").hidden=true;
  boardWrap?.classList.remove("camera-ready");
  hand.lastVideoTime=-1;
  closeHandCursor();
  $("cameraBtn").textContent="📷 Hidupkan webcam";
  cameraMessage("Kamera dimatikan. Sentuhan dan mouse masih boleh digunakan.");
}
async function startCamera() {
  const h=state.hand;
  if(h.busy || h.active) return;
  h.busy=true; $("cameraBtn").disabled=true;
  cameraMessage("Meminta kebenaran dan menyediakan model pengesanan tangan…");
  try {
    if(!navigator.mediaDevices?.getUserMedia) throw new Error("Browser atau sambungan ini tidak menyokong webcam. Buka melalui HTTPS atau localhost.");
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:480},frameRate:{ideal:20,max:30}},audio:false});
    h.stream=stream;
    if(state.mode==="touch") { await stopCamera(); return; }
    const video=$("cameraVideo"); video.srcObject=stream; await video.play();
    boardWrap?.classList.add("camera-ready");
    $("cameraPreview").hidden=false;
    if(!h.landmarker) {
      const { HandLandmarker, FilesetResolver } = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm");
      const vision=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm");
      try {
        h.landmarker=await HandLandmarker.createFromOptions(vision,{
          baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",delegate:"GPU"},
          runningMode:"VIDEO",numHands:1,minHandDetectionConfidence:.5,minHandPresenceConfidence:.5,minTrackingConfidence:.5
        });
      } catch (gpuError) {
        console.warn("GPU MediaPipe unavailable; trying CPU",gpuError);
        h.landmarker=await HandLandmarker.createFromOptions(vision,{
          baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",delegate:"CPU"},
          runningMode:"VIDEO",numHands:1,minHandDetectionConfidence:.5,minHandPresenceConfidence:.5,minTrackingConfidence:.5
        });
      }
    }
    // Do not reactivate the webcam if the learner switched modes during a slow model download.
    if (state.mode === "touch" || h.stream !== stream) { await stopCamera(); return; }
    h.active=true;
    boardWrap?.classList.add("webcam-live");
    $("cameraPreview").hidden=false;
    $("cameraBtn").textContent="⛔ Matikan webcam";
    cameraMessage(state.mode==="pinch"?"Kamera aktif. Cubit untuk memilih; lepaskan buah di atas bakul.":"Kamera aktif. Halakan jari dan tunggu bulatan penuh.");
    h.raf=requestAnimationFrame(detectLoop);
  } catch(err) {
    console.error("Camera/MediaPipe error",err);
    await stopCamera();
    cameraMessage(`Tidak dapat mengaktifkan kamera: ${err?.message || "semak izin kamera dan internet"}. Gunakan Sentuhan / mouse.`);
  } finally { h.busy=false; $("cameraBtn").disabled=false; }
}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function gestureTargetAt(x,y){
  const node=document.elementFromPoint(x,y)?.closest?.("[data-gesture]");
  const usable=node && (board.contains(node) || (node.id==='nextBtn' && state.level===2 && state.answered))
    && !node.hasAttribute("disabled") && node.getAttribute("aria-disabled")!=="true";
  return usable?node:null;
}
function detectLoop(now) {
  const h=state.hand;
  if(!h.active) return;
  h.raf=requestAnimationFrame(detectLoop);
  if(document.hidden || now-h.lastDetectAt<48) return;
  const v=$("cameraVideo");
  if(v.readyState<2 || v.currentTime===h.lastVideoTime) return;
  h.lastDetectAt=now;h.lastVideoTime=v.currentTime;
  try {
    const result=h.landmarker.detectForVideo(v,now);
    if(!result.landmarks?.length) { closeHandCursor();cameraMessage("Tangan belum dikesan. Letakkan satu tangan di hadapan kamera.");return; }
    const l=result.landmarks[0];
    const tip=l[8],thumb=l[4];
    // The camera preview is mirrored; mirror the hand x coordinate as well.
    const r=board.getBoundingClientRect();
    const wantedX=r.left+(1-tip.x)*r.width;
    const wantedY=r.top+tip.y*r.height;
    const alpha=.46;
    h.cursorX=h.cursorX===null?wantedX:h.cursorX+(wantedX-h.cursorX)*alpha;
    h.cursorY=h.cursorY===null?wantedY:h.cursorY+(wantedY-h.cursorY)*alpha;
    cursor.hidden=false;
    cursor.style.left=h.cursorX+"px";cursor.style.top=h.cursorY+"px";
    h.lastLandmarks=l;
    boardWrap?.classList.add("webcam-live");
    drawHandOverlay(l);
    maybeEmitTrail(now);
    const refSize=Math.max(.055,distance(l[0],l[9]));
    const pinchRatio=distance(thumb,tip)/refSize;
    if(state.mode==="pinch") processPinch(pinchRatio,now);
    if(state.mode==="point") processDwell(now);
  } catch(err) {
    console.error("MediaPipe detection error",err);
    cameraMessage("Ralat pengesanan tangan. Cuba tukar kepada Sentuhan / mouse.");
    void stopCamera();
  }
}
function processDwell(now) {
  const h=state.hand;
  if(handCursorSymbol) handCursorSymbol.textContent="☝️";
  const el=gestureTargetAt(h.cursorX,h.cursorY);
  const key=el ? `${el.dataset.gesture}:${el.dataset.value??el.dataset.fruit??""}` : "";
  if(!key || (state.answered && !(state.level===2 && el?.dataset.gesture==='next'))) {h.hoverKey="";cursor.style.setProperty("--progress","0%");return;}
  if(key!==h.hoverKey){h.hoverKey=key;h.hoverSince=now;cursor.style.setProperty("--progress","0%");return;}
  const pct=Math.min(100,Math.max(0,((now-h.hoverSince)/1400)*100));
  cursor.style.setProperty("--progress",pct+"%");
  if(pct>=100 && now>h.cooldownUntil) {
    h.cooldownUntil=now+900;h.hoverKey="";
    handleAction(el);cursor.style.setProperty("--progress","0%");
  }
}
function processPinch(ratio,now) {
  const h=state.hand;
  const closing=!h.pinched&&ratio<.42;
  const opening=h.pinched&&ratio>.66;
  if(handCursorSymbol) handCursorSymbol.textContent=h.pinched?"🤏":"👆";
  cursor.style.setProperty("--progress",h.pinched?"100%":"0%");
  if(closing) {
    h.pinched=true;
    if(now<h.cooldownUntil || (state.answered && state.level!==2)) return;
    const el=gestureTargetAt(h.cursorX,h.cursorY);
    if(el && el.dataset.gesture==="match-number" && state.level===3){
      startMatchingDrag(Number(el.dataset.value),h.cursorX,h.cursorY);
    } else if(el && el.dataset.gesture==="fruit" && state.level===2) {
      h.dragId=Number(el.dataset.fruit);$("carriedFruit").textContent=fruit();
    } else if (el) {
      handleAction(el);h.cooldownUntil=now+620;
    }
  }
  if(state.level===3 && h.pinched && state.matching?.dragging){
    moveMatchingDrag(h.cursorX,h.cursorY);
  }
  if(opening) {
    h.pinched=false;
    if(state.level===3 && state.matching?.dragging){
      finishMatchingDrag(h.cursorX,h.cursorY);
    }
    if(h.dragId!==null) {
      const id=h.dragId;h.dragId=null;$("carriedFruit").textContent="";
      if(insideBasket(h.cursorX,h.cursorY)) depositFruit(id);
      else selectFruit(id); // also works via selecting fruit and pinching basket
    }
  }
}
function updateMode(mode) {
  if(state.matching?.dragging){state.matching.dragging=null;updateMatchingVisuals();}
  state.mode=mode;
  boardWrap?.classList.toggle("webcam-fruitless", mode!=="touch");
  document.querySelectorAll(".mode-btn").forEach(b=>{
    const active=b.dataset.mode===mode;b.classList.toggle("is-active",active);b.setAttribute("aria-pressed",String(active));
  });
  if(mode==="touch") {
    $("cameraBtn").hidden=true;
    void stopCamera();
    cameraMessage("Gunakan jari, mouse atau papan kekunci untuk bermain.");
  } else {
    $("cameraBtn").hidden=false;
    if(!state.hand.active) cameraMessage("Tekan 'Hidupkan webcam' untuk mula. Sentuhan/mouse masih tersedia.");
    else cameraMessage(mode==="point"?"Halakan jari dan tunggu bulatan penuh.":"Cubit jari untuk memilih atau menyeret buah.");
    state.hand.hoverKey="";state.hand.pinched=false;state.hand.dragId=null;
  }
  updateHud();
}


function fullscreenElement(){return document.fullscreenElement || document.webkitFullscreenElement || null;}
async function toggleFullscreen(){
  const stage=$("gameStage");
  const btn=$("fullscreenBtn");
  try{
    if(fullscreenElement()){
      if(document.exitFullscreen) await document.exitFullscreen();
      else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
    }else{
      if(stage.requestFullscreen) await stage.requestFullscreen();
      else if(stage.webkitRequestFullscreen) stage.webkitRequestFullscreen();
    }
  }catch(err){
    console.warn("Fullscreen not available",err);
    setFeedback("Fullscreen tidak disokong pada peranti ini. Teruskan bermain dalam paparan biasa.");
  }
}
function syncFullscreenButton(){
  const active=!!fullscreenElement();
  const btn=$("fullscreenBtn");
  if(!btn) return;
  btn.classList.toggle("is-active",active);
  btn.setAttribute("aria-pressed",String(active));
  btn.textContent=active?"🡼 Keluar fullscreen":"⛶ Fullscreen";
}
// ---------- App controls ----------
document.querySelectorAll(".mode-btn").forEach(b=>b.addEventListener("click",()=>updateMode(b.dataset.mode)));
$("cameraBtn").addEventListener("click",()=>state.hand.active?stopCamera():startCamera());
$("hintBtn").addEventListener("click",()=>{if(state.answered)return;showHint();speak($("hintText").textContent)});
$("speakBtn").addEventListener("click",()=>speak($("instruction").textContent));
$("voiceBtn").addEventListener("click",()=>{
  state.sound=!state.sound;
  $("voiceBtn").textContent=state.sound?"🔊 Audio: Hidup":"🔇 Audio: Mati";
  $("voiceBtn").setAttribute("aria-pressed",String(state.sound));
  if(!state.sound && "speechSynthesis" in window) window.speechSynthesis.cancel();
});
$("retryBtn").addEventListener("click",()=>resetQuestion({preserveErrors:true}));
$("nextBtn").addEventListener("click",advance);
document.querySelectorAll(".level-tab").forEach(b=>b.addEventListener("click",()=>switchLevel(Number(b.dataset.level))));
$("rangeSelect").addEventListener("change",(ev)=>{
  state.max=Number(ev.target.value);
  state.sequence = buildSequence();
  state.round=0;
  syncFullscreenButton();
  resetQuestion();
});
$("resetBtn").addEventListener("click",()=>{
  if(!window.confirm("Mulakan semula dan padam rekod pembelajaran sesi ini?")) return;
  window.clearTimeout(state.autoTimer);
  state.records=[];state.score=0;state.max=Number($("rangeSelect").value);state.sequence=buildSequence();switchLevel(1);
  setFeedback("Sesi baharu bermula. Jom kira buah!");
});
$("downloadBtn").addEventListener("click",()=>{
  if(!state.records.length){setFeedback("Tiada rekod lagi. Main sekurang-kurangnya satu soalan sebelum mengeksport.");return;}
  const headings=["Tarikh masa","Tahap","Soalan","Sasaran nombor","Mata diperoleh","Kawalan","Betul cubaan pertama","Bilangan kesilapan","Bantuan digunakan","Tempoh saat"];
  const safe=(value)=>'"'+String(value).replace(/^[=+@-]/,"'").replace(/"/g,'""')+'"';
  const data=state.records.map(r=>[r.at,r.level,r.round,r.expected,r.earned ?? "",r.mode,r.firstTry,r.errors,r.hint,r.seconds]);
  const csv="\ufeff"+[headings,...data].map(line=>line.map(safe).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="rekod-misi-bakul-nombor.csv";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  setFeedback("Rekod CSV telah disediakan untuk dimuat turun.");
});
$("openHelp").addEventListener("click",()=>$("helpDialog").showModal());
if($("fullscreenBtn")) $("fullscreenBtn").addEventListener("click",toggleFullscreen);
document.addEventListener("fullscreenchange",()=>{syncFullscreenButton();setTimeout(drawMatchingLines,180);});
document.addEventListener("webkitfullscreenchange",syncFullscreenButton);
window.addEventListener("pagehide",()=>{if(state.hand.stream)state.hand.stream.getTracks().forEach(t=>t.stop())});
window.addEventListener("resize",()=>{syncOverlaySize();requestAnimationFrame(drawMatchingLines);});
window.addEventListener("orientationchange",()=>setTimeout(drawMatchingLines,250));
document.addEventListener("fullscreenchange",()=>setTimeout(syncOverlaySize,60));
document.addEventListener("webkitfullscreenchange",()=>setTimeout(syncOverlaySize,60));
syncOverlaySize();
syncFullscreenButton();
state.sequence = buildSequence();
resetQuestion();
