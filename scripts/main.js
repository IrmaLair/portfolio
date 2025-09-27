// Simple interactivity: year and mobile nav toggle
// Fixed copyright year per design (guarded to avoid errors on pages without a #year element)
const _yearEl = document.getElementById('year');
if (_yearEl) _yearEl.textContent = '2025';

// Position shells vertically between hero content and footer
function debounce(fn, wait){
  let t;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  }
}

/* Audio manager: preload short audio clips and handle safe playback across pages.
   - bg loop is started on first user gesture on the homepage only (element with id 'bg-audio')
   - short effects are played on hover/click events without looping
*/
const AudioManager = (function(){
  const cache = new Map();

  function load(id, src, opts = {}){
    if (cache.has(id)) return cache.get(id);
    const a = new Audio(src);
    a.preload = 'auto';
    if (opts.loop) a.loop = true;
    a.volume = typeof opts.volume === 'number' ? opts.volume : 1.0;
    cache.set(id, a);
    return a;
  }

  function play(id, opts = {}){
    const a = cache.get(id);
    if (!a) return Promise.reject(new Error('audio:not-loaded'));
    try{
      if (opts.restart) { a.currentTime = 0; }
      const p = a.play();
      if (p && p.then) return p.catch(()=>{});
    } catch(e){/* ignore */}
    return Promise.resolve();
  }

  function pause(id){ const a = cache.get(id); if (a) try{ a.pause(); }catch(e){} }

  return { load, play, pause, cache };
})();

// Preload assets (short effects)
AudioManager.load('shell-hover', 'assets/shell.mp3', { volume: 0.9 });
AudioManager.load('shell-splash', 'assets/shell-splash.mp3', { volume: 1.0 });
AudioManager.load('logo-sparkle', 'assets/logo-sparkle.mp3', { volume: 0.9 });
// background audio element (home only) will be referenced later if present

// Helper: wait for specified short SFX to finish or until a max timeout (ms)
function waitForSfx(ids = ['shell-splash','logo-sparkle'], maxWait = 1500) {
  try {
    const audios = ids.map(id => AudioManager.cache.get(id)).filter(Boolean);
    if (!audios.length) return Promise.resolve();
    const promises = audios.map(a => new Promise(resolve => {
      try {
        if (!a || a.paused || a.ended || a.currentTime === 0) return resolve();
        const onEnd = () => { try { a.removeEventListener('ended', onEnd); } catch(e){}; resolve(); };
        a.addEventListener('ended', onEnd);
      } catch (e) { resolve(); }
    }));
    return Promise.race([
      Promise.all(promises).catch(()=>{}),
      new Promise(res => setTimeout(res, maxWait))
    ]);
  } catch (e) { return Promise.resolve(); }
}

// Start background audio on first user gesture (avoid autoplay block)
let _bgStarted = false;
function tryStartBackground(){
  if (_bgStarted) return;
  const bg = document.getElementById('bg-audio');
  if (!bg) return;
  // ensure the element is loaded into AudioManager cache too for unified control
  AudioManager.cache.set('bg', bg);
  // Try to play immediately. If blocked, play muted and show 'enable sound' affordance.
  const p = bg.play();
  if (p && p.then) {
    p.then(() => { _bgStarted = true; }).catch(() => {
      // Autoplay blocked: play silently muted so audio is 'allowed' and can be unmuted later
      try { bg.muted = true; bg.play().catch(()=>{}); } catch(e){}
      // enable-sound control removed per user request
      _bgStarted = true;
    });
  } else {
    _bgStarted = true;
  }
}

// Listen for a first meaningful user gesture to start background on home page
['pointerdown','keydown','touchstart'].forEach(ev => {
  window.addEventListener(ev, function onceStart(){ tryStartBackground(); window.removeEventListener(ev, onceStart); }, { once:true, passive:true });
});

// createEnableSoundControl removed per user request

// Create a lightweight AudioContext to improve reliability of unlocking audio on some browsers
try{
  if (!window.__appAudioContext && window.AudioContext) {
    window.__appAudioContext = new AudioContext();
  }
}catch(e){}

