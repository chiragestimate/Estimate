const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const anonKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

const tables = [
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

async function checkAllTables() {
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  const accessible = [];
  const notFoundInSchemaCache = [];
  const otherError = [];

  for (const t of tables) {
    const { data, error } = await client.from(t).select('*').limit(1);
    if (!error) {
      accessible.push(t);
    } else if (error.message.includes('Could not find the table') || error.code === 'PGRST205') {
      notFoundInSchemaCache.push({ table: t, message: error.message });
    } else {
      otherError.push({ table: t, code: error.code, message: error.message });
    }
  }

  console.log(`Accessible to anon (${accessible.length}):`, accessible);
  console.log(`\nNot found in schema cache / missing permissions (${notFoundInSchemaCache.length}):`, notFoundInSchemaCache.map(x => x.table));
  console.log(`\nOther error (${otherError.length}):`, otherError);
}

checkAllTables();
