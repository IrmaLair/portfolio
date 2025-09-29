const fs = require('fs');
const path = require('path');

const projectsDir = path.resolve(__dirname, '..', 'projects');
const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.html'));

function extract(html){
  // simple extraction using regex — pages have consistent structure
  const titleMatch = html.match(/<h1[^>]*class="handwriting"[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Project';
  const metaMatch = html.match(/<div[^>]*style="color:[^\"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const meta = metaMatch ? metaMatch[1].trim() : '';
  // excerpt: first <div> after the meta (heuristic)
  const excerptMatch = html.match(/<div[^>]*style="margin-top:1.25rem;[\s\S]*?">([\s\S]*?)<\/div>/i);
  const excerpt = excerptMatch ? excerptMatch[1].trim().replace(/\n+/g,' ').replace(/\s+/g,' ') : '';
  return { title, meta, excerpt };
}

function makeCardHtml(title, meta, excerpt, relPath){
  // relPath: '.' or '..' depending on where the page sits relative to assets
  const img = `${relPath}/assets/project1.svg`;
  return `\n<div style="margin-top:1rem">\n  <a class="card-link" href="../projects.html" aria-label="${escapeHtml(title)}">\n    <article class="card">\n      <img src="${img}" alt="${escapeHtml(title)}">\n      <div class="card-body">\n        <h3>${escapeHtml(title)}</h3>\n        <div class="project-meta">${escapeHtml(meta)}</div>\n        <div class="card-excerpt">${escapeHtml(excerpt)}</div>\n      </div>\n    </article>\n  </a>\n</div>\n`;
}

function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

files.forEach(file => {
  const p = path.join(projectsDir, file);
  let html = fs.readFileSync(p, 'utf8');
  const { title, meta, excerpt } = extract(html);
  // find shell button (open projects) and insert after it
  const shellIndex = html.indexOf('<button class="shell-btn"');
  if(shellIndex === -1){ console.warn('no shell button in', file); return; }
  const insertPoint = html.indexOf('</button>', shellIndex);
  if(insertPoint === -1){ console.warn('malformed shell in', file); return; }
  const relPath = '..';
  const cardHtml = makeCardHtml(title, meta, excerpt, relPath);
  const newHtml = html.slice(0, insertPoint+9) + cardHtml + html.slice(insertPoint+9);
  fs.writeFileSync(p, newHtml, 'utf8');
  console.log('Updated', file);
});