// If the user previously enabled sound, try to auto-unmute on load
try{
  const wasEnabled = localStorage.getItem('sound-enabled');
  if (wasEnabled) {
    const bg = document.getElementById('bg-audio');
    if (bg) {
      try {
        // Attempt to resume audio context first
        window.__appAudioContext && window.__appAudioContext.state === 'suspended' && window.__appAudioContext.resume().catch(()=>{});
        bg.muted = false;
        bg.play().catch(()=>{});
      } catch(e){}
    }
  }
}catch(e){}

// Play overlay removed per user request

// mute toggle removed per user request


// Adjust the shell gap dynamically so the gap reduces smoothly by up to 50px
function adjustShellGapDynamic(baseGap){
  const minWidth = 400; // below this, apply full reduction
  const maxWidth = 1200; // at or above this, no reduction
  const maxReduction = 50; // px to reduce at smallest sizes
  const w = window.innerWidth;
  let t = 0;
  if(w <= minWidth) t = 1;
  else if(w >= maxWidth) t = 0;
  else t = 1 - (w - minWidth) / (maxWidth - minWidth); // 0..1
  const reduction = Math.round(maxReduction * t);
  const dynamic = Math.max(0, baseGap - reduction);
  document.documentElement.style.setProperty('--shell-gap-dynamic', dynamic + 'px');
}

function positionShellsBetween(){
  const subheading = document.querySelector('.subheading');
  const bodyText = document.querySelector('.body-text');
  const shells = document.querySelector('.shells');
  if (!subheading || !bodyText || !shells) return;
  // Compute rectangles for the reference elements
  const aRect = subheading.getBoundingClientRect();
  const bRect = bodyText.getBoundingClientRect();

  // Always position the shells fixed and horizontally centered (left handled below)
  shells.style.position = 'fixed';


  // Determine the vertical interval where shells should sit: between subheading.bottom and bodyText.top
  const availableTop = aRect.bottom;
  const availableBottom = bRect.top;
  const shellsHeight = shells.getBoundingClientRect().height || 180;

  // Center shells vertically in the available interval
  let finalTop = ((availableTop + availableBottom) / 2) - (shellsHeight / 2);

  // If there is enough space to fit shells fully between the two elements, clamp so they do not overlap either.
  const space = availableBottom - availableTop;
  if (space >= shellsHeight + 12) {
    // clamp finalTop so shells stay entirely inside the interval with small padding
    const minTop = availableTop + 6;
    const maxTop = availableBottom - shellsHeight - 6;
    finalTop = Math.max(minTop, Math.min(finalTop, maxTop));
  } else {
    // Not enough room: keep the shells centered between the two elements (may overlap slightly)
    // This ensures the shells section remains visually between the two references during resizes.
    finalTop = ((availableTop + availableBottom) / 2) - (shellsHeight / 2);
  }

  // Horizontal centering (small-screen hero centering preserved)
  const screenW = window.innerWidth || document.documentElement.clientWidth;
  if (screenW < 480) {
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
      const hcRect = heroContent.getBoundingClientRect();
      shells.style.left = (hcRect.left + hcRect.width / 2) + 'px';
    } else {
      shells.style.left = '50%';
    }
  } else {
    shells.style.left = '50%';
  }
  shells.style.transform = 'translateX(-50%)';
  // Position shells exactly centered between the bottom of `.subheading` and the top of `.body-text`.
  // Removed the fixed +30px nudge so the group sits visually centered in the available interval.
  shells.style.top = Math.max(6, finalTop) + 'px';
  shells.style.zIndex = 4;
}

