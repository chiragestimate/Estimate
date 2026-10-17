const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '../../pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

files.forEach(f => {
  const content = fs.readFileSync(path.join(pagesDir, f), 'utf8');
  const links = [...content.matchAll(/href=["']([^"']+\.css(?:\?[^"']*)?)["']/g)].map(m => m[1]);
  console.log(f + ': ' + links.join(', '));
});
