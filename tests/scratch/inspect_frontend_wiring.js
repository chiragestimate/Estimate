const fs = require('fs');
const path = require('path');

const jsFiles = [
  'assets/js/database.js',
  'assets/js/inventory.js',
  'assets/js/orders.js',
  'assets/js/production.js',
  'assets/js/purchases.js',
  'assets/js/transactions.js',
  'assets/js/intercompany.js',
  'assets/js/user-roles.js',
  'assets/js/audit-logs.js',
  'assets/js/exports.js',
  'assets/js/tenant-context.js',
  'assets/js/rbac-context.js',
  'assets/js/inventory-core.js',
  'assets/js/accounting-core.js',
  'assets/js/reports-core.js',
  'assets/js/intercompany-core.js'
];

console.log('--- SCANNING FRONTEND JS FILES FOR DB INTERACTIONS & FALLBACKS ---');

const summary = {};

jsFiles.forEach(rel => {
  const file = path.resolve(rel);
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');

  // Find all .from('table_name')
  const fromMatches = [...content.matchAll(/\.from\(['"]([a-zA-Z0-9_]+)['"]\)/g)].map(m => m[1]);
  const uniqueTables = [...new Set(fromMatches)];

  // Check for localStorage fallback or mock data
  const hasLocalStorage = content.includes('localStorage');
  const hasMockFallback = content.includes('assignRes.data ||') || content.includes('allPackagingOrders = [') || content.includes('_memoryStore') || content.includes('Fallback seed');
  const usesInventoryCore = content.includes('INVENTORY_CORE') || content.includes('INVENTORY_SERVICE');
  const usesTenantContext = content.includes('TENANT_CONTEXT');
  const usesRbac = content.includes('RBAC');

  summary[rel] = {
    queriedTables: uniqueTables,
    hasLocalStorage,
    hasMockFallback,
    usesInventoryCore,
    usesTenantContext,
    usesRbac
  };
});

console.log(JSON.stringify(summary, null, 2));
