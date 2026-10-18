/* MISI BAKUL NOMBOR – Camera Star Upgrade, 2026-10-18
   Adds only cosmetic camera UI + live video background + finger sparkles.
   Original game logic, MediaPipe handlers, missions and buttons remain intact.
   Include this script AFTER the original inline game script, before </body>.
*/
(() => {
  'use strict';
  if (window.__MISI_CAMERA_STAR_UPGRADE__) return;
  window.__MISI_CAMERA_STAR_UPGRADE__ = true;

  const video = document.getElementById('cv');
  const cameraButton = document.getElementById('bCam');
  const handCursor = document.getElementById('hc');
  if (!video || !cameraButton || !handCursor) {
    console.warn('Camera upgrade: video, camera button, or hand cursor not found.');
    return;
  }

  // New CSS overrides old video preview and round camera button styling.
  const style = document.createElement('style');
  style.id = 'camera-star-upgrade-styles';
  style.textContent = `
    #cv {
      position:fixed !important;
      inset:0 !important;
      top:0 !important;
      left:0 !important;
      right:0 !important;
      bottom:0 !important;
      width:100vw !important;
      height:100vh !important;
      height:100dvh !important;
      min-width:100% !important;
      max-width:none !important;
      object-fit:cover !important;
      object-position:center center !important;
      transform:scaleX(-1) !important;
      border:none !important;
      border-radius:0 !important;
      box-shadow:none !important;
      pointer-events:none !important;
      z-index:1 !important;
      background:#14372e !important;
    }
    body.camera-background-active .bg {opacity:0 !important;visibility:hidden !important;}
    #bCam {
      position:fixed !important;
      right:max(12px,env(safe-area-inset-right,0px)) !important;
      bottom:max(12px,env(safe-area-inset-bottom,0px)) !important;
      width:106px !important;
      height:106px !important;
      min-width:106px !important;
      min-height:106px !important;
      padding:0 !important;
      border:0 !important;
      border-radius:0 !important;
      display:flex !important;
      flex-direction:column !important;
      align-items:center !important;
      justify-content:center !important;
      gap:0 !important;
      background:linear-gradient(160deg,#fff4a5 7%,#ffd156 55%,#f5a637 95%) !important;
      color:#5a3908 !important;
      font-size:0 !important;
      line-height:1 !important;
      font-weight:900 !important;
      z-index:90 !important;
      box-shadow:none !important;
      text-align:center !important;
      clip-path:polygon(50% 0%,62% 33%,98% 35%,70% 57%,79% 93%,50% 73%,21% 93%,30% 57%,2% 35%,38% 33%) !important;
      filter:drop-shadow(0 5px 5px #0005);
      transition:transform .15s,filter .15s;
    }
    #bCam:before {content:'📷';font-size:35px;line-height:1.05;display:block;}
    #bCam:after {content:'KAMERA';font-size:11px;font-weight:1000;letter-spacing:.7px;display:block;}
    #bCam.on {
      background:linear-gradient(160deg,#e9ffa2,#89dc75 60%,#40bb8e) !important;
      color:#185638 !important;
    }
    #bCam.on:after {content:'AKTIF';}
    #bCam:active:not(:disabled){transform:scale(.94) !important;}
    #bCam:focus-visible{outline:4px solid #fff !important;outline-offset:5px;}
    #camStarParticles {
      position:fixed;inset:0;z-index:50;
      pointer-events:none;overflow:hidden;
    }
    #camStarParticles .cam-spark {
      position:absolute;left:0;top:0;
      font-size:clamp(20px,3.2vw,32px);
      line-height:1;opacity:0;
      filter:drop-shadow(0 2px 5px rgba(0,0,0,.27));
      animation:cam-spark-fade var(--life,.78s) ease-out forwards;
      will-change:transform,opacity;
    }
    @keyframes cam-spark-fade {
      0%{opacity:0;transform:translate(-50%,-50%) scale(.25) rotate(-28deg)}
      18%{opacity:1;transform:translate(-50%,-50%) scale(1.2) rotate(3deg)}
      100%{opacity:0;transform:translate(calc(-50% + var(--dx,0px)),calc(-50% + var(--dy,-24px))) scale(.65) rotate(85deg)}
    }
    @media(max-width:540px){
      #bCam{width:91px !important;height:91px !important;min-width:91px !important;min-height:91px !important;}
      #bCam:before{font-size:29px;}
      #bCam:after{font-size:9px;}
    }
    @media(prefers-reduced-motion:reduce){
      #camStarParticles .cam-spark{display:none !important;animation:none !important;}
    }
  `;
  document.head.appendChild(style);

  const starLayer = document.createElement('div');
  starLayer.id = 'camStarParticles';
  starLayer.setAttribute('aria-hidden','true');
  document.body.appendChild(starLayer);

  const colors = ['#ffdb49','#ff85c6','#66d7ff','#abf36b','#ffa95f','#c5a0ff'];
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let lastPos = null;
  let lastStarTime = 0;
  let active = false;

  const cameraRunning = () => Boolean(video.srcObject && video.style.display !== 'none');
  function refreshCameraState(){
    active = cameraRunning();
    document.body.classList.toggle('camera-background-active',active);
    cameraButton.setAttribute('aria-pressed',String(active));
    cameraButton.setAttribute('aria-label',active?'Matikan webcam':'Hidupkan webcam');
    cameraButton.title = active?'Matikan webcam':'Hidupkan webcam';
    if (!active){lastPos=null;starLayer.replaceChildren();}
  }

  const cameraObserver = new MutationObserver(refreshCameraState);
  cameraObserver.observe(video,{attributes:true,attributeFilter:['style']});
  video.addEventListener('playing',refreshCameraState);
  video.addEventListener('emptied',refreshCameraState);
  cameraButton.addEventListener('click',()=>setTimeout(refreshCameraState,160));
  refreshCameraState();

  function emitStar(x,y){
    const star=document.createElement('span');
    star.className='cam-spark';
    star.textContent=Math.random()>.5?'★':'✦';
    star.style.left=(x+(Math.random()-.5)*24)+'px';
    star.style.top=(y+(Math.random()-.5)*24)+'px';
    star.style.color=colors[Math.floor(Math.random()*colors.length)];
    star.style.setProperty('--dx',((Math.random()-.5)*44)+'px');
    star.style.setProperty('--dy',(-18-Math.random()*32)+'px');
    star.style.setProperty('--life',(.62+Math.random()*.2)+'s');
    starLayer.appendChild(star);
    window.setTimeout(()=>star.remove(),880);
  }
  function animate(time){
    // The current game's MediaPipe tracker already moves #hc as the finger moves.
    // Reuse those coordinates so all modes keep their original gesture logic.
    if(active && !reduceMotion?.matches && handCursor.style.display !== 'none'){
      const x=parseFloat(handCursor.style.left);
      const y=parseFloat(handCursor.style.top);
      if(Number.isFinite(x)&&Number.isFinite(y)){
        const changed=!lastPos || Math.hypot(x-lastPos.x,y-lastPos.y)>5;
        if(changed && time-lastStarTime>68){
          emitStar(x,y);
          if(Math.random()>.5)emitStar(x+(Math.random()-.5)*15,y+(Math.random()-.5)*15);
          lastStarTime=time;
          lastPos={x,y};
        }
      }
    }
    window.requestAnimationFrame(animate);
  }
  window.requestAnimationFrame(animate);
  console.info('Misi Bakul Nombor: camera star upgrade active.');
})();
