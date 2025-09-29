const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '..', 'projects.html');
const src = fs.readFileSync(p, 'utf8');

const begin = '<!-- BEGIN GENERATED STATIC FRAGMENT -->';
const end = '<!-- END GENERATED STATIC FRAGMENT -->';
if (!src.includes(begin) || !src.includes(end)) {
  console.error('Generated fragment markers not found in projects.html');
  process.exit(2);
}

const frag = src.split(begin)[1].split(end)[0];

if (!frag.includes('<div id="category-grid"')) {
  console.error('Missing <div id="category-grid" inside generated fragment');
  process.exit(3);
}

// try to compile the first inline <script> inside the fragment (syntax-only)
const scriptMatch = frag.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
if (scriptMatch) {
  const script = scriptMatch[1];
  try {
    // new Function compiles the script without executing browser-specific calls
    new Function(script);
    console.log('OK: inline script compiles (syntax check passed)');
  } catch (err) {
    console.error('Syntax error compiling generated inline script:');
    console.error(err && err.stack ? err.stack : err);
    process.exit(4);
  }
} else {
  console.log('No inline <script> found in generated fragment — nothing to syntax-check');
}

console.log('Validation passed');
