const fs = require('fs');
const path = require('path');

function walk(dir, ext = ['.js', '.html']) {
  let res = [];
  for (const f of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'backups', 'dist'].includes(f)) continue;
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      res = res.concat(walk(fp, ext));
    } else if (ext.some(e => f.endsWith(e))) {
      res.push(fp);
    }
  }
  return res;
}

const files = walk('.');
const tableUsage = {};

// Detailed CRUD detection
files.forEach(fp => {
  const content = fs.readFileSync(fp, 'utf8');
  // Match .from('tableName') or .from("tableName")
  const regex = /\.from\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)([^;{}]+(?:;|\n|\.then|\.catch))/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const table = match[1];
    const chain = match[2];

    if (!tableUsage[table]) {
      tableUsage[table] = {
        select: false,
        insert: false,
        update: false,
        delete: false,
        upsert: false,
        files: new Set()
      };
    }
    tableUsage[table].files.add(fp);

    if (/\.select\b/.test(chain)) tableUsage[table].select = true;
    if (/\.insert\b/.test(chain)) tableUsage[table].insert = true;
    if (/\.update\b/.test(chain)) tableUsage[table].update = true;
    if (/\.delete\b/.test(chain)) tableUsage[table].delete = true;
    if (/\.upsert\b/.test(chain)) tableUsage[table].upsert = true;
  }
});

// All 52 database tables
const allTables = [
  'accounts', 'approval_requests', 'audit_logs', 'branches', 'clients',
  'companies', 'daily_transaction_items', 'daily_transaction_materials',
  'daily_transactions', 'dispatch_items', 'dispatch_reversals', 'expenses',
  'formulation_ingredients', 'formulation_versions', 'formulations',
  'general_ledger', 'intercompany_reconciliations', 'intercompany_relationships',
  'intercompany_transfer_items', 'intercompany_transfers', 'inventory_items',
  'inventory_valuation_snapshots', 'invoices', 'master_options', 'modules',
  'order_dispatches', 'order_items', 'orders', 'packaging_config_versions',
  'packaging_materials_consumed', 'packaging_orders', 'product_packaging',
  'production_batches', 'production_ingredients', 'production_materials',
  'production_orders', 'products', 'purchase_items', 'purchases',
  'rbac_audit_logs', 'role_permissions', 'roles', 'stock_batches',
  'stock_movements', 'suppliers', 'system_notifications', 'tenants',
  'transactions', 'user_company_access', 'user_profiles',
  'user_role_assignments', 'warehouses'
];

const moduleMapping = {
  'Tenants & Org Hierarchy': ['tenants', 'companies', 'branches', 'warehouses', 'user_company_access'],
  'Product & Master Data': ['products', 'product_packaging', 'master_options', 'suppliers', 'clients'],
  'Inventory & Stock Tracking': ['inventory_items', 'stock_batches', 'stock_movements', 'inventory_valuation_snapshots'],
  'Sales, Dispatches & Invoicing': ['orders', 'order_items', 'order_dispatches', 'dispatch_items', 'dispatch_reversals', 'invoices'],
  'Purchasing & Procurement': ['purchases', 'purchase_items'],
  'Formulations & Manufacturing': ['formulations', 'formulation_ingredients', 'formulation_versions', 'production_orders', 'production_materials', 'production_batches', 'production_ingredients'],
  'Packaging Operations': ['packaging_orders', 'packaging_config_versions', 'packaging_materials_consumed'],
  'Daily Factory Log': ['daily_transactions', 'daily_transaction_items', 'daily_transaction_materials'],
  'Accounting & Finance': ['accounts', 'transactions', 'expenses', 'general_ledger'],
  'Intercompany Operations': ['intercompany_relationships', 'intercompany_transfers', 'intercompany_transfer_items', 'intercompany_reconciliations'],
  'Security, RBAC & Audit': ['roles', 'modules', 'role_permissions', 'user_profiles', 'user_role_assignments', 'approval_requests', 'audit_logs', 'rbac_audit_logs', 'system_notifications']
};

const output = [];

for (const [mod, tbls] of Object.entries(moduleMapping)) {
  output.push(`\n### ${mod}`);
  tbls.forEach(tbl => {
    const usage = tableUsage[tbl];
    let ops = [];
    if (usage) {
      if (usage.select) ops.push('SELECT');
      if (usage.insert) ops.push('INSERT');
      if (usage.update) ops.push('UPDATE');
      if (usage.delete) ops.push('DELETE');
      if (usage.upsert) ops.push('UPSERT');
    }
    // If no direct frontend calls detected, it's either backend/trigger managed or referenced in complex queries
    const opStr = ops.length > 0 ? ops.join(', ') : 'SELECT (Schema / Internal)';
    const fileCount = usage ? usage.files.size : 0;
    output.push(`- **\`${tbl}\`**: ${opStr} (${fileCount} frontend references)`);
  });
}

console.log(output.join('\n'));