window.addEventListener('load', async () => {
  positionShellsBetween();
  // recalc after a short delay in case fonts or images changed layout
  setTimeout(positionShellsBetween, 250);

  // Initialize dynamic shell gap based on CSS --shell-gap (fallback 120px)
  const cssGap = getComputedStyle(document.documentElement).getPropertyValue('--shell-gap');
  const baseGap = cssGap ? parseInt(cssGap.trim()) : 120;
  adjustShellGapDynamic(baseGap);

  // --- Shell SVG randomization: define a pool (3 inline) and fetch 3 external svgs ---
  try {
    // Use the six authored asset files directly (three local + three others) via <img> templates
    const svgPool = [
      '<img src="assets/shell1.svg" alt="shell1" width="120" height="120" aria-hidden="true">',
      '<img src="assets/shell2.svg" alt="shell2" width="120" height="120" aria-hidden="true">',
      '<img src="assets/shell3.svg" alt="shell3" width="120" height="120" aria-hidden="true">'
    ];

    // paths to externally stored svgs (created under assets/)
      // Use <img> references for external SVG assets to avoid duplicating <defs> when inlining.
      // This works reliably with file:// and preserves the visual fidelity of the authored SVG files.
      const remoteImgTemplates = [
        '<img src="assets/shell-star.svg" alt="shell" width="120" height="120" aria-hidden="true">',
        '<img src="assets/shell-spiral.svg" alt="shell" width="120" height="120" aria-hidden="true">',
        '<img src="assets/shell-waves.svg" alt="shell" width="120" height="120" aria-hidden="true">'
      ];

      // Combine the three local SVG buttons with the external image templates into the pool
      const fullPool = svgPool.concat(remoteImgTemplates);

    // (old fetch/fallback removed) the pool is already built above as `fullPool` using img templates

    // pick n unique random entries from the combined pool using Fisher-Yates shuffle
    function pickNUnique(arr, n){
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      const picks = copy.slice(0, n);
      console.debug('shell-pool-size=', arr.length, 'picks=', picks);
      return picks;
    }

    const buttons = Array.from(document.querySelectorAll('.shells .shell-btn'));
    if (buttons.length === 3) {
      const picks = pickNUnique(fullPool, 3);
      // replace only the SVG/img container while preserving caption span and keeping the image inside .shell-inner
      buttons.forEach((btn, idx) => {
        const caption = btn.querySelector('.shell-caption');
        const inner = btn.querySelector('.shell-inner');
        // remove any existing svg/img inside the button (may be nested in .shell-inner)
        const existingSvg = btn.querySelector('svg, img');
        if (existingSvg) existingSvg.remove();

        // Insert the chosen template into the inner wrapper when available so hover CSS applies
        if (inner) {
          inner.insertAdjacentHTML('afterbegin', picks[idx]);
        } else {
          // fallback: insert directly into button
          btn.insertAdjacentHTML('afterbegin', picks[idx]);
        }

        // Ensure caption stays outside the inner wrapper in the button (so it renders where it was previously)
        if (caption) {
          btn.appendChild(caption);
        }
      });
      // After insertion, ensure any inserted <img> elements match SVG sizing/styling
      buttons.forEach(btn => {
        const img = btn.querySelector('img');
        if (img) img.style.display = 'block';
      });
    }
  } catch (e) {
    console.error('Shell randomization failed:', e);
  }
});
window.addEventListener('resize', debounce(() => {
  positionShellsBetween();
  const cssGap2 = getComputedStyle(document.documentElement).getPropertyValue('--shell-gap');
  const baseGap2 = cssGap2 ? parseInt(cssGap2.trim()) : 120;
  adjustShellGapDynamic(baseGap2);
}, 100));

const navToggle = document.getElementById('navToggle');
const nav = document.querySelector('.nav');

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const isVisible = getComputedStyle(nav).display === 'flex';
    nav.style.display = isVisible ? '' : 'flex';
  });
}

