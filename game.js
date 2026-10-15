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
const handCursorSymbol = $("handCursorSymbol");

const MODE_LABELS = {
  touch: { title: "Sentuhan / mouse", hint: "Tekan, pilih atau seret" },
  point: { title: "Point & Select", hint: "Halakan jari dan tunggu bulatan penuh" },
  pinch: { title: "Pinch & Drag", hint: "Cubit untuk pilih atau seret buah" }
};
const LEVELS = {
  1: { title: "Misi 1 · Jom Kira!", sub: "Kira buah dan pilih nombor yang betul." },
  2: { title: "Misi 2 · Isi Bakul!", sub: "Kumpulkan buah mengikut nombor yang dipaparkan." },
  3: { title: "Misi 3 · Padankan!", sub: "Pilih gambar yang mempunyai bilangan yang betul." }
};
const ICONS = ["🍎", "🍊", "🍐", "🍓", "🍋"];
const state = {
  level: 1, round: 0, max: 5, mode: "touch", sound: true,
  answered: false, errors: 0, hintUsed: false,
  selectedFruit: null, collected: [], records: [], startTime: Date.now(),
  hand: { active: false, landmarker: null, stream: null, raf: null,
    lastVideoTime: -1, lastDetectAt: 0, cursorX: null, cursorY: null,
    pinched: false, dragId: null, hoverKey: "", hoverSince: 0,
    cooldownUntil: 0, busy: false, lastLandmarks: null, drawRaf: null, lastTrailAt: 0 },
  pointerDrag: null, score: 0, lives: 3, maxLives: 3, autoTimer: null
};

