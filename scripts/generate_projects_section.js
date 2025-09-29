const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const projectsHtmlPath = path.join(repoRoot, 'projects.html');
const outPath = path.join(__dirname, 'generated_projects_section.html');

function slugify(name){ return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

const PREFERRED_CATEGORIES = [
  'Featured','Graphic Design','UI/UX Design','XR Design','Motion Graphics Design','Creative Computing','Storytelling'
];

const src = fs.readFileSync(projectsHtmlPath, 'utf8');
const startMarker = 'const PROJECTS_DATA';
const start = src.indexOf(startMarker);
if(start === -1){ console.error('PROJECTS_DATA not found'); process.exit(1); }
const arrStart = src.indexOf('[', start);
const arrEnd = src.indexOf('];', arrStart);
if(arrStart === -1 || arrEnd === -1){ console.error('Could not find array bounds'); process.exit(1); }
const arrText = src.slice(arrStart, arrEnd+1);

let data;
try{
  // evaluate safely in a new function scope
  data = (new Function('return ' + arrText))();
} catch(e){ console.error('Failed to parse PROJECTS_DATA:', e); process.exit(1); }

// Normalize into list of projects with slug
const projects = data.map(p=>{
  const slug = (p.slug && p.slug.toString().trim()) ? p.slug.toString().trim() : (slugify(p['Project Name']) + '-' + p.row);
  return Object.assign({}, p, { _slug: slug });
});

// collect categories set
const categories = new Set();
projects.forEach(p => { if(p.Featured && p.Featured.toString().toLowerCase().trim()==='yes') categories.add('Featured'); if(p.Category) categories.add(p.Category.trim()); });

// build ordered chips
const known = Array.from(categories).filter(Boolean);
const chipsOrder = [];
PREFERRED_CATEGORIES.forEach(c=>{ if(c === 'Featured') { if(known.includes('Featured')) chipsOrder.push('Featured'); } else if(known.includes(c)){ chipsOrder.push(c); }
  const idx = known.indexOf(c); if(idx!==-1) known.splice(idx,1);
});
// append remaining
known.sort().forEach(c=> chipsOrder.push(c));

function escapeHtml(s){ if(!s && s!==0) return ''; return s.toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// build chips html
let chipsHtml = '';
chipsOrder.forEach((c,i)=>{
  const label = escapeHtml(c);
  chipsHtml += `<button class="chip" type="button" data-category="${label}" aria-pressed="false">${label}</button>` + '\n';
});

// build cards html
let cardsHtml = '';
projects.forEach(p=>{
  const title = escapeHtml(p['Project Name']||p['ProjectName']||'Untitled');
  const slug = p._slug;
  const href = 'projects/' + slug + '.html';
  const tagsRaw = (p['Tags']||'').toString();
  const tagList = tagsRaw.split(/\n|,/).map(t=>t.trim()).filter(Boolean);
  const tagHtml = tagList.map(t=> `<span class="tag-pill">${escapeHtml(t)}</span>`).join(' ');

  let metaType = 'Individual';
  if(typeof p['Team'] !== 'undefined'){
    const tv = (p['Team']||'').toString().trim();
    metaType = (tv === '-' || tv === '') ? 'Individual' : 'Group';
  }
  const duration = (p['Duration'] && p['Duration'].toString().trim() && p['Duration'].toString().trim() !== '-') ? p['Duration'].toString().trim() : (p['Time']||'');
  const metaLine = duration ? (metaType + ' · ' + escapeHtml(duration)) : escapeHtml(metaType);

  const category = escapeHtml((p.Category||'').toString());
  const featured = (p.Featured && p.Featured.toString().toLowerCase().trim()==='yes') ? 'true' : 'false';

  const excerpt = escapeHtml((p['Project Brief']||p['ProjectBrief']||'').toString()).replace(/\n/g,'<br>');

  cardsHtml += `
<a class="card-link" href="${href}" data-category="${category}" data-featured="${featured}" aria-label="${title}">
  <article class="card">
    <img src="assets/project1.svg" alt="${title}">
    <div class="card-body">
      <h3>${title}</h3>
      ${ tagList.length ? `<div class="tag-list">${tagHtml}</div>` : '' }
      <div class="project-meta">${metaLine}</div>
      ${ excerpt ? `<div class="card-excerpt">${excerpt}</div>` : '' }
    </div>
  </article>
</a>
`;
});

// inline script to handle chip filtering (no PROJECTS_DATA)
const filterScript = `
(function(){
  const chipsBar = document.getElementById('category-chips');
  const grid = document.getElementById('category-grid');
  function clearActive(){ Array.from(chipsBar.querySelectorAll('.chip')).forEach(c=>{ c.classList.remove('chip--active'); c.setAttribute('aria-pressed','false'); }); }
  function setCategoryInURL(name){ try{ const url = new URL(window.location.href); url.searchParams.set('category', name); window.history.replaceState(null,'', url.toString()); }catch(e){}
  }
  function getCategoryFromURL(){ try{ const params = new URLSearchParams(window.location.search); return params.get('category'); }catch(e){ return null; } }
  function showCategory(name){ const cards = Array.from(grid.querySelectorAll('.card-link'));
    if(name === 'Featured'){
      cards.forEach(c=>{ if(c.dataset.featured === 'true'){ c.style.display='block'; } else { c.style.display='none'; } });
    } else {
      cards.forEach(c=>{ if(c.dataset.category === name){ c.style.display='block'; } else { c.style.display='none'; } });
    }
  }
  // attach events
  chipsBar.querySelectorAll('.chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      clearActive(); btn.classList.add('chip--active'); btn.setAttribute('aria-pressed','true');
      setCategoryInURL(btn.dataset.category);
      showCategory(btn.dataset.category);
    });
  });
  // initial
  const initial = getCategoryFromURL();
  const first = chipsBar.querySelector('.chip');
  if(initial){ const match = Array.from(chipsBar.querySelectorAll('.chip')).find(b=> b.dataset.category === initial); if(match) match.click(); else if(first) first.click(); }
  else if(first) first.click();
})();
`;

const out = `<!-- GENERATED STATIC PROJECTS SECTION: DO NOT EDIT MANUALLY -->
<div class="chips-row">
  <div id="category-chips">
${chipsHtml}
  </div>
</div>

<div id="category-grid" class="projects-grid">
${cardsHtml}
</div>

<script>
${filterScript}
</script>
`;

fs.writeFileSync(outPath, out, 'utf8');
console.log('Wrote', outPath);