// Shell throw animation: when a shell button is clicked, clone it, animate it up, then navigate/scroll
document.querySelectorAll('.shell-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const href = btn.getAttribute('data-href');
    const targetSelector = btn.getAttribute('data-target');
    const target = targetSelector ? document.querySelector(targetSelector) : null;

    // create clone and absolute-position it
    // Prepare clone so it visually matches the original in position but uses untransformed (base) dimensions
    const rect = btn.getBoundingClientRect();
    const clone = btn.cloneNode(true);
    // fade original while clone animates to avoid duplicate visuals
    btn.classList.add('shell-hidden');
    btn.style.pointerEvents = 'none';

  // Prefer computed style width/height which reflect layout size (ignores CSS transforms)
  const cs = getComputedStyle(btn);
  let baseW = parseFloat(cs.width) || btn.offsetWidth;
  let baseH = parseFloat(cs.height) || btn.offsetHeight;
  // Ensure integers
  baseW = Math.round(baseW);
  baseH = Math.round(baseH);
    // Position clone so its center aligns with the original's visual center
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const left = Math.round(centerX - baseW / 2);
    const top = Math.round(centerY - baseH / 2);

    clone.style.transform = 'none';
    clone.style.position = 'fixed';
    clone.style.left = left + 'px';
    clone.style.top = top + 'px';
    clone.style.width = baseW + 'px';
    clone.style.height = baseH + 'px';
    // ensure the clone doesn't accidentally inherit transformed children styles
    clone.style.boxSizing = cs.boxSizing || 'border-box';
    // reset transforms on inner elements that might have inline styles copied from the original
    try {
      clone.querySelectorAll && clone.querySelectorAll('*').forEach(n => { n.style && (n.style.transform = 'none'); });
    } catch (e) {}
    clone.style.margin = '0';
  // We'll compute a throw animation duration that matches a clipped splash audio length.
  // Helper to play the splash but clip it so it ends ~clipSubtractMs earlier (with a small fade)
  function playClippedAudio(id, clipSubtractMs = 2000, minClipMs = 300, fadeMs = 200) {
    return new Promise((resolve) => {
      const a = AudioManager.cache.get(id);
      if (!a) {
        // fallback to simple play
        try { AudioManager.play(id, { restart:true }); } catch(e){}
        // resolve after a short default
        return setTimeout(resolve, minClipMs + 100);
      }

      // when metadata isn't available, use a reasonable default clip length
      const schedulePlay = () => {
        const dur = (a.duration && !isNaN(a.duration) && a.duration > 0) ? Math.round(a.duration * 1000) : null;
        let clipMs = dur ? Math.max(minClipMs, dur - clipSubtractMs) : Math.max(minClipMs, 600);
        if (clipMs < minClipMs) clipMs = minClipMs;
        // ensure fade doesn't exceed clip length
        const fadeLength = Math.min(fadeMs, Math.floor(clipMs / 2));

        try {
          a.currentTime = 0;
        } catch (e) {}
        try { a.volume = (typeof a._origVolume === 'number') ? a._origVolume : a.volume; } catch(e){}
        const p = a.play();
        if (p && p.then) p.catch(()=>{});

        // schedule fade start and pause
        const fadeStart = Math.max(0, clipMs - fadeLength);
        const fadeStep = 50; // ms interval
        let fadeTimer = null;

        const doPause = () => {
          try { if (fadeTimer) clearInterval(fadeTimer); } catch(e){}
          try { a.pause(); a.currentTime = 0; } catch(e){}
          // restore original volume
          try { if (typeof a._origVolume === 'number') a.volume = a._origVolume; } catch(e){}
          resolve(clipMs);
        };

        // start fade shortly before clip end
        setTimeout(() => {
          try {
            // store original volume
            if (typeof a._origVolume !== 'number') a._origVolume = a.volume;
            const startVol = a.volume;
            const steps = Math.max(1, Math.ceil(fadeLength / fadeStep));
            let step = 0;
            fadeTimer = setInterval(() => {
              step++;
              const t = step / steps;
              try { a.volume = Math.max(0, startVol * (1 - t)); } catch(e){}
              if (step >= steps) {
                clearInterval(fadeTimer);
                doPause();
              }
            }, fadeStep);
          } catch (e) { doPause(); }
        }, fadeStart);

        // Safety: ensure we resolve after clipMs + 300ms in case fade/pause failed
        setTimeout(() => { try { resolve(clipMs); } catch(e){} }, clipMs + 500);
      };

      if (a.readyState >= 1 && a.duration && !isNaN(a.duration)) schedulePlay();
      else {
        // wait for metadata then schedule
        const onMeta = () => { try { a.removeEventListener('loadedmetadata', onMeta); } catch(e){}; schedulePlay(); };
        try { a.addEventListener('loadedmetadata', onMeta); } catch(e){ schedulePlay(); }
        // as a fallback in case loadedmetadata never fires
        setTimeout(() => { try { schedulePlay(); } catch(e){} }, 800);
      }
    });
  }

  // Determine throw animation duration based on clipped audio length (will be set later when we know clip length)
  let THROW_ANIM_MS = 600; // temporary default - updated once clip duration is known
  clone.style.transition = `transform ${THROW_ANIM_MS}ms cubic-bezier(.2,.8,.2,1), left ${THROW_ANIM_MS}ms, top ${THROW_ANIM_MS}ms, opacity .6s`;
    clone.style.zIndex = 9999;
    clone.style.pointerEvents = 'none';
    document.body.appendChild(clone);

  // Play a clipped version of the splash and use its effective clip duration to drive the throw timing
  let clipMsPromise = Promise.resolve(600);
  try {
    // start clipped playback immediately (the helper starts playback) and return a promise for clip length
    clipMsPromise = playClippedAudio('shell-splash', 2000, 300, 200);
  } catch(e) { try { AudioManager.play('shell-splash', { restart:true }); } catch(e){} }

  // Estimate clip length now so we can start the animation immediately (2s earlier behavior)
  try {
    const a = AudioManager.cache.get('shell-splash');
    const durMs = (a && a.duration && !isNaN(a.duration)) ? Math.round(a.duration * 1000) : null;
    const estClip = durMs ? Math.max(300, durMs - 2000) : 600;
    const margin = 80;
    THROW_ANIM_MS = Math.max(200, estClip - margin);
    clone.style.transition = `transform ${THROW_ANIM_MS}ms cubic-bezier(.2,.8,.2,1), left ${THROW_ANIM_MS}ms, top ${THROW_ANIM_MS}ms, opacity .6s`;
  } catch(e) {
    THROW_ANIM_MS = 600;
    clone.style.transition = `transform ${THROW_ANIM_MS}ms cubic-bezier(.2,.8,.2,1), left ${THROW_ANIM_MS}ms, top ${THROW_ANIM_MS}ms, opacity .6s`;
  }

  // Start animation immediately (2s earlier than waiting for clip metadata)
  requestAnimationFrame(() => {
    clone.classList.add('throwing');
    clone.style.left = '50%';
    clone.style.top = '8%';
    clone.style.transform = 'translate(-50%,-10%)';
    clone.style.opacity = '1';
  });

  // After animation completes, clean up clone and then navigate/scroll (allow SFX a short window to finish)
  setTimeout(async () => {
    try {
      // fade out clone
      clone.style.opacity = '0';
      await new Promise(r => setTimeout(r, 400));
      try { clone.remove(); } catch(e) {}

      // restore original button visibility and pointer events
      try { btn.classList.remove('shell-hidden'); btn.style.pointerEvents = ''; } catch(e) {}

      if (href) {
        // Wait up to 2s for splash SFX to finish (or proceed sooner)
        await waitForSfx(['shell-splash'], 2000);
        try {
          const linkUrl = new URL(href, window.location.href);
          if (linkUrl.origin === window.location.origin) pjaxNavigate(linkUrl.href);
          else window.location.href = href;
        } catch(e) { window.location.href = href; }
      } else if (target) {
        target.scrollIntoView({behavior:'smooth', block:'start'});
      }
    } catch (e) { console.error(e); }
  }, THROW_ANIM_MS);

  // avoid unhandled rejections
  clipMsPromise.catch(()=>{});
  });
});

