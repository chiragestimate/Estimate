const fs = require('fs');
['pages/warehouses.html', 'pages/orders.html'].forEach(f => {
  const html = fs.readFileSync(f, 'utf-8');
  const lines = html.split('\n');
  console.log('=== ' + f + ' ===');
  lines.forEach((l, i) => {
    if (l.includes('modal-overlay') || l.includes('class="modal')) {
      console.log((i+1) + ': ' + l.trim());
    }
  });
});
