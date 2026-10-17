const fs = require('fs');
const path = require('path');
const pagesDir = path.join(process.cwd(), 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
files.forEach(f => {
  const c = fs.readFileSync(path.join(pagesDir, f), 'utf8');
  const m = c.match(/<div class="page-header[^"]*"[\s\S]*?<\/div>\s*<\/div>/);
  if (m) {
    const headText = m[0].split('\n').slice(0, 4).map(l => l.trim()).join(' ');
    console.log(f + ': ' + headText.slice(0, 120));
  } else {
    console.log(f + ': [NO .page-header]');
  }
});