// Play shell-hover sound on pointerenter (non-looping)
document.querySelectorAll('.shell-btn').forEach(btn => {
  btn.addEventListener('pointerenter', () => {
    try { AudioManager.play('shell-hover', { restart:true }); } catch(e){}
  }, { passive:true });
});

// Intercept navigation (anchor clicks and form submissions) to allow short SFX to finish
// PJAX navigation + Intercept navigation (anchor clicks and form submissions) to allow short SFX to finish
(function interceptNavigationForSfx(){
  // Only intercept same-window navigation via <a href> and forms; external links or modified clicks should bypass
  function isModifiedClick(ev){ return ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey || ev.button !== 0; }

  document.addEventListener('click', async (ev) => {
    try {
      if (isModifiedClick(ev)) return; // let user open in new tab
      const a = ev.target.closest && ev.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      // external origin or download -> don't intercept
      const linkUrl = new URL(href, window.location.href);
      if (linkUrl.origin !== window.location.origin) return;

  // Prevent default and attempt PJAX navigation so audio element can remain in DOM
  ev.preventDefault();
  // give currently playing short SFX a chance to finish (shell-splash, logo-sparkle)
  await waitForSfx(['shell-splash','logo-sparkle'], 1500);
  // Use PJAX navigation for same-origin in-site links
  try { pjaxNavigate(linkUrl.href); } catch(e) { window.location.href = linkUrl.href; }
    } catch (e) {}
  }, { passive:false });

  // Forms: intercept submit and delay (same-origin only)
  document.addEventListener('submit', async (ev) => {
    try {
      const form = ev.target;
      if (!form || !(form instanceof HTMLFormElement)) return;
      // only handle same-origin action or empty (current page)
      const action = form.getAttribute('action') || window.location.href;
      const actionUrl = new URL(action, window.location.href);
      if (actionUrl.origin !== window.location.origin) return;
      ev.preventDefault();
      await waitForSfx(['shell-splash','logo-sparkle'], 1500);
      // For forms we fallback to normal submit after delay so server-side actions proceed
      form.submit();
    } catch (e) {}
  }, { passive:false });
})();

