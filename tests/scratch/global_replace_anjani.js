const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (typeof from === 'string') {
      if (content.includes(from)) {
        content = content.split(from).join(to);
        changed = true;
      }
    } else if (from instanceof RegExp) {
      if (from.test(content)) {
        content = content.replace(from, to);
        changed = true;
      }
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated: ${filePath}`);
  }
}

// 1. 404.html
replaceInFile('404.html', [
  ['Anjani Agri Care', 'Afield Crop Care'],
  ['Anjani ERP', 'Afield ERP'],
  ['Anjani', 'Afield']
]);

// 2. pages/intercompany.html
replaceInFile('pages/intercompany.html', [
  ['Stock Owned by Anjani', 'Stock Owned by Afield Crop Care'],
  ['Consignment Stock (Owned by Anjani)', 'Consignment Stock (Owned by Afield Crop Care)'],
  ['Anjani Agri Care', 'Afield Crop Care'],
  ['Anjani', 'Afield']
]);

// 3. pages/user-roles.html
replaceInFile('pages/user-roles.html', [
  ['user@anjani.local', 'user@afield.local'],
  ['Anjani Agri Care', 'Afield Crop Care'],
  ['Anjani', 'Afield']
]);

// 4. assets/js/intercompany.js & intercompany-core.js
const icReplacements = [
  ['Anjani Coragen-80 Ec', 'Afield Coragen-80 Ec'],
  ['Anjani Chlor-20 Ec', 'Afield Chlor-20 Ec'],
  ['Anjani Profe-40 Ec', 'Afield Profe-40 Ec'],
  ['Anjani Thio-60 Ec', 'Afield Thio-60 Ec'],
  ['legally owned by Anjani Agri Care', 'legally owned by Afield Crop Care'],
  ['legally owned by Anjani', 'legally owned by Afield Crop Care'],
  ['Owned by Anjani', 'Owned by Afield Crop Care'],
  ['Anjani Agri Care', 'Afield Crop Care']
];
replaceInFile('assets/js/intercompany.js', icReplacements);
replaceInFile('assets/js/intercompany-core.js', icReplacements);

// 5. assets/js/user-roles.js
replaceInFile('assets/js/user-roles.js', [
  ['Anjani Administrator', 'Afield Administrator'],
  ['Anjani Director', 'Afield Director'],
  ['Anjani Agri Care', 'Afield Crop Care'],
  ['@anjani.local', '@afield.local']
]);

// 6. assets/js/dispatch-ui.js
replaceInFile('assets/js/dispatch-ui.js', [
  ['alt="Anjani Agri Care"', 'alt="Afield Crop Care"'],
  ['Anjani Agri Care', 'Afield Crop Care']
]);

// 7. Invoice Builder HTML & JS
const ibFiles = [
  'Invoice Builder/history.html',
  'apps/Invoice Builder/history.html',
  'Invoice Builder/master.html',
  'apps/Invoice Builder/master.html',
  'Invoice Builder/package.json',
  'apps/Invoice Builder/package.json',
  'Invoice Builder/js/api.js',
  'apps/Invoice Builder/js/api.js',
  'Invoice Builder/js/history.js',
  'apps/Invoice Builder/js/history.js',
  'Invoice Builder/js/master.js',
  'apps/Invoice Builder/js/master.js',
  'Invoice Builder/db.json',
  'apps/Invoice Builder/db.json'
];

ibFiles.forEach(f => {
  replaceInFile(f, [
    ['Anjani Agri Care', 'Afield Crop Care'],
    ['Anjani ERP', 'Afield ERP']
  ]);
});

// 8. Auth / Audit / Notification / Accounting JS files
const authFiles = [
  'assets/js/accounting-core.js',
  'assets/js/audit-logger.js',
  'assets/js/audit-logs.js',
  'assets/js/notification-service.js',
  'assets/js/rbac-context.js',
  'assets/js/transactions.js'
];

authFiles.forEach(f => {
  replaceInFile(f, [
    ['@anjani.local', '@afield.local'],
    ['@anjani.test', '@afield.test'],
    ['Anjani Agri Care', 'Afield Crop Care']
  ]);
});

// 9. Scan all pages/*.html and assets/js/*.js for any remaining Anjani
function scanAndReplace(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'backups' || file === 'tests') continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanAndReplace(fullPath);
    } else if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.json')) {
      replaceInFile(fullPath, [
        ['Anjani Agri Care', 'Afield Crop Care'],
        ['Anjani ERP', 'Afield ERP']
      ]);
    }
  }
}
scanAndReplace('pages');
scanAndReplace('assets');

console.log('\nGlobal Anjani replacement complete!');
