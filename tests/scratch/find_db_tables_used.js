const fs = require('fs');
['assets/js/dispatch-ui.js', 'assets/js/orders.js', 'assets/js/dispatch.js', 'assets/js/supply-chain-transfers.js', 'assets/js/intercompany.js'].forEach(f => {
  if (fs.existsSync(f)) {
    const c = fs.readFileSync(f, 'utf-8');
    const matches = c.match(/from\(['"][a-zA-Z0-9_-]+['"]\)/g);
    console.log(f, 'tables:', [...new Set(matches)]);
  }
});