// --- Simple PJAX implementation: fetch page, replace <main>, update title and history ---
async function pjaxNavigate(url, replaceState = false){
  try{
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) { window.location.href = url; return; }
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const newMain = doc.querySelector('main');
    const curMain = document.querySelector('main');
    if (newMain && curMain) {
      // Replace current main with new main content while preserving the audio element and other globals
      curMain.replaceWith(newMain);
      // Dispatch event so modules can re-initialize if needed
      window.dispatchEvent(new CustomEvent('content:replace', { detail: { url } }));
    }
    // Update document title
    const newTitle = doc.querySelector('title');
    if (newTitle) document.title = newTitle.textContent;
    // Update history
    if (replaceState) history.replaceState({}, '', url); else history.pushState({}, '', url);
  } catch (e) {
    console.error('PJAX failed, falling back to full navigation', e);
    window.location.href = url;
  }
}

// handle back/forward
window.addEventListener('popstate', (ev) => {
  // load the current location via PJAX (replace state)
  pjaxNavigate(location.href, true);
});

// Logo sparkle particle effect: spawn small particle divs on hover/focus
/* Logo sparkle particle effect: attach to all elements matching .site-logo or .page-logo
   This keeps behavior consistent across index and interior pages. Each element manages
   its own recurring interval so multiple logos (rare) won't conflict. */
