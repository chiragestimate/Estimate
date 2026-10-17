const fs = require('fs');
const path = require('path');

const jsFiles = ['assets/js/production.js', 'assets/js/orders.js', 'assets/js/intercompany.js', 'assets/js/accounting-core.js', 'assets/js/audit-logs.js', 'assets/js/inventory.js'];

jsFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const matches = [...content.matchAll(/from\(['"]([a-z0-9_]+)['"]\)/gi)].map(m => m[1]);
    console.log(file, '->', [...new Set(matches)]);
  }
});