function targetSequence() {
  return state.max === 3 ? [2, 1, 3] : [3, 1, 5, 2, 4];
}
function currentTarget() {
  const sequence = targetSequence();
  return sequence[(state.round + state.level - 1) % sequence.length];
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
  if(now-(h.lastTrailAt||0)<80) return;
  h.lastTrailAt=now;
  emitTrailStar(h.cursorX,h.cursorY);
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
function updateProgress() {
  const total = targetSequence().length;
  const current = Math.min(state.round + 1, total);
  const pct = Math.round((state.round / total) * 100);
  $("roundText").textContent = `Soalan ${current} / ${total}`;
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
  const total = targetSequence().length;
  updateTabs(); updateProgress(); updateStats(); updateHud();
  $("hintPanel").hidden = !state.hintUsed;
  $("retryBtn").disabled = state.answered || state.round >= total;
  $("nextBtn").hidden = !state.answered;
  $("nextBtn").textContent = state.round === total - 1 ? "Lihat pencapaian →" : "Soalan seterusnya →";
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
  board.innerHTML = `<div class="board-content orchard-scene">
    <span class="board-label">🤲 Seret atau pilih buah dari pokok ke bakul</span>
    <div class="target-number" aria-label="Nombor ${n}">${n}</div>
    <div class="orchard-tree" aria-label="Pokok buah">
      <img class="tree-image" src="tree-cartoon.svg" alt="Pokok buah kartun" draggable="false">
      <div class="fruit-tree-zone" aria-label="Buah pada pokok">${Array.from({ length: fruitCount }, (_, i) => `<div data-gesture="fruit" data-fruit="${i}" class="fruit-token ${collectedSet.has(i) ? "used" : ""} ${state.selectedFruit === i ? "selected" : ""}" role="button" tabindex="${collectedSet.has(i) || state.answered ? "-1" : "0"}" aria-label="Pilih buah nombor ${i+1}" aria-disabled="${collectedSet.has(i) || state.answered}"><span class="fruit-emoji" aria-hidden="true">${fruit()}</span></div>`).join("")}</div>
    </div>
    <span class="tree-helper">Ambil buah dari pokok dan bawa ke bakul.</span>
    <div class="orchard-basket-area">
      <div class="basket-zone" data-gesture="basket" role="button" tabindex="0" aria-label="Masukkan buah yang dipilih ke bakul">
         <span class="basket-count">${collected.length} / ${n}</span>
         <span class="basket-graphic" aria-hidden="true">🧺</span>
         <span class="basket-items" aria-label="${collected.length} buah dalam bakul">${collected.map(() => fruit()).join(" ")}</span>
      </div>
      <div class="board-footer">
        <button type="button" class="secondary-button" data-gesture="undo" ${collected.length===0 || state.answered ? "disabled" : ""}>↶ Keluarkan satu buah</button>
      </div>
    </div>
  </div>`;
}
function renderLevel3() {
  const n = currentTarget();
  setInstruction(`Cari kumpulan yang mempunyai ${n} biji buah.`);
  board.innerHTML = `<div class="board-content">
    <span class="board-label">🔎 Cari gambar yang sesuai</span>
    <div class="target-number" aria-label="Nombor ${n}">${n}</div>
    <div class="group-choices" aria-label="Pilihan kumpulan buah">
      ${numberOptions(n).map((v,i) => `<button type="button" class="group-btn" data-gesture="group" data-value="${v}" aria-label="Kumpulan ${v} biji buah" ${state.answered ? "disabled" : ""}><span class="group-fruits" aria-hidden="true">${Array(v).fill(fruit()).join(" ")}</span><span class="group-subtitle">Pilihan ${i+1}</span></button>`).join("")}
    </div>
  </div>`;
}
function renderFinished() {
  const byLevel = state.records.filter(r => r.level === state.level);
  const first = byLevel.filter(r => r.firstTry === "Ya").length;
  setInstruction(`Tahniah! Kamu sudah mencuba ${LEVELS[state.level].title.toLowerCase()}.`);
  $("roundText").textContent = "Misi selesai";
  $("progressTrack").innerHTML = targetSequence().map(() => '<span class="progress-pip done"></span>').join("");
  $("nextBtn").hidden = true;
  $("retryBtn").hidden = true;
  board.innerHTML = `<div class="board-content"><div class="finished"><div class="finished-emoji">🏆</div><h3>Syabas, peneroka nombor!</h3><p>Kamu sudah menyiapkan misi ini. Ada ${byLevel.length} soalan yang diselesaikan dan ${first} jawapan betul pada cubaan pertama. Skor misi semasa ialah <strong>${state.score}</strong>.</p><p>${state.level===3 ? "Permainan akan bermula semula secara automatik." : "Misi seterusnya akan bermula secara automatik."}</p></div></div>`;
  $("retryBtn").disabled = true;
  scheduleAutoFlow(()=>advance(), 1700);
}
function resetQuestion({ preserveErrors = false } = {}) {
  clearAutoFlow();
  state.answered = false;
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
    round: state.round + 1, expected: currentTarget(), earned,
    mode: state.mode, firstTry: state.errors === 0 ? "Ya" : "Tidak",
    errors: state.errors, hint: state.hintUsed ? "Ya" : "Tidak",
    seconds: Math.max(0, Math.round((Date.now() - state.startTime) / 1000))
  });
  setFeedback(`Bagus! Kamu berjaya! +${earned} mata`, earned >= 8 ? "reward" : "success");
  speak("Bagus! Kamu berjaya!");
  updateGame();
  window.clearTimeout(state.autoTimer);
  state.autoTimer = window.setTimeout(() => {
    advance();
  }, 1400);
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
  else if (state.level===2) hint = `Lihat nombor ${n}. Ambil satu buah pada satu masa. Masukkan ke bakul sehingga ada ${n} buah. Permainan akan semak secara automatik.`;
  else hint = `Nombor yang dicari ialah ${n}. Kira buah dalam setiap kad satu demi satu, kemudian pilih yang mempunyai ${n} buah.`;
  $("hintText").textContent = hint;
}
function advance() {
  const total = targetSequence().length;
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
  if (!target || !target.dataset || state.answered) return;
  switch (target.dataset.gesture) {
    case "number": case "group": answerChoice(target.dataset.value); break;
    case "fruit": selectFruit(Number(target.dataset.fruit)); break;
    case "basket": depositFruit(state.selectedFruit); break;
    case "check": checkBasket(); break;
    case "undo": undoFruit(); break;
  }
}
// Click and keyboard both work; Pointer Events also allow dragging a fruit on touchscreens.
board.addEventListener("click", (ev) => {
  const node = ev.target.closest("[data-gesture]");
  if (!node || node.dataset.gesture === "fruit") return;
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
  return node && board.contains(node) && !node.hasAttribute("disabled") && node.getAttribute("aria-disabled")!=="true" ? node:null;
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
  if(!key || state.answered) {h.hoverKey="";cursor.style.setProperty("--progress","0%");return;}
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
    if(now<h.cooldownUntil||state.answered) return;
    const el=gestureTargetAt(h.cursorX,h.cursorY);
    if(el && el.dataset.gesture==="fruit" && state.level===2) {
      h.dragId=Number(el.dataset.fruit);$("carriedFruit").textContent=fruit();
    } else if (el) {
      handleAction(el);h.cooldownUntil=now+620;
    }
  }
  if(opening) {
    h.pinched=false;
    if(h.dragId!==null) {
      const id=h.dragId;h.dragId=null;$("carriedFruit").textContent="";
      if(insideBasket(h.cursorX,h.cursorY)) depositFruit(id);
      else selectFruit(id); // also works via selecting fruit and pinching basket
    }
  }
}
function updateMode(mode) {
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
  state.round=0;
  syncFullscreenButton();
  resetQuestion();
});
$("resetBtn").addEventListener("click",()=>{
  if(!window.confirm("Mulakan semula dan padam rekod pembelajaran sesi ini?")) return;
  window.clearTimeout(state.autoTimer);
  state.records=[];state.score=0;state.max=Number($("rangeSelect").value);switchLevel(1);
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
document.addEventListener("fullscreenchange",syncFullscreenButton);
document.addEventListener("webkitfullscreenchange",syncFullscreenButton);
window.addEventListener("pagehide",()=>{if(state.hand.stream)state.hand.stream.getTracks().forEach(t=>t.stop())});
window.addEventListener("resize",syncOverlaySize);
document.addEventListener("fullscreenchange",()=>setTimeout(syncOverlaySize,60));
document.addEventListener("webkitfullscreenchange",()=>setTimeout(syncOverlaySize,60));
syncOverlaySize();
syncFullscreenButton();
resetQuestion();