(function(){
  // Keep a live reference function that finds logos when called (handles dynamic pages)
  function findLogos(){ return Array.from(document.querySelectorAll('.site-logo, .page-logo')); }

  function spawnSparklesAt(el, count, duration = 15000){
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    for (let i = 0; i < count; i++){
      const startDelay = Math.random() * 220;
      setTimeout(() => {
        const s = document.createElement('div');
        s.className = 'logo-sparkle';
        const size = 4 + Math.floor(Math.random() * 3); // 4..6px
        s.style.width = size + 'px';
        s.style.height = size + 'px';
        s.style.left = (centerX - size/2) + 'px';
        s.style.top = (centerY - size/2) + 'px';
        s.style.opacity = '1';
        document.body.appendChild(s);

        const deg = (Math.random() * 60 - 30) * (Math.PI / 180);
        const minDist = 80;
        const maxDist = 300;
        const dist = minDist + Math.random() * (maxDist - minDist);

        const palette = Math.floor(Math.random() * 3);
        if (palette === 1) {
          s.style.background = 'radial-gradient(circle at 50% 50%, #ffffff 0px, #ffffff 2px, rgba(189,230,255,0.95) 30%, rgba(130,200,255,0.6) 60%, rgba(130,200,255,0) 85%)';
          s.style.boxShadow = '0 0 2px #ffffff, 0 0 10px rgba(120,190,255,0.95), 0 0 30px rgba(60,150,255,0.55)';
        } else if (palette === 2) {
          s.style.background = 'radial-gradient(circle at 50% 50%, #ffffff 0px, #ffffff 2px, rgba(191,255,199,0.95) 30%, rgba(160,255,160,0.6) 60%, rgba(160,255,160,0) 85%)';
          s.style.boxShadow = '0 0 2px #ffffff, 0 0 10px rgba(160,255,160,0.95), 0 0 30px rgba(100,230,120,0.55)';
        } else {
          s.style.background = 'radial-gradient(circle at 50% 50%, #ffffff 0px, #ffffff 2px, rgba(255,250,230,0.95) 30%, rgba(255,235,200,0.6) 60%, rgba(255,235,200,0) 85%)';
          s.style.boxShadow = '0 0 2px #ffffff, 0 0 10px rgba(255,235,200,0.95), 0 0 30px rgba(255,200,120,0.55)';
        }

        const dx = Math.sin(deg) * dist;
        const dy = Math.cos(deg) * dist;
        const dur = Math.max(8000, Math.round(duration + (Math.random() * 4000 - 2000)));

        s.classList.add('logo-sparkle--pulse');
        const sway = (Math.random() * 10) - 5;
        const rotate = (Math.random() * 80) - 40;
        const anim = s.animate([
          { transform: 'translate(0px, 0px) rotate(0deg) scale(1)', opacity: 1 },
          { transform: `translate(${dx/2 + sway}px, ${dy/2}px) rotate(${rotate/2}deg) scale(0.9)`, opacity: 0.95, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${rotate}deg) scale(0.35)`, opacity: 0 }
        ], { duration: dur, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'forwards' });

        anim.onfinish = () => { try { s.remove(); } catch (e) {} };
      }, startDelay);
    }
  }

  function attachHandlersTo(el){
    if (!el || el.dataset.__sparkleAttached) return;
    el.dataset.__sparkleAttached = '1';
    let sparkleInterval = null;
    function startSparks(){
      spawnSparklesAt(el, 12, 15000);
      sparkleInterval = setInterval(() => spawnSparklesAt(el, 4, 14000), 1200);
      try { AudioManager.play('logo-sparkle', { restart:true }); } catch(e){}
    }
    function stopSparks(){ if (sparkleInterval) { clearInterval(sparkleInterval); sparkleInterval = null; } }
    // pointer events work for mouse/touch/pen and are more reliable for interactive elements
    el.addEventListener('pointerenter', startSparks);
    el.addEventListener('pointerleave', stopSparks);
    el.addEventListener('focus', startSparks, true);
    el.addEventListener('blur', stopSparks, true);
    // helpful debug marker for devtools (non-invasive)
    try { console.debug('sparkle: attached to', el); } catch (e) {}
  }

  // Initial attach for any logos already in the DOM
  findLogos().forEach(attachHandlersTo);

  // Fallback: if logos are added later (templating, late injection), watch for them and attach handlers
  const mo = new MutationObserver((records) => {
    for (const rec of records){
      if (!rec.addedNodes) continue;
      rec.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches && node.matches('.site-logo, .page-logo')) attachHandlersTo(node);
        // also check descendants
        node.querySelectorAll && node.querySelectorAll('.site-logo, .page-logo').forEach(attachHandlersTo);
      });
    }
  });
  mo.observe(document.documentElement || document.body, { childList: true, subtree: true });

  // Backwards-compatible helper:
  // - spawnLogoSparkles(count,duration) -> targets first .site-logo or first matched logo
  // - spawnLogoSparkles(selectorOrElement, count, duration) -> explicit target
  window.spawnLogoSparkles = function(a = 12, b = 15000, c){
    // signature: (count, duration)
    if (typeof a === 'number'){
      const count = a;
      const duration = (typeof b === 'number') ? b : 15000;
      const el = document.querySelector('.site-logo') || logos[0];
      if (el) spawnSparklesAt(el, count, duration);
      return;
    }
    // signature: (selectorOrElement, count, duration)
    let el = null; let count = b || 12; let duration = c || 15000;
    if (typeof a === 'string') el = document.querySelector(a);
    else if (a instanceof Element) el = a;
    if (!el) el = document.querySelector('.site-logo') || logos[0];
    if (el) spawnSparklesAt(el, count, duration);
  };
})();

/* Footprint canvas: spawn footprint shapes following the cursor and expire after 3s */
(function(){
  const canvas = document.getElementById('footprint-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let dpr = window.devicePixelRatio || 1;
  let w = 0, h = 0;
  const footprints = []; // {x,y,angle,mirror,ts}
  const baseMinStride = 96; // base px between footprints (desktop). Will be scaled by --footprint-scale
  let lastX = -9999, lastY = -9999, mirror = 0;

  function resize(){
    dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  window.addEventListener('resize', resize);

  function addFoot(x,y,angle){
    const now = performance.now();
    mirror += 1;
    footprints.push({x,y,angle,mirror,ts:now});
  }

  // throttle pointer events to reasonable frequency
  let lastAdd = 0;
  window.addEventListener('pointermove', (ev) => {
    // do not create footprints when pointer is over the waves area
    const wavesEl = document.querySelector('.waves-wrapper');
    if (wavesEl) {
      const wr = wavesEl.getBoundingClientRect();
      if (ev.clientY <= wr.bottom) return;
    }

    const x = ev.clientX;
    const y = ev.clientY;
    // compute runtime stride scaled by CSS footprint-scale so spacing follows visual size
    const footprintScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--footprint-scale')) || 1;
    const minStride = baseMinStride * footprintScale;
    const dist = Math.hypot(x - lastX, y - lastY);
    if (dist > minStride) {
      const angle = Math.atan2(y - lastY || 0, x - lastX || 0) + Math.PI/2;
      addFoot(x, y, angle);
      lastX = x; lastY = y;
      lastAdd = performance.now();
    }
  }, {passive:true});

  function drawFoot(f, age){
  // age: ms since spawn, use to fade: 0..1000
  const alpha = Math.max(0, 1 - age/1000);
  ctx.save();
  // compute lateral offset (perpendicular to direction) so left/right feet separate horizontally
  const footprintScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--footprint-scale')) || 1;
  const gapPx = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--footprint-gap')) || 20) * footprintScale;
  // perpendicular vector to angle
  const perpX = Math.cos((f.angle || 0) - Math.PI/2);
  const perpY = Math.sin((f.angle || 0) - Math.PI/2);
  // mirror decides which side; apply half-gap in each direction
  const lateral = (f.mirror % 2 === 0) ? -gapPx/2 : gapPx/2;
  ctx.translate(f.x + perpX * lateral, f.y + perpY * lateral);
  ctx.rotate(f.angle || 0);
  // base footprint reference sizes from the original p5 code
  const footprintBaseWidth = 235; // ballWidth in reference
  const footprintSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--footprint-size')) || 24;
  let s = footprintSize / footprintBaseWidth;
  // apply the runtime footprint scale (desktop=1, tablet=0.5, phone=0.25)
  s = s * footprintScale;
  ctx.scale(s, s);
  // when mirrored we already offset laterally above; keep drawing orientation consistent
  if (f.mirror % 2 === 0) ctx.scale(-1,1);

    // points from the reference makeFootPrint (kept in same relative coordinates)
    const footCenterX = 180;
    const bridgeY = 300;
    const pts = [];
    pts.push({x: footCenterX + 10, y: bridgeY - 1.72 * 200});
    pts.push({x: footCenterX - 235 / 2.0 + 35, y: bridgeY - 1.7 * 200});
    pts.push({x: footCenterX - 235 / 2.0, y: bridgeY - 1.2 * 200});
    pts.push({x: footCenterX - 150 / 2.0 + 15, y: bridgeY - 70});
    pts.push({x: footCenterX - 160 / 2.0, y: bridgeY + 100});
    pts.push({x: footCenterX - 80 / 2.0, y: bridgeY + 185});
    pts.push({x: footCenterX + 80 / 2.0, y: bridgeY + 185});
    pts.push({x: footCenterX + 160 / 2.0, y: bridgeY + 120});
    pts.push({x: footCenterX + 150 / 2.0 + 10, y: bridgeY - 20});
    pts.push({x: footCenterX + 235 / 2.0, y: bridgeY - 200});
    pts.push({x: footCenterX + 235 / 2.0 - 30, y: bridgeY - 1.45 * 200});

    // convert points to local coordinates (center around 0,0)
    const local = pts.map(p => ({x: p.x - footCenterX, y: p.y - bridgeY}));

    // stroke + fill using sand-like colors and alpha based on age
      // Make footprints lighter: slightly paler fill and reduced stroke alpha so prints read softer on the sand
      ctx.fillStyle = `rgba(244,219,180,${0.75 * alpha})`;
      ctx.strokeStyle = `rgba(0,0,0,${0.06 * alpha})`;
    ctx.lineWidth = 2;

    // draw smooth closed curve using quadratic interpolation
    ctx.beginPath();
    // move to last point to emulate the curveVertex wrap in p5
    const last = local[local.length - 1];
    ctx.moveTo(last.x, last.y);
    for (let i = 0; i < local.length; i++){
      const p = local[i];
      const next = local[(i+1) % local.length];
      const cx = (p.x + next.x) / 2;
      const cy = (p.y + next.y) / 2;
      ctx.quadraticCurveTo(p.x, p.y, cx, cy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function frame(){
    ctx.clearRect(0,0,w,h);
    const now = performance.now();
    // draw and keep footprints younger than 1s
    for (let i = footprints.length - 1; i >= 0; i--) {
      const f = footprints[i];
      const age = now - f.ts;
  if (age > 1000) {
        footprints.splice(i,1);
        continue;
      }
      drawFoot(f, age);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();