// Compact tag overflow helper — collapse extra .tag-pill inside .tag-list into a +N button
(function(){
  'use strict';
  function adjustTagOverflow(card){
    const tagsWrap = card.querySelector('.tag-list');
    if(!tagsWrap) return;
    // remove existing + buttons
    const existingPlus = tagsWrap.querySelector('.tag-pill.tag-plus'); if(existingPlus) existingPlus.remove();
    const pills = Array.from(tagsWrap.querySelectorAll('.tag-pill'));
    if(pills.length <= 3) return; // cheap heuristic, skip small sets

    // measure available width
    const available = tagsWrap.clientWidth - 8; // small padding
    // accumulate width until overflow
    let used = 0; let lastIndex = pills.length -1;
    const widths = pills.map(p => { const w = p.offsetWidth + parseFloat(getComputedStyle(p).marginRight||0); return w; });
    for(let i=0;i<widths.length;i++){
      if(used + widths[i] > available){ lastIndex = i-1; break; }
      used += widths[i];
    }
    if(lastIndex >= pills.length -1) return; // all fit

    const extra = pills.length - (lastIndex+1);
    // remove extra pills
    for(let i=pills.length-1;i>lastIndex;i--) pills[i].remove();

    // create plus button
    const plus = document.createElement('button'); plus.type='button'; plus.className='tag-pill tag-plus'; plus.textContent = '+' + extra;
    plus.setAttribute('aria-expanded','false'); plus.setAttribute('aria-haspopup','dialog');
    tagsWrap.appendChild(plus);

    // build popover content lazily
    plus.addEventListener('click', (e)=>{
      if(plus.getAttribute('aria-expanded') === 'true'){ closePopover(); return; }
      openPopover();
    });

    function openPopover(){
      closePopover();
      const pop = document.createElement('div'); pop.className='tag-popover'; pop.setAttribute('role','dialog'); pop.setAttribute('aria-label','Additional tags');
      const list = document.createElement('div'); list.className='tag-popover-list';
      // remaining tags were removed from DOM earlier; we reconstruct from original pills array
      const remaining = pills.slice(lastIndex+1).map(p=>p.textContent);
      remaining.forEach(t=>{ const s = document.createElement('span'); s.className='tag-pill'; s.textContent = t; s.style.display='inline-block'; s.style.margin='0 6px 6px 0'; list.appendChild(s); });
      pop.appendChild(list);
      document.body.appendChild(pop);
      const r = plus.getBoundingClientRect();
      pop.style.position='absolute'; pop.style.zIndex = 9999;
      pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left)) + 'px';
      pop.style.top = (r.bottom + 8) + 'px';
      plus.setAttribute('aria-expanded','true');

      function outside(e){ if(!pop.contains(e.target) && e.target !== plus) closePopover(); }
      function esc(e){ if(e.key === 'Escape') closePopover(); }
      setTimeout(()=>{ document.addEventListener('click', outside); document.addEventListener('keydown', esc); },0);
      plus._cleanup = ()=>{ document.removeEventListener('click', outside); document.removeEventListener('keydown', esc); };
    }

    function closePopover(){ const ex = document.querySelector('.tag-popover'); if(ex) ex.remove();
      Array.from(document.querySelectorAll('.tag-plus[aria-expanded]')).forEach(b=>b.setAttribute('aria-expanded','false'));
    }
  }

  // run for all cards on DOMContentLoaded
  function runAll(){ Array.from(document.querySelectorAll('.card-link')).forEach(card=> adjustTagOverflow(card)); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runAll); else runAll();

  // re-run on window resize (debounced)
  let t; window.addEventListener('resize', ()=>{ clearTimeout(t); t = setTimeout(runAll, 150); });

})();
