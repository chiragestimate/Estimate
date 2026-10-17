const fs = require('fs');
const path = require('path');
const pagesDir = path.join(process.cwd(), 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

console.log('Found ' + files.length + ' pages in pages/:');
files.forEach(f => {
  const content = fs.readFileSync(path.join(pagesDir, f), 'utf8');
  const title = (content.match(/<title>(.*?)<\/title>/i) || [])[1] || '';
  const tables = (content.match(/<table[^>]*id="([^"]+)"/g) || []).map(m => m.match(/id="([^"]+)"/)[1]);
  const selects = (content.match(/<select[^>]*>/g) || []).length;
  const modals = (content.match(/class="[^"]*modal-overlay[^"]*"/g) || []).length;
  const cards = (content.match(/class="[^"]*\bcard\b[^"]*"/g) || []).length;
  const toolbars = (content.match(/class="[^"]*table-toolbar[^"]*"/g) || []).length;
  console.log(`- ${f}:
    Title: ${title}
    Tables: [${tables.join(', ')}]
    Selects: ${selects} | Modals: ${modals} | Cards: ${cards} | Toolbars: ${toolbars}`);
});
